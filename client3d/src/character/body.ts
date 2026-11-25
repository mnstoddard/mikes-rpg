// Builds the smooth character from a recipe: body, face, painted eyes, hair,
// beard, hat, glasses and clothes, on a skeleton of joints (groups) that the
// animations turn.
//
// Ported from the Character Workshop (project files: character-creator/).
// It also returns `fit`: the body's measurements, so armor and other worn
// things can be shaped to fit any body.
import * as THREE from "three";
import type { CharacterRecipe } from "./recipe";
import { drape } from "./drape";
import {
  HeadShape, V3, hash, YV, ZV, ball, clamp, dirN, headPoint, lerp, limbGeo, mixHex, ringsGeo, shellGeo, sm,
} from "./shapes";

/** The character's joints. Rotate these to pose it; add things to them to make them move with it. */
export interface Joints {
  hips: THREE.Group;
  spine: THREE.Group;
  head: THREE.Group;
  /** The skull: the head's centre. Helmets and hats go here. */
  skull: THREE.Group;
  shL: THREE.Group; shR: THREE.Group;
  elL: THREE.Group; elR: THREE.Group;
  /** At the palm of each hand. Things held go here (L is the character's left, at +X). */
  handL: THREE.Group; handR: THREE.Group;
  hipL: THREE.Group; hipR: THREE.Group;
  kneeL: THREE.Group; kneeR: THREE.Group;
  ankL: THREE.Group; ankR: THREE.Group;
  /** Ponytail / pigtail pivots (they swing). */
  tails: THREE.Group[];
  eyes: { m: THREE.MeshStandardMaterial; open: THREE.Texture; shut: THREE.Texture }[];
  /** Height of the hips when standing (the hips bob from here). */
  hipsY: number;
  /** How far the arms hang out from the sides at rest (radians). */
  rest: number;
  /** The hair and hat meshes (hidden under a helmet). */
  hair: THREE.Object3D[];
}

/** The body's measurements (metres). Everything worn is shaped from these. */
export interface Fit {
  height: number;
  /** Torso, from the spine joint (waist) up. */
  T: number;
  shW: number; waW: number; hipW: number; midW: number;
  chD: number; waD: number; hipD: number; midD: number;
  /** Bust forward (0 for a masculine frame). */
  bust: number;
  neckR: number;
  armX: number; upR: number; foR: number; upLen: number; foLen: number; handR: number;
  thighR: number; shinR: number; thighL: number; shinL: number; footH: number; footLen: number; footW: number;
  /** The head surface and its size. */
  H: HeadShape; R: number;
  build: number; frame: number;
}

export interface BuiltBody { root: THREE.Group; J: Joints; fit: Fit; dispose: () => void }

// The shapes the character is made of. Kept apart so others can reuse them.
// (Painted cartoon eyes: drawn on a canvas, then wrapped onto the face like a sticker.)
const shadeHex = (h: string, k: number) => {
  const c = new THREE.Color(h);
  return "#" + (k < 0 ? c.lerp(new THREE.Color(0), -k) : c.lerp(new THREE.Color(0xffffff), k)).getHexString();
};

interface EyeShape {
  e?: number; W?: number; H?: number; ir?: number; sparkle?: number; lid?: number;
  iy?: number; oy?: number; t1?: number; t2?: number; b1?: number; b2?: number; wing?: number;
  dots?: number; happy?: number;
}
const EYE_SHAPES: Record<string, EyeShape> = {
  classic: { e: 1, W: 56, H: 62, ir: 0.66 }, big: { e: 1, W: 60, H: 68, ir: 0.8, sparkle: 1 }, wide: { e: 1, W: 58, H: 74, ir: 0.58 },
  sleepy: { e: 1, W: 56, H: 62, ir: 0.66, lid: 1 },
  almond: { W: 68, H: 40, iy: 6, oy: -4, t1: 1.5, t2: 1.3, b1: 0.95, b2: 0.95, ir: 0.95 },
  cat: { W: 68, H: 38, iy: 12, oy: -20, t1: 1.45, t2: 1.15, b1: 1.0, b2: 0.6, ir: 0.95, wing: 1 },
  gentle: { W: 64, H: 42, iy: -6, oy: 16, t1: 1.25, t2: 1.5, b1: 0.85, b2: 0.75, ir: 0.95 },
  narrow: { W: 64, H: 44, iy: 2, oy: -4, t1: 0.5, t2: 0.6, b1: 1.3, b2: 1.25, ir: 0.8 },
  dots: { dots: 1 }, happy: { happy: 1 },
};

