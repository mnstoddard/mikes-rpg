// Wall ornaments: things hung on walls. Each one is built with its back on
// the wall at z = 0, sticking out towards +z, and `mountY` says how high up
// the wall it normally goes.
import * as THREE from "three";
import { EnvPiece, NightLights, Parts, Swayer, disposeGroup, glowMat, jitter, lamp, makeRng, mat, mesh } from "./kit";

export interface OrnamentOptions {
  variant: number;
  seed: number;
}
export type OrnamentPiece = EnvPiece & { mountY: number };
type Builder = (o: OrnamentOptions) => OrnamentPiece;

function make(group: THREE.Group, mountY: number, update?: EnvPiece["update"], poke?: () => void): OrnamentPiece {
  return { object: group, mountY, update: update ?? (() => {}), poke, dispose: () => disposeGroup(group) };
}

const LANTERNS = [
  { metal: 0x2e2e32, glass: 0xffd27a, glow: 0xffa83a, light: 0xffb860 }, // iron
  { metal: 0xb8892e, glass: 0xffe09a, glow: 0xffb84a, light: 0xffc870 }, // brass
  { metal: 0x5a4a7a, glass: 0xaee8ff, glow: 0x5ac8ff, light: 0x8ad8ff }, // mage's glass orb
];

export const wallLantern: Builder = (o) => {
  const p = LANTERNS[o.variant] ?? LANTERNS[0];
  const group = new THREE.Group();
  const arm = new Parts();
  arm.box(0.12, 0.3, 0.04, p.metal, 0, 0, 0.02);
  arm.box(0.04, 0.04, 0.42, p.metal, 0, 0.1, 0.22);
  const curl = new THREE.TorusGeometry(0.1, 0.015, 4, 10, Math.PI);
  curl.rotateY(Math.PI / 2);
  curl.translate(0, 0.0, 0.18);
  arm.add(curl, p.metal);
  group.add(arm.build()!);
  // The lantern hangs and sways a little.
  const hang = new THREE.Group();
  hang.position.set(0, 0.1, 0.4);
  group.add(hang);
  const lights = new NightLights();
  lights.flicker = o.variant === 2 ? 0 : 1;
  const glass = glowMat(p.glass, p.glow, { roughness: 0.2 });
  lights.addMat(glass, 0.35, 2.6);
  const body = new Parts();
  body.box(0.015, 0.1, 0.015, p.metal, 0, -0.05, 0);
  if (o.variant === 2) {
    const orb = mesh(new THREE.IcosahedronGeometry(0.13, 1), glass);
    orb.position.y = -0.28;
    hang.add(orb);
    const cap = new THREE.ConeGeometry(0.1, 0.1, 6);
    cap.translate(0, -0.13, 0);
    body.add(cap, p.metal);
  } else {
    const roof = new THREE.ConeGeometry(0.15, 0.14, 4);
    roof.rotateY(Math.PI / 4);
    roof.translate(0, -0.15, 0);
    body.add(roof, p.metal);
    body.box(0.2, 0.03, 0.2, p.metal, 0, -0.44, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) body.box(0.025, 0.24, 0.025, p.metal, x * 0.085, -0.31, z * 0.085);
    const g = mesh(new THREE.BoxGeometry(0.15, 0.22, 0.15), glass, false);
    g.position.y = -0.31;
    hang.add(g);
  }
  hang.add(body.build()!);
  const light = lamp(p.light, 8);
  light.position.set(0, -0.3, 0.1);
  hang.add(light);
  lights.addLight(light, 6);
  let push = 0;
  return make(group, 2.2, (dt, t, env) => {
    lights.update(dt, t, env);
    push = Math.max(0, push - dt * 0.5);
    hang.rotation.x = Math.sin(t * 1.3) * 0.03 * (0.5 + env.wind) + Math.sin(t * 5) * push * 0.4;
  }, () => (push = 1));
};

const WINDOWS = [
  { frame: 0xf2efe6, shutter: 0x4a7a5a }, // shuttered
  { frame: 0x6a4428, shutter: 0 }, // round
  { frame: 0x3a3a3e, shutter: 0 }, // leaded diamonds
];

