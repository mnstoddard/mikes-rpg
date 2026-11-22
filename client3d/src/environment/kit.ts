// Shared building blocks for the world's environment: ground, floors, walls,
// roofs, wall ornaments, ground decorations, water and sky.
//
// One map tile in the 2D game is one TILE (2 m square) in 3D. Ground and floor
// tiles are built from the WORLD position they sit at, so tiles laid side by
// side join up with no seams, and the same spot always looks the same.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { makeRng, between, Rng } from "../trees/common";

export { makeRng, between };
export type { Rng };

/** One map tile, in metres. */
export const TILE = 2;
/** Height of one storey of wall. */
export const WALL_H = 3;
/** Wall thickness. */
export const WALL_T = 0.3;

/** What the world is like right now, passed to update() every frame. */
export interface EnvState {
  /** 0 in the day, about 0.4 at sunset, 1 at night. Lanterns and windows light up with it. */
  night: number;
  /** Wind strength, 0 to 1 (grass and flowers sway with it). */
  wind: number;
}

/** One environment piece: add `object` to the scene and call `update` every frame. */
export interface EnvPiece {
  object: THREE.Group;
  update(dt: number, time: number, env: EnvState): void;
  /** The gallery's action button (a gust of wind, a splash, a flicker...). */
  poke?(): void;
  /** Weather can change the scene's fog. */
  fog?: { color: number; near: number; far: number };
  dispose(): void;
}

// ---------- Numbers you can repeat everywhere ----------

/** A random number 0..1 for a whole-number grid spot. Same spot, same number. */
export function hash2(x: number, z: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth random hills: 0..1, changes slowly over `scale` metres. */
export function noise2(x: number, z: number, scale: number, seed = 0): number {
  const fx = x / scale, fz = z / scale;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = fx - ix, tz = fz - iz;
  const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed), c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

// ---------- Materials ----------

export interface MatOptions {
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  double?: boolean;
  vertexColors?: boolean;
  opacity?: number;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** A flat-shaded (low-poly) material, shared between pieces. */
export function mat(color: number, o: MatOptions = {}): THREE.MeshStandardMaterial {
  const key = JSON.stringify([color, o]);
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: o.vertexColors ? 0xffffff : color,
      flatShading: true,
      roughness: o.roughness ?? 0.9,
      metalness: o.metalness ?? 0,
      emissive: o.emissive ?? 0,
      emissiveIntensity: o.emissiveIntensity ?? 0,
      side: o.double ? THREE.DoubleSide : THREE.FrontSide,
      vertexColors: !!o.vertexColors,
      transparent: o.opacity !== undefined,
      opacity: o.opacity ?? 1,
      depthWrite: o.opacity === undefined,
    });
    cache.set(key, m);
  }
  return m;
}

/** A material of its own (not shared), for things that glow brighter at night. */
export function glowMat(color: number, emissive: number, o: MatOptions = {}) {
  return new THREE.MeshStandardMaterial({
    color, emissive, emissiveIntensity: 0.3, flatShading: true, roughness: o.roughness ?? 0.5,
    transparent: o.opacity !== undefined, opacity: o.opacity ?? 1, side: o.double ? THREE.DoubleSide : THREE.FrontSide,
  });
}

export const VCOL = () => mat(0xffffff, { vertexColors: true });

/** Mix two colours: t = 0 gives a, 1 gives b. */
export function mix(a: number, b: number, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t))).getHex();
}
/** Darker (f < 1) or lighter (f > 1). */
export function shade(c: number, f: number): number {
  const col = new THREE.Color(c);
  return f < 1 ? col.multiplyScalar(f).getHex() : col.lerp(new THREE.Color(0xffffff), Math.min(1, f - 1)).getHex();
}
/** A colour nudged a little lighter or darker at random. */
export function jitter(c: number, rng: Rng, amount = 0.08): number {
  return shade(c, 1 + (rng() - 0.5) * 2 * amount);
}

// ---------- Shapes ----------

/** Make a mesh that casts and receives shadows. */
export function mesh(geo: THREE.BufferGeometry, material: THREE.Material, cast = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

/** A box placed by its centre. */
export function box(w: number, h: number, d: number, color: number | THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(w, h, d), typeof color === "number" ? mat(color) : color);
  m.position.set(x, y, z);
  return m;
}

/** A lumpy low-poly rock. */
export function rockGeo(r: number, rng: Rng, squash = 0.7, detail = 0): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position as THREE.BufferAttribute;
  const seen = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let k = seen.get(key);
    if (k === undefined) seen.set(key, (k = 0.78 + rng() * 0.4));
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * squash, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A flat-shaded surface with its own colour for every little triangle. It is
 * built in world space (x0, z0 is its corner in the world), so pieces laid
 * next to each other line up exactly.
 */
