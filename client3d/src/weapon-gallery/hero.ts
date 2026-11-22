// The hero who holds the weapon and swings it, so Mike can judge each
// weapon's size (the character is about 1.8 m tall) and its attack.
//
// The character is the shared smooth one (src/character). This file adds the
// attack animations: key poses for each way of swinging, blended together.
//
// The character faces +Z. Joint angles (radians), around each joint's own axes:
//   shoulder x: negative raises the arm forward.  shoulder z: outward is negative (right) / positive (left).
//   elbow x: negative bends the forearm forward.
//   wrist x: tips the weapon forward (+) or back (-).
import * as THREE from "three";
import { Character, createCharacter } from "../character";
import type { AttackMove, Hold } from "../weapons";

export interface Rig {
  character: Character;
  object: THREE.Group;
  spine: THREE.Object3D;
  shoulderR: THREE.Object3D;
  elbowR: THREE.Object3D;
  handR: THREE.Object3D;
  shoulderL: THREE.Object3D;
  elbowL: THREE.Object3D;
  handL: THREE.Object3D;
}

export function makeHero(): Rig {
  const c = createCharacter({}, { anim: null });
  const j = c.joints;
  return {
    character: c, object: c.object, spine: j.spine,
    shoulderR: j.shoulderR, elbowR: j.elbowR, handR: j.handR,
    shoulderL: j.shoulderL, elbowL: j.elbowL, handL: j.handL,
  };
}

// ---------- Poses and attacks ----------

export interface Pose {
  sR: [number, number, number];
  eR: number;
  wR: [number, number, number];
  sL: [number, number, number];
  eL: number;
  wL: [number, number, number];
  /** Body turn (around Y) and lean (forward +). */
  tw: number;
  lean: number;
  /** Bow string, 0 to 1. */
  draw: number;
}

const P = (p: Partial<Pose>): Pose => ({
  sR: [-0.25, 0, -0.12], eR: -1.0, wR: [0.5, 0, 0],
  sL: [0.05, 0, 0.12], eL: -0.35, wL: [0, 0, 0],
  tw: 0, lean: 0, draw: 0, ...p,
});

/** The resting pose for each way of holding a weapon. */
export function idlePose(move: AttackMove, hold: Hold): Pose {
  if (hold === "both") return P({ sR: [-0.75, 0, 0.42], eR: -0.75, wR: [0.2, 0, 0], sL: [-0.75, 0, -0.42], eL: -0.75 });
  if (hold === "left") return P({ sR: [0.05, 0, -0.12], eR: -0.3, wR: [0, 0, 0], sL: [-0.45, 0, 0.1], eL: -0.7, wL: [0.1, 0, 0] });
  if (move === "cast") return P({ sR: [-0.3, 0, -0.12], eR: -0.95, wR: [-0.55, 0, 0] });
  if (move === "sling") return P({ sR: [-0.1, 0, -0.18], eR: -0.4, wR: [0, 0, 0] });
  if (move === "stab") return P({ sR: [-0.35, 0, -0.12], eR: -1.15, wR: [0.85, 0, 0] });
  if (move === "throw") return P({ sR: [-0.35, 0, -0.1], eR: -1.6, wR: [0.2, 0, 0] });
  return P({});
}

export interface Attack {
  /** Seconds, at normal speed. */
  duration: number;
  /** Key poses at 0..1 of the way through. */
  keys: { t: number; pose: Pose }[];
  /** When it lands (melee) or lets go (ranged), 0..1. */
  hitAt: number;
  /** Draw a swoosh behind the tip. */
  trail: boolean;
}

