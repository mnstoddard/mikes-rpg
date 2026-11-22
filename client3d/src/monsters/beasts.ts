// Four-legged animals: rats, cows, boars, wolves (plain, Hollow, alpha and
// dire), the Primeval beast, and the Frost Wyrm (a four-legged beast with
// wings and a long neck). One builder makes them all from a "spec": body and
// head sizes, legs, ears, tail, colours and eyes.
import * as THREE from "three";
import { Body, EyeSpec, Kit, PoseCtx, bump, ease, finish, makeRng, shade } from "./kit";

export const BLIGHT_GLOW = 0x9fe3c0; // the same sickly mint as the 2D game's Hollow wolves

export interface QuadSpec {
  /** Half sizes of the body: width, height, length. */
  body: [number, number, number];
  /** Leg length, hip to ground, and thickness. */
  leg: number;
  legR: number;
  foot: "paw" | "hoof" | "claw";
  head: [number, number, number];
  neck: number;
  /** How steeply the neck rises (radians). */
  neckUp: number;
  /** Half sizes of the muzzle. */
  snout: [number, number, number];
  ears: { kind: "pointy" | "round" | "floppy" | "cow" | "none"; size: number };
  tail: { kind: "bushy" | "thin" | "tuft" | "curl" | "dragon"; len: number; r: number };
  c: { fur: number; belly: number; snout: number; nose: number; foot: number; ear: number; mouth?: number };
  eye: Omit<EyeSpec, "lid"> & { lid?: number };
  /** Steps per second when walking. */
  speed: number;
  blight?: boolean;
  /** Things only this animal has (horns, tusks, spots, a mane...). */
  extras?: (k: Kit, p: QuadParts) => void;
  /** Attack effect (the wyrm's frost breath). */
  breath?: number;
  wings?: { span: number; color: number; bone: number };
}

export interface QuadParts {
  spec: QuadSpec;
  root: THREE.Group;
  body: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Group;
  ears: THREE.Group[];
  tail: THREE.Group[];
  legs: { hip: THREE.Group; knee: THREE.Group; front: boolean; side: 1 | -1 }[];
  wings: { root: THREE.Group; outer: THREE.Group; side: 1 | -1 }[];
  hipY: number;
  /** Where the nose tip is, in head space (for breath). */
  noseTip: THREE.Vector3;
  aura?: THREE.Sprite;
  glowMats: THREE.MeshStandardMaterial[];
}