export const windowPiece: Builder = (o) => {
  const p = WINDOWS[o.variant] ?? WINDOWS[0];
  const group = new THREE.Group();
  const lights = new NightLights();
  const glass = glowMat(0x9cc4d8, 0xffc670, { roughness: 0.15 });
  lights.addMat(glass, 0.0, 1.7);
  const f = new Parts();
  const W = 0.9, H = 1.1;
  const shutters: THREE.Group[] = [];
  if (o.variant === 1) {
    // A round window with a cross.
    const ring = new THREE.TorusGeometry(0.45, 0.07, 6, 16);
    ring.translate(0, 0, 0.06);
    f.add(ring, p.frame);
    f.box(0.06, 0.9, 0.06, p.frame, 0, 0, 0.08);
    f.box(0.9, 0.06, 0.06, p.frame, 0, 0, 0.08);
    const g = mesh(new THREE.CircleGeometry(0.44, 16), glass, false);
    g.position.z = 0.04;
    group.add(g);
  } else {
    const g = mesh(new THREE.PlaneGeometry(W, H), glass, false);
    g.position.z = 0.04;
    group.add(g);
    // Frame, sill and lintel.
    f.box(W + 0.16, 0.09, 0.1, p.frame, 0, H / 2 + 0.04, 0.06);
    f.box(W + 0.16, 0.09, 0.1, p.frame, 0, -H / 2 - 0.04, 0.06);
    f.box(0.09, H, 0.1, p.frame, -W / 2 - 0.04, 0, 0.06);
    f.box(0.09, H, 0.1, p.frame, W / 2 + 0.04, 0, 0.06);
    f.box(W + 0.36, 0.08, 0.24, p.frame, 0, -H / 2 - 0.1, 0.12);
    f.box(W + 0.3, 0.12, 0.12, 0x6a4428, 0, H / 2 + 0.14, 0.06);
    if (o.variant === 2) {
      // Lead lines in diamonds, each cut to fit inside the glass.
      for (let k = -6; k <= 6; k++) {
        for (const sgn of [-1, 1]) {
          const dx = -Math.sin(sgn * 0.65), dy = Math.cos(sgn * 0.65);
          const x0 = k * 0.2;
          let t0 = -10, t1 = 10;
          for (const [o0, d, lim] of [[x0, dx, W / 2], [0, dy, H / 2]] as const) {
            if (Math.abs(d) < 1e-6) continue;
            const a = (-lim - o0) / d, b = (lim - o0) / d;
            t0 = Math.max(t0, Math.min(a, b));
            t1 = Math.min(t1, Math.max(a, b));
          }
          if (t1 - t0 < 0.05) continue;
          const tm = (t0 + t1) / 2;
          const g2 = new THREE.BoxGeometry(0.018, t1 - t0, 0.012);
          g2.rotateZ(sgn * 0.65);
          g2.translate(x0 + dx * tm, dy * tm, 0.055);
          f.add(g2, p.frame);
        }
      }
    } else {
      f.box(0.05, H, 0.05, p.frame, 0, 0, 0.07);
      f.box(W, 0.05, 0.05, p.frame, 0, 0.1, 0.07);
      // Shutters that open (the action button).
      for (const sx of [-1, 1]) {
        const h = new THREE.Group();
        h.position.set(sx * (W / 2 + 0.09), 0, 0.12);
        const sp = new Parts();
        for (let i = 0; i < 5; i++) sp.box(W / 2 - 0.02, H / 5 - 0.02, 0.04, jitter(p.shutter, makeRng(o.seed + i + sx), 0.05), (-sx * (W / 2)) / 2, -H / 2 + (i + 0.5) * (H / 5), 0.0, 0, 0, 0.25);
        sp.box(W / 2 - 0.04, 0.06, 0.05, 0x2e2e32, (-sx * (W / 2)) / 2, H / 4, 0.03);
        sp.box(W / 2 - 0.04, 0.06, 0.05, 0x2e2e32, (-sx * (W / 2)) / 2, -H / 4, 0.03);
        h.add(sp.build()!);
        h.rotation.y = sx * -2.6;
        group.add(h);
        shutters.push(h);
      }
    }
  }
  group.add(f.build()!);
  // Curtains inside, seen through the glass.
  const curtain = new Parts();
  for (const sx of [-1, 1]) curtain.box(0.22, H - 0.08, 0.02, 0xb84a4a, sx * (W / 2 - 0.13), 0, 0.015);
  if (o.variant !== 1) group.add(curtain.build()!);
  let open = 1, target = 1;
  return make(group, 1.7, (dt, t, env) => {
    lights.update(dt, t, env);
    open += (target - open) * Math.min(1, dt * 4);
    shutters.forEach((h, i) => (h.rotation.y = (i ? 1 : -1) * -2.6 * open));
  }, () => (target = target ? 0 : 1));
};

