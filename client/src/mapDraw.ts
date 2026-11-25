// Drawing the world's ground. Every kind of tile (grass, cobblestones, a roof,
// the Emberhall's white floor...) is painted once into one "tileset" picture
// when the game starts, and each area of the map becomes a Phaser tilemap made
// from it. That way even the big outdoor map draws quickly on phones.
// Trees, rocks and dig patches are separate pictures on top (they get chopped,
// emptied and dug), made here too.
import Phaser from "phaser";
import { AreaDef, MAP, MAP_NODES, TILE_SIZE, Tile, areaAt, charAt, isDanger } from "../../shared/map";
import { RESOURCES, ResourceId, fishAt } from "../../shared/foraging";

const S = TILE_SIZE;

export const TILE_COLORS: Record<Tile, number> = {
  grass: 0x4a8f3c, path: 0xb89b6a, water: 0x2d6fa3, tree: 0x2e5e22, rock: 0x7d7d7d, bridge: 0x8b5a2b,
  fence: 0x4a8f3c, gate: 0x9a8058, sign: 0x4a8f3c, wall: 0x4b3a6b, floor: 0x6d5a8e,
  house: 0x7a4f2a, boards: 0xa47a4c, dig: 0x4a8f3c, field: 0x5b8a34, cave: 0x3d3846, cavewall: 0x1f1b24, crystal: 0x33405a,
  void: 0x000000, door: 0x5c3a1a, lockeddoor: 0x3e2712, cobble: 0x9a958b, sand: 0xe0cc8e, withered: 0x8c8a4e, cliff: 0x5e5650,
  hedge: 0x2f6a2a, well: 0x9a958b, barricade: 0xb89b6a, roof: 0x8e3b2b, goldroof: 0xe2bd52, marblewall: 0xe2ddd0, marble: 0xf3efe4,
  glow: 0xfff1b8, carpet: 0xb8862b, statue: 0xf3efe4, table: 0xa47a4c, shelf: 0xa47a4c, crates: 0xa47a4c, bed: 0xc8c0e8, grave: 0x23432a, gravel: 0x7f8a5a,
};
/** The Dark Forest's ground is darker and bluer, so you can see where danger starts. */
const DARK_COLORS: Partial<Record<Tile, number>> = { grass: 0x23432a, path: 0x6b5a42, fence: 0x23432a, gate: 0x6b5a42, dig: 0x23432a, sand: 0x9c8e62, gravel: 0x3f4a32 };

/** What a tile looks like: its kind plus a few things that change the picture. */
interface Look { tile: Tile; ground: Tile; dark: boolean; v: number; door?: string }
const lookKey = (l: Look) => `${l.tile}|${l.ground}|${l.dark ? 1 : 0}|${l.v}|${l.door ?? ""}`;

/** What's on the tiles next to (x, y), for doors (which wall they're in). */
function doorStyle(x: number, y: number, area: AreaDef | null): string {
  const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => MAP[y + dy]?.[x + dx]);
  if (around.includes("marblewall") || around.includes("goldroof")) return area?.kind === "outdoor" ? "marble" : "exit_marble";
  if (around.includes("cliff")) return "cave";
  if (around.includes("cavewall")) return "exit_cave";
  if (around.includes("wall")) return area?.kind === "outdoor" ? "purple" : "exit_purple";
  return area?.kind === "outdoor" ? "wood" : "exit";
}

/** The ground under a tree or rock (and how it's drawn). */
function groundUnder(x: number, y: number, t: Tile, area: AreaDef | null): Tile {
  if (t === "rock") {
    const node = MAP_NODES[y][x];
    if (node && (RESOURCES[node].gem || node === "platinum" || node === "iridium")) return "crystal";
    if (area?.kind === "cave") return "cave";
    const ch = charAt(x, y + 1);
    if (ch === "," || ch === "l") return ch === "," ? "path" : "gravel";
    return "grass";
  }
  if (t === "tree") return area?.kind === "outdoor" && [charAt(x - 1, y), charAt(x + 1, y), charAt(x, y + 1)].includes("s") ? "sand" : "grass";
  if (t === "dig") return area?.kind === "cave" ? "cave" : charAt(x, y + 1) === "l" ? "gravel" : "grass";
  if (t === "sign" || t === "fence" || t === "gate" || t === "grave") return "grass";
  if (t === "well" || t === "statue") return t === "well" ? "cobble" : "marble";
  if (t === "table" || t === "shelf" || t === "crates" || t === "bed") {
    const below = MAP[y + 1]?.[x];
    return below === "marble" || below === "carpet" || below === "glow" ? "marble" : below === "floor" ? "floor" : area?.kind === "outdoor" ? "grass" : "boards";
  }
  if (t === "barricade") return "path";
  return t;
}

