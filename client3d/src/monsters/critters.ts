// Small and strange monsters: the chicken, the slime, the giant bat, the
// will-o'-wisp and the Graveyard ghost (a drained Kindled).
import * as THREE from "three";
import { makeWing } from "./beasts";
import { Body, Kit, PoseCtx, bump, ease, finish, shade } from "./kit";

// ---------- Chicken ----------

export function chicken(variant: number, seed: number) {
  void seed;
  const k = new Kit();
  const looks = [
    { body: 0xf6f2e8, wing: 0xe8e0d0, tail: 0xefe8da },
    { body: 0xb8743e, wing: 0x9a5a2e, tail: 0x7a4422 },
    { body: 0xc8562a, wing: 0xe0a040, tail: 0x1e4a3a },
  ];
  const L = looks[variant] ?? looks[0];
  const rooster = variant === 2;
  const bodyM = k.mat(L.body, { roughness: 0.85 });
  const wingM = k.mat(L.wing, { roughness: 0.85 });
  const tailM = k.mat(L.tail, { roughness: 0.7 });
  const leg = k.mat(0xf0a030, { roughness: 0.6 });
  const red = k.mat(0xe0302a, { roughness: 0.5 });
  const beakM = k.mat(0xf2b02a, { roughness: 0.45 });

  const scene = new THREE.Group();
  const root = k.joint(scene, 0, 0, 0, "root");
  const hipY = 0.2;
  const body = k.joint(root, 0, hipY + 0.1, 0, "body");
  k.ball(body, 0.13, 0.12, 0.16, bodyM);
  k.ball(body, 0.1, 0.09, 0.11, bodyM, 0, -0.03, 0.08);
  // Tail feathers.
  const tail = k.joint(body, 0, 0.04, -0.13);
  for (let i = -1; i <= 1; i++) {
    const f = k.ball(tail, 0.035, rooster ? 0.17 : 0.09, 0.05, tailM, i * 0.04, rooster ? 0.12 : 0.07, 0);
    f.rotation.set(-0.7 - Math.abs(i) * 0.2, 0, i * 0.35);
  }
  // Wings.
  const wings: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const w = k.joint(body, s * 0.12, 0.02, 0);
    k.ball(w, 0.03, 0.08, 0.12, wingM, s * 0.01, -0.02, -0.02).rotation.x = 0.3;
    wings.push(w);
  }
  // Neck and head.
  const neck = k.joint(body, 0, 0.08, 0.1, "neck");
  k.ball(neck, 0.06, 0.08, 0.06, bodyM, 0, 0.05, 0.01);
  const head = k.joint(neck, 0, 0.13, 0.02, "head");
  k.ball(head, 0.075, 0.072, 0.075, bodyM);
  const beak = k.mesh(head, new THREE.ConeGeometry(0.025, 0.06, 16), beakM, 0, -0.005, 0.09);
  beak.rotation.x = Math.PI / 2;
  for (let i = 0; i < (rooster ? 4 : 3); i++) k.ball(head, 0.012, rooster ? 0.035 : 0.025, 0.022, red, 0, 0.07 + Math.sin((i / 3) * Math.PI) * 0.015, 0.03 - i * 0.025);
  k.ball(head, 0.014, rooster ? 0.03 : 0.02, 0.012, red, 0, -0.05, 0.065);
  k.eyes(head, [0.075, 0.072, 0.075], [0, 0, 0], { size: 0.02, iris: 0x1e1410, lid: L.body, white: false, spread: 0.9, up: 0.25, forward: 0.2 });
  // Legs.
  const legs: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const hip = k.joint(body, s * 0.05, -0.1, 0.01);
    k.bone(hip, 0.2, 0.012, 0.01, leg);
    for (const a of [-0.55, 0, 0.55]) {
      const toe = k.bone(hip, 0.06, 0.008, 0.006, leg);
      toe.position.y = -0.2;
      toe.rotation.set(-Math.PI / 2 + 0.05, a, 0);
    }
    legs.push(hip);
  }

  const b: Body = {
    durations: { attack: 0.7, hit: 0.5, death: 1 },
    pose(c) {
      const R = c.rig, time = c.time;
      // Idle: looks about and pecks at the ground now and then.
      if (c.anim === "idle") {
        const peck = Math.pow(Math.max(0, Math.sin(time * 1.3)), 10);
        R.r(neck, 1.1 * peck, 0, 0);
        R.r(head, 0.5 * peck, 0.6 * Math.sin(time * 0.8) * (1 - peck), 0);
        R.r(tail, 0, 0, 0.1 * Math.sin(time * 3));
      }
      if (c.anim === "walk") {
        const w = c.t * 2.6 * Math.PI * 2, s = Math.sin(w);
        R.r(legs[0], -0.6 * s, 0, 0);
        R.r(legs[1], 0.6 * s, 0, 0);
        R.p(neck, 0, 0, 0.03 * Math.sin(2 * w));
        R.p(body, 0, 0.015 * Math.abs(Math.cos(w)), 0);
        R.r(body, 0, 0.08 * s, 0.05 * s);
      }
      if (c.anim === "attack") {
        const peck = bump(c.p, 0.2, 0.45, 0.7);
        const up = ease(c.p, 0, 0.2) * (1 - ease(c.p, 0.8, 1));
        R.r(neck, 1.0 * peck - 0.3 * up * (1 - peck), 0, 0);
        R.p(body, 0, 0.05 * bump(c.p, 0, 0.25, 0.5), 0.08 * peck);
        wings.forEach((w, i) => R.r(w, 0, 0, (i ? -1 : 1) * 1.1 * up * (0.6 + 0.4 * Math.sin(c.t * 40))));
      }
      if (c.anim === "hit") {
        const h = c.p < 0.15 ? ease(c.p, 0, 0.15) : 1 - ease(c.p, 0.15, 1);
        R.p(body, 0, 0.12 * h, -0.06 * h);
        R.r(body, -0.4 * h, 0, 0);
        wings.forEach((w, i) => R.r(w, 0, 0, (i ? -1 : 1) * 1.3 * h));
        R.r(neck, -0.4 * h, 0, 0);
      }
      if (c.anim === "death") {
        const f = ease(c.p, 0.1, 0.55);
        R.r(body, 0, 0, 1.5 * f);
        R.p(body, 0, -0.18 * f, 0);
        R.r(neck, 0.5 * f, 0, 0.4 * f);
        legs.forEach((l, i) => R.r(l, (i ? -0.4 : 0.3) * f, 0, 0));
        wings.forEach((w, i) => R.r(w, 0, 0, (i ? -1 : 1) * 0.5 * f));
      }
    },
  };
  return finish(k, scene, b, 0.6);
}

