// The 3D world, built from the same tile map the server uses (shared/map.ts).
//
// One map tile is 2 m (TILE). Tile (x, y) covers x*2..x*2+2 along X and
// y*2..y*2+2 along Z, so the map's "down" (south) is +Z.
//
// The world is cut into chunks of 8 x 8 tiles. Only chunks near you are
// built (a little at a time, so walking never stutters), and only the area
// you're in (the outdoors, or one building or cave). Ground and floors come
// from the environment library, trees and rocks from their libraries, and the
// many copies are drawn as instances (see instancer.ts).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { AREAS, AreaDef, DOORS, MAP, MAP_NODES, OUTDOORS, Tile, areaAt, charAt } from "../../../shared/map";
import { CITY_BUILDINGS, CITY_SIGNS, type CityBuilding } from "../../../shared/world";
import { cityBackdrop, cityLand, emberhallCrown, gpuOnly, rampartBlock, RAMPART_H } from "./city";
import { treeKey, type ResourceId } from "../../../shared/foraging";
import { NPCS } from "../../../shared/npcs";
import { createEnv, house, TILE, type EnvPiece } from "../environment";
import type { RoofKind, WallKind } from "../environment/building";
import { hash2, makeRng, noise2, mix, rockGeo, painted, WALL_H } from "../environment/kit";
import { createTree, TREE_TYPES, type Tree, type TreeKind } from "../trees";
import { createRock, ROCK_TYPES, type Rock, type RockKind } from "../rocks";
import { createFood } from "../food";
import { Instancer } from "./instancer";
import { bed, bookshelf, goodsShelf, tableTop } from "./furniture";
import { makeBrazier } from "./flame";

export const CHUNK = 8;
/** How far from you (in tiles) chunks are built. */
export const VIEW_TILES = 30;
/** Trees and rocks this close are live library objects (they sway, shake and fall). */
const LIVE_TILES = 7;

/** The middle of a tile, in world metres. */
export const tileCenter = (x: number, y: number) => new THREE.Vector3((x + 0.5) * TILE, 0, (y + 0.5) * TILE);

// ---------------------------------------------------------------- what's on each tile

type Ground = { id: string; variant: number };

/** Ground and floor tiles you walk on, and which library patch draws them. */
function floorOf(t: Tile, area: AreaDef): Ground | null {
  switch (t) {
    case "grass": return { id: "ground-grass", variant: 0 };
    case "path": return { id: "ground-path", variant: 0 };
    case "cobble": return { id: "ground-cobble", variant: 0 };
    case "sand": return { id: "ground-sand", variant: 0 };
    case "withered": return { id: "ground-withered", variant: 0 };
    case "gravel": return { id: "ground-gravel", variant: 0 };
    case "field": return { id: "ground-field", variant: 0 };
    case "boards": return { id: "floor-boards", variant: 0 };
    case "floor": return { id: "floor-boards", variant: area.id === "inn" ? 1 : 2 };
    case "marble": return { id: "floor-marble", variant: 2 };
    case "carpet": return { id: "floor-rug", variant: area.id === "guild" ? 0 : area.id === "lighthall" ? 1 : 2 };
    case "glow": return { id: "floor-glow", variant: 0 };
    case "cave": return { id: "floor-cave", variant: area.id === "old_mine" ? 2 : 0 };
    case "crystal": return { id: "floor-crystal", variant: 2 };
    case "bridge": return { id: "floor-boards", variant: 2 };
    default: return null;
  }
}

/** Tiles with something standing on them get the ground of their neighbours underneath. */
const STANDS_ON = new Set<Tile>(["tree", "rock", "dig", "sign", "fence", "gate", "hedge", "well", "barricade", "statue", "grave", "crates", "table", "shelf", "bed", "door", "lockeddoor", "brazier", "innerdoor", "rampart", "tower", "citygate", "lamp", "stall"]);

function groundUnder(x: number, y: number, area: AreaDef): Ground {
  for (let r = 1; r <= 3; r++) {
    const counts = new Map<string, { g: Ground; n: number }>();
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (areaAt(x + dx, y + dy) !== area) continue;
      const t = MAP[y + dy]?.[x + dx];
      const g = t && t !== "bridge" && t !== "carpet" ? floorOf(t, area) : null;
      if (!g) continue;
      const k = `${g.id}:${g.variant}`;
      const c = counts.get(k) ?? { g, n: 0 };
      c.n++;
      counts.set(k, c);
    }
    let best: { g: Ground; n: number } | null = null;
    for (const c of counts.values()) if (!best || c.n > best.n) best = c;
    if (best) return best.g;
  }
  return area.kind === "cave" ? { id: "floor-cave", variant: 0 } : area.kind === "indoor" ? { id: "floor-boards", variant: 0 } : { id: "ground-grass", variant: 0 };
}

function groundAt(x: number, y: number, area: AreaDef): Ground | null {
  const t = MAP[y][x];
  // Outside, buildings stand on the ground of the street round them.
  if (area.kind === "outdoor" && (t === "house" || t === "roof" || t === "goldroof" || t === "wall" || t === "marblewall" || t === "door")) return groundUnder(x, y, area);
  // Carpets are drawn whole, one rug per carpet (see buildAreaWide), on the floor round them.
  if (t === "carpet") return groundUnder(x, y, area);
  const f = floorOf(t, area);
  if (f) return f;
  if (STANDS_ON.has(t)) return groundUnder(x, y, area);
  return null;
}

// ---------------------------------------------------------------- shared materials

const vcol = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });

/** Water: one shiny surface with small moving waves. */
export function makeWaterMaterial(): { material: THREE.MeshStandardMaterial; tick: (t: number) => void } {
  const material = new THREE.MeshStandardMaterial({ color: 0x3a84b0, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.9 });
  const uniforms = { uTime: { value: 0 } };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       vec4 wp = modelMatrix * vec4(position, 1.0);
       transformed.y += sin(wp.x * 0.9 + uTime * 1.3) * 0.04 + cos(wp.z * 0.7 + uTime * 1.1) * 0.04;`,
    );
    shader.fragmentShader = "uniform float uTime;\n" + shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
       normal = normalize(normal + vec3(sin(vViewPosition.x * 1.7 + uTime * 1.6) * 0.06, 0.0, cos(vViewPosition.y * 1.3 + uTime * 1.2) * 0.06));`,
    );
  };
  return { material, tick: (t) => { uniforms.uTime.value = t; } };
}

// ---------------------------------------------------------------- a chunk

interface Live { update(dt: number, time: number, night: number): void; dispose(): void; object: THREE.Object3D }

interface Chunk {
  cx: number;
  cy: number;
  group: THREE.Group;
  /** Instance ids it added (so they go when it goes). */
  instances: string[];
  /** Things that move (fences don't, but fishing spots and dig glints do). */
  live: Live[];
  /** Trees and rocks in it: key -> node. */
  nodes: string[];
  done: boolean;
  job?: Generator<void, void, void>;
}

