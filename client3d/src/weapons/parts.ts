// Shared building blocks for every weapon: what each metal, wood and gem
// looks like, and the low-poly pieces weapons are made from (blades, grips,
// guards, pommels, gems).
//
// Every weapon is built the same way round: the middle of the grip (where the
// hand holds it) is at (0,0,0) and the blade or head points up the +Y axis.
// So a character just puts the weapon in its hand and turns the hand.
import * as THREE from "three";
import type { Material, Wood } from "../../../shared/tools";
import type { GemId } from "../../../shared/jewelry";
import { MatOptions, mat } from "../trees/common";

export { makeRng, between } from "../trees/common";
export type { Rng } from "../trees/common";

// ---------- What things are made of ----------

/** Head metals: the game's five, plus Aurelite (planned for the Sundered Crown). */
export type WeaponMetal = Material | "aurelite";
/** Handle woods: the game's seven, plus Crownwood (planned for the Sundered Crown). */
export type WeaponWood = Wood | "crownwood";

export interface Look {
  name: string;
  color: number;
  /** A darker shade for edges, rings and inlays. */
  dark: number;
  mat: MatOptions;
  /** Not in the game's rules yet. */
  planned?: boolean;
}

export const METAL_LOOKS: Record<WeaponMetal, Look> = {
  stone:    { name: "Stone",    color: 0x9a968c, dark: 0x6f6b63, mat: { roughness: 0.95, metalness: 0 } },
  bronze:   { name: "Bronze",   color: 0xd99c52, dark: 0x8a5626, mat: { roughness: 0.3, metalness: 0.85 } },
  iron:     { name: "Iron",     color: 0x8d9197, dark: 0x55595e, mat: { roughness: 0.5, metalness: 0.75 } },
  steel:    { name: "Steel",    color: 0xd5dbe1, dark: 0x8b939b, mat: { roughness: 0.26, metalness: 0.9 } },
  mithril:  { name: "Mithril",  color: 0x7cc4ee, dark: 0x3f7fae, mat: { roughness: 0.22, metalness: 0.85, emissive: 0x2a6fa8, emissiveIntensity: 0.35 } },
  aurelite: { name: "Aurelite", color: 0xf3c64f, dark: 0xb5832a, mat: { roughness: 0.25, metalness: 0.9, emissive: 0xb07a10, emissiveIntensity: 0.45 }, planned: true },
};
export const WEAPON_METALS = Object.keys(METAL_LOOKS) as WeaponMetal[];

export const WOOD_LOOKS: Record<WeaponWood, Look> = {
  pine:      { name: "Pine",      color: 0xd2ae73, dark: 0xa07c45, mat: {} },
  oak:       { name: "Oak",       color: 0x9c6c3f, dark: 0x6e4826, mat: {} },
  birch:     { name: "Birch",     color: 0xece2cc, dark: 0x3c3a36, mat: {} },
  maple:     { name: "Maple",     color: 0xbb6a3c, dark: 0x864424, mat: {} },
  yew:       { name: "Yew",       color: 0x8e3d2b, dark: 0x5c2219, mat: {} },
  ironwood:  { name: "Ironwood",  color: 0x737a7f, dark: 0x4b5155, mat: { metalness: 0.3, roughness: 0.6 } },
  elderwood: { name: "Elderwood", color: 0x6e4f96, dark: 0x45306a, mat: { emissive: 0x7b4fbf, emissiveIntensity: 0.3 } },
  crownwood: { name: "Crownwood", color: 0xd7a540, dark: 0x8f6420, mat: { metalness: 0.2, roughness: 0.55, emissive: 0x8f6420, emissiveIntensity: 0.15 }, planned: true },
};
export const WEAPON_WOODS = Object.keys(WOOD_LOOKS) as WeaponWood[];

export const GEM_COLORS: Record<GemId, number> = {
  ruby: 0xe0314b, sapphire: 0x2f6fe0, emerald: 0x2fbf6a, topaz: 0xf0b52a, amethyst: 0x9b59d6,
};
/** Leather and cloth wraps. */
export const LEATHER = 0x6b4630;
export const LEATHER_DARK = 0x4a2f20;
export const GOLD = 0xe2b441;

export const metalMat = (m: WeaponMetal, dark = false) => mat(dark ? METAL_LOOKS[m].dark : METAL_LOOKS[m].color, METAL_LOOKS[m].mat);
export const woodMat = (w: WeaponWood, dark = false) => mat(dark ? WOOD_LOOKS[w].dark : WOOD_LOOKS[w].color, WOOD_LOOKS[w].mat);
export const plainMat = (color: number, o: MatOptions = {}) => mat(color, o);
export const glowMat = (color: number, strength = 1.6) => mat(color, { emissive: color, emissiveIntensity: strength, roughness: 0.4 });

