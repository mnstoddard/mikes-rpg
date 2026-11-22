// Ground decorations: the little things that make the ground feel alive
// (grass tufts, flowers, rocks, bushes...) and street furniture (lamps, wells,
// gravestones, barrels, signposts). Each stands on y = 0, centred on x = z = 0.
import * as THREE from "three";
import { EnvPiece, NightLights, Parts, Rng, Swayer, disposeGroup, glowMat, jitter, lamp, makeRng, mat, mesh, mix, rockGeo } from "./kit";

export interface DecorOptions {
  variant: number;
  seed: number;
}
type Builder = (o: DecorOptions) => EnvPiece;

function make(group: THREE.Group, update?: EnvPiece["update"], poke?: () => void): EnvPiece {
  return { object: group, update: update ?? (() => {}), poke, dispose: () => disposeGroup(group) };
}
const VC2 = () => mat(0xffffff, { vertexColors: true, double: true });

/** A spot inside a circle of radius r. */
function inCircle(rng: Rng, r: number): [number, number] {
  const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r;
  return [Math.cos(a) * d, Math.sin(a) * d];
}

const TUFTS = [
  { c: [0x4e8a2e, 0x9ccc5a, 0xb4d86a], h: 0.5 }, // green
  { c: [0x6aa843, 0x8cbc4a, 0xb8c46a], h: 0.75 }, // tall meadow
  { c: [0xb8a868, 0xa89458, 0xc8b878], h: 0.45 }, // dry
];

export const grassTufts: Builder = (o) => {
  const p = TUFTS[o.variant] ?? TUFTS[0];
  const rng = makeRng(o.seed);
  const group = new THREE.Group();
  const sway = new Swayer();
  for (let t = 0; t < 7; t++) {
    const [x, z] = inCircle(rng, 0.8);
    const parts = new Parts();
    const n = 7 + Math.floor(rng() * 6);
    for (let k = 0; k < n; k++) {
      const h = p.h * (0.5 + rng() * 0.6);
      const g = new THREE.ConeGeometry(0.045 + rng() * 0.02, h, 3);
      g.scale(1, 1, 0.35);
      g.translate(0, h / 2, 0);
      g.rotateZ((rng() - 0.5) * 0.9);
      g.rotateY(rng() * 6.28);
      g.translate((rng() - 0.5) * 0.08, 0, (rng() - 0.5) * 0.08);
      parts.add(g, jitter(p.c[Math.floor(rng() * p.c.length)], rng, 0.06));
    }
    if (o.variant === 1) {
      // Seed heads on the tall grass.
      for (let k = 0; k < 3; k++) {
        const g = new THREE.ConeGeometry(0.025, 0.12, 4);
        g.translate((rng() - 0.5) * 0.15, p.h * (0.9 + rng() * 0.2), (rng() - 0.5) * 0.15);
        parts.add(g, 0xd8c88a);
      }
    }
    const m = parts.build(VC2())!;
    m.position.set(x, 0, z);
    group.add(m);
    sway.add(m, 0.1, rng() * 6);
  }
  return make(group, (dt, t, env) => sway.update(dt, t, env.wind), () => (sway.gust = 1));
};

const FLOWERS = [
  [[0xffffff, 0xf6d84a]], // daisies (petal, middle)
  [[0xe03a2a, 0x2a2a2a]], // poppies
  [[0x6a7ae0, 0x4a5ac0]], // bluebells
  [[0xffffff, 0xf6d84a], [0xe03a2a, 0x2a2a2a], [0xf2d24a, 0xc88a2a], [0xb08ae0, 0xf6e08a], [0xf4a8c8, 0xf6d84a]], // mixed
];