interface Node {
  key: string;
  x: number;
  y: number;
  type: "tree" | "rock";
  kind: string;
  variant: number;
  seed: number;
  matrix: THREE.Matrix4;
  live?: { tree?: Tree; rock?: Rock; object: THREE.Object3D };
}

/** What a click on the world hit. */
export interface Pick { x: number; y: number }

// Which tree and rock looks the world uses. Pine "Snowy" only belongs on the peaks.
const TREE_VARIANTS: Partial<Record<TreeKind, number[]>> = { pine: [0, 1], oak: [0, 1], birch: [0, 1], maple: [0, 1, 2], yew: [0, 1, 2] };
const PROTO_SEEDS = 4;

function treeLook(kind: TreeKind, x: number, y: number) {
  const vs = TREE_VARIANTS[kind] ?? TREE_TYPES[kind].variants.map((_, i) => i);
  const h = hash2(x, y, 77);
  return { variant: vs[Math.floor(h * vs.length) % vs.length], seed: 1 + Math.floor(hash2(x, y, 78) * PROTO_SEEDS) };
}

export class Terrain {
  readonly root = new THREE.Group();
  private chunks = new Map<string, Chunk>();
  private nodes = new Map<string, Node>();
  private instancer: Instancer;
  private depleted = new Set<string>();
  private area: AreaDef = OUTDOORS;
  private areaObjects: { object: THREE.Object3D; update?: (dt: number, t: number, night: number) => void; dispose?: () => void }[] = [];
  private center = { x: 0, y: 0 };
  private water = makeWaterMaterial();
  private wantArea: AreaDef | null = null;
  /** Lamps and shrines that can be lit (story): id -> setLit. */
  readonly signs: { text: string; at: THREE.Vector3 }[] = [];
  /** Invisible boxes over the outside doors, so tapping the door itself works. */
  private doorPicks: THREE.Mesh[] = [];
  /** Doors inside buildings (between rooms, and the way out): tap anywhere on one to walk through it. */
  private insideDoors = new Set<THREE.Object3D>();
  /** Where people are standing (you, and anyone else here): doors swing open as they come near. */
  walkers: THREE.Vector3[] = [];

  /**
   * How tall whatever stands on this tile is, in metres (0 for open ground):
   * buildings outside, walls inside. The camera stays out of them.
   */
  blockHeight(x: number, y: number): number {
    if (areaAt(x, y) !== this.area) return 0;
    const t = MAP[y]?.[x];
    if (this.area.kind === "outdoor") return t === "rampart" || t === "tower" || t === "citygate" ? RAMPART_H[t] : buildingHeight(x, y);
    return t === "wall" || t === "house" || t === "marblewall" || t === "lockeddoor" ? 2.2 : 0;
  }

  constructor() {
    this.instancer = new Instancer(this.root);
    this.root.add(this.instGroup);
  }
  private instGroup = new THREE.Group();

  get here() { return this.area; }

  /** Show a different area (outdoors, or inside a building or cave). */
  setArea(a: AreaDef) {
    if (a === this.area && this.areaObjects.length) return;
    this.wantArea = null;
    for (const c of [...this.chunks.values()]) this.dropChunk(c);
    for (const o of this.areaObjects) { this.root.remove(o.object); o.dispose?.(); }
    this.areaObjects = [];
    this.doorPicks.length = 0;
    this.signs.length = 0;
    this.area = a;
    this.buildAreaWide(a);
  }