export function attackFor(move: AttackMove, hold: Hold): Attack {
  const idle = idlePose(move, hold);
  const k = (t: number, p: Partial<Pose>) => ({ t, pose: { ...idle, ...p } });
  switch (move) {
    case "slash":
      return { duration: 0.9, hitAt: 0.5, trail: true, keys: [
        k(0, {}), k(0.34, { sR: [-2.75, 0, -0.6], eR: -0.7, wR: [-0.3, 0, 0], tw: -0.45, lean: -0.05 }),
        k(0.56, { sR: [-1.3, 0, 0.35], eR: -0.1, wR: [1.0, 0, 0], tw: 0.5, lean: 0.15 }), k(1, {}),
      ] };
    case "stab":
      return { duration: 0.7, hitAt: 0.5, trail: true, keys: [
        k(0, {}), k(0.32, { sR: [-0.6, 0, -0.3], eR: -2.1, wR: [1.6, 0, 0], tw: -0.35 }),
        k(0.52, { sR: [-1.5, 0, 0.05], eR: -0.05, wR: [1.55, 0, 0], tw: 0.25, lean: 0.2 }), k(1, {}),
      ] };
    case "smash":
      return { duration: 1.05, hitAt: 0.56, trail: true, keys: [
        k(0, {}), k(0.4, { sR: [-3.0, 0, -0.2], eR: -1.0, wR: [-0.6, 0, 0], lean: -0.15 }),
        k(0.58, { sR: [-1.0, 0, 0], eR: -0.25, wR: [0.75, 0, 0], lean: 0.3 }), k(1, {}),
      ] };
    case "sweep": {
      const arms = { sR: [-1.25, 0, 0.42] as [number, number, number], eR: -0.3, wR: [1.3, 0, 0] as [number, number, number], sL: [-1.25, 0, -0.42] as [number, number, number], eL: -0.3 };
      return { duration: 1.2, hitAt: 0.52, trail: true, keys: [
        k(0, {}), k(0.36, { ...arms, tw: -1.3 }), k(0.62, { ...arms, tw: 1.15, lean: 0.12 }), k(1, {}),
      ] };
    }
    case "throw":
      return { duration: 0.75, hitAt: 0.5, trail: false, keys: [
        k(0, {}), k(0.35, { sR: [-2.7, 0, -0.35], eR: -1.8, wR: [-0.4, 0, 0], tw: -0.35 }),
        k(0.52, { sR: [-1.55, 0, 0], eR: -0.1, wR: [0.3, 0, 0], tw: 0.2, lean: 0.12 }), k(1, {}),
      ] };
    case "sling":
      return { duration: 1.5, hitAt: 0.72, trail: false, keys: [
        k(0, {}), k(0.15, { sR: [-2.9, 0, -0.25], eR: -0.2, wR: [-1.4, 0, 0] }),
        k(0.65, { sR: [-2.9, 0, -0.25], eR: -0.2, wR: [-1.4, 22, 0] }),
        k(0.74, { sR: [-1.5, 0, 0], eR: -0.05, wR: [-0.6, 24, 0], lean: 0.12 }), k(1, { wR: [0, 25.13, 0] }),
      ] };
    case "shoot": {
      const aim = { sL: [-1.5, 0, -0.05] as [number, number, number], eL: -0.02, wL: [-0.07, 0, 0] as [number, number, number], tw: 0.25 };
      return { duration: 1.4, hitAt: 0.66, trail: false, keys: [
        k(0, {}), k(0.25, { ...aim, sR: [-1.45, 0, 0.35], eR: -0.4 }),
        k(0.6, { ...aim, sR: [-1.45, 0, 0.55], eR: -2.35, draw: 1 }),
        k(0.66, { ...aim, sR: [-1.4, 0, 0.6], eR: -2.4, draw: 0 }), k(0.8, { ...aim, sR: [-1.0, 0, 0.3], eR: -1.6 }), k(1, {}),
      ] };
    }
    case "cast":
      return { duration: 1.0, hitAt: 0.5, trail: false, keys: [
        k(0, {}), k(0.32, { sR: [-1.1, 0, -0.2], eR: -0.7, wR: [-0.4, 0, 0], tw: -0.2, lean: -0.05 }),
        k(0.5, { sR: [-1.65, 0, 0.05], eR: -0.15, wR: [0.65, 0, 0], tw: 0.15, lean: 0.15 }), k(1, {}),
      ] };
  }
}

const ease = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** The pose part-way (0..1) through an attack. */
export function poseAt(a: Attack, p: number): Pose {
  let i = 0;
  while (i < a.keys.length - 2 && p > a.keys[i + 1].t) i++;
  const k0 = a.keys[i];
  const k1 = a.keys[i + 1];
  const t = ease(Math.min(1, Math.max(0, (p - k0.t) / (k1.t - k0.t || 1))));
  const A = k0.pose;
  const B = k1.pose;
  // The sling spins at a steady speed, so its wrist turn isn't eased.
  const lin = Math.min(1, Math.max(0, (p - k0.t) / (k1.t - k0.t || 1)));
  return {
    sR: lerp3(A.sR, B.sR, t), eR: lerp(A.eR, B.eR, t), wR: [lerp(A.wR[0], B.wR[0], t), lerp(A.wR[1], B.wR[1], lin), lerp(A.wR[2], B.wR[2], t)],
    sL: lerp3(A.sL, B.sL, t), eL: lerp(A.eL, B.eL, t), wL: lerp3(A.wL, B.wL, t),
    tw: lerp(A.tw, B.tw, t), lean: lerp(A.lean, B.lean, t), draw: lerp(A.draw, B.draw, t),
  };
}

export function applyPose(r: Rig, p: Pose) {
  r.shoulderR.rotation.set(p.sR[0], p.sR[1], p.sR[2]);
  r.elbowR.rotation.x = p.eR;
  // Turn around the forearm first, then tip: so a sling whirls round the arm.
  r.handR.rotation.order = "YXZ";
  r.handR.rotation.set(p.wR[0], p.wR[1], p.wR[2]);
  r.shoulderL.rotation.set(p.sL[0], p.sL[1], p.sL[2]);
  r.elbowL.rotation.x = p.eL;
  r.handL.rotation.set(p.wL[0], p.wL[1], p.wL[2]);
  r.spine.rotation.set(p.lean, p.tw, 0);
}