// ---------- Slime ----------

export function slime(variant: number, seed: number) {
  void seed;
  const k = new Kit();
  const cols = [0x6fd06a, 0x5aaee8, 0xf08ab8];
  const col = cols[variant] ?? cols[0];
  const scene = new THREE.Group();
  const root = k.joint(scene, 0, 0, 0, "root");
  const blob = k.joint(root, 0, 0, 0, "blob");
  const R0 = 0.3, H = 0.56;
  const gumdrop: THREE.Vector2[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20; // 0 bottom centre .. 1 top
    const a = t * Math.PI;
    const r = i === 0 || i === 20 ? 1e-4 : R0 * Math.pow(Math.sin(a), 0.7) * (1 + 0.3 * (1 - t));
    const y = H * (1 - Math.cos(a)) / 2;
    gumdrop.push(new THREE.Vector2(r, i === 0 ? 0.0 : y));
  }
  const body = k.mat(col, { roughness: 0.18, metalness: 0.0 });
  const g = new THREE.LatheGeometry(gumdrop, 40);
  k.mesh(blob, g, body);
  k.ball(blob, 0.07, 0.04, 0.05, k.mat(0xffffff, { roughness: 0.1, opacity: 0.7 }), -0.1, H * 0.82, 0.08).rotation.z = 0.5;
  k.eyes(blob, [R0 * 1.12, H * 0.5, R0 * 1.12], [0, H * 0.5, 0], { size: 0.075, iris: 0x1e2430, lid: col, white: true, spread: 0.42, up: 0.25, forward: 0.5, pupil: 0.6 });
  const mouth = k.ball(blob, 0.04, 0.02, 0.02, k.mat(0x2a1a22), 0, H * 0.34, R0 * 1.02);
  mouth.rotation.x = 0.4;
  // A few bubbles floating inside.
  const bubbles: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) bubbles.push(k.ball(blob, 0.025, 0.025, 0.025, k.mat(shade(col, 1.4), { roughness: 0.1, opacity: 0.7 }), 0, 0, 0));

  const b: Body = {
    durations: { attack: 0.8, hit: 0.5, death: 1.1 },
    follow: 20,
    pose(c) {
      const R = c.rig, time = c.time;
      const wob = Math.sin(time * 3.2);
      R.s(blob, 1 + 0.04 * wob, 1 - 0.05 * wob, 1 + 0.04 * wob);
      if (c.anim === "walk") {
        const ph = (c.t * 1.6) % 1;
        const air = Math.sin(Math.min(1, ph / 0.7) * Math.PI);
        const squash = ph > 0.7 ? Math.sin(((ph - 0.7) / 0.3) * Math.PI) : 0;
        R.p(blob, 0, 0.28 * air, 0);
        R.s(blob, 1 - 0.1 * air + 0.22 * squash, 1 + 0.18 * air - 0.3 * squash, 1 - 0.1 * air + 0.22 * squash);
      }
      if (c.anim === "attack") {
        const wind = ease(c.p, 0, 0.35) * (1 - ease(c.p, 0.35, 0.45));
        const lunge = ease(c.p, 0.35, 0.5) * (1 - ease(c.p, 0.6, 1));
        R.s(blob, 1 + 0.25 * wind - 0.1 * lunge, 1 - 0.3 * wind + 0.15 * lunge, 1 + 0.2 * wind + 0.45 * lunge);
        R.p(blob, 0, 0.12 * lunge, 0.35 * lunge);
        R.r(blob, 0.25 * lunge, 0, 0);
      }
      if (c.anim === "hit") {
        const h = c.p < 0.12 ? ease(c.p, 0, 0.12) : 1 - ease(c.p, 0.12, 1);
        const jig = Math.sin(c.t * 30) * (1 - c.p);
        R.s(blob, 1 + 0.35 * h + 0.06 * jig, 1 - 0.4 * h - 0.06 * jig, 1 + 0.35 * h + 0.06 * jig);
        R.p(blob, 0, 0, -0.12 * h);
      }
      if (c.anim === "death") {
        const f = ease(c.p, 0.1, 0.8);
        R.s(blob, 1 + 0.8 * f, Math.max(0.08, 1 - 0.9 * f), 1 + 0.8 * f);
      }
    },
    fx(c) {
      bubbles.forEach((bb, i) => {
        const t = (c.time * 0.25 + i * 0.27) % 1;
        bb.position.set(Math.sin(i * 2.4 + c.time) * 0.12, 0.05 + t * H * 0.8, Math.cos(i * 1.7) * 0.1 - 0.04);
        bb.scale.setScalar(Math.sin(t * Math.PI));
      });
    },
  };
  return finish(k, scene, b, H);
}