  /** Where you are now (tile): load the chunks round you and wake the trees next to you. */
  setCenter(x: number, y: number) {
    this.center = { x, y };
    const a = this.area;
    const c0x = Math.floor((x - VIEW_TILES) / CHUNK), c1x = Math.floor((x + VIEW_TILES) / CHUNK);
    const c0y = Math.floor((y - VIEW_TILES) / CHUNK), c1y = Math.floor((y + VIEW_TILES) / CHUNK);
    const want = new Set<string>();
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
      // Only chunks that overlap the area you're in.
      if ((cx + 1) * CHUNK <= a.x || cx * CHUNK >= a.x + a.w || (cy + 1) * CHUNK <= a.y || cy * CHUNK >= a.y + a.h) continue;
      const mx = (cx + 0.5) * CHUNK, my = (cy + 0.5) * CHUNK;
      if (Math.hypot(mx - x, my - y) > VIEW_TILES + CHUNK * 0.75) continue;
      const k = `${cx},${cy}`;
      want.add(k);
      if (!this.chunks.has(k)) this.startChunk(cx, cy);
    }
    for (const [k, c] of this.chunks) if (!want.has(k)) this.dropChunk(c);
    this.refreshLive();
  }

  /** True while chunks right round you are still being built (for the loading screen). */
  loadingNear(): boolean {
    for (const c of this.chunks.values()) {
      if (c.done) continue;
      const mx = (c.cx + 0.5) * CHUNK, my = (c.cy + 0.5) * CHUNK;
      if (Math.hypot(mx - this.center.x, my - this.center.y) < CHUNK * 2) return true;
    }
    return false;
  }

  // ---- resources: trees, rocks (the server says which are used up) ----

  setDepleted(key: string, on: boolean) {
    if (on) this.depleted.add(key); else this.depleted.delete(key);
    const n = this.nodes.get(key);
    if (!n) return;
    if (on) {
      const live = this.wake(n, false);
      live.tree?.fell();
      live.rock?.deplete();
    } else if (n.live) {
      n.live.tree?.regrow();
      n.live.rock?.refill();
    }
  }

  isDepleted(key: string) { return this.depleted.has(key); }
  clearDepleted() { for (const k of [...this.depleted]) this.setDepleted(k, false); }

  /** Someone chops or mines a tile: shake it. */
  hitNode(x: number, y: number) {
    const n = this.nodes.get(treeKey(x, y));
    if (!n || this.depleted.has(n.key)) return;
    const live = this.wake(n, false);
    live.tree?.hit();
    live.rock?.hit();
  }

  /** Make a tree or rock a live library object (hiding its instance). */
  private wake(n: Node, settle: boolean) {
    if (n.live) return n.live;
    let object: THREE.Object3D;
    const live: Node["live"] = { object: null as unknown as THREE.Object3D };
    if (n.type === "tree") {
      const tree = createTree(n.kind as TreeKind, { seed: n.seed, variant: n.variant });
      live.tree = tree;
      object = tree.object;
      if (settle) { tree.fell(); for (let i = 0; i < 50; i++) tree.update(0.1, i * 0.1, 0); }
    } else {
      const rock = createRock(n.kind as RockKind, { seed: n.seed, variant: n.variant });
      live.rock = rock;
      object = rock.object;
      if (settle) { rock.deplete(); for (let i = 0; i < 50; i++) rock.update(0.1, i * 0.1, 0); }
    }
    object.matrixAutoUpdate = false;
    object.matrix.copy(n.matrix);
    object.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    object.userData.tile = { x: n.x, y: n.y };
    live.object = object;
    this.root.add(object);
    n.live = live;
    this.instancer.setHidden(n.key, true);
    return live;
  }

  private sleep(n: Node) {
    if (!n.live) return;
    this.root.remove(n.live.object);
    n.live.tree?.dispose();
    n.live.rock?.dispose();
    n.live = undefined;
    this.instancer.setHidden(n.key, false);
  }

  /** Trees and rocks right by you are live; far ones go back to being instances. */
  private refreshLive() {
    for (const n of this.nodes.values()) {
      const near = Math.abs(n.x - this.center.x) <= LIVE_TILES && Math.abs(n.y - this.center.y) <= LIVE_TILES;
      const busy = this.depleted.has(n.key) || (n.live?.tree && n.live.tree.state !== "standing") || (n.live?.rock && n.live.rock.state !== "full");
      if ((near || busy) && !n.live) this.wake(n, this.depleted.has(n.key));
      else if (!near && !busy && n.live) this.sleep(n);
    }
  }

  // ---- every frame ----

  /** Build a little more of the world (about `budgetMs` of work), and animate what moves. */
  update(dt: number, time: number, night: number, wind: number, budgetMs = 7) {
    const start = performance.now();
    // Nearest unfinished chunk first.
    const todo = [...this.chunks.values()].filter((c) => !c.done)
      .sort((a, b) => Math.hypot(a.cx * CHUNK - this.center.x, a.cy * CHUNK - this.center.y) - Math.hypot(b.cx * CHUNK - this.center.x, b.cy * CHUNK - this.center.y));
    for (const c of todo) {
      while (!c.done && performance.now() - start < budgetMs) {
        const r = c.job!.next();
        if (r.done) { c.done = true; c.job = undefined; this.refreshLive(); }
      }
      if (performance.now() - start >= budgetMs) break;
    }
    this.instancer.flush();
    this.water.tick(time);
    for (const n of this.nodes.values()) {
      if (!n.live) continue;
      n.live.tree?.update(dt, time, wind);
      n.live.rock?.update(dt, time, night);
    }
    for (const c of this.chunks.values()) for (const l of c.live) l.update(dt, time, night);
    for (const o of this.areaObjects) o.update?.(dt, time, night);
  }

  // ---- clicking ----

  /** Objects worth raycasting (trees, rocks, doors), before falling back to the ground. */
  pickables(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [...this.instancer.meshes(), ...this.doorPicks, ...this.insideDoors];
    for (const n of this.nodes.values()) if (n.live) out.push(n.live.object);
    return out;
  }

  /** Which tile a raycast hit on a tree or rock belongs to. */
  tileOfHit(hit: THREE.Intersection): Pick | null {
    const id = this.instancer.idAt(hit);
    if (id) { const n = this.nodes.get(id); if (n) return { x: n.x, y: n.y }; }
    // Bookshelves can be clicked (to read a book).
    const m = id && /^p(-?\d+),(-?\d+)$/.exec(id);
    if (m && MAP[+m[2]]?.[+m[1]] === "shelf") return { x: +m[1], y: +m[2] };
    for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) if (o.userData.tile) return o.userData.tile as Pick;
    return null;
  }

  // ---------------------------------------------------------------- building

  private startChunk(cx: number, cy: number) {
    const c: Chunk = { cx, cy, group: new THREE.Group(), instances: [], live: [], nodes: [], done: false };
    c.job = this.buildChunk(c);
    this.root.add(c.group);
    this.chunks.set(`${cx},${cy}`, c);
  }

  private dropChunk(c: Chunk) {
    this.chunks.delete(`${c.cx},${c.cy}`);
    this.root.remove(c.group);
    c.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    for (const l of c.live) l.dispose();
    for (const id of c.instances) this.instancer.remove(id);
    for (const k of c.nodes) {
      const n = this.nodes.get(k);
      if (n) this.sleep(n);
      this.nodes.delete(k);
      this.instancer.remove(k);
    }
  }

  private inChunk(c: Chunk, f: (x: number, y: number) => void) {
    const a = this.area;
    for (let y = c.cy * CHUNK; y < (c.cy + 1) * CHUNK; y++) for (let x = c.cx * CHUNK; x < (c.cx + 1) * CHUNK; x++) {
      if (x < a.x || y < a.y || x >= a.x + a.w || y >= a.y + a.h) continue;
      f(x, y);
    }
  }

  private *buildChunk(c: Chunk): Generator<void, void, void> {
    const a = this.area;
    // 1. Ground: rectangles of the same patch type, at most 4 x 4 tiles each.
    const kinds: (Ground | null)[] = [];
    const idx = (x: number, y: number) => (y - c.cy * CHUNK) * CHUNK + (x - c.cx * CHUNK);
    for (let y = c.cy * CHUNK; y < (c.cy + 1) * CHUNK; y++) for (let x = c.cx * CHUNK; x < (c.cx + 1) * CHUNK; x++) {
      kinds[idx(x, y)] = x >= a.x && y >= a.y && x < a.x + a.w && y < a.y + a.h && MAP[y]?.[x] ? groundAt(x, y, a) : null;
    }
    const used = new Uint8Array(CHUNK * CHUNK);
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const extras: EnvPiece[] = [];
    for (let j = 0; j < CHUNK; j++) for (let i = 0; i < CHUNK; i++) {
      const g = kinds[j * CHUNK + i];
      if (!g || used[j * CHUNK + i]) continue;
      const same = (ii: number, jj: number) => { const o = kinds[jj * CHUNK + ii]; return !used[jj * CHUNK + ii] && o && o.id === g.id && o.variant === g.variant; };
      let w = 1;
      while (i + w < CHUNK && w < 4 && same(i + w, j)) w++;
      let h = 1;
      outer: while (j + h < CHUNK && h < 4) {
        for (let k = 0; k < w; k++) if (!same(i + k, j + h)) break outer;
        h++;
      }
      for (let jj = j; jj < j + h; jj++) for (let ii = i; ii < i + w; ii++) used[jj * CHUNK + ii] = 1;
      const x0 = (c.cx * CHUNK + i) * TILE, z0 = (c.cy * CHUNK + j) * TILE;
      const piece = createEnv(g.id, { variant: g.variant, x0, z0, w: w * TILE, d: h * TILE, seed: 1 });
      const isBridge = MAP[c.cy * CHUNK + j][c.cx * CHUNK + i] === "bridge";
      piece.object.updateMatrixWorld(true);
      let animated = false;
      piece.object.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = m.material as THREE.MeshStandardMaterial;
        // Glowing floors animate their own material: keep those pieces whole.
        if (mat.emissive && mat.emissive.getHex() !== 0) animated = true;
      });
      if (animated) {
        if (isBridge) piece.object.position.y = 0.15;
        c.group.add(piece.object);
        extras.push(piece);
      } else {
        piece.object.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh || Array.isArray(m.material)) return;
          let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
          geo.applyMatrix4(m.matrixWorld);
          if (isBridge) geo.translate(0, 0.15, 0);
          const list = byMat.get(m.material) ?? [];
          list.push(geo);
          byMat.set(m.material, list);
        });
        piece.dispose();
      }
      yield;
    }
    for (const [mat, geos] of byMat) {
      const keep = ["position", "normal", "color"].filter((n) => geos.every((g) => g.attributes[n]));
      for (const g of geos) for (const n of Object.keys(g.attributes)) if (!keep.includes(n)) g.deleteAttribute(n);
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const m = new THREE.Mesh(gpuOnly(merged), mat);
      m.receiveShadow = true;
      c.group.add(m);
    }
    for (const e of extras) c.live.push({ object: e.object, update: (dt, t, night) => e.update(dt, t, { night, wind: 0.3 }), dispose: () => e.dispose() });
    yield;

    // 2. Cliffs and inside walls: solid blocks, merged into one mesh.
    const blocks: THREE.BufferGeometry[] = [];
    this.inChunk(c, (x, y) => {
      const t = MAP[y][x];
      const rng = makeRng(Math.floor(hash2(x, y, 5) * 1e9) + 1);
      if (t === "cliff") {
        const h = 2.4 + Math.round(noise2(x * TILE, y * TILE, 9, 3) * 3) * 0.7;
        const g = new THREE.BoxGeometry(TILE, h, TILE, 1, 3, 1).toNonIndexed();
        const pos = g.attributes.position as THREE.BufferAttribute;
        const col = new Float32Array(pos.count * 3);
        const cc = new THREE.Color();
        for (let k = 0; k < pos.count; k++) {
          const py = pos.getY(k) + h / 2;
          const top = py > h - 0.01;
          if (!top) pos.setX(k, pos.getX(k) * (1 + (hash2(x * 31 + k, y, 2) - 0.5) * 0.08));
          cc.setHex(top ? mix(0x6aa843, 0x86bd52, hash2(x, y, 9)) : mix(0x8a8072, 0x6e665c, (Math.sin(py * 2.2 + x * 0.3) + 1) / 2));
          col.set([cc.r, cc.g, cc.b], k * 3);
        }
        g.setAttribute("color", new THREE.BufferAttribute(col, 3));
        g.deleteAttribute("uv");
        g.translate((x + 0.5) * TILE, h / 2 - 0.05, (y + 0.5) * TILE);
        blocks.push(g);
      } else if (a.kind !== "outdoor" && (t === "wall" || t === "house" || t === "marblewall" || t === "lockeddoor")) {
        const color = t === "marblewall" ? 0xf2efe8 : t === "house" ? 0x9c6a42 : t === "lockeddoor" ? 0x5a3a22 : a.id === "guild" ? 0x6a4a9a : 0x8e8c86;
        const h = 2.2;
        const g = new THREE.BoxGeometry(TILE, h, TILE).toNonIndexed();
        g.deleteAttribute("uv");
        g.translate((x + 0.5) * TILE, h / 2, (y + 0.5) * TILE);
        blocks.push(painted(g, color));
        // A gold or dark band along the top.
        const band = new THREE.BoxGeometry(TILE + 0.02, 0.16, TILE + 0.02).toNonIndexed();
        band.deleteAttribute("uv");
        band.translate((x + 0.5) * TILE, h - 0.1, (y + 0.5) * TILE);
        blocks.push(painted(band, t === "marblewall" || a.id === "guild" ? 0xd4a640 : 0x5c3a1a));
      } else if (t === "rampart" || t === "tower" || t === "citygate") {
        blocks.push(...rampartBlock(t, x, y));
      } else if (t === "cavewall") {
        for (let k = 0; k < 3; k++) {
          const r = 0.9 + rng() * 0.5;
          const g = rockGeo(r, rng, 1.1);
          g.translate((x + 0.2 + rng() * 0.6) * TILE, r * 0.9 + k * 0.5, (y + 0.2 + rng() * 0.6) * TILE);
          blocks.push(painted(g.index ? g.toNonIndexed() : g, mix(0x5a554e, 0x4a4640, rng())));
        }
      }
    });
    if (blocks.length) {
      for (const g of blocks) for (const n of Object.keys(g.attributes)) if (!["position", "normal", "color"].includes(n)) g.deleteAttribute(n);
      const merged = mergeGeometries(blocks, false);
      blocks.forEach((g) => g.dispose());
      if (merged) {
        merged.computeVertexNormals();
        const m = new THREE.Mesh(gpuOnly(merged), vcol);
        m.castShadow = true;
        m.receiveShadow = true;
        c.group.add(m);
      }
    }
    yield;

    // 3. Fences and hedges, in straight runs.
    const runs = (tile: Tile, id: string, variant: number) => {
      const seen = new Set<string>();
      this.inChunk(c, (x, y) => {
        if (MAP[y][x] !== tile || seen.has(`${x},${y}`)) return;
        const horiz = MAP[y][x + 1] === tile || MAP[y][x - 1] === tile || !(MAP[y + 1]?.[x] === tile || MAP[y - 1]?.[x] === tile);
        let n = 0;
        while (n < CHUNK && (horiz ? MAP[y][x + n] : MAP[y + n]?.[x]) === tile && (horiz ? x + n < (c.cx + 1) * CHUNK : y + n < (c.cy + 1) * CHUNK)) {
          seen.add(horiz ? `${x + n},${y}` : `${x},${y + n}`);
          n++;
        }
        const piece = createEnv(id, { variant, length: n * TILE, seed: x * 7 + y });
        piece.object.position.set(horiz ? (x + n / 2) * TILE : (x + 0.5) * TILE, 0, horiz ? (y + 0.5) * TILE : (y + n / 2) * TILE);
        piece.object.rotation.y = horiz ? 0 : Math.PI / 2;
        piece.object.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
        c.group.add(piece.object);
        c.live.push({ object: piece.object, update: (dt, t, night) => piece.update(dt, t, { night, wind: 0.3 }), dispose: () => piece.dispose() });
      });
    };
    runs("fence", "wall-fence", 0);
    runs("hedge", "wall-hedge", 0);
    yield;

    // 4. Trees, rocks, props and decorations.
    const m4 = (x: number, y: number, rot: number, s = 1, dx = 0, dz = 0) =>
      new THREE.Matrix4().compose(new THREE.Vector3((x + 0.5) * TILE + dx, 0, (y + 0.5) * TILE + dz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(s, s, s));
    const addInst = (id: string, key: string, build: () => THREE.Object3D, matrix: THREE.Matrix4, cast = true) => {
      this.instancer.add(id, key, build, matrix, cast);
      c.instances.push(id);
    };
    let count = 0;
    const tiles: [number, number][] = [];
    this.inChunk(c, (x, y) => tiles.push([x, y]));
    for (const [x, y] of tiles) {
      const t = MAP[y][x];
      const h = hash2(x, y, 3);
      const rot = hash2(x, y, 4) * Math.PI * 2;
      const node = MAP_NODES[y][x];
      if (t === "tree" && node && node in TREE_TYPES) {
        const kind = node as TreeKind;
        const look = treeLook(kind, x, y);
        const key = treeKey(x, y);
        const matrix = m4(x, y, rot, 0.9 + hash2(x, y, 6) * 0.25, (hash2(x, y, 7) - 0.5) * 0.5, (hash2(x, y, 8) - 0.5) * 0.5);
        const n: Node = { key, x, y, type: "tree", kind, variant: look.variant, seed: look.seed, matrix };
        this.nodes.set(key, n);
        c.nodes.push(key);
        this.instancer.add(key, `tree:${kind}:${look.variant}:${look.seed}`, () => createTree(kind, { seed: look.seed, variant: look.variant }).object, matrix);
        count++;
      } else if (t === "rock" && node && node in ROCK_TYPES) {
        const kind = node as RockKind;
        const variant = Math.floor(h * 3) % 3, seed = 1 + Math.floor(hash2(x, y, 9) * PROTO_SEEDS);
        const key = treeKey(x, y);
        const matrix = m4(x, y, rot);
        const n: Node = { key, x, y, type: "rock", kind, variant, seed, matrix };
        this.nodes.set(key, n);
        c.nodes.push(key);
        this.instancer.add(key, `rock:${kind}:${variant}:${seed}`, () => createRock(kind, { seed, variant }).object, matrix);
        count++;
      } else if (t === "dig") {
        c.live.push(digPatch(x, y, () => this.depleted.has(treeKey(x, y))));
        c.group.add(c.live[c.live.length - 1].object);
      } else if (t === "water" && node) {
        const spot = createFood(`spot-${node as ResourceId}`, { seed: x + y, variant: 0 });
        spot.object.position.copy(tileCenter(x, y)).setY(-0.08);
        c.group.add(spot.object);
        c.live.push({ object: spot.object, update: (dt, tt) => spot.update(dt, tt), dispose: () => spot.dispose() });
      } else if (t === "brazier") {
        const b = makeBrazier(x * 3 + y);
        b.object.position.copy(tileCenter(x, y));
        b.object.userData.tile = { x, y };
        c.group.add(b.object);
        c.live.push({ object: b.object, update: (dt, tt) => b.update(dt, tt), dispose: () => b.dispose() });
      } else if (t === "lamp") {
        // Emberhold's street lamps: they light up at night (the nearest few really light the street).
        const lamp = createEnv("decor-lamp", { variant: 0, seed: x * 5 + y });
        lamp.object.position.copy(tileCenter(x, y));
        lamp.object.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
        c.group.add(lamp.object);
        c.live.push({ object: lamp.object, update: (dt, tt, night) => lamp.update(dt, tt, { night, wind: 0.3 }), dispose: () => lamp.dispose() });
      } else if (t === "innerdoor" || (t === "door" && a.kind === "indoor")) {
        const d = this.insideDoor(x, y, a);
        c.group.add(d.object);
        c.live.push(d);
      } else {
        const prop = PROPS[t];
        if (prop && !(t === "statue" && CARVED.has(y * 100000 + x))) {
          const [id, variant] = prop(x, y);
          const r = facing(t, x, y, h);
          addInst(`p${x},${y}`, `${id}:${variant}`, () => (id.startsWith("box-") ? boxProp(id, variant) : createEnv(id, { variant, seed: 3, length: TILE }).object), m4(x, y, r));
          // Things laid out on tables (the General Store's goods, books in the Emberhall...).
          if (t === "table") {
            const v = Math.floor(hash2(x, y, 31) * 5);
            if (TABLE_ROOMS.has(a.id)) addInst(`t${x},${y}`, `table-top:${a.id}:${v}`, () => tableTop(a.id, v)!, m4(x, y, r));
          }
        } else if (a.kind === "outdoor") {
          // A sprinkle of grass tufts, flowers and reeds, the same for everyone.
          const deco = sprinkle(t, x, y, h);
          if (deco) addInst(`d${x},${y}`, `${deco[0]}:${deco[1]}`, () => createEnv(deco[0], { variant: deco[1], seed: 2 }).object, m4(x, y, rot, 1, (hash2(x, y, 11) - 0.5) * 1.2, (hash2(x, y, 12) - 0.5) * 1.2), false);
        }
      }
      if (++count % 12 === 0) yield;
    }
    // Trees and rocks that were already used up show as stumps / empty rocks.
    for (const k of c.nodes) if (this.depleted.has(k)) this.wake(this.nodes.get(k)!, true);
  }

  /**
   * A real door in a doorway inside a building (Mike's note #4): between rooms
   * ("d" on the map), and the way out. It sits in the wall with the wall's own
   * stone either side, swings open when someone walks up to it, and tapping
   * anywhere on it walks you through.
   */
  private insideDoor(x: number, y: number, a: AreaDef): Live {
    const at = (dx: number, dy: number) => MAP[y + dy]?.[x + dx];
    const wallsEW = BLOCKING.has(at(-1, 0)!) && BLOCKING.has(at(1, 0)!);
    // The door's front faces into the room (for the way out), or south / east (between rooms).
    let face = wallsEW ? 0 : Math.PI / 2;
    if (MAP[y][x] === "door") {
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        if (areaAt(x + dx, y + dy) === a && !BLOCKING.has(at(dx, dy)!)) { face = Math.atan2(dx, dy); break; }
      }
    }
    const object = new THREE.Group();
    object.position.copy(tileCenter(x, y));
    const marble = a.id === "lighthall";
    const piece = createEnv("wall-door", { variant: marble ? 1 : 0, seed: x * 7 + y });
    piece.object.scale.setScalar(0.95);
    piece.object.rotation.y = face;
    object.add(piece.object);
    // The wall either side of the door (the doorway is wider than the door), and a strip over it.
    const col = marble ? 0xf2efe8 : a.id === "guild" ? 0x6a4a9a : 0x9c6a42;
    const wallMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 });
    const geos: THREE.BufferGeometry[] = [];
    const side = (TILE - 1.32) / 2;
    for (const sx of [-1, 1]) {
      const g = new THREE.BoxGeometry(side, 2.2, TILE);
      geos.push(g);
      const m = new THREE.Mesh(g, wallMat);
      m.position.set(sx * (TILE / 2 - side / 2), 1.1, 0);
      m.castShadow = m.receiveShadow = true;
      const holder = new THREE.Group();
      holder.rotation.y = face;
      holder.add(m);
      object.add(holder);
    }
    const top = new THREE.BoxGeometry(TILE, 0.12, TILE);
    geos.push(top);
    const lintel = new THREE.Mesh(top, wallMat);
    lintel.position.y = 2.16;
    object.add(lintel);
    // Tap anywhere on the door, not just the floor under it.
    const pick = new THREE.Mesh(DOOR_PICK, PICK_MAT);
    pick.position.y = 1.3;
    pick.rotation.y = face;
    pick.visible = false;
    object.add(pick);
    object.userData.tile = { x, y };
    this.insideDoors.add(object);
    object.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== pick) o.castShadow = true; });
    let open = false;
    const here = new THREE.Vector3();
    return {
      object,
      update: (dt, t, night) => {
        object.getWorldPosition(here);
        const near = this.walkers.some((w) => Math.hypot(w.x - here.x, w.z - here.z) < TILE * 1.5);
        if (near !== open) { open = near; piece.poke?.(); }
        piece.update(dt, t, { night, wind: 0 });
      },
      dispose: () => { this.insideDoors.delete(object); piece.dispose(); geos.forEach((g) => g.dispose()); wallMat.dispose(); },
    };
  }

  /** Things built once for the whole area: buildings, their doors, the water. */
  private buildAreaWide(a: AreaDef) {
    const add = (object: THREE.Object3D, update?: (dt: number, t: number, night: number) => void, dispose?: () => void) => {
      this.root.add(object);
      this.areaObjects.push({ object, update, dispose });
    };
    if (a.kind === "outdoor") {
      const city = CITY_BUILDINGS.some((b) => areaAt(b.x, b.y) === a);
      // The sea all round, and the lakes and rivers (land sits on top of it). In the city, just under its river and ponds.
      let [wx0, wy0, wx1, wy1] = [a.x - 225, a.y - 225, a.x + a.w + 225, a.y + a.h + 225];
      if (city) {
        [wx0, wy0, wx1, wy1] = [Infinity, Infinity, -Infinity, -Infinity];
        for (let y = a.y; y < a.y + a.h; y++) for (let x = a.x; x < a.x + a.w; x++) if (MAP[y][x] === "water" || MAP[y][x] === "bridge") {
          wx0 = Math.min(wx0, x); wy0 = Math.min(wy0, y); wx1 = Math.max(wx1, x + 1); wy1 = Math.max(wy1, y + 1);
        }
      }
      const sea = new THREE.Mesh(new THREE.PlaneGeometry((wx1 - wx0) * TILE, (wy1 - wy0) * TILE, 80, 80), this.water.material);
      sea.rotation.x = -Math.PI / 2;
      sea.position.set((wx0 + wx1) / 2 * TILE, -0.16, (wy0 + wy1) / 2 * TILE);
      sea.receiveShadow = true;
      add(sea);
      if (city) {
        // Emberhold: land all round instead of sea, the backdrop city, and its buildings you can go into.
        add(cityLand(a.x * TILE, a.y * TILE, a.w * TILE, a.h * TILE));
        const back = cityBackdrop((x, y, h) => HEIGHTS.set(y * 100000 + x, h));
        add(back.object, back.update, back.dispose);
        for (const s of CITY_SIGNS) if (areaAt(s.x, s.y) === a) this.signs.push({ text: s.text, at: tileCenter(s.x, s.y).setY(s.big ? 7 : 6.2) });
      }
      for (const b of city ? cityDetailed(a) : findBuildings()) {
        const built = makeBuilding(b);
        add(built.object, (dt, t, night) => built.update(dt, t, night), () => built.dispose());
        if (b.city?.landmark === "emberhall") {
          const crown = emberhallCrown(b.city, built.height - 1.5);
          add(crown.object, crown.update, crown.dispose);
        }
        // Tap anywhere on a door (not just the step in front of it) to walk through it.
        for (const d of b.doors) {
          const pick = new THREE.Mesh(DOOR_PICK, PICK_MAT);
          pick.position.copy(tileCenter(d.x, d.y)).setY(1.3);
          pick.userData.tile = { x: d.x, y: d.y };
          pick.visible = false;
          this.doorPicks.push(pick);
          this.root.add(pick);
          this.areaObjects.push({ object: pick });
        }
      }
    } else if (hasWater(a)) {
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(a.w * TILE, a.h * TILE, 20, 20), this.water.material);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set((a.x + a.w / 2) * TILE, -0.16, (a.y + a.h / 2) * TILE);
      add(pool);
    }
    // Carpets: one whole rug each (drawn tile by tile, the border and diamonds didn't line up).
    for (const r of carpets(a)) {
      const rug = createEnv("floor-rug", { variant: a.id === "guild" ? 0 : a.id === "lighthall" ? 1 : 2, x0: r.x * TILE, z0: r.y * TILE, w: r.w * TILE, d: r.h * TILE, seed: 1 });
      rug.object.position.y = 0.035;
      rug.object.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.receiveShadow = true; });
      add(rug.object, undefined, () => rug.dispose());
    }
    for (const d of DOORS) {
      if (!d.sign || areaAt(d.x, d.y) !== a) continue;
      this.signs.push({ text: d.sign, at: tileCenter(d.x, d.y).setY(a.kind === "outdoor" ? 4.4 : 2.6) });
    }
  }
}

