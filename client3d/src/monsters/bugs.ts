// Spiders and beetles: the cave spider, the giant spider, the Thornmother
// (the Blighted spider queen), the fire beetle and the Dust Titan. One builder
// makes them all: a round body, a head with big friendly eyes, and 8 or 6
// jointed legs that walk in a ripple.
import * as THREE from "three";
import { BLIGHT_GLOW } from "./beasts";
import { Body, Kit, PoseCtx, bump, ease, finish, makeRng, shade } from "./kit";

export interface BugSpec {
  kind: "spider" | "beetle";
  /** Overall size multiplier (1 = a cave spider about 0.6 m across). */
  size: number;
  c: { body: number; back: number; leg: number; mark?: number; belly?: number; glow?: number };
  marks?: "spots" | "stripes" | "hourglass" | "none";
  iris: number;
  glowEyes?: boolean;
  blight?: boolean;
  horn?: number;
  thorns?: boolean;
  crown?: boolean;
  /** Fire beetles glow under their shell. */
  ember?: boolean;
  speed: number;
}

interface Leg { root: THREE.Group; femur: THREE.Group; knee: THREE.Group; side: 1 | -1; i: number; group: 0 | 1 }

export function buildBug(S: BugSpec, seed = 1) {
  const k = new Kit();
  const z = S.size;
  const spider = S.kind === "spider";
  const bodyM = k.mat(S.c.body, { roughness: spider ? 0.75 : 0.32, metalness: spider ? 0 : 0.1 });
  const backM = k.mat(S.c.back, { roughness: spider ? 0.7 : 0.25, metalness: spider ? 0 : 0.15 });
  const legM = k.mat(S.c.leg, { roughness: 0.6 });
  const markM = k.mat(S.c.mark ?? 0xffffff, { roughness: 0.6, ...(S.blight ? { glow: BLIGHT_GLOW, glowStrength: 1 } : {}) });
  const glowMats: THREE.MeshStandardMaterial[] = [];
  if (S.blight) glowMats.push(markM);

  const scene = new THREE.Group();
  const root = k.joint(scene, 0, 0, 0, "root");
  const hipH = (spider ? 0.22 : 0.11) * z;
  const body = k.joint(root, 0, hipH, 0, "body");

  // Front body (with the legs) and head.
  const cR: [number, number, number] = spider ? [0.13 * z, 0.1 * z, 0.13 * z] : [0.13 * z, 0.09 * z, 0.1 * z];
  k.ball(body, cR[0], cR[1], cR[2], bodyM);
  const head = k.joint(body, 0, spider ? 0.03 * z : 0.01 * z, cR[2] * (spider ? 0.55 : 0.9), "head");
  const hR: [number, number, number] = spider ? [0.1 * z, 0.085 * z, 0.08 * z] : [0.085 * z, 0.07 * z, 0.07 * z];
  k.ball(head, hR[0], hR[1], hR[2], bodyM, 0, 0, hR[2] * 0.5);
  k.eyes(head, hR, [0, 0, hR[2] * 0.5], {
    size: (spider ? 0.034 : 0.028) * z, iris: S.iris, lid: S.c.body, white: !S.glowEyes, glow: S.glowEyes,
    spread: 0.42, up: 0.28, forward: 0.55, cross: true, pupil: 0.55,
  });
  if (spider) {
    // Little extra eyes above the big ones: shiny beads.
    const bead = k.mat(S.glowEyes ? 0xdffaf0 : 0x1a1418, { roughness: 0.15, ...(S.glowEyes ? { glow: BLIGHT_GLOW, glowStrength: 1 } : {}) });
    for (const s of [1, -1]) for (const j of [0, 1]) k.ball(head, 0.012 * z, 0.012 * z, 0.01 * z, bead, s * (0.025 + j * 0.03) * z, (0.075 - j * 0.012) * z, hR[2] * 1.05);
  }
  // Fangs (spiders) or pincers (beetles).
  const fangs: THREE.Group[] = [];
  const fangM = k.mat(spider ? shade(S.c.body, 0.6) : 0x2a1e18, { roughness: 0.35 });
  for (const s of [1, -1]) {
    const f = k.joint(head, s * 0.032 * z, -0.045 * z, hR[2] * 1.15);
    if (spider) {
      k.ball(f, 0.022 * z, 0.03 * z, 0.022 * z, bodyM, 0, -0.01 * z, 0);
      const t = k.horn(f, 0.05 * z, 0.012 * z, fangM, 0.5, 0, -0.03 * z, 0.005 * z);
      t.rotation.x = Math.PI;
    } else {
      const t = k.horn(f, 0.08 * z, 0.014 * z, fangM, 0.8, 0, 0, 0);
      t.rotation.set(Math.PI / 2, 0, -s * 0.9);
    }
    fangs.push(f);
  }
  if (S.horn) {
    const h = k.horn(head, S.horn * z, 0.028 * z, k.mat(shade(S.c.back, 0.7), { roughness: 0.3, metalness: 0.15 }), -0.9, 0, hR[1] * 0.5, hR[2] * 0.9);
    h.rotation.x = 0.5;
  }
  if (S.crown) {
    const cm = k.mat(0x3a4a2a, { roughness: 0.6 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const t = k.horn(head, (0.06 + (i % 2) * 0.03) * z, 0.012 * z, cm, -0.3, Math.cos(a) * 0.06 * z, hR[1] * 0.85, hR[2] * 0.3 + Math.sin(a) * 0.05 * z);
      t.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
    }
  }

  // The back: a big round abdomen (spiders) or a shiny shell in two halves (beetles).
  const back = k.joint(body, 0, spider ? 0.06 * z : 0.04 * z, -cR[2] * (spider ? 1.7 : 0.6), "back");
  const aR: [number, number, number] = spider ? [0.17 * z, 0.15 * z, 0.2 * z] : [0.15 * z, 0.11 * z, 0.21 * z];
  const shells: THREE.Group[] = [];
  if (spider) {
    k.ball(back, aR[0], aR[1], aR[2], backM, 0, 0, -aR[2] * 0.3);
    addMarks(k, back, aR, S, markM, seed);
    if (S.thorns) {
      const tm = k.mat(0x41503a, { roughness: 0.55 });
      const rng = makeRng(seed + 5);
      for (let i = 0; i < 12; i++) {
        const a = rng() * Math.PI * 2, e = 0.2 + rng() * 1.1;
        const d = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
        const t = k.horn(back, (0.05 + rng() * 0.04) * z, 0.016 * z, tm, 0, d.x * aR[0] * 0.95, d.y * aR[1] * 0.95, d.z * aR[2] * 0.95 - aR[2] * 0.3);
        t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      }
    }
  } else {
    // The soft body under the shell (glowing on a fire beetle).
    const under = k.mat(S.c.belly ?? shade(S.c.body, 0.8), S.ember ? { glow: S.c.glow ?? 0xff7a1a, glowStrength: 1.2, roughness: 0.5 } : { roughness: 0.6 });
    if (S.ember) glowMats.push(under);
    k.ball(back, aR[0] * 0.9, aR[1] * 0.75, aR[2] * 0.92, under, 0, -aR[1] * 0.1, -aR[2] * 0.4);
    for (const s of [1, -1] as const) {
      const sh = k.joint(back, s * 0.005 * z, aR[1] * 0.15, 0);
      const g = new THREE.SphereGeometry(1, 24, 16, s === 1 ? Math.PI / 2 : -Math.PI / 2, Math.PI, 0, Math.PI / 1.9);
      g.scale(aR[0], aR[1] * 1.2, aR[2]);
      g.translate(0, -aR[1] * 0.15, -aR[2] * 0.42);
      const m = k.mesh(sh, g, k.mat(S.c.back, { roughness: 0.25, metalness: 0.15, double: true }));
      m.castShadow = true;
      addMarks(k, sh, aR, { ...S, marks: S.marks }, markM, seed + s, s);
      shells.push(sh);
    }
  }

  // Legs.
  const legs: Leg[] = [];
  const yaws = spider ? [0.95, 0.35, -0.25, -0.8] : [0.6, -0.05, -0.65];
  const L1 = (spider ? 0.2 : 0.085) * z, e1 = spider ? 0.85 : 0.45, e2 = spider ? -1.25 : -0.95;
  const r = (spider ? 0.022 : 0.02) * z;
  yaws.forEach((a, i) => {
    for (const side of [1, -1] as const) {
      const rootL = k.joint(body, side * cR[0] * 0.7, -cR[1] * 0.1, cR[2] * (spider ? 0.4 - i * 0.3 : 0.35 - i * 0.45));
      rootL.rotation.y = side === 1 ? -a : Math.PI + a;
      const femur = k.joint(rootL, 0, 0, 0);
      femur.rotation.z = Math.PI / 2 + e1;
      k.bone(femur, L1, r * 1.2, r, legM);
      // Bands on spider legs.
      if (spider) k.ball(femur, r * 1.35, r * 0.6, r * 1.35, k.mat(shade(S.c.leg, 0.7)), 0, -L1, 0);
      const knee = k.joint(femur, 0, -L1, 0);
      knee.rotation.z = e2 - e1;
      const footY = hipH - cR[1] * 0.1 + L1 * Math.sin(e1);
      const L2 = footY / -Math.sin(e2);
      k.bone(knee, L2, r, r * 0.55, legM);
      legs.push({ root: rootL, femur, knee, side, i, group: ((i + (side === 1 ? 0 : 1)) % 2) as 0 | 1 });
    }
  });

  let aura: THREE.Sprite | null = null;
  if (S.blight) {
    aura = k.glowSprite(BLIGHT_GLOW, Math.max(aR[2], cR[2]) * 6, 0.35);
    body.add(aura);
  }

  const b: Body = {
    durations: { attack: 1.0, hit: 0.5, death: 1.1 },
    follow: 18,
    pose: (c) => poseBug(c, { S, body, head, back, legs, fangs, shells, hipH, cR, spider }),
    fx(c) {
      for (const m of glowMats) m.emissiveIntensity = (S.ember ? 1.0 : 0.9) + 0.5 * Math.sin(c.time * (S.ember ? 4 : 2.4)) + (c.anim === "attack" ? bump(c.p, 0.1, 0.4, 0.9) * 1.5 : 0);
      if (aura) {
        (aura.material as THREE.SpriteMaterial).opacity = 0.3 + 0.15 * Math.sin(c.time * 2.4);
        aura.visible = c.anim !== "death" || c.p < 0.8;
      }
    },
  };
  return finish(k, scene, b, hipH + aR[1] * 2 + (S.crown ? 0.1 * z : 0));
}

function addMarks(k: Kit, parent: THREE.Object3D, aR: [number, number, number], S: BugSpec, m: THREE.Material, seed: number, half: 1 | -1 | 0 = 0) {
  const rng = makeRng(seed);
  const top = (x: number, zz: number) => aR[1] * Math.sqrt(Math.max(0, 1 - (x / aR[0]) ** 2 - ((zz + aR[2] * 0.3) / aR[2]) ** 2));
  const zOff = S.kind === "spider" ? -aR[2] * 0.3 : -aR[2] * 0.42;
  const yOff = S.kind === "spider" ? 0 : -aR[1] * 0.15;
  if (S.marks === "spots") {
    const n = half ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const x = half ? half * aR[0] * (0.3 + rng() * 0.3) : (i % 2 ? 1 : -1) * aR[0] * 0.35;
      const zz = zOff + aR[2] * (0.45 - i * (half ? 0.4 : 0.3));
      k.ball(parent, aR[0] * 0.14, aR[1] * 0.1, aR[0] * 0.14, m, x, yOff + top(x, zz - zOff - aR[2] * 0.3 + aR[2] * 0.3) * (S.kind === "spider" ? 1 : 1.2) * 0.97, zz);
    }
  } else if (S.marks === "stripes") {
    for (let i = 0; i < 3; i++) {
      const t = -0.35 + i * 0.35;
      const rad = Math.sqrt(Math.max(0.05, 1 - t * t));
      const g = new THREE.TorusGeometry(1, 0.06, 8, 32, half ? Math.PI : Math.PI * 2);
      g.scale(aR[0] * rad * 1.01, aR[1] * rad * (S.kind === "spider" ? 1.01 : 1.21), 1);
      if (half === -1) g.rotateZ(Math.PI / 2);
      else if (half === 1) g.rotateZ(-Math.PI / 2);
      const mesh = k.mesh(parent, g, m, 0, yOff, zOff + t * aR[2]);
      mesh.scale.z = 0.4;
    }
  } else if (S.marks === "hourglass") {
    k.ball(parent, aR[0] * 0.18, aR[1] * 0.08, aR[2] * 0.22, m, 0, aR[1] * 0.97, zOff + aR[2] * 0.15);
    k.ball(parent, aR[0] * 0.18, aR[1] * 0.08, aR[2] * 0.22, m, 0, aR[1] * 0.9, zOff - aR[2] * 0.3);
  }
}