export const wildflowers: Builder = (o) => {
  const set = FLOWERS[o.variant] ?? FLOWERS[0];
  const rng = makeRng(o.seed);
  const group = new THREE.Group();
  const sway = new Swayer();
  for (let i = 0; i < 22; i++) {
    const [x, z] = inCircle(rng, 0.9);
    const [petal, mid] = set[Math.floor(rng() * set.length)];
    const p = new Parts();
    const h = 0.18 + rng() * 0.22;
    p.box(0.014, h, 0.014, 0x4e8a34, 0, h / 2, 0);
    const lf = new THREE.ConeGeometry(0.035, 0.12, 3);
    lf.scale(1, 1, 0.25);
    lf.rotateZ(0.8);
    lf.translate(0.03, h * 0.35, 0);
    p.add(lf, 0x5e9a3a);
    if (o.variant === 2 || (o.variant === 3 && petal === 0x6a7ae0)) {
      // Bluebells hang down in a row.
      for (let k = 0; k < 4; k++) {
        const b = new THREE.ConeGeometry(0.03, 0.06, 5);
        b.translate(0.03 + k * 0.012, h - k * 0.05, 0);
        p.add(b, jitter(petal, rng, 0.08));
      }
    } else {
      const n = petal === 0xe03a2a ? 4 : 6;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const pet = new THREE.SphereGeometry(petal === 0xe03a2a ? 0.045 : 0.03, 4, 2);
        pet.scale(1, 0.3, 0.6);
        pet.translate(petal === 0xe03a2a ? 0.035 : 0.04, 0, 0);
        pet.rotateY(a);
        pet.translate(0, h, 0);
        p.add(pet, jitter(petal, rng, 0.05));
      }
      const m = new THREE.IcosahedronGeometry(0.022, 0);
      m.translate(0, h + 0.01, 0);
      p.add(m, mid);
    }
    const m = p.build(VC2())!;
    m.position.set(x, 0, z);
    m.rotation.y = rng() * 6;
    group.add(m);
    sway.add(m, 0.12, rng() * 6);
  }
  return make(group, (dt, t, env) => sway.update(dt, t, env.wind), () => (sway.gust = 1));
};

const ROCKS = [
  { c: [0x8e8a82, 0x7e7a72, 0x9e9a90], moss: 0 },
  { c: [0x7e8076, 0x8a8a80], moss: 0x5e8a3a },
  { c: [0xc8b490, 0xb8a080, 0xd8c8a8], moss: 0 },
];

export const rocks: Builder = (o) => {
  const p = ROCKS[o.variant] ?? ROCKS[0];
  const rng = makeRng(o.seed);
  const parts = new Parts();
  const sizes = o.variant === 2 ? [0.18, 0.14, 0.1, 0.08, 0.08, 0.06] : [0.55, 0.32, 0.22, 0.14, 0.1];
  sizes.forEach((r, i) => {
    const [x, z] = i === 0 ? [0, 0] : inCircle(rng, 0.8);
    const g = rockGeo(r, rng, 0.7);
    g.rotateY(rng() * 6);
    g.translate(x, r * 0.35, z);
    parts.add(g, jitter(p.c[Math.floor(rng() * p.c.length)], rng, 0.06));
    if (p.moss) {
      const m = rockGeo(r * 0.75, rng, 0.35);
      m.translate(x, r * 0.62, z);
      parts.add(m, jitter(p.moss, rng, 0.1));
    }
  });
  const group = new THREE.Group();
  group.add(parts.build()!);
  return make(group);
};

const BUSHES = [
  { leaf: [0x4e8e34, 0x5e9e3c, 0x3e7a2e], dots: 0 },
  { leaf: [0x3e7a2e, 0x4e8a34], dots: 0xd02a3a }, // berries
  { leaf: [0x4e8e34, 0x5e9e3c], dots: 0xf4b8d8 }, // flowering
];

export const bush: Builder = (o) => {
  const p = BUSHES[o.variant] ?? BUSHES[0];
  const rng = makeRng(o.seed);
  const parts = new Parts();
  for (let i = 0; i < 9; i++) {
    const r = 0.28 + rng() * 0.18;
    const [x, z] = inCircle(rng, 0.38);
    const g = new THREE.IcosahedronGeometry(r, 0);
    g.translate(x, r * 0.9 + rng() * 0.25, z);
    parts.add(g, jitter(p.leaf[Math.floor(rng() * p.leaf.length)], rng, 0.06));
  }
  if (p.dots) {
    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2, el = rng() * 1.2;
      const g = new THREE.IcosahedronGeometry(o.variant === 1 ? 0.04 : 0.05, 0);
      g.translate(Math.cos(a) * Math.cos(el) * 0.62, 0.45 + Math.sin(el) * 0.45, Math.sin(a) * Math.cos(el) * 0.62);
      parts.add(g, jitter(p.dots, rng, 0.08));
    }
  }
  const group = new THREE.Group();
  const m = parts.build()!;
  group.add(m);
  const sway = new Swayer();
  sway.add(m, 0.015, rng() * 6);
  return make(group, (dt, t, env) => sway.update(dt, t, env.wind), () => (sway.gust = 1));
};