// ---------------------------------------------------------------- props and decorations

/** Statue tiles with a carved character on them (drawn as a station in actors.ts, not the plain statue). */
const CARVED = new Set(NPCS.filter((n) => n.id.startsWith("circle_") || n.id.startsWith("extinguished_")).map((n) => n.y * 100000 + n.x));

const PROPS: Partial<Record<Tile, (x: number, y: number) => [string, number]>> = {
  crates: (x, y) => ["decor-barrels", Math.floor(hash2(x, y, 21) * 3)],
  statue: () => ["decor-statue", 0],
  grave: (x, y) => ["decor-grave", Math.floor(hash2(x, y, 22) * 3)],
  well: () => ["decor-well", 0],
  sign: () => ["decor-signpost", 0],
  barricade: () => ["wall-barricade", 0],
  gate: () => ["wall-gate", 0],
  lockeddoor: () => ["wall-door", 2],
  table: () => ["box-table", 0],
  shelf: (x, y) => [areaAt(x, y)?.id === "tam" ? "box-goods" : "box-shelf", Math.floor(hash2(x, y, 23) * 3)],
  bed: (x, y) => ["box-bed", Math.floor(hash2(x, y, 24) * 4)],
  stall: (x, y) => ["box-stall", Math.floor(hash2(x, y, 25) * 4)],
};