// ---------- Giant bat ----------

export function giantBat(variant: number, seed: number) {
  void seed;
  const k = new Kit();
  const looks = [
    { fur: 0x6a4a3a, wing: 0x4a3330, bone: 0x3a2622, inner: 0xd89a92 },
    { fur: 0x2e2a30, wing: 0x242026, bone: 0x18151a, inner: 0xb07a80 },
    { fur: 0xcfc4b8, wing: 0xa89890, bone: 0x8a7a70, inner: 0xf0b8b0 },
  ];
  const L = looks[variant] ?? looks[0];
  const fur = k.mat(L.fur, { roughness: 0.85 });
  const scene = new THREE.Group();
  const root = k.joint(scene, 0, 0, 0, "root");
  const flyY = 1.35;
  const body = k.joint(root, 0, flyY, 0, "body");
  k.ball(body, 0.12, 0.14, 0.11, fur);
  k.ball(body, 0.08, 0.1, 0.05, k.mat(shade(L.fur, 1.25)), 0, -0.02, 0.07);
  const head = k.joint(body, 0, 0.17, 0.03, "head");
  k.ball(head, 0.11, 0.1, 0.1, fur);
  k.ball(head, 0.045, 0.035, 0.035, k.mat(shade(L.fur, 1.2)), 0, -0.03, 0.09);
  k.ball(head, 0.012, 0.009, 0.008, k.mat(0x2a1a1a), 0, -0.015, 0.125);
  const fang = k.mat(0xfffbee, { roughness: 0.3 });
  for (const s of [1, -1]) {
    const f = k.horn(head, 0.03, 0.008, fang, 0, s * 0.018, -0.06, 0.095);
    f.rotation.x = Math.PI;
  }
  const ears: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const e = k.joint(head, s * 0.06, 0.07, -0.01);
    const g = new THREE.ConeGeometry(0.06, 0.16, 18);
    g.translate(0, 0.07, 0);
    g.scale(1, 1, 0.4);
    k.mesh(e, g, fur);
    const gi = new THREE.ConeGeometry(0.04, 0.12, 16);
    gi.translate(0, 0.06, 0);
    gi.scale(1, 1, 0.3);
    k.mesh(e, gi, k.mat(L.inner), 0, 0, 0.012);
    e.rotation.set(0, 0, -s * 0.35);
    ears.push(e);
  }
  k.eyes(head, [0.11, 0.1, 0.1], [0, 0, 0], { size: 0.035, iris: 0xd8442a, lid: L.fur, white: false, spread: 0.5, up: 0.25, cross: true, pupil: 0.45 });
  const wings = [1, -1].map((s) => makeWing(k, body, s as 1 | -1, 0.62, L.wing, L.bone, [0.08, 0.06, 0]));
  for (const w of wings) w.root.rotation.set(0, 0, w.side * 0.25);
  for (const s of [1, -1]) {
    const f = k.bone(body, 0.08, 0.015, 0.01, k.mat(L.bone));
    f.position.set(s * 0.04, -0.12, -0.02);
  }

  const b: Body = {
    durations: { attack: 0.9, hit: 0.6, death: 1.2 },
    follow: 22,
    pose(c) {
      const R = c.rig, time = c.time;
      let flap = 9, amp = 0.75;
      if (c.anim === "walk") {
        flap = 11;
        R.r(body, 0.35, 0, 0.12 * Math.sin(time * 1.5));
        R.p(body, 0.25 * Math.sin(time * 1.5), 0, 0);
      }
      if (c.anim === "attack") {
        const dive = bump(c.p, 0.15, 0.45, 0.85);
        const wind = bump(c.p, 0, 0.15, 0.3);
        R.p(body, 0, -0.55 * dive + 0.15 * wind, 0.7 * dive - 0.1 * wind);
        R.r(body, 0.6 * dive - 0.3 * wind, 0, 0);
        R.r(head, -0.4 * dive, 0, 0);
        amp = 0.75 - 0.5 * dive;
        flap = 12;
      }
      if (c.anim === "hit") {
        const h = c.p < 0.15 ? ease(c.p, 0, 0.15) : 1 - ease(c.p, 0.15, 1);
        R.p(body, 0, 0.1 * h, -0.25 * h);
        R.r(body, -0.9 * h, 0, 0.5 * h);
        flap = 16;
      }
      const dead = c.anim === "death";
      const f = dead ? ease(c.p, 0.05, 0.55) : 0;
      if (dead) {
        amp = 0.75 * (1 - ease(c.p, 0, 0.3));
        R.p(body, 0, -(flyY - 0.1) * f, 0);
        R.r(body, 1.3 * f, 0, 0);
        for (const w of wings) {
          R.r(w.root, 0, 0, -w.side * 0.25 * f);
          R.r(w.outer, 0, 0, w.side * 0.5 * f);
        }
      }
      const s = Math.sin(time * flap);
      for (const w of wings) {
        R.r(w.root, 0, 0, w.side * amp * s);
        R.r(w.outer, 0, 0, w.side * 0.45 * amp * Math.sin(time * flap - 0.8));
      }
      if (!dead) R.p(body, 0, 0.07 * Math.sin(time * flap + 1.3), 0);
      ears.forEach((e, i) => R.r(e, 0.1 * Math.sin(time * 2 + i), 0, 0));
    },
  };
  return finish(k, scene, b, flyY + 0.3);
}

