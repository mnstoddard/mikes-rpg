// The item art kit for the Godot version: colours, painted textures and soft
// rounded building blocks. Every item file builds from these.
//
// The look: bright, soft and chunky, stylized but believable. Rounded edges
// everywhere (nothing razor sharp), gentle colour changes, a light painted
// texture on wood, leather, cloth and stone. Sizes are in metres. Held items
// have the middle of the grip at (0, 0, 0), pointing up +Y.
//
// Material names matter: Godot (and the gallery) swap looks by name, e.g.
// every material called "metal" becomes bronze, iron, steel or mithril.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ---------- Palettes ----------

export type Metal = "stone" | "bronze" | "iron" | "steel" | "mithril";
export type Wood = "pine" | "oak" | "birch" | "maple" | "yew" | "ironwood" | "elderwood";
export type Jewel = "silver" | "gold" | "platinum" | "iridium";

export interface Look { color: number; rough: number; metal: number; emissive?: number; glow?: number }

/** Tool and weapon metals (plus stone, for the first bows and staffs). Values from the shared style guide v1. */
export const METALS: Record<Metal, Look & { dark: number; name: string }> = {
  stone:   { name: "Stone",   color: 0x9c9a94, dark: 0x6e6c66, rough: 0.85, metal: 0 },
  bronze:  { name: "Bronze",  color: 0xd99c52, dark: 0x9c6a36, rough: 0.3,  metal: 1 },
  iron:    { name: "Iron",    color: 0x8d9197, dark: 0x62666c, rough: 0.5,  metal: 1 },
  steel:   { name: "Steel",   color: 0xd5dbe1, dark: 0x9ea6af, rough: 0.28, metal: 1 },
  mithril: { name: "Mithril", color: 0x7cc4ee, dark: 0x4a8fbc, rough: 0.28, metal: 1, emissive: 0x2a6fa8, glow: 0.35 },
};

export const JEWELS: Record<Jewel, Look & { name: string }> = {
  silver:   { name: "Silver",   color: 0xe3e6ea, rough: 0.25, metal: 1 },
  gold:     { name: "Gold",     color: 0xf2c14e, rough: 0.27, metal: 1 },
  platinum: { name: "Platinum", color: 0xdce3e6, rough: 0.22, metal: 1 },
  iridium:  { name: "Iridium",  color: 0xb9b2d8, rough: 0.28, metal: 1 },
};

/** Handle woods (style guide v1 colours), with the bark colour for logs. */
export const WOODS: Record<Wood, { name: string; wood: number; bark: number; glow?: number; emissive?: number; metal?: number }> = {
  pine:      { name: "Pine",      wood: 0xd2ae73, bark: 0x7a5434 },
  oak:       { name: "Oak",       wood: 0x9c6c3f, bark: 0x5e4630 },
  birch:     { name: "Birch",     wood: 0xece2cc, bark: 0xe8e2d4 },
  maple:     { name: "Maple",     wood: 0xbb6a3c, bark: 0x6e4a36 },
  yew:       { name: "Yew",       wood: 0x8e3d2b, bark: 0x6a3a2a },
  ironwood:  { name: "Ironwood",  wood: 0x737a7f, bark: 0x50585e },
  elderwood: { name: "Elderwood", wood: 0x6e4f96, bark: 0x3b2a4f, emissive: 0x7b4fbf, glow: 0.3 },
};

export const GEMS: Record<string, { name: string; color: number; glow?: number }> = {
  amethyst:   { name: "Amethyst",   color: 0xb070ff },
  topaz:      { name: "Topaz",      color: 0xffb030 },
  emerald:    { name: "Emerald",    color: 0x30e090 },
  sapphire:   { name: "Sapphire",   color: 0x3a80ff },
  ruby:       { name: "Ruby",       color: 0xff3050 },
  emberstone: { name: "Emberstone", color: 0xff7a20, glow: 0.8 },
};