interface BugParts { S: BugSpec; body: THREE.Group; head: THREE.Group; back: THREE.Group; legs: Leg[]; fangs: THREE.Group[]; shells: THREE.Group[]; hipH: number; cR: number[]; spider: boolean }

function poseBug(c: PoseCtx, P: BugParts) {
  const R = c.rig, time = c.time;
  const breathe = Math.sin(time * 2);
  R.s(P.back, 1 + 0.02 * breathe, 1 + 0.03 * breathe, 1 + 0.02 * breathe);
  P.fangs.forEach((f, i) => R.r(f, 0.1 * Math.sin(time * 3 + i), 0, 0));
  const swing = (l: Leg) => (l.side === 1 ? -1 : 1);

  if (c.anim === "idle") {
    R.r(P.head, 0.05 * Math.sin(time * 0.8), 0.15 * Math.sin(time * 0.5), 0);
    for (const l of P.legs) {
      const tap = Math.pow(Math.max(0, Math.sin(time * 1.3 + l.i * 1.7 + (l.side === 1 ? 0 : 3))), 20);
      R.r(l.femur, 0, 0, 0.25 * tap);
    }
  }
  if (c.anim === "walk") {
    const w = c.t * P.S.speed * Math.PI * 2;
    for (const l of P.legs) {
      const ph = l.group * Math.PI + l.i * 0.35;
      const s = Math.sin(w + ph), cc = Math.cos(w + ph);
      R.r(l.root, 0, swing(l) * 0.3 * s, 0);
      R.r(l.femur, 0, 0, 0.35 * Math.max(0, cc));
    }
    R.p(P.body, 0, 0.015 * P.S.size * Math.sin(2 * w), 0);
    R.r(P.body, 0, 0.04 * Math.sin(w), 0.03 * Math.sin(w));
  }
  if (c.anim === "attack") {
    const rear = ease(c.p, 0, 0.35) * (1 - ease(c.p, 0.4, 0.55));
    const strike = ease(c.p, 0.4, 0.55) * (1 - ease(c.p, 0.65, 1));
    if (P.spider) {
      R.r(P.body, -0.5 * rear + 0.2 * strike, 0, 0);
      R.p(P.body, 0, 0.1 * P.hipH * rear, 0.2 * P.S.size * 0.3 * strike);
      for (const l of P.legs) {
        if (l.i < 2) {
          R.r(l.femur, 0, 0, (l.i === 0 ? 1.1 : 0.6) * rear - 0.15 * strike);
          R.r(l.root, 0, swing(l) * 0.35 * rear, 0);
          R.r(l.knee, 0, 0, -0.5 * rear);
        } else R.r(l.femur, 0, 0, -0.15 * rear);
      }
    } else {
      // Beetles open their shell, then charge with the horn.
      for (const sh of P.shells) {
        const s = sh.position.x >= 0 ? 1 : -1;
        R.r(sh, -0.25 * rear, 0, s * 0.9 * rear);
      }
      R.r(P.body, 0.15 * rear - 0.1 * strike, 0, 0);
      R.p(P.body, 0, 0, -0.04 * P.S.size * rear + 0.25 * P.S.size * strike);
      R.r(P.head, -0.4 * strike + 0.25 * rear, 0, 0);
    }
    P.fangs.forEach((f, i) => R.r(f, P.spider ? -0.5 * rear + 0.4 * strike : 0, P.spider ? 0 : (i ? -1 : 1) * (0.5 * rear - 0.4 * strike), 0));
  }
  if (c.anim === "hit") {
    const h = c.p < 0.14 ? ease(c.p, 0, 0.14) : 1 - ease(c.p, 0.14, 1);
    R.p(P.body, 0, 0.04 * P.S.size * h, -0.07 * P.S.size * h);
    R.r(P.body, -0.25 * h, 0.15 * h, 0);
    for (const l of P.legs) {
      R.r(l.femur, 0, 0, 0.25 * h);
      R.r(l.knee, 0, 0, -0.35 * h);
    }
  }
  if (c.anim === "death") {
    const f = ease(c.p, 0.1, 0.6);
    const hop = bump(c.p, 0.1, 0.35, 0.6);
    R.r(P.body, 0, 0, Math.PI * f);
    R.p(P.body, 0, 0.25 * P.S.size * hop - (P.hipH - P.cR[1] * 1.6) * f, 0);
    const curl = ease(c.p, 0.4, 1);
    for (const l of P.legs) {
      R.r(l.femur, 0, 0, 0.35 * curl + 0.1 * Math.sin(c.t * 25) * (1 - curl) * f);
      R.r(l.knee, 0, 0, -1.1 * curl);
    }
    for (const sh of P.shells) R.r(sh, 0, 0, (sh.position.x >= 0 ? 1 : -1) * 0.15 * curl);
  }
}