export function buildQuad(spec: QuadSpec, seed = 1): ReturnType<typeof finish> {
  const k = new Kit();
  const S = spec;
  const [bx, by, bz] = S.body;
  const fur = k.mat(S.c.fur, { roughness: 0.8 });
  const belly = k.mat(S.c.belly, { roughness: 0.85 });
  const snoutM = k.mat(S.c.snout, { roughness: 0.75 });
  const noseM = k.mat(S.c.nose, { roughness: 0.35 });
  const footM = k.mat(S.c.foot, { roughness: 0.6 });
  const earM = k.mat(S.c.ear, { roughness: 0.8 });
  const mouthM = k.mat(S.c.mouth ?? 0x7a2a32, { roughness: 0.6 });

  const root = k.joint(new THREE.Group(), 0, 0, 0, "root");
  const scene = new THREE.Group();
  scene.add(root);
  const hipY = S.leg + by * 0.35;
  const body = k.joint(root, 0, hipY, 0, "body");
  const chest = k.joint(body, 0, 0, 0, "chest");
  k.ball(chest, bx, by, bz, fur);
  k.ball(chest, bx * 0.8, by * 0.68, bz * 0.84, belly, 0, -by * 0.32, 0.02);

  // Legs.
  const legs: QuadParts["legs"] = [];
  const footH = S.foot === "hoof" ? S.legR * 0.9 : S.legR * 0.7;
  for (const front of [true, false]) {
    for (const side of [1, -1] as const) {
      const hip = k.joint(body, side * bx * 0.6, -by * 0.35, (front ? 1 : -1) * bz * 0.6);
      const up = S.leg * 0.5;
      k.bone(hip, up, S.legR * (front ? 1.25 : 1.45), S.legR, fur);
      const knee = k.joint(hip, 0, -up, 0);
      const low = S.leg - up - footH;
      k.bone(knee, low, S.legR, S.legR * 0.88, S.foot === "hoof" ? fur : fur);
      if (S.foot === "hoof") {
        const g = new THREE.CylinderGeometry(S.legR * 0.95, S.legR * 1.1, footH * 1.6, 16);
        k.mesh(knee, g, footM, 0, -low - footH * 0.2, 0);
      } else {
        k.ball(knee, S.legR * 1.2, footH, S.legR * 1.45, footM, 0, -low - footH * 0.25, S.legR * 0.35);
        if (S.foot === "claw") {
          for (const cx of [-1, 0, 1]) {
            const c = k.horn(knee, S.legR * 0.7, S.legR * 0.28, k.mat(0xeee6d4, { roughness: 0.4 }), 0, cx * S.legR * 0.55, -low - footH * 0.6, S.legR * 1.5);
            c.rotation.x = Math.PI / 2.3;
          }
        }
      }
      legs.push({ hip, knee, front, side });
    }
  }

  // Neck and head.
  const neck = k.joint(body, 0, by * 0.42, bz * 0.78, "neck");
  const nx = Math.sin(S.neckUp) * S.neck, nz = Math.cos(S.neckUp) * S.neck;
  if (S.neck > 0.01) {
    const n = k.ball(neck, bx * 0.55, bx * 0.55, S.neck * 0.75 + bx * 0.3, fur, 0, nx * 0.5, nz * 0.5);
    n.rotation.x = -S.neckUp;
  }
  const head = k.joint(neck, 0, nx, nz, "head");
  const [hx, hy, hz] = S.head;
  k.ball(head, hx, hy, hz, fur);
  const [sx, sy, sz] = S.snout;
  const snoutZ = hz * 0.72 + sz * 0.5;
  k.ball(head, sx, sy, sz, snoutM, 0, -hy * 0.3, snoutZ);
  const noseTip = new THREE.Vector3(0, -hy * 0.3 + sy * 0.45, snoutZ + sz * 0.95);
  k.ball(head, sx * 0.45, sx * 0.32, sx * 0.3, noseM, noseTip.x, noseTip.y, noseTip.z - sx * 0.12);
  const jaw = k.joint(head, 0, -hy * 0.3 - sy * 0.45, snoutZ - sz * 0.55, "jaw");
  k.ball(jaw, sx * 0.82, sy * 0.42, sz * 0.82, shade(S.c.snout, 0.92) === S.c.snout ? snoutM : k.mat(shade(S.c.snout, 0.92)), 0, 0, sz * 0.55);
  k.ball(head, sx * 0.7, sy * 0.35, sz * 0.7, mouthM, 0, -hy * 0.3 - sy * 0.35, snoutZ - sz * 0.05);
  const eye: EyeSpec = { lid: S.c.fur, ...S.eye };
  k.eyes(head, [hx, hy, hz], [0, 0, 0], eye);

  // Ears.
  const ears: THREE.Group[] = [];
  if (S.ears.kind !== "none") {
    for (const side of [1, -1] as const) {
      const s = S.ears.size;
      const kind = S.ears.kind;
      const at = kind === "cow" ? [side * hx * 0.9, hy * 0.35, -hz * 0.1] : kind === "floppy" ? [side * hx * 0.7, hy * 0.6, -hz * 0.05] : [side * hx * 0.52, hy * 0.72, -hz * 0.2];
      const ear = k.joint(head, at[0], at[1], at[2]);
      if (kind === "pointy") {
        const g = new THREE.ConeGeometry(s * 0.5, s, 18);
        g.translate(0, s * 0.45, 0);
        g.scale(1, 1, 0.45);
        k.mesh(ear, g, fur);
        const gi = new THREE.ConeGeometry(s * 0.32, s * 0.72, 16);
        gi.translate(0, s * 0.4, 0);
        gi.scale(1, 1, 0.3);
        k.mesh(ear, gi, earM, 0, 0, s * 0.07);
        ear.rotation.set(-0.15, 0, -side * 0.28);
      } else if (kind === "round") {
        k.ball(ear, s * 0.55, s * 0.55, s * 0.16, fur, 0, s * 0.4, 0);
        k.ball(ear, s * 0.4, s * 0.4, s * 0.1, earM, 0, s * 0.4, s * 0.07);
        ear.rotation.set(-0.1, 0, -side * 0.35);
      } else if (kind === "floppy") {
        k.ball(ear, s * 0.3, s * 0.62, s * 0.14, fur, 0, -s * 0.45, 0);
        ear.rotation.set(0.2, 0, side * 0.75);
      } else if (kind === "cow") {
        k.ball(ear, s * 0.75, s * 0.32, s * 0.16, fur, side * s * 0.7, 0, 0);
        k.ball(ear, s * 0.55, s * 0.22, s * 0.1, earM, side * s * 0.72, 0, s * 0.07);
        ear.rotation.set(0, 0, -side * 0.25);
      }
      ears.push(ear);
    }
  }

  // Tail: a short chain of joints so it can swish.
  const tail: THREE.Group[] = [];
  {
    const T = S.tail;
    let parent: THREE.Object3D = body;
    const segs = T.kind === "dragon" ? 5 : T.kind === "thin" || T.kind === "tuft" ? 3 : 1;
    const seg = T.len / segs;
    for (let i = 0; i < segs; i++) {
      const j = k.joint(parent, 0, i === 0 ? by * 0.3 : -seg, i === 0 ? -bz * 0.9 : 0);
      if (i === 0) j.rotation.x = T.kind === "curl" ? 0.6 : T.kind === "dragon" ? 1.75 : T.kind === "thin" ? 1.75 : T.kind === "tuft" ? 0.35 : 1.0;
      else j.rotation.x = T.kind === "thin" ? -0.15 : T.kind === "dragon" ? -0.08 : 0.05;
      const r1 = T.r * (1 - (i / segs) * 0.85), r2 = T.r * (1 - ((i + 1) / segs) * 0.85);
      if (T.kind === "bushy") {
        k.ball(j, T.r, T.len * 0.55, T.r * 1.05, fur, 0, -T.len * 0.5, 0);
        k.ball(j, T.r * 0.7, T.len * 0.22, T.r * 0.72, belly, 0, -T.len * 0.92, 0);
      } else if (T.kind === "curl") {
        const g = new THREE.TorusGeometry(T.len * 0.35, T.r, 10, 18, Math.PI * 1.6);
        k.mesh(j, g, fur, 0, -T.len * 0.35, 0).rotation.y = Math.PI / 2;
      } else {
        k.bone(j, seg, r1, r2, T.kind === "thin" ? earM : fur);
        if (T.kind === "dragon") {
          const sp = k.horn(j, T.r * 1.3 * (1 - i / segs) + 0.05, T.r * 0.45, k.mat(shade(S.c.fur, 0.75)), -0.6, 0, -seg * 0.5, r1 * 0.85);
          sp.rotation.x = -1.2;
        }
      }
      if (T.kind === "tuft" && i === segs - 1) k.ball(j, T.r * 3, T.r * 4.5, T.r * 3, k.mat(shade(S.c.fur, 0.55)), 0, -seg - T.r * 3, 0);
      tail.push(j);
      parent = j;
    }
  }

  const parts: QuadParts = { spec: S, root, body, chest, neck, head, jaw, ears, tail, legs, wings: [], hipY, noseTip, glowMats: [] };

  if (S.wings) {
    for (const side of [1, -1] as const) parts.wings.push(makeWing(k, body, side, S.wings.span, S.wings.color, S.wings.bone, [bx * 0.55, by * 0.55, bz * 0.3]));
  }
  if (S.blight) blight(k, parts, seed);
  S.extras?.(k, parts);

  const L = bz * 2;
  const breath = S.breath !== undefined ? makeBreath(k, head, noseTip, S.breath, L) : null;

  const b: Body = {
    durations: { attack: S.breath !== undefined ? 1.6 : 0.9, hit: 0.5, death: 1.1 },
    pose: (c) => poseQuad(c, parts),
    fx: (c) => {
      if (parts.aura) {
        (parts.aura.material as THREE.SpriteMaterial).opacity = 0.32 + 0.18 * Math.sin(c.time * 2.4);
        parts.aura.visible = c.anim !== "death" || c.p < 0.8;
      }
      for (const m of parts.glowMats) m.emissiveIntensity = 0.9 + 0.5 * Math.sin(c.time * 2.4);
      breath?.(c);
    },
  };
  const height = hipY + by + (S.neck > 0 ? Math.sin(S.neckUp) * S.neck : 0) + hy;
  return finish(k, scene, b, height);
}