export function lookAt(x: number, y: number): Look | null {
  const t = MAP[y][x];
  if (t === "void") return null;
  const area = areaAt(x, y);
  const ground = groundUnder(x, y, t, area);
  const dark = isDanger(x, y) && area?.kind === "outdoor";
  let v = (x + y) % 2;
  if (t === "crystal" || ground === "crystal") v = ((x * 5 + y * 3) % 4) * 2 + v;
  if (t === "cave") v = (x * 7 + y * 3) % 4 === 0 ? 2 + v : v;
  if (t === "grass" && !dark && (x * 13 + y * 7) % 23 === 0) v = 2 + v; // a few flowers
  return { tile: t, ground, dark, v, door: t === "door" ? doorStyle(x, y, area) : undefined };
}

/** Paint one tile's picture at (px, py). */
function paint(g: Phaser.GameObjects.Graphics, px: number, py: number, l: Look) {
  const { tile: t, ground, dark, v } = l;
  const base = (dark ? DARK_COLORS[ground] : undefined) ?? TILE_COLORS[ground];
  // Slight checkerboard shading so you can see the tile grid.
  g.fillStyle(base, 1).fillRect(px, py, S, S);
  if (v % 2) g.fillStyle(0x000000, 0.05).fillRect(px, py, S, S);
  const hue = [0x9b59b6, 0x5dade2, 0x48c9b0, 0xf5b041][Math.floor(v / 2) % 4];
  // Ground details first.
  if (ground === "crystal" && t !== "rock") {
    g.fillStyle(hue, 0.85).fillTriangle(px + 6, py + 26, px + 9, py + 16, px + 12, py + 26);
    if (v % 2) g.fillStyle(0xd6eaf8, 0.7).fillTriangle(px + 20, py + 12, px + 23, py + 4, px + 25, py + 12);
  }
  switch (t) {
    case "grass":
      if (v >= 2) { g.fillStyle(0xffe066, 0.9).fillCircle(px + 9, py + 11, 1.6); g.fillStyle(0xff8fb0, 0.9).fillCircle(px + 22, py + 21, 1.6); }
      else if (!dark) g.fillStyle(0x3d7a31, 0.6).fillRect(px + 7, py + 20, 2, 4).fillRect(px + 22, py + 8, 2, 4);
      break;
    case "gravel":
      g.fillStyle(0x9a9a8a, 0.9).fillCircle(px + 8, py + 9, 2).fillCircle(px + 21, py + 18, 2.4).fillCircle(px + 13, py + 25, 1.6);
      g.fillStyle(0x6a6a5a, 0.8).fillCircle(px + 25, py + 7, 1.4).fillCircle(px + 5, py + 21, 1.4);
      break;
    case "withered":
      g.lineStyle(1, 0x6a5a2a, 0.9).lineBetween(px + 6, py + 26, px + 9, py + 18).lineBetween(px + 20, py + 14, px + 23, py + 6);
      g.fillStyle(0x7a6a3a, 0.5).fillCircle(px + 16, py + 22, 3);
      break;
    case "sand":
      g.fillStyle(0xc9b47a, 0.8).fillCircle(px + 7, py + 9, 1).fillCircle(px + 22, py + 15, 1).fillCircle(px + 13, py + 25, 1);
      break;
    case "cobble":
      g.lineStyle(1, 0x7d786f, 0.9).strokeRect(px + 1, py + 1, 14, 9).strokeRect(px + 17, py + 1, 14, 9).strokeRect(px + 8, py + 12, 15, 9)
        .strokeRect(px + 1, py + 23, 12, 8).strokeRect(px + 15, py + 23, 16, 8);
      break;
    case "cliff":
      g.fillStyle(0x4a433e).fillTriangle(px, py + S, px + 12, py + 8, px + 22, py + S).fillTriangle(px + 14, py + S, px + 26, py + 4, px + S, py + 20);
      g.fillStyle(0x7a716a, 0.7).fillTriangle(px + 12, py + 8, px + 14, py + 14, px + 9, py + 16).fillTriangle(px + 26, py + 4, px + 28, py + 10, px + 23, py + 12);
      break;
    case "hedge":
      g.fillStyle(0x245a20).fillCircle(px + 9, py + 12, 9).fillCircle(px + 23, py + 12, 9).fillCircle(px + 16, py + 22, 10);
      g.fillStyle(0x3f8a36, 0.8).fillCircle(px + 8, py + 9, 3).fillCircle(px + 22, py + 9, 3);
      break;
    case "well":
      g.fillStyle(0x6d6d6d).fillCircle(px + 16, py + 17, 13);
      g.fillStyle(0x2d6fa3).fillCircle(px + 16, py + 17, 8);
      g.fillStyle(0x5c3a1a).fillRect(px + 3, py + 2, 3, 15).fillRect(px + 26, py + 2, 3, 15).fillRect(px + 3, py + 2, 26, 3);
      break;
    case "barricade":
      g.lineStyle(4, 0x6e4a24).lineBetween(px + 2, py + 4, px + 30, py + 28).lineBetween(px + 30, py + 4, px + 2, py + 28);
      g.fillStyle(0xc0392b).fillRect(px + 10, py + 13, 12, 6);
      break;
    case "roof": case "goldroof": {
      const dk = t === "roof" ? 0x6e2a1e : 0xb8922e, lt = t === "roof" ? 0xa84a36 : 0xf5d77a;
      for (let row = 0; row < 4; row++) {
        g.fillStyle(row % 2 ? dk : lt, 0.55).fillRect(px, py + row * 8, S, 4);
        g.lineStyle(1, dk, 0.8).lineBetween(px + (row % 2 ? 0 : 8), py + row * 8 + 4, px + (row % 2 ? 0 : 8), py + row * 8 + 8);
        g.lineStyle(1, dk, 0.8).lineBetween(px + (row % 2 ? 16 : 24), py + row * 8 + 4, px + (row % 2 ? 16 : 24), py + row * 8 + 8);
      }
      break;
    }
    case "marblewall":
      g.fillStyle(0xc8c2b0).fillRect(px, py + 15, S, 2).fillRect(px + 15, py, 2, 15).fillRect(px + 6, py + 17, 2, 15);
      g.fillStyle(0xd4a640, 0.8).fillRect(px, py, S, 2);
      break;
    case "marble":
      g.lineStyle(1, 0xd8d2c2, 0.7).strokeRect(px + 0.5, py + 0.5, S - 1, S - 1);
      break;
    case "glow":
      g.fillStyle(0xffe27a, 0.5).fillCircle(px + 16, py + 16, 12);
      g.fillStyle(0xffffff, 0.6).fillCircle(px + 16, py + 16, 5);
      break;
    case "carpet":
      g.fillStyle(0x8a1f2a).fillRect(px, py, S, S);
      g.fillStyle(0xd4a640).fillRect(px, py + 2, S, 2).fillRect(px, py + S - 4, S, 2);
      g.fillStyle(0xd4a640, 0.6).fillCircle(px + 16, py + 16, 3);
      break;
    case "statue":
      g.fillStyle(0xbdb6a0).fillRect(px + 6, py + 22, 20, 8);
      g.fillStyle(0xd8d2c2).fillRect(px + 12, py + 9, 8, 14).fillCircle(px + 16, py + 6, 5);
      g.fillStyle(0xa9a28c).fillRect(px + 8, py + 12, 4, 7).fillRect(px + 20, py + 12, 4, 7);
      break;
    case "table":
      g.fillStyle(0x5c3a1a).fillRect(px + 4, py + 18, 3, 12).fillRect(px + 25, py + 18, 3, 12);
      g.fillStyle(0x8b5a2b).fillRect(px + 2, py + 8, 28, 12);
      g.fillStyle(0xa87038).fillRect(px + 2, py + 8, 28, 3);
      break;
    case "shelf":
      g.fillStyle(0x5c3a1a).fillRect(px + 1, py + 2, 30, 28);
      for (let row = 0; row < 3; row++) {
        g.fillStyle(0x3e2712).fillRect(px + 2, py + 3 + row * 9, 28, 8);
        for (let b = 0; b < 6; b++) g.fillStyle([0xc0392b, 0x2e86c1, 0x27ae60, 0xd4a640, 0x8e44ad, 0xd35400][(b + row) % 6]).fillRect(px + 3 + b * 4.5, py + 4 + row * 9, 3.5, 7);
      }
      break;
    case "crates":
      g.fillStyle(0x8b5a2b).fillRect(px + 2, py + 6, 28, 24);
      g.lineStyle(2, 0x5c3a1a).strokeRect(px + 2, py + 6, 28, 24).lineBetween(px + 2, py + 6, px + 30, py + 30).lineBetween(px + 30, py + 6, px + 2, py + 30);
      break;
    case "bed":
      g.fillStyle(0x6e4a2c).fillRect(px + 7, py + 2, 18, 28);
      g.fillStyle(0xf2efe6).fillRect(px + 9, py + 3, 14, 7);
      g.fillStyle(0x7d8fc9).fillRect(px + 8, py + 11, 16, 18);
      break;
    case "grave":
      g.fillStyle(0x8a8a90).fillRoundedRect(px + 9, py + 6, 14, 20, { tl: 7, tr: 7, bl: 0, br: 0 });
      g.fillStyle(0x5a5a60).fillRect(px + 13, py + 12, 6, 2).fillRect(px + 15, py + 10, 2, 8);
      g.fillStyle(0x3a2a1a).fillRect(px + 7, py + 26, 18, 3);
      break;
    case "cavewall":
      g.fillStyle(0x3a3442).fillCircle(px + 9, py + 10, 6).fillCircle(px + 22, py + 20, 7);
      g.fillStyle(0x4d4657, 0.8).fillCircle(px + 7, py + 8, 2.5).fillCircle(px + 20, py + 17, 3);
      break;
    case "cave":
      g.fillStyle(0x58516a, 0.9).fillCircle(px + 8, py + 24, 1.6).fillCircle(px + 24, py + 9, 1.3);
      if (v >= 2) g.lineStyle(1, 0xd8d8e0, 0.35).lineBetween(px, py, px + 12, py + 12).lineBetween(px + 12, py, px, py + 12).strokeCircle(px + 3, py + 3, 5);
      break;
    case "field":
      g.fillStyle(0x4f7a2c, 0.7).fillRect(px + 2, py + 6, S - 4, 3).fillRect(px + 2, py + 20, S - 4, 3);
      break;
    case "fence":
      g.fillStyle(0x5c3a1a).fillRect(px + 3, py + 6, 5, 24).fillRect(px + 24, py + 6, 5, 24);
      g.fillStyle(0x7a5230).fillRect(px, py + 11, S, 4).fillRect(px, py + 21, S, 4);
      break;
    case "gate":
      g.fillStyle(0x5c3a1a).fillRect(px, py + 4, 4, 26).fillRect(px + 28, py + 4, 4, 26);
      g.lineStyle(2, 0x7a5230, 0.9).lineBetween(px + 4, py + 12, px + 10, py + 12).lineBetween(px + 22, py + 12, px + 28, py + 12);
      break;
    case "sign":
      g.fillStyle(0x5c3a1a).fillRect(px + 14, py + 18, 4, 13);
      g.fillStyle(0xffd84a).fillTriangle(px + 16, py + 3, px + 5, py + 21, px + 27, py + 21);
      g.fillStyle(0x000000).fillRect(px + 15, py + 9, 2, 7).fillRect(px + 15, py + 17, 2, 2);
      break;
    case "wall":
      g.fillStyle(0x3a2c55).fillRect(px, py + 15, S, 2).fillRect(px + 15, py, 2, 15).fillRect(px + 6, py + 17, 2, 15);
      g.fillStyle(0x7b67a6, 0.6).fillRect(px, py, S, 2);
      break;
    case "house":
      g.fillStyle(0x5a3a1e).fillRect(px, py + 10, S, 2).fillRect(px, py + 21, S, 2);
      g.fillStyle(0x3e2712).fillRect(px, py, S, 4);
      break;
    case "boards":
      g.lineStyle(1, 0x7d5a35, 0.8).lineBetween(px, py + 8, px + S, py + 8).lineBetween(px, py + 16, px + S, py + 16).lineBetween(px, py + 24, px + S, py + 24);
      break;
    case "floor":
      g.fillStyle(0x8f78b8, 0.5).fillCircle(px + 16, py + 16, 3);
      break;
    case "bridge":
      g.lineStyle(2, 0x5c3a1a).lineBetween(px, py + 10, px + S, py + 10).lineBetween(px, py + 22, px + S, py + 22);
      break;
    case "water":
      g.fillStyle(0x4a8ac0, 0.35).fillRect(px + 4 + (v % 2) * 10, py + 9, 8, 2).fillRect(px + 16 - (v % 2) * 8, py + 22, 9, 2);
      break;
    case "door": {
      const d = l.door ?? "wood";
      if (d.startsWith("exit")) {
        // The way out of an inside place: an open doorway with a mat.
        const floor = d === "exit_marble" ? 0xf3efe4 : d === "exit_purple" ? 0x6d5a8e : d === "exit_cave" ? 0x3d3846 : 0xa47a4c;
        g.fillStyle(floor).fillRect(px, py, S, S);
        g.fillStyle(d === "exit_cave" ? 0x9fd7ff : 0xfff2b0, 0.55).fillRect(px + 3, py + 3, S - 6, S - 6);
        g.fillStyle(d === "exit_marble" ? 0xb8862b : 0x8a3b2b).fillRect(px + 6, py + 18, 20, 10);
        g.fillStyle(0xffffff, 0.9).fillTriangle(px + 16, py + 4, px + 10, py + 12, px + 22, py + 12);
      } else if (d === "cave") {
        g.fillStyle(0x5e5650).fillRect(px, py, S, S);
        g.fillStyle(0x110e14).fillEllipse(px + 16, py + 20, 26, 26);
        g.fillStyle(0x110e14).fillRect(px + 3, py + 20, 26, 12);
      } else {
        const wall = d === "marble" ? 0xe2ddd0 : d === "purple" ? 0x4b3a6b : 0x7a4f2a;
        g.fillStyle(wall).fillRect(px, py, S, S);
        g.fillStyle(d === "marble" ? 0xb8862b : 0x3e2712).fillRoundedRect(px + 5, py + 3, 22, 29, { tl: 10, tr: 10, bl: 0, br: 0 });
        g.fillStyle(d === "marble" ? 0xffe9a8 : d === "purple" ? 0x5b2c9f : 0x6e4a24).fillRoundedRect(px + 8, py + 6, 16, 26, { tl: 8, tr: 8, bl: 0, br: 0 });
        g.fillStyle(0xd4a640).fillCircle(px + 20, py + 20, 1.8);
      }
      break;
    }
    case "lockeddoor":
      g.fillStyle(0xe2ddd0).fillRect(px, py, S, S);
      g.fillStyle(0x3e2712).fillRect(px + 4, py + 2, 24, 30);
      g.fillStyle(0x555a60).fillRect(px + 4, py + 8, 24, 3).fillRect(px + 4, py + 22, 24, 3);
      g.fillStyle(0xd4a640).fillRect(px + 13, py + 14, 6, 6);
      break;
  }
}

