// Every fish you can catch, made from code in the low-poly look.
//
// One fish can be shown four ways:
//   swim    - alive, swimming in place (its whole body waves, eels the most)
//   caught  - lying on its side, flopping now and then
//   grilled - cooked, browned with grill marks, steaming
//   fried   - cooked in a golden crumb, steaming
//
// The whole fish (body, fins, eyes) bends together, so the tail never comes off.
import * as THREE from "three";
import type { FishId } from "../../../shared/cooking";
import { Rng, Showpiece, Stage, makeRng, mat, mix, shade, steam, disposeAll } from "./common";

export type FishState = "swim" | "caught" | "grilled" | "fried";

type Fin = { from: number; to: number; height: number; kind: "plain" | "spiny" | "sickle" | "ribbon" };

interface FishLook {
  /** Real length in metres (the size it is in the game world). */
  length: number;
  /** Body height and width, as a share of the length. */
  height: number;
  width: number;
  /** Where the body is deepest: 0 is the tail, 1 the nose. */
  peak: number;
  /** How round the body is: 0.6 a normal fish, 0.25 a tube (eels). */
  round: number;
  back: number;
  side: number;
  belly: number;
  fin: number;
  eye: number;
  pattern?: { kind: "spots" | "ovals" | "bars" | "stripe"; color: number; amount: number };
  tail: "fork" | "square" | "crescent" | "round" | "none";
  tailSize: number;
  dorsal: Fin[];
  anal?: Fin;
  /** Little yellow fins along the back and belly near the tail (tuna). */
  finlets?: number;
  /** A sword on the nose, as a share of the length (swordfish). */
  bill?: number;
  /** A flat, duck-bill head (pike). */
  flatHead?: boolean;
  /** Swims like a snake (eels). */
  eel?: boolean;
  /** A faint glow (deep-water eels). */
  glow?: number;
}

export const FISH_LOOKS: Record<FishId, FishLook> = {
  minnow: {
    length: 0.08, height: 0.2, width: 0.12, peak: 0.6, round: 0.6,
    back: 0x6f7f84, side: 0xc5cfd2, belly: 0xeef2f2, fin: 0xb8c4c6, eye: 0xe8e2c0,
    pattern: { kind: "stripe", color: 0x3f4c52, amount: 1 },
    tail: "fork", tailSize: 0.22, dorsal: [{ from: 0.42, to: 0.58, height: 0.09, kind: "plain" }], anal: { from: 0.28, to: 0.4, height: 0.06, kind: "plain" },
  },
  trout: {
    length: 0.42, height: 0.22, width: 0.12, peak: 0.58, round: 0.6,
    back: 0x5f6e35, side: 0xb4b88a, belly: 0xf0e8d2, fin: 0x8c8a5c, eye: 0xd9c46a,
    pattern: { kind: "spots", color: 0x2a2a1e, amount: 0.14 },
    tail: "square", tailSize: 0.2, dorsal: [{ from: 0.45, to: 0.6, height: 0.08, kind: "plain" }], anal: { from: 0.25, to: 0.36, height: 0.06, kind: "plain" },
  },
  perch: {
    length: 0.3, height: 0.3, width: 0.13, peak: 0.6, round: 0.65,
    back: 0x56632a, side: 0xd8b53c, belly: 0xf2e6b8, fin: 0xe0662c, eye: 0xf0a030,
    pattern: { kind: "bars", color: 0x3a4424, amount: 6 },
    tail: "square", tailSize: 0.2,
    dorsal: [{ from: 0.52, to: 0.76, height: 0.13, kind: "spiny" }, { from: 0.3, to: 0.48, height: 0.08, kind: "plain" }],
    anal: { from: 0.26, to: 0.36, height: 0.07, kind: "plain" },
  },
  salmon: {
    length: 0.75, height: 0.22, width: 0.12, peak: 0.6, round: 0.6,
    back: 0x4d6375, side: 0xd2b8b0, belly: 0xf3ece6, fin: 0x6f7f8c, eye: 0xd8d0b0,
    pattern: { kind: "spots", color: 0x2c3644, amount: 0.12 },
    tail: "fork", tailSize: 0.18, dorsal: [{ from: 0.48, to: 0.62, height: 0.08, kind: "plain" }], anal: { from: 0.24, to: 0.33, height: 0.05, kind: "plain" },
  },
  pike: {
    length: 1.0, height: 0.15, width: 0.11, peak: 0.45, round: 0.55,
    back: 0x3f5a2a, side: 0x7a9448, belly: 0xeae3c4, fin: 0xb06a3a, eye: 0xe3c040,
    pattern: { kind: "ovals", color: 0xdcd98e, amount: 0.3 },
    tail: "round", tailSize: 0.16, flatHead: true,
    dorsal: [{ from: 0.16, to: 0.28, height: 0.07, kind: "plain" }], anal: { from: 0.15, to: 0.26, height: 0.06, kind: "plain" },
  },
  tuna: {
    length: 1.8, height: 0.26, width: 0.2, peak: 0.55, round: 0.7,
    back: 0x1d2f5c, side: 0x7d8ea8, belly: 0xdfe5ec, fin: 0x2b3b66, eye: 0x1d2433,
    tail: "crescent", tailSize: 0.2, finlets: 5,
    dorsal: [{ from: 0.52, to: 0.64, height: 0.08, kind: "spiny" }, { from: 0.36, to: 0.46, height: 0.11, kind: "sickle" }],
    anal: { from: 0.34, to: 0.44, height: 0.1, kind: "sickle" },
  },
  swordfish: {
    length: 3.0, height: 0.17, width: 0.12, peak: 0.6, round: 0.65, bill: 0.32,
    back: 0x3c3a5c, side: 0x8f8aa8, belly: 0xd8d6e4, fin: 0x34324e, eye: 0x1d1d2a,
    tail: "crescent", tailSize: 0.17,
    dorsal: [{ from: 0.66, to: 0.8, height: 0.16, kind: "sickle" }], anal: { from: 0.3, to: 0.38, height: 0.06, kind: "sickle" },
  },
  eel: {
    length: 1.2, height: 0.06, width: 0.05, peak: 0.6, round: 0.22, eel: true, glow: 0x9a4dff,
    back: 0x2b2238, side: 0x4e3f63, belly: 0x8d7fa0, fin: 0x3a2d4c, eye: 0xc9a6ff,
    pattern: { kind: "stripe", color: 0xb36bff, amount: 1 },
    tail: "none", tailSize: 0,
    dorsal: [{ from: 0.0, to: 0.66, height: 0.035, kind: "ribbon" }], anal: { from: 0.0, to: 0.45, height: 0.03, kind: "ribbon" },
  },
};