function poseQuad(c: PoseCtx, P: QuadParts) {
  const R = c.rig, S = P.spec;
  const L = S.body[2] * 2, time = c.time;
  const legSwing = 0.5;
  // Idle breathing, looking about, a wagging tail, ear twitches.
  const breathe = Math.sin(time * 2.1);
  R.s(P.chest, 1 + 0.012 * breathe, 1 + 0.018 * breathe, 1);
  P.ears.forEach((e, i) => {
    const tw = Math.pow(Math.max(0, Math.sin(time * 1.1 + i * 2.1)), 16);
    R.r(e, -0.35 * tw, 0, (i === 0 ? -1 : 1) * 0.25 * tw);
  });
  P.tail.forEach((t, i) => R.r(t, 0, 0, (0.18 + i * 0.05) * Math.sin(time * 2.6 - i * 0.6)));
  P.wings.forEach((w) => {
    R.r(w.root, 0, 0, w.side * (0.15 + 0.05 * breathe));
    R.r(w.outer, 0, 0, -w.side * 0.2);
  });

  if (c.anim === "idle") {
    R.r(P.head, 0.06 * Math.sin(time * 0.7), 0.3 * Math.sin(time * 0.45) * Math.sin(time * 0.23), 0.05 * Math.sin(time * 0.37));
    R.r(P.neck, 0.04 * Math.sin(time * 0.5), 0, 0);
  }

  if (c.anim === "walk") {
    const w = c.t * S.speed * Math.PI * 2;
    for (const l of P.legs) {
      const ph = (l.front === (l.side === 1) ? 0 : Math.PI) + (l.front ? 0 : 0.25);
      const s = Math.sin(w + ph), cc = Math.cos(w + ph);
      R.r(l.hip, -legSwing * s, 0, 0);
      R.r(l.knee, (l.front ? 0.75 : 0.55) * Math.max(0, cc), 0, 0);
    }
    R.p(P.body, 0, -S.leg * 0.04 * Math.abs(Math.sin(w)), 0);
    R.r(P.body, 0.03 * Math.sin(2 * w), 0, 0.03 * Math.sin(w));
    R.r(P.head, 0.07 * Math.sin(2 * w + 0.6), 0.05 * Math.sin(w), 0);
    P.tail.forEach((t, i) => R.r(t, 0, 0, 0.2 * Math.sin(w - i * 0.5)));
    P.wings.forEach((wg) => R.r(wg.root, 0, 0, wg.side * 0.12 * Math.sin(w)));
  }

  if (c.anim === "attack") {
    const p = c.p;
    if (S.breath !== undefined) {
      // Rear up, then breathe a cone of frost.
      const up = ease(p, 0, 0.25) * (1 - ease(p, 0.85, 1));
      const blow = ease(p, 0.25, 0.35) * (1 - ease(p, 0.8, 0.95));
      R.r(P.body, -0.18 * up, 0, 0);
      R.r(P.neck, -0.5 * up + 0.55 * blow, 0, 0);
      R.r(P.head, -0.3 * up + 0.25 * blow, 0.25 * Math.sin(p * 9) * blow, 0);
      R.r(P.jaw, 0.65 * blow, 0, 0);
      P.wings.forEach((wg) => R.r(wg.root, 0, 0, wg.side * (0.7 * up - 0.3 * blow)));
      for (const l of P.legs) if (l.front) R.r(l.hip, -0.4 * up, 0, 0);
    } else {
      const crouch = ease(p, 0, 0.35) * (1 - ease(p, 0.35, 0.5));
      const lunge = ease(p, 0.35, 0.5) * (1 - ease(p, 0.62, 1));
      R.p(P.body, 0, -S.leg * 0.12 * crouch + S.leg * 0.05 * lunge, -0.1 * L * crouch + 0.32 * L * lunge);
      R.r(P.body, 0.1 * crouch - 0.16 * lunge, 0, 0);
      R.r(P.head, 0.35 * crouch - 0.2 * lunge, 0, 0);
      R.r(P.jaw, 0.75 * bump(p, 0.3, 0.46, 0.6), 0, 0);
      for (const l of P.legs) {
        R.r(l.hip, l.front ? 0.25 * crouch - 0.75 * lunge : -0.2 * crouch + 0.55 * lunge, 0, 0);
        R.r(l.knee, 0.45 * crouch + (l.front ? 0.35 : 0) * lunge, 0, 0);
      }
      P.ears.forEach((e) => R.r(e, 0.45 * (crouch + lunge), 0, 0));
      P.wings.forEach((wg) => R.r(wg.root, 0, 0, wg.side * 0.6 * lunge));
    }
  }

  if (c.anim === "hit") {
    const h = c.p < 0.14 ? ease(c.p, 0, 0.14) : 1 - ease(c.p, 0.14, 1);
    R.p(P.body, 0, 0, -0.16 * L * h);
    R.r(P.body, -0.22 * h, 0, 0.08 * h);
    R.r(P.head, -0.45 * h, 0.25 * h, 0);
    R.r(P.jaw, 0.35 * h, 0, 0);
    P.ears.forEach((e) => R.r(e, 0.7 * h, 0, 0));
    for (const l of P.legs) R.r(l.hip, (l.front ? -0.35 : 0.25) * h, 0, 0);
  }

  if (c.anim === "death") {
    const p = c.p;
    const wob = bump(p, 0, 0.12, 0.25);
    const f = ease(p, 0.15, 0.62);
    const bounce = bump(p, 0.62, 0.7, 0.8);
    const [bx] = S.body;
    R.r(P.body, 0.1 * wob, 0, 1.45 * f);
    R.p(P.body, 0, -(P.hipY - bx * 0.92) * f + 0.04 * P.hipY * bounce, 0);
    R.r(P.neck, 0.25 * f, 0, 0.2 * f);
    R.r(P.head, 0.2 * f, 0, 0.25 * f);
    R.r(P.jaw, 0.25 * f, 0, 0);
    for (const l of P.legs) {
      R.r(l.hip, (l.front ? -0.35 : 0.35) * f, 0, -l.side * 0.15 * f);
      R.r(l.knee, 0.25 * f, 0, 0);
    }
    P.tail.forEach((t) => R.r(t, 0.3 * f, 0, 0));
    P.ears.forEach((e) => R.r(e, 0.5 * f, 0, 0));
    P.wings.forEach((wg) => {
      R.r(wg.root, 0, 0, wg.side * (wg.side === 1 ? -0.9 : 0.6) * f);
      R.r(wg.outer, 0, 0, wg.side * 0.3 * f);
    });
  }
}