/** Painted cartoon eyes (the Character Workshop's ten eye shapes), wrapped onto the face like a sticker. */
function paintEye(P: CharacterRecipe, s: number, closed: boolean) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d")!;
  const cx = 128, cy = 128, ink = "#2b1d20";
  x.lineCap = "round";
  x.lineJoin = "round";
  const S = EYE_SHAPES[P.eyeStyle] || EYE_SHAPES.classic;
  const ell = (rx: number, ry: number, dx = 0, dy = 0) => {
    x.beginPath();
    x.ellipse(cx + dx, cy + dy, rx, ry, 0, 0, Math.PI * 2);
  };
  if (S.happy || (closed && !S.dots)) {
    const W = S.W || 56;
    x.strokeStyle = ink;
    x.lineWidth = 11;
    x.beginPath();
    if (S.happy) { x.moveTo(cx - W * 0.85, cy + 16); x.quadraticCurveTo(cx, cy - 38, cx + W * 0.85, cy + 16); }
    else { x.moveTo(cx - W * 0.95, cy + 2); x.quadraticCurveTo(cx, cy + 28, cx + W * 0.95, cy + 2); }
    x.stroke();
    if (P.lashes === "on") {
      x.lineWidth = 7;
      x.beginPath();
      const ox = cx + s * W * 0.88, oy = S.happy ? cy + 10 : cy + 4;
      x.moveTo(ox, oy);
      x.lineTo(ox + s * 16, oy - (S.happy ? 2 : 10));
      x.stroke();
    }
    return c;
  }
  if (closed && S.dots) {
    x.strokeStyle = ink; x.lineWidth = 9; x.beginPath();
    x.moveTo(cx - 24, cy + 4); x.quadraticCurveTo(cx, cy + 16, cx + 24, cy + 4); x.stroke();
    return c;
  }
  if (S.dots) {
    ell(30, 40); x.fillStyle = ink; x.fill();
    x.fillStyle = "#fff"; ell(10, 12, 9, -14); x.fill(); ell(5, 5, -9, 16); x.fill();
    return c;
  }
  const W = S.W!, Hh = S.H!;
  let outline: () => void, top: () => void, iy = cy + 6, ir: number, iry: number;
  const ix = cx;
  if (S.e) {
    outline = () => ell(W, Hh);
    top = () => { x.beginPath(); x.ellipse(cx, cy, W, Hh, 0, Math.PI * 1.05, Math.PI * 1.95); };
    ir = W * S.ir!; iry = ir * 1.18;
  } else {
    const I = [cx - s * W, cy + S.iy!], O = [cx + s * W, cy + S.oy!];
    const tp = () => { x.moveTo(I[0], I[1]); x.bezierCurveTo(cx - s * W * 0.55, cy - Hh * S.t1!, cx + s * W * 0.5, cy - Hh * S.t2!, O[0], O[1]); };
    outline = () => { x.beginPath(); tp(); x.bezierCurveTo(cx + s * W * 0.5, cy + Hh * S.b2!, cx - s * W * 0.55, cy + Hh * S.b1!, I[0], I[1]); x.closePath(); };
    top = () => { x.beginPath(); tp(); };
    ir = Hh * S.ir!; iry = ir; iy = cy + (S.iy! + S.oy!) * 0.25 + 2;
  }
  outline(); x.fillStyle = "#fffdf8"; x.fill();
  x.save(); outline(); x.clip();
  const g = x.createLinearGradient(0, iy - iry, 0, iy + iry);
  g.addColorStop(0, shadeHex(P.eyeColor, -0.5)); g.addColorStop(0.5, P.eyeColor); g.addColorStop(1, shadeHex(P.eyeColor, 0.4));
  x.beginPath(); x.ellipse(ix, iy, ir, iry, 0, 0, Math.PI * 2); x.fillStyle = g; x.fill();
  x.beginPath(); x.ellipse(ix, iy, ir * 0.5, iry * 0.52, 0, 0, Math.PI * 2); x.fillStyle = ink; x.fill();
  // A soft shadow under the upper lid.
  const sh = x.createLinearGradient(0, cy - Hh, 0, cy - Hh * 0.3);
  sh.addColorStop(0, "rgba(40,20,20,0.35)"); sh.addColorStop(1, "rgba(40,20,20,0)");
  x.fillStyle = sh; x.fillRect(0, 0, 256, cy);
  if (S.lid) { x.fillStyle = shadeHex(P.skin, -0.08); x.fillRect(cx - W - 4, cy - Hh - 4, W * 2 + 8, Hh + 2); }
  x.restore();
  const hy = S.lid ? 14 : 0;
  x.fillStyle = "#fff";
  ell(ir * 0.3, ir * 0.32, ix - cx + ir * 0.35, iy - cy - iry * 0.38 + hy); x.fill();
  ell(ir * 0.13, ir * 0.13, ix - cx - ir * 0.35, iy - cy + iry * 0.42); x.fill();
  if (S.sparkle) { ell(ir * 0.09, ir * 0.09, ix - cx + ir * 0.05, iy - cy - iry * 0.6 + hy); x.fill(); }
  x.strokeStyle = ink; x.lineWidth = 9;
  if (S.lid) { x.beginPath(); x.moveTo(cx - W, cy + 1); x.quadraticCurveTo(cx, cy + 8, cx + W, cy + 1); x.stroke(); }
  else { top(); x.stroke(); }
  if (S.wing) { x.beginPath(); x.moveTo(cx + s * W * 0.9, cy + S.oy! + 1); x.lineTo(cx + s * (W + 20), cy + S.oy! - 12); x.stroke(); }
  if (!S.lid) { x.lineWidth = 3; x.globalAlpha = 0.3; outline(); x.stroke(); x.globalAlpha = 1; }
  if (P.lashes === "on") {
    x.strokeStyle = ink; x.lineWidth = 7;
    for (let k = 0; k < 3; k++) {
      let px: number, py: number;
      if (S.e) { const a = (S.lid ? 0.03 : -0.42) - k * 0.28; px = cx + s * Math.cos(a) * W * 0.98; py = cy + Math.sin(a) * (S.lid ? 6 : Hh) * 0.98; }
      else { px = cx + s * W * (0.95 - k * 0.22); py = cy + S.oy! - k * (Hh * 0.35) - 4; }
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + s * (15 - k * 3), py - 13 + k * 2); x.stroke();
    }
  }
  return c;
}