// ---------- The bugs ----------

export function caveSpider(variant: number, seed: number) {
  const looks = [
    { body: 0x6a4a36, back: 0x7a5640, leg: 0x5a3e2c, mark: 0xe0c08a, marks: "spots" as const },
    { body: 0x2e2a32, back: 0x38323e, leg: 0x2a262e, mark: 0xb04a6a, marks: "hourglass" as const },
    { body: 0xd8d0c4, back: 0xe8e0d4, leg: 0xc8bcae, mark: 0x9aa8c8, marks: "spots" as const },
  ];
  const L = looks[variant] ?? looks[0];
  return buildBug({ kind: "spider", size: 1.3, c: L, marks: L.marks, iris: 0x8a3a2a, speed: 1.6 }, seed);
}

export function giantSpider(variant: number, seed: number) {
  const looks = [
    { body: 0x2a2228, back: 0x3a2a30, leg: 0x2a2228, mark: 0xd8402a, marks: "hourglass" as const, iris: 0xd8402a },
    { body: 0x3a5a32, back: 0x4a6e3a, leg: 0x34502e, mark: 0xd8e070, marks: "spots" as const, iris: 0x7a3a8a },
    { body: 0x3a3030, back: 0x2e2626, leg: 0x3a3030, mark: 0xe8c040, marks: "stripes" as const, iris: 0xe08a2a },
  ];
  const L = looks[variant] ?? looks[0];
  return buildBug({ kind: "spider", size: 3.2, c: L, marks: L.marks, iris: L.iris, speed: 1.1 }, seed);
}