/** Blighted: glowing cracks along the body and an aura that pulses. */
function blight(k: Kit, P: QuadParts, seed: number) {
  const rng = makeRng(seed + 11);
  const [bx, by, bz] = P.spec.body;
  const glow = k.mat(0xdffaf0, { glow: BLIGHT_GLOW, glowStrength: 1.2, roughness: 0.4 });
  P.glowMats.push(glow);
  for (let i = 0; i < 7; i++) {
    const side = i % 2 ? 1 : -1;
    const a = (rng() - 0.5) * 1.3;
    const zz = (rng() - 0.5) * 1.3 * bz;
    const yy = Math.sin(a) * by * 0.8;
    const r = Math.sqrt(Math.max(0, 1 - (zz / bz) ** 2 - (yy / by) ** 2));
    const crack = k.ball(P.chest, bx * 0.05, by * 0.3, bx * 0.05, glow, side * bx * r * 0.98, yy, zz);
    crack.rotation.set(rng() * 0.8, 0, side * (0.4 + rng() * 0.5));
  }
  const aura = k.glowSprite(BLIGHT_GLOW, Math.max(bx, bz) * 3.4, 0.4);
  aura.position.set(0, 0, 0);
  P.body.add(aura);
  P.aura = aura;
}

/** A leathery wing (bats and the wyrm). It flaps by turning its root around Z. */
export function makeWing(k: Kit, parent: THREE.Object3D, side: 1 | -1, span: number, color: number, boneColor: number, at: [number, number, number]) {
  const root = k.joint(parent, side * at[0], at[1], at[2]);
  root.rotation.set(0, -side * 0.45, side * 0.65);
  const memM = k.mat(color, { double: true, roughness: 0.8 });
  const boneM = k.mat(boneColor, { roughness: 0.6 });
  const L1 = span * 0.42, L2 = span * 0.58, chord = span * 0.5;
  const arm = k.bone(root, L1, span * 0.03, span * 0.022, boneM);
  arm.rotation.z = side * Math.PI / 2;
  const inner = new THREE.Shape();
  inner.moveTo(0, 0.02 * span);
  inner.lineTo(L1, 0);
  inner.quadraticCurveTo(L1 * 0.8, -chord * 0.55, L1 * 0.6, -chord * 0.8);
  inner.quadraticCurveTo(L1 * 0.35, -chord * 0.62, 0, -chord * 0.7);
  inner.closePath();
  const gi = new THREE.ShapeGeometry(inner, 10);
  gi.rotateX(Math.PI / 2);
  gi.scale(side, 1, 1);
  k.mesh(root, gi, memM);
  const outer = k.joint(root, side * L1, 0, 0);
  outer.rotation.set(0, side * 0.25, -side * 0.55);
  const fingers = [0.95, 0.7, 0.42];
  const tips = fingers.map((f, i) => new THREE.Vector2(L2 * (i === 0 ? 1 : f * 0.95), -chord * (i === 0 ? 0.08 : 0.25 + i * 0.25)));
  const os = new THREE.Shape();
  os.moveTo(0, 0);
  os.lineTo(tips[0].x, tips[0].y);
  let prev = tips[0];
  for (const tp of [...tips.slice(1), new THREE.Vector2(0, -chord * 0.8)]) {
    os.quadraticCurveTo((prev.x + tp.x) / 2 - L2 * 0.04, (prev.y + tp.y) / 2 + chord * 0.1, tp.x, tp.y);
    prev = tp;
  }
  os.closePath();
  const go = new THREE.ShapeGeometry(os, 10);
  go.rotateX(Math.PI / 2);
  go.scale(side, 1, 1);
  k.mesh(outer, go, memM);
  for (const tp of tips) {
    const len = tp.length();
    const f = k.bone(outer, len, span * 0.016, span * 0.008, boneM);
    // Point the finger (which hangs down -Y) at its tip on the wing.
    f.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(side * tp.x, 0, tp.y).normalize());
  }
  const claw = k.horn(outer, span * 0.05, span * 0.012, boneM, 0, 0, 0, 0.005);
  claw.rotation.x = -Math.PI / 2.4;
  return { root, outer, side };
}