const SIGNS = [
  { board: 0x7a5232, icon: "anvil" }, // smithy
  { board: 0x5a3a24, icon: "mug" }, // inn
  { board: 0x3a5a7a, icon: "bag" }, // general store
] as const;

export const shopSign: Builder = (o) => {
  const p = SIGNS[o.variant] ?? SIGNS[0];
  const group = new THREE.Group();
  const bracket = new Parts();
  bracket.box(0.1, 0.4, 0.04, 0x2e2e32, 0, 0, 0.02);
  bracket.box(0.04, 0.04, 0.95, 0x2e2e32, 0, 0.15, 0.48);
  const brace = new THREE.BoxGeometry(0.03, 0.03, 0.55);
  brace.rotateX(0.55);
  brace.translate(0, 0.0, 0.25);
  bracket.add(brace, 0x2e2e32);
  group.add(bracket.build()!);
  const swing = new THREE.Group();
  swing.position.set(0, 0.15, 0.55);
  // The board hangs side-on (facing along x) so you read it walking down the street.
  const b = new Parts();
  for (const z of [-0.25, 0.25]) b.box(0.015, 0.14, 0.015, 0x2e2e32, 0, -0.07, z);
  b.box(0.06, 0.5, 0.72, p.board, 0, -0.4, 0);
  b.box(0.07, 0.05, 0.76, 0xc9a23a, 0, -0.14, 0);
  b.box(0.07, 0.05, 0.76, 0xc9a23a, 0, -0.66, 0);
  const ic = 0xf0e2b8;
  for (const sx of [-1, 1]) {
    const x = sx * 0.04;
    if (p.icon === "anvil") {
      b.box(0.02, 0.08, 0.36, ic, x, -0.33, 0);
      b.box(0.02, 0.1, 0.12, ic, x, -0.42, 0);
      b.box(0.02, 0.05, 0.26, ic, x, -0.49, 0);
      const horn = new THREE.ConeGeometry(0.04, 0.12, 4);
      horn.rotateX(Math.PI / 2);
      horn.translate(x, -0.33, 0.23);
      b.add(horn, ic);
    } else if (p.icon === "mug") {
      b.box(0.02, 0.22, 0.17, ic, x, -0.42, -0.03);
      b.box(0.02, 0.05, 0.2, 0xfafafa, x, -0.3, -0.03);
      const handle = new THREE.TorusGeometry(0.06, 0.018, 4, 8);
      handle.rotateY(Math.PI / 2);
      handle.translate(x, -0.42, 0.08);
      b.add(handle, ic);
    } else {
      const bag = new THREE.SphereGeometry(0.12, 6, 4);
      bag.scale(0.15, 1, 1);
      bag.translate(x, -0.45, 0);
      b.add(bag, ic);
      b.box(0.02, 0.05, 0.1, ic, x, -0.31, 0);
    }
  }
  swing.add(b.build()!);
  group.add(swing);
  let push = 0;
  return make(group, 2.4, (dt, t, env) => {
    push = Math.max(0, push - dt * 0.4);
    swing.rotation.z = Math.sin(t * 1.4) * (0.04 + env.wind * 0.08) + Math.sin(t * 3.2) * push * 0.5;
  }, () => (push = 1));
};

