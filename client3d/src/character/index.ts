// The smooth character from the Character Workshop, for the 3D game.
//
//   import { createCharacter } from "./character";
//   const hero = createCharacter({ hairStyle: "long" }); // any recipe settings
//   scene.add(hero.object);
//   hero.setAnim("walk");      // idle, walk, wave, cheer, pose, or null to pose it yourself
//   hero.update(dt, time);     // every frame (animation and blinking)
//
// The character faces +Z and stands on y = 0, about 1.8 m tall.
// hero.joints holds the joints (three.js groups). Rotate them to pose the
// character, or add things to them so they move with it: joints.handR holds a
// weapon or tool (its +Y runs back up the forearm when the arm hangs down),
// joints.skull a helmet. hero.fit has the body's measurements.
import * as THREE from "three";
import { buildBody, BuildOptions, Fit, Joints } from "./body";
import { CharacterRecipe, makeRecipe } from "./recipe";
import { lerp } from "./shapes";

export type { CharacterRecipe } from "./recipe";
export { CHARACTER_PRESETS, DEFAULT_RECIPE, LINEN, makeRecipe, recipeFromCode, undress } from "./recipe";
export type { Fit, Joints } from "./body";
export * as shapes from "./shapes";

export type CharacterAnim = "idle" | "walk" | "run" | "wave" | "cheer" | "pose";
export const CHARACTER_ANIMS: [CharacterAnim, string][] = [["idle", "Idle"], ["walk", "Walk"], ["wave", "Wave"], ["cheer", "Cheer"], ["pose", "Hero pose"]];

/** Friendly names for the joints most things need. */
export interface JointNames {
  shoulderL: THREE.Group; shoulderR: THREE.Group;
  elbowL: THREE.Group; elbowR: THREE.Group;
  handL: THREE.Group; handR: THREE.Group;
  spine: THREE.Group; hips: THREE.Group; head: THREE.Group;
}

export interface Character {
  object: THREE.Group;
  recipe: CharacterRecipe;
  joints: Joints & JointNames;
  fit: Fit;
  /** Play an animation, or null to stop and pose the joints yourself. */
  setAnim(a: CharacterAnim | null): void;
  /** Every frame: dt and time in seconds. */
  update(dt: number, time: number): void;
  dispose(): void;
}

type Pose = Record<string, [number, number, number]> & { bob: number };
const JOINTS = ["hips", "spine", "head", "shL", "shR", "elL", "elR", "hipL", "hipR", "kneeL", "kneeR", "ankL", "ankR", "tail"] as const;

function targetPose(anim: CharacterAnim, t: number, rest: number): Pose {
  const p = { bob: 0 } as Pose;
  for (const k of JOINTS) p[k] = [0, 0, 0];
  p.shL[2] = rest;
  p.shR[2] = -rest;
  p.elL[0] = -0.14;
  p.elR[0] = -0.14;
  const br = Math.sin(t * 1.8);
  const idle = () => {
    p.spine[0] += 0.02 * br;
    p.shL[2] += 0.025 * br;
    p.shR[2] -= 0.025 * br;
    p.head[1] += 0.3 * Math.sin(t * 0.45) * Math.sin(t * 0.21);
    p.head[0] += 0.04 * Math.sin(t * 0.7);
    p.hips[2] += 0.02 * Math.sin(t * 0.6);
    p.spine[2] -= 0.03 * Math.sin(t * 0.6);
    p.bob -= 0.003 * (1 + br);
    p.tail[2] += 0.05 * Math.sin(t * 1.3);
  };
  if (anim === "idle") idle();
  else if (anim === "walk") {
    const w = t * 5.4, s = Math.sin(w), c = Math.cos(w);
    p.hipL[0] = -0.55 * s;
    p.hipR[0] = 0.55 * s;
    p.kneeL[0] = 0.1 + 0.85 * Math.max(0, c);
    p.kneeR[0] = 0.1 + 0.85 * Math.max(0, -c);
    p.ankL[0] = -(p.hipL[0] + p.kneeL[0]) * 0.55;
    p.ankR[0] = -(p.hipR[0] + p.kneeR[0]) * 0.55;
    p.shL[0] = 0.5 * s;
    p.shR[0] = -0.5 * s;
    p.elL[0] = -0.35 - 0.2 * Math.max(0, -s);
    p.elR[0] = -0.35 - 0.2 * Math.max(0, s);
    p.bob = -0.03 * s * s;
    p.spine[1] = 0.12 * s;
    p.spine[0] = 0.05;
    p.head[1] = -0.1 * s;
    p.hips[1] = -0.08 * s;
    p.tail[0] = 0.25 * c;
    p.tail[2] = 0.15 * s;
  } else if (anim === "run") {
    // Running: quicker, longer strides, arms pumping, leaning into it.
    const w = t * 9, s = Math.sin(w), c = Math.cos(w);
    p.hipL[0] = -0.8 * s;
    p.hipR[0] = 0.8 * s;
    p.kneeL[0] = 0.25 + 1.2 * Math.max(0, c);
    p.kneeR[0] = 0.25 + 1.2 * Math.max(0, -c);
    p.ankL[0] = -(p.hipL[0] + p.kneeL[0]) * 0.5;
    p.ankR[0] = -(p.hipR[0] + p.kneeR[0]) * 0.5;
    p.shL[0] = 0.75 * s;
    p.shR[0] = -0.75 * s;
    p.elL[0] = -1.2;
    p.elR[0] = -1.2;
    p.bob = -0.05 * Math.abs(c) + 0.02;
    p.spine[1] = 0.15 * s;
    p.spine[0] = 0.2;
    p.head[0] = -0.12;
    p.hips[1] = -0.1 * s;
    p.tail[0] = 0.4 * c;
    p.tail[2] = 0.2 * s;
  } else if (anim === "wave") {
    idle();
    p.shR[2] = -2.6;
    p.shR[0] = -0.15;
    p.elR[2] = -0.35 - 0.45 * Math.sin(t * 8);
    p.elR[0] = 0;
    p.head[2] = -0.1;
    p.head[1] = 0.12;
    p.spine[2] += 0.05;
  } else if (anim === "cheer") {
    const j = Math.abs(Math.sin(t * 4.6)), land = 1 - j;
    p.bob = j * 0.1 - 0.03 * land;
    p.shL[2] = 2.7 + 0.2 * Math.sin(t * 9.2);
    p.shR[2] = -2.7 - 0.2 * Math.sin(t * 9.2);
    p.elL[2] = 0.2;
    p.elR[2] = -0.2;
    p.elL[0] = 0;
    p.elR[0] = 0;
    p.hipL[0] = p.hipR[0] = -0.35 * land;
    p.kneeL[0] = p.kneeR[0] = 0.7 * land;
    p.ankL[0] = p.ankR[0] = -0.35 * land;
    p.head[0] = -0.15;
    p.tail[0] = 0.4 * j;
  } else if (anim === "pose") {
    idle();
    p.shL = [0.3, 0, 0.78];
    p.shR = [0.3, 0, -0.78];
    p.elL = [0, 0, -1.75];
    p.elR = [0, 0, 1.75];
    p.hipL[2] = 0.13;
    p.hipR[2] = -0.13;
    p.ankL[2] = -0.13;
    p.ankR[2] = 0.13;
    p.spine[0] = -0.07;
    p.head[0] = -0.1;
    p.head[1] = 0.25;
  }
  return p;
}