/** Rooms whose tables have things on them (furniture.ts tableTop). */
const TABLE_ROOMS = new Set(["tam", "lighthall", "guild", "inn", "maren"]);

const BLOCKING = new Set<Tile>(["wall", "house", "marblewall", "lockeddoor", "cavewall", "void"]);

/**
 * Which way a prop faces. Shelves and tables line up with their row (no more
 * shelves turned every which way); a bed puts its head against the wall; most
 * other things face south, and crates and barrels are turned at random.
 */
function facing(t: Tile, x: number, y: number, h: number): number {
  const at = (dx: number, dy: number) => MAP[y + dy]?.[x + dx];
  if (t === "shelf" || t === "table") {
    const rowX = at(1, 0) === t || at(-1, 0) === t, rowY = at(0, 1) === t || at(0, -1) === t;
    if (rowY && !rowX) return Math.PI / 2;
    if (rowX) return 0;
    // On its own: back against a wall if there is one.
    return BLOCKING.has(at(-1, 0)!) || BLOCKING.has(at(1, 0)!) ? Math.PI / 2 : 0;
  }
  if (t === "bed") {
    // The head (-z) goes against a wall: north, west, east or south.
    if (BLOCKING.has(at(-1, 0)!)) return Math.PI / 2;
    if (BLOCKING.has(at(1, 0)!)) return -Math.PI / 2;
    if (BLOCKING.has(at(0, -1)!)) return 0;
    return Math.PI;
  }
  if (t === "crates") return Math.floor(h * 4) * Math.PI / 2;
  if (t === "statue") {
    // Statues against a wall face away from it (the Extinguished line the Emberhall's walls).
    if (BLOCKING.has(at(-1, 0)!)) return Math.PI / 2;
    if (BLOCKING.has(at(1, 0)!)) return -Math.PI / 2;
  }
  return 0;
}