const VINES = [
  { leaf: [0x3e7a2e, 0x4e8e34, 0x2e6a26], flower: 0 }, // ivy
  { leaf: [0x4e8e34, 0x5e9e3c], flower: 0xb08ae0 }, // flowering
  { leaf: [0x3e4a34, 0x4e4a3a], flower: 0, thorn: true }, // Thornwood thorny vines
];

export const vines: Builder = (o) => {
  const p = VINES[o.variant] ?? VINES[0];
  const rng = makeRng(o.seed);
  const group = new THREE.Group();
  const stems = new Parts();
  const leaves = new Parts();
  const sway = new Swayer();
  const stemColor = p.thorn ? 0x3a2e26 : 0x5a4a2a;
  // One stem segment from (x0, y0) to (x1, y1), flat against the wall.
  const segment = (x0: number, y0: number, x1: number, y1: number, r0: number, r1: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const g = new THREE.CylinderGeometry(r1, r0, len + r0, 5);
    g.rotateZ(-Math.atan2(x1 - x0, y1 - y0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0.03);
    stems.add(g, stemColor);
    // A joint ball so bends look smooth and joined.
    const j = new THREE.IcosahedronGeometry(r1 * 1.05, 0);
    j.translate(x1, y1, 0.03);
    stems.add(j, stemColor);
  };
  // A leaf sitting right on the stem, pointing out to one side.
  const leaf = (x: number, y: number, side: number, size: number) => {
    const lf = new THREE.ConeGeometry(0.06 * size, 0.15 * size, 3);
    lf.scale(1, 1, 0.2);
    lf.translate(0, 0.075 * size, 0);
    lf.rotateZ(side * (0.7 + rng() * 0.6));
    lf.rotateX(-0.35);
    lf.translate(x, y, 0.05);
    leaves.add(lf, jitter(p.leaf[Math.floor(rng() * p.leaf.length)], rng, 0.08));
    if (p.thorn && rng() < 0.6) {
      const th = new THREE.ConeGeometry(0.014, 0.07, 3);
      th.rotateZ(-side * 1.2);
      th.translate(x, y, 0.045);
      stems.add(th, 0x8a7a6a);
    }
  };
  // Grow a stem upwards, wandering, sending off side branches as it goes.
  const grow = (x: number, y: number, ang: number, steps: number, r: number, depth: number) => {
    for (let i = 0; i < steps; i++) {
      const len = 0.16 + rng() * 0.06;
      ang += (rng() - 0.5) * 0.7 - ang * 0.25; // keep heading mostly up
      const nx = Math.max(-1.9, Math.min(1.9, x + Math.sin(ang) * len)), ny = y + Math.cos(ang) * len;
      const nr = Math.max(0.008, r * 0.93);
      segment(x, y, nx, ny, r, nr);
      leaf(nx, ny, i % 2 ? 1 : -1, depth === 0 ? 1.1 : 0.9);
      if (rng() < 0.5) leaf((x + nx) / 2, (y + ny) / 2, i % 2 ? -1 : 1, 0.8);
      if (p.flower && rng() < 0.22) {
        // A hanging flower cluster on a little stalk.
        for (let k = 0; k < 4; k++) {
          const f = new THREE.IcosahedronGeometry(0.035 - k * 0.004, 0);
          f.translate(nx + 0.02, ny - 0.05 - k * 0.045, 0.08);
          leaves.add(f, jitter(p.flower, rng, 0.1));
        }
      }
      if (depth < 2 && i > 1 && rng() < (depth === 0 ? 0.45 : 0.25)) grow(nx, ny, ang + (rng() < 0.5 ? -1 : 1) * (0.7 + rng() * 0.4), Math.floor(steps * 0.5), nr * 0.8, depth + 1);
      x = nx;
      y = ny;
      r = nr;
      if (y > 2.9) break;
    }
  };
  // Three main stems rising from roots at the foot of the wall.
  for (const sx of [-0.8, 0.1, 0.9]) {
    const bx = sx + (rng() - 0.5) * 0.2;
    for (let k = 0; k < 3; k++) {
      const root = new THREE.ConeGeometry(0.02, 0.18, 4);
      root.rotateZ(Math.PI / 2 + (k - 1) * 0.6);
      root.translate(bx + (k - 1) * 0.06, 0.02, 0.05);
      stems.add(root, stemColor);
    }
    grow(bx, 0, (rng() - 0.5) * 0.4, 11 + Math.floor(rng() * 5), 0.03, 0);
  }
  // Stand a little off the wall so they show over rough stone.
  const sm = stems.build()!;
  sm.position.z = 0.08;
  group.add(sm);
  const lm = leaves.build(mat(0xffffff, { vertexColors: true, double: true }))!;
  lm.position.z = 0.08;
  group.add(lm);
  sway.add(lm, 0.008, 0);
  return make(group, 0, (dt, t, env) => sway.update(dt, t, env.wind), () => (sway.gust = 1));
};

const BOXES = [
  { flowers: [0xe04a4a, 0xf06a5a], box: 0x7a5232 }, // red geraniums
  { flowers: [0xf2d24a, 0xb08ae0, 0xf4a8c8, 0xffffff], box: 0x4a7a5a }, // mixed
  { flowers: [0xb8a8e8], box: 0x8a6a4a, herbs: true }, // herbs (lavender, sage)
];

export const flowerBox: Builder = (o) => {
  const p = BOXES[o.variant] ?? BOXES[0];
  const rng = makeRng(o.seed);
  const group = new THREE.Group();
  const b = new Parts();
  b.box(1.0, 0.22, 0.26, p.box, 0, 0, 0.15);
  b.box(1.04, 0.04, 0.3, jitter(p.box, rng, 0.15), 0, 0.12, 0.15);
  b.box(0.94, 0.04, 0.2, 0x4a3424, 0, 0.12, 0.15);
  for (const x of [-0.35, 0.35]) b.box(0.05, 0.2, 0.2, 0x2e2e32, x, -0.16, 0.1);
  group.add(b.build()!);
  const plants = new THREE.Group();
  plants.position.y = 0.12;
  group.add(plants);
  const sway = new Swayer();
  for (let i = 0; i < 9; i++) {
    const s = new Parts();
    const x = -0.42 + i * 0.105 + (rng() - 0.5) * 0.03, z = 0.1 + rng() * 0.1;
    const h = 0.14 + rng() * 0.14;
    s.box(0.015, h, 0.015, 0x4e8a34, 0, h / 2, 0);
    for (let k = 0; k < 3; k++) {
      const lf = new THREE.ConeGeometry(0.04, 0.1, 3);
      lf.scale(1, 1, 0.25);
      lf.rotateZ((k - 1) * 0.9);
      lf.translate(0, 0.04 + k * 0.03, 0);
      s.add(lf, 0x4e8e34);
    }
    if (p.herbs) {
      for (let k = 0; k < 5; k++) s.box(0.025, 0.025, 0.025, p.flowers[0], (rng() - 0.5) * 0.02, h - k * 0.025, 0);
    } else {
      const c = p.flowers[Math.floor(rng() * p.flowers.length)];
      for (let k = 0; k < 5; k++) {
        const pet = new THREE.IcosahedronGeometry(0.03, 0);
        const a = (k / 5) * Math.PI * 2;
        pet.translate(Math.cos(a) * 0.035, h, Math.sin(a) * 0.035);
        s.add(pet, c);
      }
      const mid = new THREE.IcosahedronGeometry(0.022, 0);
      mid.translate(0, h + 0.01, 0);
      s.add(mid, 0xf6d84a);
    }
    const m = s.build()!;
    m.position.set(x, 0, z);
    plants.add(m);
    sway.add(m, 0.08, i * 0.7);
  }
  return make(group, 1.0, (dt, t, env) => sway.update(dt, t, env.wind), () => (sway.gust = 1));
};

const BANNERS = [
  { cloth: 0xe0b23a, trim: 0xf6e6a8, icon: 0xffffff }, // Emberhall gold
  { cloth: 0x5b3c8c, trim: 0xd8b85a, icon: 0xf2d878 }, // Mages' Guild purple
  { cloth: 0x3e7a4a, trim: 0xe8dcb0, icon: 0xf2efe6 }, // Heartvale green
];

export const banner: Builder = (o) => {
  const p = BANNERS[o.variant] ?? BANNERS[0];
  const group = new THREE.Group();
  const pole = new Parts();
  const rod = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6);
  rod.rotateZ(Math.PI / 2);
  rod.translate(0, 0, 0.14);
  pole.add(rod, 0x6a4428);
  for (const x of [-0.5, 0.5]) {
    const k = new THREE.SphereGeometry(0.05, 6, 4);
    k.translate(x, 0, 0.14);
    pole.add(k, 0xc9a23a);
  }
  for (const x of [-0.35, 0.35]) pole.box(0.04, 0.04, 0.14, 0x2e2e32, x, 0, 0.07);
  group.add(pole.build()!);
  // The cloth: a grid that ripples, with a swallow-tail cut at the bottom.
  const W = 0.8, H = 1.6, nx = 6, ny = 12;
  const geo = new THREE.PlaneGeometry(W, H, nx, ny);
  geo.translate(0, -H / 2, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const base = Float32Array.from(pos.array as Float32Array);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    if (y < -H + 0.01) base[i * 3 + 1] = -H + (0.3 - Math.abs(x) * 0.75) * 0.9;
  }
  const colors: number[] = [];
  const ng = geo.toNonIndexed();
  const npos = ng.attributes.position as THREE.BufferAttribute;
  const c = new THREE.Color();
  for (let i = 0; i < npos.count; i += 3) {
    const cx = (npos.getX(i) + npos.getX(i + 1) + npos.getX(i + 2)) / 3, cy = (npos.getY(i) + npos.getY(i + 1) + npos.getY(i + 2)) / 3;
    const edge = Math.abs(cx) > W / 2 - 0.12 || cy > -0.15;
    const dIcon = Math.abs(cx) + Math.abs(cy + 0.7);
    c.setHex(edge ? p.trim : dIcon < 0.2 ? p.icon : p.cloth);
    for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
  }
  geo.dispose();
  // Map each non-indexed vertex back to its rest position.
  const rest = new Float32Array(npos.count * 3);
  for (let i = 0; i < npos.count; i++) {
    let x = npos.getX(i), y = npos.getY(i);
    if (y < -H + 0.01) y = -H + (0.3 - Math.abs(x) * 0.75) * 0.9;
    rest[i * 3] = x;
    rest[i * 3 + 1] = y;
    rest[i * 3 + 2] = 0;
  }
  void base;
  ng.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const cloth = mesh(ng, mat(0xffffff, { vertexColors: true, double: true }));
  cloth.position.z = 0.16;
  group.add(cloth);
  let gust = 0;
  return make(group, 2.7, (dt, t, env) => {
    gust = Math.max(0, gust - dt * 0.5);
    const w = 0.04 + env.wind * 0.08 + gust * 0.25;
    for (let i = 0; i < npos.count; i++) {
      const x = rest[i * 3], y = rest[i * 3 + 1];
      const down = -y / H;
      npos.setXYZ(i, x + Math.sin(t * 2 + y * 3) * w * down * 0.3, y, Math.sin(t * 2.4 + y * 4 + x * 3) * w * down + down * gust * 0.3);
    }
    npos.needsUpdate = true;
  }, () => (gust = 1));
};