/**
 * Paint every kind of tile the map uses into one picture ("tiles") and work
 * out which picture each tile uses. Returns (x, y) -> index into the picture.
 */
export function buildTileset(scene: Phaser.Scene): (x: number, y: number) => number {
  const looks = new Map<string, number>();
  const list: Look[] = [];
  const index = (x: number, y: number) => {
    const l = lookAt(x, y);
    if (!l) return -1;
    const k = lookKey(l);
    let i = looks.get(k);
    if (i === undefined) { i = list.length; looks.set(k, i); list.push(l); }
    return i;
  };
  // Find every look first (one pass over the map), then paint them.
  const cache = new Map<number, number>();
  for (let y = 0; y < MAP.length; y++) for (let x = 0; x < MAP[0].length; x++) cache.set(y * MAP[0].length + x, index(x, y));
  const COLS = 16;
  const rows = Math.ceil(list.length / COLS);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  list.forEach((l, i) => paint(g, (i % COLS) * S, Math.floor(i / COLS) * S, l));
  g.generateTexture("tiles", COLS * S, rows * S);
  g.destroy();
  return (x, y) => cache.get(y * MAP[0].length + x) ?? -1;
}

// ---- Trees, rocks and dig patches (each its own little picture) ----

function tex(scene: Phaser.Scene, key: string, draw: (g: Phaser.GameObjects.Graphics) => void) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, S, S);
  g.destroy();
}