/** Painted mouths: filled, tapered shapes instead of a thin line. */
function paintMouth(P: CharacterRecipe) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d")!;
  const cx = 128, cy = 118;
  const hw = 74 * P.mouthWidth, ink = "#5a1f26", lipShade = shadeHex(P.skin, -0.22);
  x.lineCap = "round"; x.lineJoin = "round";
  type F = (u: number) => number;
  const band = (yFn: F, wFn: F, x0 = -1, x1 = 1, fill = ink) => {
    const N = 40, up: number[][] = [], dn: number[][] = [];
    for (let i = 0; i <= N; i++) {
      const u = lerp(x0, x1, i / N), px = cx + u * hw, y = yFn(u), w = wFn(u);
      up.push([px, y - w / 2]); dn.push([px, y + w / 2]);
    }
    x.beginPath(); x.moveTo(up[0][0], up[0][1]);
    up.forEach((p) => x.lineTo(p[0], p[1]));
    dn.reverse().forEach((p) => x.lineTo(p[0], p[1]));
    x.closePath(); x.fillStyle = fill; x.fill();
  };
  const taper = (m: number, lo = 2): F => (u) => lo + m * Math.pow(Math.max(0, 1 - u * u), 0.8);
  const lipHint = (yFn: F, k = 1) => {
    x.strokeStyle = lipShade; x.globalAlpha = 0.5; x.lineWidth = 7; x.beginPath();
    for (let i = 0; i <= 20; i++) {
      const u = lerp(-0.45, 0.45, i / 20), y = yFn(u) + 16 * k;
      if (i) x.lineTo(cx + u * hw, y); else x.moveTo(cx + u * hw, y);
    }
    x.stroke(); x.globalAlpha = 1;
  };
  const dot = (px: number, py: number) => { x.fillStyle = ink; x.beginPath(); x.arc(px, py, 3.2, 0, Math.PI * 2); x.fill(); };
  const ex = P.mouth;
  if (ex === "smile") { const y: F = (u) => cy + 18 - 26 * u * u; band(y, taper(21, 5)); lipHint(y); dot(cx + hw * 1.02, cy - 10); dot(cx - hw * 1.02, cy - 10); }
  else if (ex === "neutral") { const y: F = (u) => cy + 4 + 3 * u * u; band(y, taper(13, 4), -0.72, 0.72); lipHint(y, 1.1); }
  else if (ex === "frown") { const y: F = (u) => cy - 2 + 22 * u * u; band(y, taper(16, 4), -0.9, 0.9); lipHint(y, 1.1); }
  else if (ex === "smirk") {
    const y: F = (u) => cy + 10 + 8 * u * u - 18 * Math.max(0, u) * u;
    band(y, (u) => 4 + 15 * Math.pow(Math.max(0, 1 - ((u + 0.15) / 1.15) ** 2), 0.8), -0.85, 1);
    dot(cx + hw * 1.03, cy + 1); lipHint(y);
  } else if (ex === "oh") {
    x.beginPath(); x.ellipse(cx, cy + 8, hw * 0.36, 34, 0, 0, Math.PI * 2); x.fillStyle = ink; x.fill();
    x.save(); x.clip(); x.fillStyle = "#e0727c"; x.beginPath(); x.ellipse(cx, cy + 40, hw * 0.3, 18, 0, 0, Math.PI * 2); x.fill(); x.restore();
  } else {
    // Grin: an open D-shaped mouth with teeth and a tongue.
    const topY: F = (u) => cy - 14 + 8 * u * u, botY: F = (u) => cy - 14 + 62 * Math.pow(1 - u * u, 1.1) + 8 * u * u;
    const shape = () => {
      x.beginPath();
      for (let i = 0; i <= 30; i++) { const u = lerp(-1, 1, i / 30); if (i) x.lineTo(cx + u * hw, topY(u)); else x.moveTo(cx + u * hw, topY(u)); }
      for (let i = 30; i >= 0; i--) { const u = lerp(-1, 1, i / 30); x.lineTo(cx + u * hw, botY(u)); }
      x.closePath();
    };
    shape(); x.fillStyle = ink; x.fill();
    x.save(); shape(); x.clip();
    x.fillStyle = "#fffaf2"; x.fillRect(cx - hw, cy - 18, hw * 2, 20);
    x.fillStyle = "#e0727c"; x.beginPath(); x.ellipse(cx, cy + 46, hw * 0.55, 22, 0, 0, Math.PI * 2); x.fill();
    x.restore();
    x.strokeStyle = ink; x.lineWidth = 4; shape(); x.stroke(); lipHint(botY, 0.55);
  }
  return c;
}