/** Colour helpers. */
export const shade = (c: number, k: number) => new THREE.Color(c).multiplyScalar(k).getHex();
export const mix = (a: number, b: number, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

// ---------- Painted textures ----------
// Small greyscale-ish detail textures (near white) that the material colour
// tints, plus a matching bump (normal) map. They are shared across items.

export type TexKind = "wood" | "metal" | "leather" | "cloth" | "stone" | "bark" | "fur" | "paper" | "rope";

function hash(x: number, y: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, y: number, s: number, period: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const w = (t: number) => t * t * (3 - 2 * t);
  const p = (a: number) => ((a % period) + period) % period;
  const a = hash(p(xi), p(yi), s), b = hash(p(xi + 1), p(yi), s), c = hash(p(xi), p(yi + 1), s), d = hash(p(xi + 1), p(yi + 1), s);
  return a + (b - a) * w(xf) + (c - a) * w(yf) + (a - b - c + d) * w(xf) * w(yf);
}
/** Tiling fractal noise, 0..1. */
function fbm(u: number, v: number, freq: number, oct: number, s: number) {
  let sum = 0, amp = 0.5, tot = 0, f = freq;
  for (let o = 0; o < oct; o++) { sum += vnoise(u * f, v * f, s + o, f) * amp; tot += amp; amp *= 0.5; f *= 2; }
  return sum / tot;
}

const SIZE = 256;
/** Height (0..1) and brightness (0..1) for a texel. */
function sample(kind: TexKind, u: number, v: number): [number, number] {
  switch (kind) {
    case "wood": {
      const n = fbm(u, v, 4, 3, 1);
      const rings = 0.5 + 0.5 * Math.sin((u * 18 + n * 6) * Math.PI);
      const streak = fbm(u * 8, v * 0.5, 4, 2, 7);
      const h = rings * 0.6 + streak * 0.4;
      return [h, 0.84 + 0.16 * h];
    }
    case "bark": {
      const n = fbm(u, v, 3, 3, 3);
      const ridge = Math.abs(Math.sin((u * 10 + n * 4) * Math.PI));
      const h = Math.pow(ridge, 0.6) * 0.8 + fbm(u, v, 16, 2, 4) * 0.2;
      return [h, 0.62 + 0.38 * h];
    }
    case "metal": {
      const brushed = fbm(u * 1, v * 24, 4, 2, 11);
      const blot = fbm(u, v, 3, 3, 12);
      return [brushed * 0.3, 0.9 + 0.06 * brushed + 0.04 * blot];
    }
    case "leather": {
      const cell = fbm(u, v, 28, 2, 21);
      const big = fbm(u, v, 3, 3, 22);
      const h = Math.pow(cell, 1.5);
      return [h * 0.6, 0.88 + 0.06 * h + 0.06 * big];
    }
    case "cloth": {
      const a = 0.5 + 0.5 * Math.sin(u * 64 * Math.PI * 2), b = 0.5 + 0.5 * Math.sin(v * 64 * Math.PI * 2);
      const weave = (Math.floor(u * 64) + Math.floor(v * 64)) % 2 ? a : b;
      const big = fbm(u, v, 4, 3, 31);
      return [weave * 0.5, 0.92 + 0.03 * weave + 0.05 * big];
    }
    case "stone": {
      const n = fbm(u, v, 6, 4, 41);
      const speck = hash(Math.floor(u * 256), Math.floor(v * 256), 42) > 0.94 ? 0.12 : 0;
      return [n, 0.78 + 0.22 * n - speck];
    }
    case "fur": {
      const strand = fbm(u * 2, v * 30, 4, 2, 51);
      const big = fbm(u, v, 3, 3, 52);
      return [strand, 0.78 + 0.16 * strand + 0.06 * big];
    }
    case "paper": {
      const n = fbm(u, v, 8, 4, 61);
      return [n * 0.4, 0.92 + 0.08 * n];
    }
    case "rope": {
      const twist = 0.5 + 0.5 * Math.sin((u * 6 + v * 24) * Math.PI * 2);
      return [twist, 0.8 + 0.2 * twist];
    }
  }
}

const texCache = new Map<string, { map: THREE.Texture; normal: THREE.Texture }>();
/** The colour and normal textures for a material kind (made once). */
export function textures(kind: TexKind) {
  const hit = texCache.get(kind);
  if (hit) return hit;
  const hgt = new Float32Array(SIZE * SIZE);
  const col = document.createElement("canvas");
  col.width = col.height = SIZE;
  const cx = col.getContext("2d")!;
  const img = cx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const [h, b] = sample(kind, x / SIZE, y / SIZE);
    hgt[y * SIZE + x] = h;
    const i = (y * SIZE + x) * 4, c = Math.round(Math.min(1, b) * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = c; img.data[i + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  const nor = document.createElement("canvas");
  nor.width = nor.height = SIZE;
  const nx = nor.getContext("2d")!;
  const nimg = nx.createImageData(SIZE, SIZE);
  const strength = kind === "metal" || kind === "paper" ? 1.2 : 3;
  const H = (x: number, y: number) => hgt[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * SIZE + x) * 4;
    nimg.data[i] = Math.round((-dx / l * 0.5 + 0.5) * 255);
    nimg.data[i + 1] = Math.round((dy / l * 0.5 + 0.5) * 255);
    nimg.data[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255);
    nimg.data[i + 3] = 255;
  }
  nx.putImageData(nimg, 0, 0);
  const mk = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.userData.mimeType = "image/jpeg";
    t.name = `${kind}${srgb ? "" : "_normal"}`;
    return t;
  };
  const out = { map: mk(col, true), normal: mk(nor, false) };
  texCache.set(kind, out);
  return out;
}

// ---------- Materials ----------

export interface MatOpts { rough?: number; metal?: number; tex?: TexKind; emissive?: number; glow?: number; opacity?: number; normal?: number; side?: THREE.Side }
const matCache = new Map<string, THREE.MeshStandardMaterial>();
/** A soft PBR material. `name` is what Godot and the gallery swap by. */
export function mat(name: string, color: number, o: MatOpts = {}): THREE.MeshStandardMaterial {
  const key = JSON.stringify([name, color, o]);
  const hit = matCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({
    name, color, roughness: o.rough ?? 0.6, metalness: o.metal ?? 0, side: o.side ?? THREE.FrontSide,
  });
  if (o.tex) {
    const t = textures(o.tex);
    m.map = t.map;
    m.normalMap = t.normal;
    const n = o.normal ?? 0.6;
    m.normalScale.set(n, n);
  }
  if (o.emissive !== undefined) { m.emissive.setHex(o.emissive); m.emissiveIntensity = o.glow ?? 1; }
  if (o.opacity !== undefined && o.opacity < 1) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
  matCache.set(key, m);
  return m;
}

export const metalMat = (m: Metal, dark = false) => {
  const l = METALS[m];
  return mat(dark ? "metal_dark" : "metal", dark ? l.dark : l.color, { rough: l.rough + (dark ? 0.1 : 0), metal: l.metal, tex: m === "stone" ? "stone" : "metal", emissive: l.emissive, glow: l.glow });
};
export const jewelMat = (j: Jewel) => { const l = JEWELS[j]; return mat("jewel_metal", l.color, { rough: l.rough, metal: l.metal, tex: "metal", emissive: l.emissive, glow: l.glow }); };
export const woodMat = (w: Wood) => { const l = WOODS[w]; return mat("wood", l.wood, { rough: 0.75, metal: l.metal ?? 0, tex: "wood", emissive: l.emissive, glow: l.glow }); };
export const barkMat = (w: Wood) => { const l = WOODS[w]; return mat("bark", l.bark, { rough: 0.9, tex: "bark", normal: 1, emissive: l.emissive, glow: (l.glow ?? 0) * 0.5 }); };
export const leatherMat = (c = 0x8a5a34, name = "leather") => mat(name, c, { rough: 0.65, tex: "leather", normal: 0.35 });
export const clothMat = (c: number, name = "cloth") => mat(name, c, { rough: 0.9, tex: "cloth", normal: 0.3 });
export const gemMat = (c: number, glow = 0.25) => mat("gem", c, { rough: 0.08, metal: 0.1, emissive: c, glow });
export const glassMat = (c = 0xeef8ff) => mat("glass", c, { rough: 0.05, metal: 0, opacity: 0.22 });
export const plain = (name: string, c: number, rough = 0.6, metal = 0) => mat(name, c, { rough, metal });

// ---------- Shapes ----------

const finish = (g: THREE.BufferGeometry, m: THREE.Material) => {
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
};
export type V3 = [number, number, number];
/** Place a mesh: position, then rotation in degrees. Returns it. */
export function at<T extends THREE.Object3D>(o: T, p: V3 = [0, 0, 0], r: V3 = [0, 0, 0], s?: number | V3): T {
  o.position.set(...p);
  o.rotation.set(r[0] * Math.PI / 180, r[1] * Math.PI / 180, r[2] * Math.PI / 180);
  if (s !== undefined) typeof s === "number" ? o.scale.setScalar(s) : o.scale.set(...s);
  return o;
}

/** A rounded box. */
export const rbox = (w: number, h: number, d: number, r: number, m: THREE.Material, seg = 2) =>
  finish(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)), m);

