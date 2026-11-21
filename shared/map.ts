import { npcAt } from "./npcs";
import type { ResourceId } from "./foraging";
import { AREAS, AreaDef, DOORS, Door, FENCE_Y, GATE as WORLD_GATE, PLACES, Point, WORLD_H, WORLD_ROWS, WORLD_W } from "./world";
// The world map, shared by server (walkability, pathfinding) and client (drawing).
// The map itself is built in shared/world.ts: the big outdoor map (Heartvale)
// and every inside place, all on one grid. This file turns its characters into
// tiles and answers questions about them (can I walk here? which area is this?).
//
// Legend: see shared/world.ts.

export const TILE_SIZE = 32;
export const TICK_MS = 600; // one game tick, like old-school RuneScape

export type Tile = "grass" | "path" | "water" | "tree" | "rock" | "bridge" | "fence" | "gate" | "sign" | "wall" | "floor" | "house" | "boards"
  | "dig" | "cave" | "cavewall" | "crystal" | "field"
  | "void" | "door" | "lockeddoor" | "cobble" | "sand" | "withered" | "cliff" | "hedge" | "well" | "barricade" | "roof" | "goldroof"
  | "marblewall" | "marble" | "glow" | "carpet" | "statue" | "table" | "shelf" | "crates" | "grave" | "gravel";

const LEGEND: Record<string, Tile> = {
  ".": "grass", ",": "path", "~": "water", "=": "bridge", ":": "grass", "|": "fence", "+": "gate", "!": "sign",
  W: "wall", _: "floor", H: "house", p: "boards",
  "*": "dig", C: "cave", K: "cavewall", G: "crystal", f: "field",
  " ": "void", D: "door", J: "lockeddoor", ";": "cobble", s: "sand", w: "withered", "^": "cliff", h: "hedge", q: "well", x: "barricade",
  r: "roof", u: "goldroof", A: "marblewall", a: "marble", o: "glow", z: "carpet", S: "statue", n: "table", b: "shelf", e: "crates", V: "grave", l: "gravel",
};

/** Map letters for each type of tree, rock and fishing spot. */
const NODE_LEGEND: Record<string, [Tile, ResourceId]> = {
  T: ["tree", "pine"], O: ["tree", "oak"], B: ["tree", "birch"], M: ["tree", "maple"],
  Y: ["tree", "yew"], I: ["tree", "ironwood"], E: ["tree", "elderwood"],
  "#": ["rock", "stone"], c: ["rock", "copper"], t: ["rock", "tin"], i: ["rock", "iron"],
  k: ["rock", "coal"], v: ["rock", "silver"], g: ["rock", "gold"], m: ["rock", "mithril"],
  2: ["water", "trout"], 3: ["water", "perch"], 4: ["water", "salmon"], 5: ["water", "pike"],
  6: ["water", "tuna"], 7: ["water", "swordfish"], 8: ["water", "eel"],
  // The crystal cave: gem rocks, soul stone veins, platinum and iridium.
  U: ["rock", "amethyst"], Q: ["rock", "topaz"], L: ["rock", "soulstone"], N: ["rock", "emerald"],
  Z: ["rock", "sapphire"], R: ["rock", "ruby"], P: ["rock", "platinum"], X: ["rock", "iridium"],
};

const ROWS = WORLD_ROWS.map((row) => [...row]);
export const MAP: Tile[][] = ROWS.map((row) => row.map((ch) => NODE_LEGEND[ch]?.[0] ?? LEGEND[ch] ?? "grass"));
/** Which type of tree, rock or special fishing spot is on each tile (null if none). */
export const MAP_NODES: (ResourceId | null)[][] = ROWS.map((row) => row.map((ch) => NODE_LEGEND[ch]?.[1] ?? null));
export const MAP_HEIGHT = WORLD_H;
export const MAP_WIDTH = WORLD_W;
/** The raw map character on a tile (" " outside the map). */
export const charAt = (x: number, y: number) => ROWS[y]?.[x] ?? " ";

const BLOCKED: ReadonlySet<Tile> = new Set<Tile>([
  "water", "tree", "rock", "fence", "sign", "wall", "house", "cavewall",
  "void", "lockeddoor", "cliff", "hedge", "well", "barricade", "roof", "goldroof", "marblewall", "statue", "table", "shelf", "crates", "grave",
]);
export const isBlockedTile = (t: Tile) => BLOCKED.has(t);

// ---- Areas: the outdoors, and each inside place ----

export { AREAS, DOORS, PLACES };
export type { AreaDef, Door, Point };
const AREA_INDEX = new Int16Array(MAP_WIDTH * MAP_HEIGHT).fill(-1);
AREAS.forEach((a, i) => {
  for (let y = a.y; y < a.y + a.h; y++) for (let x = a.x; x < a.x + a.w; x++) AREA_INDEX[y * MAP_WIDTH + x] = i;
});
/** The area a tile is in (null for the empty space between areas). */
export function areaAt(x: number, y: number): AreaDef | null {
  if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return null;
  const i = AREA_INDEX[y * MAP_WIDTH + x];
  return i < 0 ? null : AREAS[i];
}
export const areaById = (id: string) => AREAS.find((a) => a.id === id) ?? null;
export const OUTDOORS = AREAS[0];
export const isOutdoors = (x: number, y: number) => areaAt(x, y) === OUTDOORS;

const DOOR_INDEX = new Map<number, Door>(DOORS.map((d) => [d.y * MAP_WIDTH + d.x, d]));
/** The door on a tile, if any. */
export const doorAt = (x: number, y: number): Door | null => (x < 0 || y < 0 || x >= MAP_WIDTH ? null : DOOR_INDEX.get(y * MAP_WIDTH + x) ?? null);

// ---- Danger ----

/** The gate into the Dark Forest (the Thornwood), and the first row of the danger zone (the fence row). */
export const GATE = WORLD_GATE;
export const DANGER_TOP = FENCE_Y;
/** The Dark Forest, and dangerous caves: monsters there attack on sight. */
export function isDanger(x: number, y: number): boolean {
  const a = areaAt(x, y);
  if (!a) return false;
  return a === OUTDOORS ? y >= DANGER_TOP : !!a.danger;
}

export function isWalkable(x: number, y: number): boolean {
  if (y < 0 || y >= MAP_HEIGHT || x < 0 || x >= MAP_WIDTH) return false;
  return !BLOCKED.has(MAP[y][x]) && !npcAt(x, y);
}

/** Where new characters wake up: on the steps of the Heart Shrine, inside the Lighthall. */
export const WAKE_SPOT: Point = PLACES.wake;
/** Where everyone from before the big map lands: the town square, by the Lighthall's steps. */
export const TOWN_SPOT: Point = PLACES.lighthallSteps;

/** A free tile near a spot (for waking up, or being knocked out). */
export function spotNear(p: Point): Point {
  for (let r = 0; r < 6; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = p.x + dx, y = p.y + dy;
      if (isWalkable(x, y) && !doorAt(x, y) && areaAt(x, y) === areaAt(p.x, p.y)) return { x, y };
    }
  }
  return p;
}

export function randomSpawn(): { x: number; y: number } {
  // Somewhere on the town square, near the Lighthall's steps.
  for (let i = 0; i < 50; i++) {
    const x = TOWN_SPOT.x - 4 + Math.floor(Math.random() * 9);
    const y = TOWN_SPOT.y + 1 + Math.floor(Math.random() * 3);
    if (isWalkable(x, y)) return { x, y };
  }
  return spotNear(TOWN_SPOT);
}