export function treeTexture(scene: Phaser.Scene, type: ResourceId): string {
  const key = `tree_${type}`;
  tex(scene, key, (tree) => {
    const leaves = RESOURCES[type].color;
    const highlight = Phaser.Display.Color.ValueToColor(leaves).lighten(18).color;
    const trunk = type === "birch" ? 0xe8e4d8 : type === "ironwood" ? 0x3a3a3a : 0x5b3a1e;
    tree.fillStyle(0x000000, 0.25).fillEllipse(16, 29, 20, 5);
    tree.fillStyle(trunk).fillRect(13, 18, 6, 12);
    if (type === "birch") tree.fillStyle(0x333333).fillRect(14, 21, 3, 1).fillRect(15, 25, 3, 1);
    if (type === "pine") {
      tree.fillStyle(leaves).fillTriangle(16, 0, 4, 22, 28, 22);
      tree.fillStyle(highlight).fillTriangle(16, 3, 10, 14, 18, 14);
    } else {
      const big = RESOURCES[type].level >= 35 ? 13 : 11;
      tree.fillStyle(leaves).fillCircle(16, 13, big);
      tree.fillStyle(highlight).fillCircle(13, 10, 5);
      if (type === "elderwood") tree.fillStyle(0xe0c8ff).fillCircle(20, 8, 1.5).fillCircle(10, 15, 1.5).fillCircle(21, 17, 1.5);
    }
  });
  return key;
}