/** A smooth round shape spun from a side profile: [radius, y] points, bottom to top. */
export function lathe(pts: [number, number][], m: THREE.Material, seg = 16) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg);
  return finish(g, m);
}

/** A rod along Y from y0 to y0+len, slightly rounded caps (so nothing looks cut off). */
export function rod(r0: number, r1: number, len: number, m: THREE.Material, seg = 10, y0 = 0) {
  const c = Math.min(r0, r1) * 0.35;
  return at(lathe([[0, 0], [r0 - c, 0], [r0, c], [r1, len - c], [r1 - c, len], [0, len]], m, seg), [0, y0, 0]);
}

export const sphere = (r: number, m: THREE.Material, w = 14, h = 10) => finish(new THREE.SphereGeometry(r, w, h), m);
export const capsule = (r: number, len: number, m: THREE.Material, cap = 4, rad = 10) => finish(new THREE.CapsuleGeometry(r, len, cap, rad), m);
export const torus = (R: number, r: number, m: THREE.Material, rs = 8, ts = 20, arc = Math.PI * 2) => finish(new THREE.TorusGeometry(R, r, rs, ts, arc), m);
export const cone = (r: number, h: number, m: THREE.Material, seg = 10) => finish(new THREE.ConeGeometry(r, h, seg), m);
export const cyl = (rt: number, rb: number, h: number, m: THREE.Material, seg = 12) => finish(new THREE.CylinderGeometry(rt, rb, h, seg), m);