const SHROOMS = [
  { cap: 0xd83a2a, spots: 0xffffff, stem: 0xf2ead8, glow: 0 },
  { cap: 0x9a6a42, spots: 0, stem: 0xe8dcc0, glow: 0 },
  { cap: 0x5ab8e8, spots: 0xc8f0ff, stem: 0xd8e8f0, glow: 0x3aa8e8 },
];

export const mushrooms: Builder = (o) => {
  const p = SHROOMS[o.variant] ?? SHROOMS[0];
  const rng = makeRng(o.seed);
  const group = new THREE.Group();
  const lights = new NightLights();
  const capMat = p.glow ? glowMat(p.cap, p.glow) : mat(p.cap);
  if (p.glow) lights.addMat(capMat as THREE.MeshStandardMaterial, 0.4, 1.8);
  const stems = new Parts();
  const caps = new Parts();
  for (let i = 0; i < 6; i++) {
    const [x, z] = i === 0 ? [0, 0] : inCircle(rng, 0.35);
    const s = i === 0 ? 1 : 0.4 + rng() * 0.5;
    const h = 0.22 * s;
    const st = new THREE.CylinderGeometry(0.035 * s, 0.05 * s, h, 6);
    st.translate(x, h / 2, z);
    stems.add(st, p.stem);
    const cap = new THREE.SphereGeometry(0.12 * s, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.scale(1, 0.75, 1);
    cap.translate(x, h * 0.92, z);
    caps.add(cap, 0xffffff);
    if (p.spots) {
      for (let k = 0; k < 4; k++) {
        const a = rng() * 6.28;
        const d = new THREE.IcosahedronGeometry(0.018 * s, 0);
        d.translate(x + Math.cos(a) * 0.07 * s, h * 0.92 + 0.065 * s, z + Math.sin(a) * 0.07 * s);
        stems.add(d, p.spots);
      }
    }
  }
  group.add(stems.build()!);
  const cm = caps.build(capMat)!;
  (cm.geometry as THREE.BufferGeometry).deleteAttribute("color");
  group.add(cm);
  if (p.glow) {
    const l = lamp(0x5ac8ff, 4);
    l.position.y = 0.3;
    group.add(l);
    lights.addLight(l, 2.5);
  }
  return make(group, (dt, t, env) => lights.update(dt, t, env), () => (lights.flickerTime = 0.6));
};

export const reeds: Builder = (o) => {
  const rng = makeRng(o.seed);
  const group = new THREE.Group();
  const sway = new Swayer();
  const cattail = o.variant === 0;
  for (let i = 0; i < 16; i++) {
    const [x, z] = inCircle(rng, 0.6);
    const p = new Parts();
    const h = (cattail ? 1.0 : 1.4) * (0.6 + rng() * 0.5);
    const g = new THREE.CylinderGeometry(0.008, 0.015, h, 4);
    g.translate(0, h / 2, 0);
    p.add(g, 0x6a9a3a);
    for (let k = 0; k < 2; k++) {
      const lf = new THREE.ConeGeometry(0.025, h * 0.8, 3);
      lf.scale(1, 1, 0.25);
      lf.translate(0, h * 0.4, 0);
      lf.rotateZ((k ? 1 : -1) * (0.15 + rng() * 0.2));
      p.add(lf, jitter(0x5e8e34, rng, 0.08));
    }
    if (cattail && rng() < 0.7) {
      const head = new THREE.CylinderGeometry(0.03, 0.03, 0.16, 6);
      head.translate(0, h * 0.85, 0);
      p.add(head, 0x6a4428);
    }
    if (!cattail) {
      const plume = new THREE.ConeGeometry(0.05, 0.2, 4);
      plume.rotateX(Math.PI);
      plume.translate(0, h + 0.05, 0);
      p.add(plume, 0xc8b078);
    }
    const m = p.build(VC2())!;
    m.position.set(x, 0, z);
    group.add(m);
    sway.add(m, 0.07, rng() * 6);
  }
  return make(group, (dt, t, env) => sway.update(dt, t, env.wind), () => (sway.gust = 1));
};

export const fallenLog: Builder = (o) => {
  const rng = makeRng(o.seed);
  const p = new Parts();
  if (o.variant === 2) {
    // A tree stump with roots.
    const s = new THREE.CylinderGeometry(0.32, 0.4, 0.45, 8);
    s.translate(0, 0.225, 0);
    p.add(s, 0x6e4a2c);
    const top = new THREE.CircleGeometry(0.31, 8);
    top.rotateX(-Math.PI / 2);
    top.translate(0, 0.451, 0);
    p.add(top, 0xc8a070);
    for (let k = 0; k < 5; k++) {
      const r = new THREE.ConeGeometry(0.1, 0.5, 4);
      r.rotateZ(Math.PI / 2 - 0.3);
      r.translate(-0.4, 0.05, 0);
      r.rotateY((k / 5) * Math.PI * 2 + rng() * 0.4);
      p.add(r, 0x5e3e24);
    }
  } else {
    const L = 2.2;
    const g = new THREE.CylinderGeometry(0.24, 0.28, L, 8);
    g.rotateZ(Math.PI / 2);
    g.translate(0, 0.25, 0);
    p.add(g, 0x6e4a2c);
    for (const sx of [-1, 1]) {
      const e = new THREE.CircleGeometry(sx > 0 ? 0.235 : 0.275, 8);
      e.rotateY((sx * Math.PI) / 2);
      e.translate((sx * L) / 2 + sx * 0.002, 0.25, 0);
      p.add(e, 0xc8a070);
    }
    const br = new THREE.CylinderGeometry(0.04, 0.07, 0.6, 5);
    br.rotateZ(-0.7);
    br.translate(0.3, 0.55, 0.05);
    p.add(br, 0x6e4a2c);
    if (o.variant === 1) {
      for (let k = 0; k < 9; k++) {
        const m = rockGeo(0.12 + rng() * 0.08, rng, 0.4);
        m.translate(-L / 2 + 0.2 + rng() * (L - 0.4), 0.45, (rng() - 0.5) * 0.2);
        p.add(m, jitter(0x5e9a3a, rng, 0.1));
      }
      for (let k = 0; k < 3; k++) {
        const cap = new THREE.SphereGeometry(0.07, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2);
        cap.scale(1, 0.5, 1);
        cap.rotateX(Math.PI / 2);
        cap.translate(-0.5 + k * 0.25, 0.2 + k * 0.05, 0.27);
        p.add(cap, 0xe8d8b0);
      }
    }
  }
  const group = new THREE.Group();
  group.add(p.build()!);
  return make(group);
};

export const bramble: Builder = (o) => {
  const rng = makeRng(o.seed);
  const blight = o.variant === 1;
  const p = new Parts();
  for (let s = 0; s < 14; s++) {
    // Curling thorny stems.
    let x = (rng() - 0.5) * 0.4, y = 0, z = (rng() - 0.5) * 0.4;
    let a = rng() * 6.28, up = 0.6 + rng() * 0.4;
    for (let k = 0; k < 6; k++) {
      const nx = x + Math.cos(a) * 0.18, nz = z + Math.sin(a) * 0.18, ny = Math.max(0.02, y + up * 0.18);
      const len = Math.hypot(nx - x, ny - y, nz - z);
      const g = new THREE.CylinderGeometry(0.018, 0.025, len, 4);
      g.translate(0, len / 2, 0);
      const dir = new THREE.Vector3(nx - x, ny - y, nz - z).normalize();
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
      g.translate(x, y, z);
      p.add(g, blight ? 0x4a4650 : 0x3e3a2a);
      if (rng() < 0.8) {
        const th = new THREE.ConeGeometry(0.018, 0.08, 3);
        th.rotateZ(rng() < 0.5 ? 1.3 : -1.3);
        th.rotateY(rng() * 6);
        th.translate(nx, ny, nz);
        p.add(th, blight ? 0x9a98a4 : 0x8a7a5a);
      }
      x = nx; y = ny; z = nz;
      a += (rng() - 0.5) * 1.2;
      up -= 0.35;
    }
  }
  const group = new THREE.Group();
  group.add(p.build()!);
  const lights = new NightLights();
  if (blight) {
    const glow = glowMat(0x7ff0c8, 0x5fe0b0);
    lights.addMat(glow, 0.7, 2.2);
    const pods = new Parts();
    for (let k = 0; k < 10; k++) {
      const [x, z] = inCircle(rng, 0.6);
      const g = new THREE.IcosahedronGeometry(0.04, 0);
      g.translate(x, 0.15 + rng() * 0.35, z);
      pods.add(g, 0xffffff);
    }
    group.add(pods.build(glow)!);
  } else {
    // A few dark berries.
    const b = new Parts();
    for (let k = 0; k < 10; k++) {
      const [x, z] = inCircle(rng, 0.6);
      const g = new THREE.IcosahedronGeometry(0.03, 0);
      g.translate(x, 0.12 + rng() * 0.35, z);
      b.add(g, 0x3a1a3a);
    }
    group.add(b.build()!);
  }
  return make(group, (dt, t, env) => lights.update(dt, t, env));
};

export const beachBits: Builder = (o) => {
  const rng = makeRng(o.seed);
  const p = new Parts();
  if (o.variant === 1) {
    // Driftwood: pale, twisted branches.
    for (let k = 0; k < 3; k++) {
      const L = 0.8 + rng() * 0.9;
      const g = new THREE.CylinderGeometry(0.04 + rng() * 0.03, 0.07 + rng() * 0.03, L, 6);
      g.rotateZ(Math.PI / 2);
      g.rotateY(rng() * 3);
      g.translate((rng() - 0.5) * 0.6, 0.06 + k * 0.05, (rng() - 0.5) * 0.6);
      p.add(g, jitter(0xc8bca8, rng, 0.08));
      const tw = new THREE.CylinderGeometry(0.015, 0.03, 0.35, 5);
      tw.rotateZ(0.8 + rng());
      tw.translate((rng() - 0.5) * 0.6, 0.15, (rng() - 0.5) * 0.4);
      p.add(tw, 0xb8ac98);
    }
  } else {
    const colors = [0xf6e8d8, 0xf2c8b0, 0xe8a890, 0xf8f0e8];
    for (let k = 0; k < 10; k++) {
      const [x, z] = inCircle(rng, 0.7);
      if (k % 4 === 0) {
        // A spiral shell.
        const g = new THREE.ConeGeometry(0.05, 0.13, 6);
        g.rotateZ(Math.PI / 2.2);
        g.rotateY(rng() * 6);
        g.translate(x, 0.04, z);
        p.add(g, jitter(colors[k % 4], rng, 0.05));
      } else if (k === 5) {
        // A starfish.
        for (let a = 0; a < 5; a++) {
          const arm = new THREE.ConeGeometry(0.035, 0.14, 4);
          arm.rotateZ(-Math.PI / 2);
          arm.scale(1, 0.4, 1);
          arm.translate(0.06, 0.02, 0);
          arm.rotateY((a / 5) * Math.PI * 2);
          arm.translate(x, 0, z);
          p.add(arm, 0xe8743a);
        }
      } else {
        // A fan shell (cockle).
        const g = new THREE.SphereGeometry(0.06, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2);
        g.scale(1, 0.4, 0.85);
        g.rotateY(rng() * 6);
        g.translate(x, 0, z);
        p.add(g, jitter(colors[k % 4], rng, 0.05));
      }
    }
  }
  const group = new THREE.Group();
  const m = p.build()!;
  if (o.variant !== 1) m.scale.setScalar(1.8);
  group.add(m);
  return make(group);
};

export const streetLamp: Builder = (o) => {
  const group = new THREE.Group();
  const iron = o.variant === 0;
  const c = iron ? 0x2e2e32 : 0x6e4a2c;
  const p = new Parts();
  p.box(0.4, 0.2, 0.4, 0x8e8a80, 0, 0.1, 0);
  const post = new THREE.CylinderGeometry(iron ? 0.05 : 0.08, iron ? 0.08 : 0.1, 3.0, iron ? 8 : 6);
  post.translate(0, 1.7, 0);
  p.add(post, c);
  if (iron) {
    const ring = new THREE.TorusGeometry(0.1, 0.02, 4, 10);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, 0.6, 0);
    p.add(ring, c);
  }
  p.box(0.32, 0.04, 0.32, c, 0, 3.22, 0);
  const roof = new THREE.ConeGeometry(0.3, 0.26, 4);
  roof.rotateY(Math.PI / 4);
  roof.translate(0, 3.7, 0);
  p.add(roof, c);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.box(0.03, 0.36, 0.03, c, x * 0.13, 3.42, z * 0.13);
  const fin = new THREE.SphereGeometry(0.05, 6, 4);
  fin.translate(0, 3.86, 0);
  p.add(fin, c);
  group.add(p.build()!);
  const lights = new NightLights();
  lights.flicker = 0.6;
  const glass = glowMat(0xffe09a, 0xffb050, { roughness: 0.2 });
  lights.addMat(glass, 0.3, 2.8);
  const g = mesh(new THREE.BoxGeometry(0.23, 0.34, 0.23), glass, false);
  g.position.y = 3.42;
  group.add(g);
  const l = lamp(0xffc070, 12);
  l.position.y = 3.3;
  group.add(l);
  lights.addLight(l, 9);
  return make(group, (dt, t, env) => lights.update(dt, t, env), () => (lights.flickerTime = 0.6));
};