export const wallTorch: Builder = (o) => {
  const group = new THREE.Group();
  const wood = o.variant === 1;
  const s = new Parts();
  s.box(0.14, 0.3, 0.04, wood ? 0x5e3e24 : 0x2e2e32, 0, 0, 0.02);
  s.box(0.04, 0.04, 0.2, wood ? 0x5e3e24 : 0x2e2e32, 0, -0.05, 0.12);
  const cup = new THREE.CylinderGeometry(0.09, 0.05, 0.12, 6);
  cup.translate(0, 0.0, 0.25);
  s.add(cup, wood ? 0x5e3e24 : 0x2e2e32);
  const stick = new THREE.CylinderGeometry(0.035, 0.03, 0.4, 6);
  stick.rotateX(-0.25);
  stick.translate(0, 0.1, 0.27);
  s.add(stick, 0x6e4a2c);
  const rag = new THREE.CylinderGeometry(0.06, 0.05, 0.1, 6);
  rag.translate(0, 0.28, 0.3);
  s.add(rag, 0x3a2e26);
  group.add(s.build()!);
  const lights = new NightLights();
  lights.flicker = 3;
  const flameMat = glowMat(0xffd060, 0xff8a20, { opacity: 0.95 });
  const innerMat = glowMat(0xfff2b0, 0xffd060);
  lights.addMat(flameMat, 2.2, 3.2);
  lights.addMat(innerMat, 2.5, 3.5);
  const flame = mesh(new THREE.ConeGeometry(0.08, 0.28, 5), flameMat, false);
  flame.position.set(0, 0.46, 0.31);
  const inner = mesh(new THREE.ConeGeometry(0.045, 0.16, 5), innerMat, false);
  inner.position.set(0, 0.4, 0.31);
  group.add(flame, inner);
  const light = lamp(0xff9a40, 9);
  light.position.set(0, 0.5, 0.45);
  group.add(light);
  lights.addLight(light, 8);
  let blow = 0;
  return make(group, 1.9, (dt, t, env) => {
    // Torches always burn, so they count as "night" for the lights.
    lights.update(dt, t, { ...env, night: Math.max(0.55, env.night) });
    blow = Math.max(0, blow - dt);
    const f = 1 + Math.sin(t * 17) * 0.12 + Math.sin(t * 29) * 0.08;
    flame.scale.set(1 - blow * 0.3, f * (1 - blow * 0.5), 1);
    flame.rotation.z = Math.sin(t * 9) * 0.12 + blow * 0.6;
    inner.scale.y = f;
  }, () => (blow = 1));
};