/** The wyrm's frost breath: a stream of icy puffs from the mouth during its attack. */
function makeBreath(k: Kit, head: THREE.Group, tip: THREE.Vector3, color: number, L: number) {
  const g = new THREE.Group();
  head.add(g);
  g.position.copy(tip);
  const puffs: { s: THREE.Sprite; o: number }[] = [];
  for (let i = 0; i < 26; i++) {
    const s = k.glowSprite(color, 0.4, 0.7, i % 2 === 0);
    g.add(s);
    puffs.push({ s, o: i / 26 });
  }
  return (c: PoseCtx) => {
    const on = c.anim === "attack" && c.p > 0.3 && c.p < 0.86;
    g.visible = on || (c.anim === "attack" && c.p < 0.95);
    for (const pf of puffs) {
      const t = (c.time * 1.6 + pf.o) % 1;
      const d = t * L * 1.6;
      const spread = 0.15 + t * 0.6;
      pf.s.position.set(Math.sin(pf.o * 40) * spread * d * 0.3, Math.cos(pf.o * 23) * spread * d * 0.2 - d * 0.25, d);
      pf.s.scale.setScalar((0.25 + t * 1.4) * L * 0.18);
      (pf.s.material as THREE.SpriteMaterial).opacity = on ? 0.75 * (1 - t) : 0;
    }
  };
}

// ---------- The animals ----------

const tusk = (k: Kit, P: QuadParts, len: number, r: number, color = 0xf3ead2) => {
  const [hx, hy, hz] = P.spec.head;
  const [sx, , sz] = P.spec.snout;
  const m = k.mat(color, { roughness: 0.35 });
  for (const s of [1, -1]) {
    const t = k.horn(P.jaw, len, r, m, 0.9, s * sx * 0.75, 0, sz * 0.75);
    t.rotation.set(-0.2, 0, -s * 0.35);
  }
  return [hx, hy, hz];
};

export function rat(variant: number, seed: number) {
  const furs = [0x8a6a52, 0x8f9298, 0xf2eee6];
  const f = furs[variant] ?? furs[0];
  return buildQuad({
    body: [0.1, 0.085, 0.16], leg: 0.06, legR: 0.022, foot: "paw",
    head: [0.075, 0.07, 0.08], neck: 0.02, neckUp: 0.4, snout: [0.042, 0.036, 0.055],
    ears: { kind: "round", size: 0.085 }, tail: { kind: "thin", len: 0.32, r: 0.014 },
    c: { fur: f, belly: shade(f, 1.35), snout: shade(f, 1.2), nose: 0xe88a9a, foot: 0xe8a3aa, ear: 0xeea0a8 },
    eye: { size: 0.028, iris: variant === 2 ? 0xc0344a : 0x2a1a14, white: false, spread: 0.55, up: 0.18 },
    speed: 3.2,
    extras: (k, P) => {
      const wm = k.mat(0xf6f2ea, { roughness: 0.5 });
      const [, hy] = P.spec.head;
      for (const s of [1, -1])
        for (const a of [-0.2, 0.1]) {
          const w = k.bone(P.head, 0.07, 0.0016, 0.001, wm);
          w.position.set(s * 0.03, -hy * 0.25, 0.12);
          w.rotation.set(0, 0, s * (Math.PI / 2 + a));
        }
      // Two big front teeth.
      k.ball(P.jaw, 0.008, 0.012, 0.004, k.mat(0xfffbe8, { roughness: 0.3 }), 0.006, 0.006, 0.05);
      k.ball(P.jaw, 0.008, 0.012, 0.004, k.mat(0xfffbe8, { roughness: 0.3 }), -0.006, 0.006, 0.05);
    },
  }, seed);
}