function mesh(geo: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh {
  const me = new THREE.Mesh(geo, m);
  me.castShadow = true;
  me.receiveShadow = true;
  return me;
}

// ---------- Blades ----------

/**
 * One point along a blade, from the guard (y = 0) to the tip.
 * w: half the width. x: how far it curves sideways. t: half the thickness (optional).
 */
export interface BladeStation { y: number; w: number; x?: number; t?: number }

/**
 * A faceted blade with a raised ridge down the middle (a diamond shape if you
 * cut through it). It runs up the +Y axis from y = 0. The last station can
 * have w = 0 for a point.
 */
export function bladeGeo(stations: BladeStation[], thickness: number): THREE.BufferGeometry {
  const pos: number[] = [];
  // Four corners per station: right edge, front ridge, left edge, back ridge.
  const ring = (s: BladeStation) => {
    const x = s.x ?? 0;
    const t = s.t ?? thickness;
    return [
      new THREE.Vector3(x + s.w, s.y, 0),
      new THREE.Vector3(x, s.y, t),
      new THREE.Vector3(x - s.w, s.y, 0),
      new THREE.Vector3(x, s.y, -t),
    ];
  };
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const rings = stations.map(ring);
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i];
    const b = rings[i + 1];
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      tri(a[k], b[k], b[k2]);
      tri(a[k], b[k2], a[k2]);
    }
  }
  // Cap the bottom (hidden by the guard, but keeps it solid).
  const r = rings[0];
  tri(r[0], r[2], r[1]);
  tri(r[0], r[3], r[2]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

export function blade(stations: BladeStation[], thickness: number, m: THREE.Material): THREE.Mesh {
  return mesh(bladeGeo(stations, thickness), m);
}

/** A simple straight blade: base width, length, and how long the point is. */
export function straightBlade(len: number, halfW: number, tipLen: number, thick: number, taper = 0.85): BladeStation[] {
  return [
    { y: 0, w: halfW },
    { y: len - tipLen, w: halfW * taper },
    { y: len, w: 0 },
  ];
}

// ---------- Handles and fittings ----------

/** A round grip of wood, centred on (0,0,0), with leather wraps. */
export function grip(len: number, r: number, wood: THREE.Material, o: { wraps?: number; wrapColor?: number; sides?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r, r * 1.05, len, o.sides ?? 7), wood));
  const wraps = o.wraps ?? 0;
  for (let i = 0; i < wraps; i++) {
    const ring = mesh(new THREE.CylinderGeometry(r * 1.18, r * 1.18, len * 0.07, o.sides ?? 7), plainMat(o.wrapColor ?? LEATHER_DARK));
    ring.position.y = -len / 2 + ((i + 0.5) / wraps) * len;
    g.add(ring);
  }
  return g;
}

/** A pole (spear shaft, staff), from y0 up to y1. */
export function pole(y0: number, y1: number, r0: number, r1: number, m: THREE.Material, sides = 6): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r1, r0, y1 - y0, sides);
  const me = mesh(geo, m);
  me.position.y = (y0 + y1) / 2;
  return me;
}

/** A box (guards, crossbars). Centred where you put it. */
export function box(w: number, h: number, d: number, m: THREE.Material): THREE.Mesh {
  return mesh(new THREE.BoxGeometry(w, h, d), m);
}

/** A faceted knob (pommels, mace heads, stones). */
export function knob(r: number, m: THREE.Material, detail = 0): THREE.Mesh {
  return mesh(new THREE.IcosahedronGeometry(r, detail), m);
}

/** A cut gem that glows a little (a lot at night, with bloom). */
export function gem(r: number, color: number, glow = 0.9): THREE.Mesh {
  const me = mesh(new THREE.OctahedronGeometry(r, 0), plainMat(color, { emissive: color, emissiveIntensity: glow, roughness: 0.15, metalness: 0.1 }));
  me.scale.y = 1.4;
  return me;
}

/** A cone (spikes, spear points, arrow tips). Points up +Y from y = 0. */
export function spike(r: number, h: number, m: THREE.Material, sides = 4): THREE.Mesh {
  const geo = new THREE.ConeGeometry(r, h, sides);
  geo.translate(0, h / 2, 0);
  return mesh(geo, m);
}

/** A flat fin (arrow fletching, dart flights): a triangle in the XY plane. */
export function fin(len: number, wide: number, color: number): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, wide, len * 0.25, 0, 0, len, 0], 3));
  geo.computeVertexNormals();
  const m = plainMat(color).clone();
  m.side = THREE.DoubleSide;
  return mesh(geo, m);
}

/** A curved tube along points (bow limbs, crooks, sling cords). */
export function tube(points: THREE.Vector3[], r: number, m: THREE.Material, segs = 16, sides = 6): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  return mesh(new THREE.TubeGeometry(curve, segs, r, sides, false), m);
}