function sprinkle(t: Tile, x: number, y: number, h: number): [string, number] | null {
  const nearWater = MAP[y - 1]?.[x] === "water" || MAP[y + 1]?.[x] === "water" || MAP[y]?.[x - 1] === "water" || MAP[y]?.[x + 1] === "water";
  if (t === "grass") {
    if (nearWater && h < 0.22) return ["decor-reeds", Math.floor(h * 10) % 2];
    if (h < 0.07) return ["decor-tufts", h < 0.035 ? 0 : 1];
    if (h < 0.09) return ["decor-flowers", Math.floor(h * 1000) % 4];
  } else if (t === "withered") {
    if (h < 0.06) return ["decor-tufts", 2];
    if (h < 0.075) return ["decor-mushrooms", h < 0.07 ? 0 : 2];
  } else if (t === "sand") {
    if (h < 0.025) return ["decor-beach", Math.floor(h * 100) % 2];
  }
  return null;
}

/** Simple furniture the library doesn't have yet. */
function boxProp(id: string, variant = 0): THREE.Object3D {
  if (id === "box-shelf") return bookshelf(5 + variant);
  if (id === "box-goods") return goodsShelf(5 + variant);
  if (id === "box-bed") return bed(9 + variant);
  if (id === "box-stall") return marketStall(variant);
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x5c3a1a, roughness: 0.85 });
  if (id === "box-table") {
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 1.1), wood);
    top.position.y = 0.8;
    g.add(top);
    for (const [lx, lz] of [[-0.75, -0.45], [0.75, -0.45], [-0.75, 0.45], [0.75, 0.45]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), dark);
      leg.position.set(lx, 0.4, lz);
      g.add(leg);
    }
  } else {
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2, 0.5), dark);
    back.position.y = 1;
    g.add(back);
    const colors = [0xa83a2a, 0x2a5aa8, 0x3a8a3a, 0xc8a040, 0x6a3a8a];
    for (let s = 0; s < 3; s++) for (let b = 0; b < 9; b++) {
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.32), new THREE.MeshStandardMaterial({ color: colors[(s * 9 + b) % colors.length], roughness: 0.8 }));
      book.position.set(-0.75 + b * 0.18, 0.35 + s * 0.6, 0.12);
      g.add(book);
    }
  }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return g;
}