export function cow(variant: number, seed: number) {
  const looks = [
    { fur: 0xf4f1ea, spots: 0x2a2626, belly: 0xffffff, snout: 0xf0b8b0 },
    { fur: 0x8a5a3a, spots: 0x6a4028, belly: 0xc8a07a, snout: 0xe6b0a0 },
    { fur: 0xe0c79a, spots: 0xf6ecd8, belly: 0xf6ecd8, snout: 0xe8b8a8 },
  ];
  const L = looks[variant] ?? looks[0];
  return buildQuad({
    body: [0.42, 0.42, 0.74], leg: 0.6, legR: 0.085, foot: "hoof",
    head: [0.27, 0.26, 0.27], neck: 0.22, neckUp: 0.45, snout: [0.2, 0.14, 0.12],
    ears: { kind: "cow", size: 0.15 }, tail: { kind: "tuft", len: 0.6, r: 0.025 },
    c: { fur: L.fur, belly: L.belly, snout: L.snout, nose: 0xc9827a, foot: 0x3a2e28, ear: L.snout },
    eye: { size: 0.075, iris: 0x2a1c16, white: false, spread: 0.6, up: 0.2, pupil: 0.5 },
    speed: 1.3,
    extras: (k, P) => {
      const rng = makeRng(seed);
      const spotM = k.mat(L.spots, { roughness: 0.8 });
      const [bx, by, bz] = P.spec.body;
      if (variant !== 2) {
        for (let i = 0; i < 7; i++) {
          const side = rng() < 0.5 ? 1 : -1;
          const zz = (rng() - 0.5) * 1.4 * bz, yy = (rng() - 0.2) * by * 0.8;
          const r = Math.sqrt(Math.max(0.05, 1 - (zz / bz) ** 2 - (yy / by) ** 2));
          const s = k.ball(P.chest, 0.04, 0.12 + rng() * 0.1, 0.14 + rng() * 0.1, spotM, side * bx * r * 0.9, yy, zz);
          s.rotation.z = side * 0.3;
        }
        k.ball(P.head, 0.12, 0.1, 0.05, spotM, 0.1, 0.12, 0.2);
      } else {
        // A shaggy fringe over the eyes.
        k.ball(P.head, 0.22, 0.09, 0.16, k.mat(shade(L.fur, 1.12)), 0, 0.2, 0.1);
      }
      const hornM = k.mat(0xeee2c4, { roughness: 0.4 });
      const [hx, hy] = P.spec.head;
      for (const s of [1, -1]) {
        const h = k.horn(P.head, 0.2, 0.05, hornM, 0.7, s * hx * 0.62, hy * 0.7, -0.02);
        h.rotation.set(0, 0, -s * 1.0);
      }
      // A bell on a strap.
      k.mesh(P.neck, new THREE.TorusGeometry(0.2, 0.02, 8, 24), k.mat(0x8a3a2a), 0, 0.1, 0.12).rotation.x = Math.PI / 2 - 0.5;
      const bell = k.mesh(P.neck, new THREE.CylinderGeometry(0.035, 0.06, 0.08, 16), k.mat(0xe2b33c, { metalness: 0.7, roughness: 0.3 }), 0, -0.07, 0.28);
      bell.rotation.x = -0.4;
      void bx;
    },
  }, seed);
}

export function boar(variant: number, seed: number) {
  const furs = [0x6e4c36, 0x3e3432, 0x9a6438];
  const f = furs[variant] ?? furs[0];
  return buildQuad({
    body: [0.26, 0.28, 0.46], leg: 0.28, legR: 0.065, foot: "hoof",
    head: [0.21, 0.2, 0.22], neck: 0.04, neckUp: 0.1, snout: [0.11, 0.09, 0.1],
    ears: { kind: "pointy", size: 0.12 }, tail: { kind: "curl", len: 0.12, r: 0.015 },
    c: { fur: f, belly: shade(f, 1.25), snout: 0xc88a78, nose: 0xa8645a, foot: 0x2a2220, ear: 0xc88a78 },
    eye: { size: 0.05, iris: 0x2a1a12, white: false, spread: 0.55, up: 0.22, cross: true },
    speed: 2.1,
    extras: (k, P) => {
      tusk(k, P, variant === 2 ? 0.16 : 0.11, 0.022);
      // A bristly crest down the back.
      const [, by, bz] = P.spec.body;
      const crest = k.mat(shade(f, 0.6));
      for (let i = 0; i < 9; i++) {
        const z = bz * (0.75 - i * 0.17);
        const s = k.horn(P.chest, 0.07 + (variant === 2 ? 0.04 : 0) - Math.abs(i - 2) * 0.006, 0.03, crest, -0.4, 0, by * 0.94 * Math.sqrt(Math.max(0, 1 - (z / bz) ** 2)), z);
        s.rotation.x = -0.35;
      }
      // A flat pig nose disc.
      k.mesh(P.head, new THREE.CylinderGeometry(0.06, 0.065, 0.03, 24), k.mat(0xd29a8a), 0, -0.2 * 0.3 + 0.01, 0.22 * 0.72 + 0.1 + 0.08).rotation.x = Math.PI / 2;
      if (variant === 2) for (let i = 0; i < 4; i++) k.ball(P.chest, 0.03, by * 0.75, 0.04, k.mat(shade(f, 0.7)), 0, 0, bz * (0.4 - i * 0.25)).position.y = 0.02;
    },
  }, seed);
}