export const well: Builder = (o) => {
  const rng = makeRng(o.seed);
  const group = new THREE.Group();
  const p = new Parts();
  const wood = o.variant === 1;
  if (wood) {
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      p.box(0.32, 0.8, 0.08, jitter(0x8a5c36, rng, 0.08), Math.cos(a) * 0.62, 0.4, Math.sin(a) * 0.62, -a + Math.PI / 2);
    }
    for (const y of [0.2, 0.65]) {
      const band = new THREE.TorusGeometry(0.66, 0.025, 4, 16);
      band.rotateX(Math.PI / 2);
      band.translate(0, y, 0);
      p.add(band, 0x3a3a3e);
    }
  } else {
    for (let y = 0; y < 0.8; y += 0.2) {
      for (let k = 0; k < 12; k++) {
        const a = ((k + (y * 5) % 2 * 0.5) / 12) * Math.PI * 2;
        p.box(0.34, 0.18, 0.22, jitter(0x9a968c, rng, 0.08), Math.cos(a) * 0.62, y + 0.1, Math.sin(a) * 0.62, -a + Math.PI / 2);
      }
    }
  }
  const water = new THREE.CircleGeometry(0.5, 12);
  water.rotateX(-Math.PI / 2);
  water.translate(0, 0.5, 0);
  p.add(water, 0x2a4a5a);
  // Posts, roof and crank.
  for (const sx of [-1, 1]) p.box(0.12, 1.6, 0.12, 0x6e4a2c, sx * 0.7, 1.4, 0);
  p.box(1.6, 0.08, 0.08, 0x6e4a2c, 0, 1.75, 0);
  for (const sz of [-1, 1]) {
    const r = new THREE.BoxGeometry(1.9, 0.06, 0.8);
    r.rotateX(sz * 0.6);
    r.translate(0, 2.45, sz * 0.32);
    p.add(r, o.variant === 1 ? 0xb8954e : 0xa44634);
  }
  p.box(0.06, 0.25, 0.06, 0x3a3a3e, 0.85, 1.65, 0.0);
  p.box(0.06, 0.06, 0.2, 0x3a3a3e, 0.85, 1.55, 0.1);
  group.add(p.build()!);
  // The bucket on its rope (the action button lowers it).
  const rope = mesh(new THREE.CylinderGeometry(0.01, 0.01, 1, 4), mat(0xc8b080));
  const bucket = new Parts();
  const bk = new THREE.CylinderGeometry(0.13, 0.1, 0.2, 8);
  bk.translate(0, -0.1, 0);
  bucket.add(bk, 0x8a5c36);
  const band = new THREE.TorusGeometry(0.125, 0.012, 4, 10);
  band.rotateX(Math.PI / 2);
  band.translate(0, -0.05, 0);
  bucket.add(band, 0x3a3a3e);
  const bm = bucket.build()!;
  group.add(rope, bm);
  let depth = 0.3, target = 0.3;
  return make(group, (dt) => {
    depth += (target - depth) * Math.min(1, dt * 1.5);
    const y = 1.72 - depth;
    bm.position.set(0, y, 0);
    rope.scale.y = depth;
    rope.position.set(0, 1.72 - depth / 2, 0);
  }, () => (target = target > 0.5 ? 0.3 : 1.25));
};