/** A tube following points (smooth curve). */
export function tube(pts: V3[], r: number, m: THREE.Material, seg = 24, rs = 8, closed = false) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed);
  return finish(new THREE.TubeGeometry(curve, seg, r, rs, closed), m);
}

/**
 * A flat 2D outline given thickness with soft rounded edges, like a blade,
 * axe head or shield. Points are [x, y] in metres; the slab is centred on z=0.
 */
export function slab(outline: [number, number][], thick: number, m: THREE.Material, bevel = thick * 0.45, curveSeg = 1) {
  const s = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const core = Math.max(1e-4, thick - bevel * 2);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: core, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 3, curveSegments: curveSeg, steps: 1,
  });
  g.translate(0, 0, -core / 2);
  scaleUV(g, 4);
  return finish(g, m);
}
/** The same from a smooth THREE.Shape (curves). */
export function slabShape(shape: THREE.Shape, thick: number, m: THREE.Material, bevel = thick * 0.45, curveSeg = 10) {
  const core = Math.max(1e-4, thick - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, { depth: core, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 3, curveSegments: curveSeg, steps: 1 });
  g.translate(0, 0, -core / 2);
  scaleUV(g, 4);
  return finish(g, m);
}
function scaleUV(g: THREE.BufferGeometry, k: number) {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k);
}