export interface CharacterOptions extends BuildOptions {
  anim?: CharacterAnim | null;
}

/** Make a character from a recipe (missing settings use the defaults). */
export function createCharacter(recipe: Partial<CharacterRecipe> = {}, opts: CharacterOptions = {}): Character {
  const P = makeRecipe(recipe);
  const body = buildBody(P, opts);
  const J = body.J;
  const object = new THREE.Group();
  object.add(body.root);
  body.root.position.y = 0.025; // the soles of the feet sit on y = 0
  let anim: CharacterAnim | null = opts.anim === undefined ? "idle" : opts.anim;
  let pose: Pose | null = null;
  let nextBlink = 2, blinkT = -1;
  const joints = Object.assign(J, {
    shoulderL: J.shL, shoulderR: J.shR, elbowL: J.elL, elbowR: J.elR,
  }) as Joints & JointNames;

  return {
    object,
    recipe: P,
    joints,
    fit: body.fit,
    setAnim(a) {
      anim = a;
    },
    update(dt, t) {
      if (anim) {
        const tp = targetPose(anim, t, J.rest);
        if (!pose) pose = JSON.parse(JSON.stringify(tp)) as Pose;
        const k = 1 - Math.exp(-dt * 9);
        for (const key of JOINTS) {
          for (let i = 0; i < 3; i++) pose[key][i] = lerp(pose[key][i], tp[key][i], k);
          if (key === "tail") {
            for (const tg of J.tails) {
              const b = tg.userData.base as number[];
              tg.rotation.set(b[0] + pose.tail[0], 0, b[2] + pose.tail[2]);
            }
          } else J[key].rotation.set(pose[key][0], pose[key][1], pose[key][2]);
        }
        pose.bob = lerp(pose.bob, tp.bob, k);
        J.hips.position.y = J.hipsY + pose.bob;
      }
      // Blinking.
      if (t > nextBlink) {
        blinkT = 0;
        nextBlink = t + 2 + Math.random() * 3.5;
      }
      let ey = 1;
      if (blinkT >= 0) {
        blinkT += dt;
        const b = blinkT / 0.22;
        ey = b < 1 ? Math.max(0.08, Math.abs(1 - 2 * b)) : 1;
        if (b >= 1) blinkT = -1;
      }
      const shut = ey < 0.5;
      for (const e of J.eyes) {
        const tex = shut ? e.shut : e.open;
        if (e.m.map !== tex) {
          e.m.map = tex;
          e.m.emissiveMap = tex;
        }
      }
    },
    dispose: body.dispose,
  };
}