export const gravestone: Builder = (o) => {
  const rng = makeRng(o.seed);
  const p = new Parts();
  const stone = jitter(0x8e8c88, rng, 0.06);
  if (o.variant === 1) {
    p.box(0.14, 1.0, 0.12, stone, 0, 0.5, 0);
    p.box(0.55, 0.14, 0.12, stone, 0, 0.72, 0);
  } else {
    p.box(0.55, 0.65, 0.14, stone, 0, 0.325, 0);
    const top = new THREE.CylinderGeometry(0.275, 0.275, 0.14, 10, 1, false, -Math.PI / 2, Math.PI);
    top.rotateX(-Math.PI / 2);
    top.rotateY(Math.PI);
    top.translate(0, 0.65, 0);
    p.add(top, stone);
    p.box(0.3, 0.04, 0.02, shade(stone), 0, 0.55, 0.075);
    p.box(0.22, 0.04, 0.02, shade(stone), 0, 0.45, 0.075);
  }
  p.box(0.75, 0.08, 0.35, 0x7e7c78, 0, 0.04, 0.05);
  const group = new THREE.Group();
  const m = p.build()!;
  group.add(m);
  if (o.variant === 2) {
    // Old and leaning, with moss and a crack.
    m.rotation.z = 0.12;
    m.rotation.x = -0.08;
    const moss = new Parts();
    for (let k = 0; k < 5; k++) {
      const g = rockGeo(0.07, rng, 0.4);
      g.translate((rng() - 0.5) * 0.4, 0.1 + rng() * 0.2, 0.07);
      moss.add(g, 0x5e8a3a);
    }
    moss.box(0.02, 0.25, 0.02, 0x3e3c3a, 0.08, 0.5, 0.075, 0, 0.4);
    const mm = moss.build()!;
    mm.rotation.copy(m.rotation);
    group.add(mm);
  }
  // A grave mound in front.
  const mound = mesh(new THREE.SphereGeometry(0.5, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x6a5a40));
  mound.scale.set(0.7, 0.2, 1.4);
  mound.position.z = 0.85;
  group.add(mound);
  return make(group);
};
function shade(c: number) {
  return mix(c, 0x000000, 0.35);
}