const AWNINGS = [
  [0xc84a3a, 0xf2ece0], // red
  [0x3a6aa8, 0xf2ece0], // blue
  [0x4a8a4a, 0xf2e6b8], // green
];

export const awning: Builder = (o) => {
  const [a, b] = AWNINGS[o.variant] ?? AWNINGS[0];
  const group = new THREE.Group();
  const p = new Parts();
  const W = 2.0, D = 0.9, drop = 0.45;
  const len = Math.hypot(D, drop), ang = Math.atan2(drop, D);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + (i + 0.5) * (W / n);
    const c = i % 2 ? a : b;
    p.box(W / n, 0.03, len, c, x, -drop / 2, D / 2, 0, 0, 0);
    // Scalloped front edge.
    const sc = new THREE.CircleGeometry(W / n / 2, 6, Math.PI, Math.PI);
    sc.translate(x, -drop, D + 0.005);
    p.add(sc, c);
  }
  // Tilt the stripes down to the front.
  const m = p.build(mat(0xffffff, { vertexColors: true, double: true }))!;
  // Rotate each stripe: simplest is to shear the whole mesh.
  const pos = m.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (pos.getY(i) > -drop + 0.02) pos.setY(i, -(z / D) * drop + (pos.getY(i) + drop / 2));
  }
  m.geometry.computeVertexNormals();
  void len; void ang;
  group.add(m);
  const frame = new Parts();
  for (const x of [-W / 2, W / 2]) {
    const g = new THREE.BoxGeometry(0.03, 0.03, Math.hypot(D, 0.7));
    g.rotateX(Math.atan2(0.7, D));
    g.translate(x, -0.4, D / 2);
    frame.add(g, 0x2e2e32);
  }
  frame.box(W + 0.1, 0.08, 0.08, 0x2e2e32, 0, 0.02, 0.04);
  group.add(frame.build()!);
  const sway = new Swayer();
  sway.add(m, 0.006, 0);
  return make(group, 2.6, (dt, t, env) => sway.update(dt, t, env.wind), () => (sway.gust = 1));
};