/** A lumpy rounded rock or nugget (smooth, not jagged). */
export function lump(r: number, m: THREE.Material, rng: () => number, amount = 0.25, detail = 2, squash: V3 = [1, 1, 1]) {
  const g0 = new THREE.IcosahedronGeometry(r, detail);
  g0.deleteAttribute("normal");
  g0.deleteAttribute("uv");
  const g = mergeVertices(g0);
  const p = g.attributes.position as THREE.BufferAttribute;
  const seeds = Array.from({ length: 5 }, () => new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize());
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    let k = 1;
    seeds.forEach((s, j) => { k += Math.max(0, n.dot(s)) ** 3 * amount * (j % 2 ? -0.6 : 1); });
    v.multiplyScalar(k);
    p.setXYZ(i, v.x * squash[0], v.y * squash[1], v.z * squash[2]);
  }
  g.computeVertexNormals();
  // simple spherical UVs so painted textures show
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    uv[i * 2] = (Math.atan2(v.z, v.x) / (Math.PI * 2) + 0.5) * 2;
    uv[i * 2 + 1] = v.y * 0.5 + 0.5;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return finish(g, m);
}

/** A faceted gem (cut stone). */
export function gem(r: number, m: THREE.Material, sides = 8, crown = 0.45, pavilion = 0.9) {
  // cut stones keep crisp facets (the one place flat faces are right)
  const mesh = lathe([[0, -r * pavilion], [r, 0], [r * 0.62, r * crown], [0, r * crown]], m, sides);
  const g = mesh.geometry.toNonIndexed();
  g.computeVertexNormals();
  mesh.geometry = g;
  return mesh;
}

/** A one-off painted texture (not tiling), e.g. a fish's markings. Drawn once per key. */
const paintCache = new Map<string, THREE.Texture>();
export function paint(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
  const hit = paintCache.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.userData.mimeType = "image/jpeg";
  t.name = key;
  paintCache.set(key, t);
  return t;
}
/** A material whose colour comes from a painted texture. */
export function paintedMat(name: string, tex: THREE.Texture, o: MatOpts = {}) {
  const key = "painted:" + tex.name + JSON.stringify(o) + name;
  const hit = matCache.get(key);
  if (hit) return hit;
  const m = mat(name + "#" + tex.name, 0xffffff, o).clone();
  m.name = name;
  m.map = tex;
  if (o.tex) { m.normalMap = textures(o.tex).normal; }
  matCache.set(key, m);
  return m;
}
/** Wood end grain: rings round the middle (for log ends and cut planks). */
export function endGrain(w: Wood) {
  const l = WOODS[w];
  const t = paint("endgrain_" + w, 256, 256, (c, W, H) => {
    const inner = new THREE.Color(l.wood).offsetHSL(0, 0, 0.12), dark = new THREE.Color(l.wood).offsetHSL(0, 0, -0.05);
    c.fillStyle = "#" + new THREE.Color(l.bark).getHexString(); c.fillRect(0, 0, W, H);
    for (let r = W * 0.47; r > 2; r -= 6) {
      const k = r / (W * 0.47);
      c.fillStyle = "#" + inner.clone().lerp(dark, (Math.round(r / 6) % 2) * 0.5 + k * 0.3).getHexString();
      c.beginPath(); c.arc(W / 2 + Math.sin(r) * 2, H / 2 + Math.cos(r * 1.3) * 2, r, 0, Math.PI * 2); c.fill();
    }
  });
  return paintedMat("wood_end", t, { rough: 0.8, emissive: l.emissive, glow: (l.glow ?? 0) * 0.5 });
}

/** Seeded random numbers. */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; };
}

export function group(name: string, ...kids: THREE.Object3D[]) {
  const g = new THREE.Group();
  g.name = name;
  kids.forEach((k) => g.add(k));
  return g;
}

// ---------- The item catalogue ----------

export interface Choice { label: string; values: { id: string; name: string; swatch?: number }[] }

export interface ItemDef {
  id: string;
  name: string;
  cat: string;
  about: string;
  /** Game item ids this model is used for (patterns allowed, e.g. "sword_*"). */
  game: string[];
  /** Which looks can be swapped in Godot / the gallery, by material name. */
  swaps?: ("metal" | "wood" | "jewel" | "gem")[];
  /** Held in the hand: origin at the grip, pointing +Y. Otherwise it sits on the ground, origin at its base. */
  held?: boolean;
  build: () => THREE.Object3D;
}

export const METAL_IDS = Object.keys(METALS) as Metal[];
export const WOOD_IDS = Object.keys(WOODS) as Wood[];