export const barrels: Builder = (o) => {
  const rng = makeRng(o.seed);
  const p = new Parts();
  if (o.variant === 0) {
    const spots: [number, number, number][] = [[0, 0, 0], [0.62, 0, 0.1], [0.3, 0, 0.6], [0.32, 0.84, 0.25]];
    for (const [x, y, z] of spots) {
      const g = new THREE.CylinderGeometry(0.28, 0.28, 0.8, 10, 2);
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i)) < 0.01) { pos.setX(i, pos.getX(i) * 1.12); pos.setZ(i, pos.getZ(i) * 1.12); }
      g.translate(x, y + 0.4, z);
      p.add(g, jitter(0x8a5c36, rng, 0.08));
      for (const by of [0.12, 0.68]) {
        const b = new THREE.TorusGeometry(0.29, 0.018, 4, 12);
        b.rotateX(Math.PI / 2);
        b.translate(x, y + by, z);
        p.add(b, 0x3a3a3e);
      }
      const lid = new THREE.CircleGeometry(0.26, 10);
      lid.rotateX(-Math.PI / 2);
      lid.translate(x, y + 0.801, z);
      p.add(lid, 0xa87a4c);
    }
  } else if (o.variant === 1) {
    const spots: [number, number, number, number][] = [[0, 0, 0, 0.7], [0.75, 0, 0.1, 0.6], [0.1, 0.7, 0.05, 0.55], [0.4, 0, 0.75, 0.5]];
    for (const [x, y, z, s] of spots) {
      p.box(s, s, s, jitter(0xa87a4c, rng, 0.06), x, y + s / 2, z, rng() * 0.3);
      for (const dy of [-1, 1]) p.box(s + 0.02, 0.06, s + 0.02, 0x6e4a2c, x, y + s / 2 + (dy * s) / 2.6, z, 0);
      const d = new THREE.BoxGeometry(0.05, s * 1.25, 0.02);
      d.rotateZ(0.78);
      d.translate(x, y + s / 2, z + s / 2 + 0.01);
      p.add(d, 0x6e4a2c);
    }
  } else {
    for (let k = 0; k < 5; k++) {
      const g = new THREE.SphereGeometry(0.3, 7, 5);
      g.scale(1, 1.25, 0.8);
      const [x, z] = inCircle(rng, 0.5);
      g.translate(x, 0.34 + (k === 4 ? 0.45 : 0), z);
      p.add(g, jitter(0xd8c49a, rng, 0.06));
      const tie = new THREE.CylinderGeometry(0.08, 0.12, 0.1, 6);
      tie.translate(x, 0.74 + (k === 4 ? 0.45 : 0), z);
      p.add(tie, 0xa89060);
    }
  }
  const group = new THREE.Group();
  group.add(p.build()!);
  return make(group);
};