function wolfSpec(fur: number, belly: number, o: Partial<QuadSpec> = {}): QuadSpec {
  return {
    body: [0.2, 0.22, 0.42], leg: 0.42, legR: 0.055, foot: "paw",
    head: [0.17, 0.16, 0.17], neck: 0.13, neckUp: 0.85, snout: [0.085, 0.07, 0.11],
    ears: { kind: "pointy", size: 0.14 }, tail: { kind: "bushy", len: 0.36, r: 0.08 },
    c: { fur, belly, snout: belly, nose: 0x1e1a1a, foot: shade(fur, 0.85), ear: 0x4a3a3a },
    eye: { size: 0.045, iris: 0xd09a2a, white: false, spread: 0.5, up: 0.2, cross: true, pupil: 0.5 },
    speed: 1.9,
    ...o,
  };
}

/** A fluffy ruff round the neck. */
function ruff(k: Kit, P: QuadParts, color: number, size = 1, spiky = false) {
  const m = k.mat(color, { roughness: 0.85 });
  const [bx, by, bz] = P.spec.body;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    if (spiky) {
      const s = k.horn(P.chest, by * 0.45 * size, bx * 0.22 * size, m, -0.5, Math.cos(a) * bx * 0.8, Math.sin(a) * by * 0.8 + by * 0.1, bz * 0.55);
      s.rotation.set(-1.1, 0, -Math.cos(a) * 0.8);
    } else k.ball(P.chest, bx * 0.35 * size, by * 0.35 * size, bz * 0.3 * size, m, Math.cos(a) * bx * 0.72, Math.sin(a) * by * 0.72 + by * 0.1, bz * 0.62);
  }
}

export function wolf(variant: number, seed: number) {
  const looks = [[0x8d949c, 0xe2e5e8], [0x8a6a4a, 0xe0cdb0], [0x3a3a42, 0x7a7a84]];
  const [f, b] = looks[variant] ?? looks[0];
  return buildQuad(wolfSpec(f, b), seed);
}

export function hollowWolf(variant: number, seed: number) {
  const f = variant === 0 ? 0xb8bec4 : 0x7e858c;
  return buildQuad(wolfSpec(f, 0xdfe3e6, {
    body: [0.21, 0.23, 0.44],
    blight: true,
    eye: { size: 0.047, iris: BLIGHT_GLOW, white: false, glow: true, spread: 0.5, up: 0.2, cross: true, pupil: 0.42 },
    c: { fur: f, belly: 0xdfe3e6, snout: 0xcfd5d9, nose: 0x2a2e30, foot: shade(f, 0.85), ear: 0x5a6266 },
    extras: (k, P) => {
      // Thin, with ribs showing.
      const m = k.mat(shade(f, 0.82));
      const [bx, by] = P.spec.body;
      for (let i = 0; i < 4; i++) for (const s of [1, -1]) {
        const r = k.ball(P.chest, 0.012, by * 0.55, 0.018, m, s * bx * 0.93, -by * 0.05, 0.12 - i * 0.07);
        r.rotation.z = s * 0.25;
      }
    },
  }), seed);
}

export function alphaWolf(variant: number, seed: number) {
  const blighted = variant === 0;
  const f = blighted ? 0xa9b0b6 : 0xc9ced6;
  const m = buildQuad(wolfSpec(f, 0xeef0f2, {
    body: [0.29, 0.32, 0.6], leg: 0.6, legR: 0.08, head: [0.24, 0.22, 0.24], neck: 0.18, snout: [0.12, 0.1, 0.15],
    ears: { kind: "pointy", size: 0.2 }, tail: { kind: "bushy", len: 0.5, r: 0.12 },
    blight: blighted,
    eye: blighted
      ? { size: 0.062, iris: BLIGHT_GLOW, white: false, glow: true, spread: 0.5, up: 0.2, cross: true, pupil: 0.42 }
      : { size: 0.062, iris: 0x7ab8e8, white: false, spread: 0.5, up: 0.2, cross: true, pupil: 0.5 },
    speed: 1.6,
    extras: (k, P) => {
      ruff(k, P, shade(f, 1.15), 1.15);
      // A scar over one eye.
      const s = k.ball(P.head, 0.012, 0.09, 0.012, k.mat(0xd88a8a), 0.1, 0.06, 0.18);
      s.rotation.z = -0.4;
    },
  }), seed);
  return m;
}

export function direWolf(variant: number, seed: number) {
  const looks = [0x4a4440, 0x6a5a4c, 0x8a9096];
  const f = looks[variant] ?? looks[0];
  return buildQuad(wolfSpec(f, shade(f, 1.4), {
    body: [0.34, 0.38, 0.72], leg: 0.72, legR: 0.095, head: [0.28, 0.26, 0.28], neck: 0.2, snout: [0.14, 0.12, 0.18],
    ears: { kind: "pointy", size: 0.22 }, tail: { kind: "bushy", len: 0.6, r: 0.14 },
    blight: variant === 2,
    eye: variant === 2
      ? { size: 0.07, iris: BLIGHT_GLOW, white: false, glow: true, spread: 0.5, up: 0.2, cross: true, pupil: 0.42 }
      : { size: 0.07, iris: 0xe0a030, white: false, spread: 0.5, up: 0.2, cross: true, pupil: 0.5 },
    speed: 1.4,
    foot: "claw",
    extras: (k, P) => {
      ruff(k, P, shade(f, 0.75), 1.1, true);
      const fang = k.mat(0xfbf6e6, { roughness: 0.3 });
      const [, hy, hz] = P.spec.head;
      for (const s of [1, -1]) {
        const t = k.horn(P.head, 0.07, 0.018, fang, 0, s * 0.07, -hy * 0.3 - 0.11, hz * 0.72 + 0.16);
        t.rotation.x = Math.PI;
      }
      if (variant === 1) {
        // Old scars.
        const sm = k.mat(0xb07a6a);
        for (let i = 0; i < 3; i++) k.ball(P.chest, 0.015, 0.16, 0.015, sm, 0.33, 0.05, 0.1 - i * 0.08).rotation.z = 0.5;
      }
    },
  }), seed);
}