/** A market stall (Emberhold): a counter of goods under a striped awning. */
function marketStall(variant: number): THREE.Object3D {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.85 });
  const cloth = [0xc0392b, 0x2f7d6a, 0xe6b840, 0xd9772f][variant % 4];
  const stripeA = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.9, side: THREE.DoubleSide });
  const stripeB = new THREE.MeshStandardMaterial({ color: 0xf4ead0, roughness: 0.9, side: THREE.DoubleSide });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 0.9), wood);
  counter.position.set(0, 0.4, 0.2);
  g.add(counter);
  for (const [x, z] of [[-0.85, -0.45], [0.85, -0.45], [-0.85, 0.6], [0.85, 0.6]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.1, 0.08), wood);
    post.position.set(x, 1.05, z);
    g.add(post);
  }
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 1.4), i % 2 ? stripeB : stripeA);
    s.position.set(-0.85 + 0.17 + i * 0.34, 2.15, 0.08);
    s.rotation.x = -0.18;
    g.add(s);
  }
  const goods = [0xd9772f, 0xc0392b, 0xe6b840, 0x7a9a4a, 0x8a5a9a];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 4), new THREE.MeshStandardMaterial({ color: goods[(i + variant) % goods.length], roughness: 0.7 }));
    m.position.set(-0.65 + i * 0.26, 0.9, 0.25 + (i % 2) * 0.15);
    g.add(m);
  }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return g;
}

/** A dig patch: a mound of turned earth that glints. Dug out, it's a flat dark hole. */
function digPatch(x: number, y: number, dug: () => boolean): Live {
  const object = new THREE.Group();
  object.position.copy(tileCenter(x, y));
  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 1, flatShading: true }));
  mound.scale.y = 0.35;
  mound.receiveShadow = true;
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.6, 10), new THREE.MeshStandardMaterial({ color: 0x3a2616, roughness: 1 }));
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.03;
  const glint = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshStandardMaterial({ color: 0xfff6b0, emissive: 0xffe680, emissiveIntensity: 1.2 }));
  glint.position.set(0.15, 0.35, 0.1);
  object.add(mound, hole, glint);
  object.userData.tile = { x, y };
  return {
    object,
    update(_dt, t) {
      const d = dug();
      mound.visible = glint.visible = !d;
      hole.visible = d;
      const s = 0.6 + 0.6 * Math.abs(Math.sin(t * 2 + x));
      glint.scale.setScalar(s);
      glint.rotation.y = t * 2;
    },
    dispose() { object.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); }); },
  };
}

function hasWater(a: AreaDef) {
  for (let y = a.y; y < a.y + a.h; y++) for (let x = a.x; x < a.x + a.w; x++) if (MAP[y][x] === "water") return true;
  return false;
}

// ---------------------------------------------------------------- carpets

/** The carpets in an area, as rectangles of carpet tiles (each drawn as one rug). */
function carpets(a: AreaDef): { x: number; y: number; w: number; h: number }[] {
  const out: { x: number; y: number; w: number; h: number }[] = [];
  const seen = new Set<number>();
  for (let y = a.y; y < a.y + a.h; y++) for (let x = a.x; x < a.x + a.w; x++) {
    if (MAP[y][x] !== "carpet" || seen.has(y * 100000 + x)) continue;
    let w = 0;
    while (MAP[y][x + w] === "carpet") w++;
    let h = 0;
    while (MAP[y + h]?.[x] === "carpet" && MAP[y + h][x + w - 1] === "carpet") h++;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) seen.add(yy * 100000 + xx);
    out.push({ x, y, w, h });
  }
  return out;
}

const DOOR_PICK = new THREE.BoxGeometry(1.7, 2.6, 0.8);
const PICK_MAT = new THREE.MeshBasicMaterial();