// ---------- Will-o'-wisp ----------

export function wisp(variant: number, seed: number) {
  void seed;
  const k = new Kit();
  const cols = [0x7fd8ff, 0xa6ff9a, 0xffd76a];
  const col = cols[variant] ?? cols[0];
  const scene = new THREE.Group();
  const root = k.joint(scene, 0, 0, 0, "root");
  const floatY = 1.0;
  const orb = k.joint(root, 0, floatY, 0, "orb");
  const core = k.mat(shade(col, 1.55), { glow: col, glowStrength: 1.1, roughness: 0.3 });
  k.ball(orb, 0.15, 0.15, 0.15, core);
  const shellM = k.mat(col, { glow: col, glowStrength: 0.8, opacity: 0.22, roughness: 0.2 });
  const shell = k.ball(orb, 0.22, 0.22, 0.22, shellM, 0, 0, 0);
  shell.castShadow = false;
  // A flickering flame tail.
  const tail = k.joint(orb, 0, 0.05, -0.05);
  const tp: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    tp.push(new THREE.Vector2(Math.max(1e-4, 0.19 * Math.sin(Math.PI * Math.pow(1 - t, 0.6)) * (1 - t * 0.2)), t * 0.55));
  }
  const flameM = k.mat(col, { glow: col, glowStrength: 1.2, opacity: 0.45, roughness: 0.3 });
  const flame = k.mesh(tail, new THREE.LatheGeometry(tp, 24), flameM, 0, -0.05, 0, false);
  tail.rotation.x = -0.55;
  void flame;
  k.eyes(orb, [0.15, 0.15, 0.15], [0, 0, 0], { size: 0.048, iris: shade(col, 0.35), lid: shade(col, 1.5), white: false, spread: 0.45, up: 0.05, forward: 0.4, pupil: 0.5 });
  const halo = k.glowSprite(col, 1.3, 0.55);
  orb.add(halo);
  const sparks: THREE.Mesh[] = [];
  const sparkM = k.mat(0xffffff, { glow: col, glowStrength: 2, roughness: 0.3 });
  for (let i = 0; i < 6; i++) sparks.push(k.ball(orb, 0.022, 0.022, 0.022, sparkM));
  const light = new THREE.PointLight(col, 2.2, 4, 1.6);
  orb.add(light);

  const b: Body = {
    durations: { attack: 0.9, hit: 0.5, death: 1.4 },
    pose(c) {
      const R = c.rig, time = c.time;
      R.p(orb, 0.05 * Math.sin(time * 0.9), 0.1 * Math.sin(time * 1.7), 0);
      R.r(tail, 0.15 * Math.sin(time * 5), 0, 0.2 * Math.sin(time * 3.3));
      R.s(tail, 1, 1 + 0.15 * Math.sin(time * 9), 1);
      if (c.anim === "walk") {
        R.p(orb, 0.4 * Math.sin(c.t * 1.2), 0.08 * Math.sin(c.t * 2.4), 0);
        R.r(tail, -0.6, 0, 0);
        R.s(tail, 1, 1.4, 1);
      }
      if (c.anim === "attack") {
        const fl = bump(c.p, 0.1, 0.4, 0.9);
        R.s(orb, 1 + 0.5 * fl);
        R.p(orb, 0, 0.1 * fl, 0.4 * bump(c.p, 0.3, 0.45, 0.8));
      }
      if (c.anim === "hit") {
        const h = c.p < 0.15 ? ease(c.p, 0, 0.15) : 1 - ease(c.p, 0.15, 1);
        R.p(orb, 0.06 * Math.sin(c.t * 50) * h, 0, -0.3 * h);
        R.s(orb, 1 - 0.25 * h);
      }
      if (c.anim === "death") {
        const f = ease(c.p, 0, 0.9);
        R.s(orb, Math.max(0.05, 1 - 0.75 * f));
        R.p(orb, 0, -0.5 * f, 0);
      }
    },
    fx(c) {
      const burst = c.anim === "attack" ? bump(c.p, 0.25, 0.45, 0.9) : 0;
      const scatter = c.anim === "death" ? ease(c.p, 0, 0.8) : 0;
      sparks.forEach((s, i) => {
        const a = c.time * (1.2 + i * 0.15) + (i * Math.PI * 2) / sparks.length;
        const r = 0.32 + 0.06 * Math.sin(c.time * 2 + i) + burst * 0.5 + scatter * 1.2;
        s.position.set(Math.cos(a) * r, 0.1 * Math.sin(a * 2) + scatter * 0.6, Math.sin(a) * r + burst * 0.5);
        s.visible = scatter < 0.95;
      });
      const flick = 1 + 0.1 * Math.sin(c.time * 13) + 0.06 * Math.sin(c.time * 29);
      const dim = c.anim === "death" ? 1 - ease(c.p, 0.2, 1) : 1;
      light.intensity = 2.2 * flick * dim * (1 + burst);
      (halo.material as THREE.SpriteMaterial).opacity = 0.5 * flick * dim;
      core.emissiveIntensity = 1.1 * flick * dim + burst;
    },
  };
  return finish(k, scene, b, floatY + 0.4);
}