export function primeval(variant: number, seed: number) {
  const frost = variant === 1;
  const f = frost ? 0xe8e4dc : 0x7a4a2e;
  return buildQuad({
    body: [0.95, 0.95, 1.3], leg: 1.25, legR: 0.24, foot: "hoof",
    head: [0.6, 0.62, 0.55], neck: 0.15, neckUp: 0.35, snout: [0.28, 0.3, 0.2],
    ears: { kind: "cow", size: 0.5 }, tail: { kind: "tuft", len: 0.6, r: 0.05 },
    c: { fur: f, belly: shade(f, 0.85), snout: shade(f, 0.9), nose: 0x2a2020, foot: 0x3a302a, ear: shade(f, 0.8) },
    eye: { size: 0.12, iris: frost ? 0x6ab0d8 : 0x2a1a12, white: false, spread: 0.55, up: 0.15, pupil: 0.5 },
    speed: 0.9,
    extras: (k, P) => {
      const rng = makeRng(seed);
      const shag = k.mat(shade(f, 0.82), { roughness: 0.95 });
      const [bx, by, bz] = P.spec.body;
      // A shaggy fringe round the belly and shoulders.
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        k.ball(P.chest, 0.22, 0.42 + rng() * 0.15, 0.22, shag, Math.cos(a) * bx * 0.86, -by * 0.45, Math.sin(a) * bz * 0.86);
      }
      k.ball(P.chest, bx * 0.75, by * 0.45, bz * 0.5, shag, 0, by * 0.62, bz * 0.3);
      // The trunk: three joints so it curls.
      const tm = k.mat(shade(f, 0.95));
      let parent: THREE.Object3D = P.head;
      const trunk: THREE.Group[] = [];
      for (let i = 0; i < 4; i++) {
        const j = k.joint(parent, 0, i === 0 ? -0.15 : -0.3, i === 0 ? 0.55 : 0);
        if (i === 0) j.rotation.x = -0.25;
        else j.rotation.x = -0.25;
        k.bone(j, 0.3, 0.2 - i * 0.04, 0.17 - i * 0.04, tm);
        trunk.push(j);
        parent = j;
      }
      P.tail.push(...trunk); // (it sways like the tail)
      const tuskM = k.mat(0xf6efdc, { roughness: 0.35 });
      for (const s of [1, -1]) {
        const t = k.horn(P.head, 0.9, 0.13, tuskM, -2.2, s * 0.3, -0.42, 0.36);
        t.rotation.set(2.75, 0, -s * 0.28);
      }
    },
  }, seed);
}

export function frostWyrm(variant: number, seed: number) {
  const snowy = variant === 1;
  const f = snowy ? 0xe6eef4 : 0x7fb6d8;
  const belly = snowy ? 0xbcd8ea : 0xd8ecf4;
  return buildQuad({
    body: [0.65, 0.62, 1.15], leg: 0.85, legR: 0.18, foot: "claw",
    head: [0.42, 0.36, 0.48], neck: 1.2, neckUp: 0.95, snout: [0.24, 0.17, 0.3],
    ears: { kind: "none", size: 0 }, tail: { kind: "dragon", len: 2.6, r: 0.32 },
    c: { fur: f, belly, snout: shade(f, 1.15), nose: 0x2a4a66, foot: shade(f, 0.8), ear: belly, mouth: 0x3a5a8a },
    eye: { size: 0.1, iris: snowy ? 0x4a9ad8 : 0x9fe8ff, white: true, spread: 0.55, up: 0.25, cross: true, glow: !snowy, pupil: 0.45 },
    speed: 1.0,
    breath: 0xcff4ff,
    wings: { span: 3.4, color: snowy ? 0xc8dcea : 0x5d8fb8, bone: shade(f, 0.85) },
    extras: (k, P) => {
      const hornM = k.mat(0xeef6fb, { roughness: 0.3 });
      const [hx, hy] = P.spec.head;
      for (const s of [1, -1]) {
        const h = k.horn(P.head, 0.55, 0.08, hornM, -0.7, s * hx * 0.5, hy * 0.6, -0.2);
        h.rotation.set(-0.9, 0, -s * 0.25);
        const h2 = k.horn(P.head, 0.25, 0.05, hornM, -0.5, s * hx * 0.9, hy * 0.1, -0.25);
        h2.rotation.set(-1.2, 0, -s * 0.9);
      }
      // Icy spikes down the neck and back.
      const ice = k.mat(0xdff6ff, { roughness: 0.15, glow: 0x5ab8e8, glowStrength: 0.35 });
      const [, by, bz] = P.spec.body;
      for (let i = 0; i < 6; i++) {
        const z = bz * (0.6 - i * 0.26);
        const s = k.horn(P.chest, 0.32 - i * 0.03, 0.09, ice, -0.5, 0, by * 0.95 * Math.sqrt(Math.max(0, 1 - (z / bz) ** 2)), z);
        s.rotation.x = -0.4;
      }
    },
  }, seed);
}