// ---------- Body shape ----------

/** How thick the body is at t (0 tail .. 1 nose), from 0 to 1. */
function thickness(look: FishLook, t: number): number {
  const a = Math.log(0.5) / Math.log(look.peak);
  const s = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(Math.min(1, Math.max(0, t)), a))), look.round);
  return Math.max(s, t < 0.5 ? (look.eel ? 0.15 : 0.12) : 0);
}

/** Top of the body at t, in metres. */
function topAt(look: FishLook, L: number, t: number) {
  let y = (look.height * L) / 2 * thickness(look, t);
  if (look.flatHead) y *= 1 - 0.4 * smooth(0.72, 1, t);
  return y;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------- Colours ----------

function cookedColor(c: number, state: FishState, rng: Rng): number {
  if (state === "fried") return rng() < 0.25 ? 0xa8641c : rng() < 0.5 ? 0xd8932e : 0xe4a642;
  return shade(mix(c, 0xb67a3c, 0.62), 0.95);
}

function bodyColor(look: FishLook, state: FishState, rng: Rng, t: number, v: number, L: number, x: number, h: number): number {
  let c = v > 0.45 ? look.back : v > 0.15 ? mix(look.side, look.back, 0.45) : v > -0.4 ? look.side : look.belly;
  const p = look.pattern;
  if (p) {
    if (p.kind === "spots" && v > -0.25 && t > 0.08 && t < 0.85 && h < p.amount) c = p.color;
    if (p.kind === "ovals" && v > -0.35 && v < 0.75 && t > 0.08 && t < 0.82 && h < p.amount) c = p.color;
    if (p.kind === "bars" && v > -0.35 && t > 0.18 && t < 0.8 && Math.sin(t * Math.PI * 2 * p.amount) > 0.35) c = p.color;
    if (p.kind === "stripe" && Math.abs(v) < 0.2 && t > 0.06 && t < 0.88) c = p.color;
  }
  if (state === "swim" || state === "caught") return c;
  // Cooked: brown it, keep the belly pale, and add grill marks.
  if (state === "fried") return cookedColor(c, state, rng);
  let cooked = v < -0.4 ? 0xe2c08e : cookedColor(c, state, rng);
  const stripe = ((x / L) * 7 + v * 0.55 + 10) % 1;
  if (stripe < 0.16 && t > 0.1 && t < 0.92) cooked = 0x3b2414;
  return cooked;
}

/**
 * Paint every triangle one colour (the low-poly look). Both triangles of a
 * square get the same colour (they share the same corners' box), so the
 * colours make neat bands instead of a zigzag.
 */
function paintFaces(geo: THREE.BufferGeometry, colorAt: (cx: number, cy: number, cz: number, hash: number) => number) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  const mid = (a: number, b: number, c: number) => (Math.min(a, b, c) + Math.max(a, b, c)) / 2;
  for (let i = 0; i < pos.count; i += 3) {
    const cx = mid(pos.getX(i), pos.getX(i + 1), pos.getX(i + 2));
    const cy = mid(pos.getY(i), pos.getY(i + 1), pos.getY(i + 2));
    const cz = mid(pos.getZ(i), pos.getZ(i + 1), pos.getZ(i + 2));
    // A repeatable "random" number for this square, for spots.
    const h = Math.abs(Math.sin(cx * 1271.3 + cy * 3117.7 + cz * 1733.1) * 43758.5453) % 1;
    col.setHex(colorAt(cx, cy, cz, h));
    for (let k = 0; k < 3; k++) col.toArray(colors, (i + k) * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

// ---------- Building the fish ----------

function buildBody(look: FishLook, L: number, state: FishState, rng: Rng): THREE.Mesh {
  const along = look.eel ? 36 : 22;
  const sphere = new THREE.SphereGeometry(1, look.eel ? 8 : 14, along);
  sphere.rotateZ(-Math.PI / 2); // poles now point along X (nose at +X)
  const pos = sphere.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = (x + 1) / 2;
    const ring = Math.hypot(y, z);
    const ny = ring > 1e-6 ? y / ring : 0;
    const nz = ring > 1e-6 ? z / ring : 0;
    const th = thickness(look, t);
    let Y = ny * ((look.height * L) / 2) * th;
    if (look.flatHead) Y *= 1 - 0.4 * smooth(0.72, 1, t);
    if (ny < 0) Y *= 0.92; // a slightly flatter belly
    pos.setXYZ(i, (t - 0.5) * L, Y, nz * ((look.width * L) / 2) * th);
  }
  const geo = sphere.toNonIndexed();
  geo.deleteAttribute("uv");
  geo.computeVertexNormals();
  paintFaces(geo, (cx, cy, _cz, h) => {
    const t = cx / L + 0.5;
    const top = Math.max(1e-6, topAt(look, L, t));
    return bodyColor(look, state, rng, t, Math.max(-1, Math.min(1, cy / top)), L, cx, h);
  });
  const glow = look.glow && (state === "swim" || state === "caught");
  return new THREE.Mesh(geo, mat(0xffffff, { vertexColors: true, roughness: state === "fried" ? 0.9 : 0.55, emissive: glow ? look.glow : 0, emissiveIntensity: glow ? 0.22 : 0 }));
}

/** A fin along the back (up = 1) or the belly (up = -1). */
function finShape(look: FishLook, L: number, f: Fin, up: 1 | -1): THREE.BufferGeometry {
  const x = (t: number) => (t - 0.5) * L;
  const base = (t: number) => up * (up > 0 ? topAt(look, L, t) * 0.9 : topAt(look, L, t) * 0.8);
  const h = up * f.height * L;
  const span = f.to - f.from;
  const pts: [number, number][] = [[x(f.to), base(f.to)]];
  if (f.kind === "plain") {
    pts.push([x(f.to - span * 0.3), base(f.to) + h], [x(f.from) - span * L * 0.1, base(f.from) + h * 0.3]);
  } else if (f.kind === "spiny") {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const tt = f.to - (span * (i + 0.5)) / n;
      const hh = h * (1 - (i / n) * 0.5);
      pts.push([x(tt + span * 0.04), base(tt) + hh], [x(tt - span * 0.05), base(tt) + hh * 0.55]);
    }
  } else if (f.kind === "sickle") {
    pts.push([x(f.from) - 0.04 * L, base(f.from) + h], [x(f.from) + 0.015 * L, base(f.from) + h * 0.2]);
  } else {
    pts.push([x(f.to) - 0.03 * L, base(f.to) + h], [x(f.from) - 0.01 * L, base(f.from) + h * 0.9]);
  }
  pts.push([x(f.from), base(f.from)]);
  const s = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
  return new THREE.ShapeGeometry(s);
}

function tailShape(look: FishLook, L: number): THREE.BufferGeometry | null {
  const shapes: Record<string, [number, number][]> = {
    fork: [[0, 0.06], [-0.55, 0.5], [-0.38, 0], [-0.55, -0.5], [0, -0.06]],
    square: [[0, 0.08], [-0.5, 0.42], [-0.46, 0], [-0.5, -0.42], [0, -0.08]],
    crescent: [[0, 0.05], [-0.22, 0.3], [-0.42, 0.8], [-0.3, 0.26], [-0.24, 0], [-0.3, -0.26], [-0.42, -0.8], [-0.22, -0.3], [0, -0.05]],
    round: [[0, 0.08], [-0.3, 0.38], [-0.5, 0.22], [-0.54, 0], [-0.5, -0.22], [-0.3, -0.38], [0, -0.08]],
  };
  const raw = shapes[look.tail];
  if (!raw) return null;
  const k = look.tailSize * L * 1.25;
  const x0 = -L / 2 + 0.04 * L;
  return new THREE.ShapeGeometry(new THREE.Shape(raw.map(([a, b]) => new THREE.Vector2(x0 + a * k, b * k))));
}

/** A small fin on each side behind the head. */
function pectoral(look: FishLook, L: number, side: 1 | -1): THREE.BufferGeometry {
  const t = look.eel ? 0.9 : 0.74;
  const x0 = (t - 0.5) * L;
  const y0 = -topAt(look, L, t) * 0.35;
  const z0 = side * (look.width * L) / 2 * thickness(look, t) * 0.85;
  const s = look.eel ? 0.04 : 0.1;
  const v = [
    x0, y0 + 0.02 * L, z0,
    x0 - s * L, y0 - 0.02 * L, z0 + side * s * 0.55 * L,
    x0 - s * 0.6 * L, y0 - 0.05 * L, z0 + side * s * 0.25 * L,
    x0, y0 + 0.02 * L, z0,
    x0 - s * 0.6 * L, y0 - 0.05 * L, z0 + side * s * 0.25 * L,
    x0, y0 - 0.02 * L, z0,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

function eyes(look: FishLook, L: number, state: FishState): THREE.Mesh[] {
  const t = look.eel ? 0.94 : look.bill ? 0.84 : 0.86;
  const r = (look.eel ? 0.02 : look.length < 0.2 ? 0.06 : 0.045) * L * (look.bill ? 0.7 : 1);
  const x = (t - 0.5) * L;
  const y = topAt(look, L, t) * 0.28;
  const zz = (look.width * L) / 2 * thickness(look, t) * 0.9;
  const cooked = state === "grilled" || state === "fried";
  const out: THREE.Mesh[] = [];
  for (const side of [1, -1]) {
    const ring = new THREE.SphereGeometry(r, 8, 6);
    ring.scale(1, 1, 0.45);
    ring.translate(x, y, side * zz);
    out.push(new THREE.Mesh(ring, mat(cooked ? 0xf2efe6 : look.eye, { roughness: 0.3 })));
    const pupil = new THREE.SphereGeometry(r * 0.55, 6, 5);
    pupil.scale(1, 1, 0.4);
    pupil.translate(x + r * 0.05, y, side * (zz + r * 0.32));
    out.push(new THREE.Mesh(pupil, mat(cooked ? 0xd8d2c4 : 0x0c0c10, { roughness: 0.15 })));
  }
  return out;
}

export interface FishOptions {
  seed?: number;
  state?: FishState;
}

/** Make a fish. Its size in metres is real (a tuna is 1.8 m), so scale it for icons. */
export function createFish(kind: FishId, opts: FishOptions = {}): Showpiece & { length: number } {
  const rng = makeRng(opts.seed ?? 1);
  const look = FISH_LOOKS[kind];
  const state = opts.state ?? "swim";
  const L = look.length * (0.9 + rng() * 0.2);
  const cooked = state === "grilled" || state === "fried";
  const finColor = cooked ? (state === "fried" ? 0x9a5a1e : 0x6e4320) : look.fin;
  const finMat = mat(finColor, { double: true, roughness: 0.7 });

  const parts: THREE.Mesh[] = [buildBody(look, L, state, rng)];
  for (const f of look.dorsal) parts.push(new THREE.Mesh(finShape(look, L, f, 1), finMat));
  if (look.anal) parts.push(new THREE.Mesh(finShape(look, L, look.anal, -1), finMat));
  const tail = tailShape(look, L);
  if (tail) parts.push(new THREE.Mesh(tail, finMat));
  parts.push(new THREE.Mesh(pectoral(look, L, 1), finMat), new THREE.Mesh(pectoral(look, L, -1), finMat));
  if (look.finlets) {
    const fl = cooked ? finMat : mat(0xf0c030, { double: true });
    for (let i = 0; i < look.finlets; i++) {
      const t = 0.1 + i * 0.04;
      for (const up of [1, -1] as const) {
        const x = (t - 0.5) * L;
        const y = up * topAt(look, L, t) * 0.85;
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute([x + 0.012 * L, y, 0, x - 0.016 * L, y + up * 0.03 * L, 0, x - 0.012 * L, y, 0], 3));
        g.computeVertexNormals();
        parts.push(new THREE.Mesh(g, fl));
      }
    }
  }
  if (look.bill) {
    const len = look.bill * L;
    const g = new THREE.ConeGeometry(0.022 * L, len, 6);
    g.rotateZ(-Math.PI / 2);
    g.translate(L / 2 + len / 2 - 0.03 * L, -0.005 * L, 0);
    parts.push(new THREE.Mesh(g, mat(cooked ? 0x5e3a1c : 0x45425e, { roughness: 0.5 })));
  }
  parts.push(...eyes(look, L, state));

  const body = new THREE.Group(); // the bending fish, in its own space (nose along +X)
  for (const p of parts) {
    p.castShadow = true;
    p.receiveShadow = true;
    body.add(p);
  }
  // Remember where every corner started, so the whole fish can bend as one.
  const bendables = parts.map((p) => {
    const a = p.geometry.attributes.position as THREE.BufferAttribute;
    return { attr: a, base: Float32Array.from(a.array as Float32Array) };
  });
  let bendPhase = 0;
  function bend(amp: number, waves: number, curl = 0) {
    for (const { attr, base } of bendables) {
      const arr = attr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const xn = Math.min(1.4, Math.max(0, (L / 2 - base[i]) / L)); // 0 at the nose, 1 at the tail
        const w = look.eel ? 0.25 + 0.75 * xn : xn * xn;
        arr[i + 2] = base[i + 2] + amp * L * w * Math.sin(xn * waves * Math.PI * 2 - bendPhase) + curl * L * (xn - 0.4) * (xn - 0.4);
      }
      attr.needsUpdate = true;
    }
  }

  // The holder: turns the fish to lie on its side when it's out of the water.
  const object = new THREE.Group();
  object.name = `fish-${kind}`;
  const holder = new THREE.Group();
  object.add(holder);
  holder.add(body);
  const lying = state !== "swim";
  const halfWidth = (look.width * L) / 2;
  if (lying) {
    holder.rotation.x = Math.PI / 2; // back toward you, belly away
    holder.position.y = halfWidth * 0.85;
  }

  let parts2: { object: THREE.Object3D; update: (t: number) => void } | null = null;
  if (cooked) {
    parts2 = steam(rng, L * 0.3, halfWidth * 2, 6, L * 0.5);
    object.add(parts2.object);
  }

  // Swimming and flopping.
  let dart = 0;
  let hopT = -1;
  let nextHop = 0.8 + rng() * 1.5;
  let hopSide = 1;
  const stage: Stage = state === "swim" ? "tank" : cooked ? "plate" : "board";

  return {
    object,
    stage,
    length: L,
    update(dt, time) {
      if (state === "swim") {
        dart = Math.max(0, dart - dt * 0.9);
        const speed = (look.eel ? 4.5 : 7) * (1 + dart * 1.8);
        bendPhase += dt * speed;
        bend((look.eel ? 0.07 : 0.05) * (1 + dart * 0.8), look.eel ? 1.6 : 0.8);
        holder.position.y = Math.sin(time * 1.1) * 0.03 * L;
        holder.position.x = Math.sin(Math.min(1, dart) * Math.PI) * 0.15 * L;
        holder.rotation.y = Math.sin(bendPhase) * 0.04;
      } else if (state === "caught") {
        nextHop -= dt;
        if (hopT < 0 && nextHop <= 0) {
          hopT = 0;
          hopSide = -hopSide;
        }
        if (hopT >= 0) {
          hopT += dt / 0.55;
          const s = Math.min(1, hopT);
          const up = Math.sin(Math.PI * s);
          holder.position.y = halfWidth * 0.85 + up * 0.22 * L;
          holder.rotation.z = up * 0.25 * hopSide;
          bendPhase += dt * 16;
          bend(0.05 * up, 0.6, 0.55 * up * hopSide);
          if (s >= 1) {
            hopT = -1;
            nextHop = 1.2 + rng() * 2.2;
          }
        } else {
          // Resting: gills and tail twitch a little.
          bendPhase += dt * 3;
          bend(0.012, 0.5);
          holder.position.y = halfWidth * 0.85;
          holder.rotation.z = 0;
        }
      } else {
        parts2?.update(time);
      }
    },
    poke() {
      if (state === "swim") dart = 1.4;
      else if (state === "caught") nextHop = 0;
    },
    dispose: () => disposeAll(object),
  };
}
