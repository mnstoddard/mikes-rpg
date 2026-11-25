// Smooth shapes used by the character (and by anything that has to fit it,
// like armor): a capsule limb, a ball, a body made of rings, and the
// sculpted head surface that every face part, hair, hat or helmet sits on.
//
// Ported from the Character Workshop (project files: character-creator/).
import * as THREE from "three";

export const V3 = THREE.Vector3;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Smooth step from 0 (x at a) to 1 (x at b). */
export const sm = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** A fixed "random" number from three numbers. */
export const hash = (x: number, y: number, z: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
export const ZV = new V3(0, 0, 1);
export const YV = new V3(0, 1, 0);
export const dirN = (x: number, y: number, z: number) => new V3(x, y, z).normalize();

/** Average normals where corners share a position (sphere and lathe seams), so smooth shading has no lines. */
export function smoothFix<T extends THREE.BufferGeometry>(g: T): T {
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, map = new Map<string, number[]>();
  for (let i = 0; i < p.count; i++) {
    const k = Math.round(p.getX(i) * 1e4) + "," + Math.round(p.getY(i) * 1e4) + "," + Math.round(p.getZ(i) * 1e4);
    let a = map.get(k);
    if (!a) map.set(k, (a = []));
    a.push(i);
  }
  const v = new V3();
  map.forEach((ids) => {
    if (ids.length < 2) return;
    v.set(0, 0, 0);
    for (const i of ids) v.set(v.x + n.getX(i), v.y + n.getY(i), v.z + n.getZ(i));
    v.normalize();
    for (const i of ids) n.setXYZ(i, v.x, v.y, v.z);
  });
  n.needsUpdate = true;
  return g;
}

/** A rounded capsule hanging down from its joint: radius r1 at the top, r2 at the bottom. */
export function limbGeo(r1: number, r2: number, len: number, seg = 20) {
  const pts: THREE.Vector2[] = [], n = 7;
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * r2), -len + Math.sin(a) * r2));
  }
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * r1), Math.sin(a) * r1));
  }
  return smoothFix(new THREE.LatheGeometry(pts, seg));
}

export const ball = (r: number, w = 22, h = 16) => smoothFix(new THREE.SphereGeometry(r, w, h));

export function mixHex(a: string, b: string, t: number) {
  return "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

/** One ring of a ring body: height y, half-width rx, half-depth rz, bf = bust forward, oz = shift forward. */
export interface Ring { y: number; rx: number; rz: number; bf?: number; oz?: number }

/** A closed tube through rings with oval cross-sections (smoothly curved between them). */
export function ringsGeo(rings0: Ring[], seg = 28) {
  const rings: Ring[] = [];
  const cr = (a: number, b: number, c: number, d: number, t: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 0; i < rings0.length - 1; i++) {
    const a = rings0[Math.max(0, i - 1)], b = rings0[i], c = rings0[i + 1], d = rings0[Math.min(rings0.length - 1, i + 2)];
    for (let k = 0; k < 4; k++) {
      const t = k / 4;
      const o: Ring = { y: 0, rx: 0, rz: 0 };
      for (const q of ["y", "rx", "rz", "bf", "oz"] as const) o[q] = cr(a[q] || 0, b[q] || 0, c[q] || 0, d[q] || 0, t);
      if (k === 0) o.y = b.y;
      rings.push(o);
    }
  }
  rings.push(rings0[rings0.length - 1]);
  const pos: number[] = [], idx: number[] = [];
  for (const r of rings) {
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2 + Math.PI / seg;
      const c = Math.cos(a), s = Math.sin(a);
      let z = r.rz * s;
      if (s > 0 && r.bf) z += r.bf * Math.pow(s, 3);
      pos.push(r.rx * c, r.y, z + (r.oz || 0));
    }
  }
  const n = rings.length, B = pos.length / 3;
  pos.push(0, rings[0].y, rings[0].oz || 0);
  const T = B + 1;
  pos.push(0, rings[n - 1].y, rings[n - 1].oz || 0);
  for (let i = 0; i < n - 1; i++)
    for (let j = 0; j < seg; j++) {
      const j2 = (j + 1) % seg;
      const a = i * seg + j, b = i * seg + j2, c = (i + 1) * seg + j, d = (i + 1) * seg + j2;
      idx.push(a, c, b, b, c, d);
    }
  for (let j = 0; j < seg; j++) {
    const j2 = (j + 1) % seg;
    idx.push(B, j, j2);
    idx.push(T, (n - 1) * seg + j2, (n - 1) * seg + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return smoothFix(g);
}

/** The shape of a head: radii, jaw, chin, cheekbones and squareness. */
export interface HeadShape { rx: number; ry: number; rz: number; jaw: number; chin: number; cheeks: number; square: number }

/** The head surface: a unit direction -> the point on the sculpted head. Every face part sits on this. */
export function headPoint(d: THREE.Vector3, H: HeadShape, out: THREE.Vector3) {
  const e = 1 - H.square * 0.4;
  const x = Math.sign(d.x) * Math.pow(Math.abs(d.x), e), y = Math.sign(d.y) * Math.pow(Math.abs(d.y), e), z = Math.sign(d.z) * Math.pow(Math.abs(d.z), e);
  const k = 1 / (1 + H.square * 0.14);
  let px = x * H.rx * k, py = y * H.ry * k, pz = z * H.rz * k;
  if (d.y < 0) {
    const t = -d.y;
    px *= lerp(1, H.jaw, sm(0, 0.85, t));
    py *= lerp(1, H.chin, t);
    pz *= lerp(1, 0.9 + 0.1 * H.jaw, t * 0.6);
  }
  const ch = Math.exp(-((d.y + 0.12) ** 2) / 0.05) * clamp(d.z + 0.2, 0, 1);
  px *= 1 + H.cheeks * 0.14 * ch;
  if (d.z < 0) pz *= 1 + 0.1 * -d.z * sm(-0.6, 0.4, d.y);
  return out.set(px, py, pz);
}

/**
 * A sphere wrapped onto the head. fn(d, off) gives the thickness at each
 * direction (negative = tucked inside the head, hidden) and can push the
 * point by `off`. Hair, beards, hats and helmets are all made this way.
 */
export function shellGeo(H: HeadShape, w: number, h: number, fn: ((d: THREE.Vector3, off: THREE.Vector3, cc: { c: number }) => number) | null, withColor = false) {
  const g = new THREE.SphereGeometry(1, w, h), p = g.attributes.position, d = new V3(), o = new V3(), off = new V3();
  const cc = { c: 1 }, col: number[] = [];
  const tucked = new Uint8Array(p.count);
  for (let i = 0; i < p.count; i++) {
    d.fromBufferAttribute(p, i).normalize();
    off.set(0, 0, 0);
    cc.c = 1;
    const t = fn ? fn(d, off, cc) : 0;
    if (t < -0.02) tucked[i] = 1;
    col.push(cc.c, cc.c, cc.c);
    headPoint(d, H, o);
    if (t < 0) o.multiplyScalar(1 + Math.max(t, -0.12));
    else {
      o.multiplyScalar(1 + t);
      o.add(off);
    }
    p.setXYZ(i, o.x, o.y, o.z);
  }
  if (withColor) g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  // Leave out triangles tucked wholly inside the head: they can never be seen,
  // but the graphics card would still draw them (often over half the hair).
  const idx = g.index!, keep: number[] = [];
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
    if (!(tucked[a] && tucked[b] && tucked[c])) keep.push(a, b, c);
  }
  if (keep.length < idx.count) g.setIndex(keep);
  return smoothFix(g);
}