export function stumpTexture(scene: Phaser.Scene): string {
  tex(scene, "stump", (s) => {
    s.fillStyle(0x5b3a1e).fillEllipse(16, 24, 14, 8);
    s.fillStyle(0xc9a26b).fillEllipse(16, 22, 12, 6);
  });
  return "stump";
}

export function rockTexture(scene: Phaser.Scene, type: ResourceId): string {
  const key = `rock_${type}`;
  tex(scene, key, (full) => {
    full.fillStyle(TILE_COLORS.rock).fillEllipse(16, 18, 26, 20);
    full.fillStyle(0x9a9a9a).fillEllipse(12, 14, 10, 6);
    if (RESOURCES[type].gem) {
      const c = RESOURCES[type].color;
      full.fillStyle(c).fillTriangle(7, 22, 10, 6, 14, 22).fillTriangle(13, 22, 17, 3, 21, 22).fillTriangle(19, 23, 23, 11, 26, 23);
      full.fillStyle(0xffffff, 0.55).fillTriangle(10, 9, 11, 18, 12, 18).fillTriangle(17, 6, 18, 17, 19, 17);
    } else {
      const fleck = RESOURCES[type].color;
      full.fillStyle(fleck).fillCircle(10, 19, 2.5).fillCircle(19, 15, 2).fillCircle(21, 22, 2.5).fillCircle(14, 23, 1.5);
      if (RESOURCES[type].level >= 40) full.fillStyle(0xffffff, 0.9).fillCircle(19, 14, 0.8).fillCircle(9, 18, 0.8);
    }
  });
  return key;
}