export const signpost: Builder = (o) => {
  const group = new THREE.Group();
  const p = new Parts();
  p.box(0.12, 1.8, 0.12, 0x6e4a2c, 0, 0.9, 0);
  if (o.variant === 0) {
    // The red warning sign at the edge of the Thornwood.
    p.box(0.9, 0.7, 0.06, 0x8a5c36, 0, 1.45, 0.08);
    const tri = new THREE.CircleGeometry(0.26, 3);
    tri.rotateZ(Math.PI / 2);
    tri.translate(0, 1.43, 0.115);
    p.add(tri, 0xd83a2a);
    p.box(0.05, 0.16, 0.01, 0xffffff, 0, 1.46, 0.12);
    p.box(0.05, 0.05, 0.01, 0xffffff, 0, 1.33, 0.12);
  } else {
    // Arrows pointing different ways.
    const arrows: [number, number, number][] = [[1.6, 0.4, 0x9c6a42], [1.3, -0.6, 0xa87a4c], [1.0, 2.4, 0x8a5c36]];
    for (const [y, ry, c] of arrows) {
      const a = new Parts();
      a.box(0.7, 0.18, 0.05, c, 0.35, 0, 0);
      const tip = new THREE.CircleGeometry(0.13, 3);
      tip.translate(0.75, 0, 0);
      a.add(tip, c);
      const t2 = new THREE.CircleGeometry(0.13, 3);
      t2.rotateY(Math.PI);
      t2.translate(0.75, 0, 0);
      a.add(t2, c);
      const m = a.build()!;
      m.position.y = y;
      m.rotation.y = ry;
      group.add(m);
    }
  }
  group.add(p.build()!);
  return make(group);
};