// ---------- Graveyard ghost (a drained Kindled) ----------

export function ghost(variant: number, seed: number) {
  void seed;
  const k = new Kit();
  const col = variant === 0 ? 0xe6f0ff : 0xd8e6f2;
  const scene = new THREE.Group();
  const root = k.joint(scene, 0, 0, 0, "root");
  const floatY = 0.25;
  const body = k.joint(root, 0, floatY, 0, "body");
  const pts: THREE.Vector2[] = [];
  const H = 1.25;
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    const y = t * H;
    // A sheet: wide skirt, narrow waist, round head.
    const head = t > 0.62 ? Math.sqrt(Math.max(0, 1 - ((t - 0.8) / 0.2) ** 2)) * 0.3 : 0;
    const skirt = 0.34 - t * 0.18;
    pts.push(new THREE.Vector2(Math.max(1e-4, t > 0.62 ? Math.max(head, t < 0.8 ? 0.22 : 0) : skirt), y));
  }
  pts[pts.length - 1].x = 1e-4;
  const g = new THREE.LatheGeometry(pts, 36);
  // A wavy hem.
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < 0.05) {
      const a = Math.atan2(pos.getZ(i), pos.getX(i));
      pos.setY(i, y + 0.05 * Math.sin(a * 7));
    }
  }
  g.computeVertexNormals();
  const sheet = k.mat(col, { glow: 0x9ab8ff, glowStrength: 0.35, opacity: 0.82, roughness: 0.5, double: true });
  k.mesh(body, g, sheet, 0, 0, 0, false);
  const arms: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const a = k.joint(body, s * 0.22, 0.62, 0.02);
    const m = k.bone(a, 0.28, 0.07, 0.05, sheet);
    m.castShadow = false;
    a.rotation.z = s * 0.5;
    arms.push(a);
  }
  const headC: [number, number, number] = [0, H * 0.8, 0];
  k.eyes(body, [0.3, 0.27, 0.3], headC, { size: 0.065, iris: 0x34405a, lid: col, white: true, spread: 0.35, up: 0.05, forward: 0.5, tall: 1.25, pupil: 0.55 });
  const mouth = k.ball(body, 0.035, 0.045, 0.02, k.mat(0x3a4a64), 0, H * 0.8 - 0.12, 0.27);
  void mouth;
  // A thread of light still ties it to the old shrine.
  let thread: THREE.Mesh | null = null;
  const threadM = k.mat(0xffe08a, { glow: 0xffc84a, glowStrength: 1.4, opacity: 0.8 });
  if (variant === 1) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, H + 0.02, 0), new THREE.Vector3(0.15, H + 0.6, -0.2), new THREE.Vector3(-0.1, H + 1.3, -0.5), new THREE.Vector3(0.2, H + 2.2, -0.9)]);
    thread = k.mesh(body, new THREE.TubeGeometry(curve, 30, 0.01, 6, false), threadM, 0, 0, 0, false);
  }
  const halo = k.glowSprite(0xbcd0ff, 1.8, 0.35);
  halo.position.y = H * 0.55;
  body.add(halo);

  const b: Body = {
    durations: { attack: 1.0, hit: 0.5, death: 1.6 },
    pose(c) {
      const R = c.rig, time = c.time;
      R.p(body, 0, 0.08 * Math.sin(time * 1.6), 0);
      R.r(body, 0.04 * Math.sin(time * 0.9), 0, 0.05 * Math.sin(time * 1.1));
      arms.forEach((a, i) => R.r(a, 0.2 * Math.sin(time * 1.6 + i), 0, (i ? -1 : 1) * 0.1 * Math.sin(time * 1.3)));
      if (c.anim === "walk") {
        R.r(body, 0.25, 0, 0);
        R.p(body, 0.2 * Math.sin(c.t * 1.1), 0, 0);
        arms.forEach((a) => R.r(a, 0.6, 0, 0));
      }
      if (c.anim === "attack") {
        const boo = bump(c.p, 0.15, 0.4, 0.85);
        arms.forEach((a, i) => R.r(a, -1.6 * boo, 0, (i ? 1 : -1) * 0.7 * boo));
        R.s(body, 1 + 0.25 * boo);
        R.p(body, 0, 0.1 * boo, 0.25 * boo);
      }
      if (c.anim === "hit") {
        const h = c.p < 0.15 ? ease(c.p, 0, 0.15) : 1 - ease(c.p, 0.15, 1);
        R.p(body, 0, 0, -0.25 * h);
        R.r(body, -0.3 * h, 0, 0);
      }
      if (c.anim === "death") {
        const f = ease(c.p, 0, 1);
        R.p(body, 0, 1.4 * f, 0);
        R.s(body, 1 - 0.3 * f);
      }
    },
    fx(c) {
      const fade = c.anim === "death" ? 1 - ease(c.p, 0.1, 1) : 1;
      sheet.opacity = 0.82 * (0.6 + 0.4 * fade) * (c.anim === "hit" ? 0.6 + 0.4 * Math.abs(Math.sin(c.t * 30)) : 1);
      (halo.material as THREE.SpriteMaterial).opacity = 0.35 * fade;
      if (thread) threadM.opacity = 0.8 * (c.anim === "death" ? fade : 0.7 + 0.3 * Math.sin(c.time * 2));
    },
  };
  return finish(k, scene, b, floatY + H + 0.1);
}