/** A copy of the head surface with texture coordinates centred on one eye. */
function eyeDecalGeo(H: HeadShape, e: THREE.Vector3, span: number, tilt: number) {
  const tx = new V3().crossVectors(YV, e).normalize(), ty = new V3().crossVectors(e, tx);
  const c = Math.cos(tilt), sn = Math.sin(tilt);
  const ax = tx.clone().multiplyScalar(c).addScaledVector(ty, sn), ay = ty.clone().multiplyScalar(c).addScaledVector(tx, -sn);
  const N = 28, pos: number[] = [], uvs: number[] = [], idx: number[] = [], d = new V3(), o = new V3();
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) {
      const u = i / N, v = j / N;
      const a = (u - 0.5) * 2 * span, b = (v - 0.5) * 2 * span;
      d.copy(e).addScaledVector(ax, a).addScaledVector(ay, b).normalize();
      headPoint(d, H, o).multiplyScalar(1.004);
      pos.push(o.x, o.y, o.z);
      uvs.push(u, v);
    }
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, c2 = a + N + 1, d2 = c2 + 1;
      idx.push(a, b, d2, a, d2, c2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const soft = (d: THREE.Vector3) => 0.5 + 0.5 * Math.sin(d.x * 11 + 1.3) * Math.sin(d.y * 9 + 0.7) * Math.sin(d.z * 12 + 2.1);
const edge = (g: number, X: number) => (g >= -0.03 ? X * sm(-0.03, 0.06, g) - 0.01 : (g + 0.03) * 1.5 - 0.01);
type ShellFn = ((d: THREE.Vector3, off: THREE.Vector3, cc: { c: number }) => number) | null;

/**
 * Hair clumps: the angle around a point on the head (the crown, or a ponytail tie), split into n locks.
 * Returns how close d is to the middle of a lock (1) or the groove between locks (0), and which lock.
 */
function grooves(d: THREE.Vector3, axis: THREE.Vector3, n: number, noise: number, seed: number): [number, number] {
  const e1 = new V3().crossVectors(axis, Math.abs(axis.y) < 0.9 ? YV : new V3(1, 0, 0)).normalize(), e2 = new V3().crossVectors(axis, e1);
  const u = d.clone().addScaledVector(axis, -d.dot(axis));
  let ph = Math.atan2(u.dot(e2), u.dot(e1));
  ph += noise * Math.sin(ph * 2 + seed);
  const x = (ph / (2 * Math.PI) + 0.5) * n, k = ((Math.floor(x) % n) + n) % n, f = x - Math.floor(x);
  const fade = sm(0.08, 0.45, u.length());
  return [lerp(0.75, Math.pow(0.5 - 0.5 * Math.cos(2 * Math.PI * f), 0.75), fade), k];
}

/** Soft, clumped hair (the Workshop's newest look): locks with grooves between them, shaded by vertex colour. */
function hairStyles(P: CharacterRecipe, R: number): Record<CharacterRecipe["hairStyle"], ShellFn> {
  const bangs = P.bangs, L = P.hairLength, front = 0.46 - bangs * 0.4;
  const hl = (d: THREE.Vector3) => (d.z >= 0 ? lerp(0.1, front, sm(0, 1, d.z)) : lerp(0.1, -0.5, sm(0, 1, -d.z)));
  const C = dirN(0, 0.72, -0.69), FRONT = dirN(0, 0.3, 0.95);
  const faceZone = (d: THREE.Vector3) => d.z > 0.42 && d.y < front + 0.02;
  const shadeOf = (r: number, k: number, cc: { c: number }, lo = 0.68) => { cc.c = (lo + (1.06 - lo) * r) * (0.9 + 0.2 * hash(k, 3, 7)); };
  const shortFn = (n: number, noise: number, lumpy: boolean): ShellFn => (d, _off, cc) => {
    const [r, k] = grooves(d, C, n, noise, 1.7);
    const hv = hash(k, 1, 2);
    const reach = 0.07 * r * (d.z > 0.3 ? 1 + bangs : 1) * (0.7 + 0.6 * hv);
    const t = 0.035 + 0.035 * Math.max(0, d.y) + (0.04 + 0.025 * hv) * r + 0.035 * bangs * Math.max(0, d.z) * sm(0.15, 0.45, d.y)
      + (lumpy ? (0.06 + 0.08 * L) * r * r * hv * sm(0.15, 0.8, d.y) : 0);
    shadeOf(r, k, cc);
    return edge(d.y - (hl(d) - reach), t);
  };
  const tightFn = (axis: THREE.Vector3): ShellFn => (d, _off, cc) => {
    const [r, k] = grooves(d, axis, 34, 0.05, 2.3);
    shadeOf(r, k, cc, 0.78);
    return edge(d.y - (hl(d) - 0.03 * r), 0.035 + 0.022 * r);
  };
  const pigL = tightFn(dirN(0.82, 0.22, -0.45))!, pigR = tightFn(dirN(-0.82, 0.22, -0.45))!;
  return {
    bald: null,
    buzz: (d) => edge(d.y - (hl(d) + 0.04), 0.022),
    short: shortFn(22, 0.08, false), spiky: shortFn(15, 0.12, true), messy: shortFn(17, 0.25, false),
    ponytail: tightFn(dirN(0, 0.35, -0.94)), bun: tightFn(dirN(0, 0.62, -0.78)),
    pigtails: (d, off, cc) => (d.x >= 0 ? pigL : pigR)(d, off, cc),
    quiff: (d, _off, cc) => {
      const [r, k] = grooves(d, FRONT, 24, 0.08, 0.9);
      const hv = hash(k, 4, 1);
      shadeOf(r, k, cc);
      return edge(d.y - (hl(d) - 0.04 * r), 0.04 + 0.03 * Math.max(0, d.y) + (0.035 + 0.02 * hv) * r + 0.26 * sm(0.2, 0.85, d.z) * sm(0.25, 0.75, d.y));
    },
    bob: (d, off, cc) => {
      const [r, k] = grooves(d, C, 30, 0.08, 0.4);
      shadeOf(r, k, cc);
      const lim = -0.66 - 0.07 * r;
      const vis = d.y > hl(d) - 0.04 * r || (!faceZone(d) && d.y > lim && !(d.y < -0.45 && d.z > 0.12));
      if (!vis) return -1;
      off.x += d.x * R * 0.14 * Math.max(0, -d.y);
      return 0.06 + 0.045 * r + 0.02 * Math.max(0, d.y);
    },
    long: (d, off, cc) => {
      const [r, k] = grooves(d, C, 30, 0.1, 0.4);
      shadeOf(r, k, cc);
      const hv = hash(k, 5, 5);
      const vis = d.y > hl(d) - 0.04 * r || (!faceZone(d) && !(d.y < -0.4 && d.z > 0.1));
      if (!vis) return -1;
      if (d.y < 0.15 && d.z < 0.42) {
        const kk = sm(0.15, -1, d.y) * (d.z < 0 ? 1 : lerp(1, 0.45, d.z / 0.42));
        off.y -= R * (0.5 + 2.6 * L) * kk * (0.86 + 0.14 * r) * (0.95 + 0.1 * hv);
        off.x += Math.sign(d.x) * R * 0.28 * kk * Math.abs(d.x);
        off.z -= R * 0.2 * kk;
      }
      return 0.055 + 0.05 * r;
    },
    mohawk: (d, _off, cc) => {
      const [r, k] = grooves(d, dirN(0, -0.3, -1), 14, 0.03, 0.2);
      shadeOf(r, k, cc, 0.8);
      return Math.abs(d.x) < 0.22 && d.y > Math.max(-0.45, hl(d) - (d.z > 0.3 ? -0.03 : 0.15))
        ? 0.04 + (0.14 + 0.22 * L) * sm(-0.45, 0.45, d.y) * (0.85 + 0.15 * r) * sm(0.22, 0.08, Math.abs(d.x))
        : -1;
    },
    afro: (d) => edge(d.y - (hl(d) - 0.06), 0.28 + 0.14 * L + 0.08 * soft(d)),
  };
}

export interface BuildOptions {
  /** Leave out the hair and hat (for helmets and hoods). Beards stay. */
  hideHair?: boolean;
  /** How finely the head, hair and beard are shaped: 1 (the default) is full detail; statues use less. */
  detail?: number;
}

export function buildBody(P: CharacterRecipe, opts: BuildOptions = {}): BuiltBody {
  const disposables: { dispose(): void }[] = [];
  const det = opts.detail ?? 1;
  const shell = (w: number, h: number, fn: ShellFn, withColor = false) =>
    det === 1 ? shellGeo(H, w, h, fn, withColor) : shellGeo(H, Math.max(16, Math.round(w * det)), Math.max(12, Math.round(h * det)), fn, withColor);
  const M = (hex: string, o: { r?: number; m?: number; side?: THREE.Side; op?: number; em?: string; ei?: number } = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: o.r ?? 0.68, metalness: o.m ?? 0, side: o.side ?? THREE.FrontSide });
    if (o.op !== undefined) {
      m.transparent = true;
      m.opacity = o.op;
      m.depthWrite = false;
    }
    if (o.em) {
      m.emissive = new THREE.Color(o.em);
      m.emissiveIntensity = o.ei ?? 0.25;
    }
    disposables.push(m);
    return m;
  };
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, shadow = true) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(x, y, z);
    o.castShadow = shadow;
    o.receiveShadow = true;
    parent.add(o);
    disposables.push(geo);
    return o;
  };
  const G = (parent: THREE.Object3D | null, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    if (parent) parent.add(g);
    return g;
  };

  const root = new THREE.Group();
  const J = { tails: [], eyes: [], hair: [] } as unknown as Joints;
  const fem = P.frame, S = P.height, bw = P.build, mu = P.muscle;
  const skin = M(P.skin), shirt = M(P.shirtColor), pants = M(P.pantsColor), shoe = M(P.shoeColor, { r: 0.65 }), acc = M(P.accentColor),
    hairM = M(P.hairColor, { r: 0.9 }), gold = M("#e2b33c", { r: 0.35, m: 0.55, em: "#6b4a00", ei: 0.3 }), dark = M("#1d1517", { r: 0.35 }),
    white = M("#ffffff", { r: 0.3 }), mouthM = M("#5a2424", { r: 0.6 }),
    stub = M(mixHex(P.hairColor, P.skin, 0.5), { r: 1 });
  const top = P.top, bottom = P.bottom;
  const longSleeve = top === "long" || top === "tunic" || top === "robe";
  const sleeveM = top === "tank" ? skin : shirt, foreM = longSleeve ? shirt : skin;
  const thighM = bottom === "skirt" ? skin : pants, shinM = bottom === "pants" ? pants : skin;

  const thighL = 0.41 * S * P.legs, shinL = 0.39 * S * P.legs, footH = 0.055;
  const torsoH = 0.5 * S;
  const shW = (0.205 - 0.04 * fem) * P.shoulders * (1 + 0.12 * mu) + 0.025 * bw;
  const hipW = (0.125 + 0.035 * fem) * P.hips + 0.045 * bw;
  const waW = 0.125 - 0.018 * fem + 0.08 * bw + 0.01 * mu;
  const chD = 0.1 + 0.025 * mu + 0.035 * bw, waD = 0.085 + 0.075 * bw, hipD = 0.1 + 0.02 * fem + 0.035 * bw;
  const neckR = 0.042 + 0.012 * mu + 0.012 * bw - 0.006 * fem;
  const thighR = 0.066 + 0.035 * bw + 0.018 * mu + 0.01 * fem, shinR = thighR * 0.7;
  const upR = 0.04 + 0.018 * mu + 0.016 * bw - 0.006 * fem, foR = upR * 0.84;
  const upLen = 0.26 * S, foLen = 0.24 * S, handR = foR * 1.25;
  const bust = 0.045 * fem * (1 + 0.4 * bw);

  const hipsY = thighL + shinL + footH;
  // Leg sizes for robes and skirts that bend around the legs (the feet are filled in below).
  const fitLegs = { thighR, shinR, footH, footLen: 0.17, footW: shinR * 1.5 + 0.03 };
  const hips = G(root, 0, hipsY, 0);
  J.hips = hips;
  J.hipsY = hipsY;
  const midW = lerp(hipW, waW, 0.5), midD = lerp(hipD, waD, 0.5);
  add(hips, ringsGeo([{ y: -0.075, rx: hipW * 0.5, rz: hipD * 0.55 }, { y: -0.02, rx: hipW * 0.93, rz: hipD * 0.93 }, { y: 0.05, rx: hipW, rz: hipD }, { y: 0.12, rx: midW, rz: midD }]), top === "robe" ? shirt : pants);

  // Skirts, tunic and robe hems hanging from the hips.
  // They bend out around the legs as they move (see drape.ts), so a stride doesn't poke through.
  const hem = (len: number, flare: number, mat: THREE.MeshStandardMaterial) => {
    const m = add(hips, new THREE.CylinderGeometry(hipW * 1.07, hipW * flare, len, 40, 10, true), mat, 0, 0.12 - len / 2, 0);
    m.scale.z = Math.max(0.75, (hipD / hipW) * 1.12);
    mat.side = THREE.DoubleSide;
    drape([m], J, fitLegs, { top: 0.12, bottom: 0.12 - len, rTop: hipW * 1.07, rBottom: hipW * flare, zs: m.scale.z });
    return m;
  };
  if (top === "robe") hem(0.12 + hipsY - 0.06, 2.1, shirt);
  else {
    if (bottom === "skirt") hem(0.12 + thighL * 0.82, 1.6, pants);
    if (top === "tunic") hem(0.12 + thighL * 0.45, 1.42, shirt);
  }
  if (P.belt === "on") {
    const k = top === "tunic" || top === "robe" ? 1.09 : 1.05;
    add(hips, ringsGeo([{ y: 0.095, rx: midW * k, rz: midD * k }, { y: 0.15, rx: midW * k, rz: midD * k }], 32), acc);
    add(hips, new THREE.BoxGeometry(0.05, 0.045, 0.014), gold, 0, 0.122, midD * k + 0.006);
  }

  // Spine and chest.
  const spine = G(hips, 0, 0.12, 0);
  J.spine = spine;
  const T = torsoH - 0.12;
  add(spine, ringsGeo([{ y: 0, rx: midW, rz: midD }, { y: T * 0.3, rx: waW, rz: waD }, { y: T * 0.62, rx: shW * 0.84, rz: chD, bf: bust }, { y: T * 0.84, rx: shW * 0.95, rz: chD * 0.92 }, { y: T * 0.96, rx: shW * 0.6, rz: chD * 0.7 }, { y: T, rx: neckR * 1.5, rz: neckR * 1.35 }]), shirt);
  if (top === "robe" || top === "tunic") add(spine, ringsGeo([{ y: T * 0.93, rx: neckR * 2.0, rz: neckR * 1.8 }, { y: T * 1.0, rx: neckR * 1.65, rz: neckR * 1.5 }], 28), top === "robe" ? acc : shirt);

  // Arms.
  const armX = shW - upR * 0.45;
  const need = Math.max(hipW + 0.012, hipW * 0.48 + thighR) + handR * 0.9 + (top === "tunic" ? 0.03 : 0) + (top === "robe" ? 0.05 : 0);
  J.rest = Math.max(0.06, Math.asin(clamp((need - armX) / (upLen + foLen * 0.9), 0, 0.9))) + 0.02;
  for (const s of [1, -1]) {
    const n = s > 0 ? "L" : "R";
    const sh = G(spine, s * armX, T * 0.85, 0);
    J[("sh" + n) as "shL"] = sh;
    add(sh, ball(upR * 1.25, 8, 6), sleeveM);
    add(sh, limbGeo(upR, upR * 0.88, upLen), sleeveM);
    if (top === "tshirt") add(sh, limbGeo(upR * 1.12, upR * 1.08, upLen * 0.55), shirt);
    const el = G(sh, 0, -upLen, 0);
    J[("el" + n) as "elL"] = el;
    add(el, ball(upR * 0.88, 7, 5), foreM);
    add(el, limbGeo(foR, foR * 0.78, foLen), foreM);
    if (top === "robe") add(el, limbGeo(foR * 1.3, foR * 1.8, foLen * 0.85), shirt, 0, -foLen * 0.15, 0);
    const hand = add(el, ball(handR, 7, 5), skin, 0, -foLen - handR * 0.55, 0);
    hand.scale.set(0.82, 1.18, 0.7);
    J[("hand" + n) as "handL"] = G(el, 0, -foLen - handR * 0.55, 0);
  }

  // Neck and head.
  add(spine, limbGeo(neckR, neckR * 1.12, 0.1, 8), skin, 0, T + 0.07, 0);
  const head = G(spine, 0, T + 0.05, 0);
  J.head = head;
  const R = 0.16 * P.head;
  const H: HeadShape = { rx: R * 0.9 * P.faceWidth, ry: R * 1.02 * P.faceLength, rz: R * 0.97, jaw: P.jaw, chin: P.chin, cheeks: P.cheeks, square: P.square };
  const skull = G(head, 0, H.ry * 0.82 * Math.max(1, P.chin * 0.95), 0);
  J.skull = skull;
  add(skull, shell(56, 42, null), skin);
  const onHead = (parent: THREE.Object3D, d: THREE.Vector3, lift = 1, blend = 0.4) => {
    const p = headPoint(d, H, new V3()).multiplyScalar(lift);
    const g = G(parent, p.x, p.y, p.z);
    const nrm = p.clone().normalize().lerp(ZV, blend).normalize();
    g.quaternion.setFromUnitVectors(ZV, nrm);
    return g;
  };

  // Eyes and brows.
  const eR = R * 0.19 * P.eyeSize, eyeY = 0.04 + 0.12 * P.eyeHeight;
  for (const s of [1, -1]) {
    const ed = dirN(s * 0.33 * P.eyeSpacing, eyeY, 0.9);
    const mk = (closed: boolean) => {
      const t = new THREE.CanvasTexture(paintEye(P, s, closed));
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      disposables.push(t);
      return t;
    };
    const open = mk(false), shut = mk(true);
    const em = new THREE.MeshStandardMaterial({ map: open, emissiveMap: open, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.32, transparent: true, roughness: 0.28, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    disposables.push(em);
    const decal = add(skull, eyeDecalGeo(H, ed, 0.42 * P.eyeSize, s * P.eyeTilt * 0.3), em, 0, 0, 0, false);
    decal.renderOrder = 2;
    J.eyes.push({ m: em, open, shut });
    if (P.browThick > 0.05) {
      const bg = onHead(skull, dirN(s * 0.33 * P.eyeSpacing, eyeY + 0.2 + 0.06 * P.eyeSize, 0.9), 1.02, 0.3);
      bg.rotateZ(s * (P.browTilt * 0.38 + 0.06));
      add(bg, ball(0.5), hairM, 0, 0, 0, false).scale.set(eR * 1.8, R * 0.05 * P.browThick + 0.004, R * 0.05);
    }
  }
  // Nose.
  {
    const ng = onHead(skull, dirN(0, -0.2, 1), 0.98, 0.75);
    const z = P.noseSize;
    if (P.nose === "button") add(ng, ball(R * 0.12 * z, 7, 5), skin, 0, 0, R * 0.04).scale.set(1.1, 0.9, 0.9);
    else if (P.nose === "round") add(ng, ball(R * 0.17 * z, 8, 6), skin, 0, -R * 0.02, R * 0.05).scale.set(1.1, 0.95, 0.85);
    else if (P.nose === "small") add(ng, ball(R * 0.08 * z, 6, 4), skin, 0, 0, R * 0.03);
    else if (P.nose === "pointy") add(ng, new THREE.ConeGeometry(R * 0.11 * z, R * 0.32 * z, 16), skin, 0, -R * 0.03, R * 0.13 * z).rotation.x = Math.PI / 2;
    else add(ng, new THREE.ConeGeometry(R * 0.1 * z, R * 0.5 * z, 16), skin, 0, -R * 0.12 * z, R * 0.16 * z).rotation.x = 2.15;
  }
  // Mouth.
  {
    const mg = onHead(skull, dirN(0, -0.5, 0.86), 1, 0.6);
    const mt = new THREE.CanvasTexture(paintMouth(P));
    mt.colorSpace = THREE.SRGBColorSpace;
    mt.anisotropy = 4;
    disposables.push(mt);
    const mm = new THREE.MeshStandardMaterial({ map: mt, transparent: true, roughness: 0.55, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    disposables.push(mm);
    add(skull, eyeDecalGeo(H, dirN(0, -0.5, 0.86), 0.36, 0), mm, 0, 0, 0, false).renderOrder = 2;
    if (["mustache", "full", "wizard"].includes(P.beard))
      for (const s of [1, -1]) {
        const m = add(mg, ball(R * 0.13, 7, 5), hairM, s * R * 0.12, R * 0.13, R * 0.04);
        m.scale.set(1.5, 0.55, 0.6);
        m.rotation.z = s * 0.35;
      }
  }
  // Ears.
  for (const s of [1, -1]) {
    const p = headPoint(dirN(s, -0.04, -0.06), H, new V3()).multiplyScalar(0.96);
    const eg = G(skull, p.x, p.y, p.z);
    const z = P.earSize;
    if (P.ears === "round") {
      const e = add(eg, ball(R * 0.22 * z, 8, 6), skin);
      e.scale.set(0.38, 1, 0.68);
      e.rotation.y = s * -0.3;
    } else {
      const len = (P.ears === "elf" ? 0.95 : 0.55) * R * z;
      add(eg, ball(R * 0.18 * z, 7, 5), skin).scale.set(0.4, 1, 0.65);
      const dir = P.ears === "elf" ? dirN(s * 0.85, 0.45, -0.3) : dirN(s * 0.7, 0.62, -0.3);
      const c = add(eg, new THREE.ConeGeometry(R * 0.13 * z, len, 16), skin);
      c.quaternion.setFromUnitVectors(YV, dir);
      c.position.copy(dir).multiplyScalar(len * 0.42);
      c.scale.z = 0.45;
    }
  }
  if (P.blush === "on") {
    const bm = M("#ff7c8c", { op: 0.42 });
    for (const s of [1, -1]) add(onHead(skull, dirN(s * 0.48, -0.24, 0.84), 1.005, 0.2), ball(R * 0.14, 10, 6), bm, 0, 0, 0, false).scale.set(1.3, 0.8, 0.15);
  }

  // Hair (left out under a helmet or hood).
  const hairParts: THREE.Object3D[] = [];
  const hairAdd = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = add(parent, geo, mat, x, y, z);
    hairParts.push(m);
    return m;
  };
  if (!opts.hideHair) {
    const styles = hairStyles(P, R), hf = styles[P.hairStyle];
    if (hf) {
      const plain = P.hairStyle === "buzz" || P.hairStyle === "afro";
      if (plain) hairAdd(skull, shell(80, 60, hf), hairM);
      else {
        const shellM = M(P.hairColor, { r: 0.55 });
        shellM.vertexColors = true;
        hairAdd(skull, shell(112, 84, hf, true), shellM);
      }
    }
    if (P.hairStyle === "spiky") {
      const n = 16;
      for (let i = 0; i < n; i++) {
        const y = lerp(0.95, 0.15, i / (n - 1)), r = Math.sqrt(1 - y * y), a = i * 2.4 + 0.6;
        const d = new V3(Math.cos(a) * r, y, Math.sin(a) * r);
        const fr = 0.46 - P.bangs * 0.4;
        const hl = d.z >= 0 ? lerp(0.1, fr, sm(0, 1, d.z)) : lerp(0.1, -0.5, sm(0, 1, -d.z));
        if (d.y < hl + 0.08) continue;
        const p = headPoint(d, H, new V3()).multiplyScalar(1.05);
        const len = R * (0.42 + 0.35 * P.hairLength);
        const c = hairAdd(skull, new THREE.ConeGeometry(R * 0.17, len, 10), hairM);
        const dir = d.clone().add(new V3(0, 0.35, -0.35)).normalize();
        c.quaternion.setFromUnitVectors(YV, dir);
        c.position.copy(p).addScaledVector(dir, len * 0.4);
      }
    }
    const tail = (d: THREE.Vector3, base: [number, number, number], len: number, rad: number) => {
      const p = headPoint(d, H, new V3()).multiplyScalar(1.04);
      const tg = G(skull, p.x, p.y, p.z);
      tg.rotation.set(base[0], 0, base[2]);
      tg.userData.base = base;
      J.tails.push(tg);
      hairParts.push(tg);
      add(tg, new THREE.TorusGeometry(rad * 0.75, rad * 0.25, 10, 20), acc).rotation.x = Math.PI / 2;
      add(tg, ball(rad * 1.25, 7, 5), hairM, 0, -rad * 1.1, 0);
      add(tg, limbGeo(rad * 1.15, rad * 0.35, len, 7), hairM, 0, -rad * 1.4, 0);
    };
    if (P.hairStyle === "ponytail") tail(dirN(0, 0.35, -0.94), [0.45, 0, 0], R * (0.9 + 2.2 * P.hairLength), R * 0.2);
    if (P.hairStyle === "pigtails") for (const s of [1, -1]) tail(dirN(s * 0.82, 0.22, -0.45), [0.1, 0, s * 0.4], R * (0.7 + 1.8 * P.hairLength), R * 0.17);
    if (P.hairStyle === "bun") {
      const p = headPoint(dirN(0, 0.62, -0.78), H, new V3()).multiplyScalar(1.12);
      hairAdd(skull, new THREE.IcosahedronGeometry(R * (0.34 + 0.12 * P.hairLength), 4), hairM, p.x, p.y, p.z);
    }
  }

  // Beard.
  if (P.beard !== "none" && P.beard !== "mustache") {
    const m = dirN(0, -0.5, 0.86);
    const kind = P.beard;
    const fn = (d: THREE.Vector3, off: THREE.Vector3) => {
      const md = d.distanceTo(m);
      if (kind === "goatee") {
        if (Math.abs(d.x) < 0.3 && d.y < -0.58 && d.z > 0.2 && md > 0.17) {
          off.y -= R * 0.22 * sm(-0.7, -1, d.y);
          return 0.06;
        }
        return -1;
      }
      const reg = d.z > -0.3 && (d.y < -0.36 || (d.y < 0.05 && d.z < 0.55)) && md > 0.19 && !(d.z < 0.05 && d.y < -0.75);
      if (!reg) return -1;
      if (kind === "stubble") return 0.014;
      const low = sm(-0.4, -1, d.y) * Math.max(0, d.z + 0.1);
      if (kind === "wizard") {
        off.y -= R * (1.4 + 1.4 * P.hairLength) * low;
        off.x -= d.x * R * 0.7 * low;
        off.z += R * 0.15 * low;
        return 0.07 + 0.06 * low;
      }
      off.y -= R * 0.28 * low;
      return 0.05 + 0.07 * low;
    };
    add(skull, shell(80, 60, fn), kind === "stubble" ? stub : hairM);
  }

  // Hats (left out under a helmet).
  const topY = H.ry / (1 + H.square * 0.14);
  if (!opts.hideHair) {
    if (P.hat === "beanie") hairAdd(skull, shell(56, 40, (d) => (d.y > 0.24 ? (d.y < 0.4 ? 0.2 : 0.16) : -1)), acc);
    else if (P.hat === "wizard") {
      const hg = G(skull, 0, topY * 0.55, -R * 0.05);
      hairParts.push(hg);
      hg.rotation.x = -0.12;
      add(hg, new THREE.CylinderGeometry(R * 1.95, R * 2.0, R * 0.08, 40), acc);
      add(hg, new THREE.CylinderGeometry(R * 0.95, R * 1.0, R * 0.28, 32), gold, 0, R * 0.16, 0);
      add(hg, new THREE.CylinderGeometry(R * 0.55, R * 0.98, R * 1.4, 32), acc, 0, R * 0.95, 0);
      add(hg, new THREE.ConeGeometry(R * 0.55, R * 1.3, 32), acc, -R * 0.12, R * 2.2, -R * 0.06).rotation.set(-0.25, 0, 0.35);
    } else if (P.hat === "headband") {
      const k = 1.13;
      hairAdd(skull, ringsGeo([{ y: topY * 0.34, rx: H.rx * 0.98 * k, rz: H.rz * 1.02 * k }, { y: topY * 0.52, rx: H.rx * 0.92 * k, rz: H.rz * 0.97 * k }], 40), acc);
    } else if (P.hat === "crown") {
      const cg = G(skull, 0, topY * (0.92 + (P.hairStyle === "afro" ? 0.35 : 0.08)), 0);
      hairParts.push(cg);
      gold.side = THREE.DoubleSide;
      add(cg, new THREE.CylinderGeometry(R * 0.62, R * 0.56, R * 0.3, 8, 1, true), gold);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        add(cg, new THREE.ConeGeometry(R * 0.1, R * 0.25, 4), gold, Math.cos(a) * R * 0.6, R * 0.25, Math.sin(a) * R * 0.6);
        if (i % 2 === 0) add(cg, new THREE.OctahedronGeometry(R * 0.06, 0), acc, Math.cos(a) * R * 0.63, 0, Math.sin(a) * R * 0.63);
      }
    }
  }
  J.hair = hairParts;
  // Glasses.
  if (P.glasses !== "none") {
    const fm = P.glasses === "round" ? M("#6b4a1e", { r: 0.4, m: 0.5 }) : dark;
    for (const s of [1, -1]) {
      const g = onHead(skull, dirN(s * 0.33 * P.eyeSpacing, eyeY, 0.9), 1, 0.85);
      const lens = P.glasses === "round" ? new THREE.TorusGeometry(eR * 1.45, R * 0.022, 8, 36) : new THREE.TorusGeometry(eR * 1.65, R * 0.028, 8, 4);
      const l = add(g, lens, fm, 0, 0, eR * 0.55, false);
      if (P.glasses === "square") {
        l.rotation.z = Math.PI / 4;
        l.scale.set(1.15, 0.85, 1);
      }
      add(g, new THREE.BoxGeometry(R * 0.03, R * 0.03, R * 0.85), fm, s * eR * 1.6, eR * 0.1, -R * 0.4, false).rotation.y = s * -0.25;
    }
    const ep = headPoint(dirN(0.33 * P.eyeSpacing, eyeY, 0.9), H, new V3());
    const bridge = onHead(skull, dirN(0, eyeY + 0.05, 1), 1.02, 1);
    add(bridge, new THREE.BoxGeometry(Math.max(0.005, ep.x * 2 - eR * 2.8), R * 0.03, R * 0.03), fm, 0, 0, eR * 0.5, false);
  }

  // Legs.
  const footLen = 0.17 + 0.02 * bw, footW = shinR * 1.5 + 0.03;
  fitLegs.footLen = footLen;
  fitLegs.footW = footW;
  for (const s of [1, -1]) {
    const n = s > 0 ? "L" : "R";
    const hp = G(hips, s * hipW * 0.48, 0, 0);
    J[("hip" + n) as "hipL"] = hp;
    add(hp, limbGeo(thighR, thighR * 0.8, thighL, 8), thighM);
    if (bottom === "shorts") add(hp, limbGeo(thighR * 1.08, thighR * 0.95, thighL * 0.55, 8), pants);
    const kn = G(hp, 0, -thighL, 0);
    J[("knee" + n) as "kneeL"] = kn;
    add(kn, ball(thighR * 0.8, 8, 6), bottom === "pants" ? pants : skin);
    add(kn, limbGeo(shinR * 1.12, shinR * 0.75, shinL, 8), shinM);
    if (P.shoes === "boots") add(kn, limbGeo(shinR * 1.12, shinR * 0.98, shinL * 0.42, 8), shoe, 0, -shinL * 0.58, 0);
    const an = G(kn, 0, -shinL, 0);
    J[("ank" + n) as "ankL"] = an;
    const footM = P.shoes === "bare" ? skin : shoe;
    add(an, ball(0.5), footM, 0, -footH * 0.42, 0.035).scale.set(footW, footH * 1.25, footLen);
  }
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.userData.char = true;
  });

  const fit: Fit = {
    height: S, T, shW, waW, hipW, midW, chD, waD, hipD, midD, bust, neckR, armX, upR, foR, upLen, foLen, handR,
    thighR, shinR, thighL, shinL, footH, footLen, footW, H, R, build: bw, frame: fem,
  };
  return { root, J, fit, dispose: () => disposables.forEach((d) => d.dispose()) };
}