// ---------------------------------------------------------------- buildings seen from outside

interface Building { x: number; y: number; w: number; h: number; roof: string; wall: string; doors: { x: number; y: number }[]; city?: CityBuilding }

/** Emberhold's buildings drawn in full: the ones you can go into, and the Emberhall. */
function cityDetailed(a: AreaDef): Building[] {
  return CITY_BUILDINGS.filter((b) => b.detail && areaAt(b.x, b.y) === a).map((b) => {
    const doors: { x: number; y: number }[] = [];
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (MAP[y][x] === "door") doors.push({ x, y });
    return { x: b.x, y: b.y, w: b.w, h: b.h, roof: charAt(b.x, b.y), wall: charAt(b.x + 1, b.y + b.h - 1), doors, city: b };
  });
}

const CITY_ROOF: Record<CityBuilding["roof"], [RoofKind, number]> = { slate: ["tile", 2], red: ["tile", 0], dark: ["tile", 1], thatch: ["thatch", 0], gold: ["gold", 1] };

let buildingCache: Building[] | null = null;

/** Every building on the outdoor map: a block of roof tiles with its front wall along the bottom. */
function findBuildings(): Building[] {
  if (buildingCache) return buildingCache;
  const out: Building[] = [];
  const seen = new Uint8Array(OUTDOORS.w * OUTDOORS.h);
  const part = (x: number, y: number) => {
    const t = MAP[y]?.[x];
    return areaAt(x, y) === OUTDOORS && (t === "roof" || t === "goldroof" || t === "house" || t === "wall" || t === "marblewall" || t === "door");
  };
  for (let y = 0; y < OUTDOORS.h; y++) for (let x = 0; x < OUTDOORS.w; x++) {
    const t = MAP[y][x];
    if (seen[y * OUTDOORS.w + x] || (t !== "roof" && t !== "goldroof")) continue;
    // Flood fill the block.
    let x0 = x, x1 = x, y0 = y, y1 = y;
    const stack = [[x, y]];
    seen[y * OUTDOORS.w + x] = 1;
    const doors: { x: number; y: number }[] = [];
    while (stack.length) {
      const [px, py] = stack.pop()!;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      if (MAP[py][px] === "door") doors.push({ x: px, y: py });
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= OUTDOORS.w || ny >= OUTDOORS.h || seen[ny * OUTDOORS.w + nx] || !part(nx, ny)) continue;
        seen[ny * OUTDOORS.w + nx] = 1;
        stack.push([nx, ny]);
      }
    }
    const wallCh = charAt(x0 + (x1 > x0 ? 1 : 0), y1);
    out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, roof: charAt(x0, y0), wall: wallCh, doors });
  }
  buildingCache = out;
  return out;
}

/** How tall each outdoor building is, by tile (filled in as the buildings are made). */
const HEIGHTS = new Map<number, number>();
/** How tall the building on this outdoor tile is (0 if there isn't one). */
function buildingHeight(x: number, y: number): number {
  return HEIGHTS.get(y * 100000 + x) ?? 0;
}

function makeBuilding(b: Building): { object: THREE.Object3D; height: number; update: (dt: number, t: number, night: number) => void; dispose: () => void } {
  const seed = b.x * 31 + b.y;
  const wall: WallKind = b.city ? b.city.wall : b.wall === "A" ? "marble" : b.wall === "W" ? "guild" : b.x >= 160 && b.y < 60 ? "plank" : "timber";
  const [roof, roofVariant]: [RoofKind, number] = b.city ? CITY_ROOF[b.city.roof] : [b.roof === "u" ? "gold" : wall === "plank" ? "thatch" : "tile", b.roof === "u" ? 1 : seed % 3];
  const wallVariant = wall === "timber" ? seed % 3 : wall === "plank" && b.city ? 1 : 0;
  // Bigger buildings get more storeys, so they don't end up as one low floor under a huge roof.
  const area = b.w * b.h;
  const floors = (b.city?.floors ?? 1) > 1 ? b.city!.floors : area >= 120 ? 3 : area >= 48 ? 2 : 1;
  const built = house({ tw: b.w, td: b.h - 0.5, wall, wallVariant, roof, roofVariant, seed, floors });
  for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) HEIGHTS.set(yy * 100000 + xx, built.height);
  const object = new THREE.Group();
  built.piece.object.position.set((b.x + b.w / 2) * TILE, 0, (b.y + (b.h - 0.5) / 2) * TILE);
  object.add(built.piece.object);
  const parts: EnvPiece[] = [built.piece];
  // Doors, and a window or two on the front.
  const frontZ = (b.y + b.h - 0.5) * TILE;
  for (const d of b.doors) {
    const door = createEnv("wall-door", { variant: b.wall === "A" ? 1 : 0, seed });
    const side = d.y === b.y + b.h - 1 ? "s" : d.y === b.y ? "n" : d.x === b.x ? "w" : "e";
    // Out from the wall a little, so the wall's stones and beams can't poke through the door.
    const out = 0.12;
    if (side === "s") door.object.position.set((d.x + 0.5) * TILE, 0, frontZ + out);
    else if (side === "n") { door.object.position.set((d.x + 0.5) * TILE, 0, b.y * TILE - out); door.object.rotation.y = Math.PI; }
    else if (side === "w") { door.object.position.set(b.x * TILE - out, 0, (d.y + 0.5) * TILE); door.object.rotation.y = -Math.PI / 2; }
    else { door.object.position.set((b.x + b.w) * TILE + out, 0, (d.y + 0.5) * TILE); door.object.rotation.y = Math.PI / 2; }
    object.add(door.object);
    parts.push(door);
    const lantern = createEnv("orn-lantern", { variant: b.wall === "W" ? 2 : 0, seed });
    lantern.object.position.copy(door.object.position).add(new THREE.Vector3(1.1, 2.2, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), door.object.rotation.y));
    lantern.object.rotation.y = door.object.rotation.y;
    object.add(lantern.object);
    parts.push(lantern);
  }
  const doorXs = b.doors.filter((d) => d.y === b.y + b.h - 1).map((d) => d.x);
  for (let f = 0; f < floors; f++) for (let x = b.x + 1; x < b.x + b.w - 1; x += 3) {
    if (f === 0 && doorXs.some((dx) => Math.abs(dx - x) < 2)) continue;
    const win = createEnv("orn-window", { variant: b.wall === "A" || b.wall === "W" ? 1 : seed % 3 === 1 ? 2 : 0, seed: seed + x + f * 7 });
    win.object.position.set((x + 0.5) * TILE, 1.5 + f * WALL_H, frontZ + 0.01);
    object.add(win.object);
    parts.push(win);
  }
  object.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return {
    object,
    height: built.height,
    update: (dt, t, night) => parts.forEach((p) => p.update(dt, t, { night, wind: 0.3 })),
    dispose: () => parts.forEach((p) => p.dispose()),
  };
}

export { AREAS };