export function thornmother(variant: number, seed: number) {
  const blighted = variant === 1;
  return buildBug({
    kind: "spider", size: 9,
    c: blighted ? { body: 0x8a9096, back: 0x9aa0a6, leg: 0x7a8086, mark: 0xdffaf0 } : { body: 0x3a2a3e, back: 0x4a3450, leg: 0x34263a, mark: 0x9fe3c0 },
    marks: "stripes", iris: BLIGHT_GLOW, glowEyes: true, blight: true, thorns: true, crown: true, speed: 0.6,
  }, seed);
}

export function fireBeetle(variant: number, seed: number) {
  const lava = variant === 1;
  return buildBug({
    kind: "beetle", size: 2.1,
    c: lava ? { body: 0x2a2224, back: 0x3a2a2a, leg: 0x2a2224, mark: 0xff9a3a, glow: 0xff5a1a } : { body: 0x3a2018, back: 0xb8341e, leg: 0x2a1812, mark: 0x1e1412, glow: 0xffa040 },
    marks: lava ? "stripes" : "spots", iris: 0xe0602a, horn: 0.1, ember: true, speed: 1.6,
  }, seed);
}

export function dustTitan(variant: number, seed: number) {
  const blighted = variant === 0;
  return buildBug({
    kind: "beetle", size: 14,
    c: blighted ? { body: 0x8c8a84, back: 0xa8a49a, leg: 0x7a776f, mark: 0xdffaf0 } : { body: 0x8a6a48, back: 0xc8a070, leg: 0x6a523a, mark: 0x7a5a3a },
    marks: blighted ? "stripes" : "spots", iris: blighted ? BLIGHT_GLOW : 0xe0a040, glowEyes: blighted, blight: blighted, horn: 0.16, speed: 0.5,
  }, seed);
}