export function surface(o: {
  x0: number; z0: number; w: number; d: number; seg: number;
  height: (x: number, z: number) => number;
  color: (x: number, z: number) => number;
}): THREE.BufferGeometry {
  const nx = Math.max(1, Math.round(o.seg * (o.w / TILE)));
  const nz = Math.max(1, Math.round(o.seg * (o.d / TILE)));
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  const P = (i: number, j: number): [number, number, number] => {
    const x = o.x0 + (i / nx) * o.w, z = o.z0 + (j / nz) * o.d;
    return [x, o.height(x, z), z];
  };
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = P(i, j), b = P(i + 1, j), cc = P(i, j + 1), d = P(i + 1, j + 1);
      // Alternate the diagonal so the triangles make a pleasant pattern.
      const tris = (i + j) % 2 ? [[a, cc, b], [b, cc, d]] : [[a, cc, d], [a, d, b]];
      for (const t of tris) {
        const mx = (t[0][0] + t[1][0] + t[2][0]) / 3, mz = (t[0][2] + t[1][2] + t[2][2]) / 3;
        c.setHex(o.color(mx, mz));
        for (const v of t) {
          pos.push(v[0], v[1], v[2]);
          col.push(c.r, c.g, c.b);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Paint every face of a geometry with one colour (for merging into a vertex-coloured mesh). */
export function painted(geo: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(arr, i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Free a group's geometry (materials are shared, so they stay). */
export function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mm = m.material as THREE.Material | undefined;
    if (mm && (mm as any).__own) mm.dispose();
  });
}

/** A simple piece with nothing moving. */
export function still(object: THREE.Group): EnvPiece {
  return { object, update() {}, dispose: () => disposeGroup(object) };
}

/** Things that sway in the wind: each child bends a little, at its own pace. */
export class Swayer {
  items: { o: THREE.Object3D; phase: number; amount: number; base: THREE.Euler }[] = [];
  gust = 0;
  add(o: THREE.Object3D, amount: number, phase: number) {
    this.items.push({ o, phase, amount, base: o.rotation.clone() });
  }
  update(dt: number, time: number, wind: number) {
    this.gust = Math.max(0, this.gust - dt * 0.6);
    const w = 0.35 + wind * 0.8 + this.gust * 2.2;
    for (const it of this.items) {
      const s = Math.sin(time * (1.6 + this.gust) + it.phase) * 0.6 + Math.sin(time * 2.7 + it.phase * 1.7) * 0.25;
      it.o.rotation.x = it.base.x + s * it.amount * w;
      it.o.rotation.z = it.base.z + (s * 0.5 + 0.35 * this.gust) * it.amount * w;
    }
  }
}

/** Lights that glow at night: emissive materials and real point lights. */
export class NightLights {
  mats: { m: THREE.MeshStandardMaterial; day: number; night: number }[] = [];
  lights: { l: THREE.PointLight; max: number }[] = [];
  flicker = 0;
  flickerTime = 0;
  addMat(m: THREE.MeshStandardMaterial, day = 0.25, night = 2.4) {
    (m as any).__own = true;
    this.mats.push({ m, day, night });
  }
  addLight(l: THREE.PointLight, max: number) {
    this.lights.push({ l, max });
  }
  update(dt: number, time: number, env: EnvState) {
    this.flickerTime = Math.max(0, this.flickerTime - dt);
    const f = this.flicker ? 1 + Math.sin(time * 13) * 0.05 * this.flicker + Math.sin(time * 31) * 0.04 * this.flicker : 1;
    const blink = this.flickerTime > 0 ? 0.4 + 0.6 * Math.abs(Math.sin(this.flickerTime * 18)) : 1;
    for (const x of this.mats) x.m.emissiveIntensity = (x.day + (x.night - x.day) * env.night) * f * blink;
    for (const x of this.lights) x.l.intensity = x.max * Math.max(0.05, env.night) * f * blink;
  }
}

/** A small warm point light (no shadows, so they're cheap). */
export function lamp(color: number, distance = 7) {
  const l = new THREE.PointLight(color, 0, distance, 1.6);
  return l;
}

/** Collects shapes with colours and merges them into one mesh (fast to draw). */
export class Parts {
  list: THREE.BufferGeometry[] = [];
  /** Add a shape (already moved into place) in one colour. */
  add(geo: THREE.BufferGeometry, color: number) {
    this.list.push(painted(geo, color));
    return this;
  }
  /** A box by its centre. */
  box(w: number, h: number, d: number, color: number, x: number, y: number, z: number, ry = 0, rz = 0, rx = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    return this.add(g, color);
  }
  /** Make the mesh (null if nothing was added). */
  build(material: THREE.Material = mat(0xffffff, { vertexColors: true }), cast = true): THREE.Mesh | null {
    if (!this.list.length) return null;
    const merged = mergeGeometries(this.list.map((g) => (g.index ? g.toNonIndexed() : g)), false);
    this.list.forEach((g) => g.dispose());
    this.list = [];
    return merged ? mesh(merged, material, cast) : null;
  }
}