export function emptyRockTexture(scene: Phaser.Scene): string {
  tex(scene, "rock_empty", (empty) => {
    empty.fillStyle(0x6a6a6a).fillEllipse(16, 21, 22, 14);
    empty.fillStyle(0x5a5a5a).fillEllipse(16, 22, 12, 6);
  });
  return "rock_empty";
}

export function patchTextures(scene: Phaser.Scene): [string, string] {
  tex(scene, "patch", (t) => {
    t.fillStyle(0x6b4a2b).fillEllipse(16, 19, 22, 11);
    t.fillStyle(0x8a6239).fillEllipse(15, 17, 16, 7);
    t.fillStyle(0x4f3520).fillCircle(10, 19, 1.4).fillCircle(21, 20, 1.2);
  });
  tex(scene, "patch_dug", (s) => {
    s.fillStyle(0x3e2a18, 0.9).fillEllipse(16, 19, 18, 8);
    s.fillStyle(0x6b4a2b).fillCircle(8, 16, 2).fillCircle(24, 17, 2.4);
  });
  return ["patch", "patch_dug"];
}

/** Special fishing spots (better fish than minnows) in an area, for drawing ripples. */
export function fishingSpotsIn(a: AreaDef): { x: number; y: number; type: ResourceId }[] {
  const out: { x: number; y: number; type: ResourceId }[] = [];
  for (let y = a.y; y < a.y + a.h; y++) for (let x = a.x; x < a.x + a.w; x++) {
    if (MAP[y][x] !== "water" || !MAP_NODES[y][x]) continue;
    const f = fishAt(x, y);
    if (f && f !== "minnow") out.push({ x, y, type: f });
  }
  return out;
}