export const statue: Builder = (o) => {
  const group = new THREE.Group();
  const p = new Parts();
  const stone = 0xeeeae2;
  p.box(1.2, 0.3, 1.2, 0xd8d4cc, 0, 0.15, 0);
  p.box(0.95, 0.9, 0.95, stone, 0, 0.75, 0);
  p.box(1.1, 0.12, 1.1, 0xd9b44a, 0, 1.26, 0);
  // A robed figure.
  const robe = new THREE.CylinderGeometry(0.22, 0.42, 1.5, 8);
  robe.translate(0, 2.07, 0);
  p.add(robe, stone);
  const head = new THREE.IcosahedronGeometry(0.2, 1);
  head.translate(0, 3.0, 0);
  p.add(head, stone);
  const hood = new THREE.ConeGeometry(0.26, 0.45, 8);
  hood.translate(0, 3.12, -0.04);
  p.add(hood, stone);
  const arm = new THREE.CylinderGeometry(0.07, 0.09, 0.8, 6);
  arm.rotateZ(o.variant === 0 ? -2.6 : -0.3);
  arm.translate(o.variant === 0 ? 0.36 : 0.3, o.variant === 0 ? 2.9 : 2.2, 0.05);
  p.add(arm, stone);
  group.add(p.build(mat(0xffffff, { vertexColors: true, roughness: 0.5 }))!);
  const lights = new NightLights();
  if (o.variant === 0) {
    // Holding up the Lighthall's lantern.
    const glow = glowMat(0xfff2c0, 0xffd060);
    lights.addMat(glow, 0.8, 2.8);
    const lt = mesh(new THREE.OctahedronGeometry(0.16, 0), glow);
    lt.position.set(0.62, 3.42, 0.05);
    group.add(lt);
    const l = lamp(0xffd080, 10);
    l.position.copy(lt.position);
    group.add(l);
    lights.addLight(l, 7);
    return make(group, (dt, t, env) => {
      lights.update(dt, t, env);
      lt.rotation.y = t * 0.8;
    });
  }
  // Or holding a book.
  const book = new Parts();
  book.box(0.3, 0.05, 0.22, 0xd9b44a, 0.36, 1.85, 0.25);
  group.add(book.build()!);
  return make(group);
};
