// The rest of the bag: crafting materials, ingredients, foraging finds,
// monster loot, bait, potions, gems and quest items.
import * as THREE from "three";
import {
  ItemDef, at, group, lathe, mat, plain, sphere, cyl, torus, slab, slabShape, lump, rng, woodMat, clothMat, capsule, tube, cone, rbox, leatherMat,
  metalMat, jewelMat, gem, gemMat, GEMS, paint, paintedMat, glassMat, V3, rod, barkMat,
} from "./kit";
import { potion, mushroom } from "./consumables";
import { ore, bar } from "./resources";
import { ring, spellBook } from "./treasures";

const R = rng;

// ---------- Crafting materials ----------

/** A flat hide with a wobbly outline, given a soft wave so it drapes. */
function hide(color: number, opts: { spots?: number; fur?: boolean; size?: number; seed?: number; name?: string } = {}) {
  const r = R(opts.seed ?? 5), S = opts.size ?? 0.42;
  const pts: [number, number][] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const leg = [2, 6, 11, 15].includes(i) ? 1.25 : 1;
    const k = (0.82 + r() * 0.18) * leg;
    pts.push([Math.cos(a) * S * 0.6 * k, Math.sin(a) * S * 0.45 * k]);
  }
  const m = opts.spots !== undefined
    ? paintedMat(opts.name ?? "hide", paint("hide_" + color + "_" + opts.spots, 128, 128, (c, w, h) => {
        c.fillStyle = "#" + new THREE.Color(color).getHexString(); c.fillRect(0, 0, w, h);
        c.fillStyle = "#" + new THREE.Color(opts.spots!).getHexString();
        const q = R(9);
        for (let i = 0; i < 7; i++) { c.beginPath(); c.ellipse(q() * w, q() * h, 10 + q() * 16, 8 + q() * 12, q() * 3, 0, Math.PI * 2); c.fill(); }
      }), { rough: 0.8, tex: opts.fur ? "fur" : "leather" })
    : mat(opts.name ?? "hide", color, { rough: opts.fur ? 0.9 : 0.7, tex: opts.fur ? "fur" : "leather", normal: opts.fur ? 0.9 : 0.4 });
  const sl = slab(pts, opts.fur ? 0.02 : 0.01, m, opts.fur ? 0.008 : 0.004, 1);
  const g = sl.geometry as THREE.BufferGeometry;
  // planar UVs from x/y so painted patches show
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    uv.setXY(i, x / S + 0.5, y / S + 0.5);
    p.setZ(i, p.getZ(i) + Math.sin(x * 9) * 0.012 + Math.cos(y * 11) * 0.01);
  }
  g.computeVertexNormals();
  return at(sl, [0, 0.025, 0], [-90, 0, 0]);
}

/** Leather: a rolled hide tied with a cord. */
export function leatherRoll() {
  const lm = leatherMat(0x9a6a3e);
  const roll = group("roll",
    at(cyl(0.05, 0.05, 0.3, lm, 18), [0, 0.05, 0], [0, 0, 90]),
    at(lathe([[0.0, 0], [0.05, 0], [0.05, 0.002]], mat("leather_inside", 0xd2ae86, { rough: 0.8, tex: "leather", normal: 0.2 }), 18), [0.15, 0.05, 0], [0, 0, -90]),
    at(lathe([[0.0, 0], [0.05, 0], [0.05, 0.002]], mat("leather_inside", 0xd2ae86, { rough: 0.8, tex: "leather", normal: 0.2 }), 18), [-0.15, 0.05, 0], [0, 0, 90]),
  );
  // the spiral end and a loose flap
  roll.add(at(torus(0.03, 0.004, mat("leather_inside", 0x7a4e2c, { rough: 0.8 }), 6, 18), [0.151, 0.05, 0], [0, 90, 0]));
  roll.add(at(slab([[0, 0], [0.26, 0], [0.26, 0.06], [0, 0.05]], 0.006, lm, 0.002), [-0.13, 0.005, 0.05], [-90, 0, 0]));
  for (const x of [-0.08, 0.08]) roll.add(at(torus(0.052, 0.004, plain("cord", 0xc9a574, 0.85), 6, 18), [x, 0.05, 0], [0, 90, 0]));
  return roll;
}

export function threadSpool() {
  const wm = woodMat("pine");
  const g = group("thread",
    at(cyl(0.032, 0.032, 0.012, wm, 18), [0, 0.006, 0]),
    at(cyl(0.032, 0.032, 0.012, wm, 18), [0, 0.094, 0]),
    at(cyl(0.012, 0.012, 0.09, wm, 12), [0, 0.05, 0]),
    at(cyl(0.026, 0.026, 0.076, mat("thread", 0xf1ece2, { rough: 0.6, tex: "rope", normal: 0.6 }), 20), [0, 0.05, 0]),
  );
  g.add(tube([[0.026, 0.07, 0], [0.04, 0.05, 0.02], [0.05, 0.005, 0.03], [0.08, 0.002, 0.02]], 0.0015, mat("thread", 0xf1ece2, { rough: 0.6 }), 16, 3));
  return g;
}

export function clothStack() {
  const g = group("cloth");
  const colors = [0xe9dfc8, 0xd8ccae, 0xe9dfc8];
  colors.forEach((c, i) => {
    const fold = rbox(0.24, 0.022, 0.18, 0.011, clothMat(c));
    g.add(at(fold, [(i - 1) * 0.006, 0.012 + i * 0.022, (i % 2) * 0.006], [0, (i - 1) * 4, 0]));
  });
  g.add(at(rbox(0.02, 0.072, 0.188, 0.008, clothMat(0xb4473c, "band")), [0.03, 0.034, 0.003]));
  return g;
}

/** Spider silk: a fluffy white bundle wound round with strands. */
export function silk() {
  const r = R(4);
  const sm = mat("silk", 0xf6f4f0, { rough: 0.5, tex: "rope", normal: 0.3 });
  const g = group("silk", at(lump(0.06, sm, r, 0.15, 2, [1.3, 0.8, 1]), [0, 0.05, 0]));
  for (let i = 0; i < 5; i++) g.add(at(torus(0.07 - i * 0.004, 0.0025, mat("silk_strand", 0xffffff, { rough: 0.3, emissive: 0xffffff, glow: 0.05 }), 4, 24), [0, 0.05, 0], [90 + i * 25, i * 30, 0], [1.25, 1, 0.75]));
  return g;
}

// ---------- Ingredients and crops ----------

const rawMeat = (c = 0xe06a66) => mat("meat", c, { rough: 0.45, tex: "leather", normal: 0.25 });
const fat = () => mat("fat", 0xf6e6d6, { rough: 0.5 });

export function drumstick() {
  const g = group("raw_chicken",
    at(lump(0.045, mat("chicken_skin", 0xf2c8a8, { rough: 0.5, tex: "leather", normal: 0.3 }), R(8), 0.1, 2, [1.5, 0.9, 1]), [0.02, 0.04, 0]),
    at(rod(0.012, 0.01, 0.08, plain("bone", 0xf4eedc, 0.6), 10), [-0.04, 0.035, 0], [0, 0, 90]),
    at(sphere(0.014, plain("bone", 0xf4eedc, 0.6), 10, 8), [-0.12, 0.035, 0.008]),
    at(sphere(0.014, plain("bone", 0xf4eedc, 0.6), 10, 8), [-0.12, 0.035, -0.008]),
  );
  return g;
}

/** A thick cut of meat: rounded slab with a fat rim and marbling. */
export function steakCut(meat: number, rim: number, key: string) {
  const s = new THREE.Shape();
  s.moveTo(-0.08, -0.02); s.bezierCurveTo(-0.09, 0.05, -0.02, 0.07, 0.03, 0.06); s.bezierCurveTo(0.09, 0.05, 0.1, -0.02, 0.07, -0.05);
  s.bezierCurveTo(0.03, -0.07, -0.06, -0.07, -0.08, -0.02);
  const marbled = mat("meat", meat, { rough: 0.45, tex: "leather", normal: 0.25 });
  const g = group(key, at(slabShape(s, 0.03, marbled, 0.01, 12), [0, 0.016, 0], [-90, 0, 0]));
  const rimS = new THREE.Shape();
  rimS.moveTo(0.03, 0.06); rimS.bezierCurveTo(0.09, 0.05, 0.1, -0.02, 0.07, -0.05); rimS.lineTo(0.06, -0.04); rimS.bezierCurveTo(0.085, -0.02, 0.08, 0.04, 0.03, 0.05);
  g.add(at(slabShape(rimS, 0.036, mat("fat", rim, { rough: 0.5 }), 0.012, 10), [0.002, 0.016, 0], [-90, 0, 0], [1.02, 1.02, 1]));
  // a few streaks of marbling across the top
  const q = R(key.length * 5);
  for (let i = 0; i < 5; i++) {
    const x = -0.05 + i * 0.022, z = (q() - 0.5) * 0.03;
    g.add(tube([[x, 0.0315, z - 0.03], [x + 0.01, 0.0318, z], [x - 0.004, 0.0315, z + 0.03]], 0.0022, mat("fat", rim, { rough: 0.5 }), 8, 4));
  }
  return g;
}

export function potato() {
  return at(lump(0.04, mat("potato", 0xc89a5a, { rough: 0.8, tex: "stone", normal: 0.4 }), R(21), 0.15, 2, [1.35, 0.85, 1]), [0, 0.034, 0]);
}
export function carrot() {
  const g = group("carrot", at(lathe([[0, 0], [0.012, 0.02], [0.02, 0.09], [0.022, 0.15], [0.0, 0.158]], mat("carrot", 0xf08a2a, { rough: 0.6, tex: "paper", normal: 0.5 }), 12), [0, 0.02, 0], [0, 0, -90]));
  for (let i = 0; i < 5; i++) g.add(at(slab([[0, 0], [0.006, 0.03], [0.003, 0.07], [-0.003, 0.04]], 0.003, plain("leaf", 0x4e9a3a, 0.6), 0.0012), [0.165, 0.022, 0], [i * 36, 0, -70 + (i - 2) * 9]));
  return g;
}
export function onion() {
  const om = mat("onion", 0xd9a04a, { rough: 0.45, tex: "paper", normal: 0.3 });
  return group("onion", lathe([[0, 0], [0.012, 0.002], [0.038, 0.018], [0.046, 0.042], [0.04, 0.066], [0.018, 0.088], [0.005, 0.1], [0, 0.104]], om, 18),
    tube([[0, 0.1, 0], [0.004, 0.12, 0], [0.012, 0.13, 0.004]], 0.003, plain("onion_skin", 0xb98040, 0.6), 6, 4),
    at(cyl(0.008, 0.012, 0.004, plain("roots", 0xe9dfc8, 0.8), 8), [0, 0.002, 0]));
}
export function wheat() {
  const g = group("wheat");
  const stalk = plain("straw", 0xe2c06a, 0.7), grain = mat("grain", 0xe8b64e, { rough: 0.55 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, tilt = 6 + (i % 3) * 4;
    const st = group("stalk", at(rod(0.003, 0.0025, 0.42, stalk, 5), [0, 0, 0]));
    for (let j = 0; j < 7; j++) for (const s of [1, -1]) st.add(at(sphere(0.007, grain, 5, 3), [s * 0.0055, 0.36 + j * 0.011, 0], [0, 0, s * 25], [0.7, 1.4, 0.7]));
    g.add(at(st, [Math.cos(a) * 0.01, 0, Math.sin(a) * 0.01], [Math.sin(a) * tilt, 0, Math.cos(a) * tilt]));
  }
  g.add(at(torus(0.016, 0.004, plain("cord", 0xb4473c, 0.8), 6, 14), [0, 0.14, 0], [90, 0, 0]));
  return at(g, [0, 0.02, 0], [0, 0, -80]);
}
export function wildRoot() {
  const rm = mat("root", 0xb48654, { rough: 0.85, tex: "bark", normal: 0.5 });
  const g = group("wild_root", tube([[-0.1, 0.02, 0], [-0.03, 0.03, 0.01], [0.04, 0.02, -0.02], [0.1, 0.015, 0.01]], 0.016, rm, 20, 8));
  g.add(tube([[-0.02, 0.025, 0.01], [0.0, 0.015, 0.05], [0.03, 0.01, 0.08]], 0.008, rm, 10, 6));
  g.add(tube([[0.04, 0.02, -0.02], [0.06, 0.01, -0.06], [0.09, 0.008, -0.08]], 0.006, rm, 10, 6));
  for (let i = 0; i < 3; i++) g.add(at(slab([[0, 0], [0.012, 0.03], [0, 0.06], [-0.012, 0.03]], 0.003, plain("leaf", 0x5e8f3a, 0.6), 0.001), [-0.1, 0.03, 0], [0, i * 60, 60]));
  return g;
}
export function truffle() {
  const g = group("truffle", at(lump(0.035, mat("truffle", 0x4a3426, { rough: 0.9, tex: "stone", normal: 1 }), R(31), 0.3, 2), [0, 0.03, 0]));
  g.add(at(lump(0.022, mat("truffle", 0x4a3426, { rough: 0.9, tex: "stone", normal: 1 }), R(32), 0.3, 1), [0.045, 0.02, 0.02]));
  return g;
}
export function buttonMushrooms() {
  return group("mushrooms", mushroom(0xc89a6a), at(mushroom(0xb48654), [0.06, 0, -0.04], [0, 60, -8], 0.75));
}

// ---------- Foraging finds ----------

/** A leafy herb sprig. */
function sprig(leaf: number, leaves = 9, name = "sage") {
  const g = group(name, tube([[0, 0, 0], [0.01, 0.08, 0], [0.0, 0.16, 0.01]], 0.003, plain("stem", 0x5e8f3a, 0.6), 10, 5));
  const lm = mat("leaf", leaf, { rough: 0.6, tex: "paper", normal: 0.3 });
  for (let i = 0; i < leaves; i++) {
    const y = 0.03 + i * 0.014, s = i % 2 ? 1 : -1;
    g.add(at(slab([[0, 0], [0.012, 0.012], [0.008, 0.035], [0, 0.045], [-0.008, 0.035], [-0.012, 0.012]], 0.003, lm, 0.0012), [0.005, y, 0], [0, i * 50, s * (55 - i * 3)]));
  }
  return at(g, [0, 0.02, 0], [0, 0, -78]);
}
export function sage() { return sprig(0x8fae7a, 9, "sage"); }
export function ginseng() {
  const rm = mat("root", 0xe8cf9a, { rough: 0.7, tex: "paper", normal: 0.4 });
  const g = group("ginseng", tube([[0, 0.08, 0], [0.005, 0.04, 0], [-0.005, 0.0, 0]], 0.014, rm, 12, 8));
  g.add(tube([[0, 0.02, 0], [0.025, -0.01, 0.01], [0.04, -0.04, 0.01]], 0.006, rm, 10, 6));
  g.add(tube([[0, 0.02, 0], [-0.025, -0.02, -0.01], [-0.03, -0.05, -0.01]], 0.006, rm, 10, 6));
  g.add(tube([[0, 0.08, 0], [0, 0.13, 0], [0.005, 0.17, 0]], 0.003, plain("stem", 0x5e8f3a, 0.6), 8, 5));
  for (let i = 0; i < 5; i++) g.add(at(slab([[0, 0], [0.012, 0.015], [0.006, 0.04], [0, 0.045], [-0.006, 0.04], [-0.012, 0.015]], 0.003, plain("leaf", 0x4e9a3a, 0.6), 0.001), [0, 0.165, 0], [0, i * 72, 55]));
  for (let i = 0; i < 6; i++) g.add(at(sphere(0.006, mat("berry", 0xe0303a, { rough: 0.3 }), 8, 6), [Math.cos(i) * 0.008, 0.18 + (i % 3) * 0.007, Math.sin(i) * 0.008]));
  return at(g, [0, 0.05, 0], [0, 0, -70]);
}
export function honeycomb() {
  const hm = mat("honey", 0xf2b03a, { rough: 0.15, emissive: 0xc07010, glow: 0.12 });
  const wax = mat("wax", 0xe8c060, { rough: 0.5 });
  const g = group("honey");
  const hexPts: [number, number][] = [];
  for (let i = 0; i < 6; i++) hexPts.push([Math.cos((i / 6) * Math.PI * 2) * 0.014, Math.sin((i / 6) * Math.PI * 2) * 0.014]);
  const cells: [number, number][] = [];
  for (let q = -2; q <= 2; q++) for (let rr = -2; rr <= 2; rr++) { if (Math.abs(q + rr) > 2) continue; cells.push([0.026 * (q + rr / 2), 0.0225 * rr]); }
  for (const [x, z] of cells) {
    const cell = slab(hexPts, 0.035, wax, 0.004, 1);
    g.add(at(cell, [x, 0.018, z], [-90, 0, 30]));
    g.add(at(cyl(0.011, 0.011, 0.004, hm, 6), [x, 0.035, z], [0, 30, 0]));
  }
  // a drip
  g.add(at(sphere(0.008, hm, 8, 6), [0.06, 0.02, 0.0], [0, 0, 0], [1, 1.6, 1]));
  return g;
}
export function oldBone() {
  const bm = plain("bone", 0xece3c8, 0.7);
  const end = () => group("end", at(sphere(0.02, bm, 10, 8), [0, 0, 0.012]), at(sphere(0.02, bm, 10, 8), [0, 0, -0.012]));
  return group("old_bone", at(rod(0.012, 0.012, 0.18, bm, 10), [-0.09, 0.02, 0], [0, 0, -90]), at(end(), [-0.095, 0.02, 0]), at(end(), [0.095, 0.02, 0]));
}
/** A water lily: layered pointed petals on a lily pad. */
export function lotus(petal: number, glow = 0.15, name = "blue_lotus") {
  const pm = mat("petal", petal, { rough: 0.4, emissive: petal, glow });
  const g = group(name);
  const pad = slab(Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 1.85 + 0.25; return [Math.cos(a) * 0.09, Math.sin(a) * 0.09] as [number, number]; }).concat([[0, 0]]), 0.006, plain("lily_pad", 0x4f9a3a, 0.5), 0.002);
  if (name === "blue_lotus") g.add(at(pad, [0, 0.004, 0], [-90, 0, 0]));
  for (const [n, tilt, r0] of [[8, 60, 0], [8, 40, 22], [6, 20, 0]] as const) {
    for (let i = 0; i < n; i++) {
      const p = slab([[0, 0], [0.012, 0.018], [0.008, 0.04], [0, 0.05], [-0.008, 0.04], [-0.012, 0.018]], 0.004, pm, 0.0015);
      const holder = group("petal", at(p, [0, 0, 0], [-tilt, 0, 0]));
      g.add(at(holder, [0, 0.012, 0], [0, (i / n) * 360 + r0, 0]));
    }
  }
  g.add(at(sphere(0.01, mat("flower_heart", 0xffd75a, { rough: 0.5, emissive: 0xffd75a, glow: glow * 2 }), 10, 8), [0, 0.02, 0]));
  return g;
}
export function moonpetal() {
  const g = group("moonpetal", tube([[0, 0, 0], [0.01, 0.07, 0], [0.0, 0.13, 0]], 0.003, plain("stem", 0x5e8f3a, 0.6), 8, 5));
  g.add(at(lotus(0xdfe8ff, 0.6, "moonpetal"), [0, 0.12, 0], [0, 0, 0], 0.7));
  g.add(at(slab([[0, 0], [0.015, 0.02], [0, 0.06], [-0.015, 0.02]], 0.003, plain("leaf", 0x4e9a3a, 0.6), 0.001), [0.006, 0.05, 0], [0, 0, -50]));
  return at(g, [0, 0.03, 0], [0, 0, -70]);
}
export function worm() {
  const wm = mat("worm", 0xe88a86, { rough: 0.35 });
  const pts: V3[] = [];
  for (let i = 0; i <= 10; i++) pts.push([i * 0.012 - 0.06, 0.008, Math.sin(i * 0.9) * 0.018]);
  const g = group("worm", tube(pts, 0.0065, wm, 30, 8));
  g.add(at(sphere(0.0066, wm, 8, 6), pts[0]), at(sphere(0.0066, wm, 8, 6), pts[10]));
  for (const i of [3, 4]) g.add(at(torus(0.0068, 0.0018, mat("worm_band", 0xd06c6a, { rough: 0.35 }), 4, 10), pts[i], [0, 90, 0]));
  return g;
}
export function seedPouch(tie = 0x4f9a3a, seed = 0xe8d3a0) {
  const pm = clothMat(0xc9a574, "pouch");
  const g = group("seeds",
    lathe([[0, 0], [0.035, 0.002], [0.05, 0.03], [0.045, 0.06], [0.022, 0.08], [0.02, 0.09], [0.032, 0.105], [0.026, 0.11], [0.0, 0.1]], pm, 18),
    at(torus(0.021, 0.004, plain("tie", tie, 0.7), 6, 14), [0, 0.085, 0], [90, 0, 0]),
  );
  const sm = mat("seed", seed, { rough: 0.6 });
  const r = R(12);
  for (let i = 0; i < 6; i++) g.add(at(sphere(0.006, sm, 6, 5), [0.04 + r() * 0.04, 0.005, (r() - 0.5) * 0.05], [0, r() * 180, 0], [1.4, 0.8, 1]));
  return g;
}

// ---------- Monster loot ----------

export function feather() {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.bezierCurveTo(0.025, 0.04, 0.03, 0.12, 0.004, 0.2); s.bezierCurveTo(-0.02, 0.13, -0.02, 0.04, 0, 0);
  const fm = mat("feather", 0xf2ece0, { rough: 0.7, tex: "fur", normal: 0.4 });
  const g = group("feather", slabShape(s, 0.003, fm, 0.001, 12), at(rod(0.0018, 0.001, 0.22, plain("quill", 0xd8ccae, 0.5), 5), [0, -0.03, 0]));
  return at(g, [0, 0.008, 0], [-90, 0, 30]);
}
export function ratTail() {
  const pts: V3[] = [];
  for (let i = 0; i <= 10; i++) pts.push([i * 0.022 - 0.11, 0.006, Math.sin(i * 0.55) * 0.03]);
  const g = group("rat_tail", tube(pts, 0.004, mat("tail", 0xe8a8a0, { rough: 0.5 }), 30, 6));
  g.add(at(sphere(0.008, mat("fur", 0x8a7a6e, { rough: 0.9, tex: "fur" }), 8, 6), pts[0]));
  return g;
}
export function tusk() {
  const tm = mat("tusk", 0xf2ead2, { rough: 0.35 });
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.08, 0.0, 0), new THREE.Vector3(0.12, 0.07, 0));
  const geo = new THREE.TubeGeometry(curve, 16, 0.016, 10, false);
  const p = geo.attributes.position as THREE.BufferAttribute, c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { const t = Math.floor(i / 11) / 16; curve.getPoint(t, c); const k = 1 - t * 0.92; p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k, c.z + (p.getZ(i) - c.z) * k); }
  geo.computeVertexNormals();
  return group("boar_tusk", at(new THREE.Mesh(geo, tm), [-0.06, 0.016, 0]), at(sphere(0.016, mat("tusk_root", 0xd8c8a0, { rough: 0.6 }), 10, 8), [-0.06, 0.016, 0]));
}
export function fang() {
  const fm = mat("fang", 0xf6f0e0, { rough: 0.3 });
  const g = group("wolf_fang", at(lathe([[0.0, 0], [0.012, 0.004], [0.013, 0.02], [0.009, 0.045], [0.0, 0.065]], fm, 12), [0, 0, 0], [0, 0, 0], [1, 1, 0.75]));
  g.add(at(torus(0.012, 0.003, plain("cord", 0x5a3a22, 0.8), 6, 12), [0, 0.006, 0], [90, 0, 0]));
  return at(g, [0, 0.012, 0], [0, 0, -75]);
}
export function batWing() {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0.18, 0.05); s.quadraticCurveTo(0.15, 0.0, 0.17, -0.04); s.quadraticCurveTo(0.12, -0.05, 0.12, -0.09);
  s.quadraticCurveTo(0.07, -0.07, 0.06, -0.1); s.quadraticCurveTo(0.02, -0.06, 0, -0.06); s.closePath();
  const wm = mat("wing", 0x6a4e6a, { rough: 0.6, tex: "leather", normal: 0.3 });
  const bm = mat("wing_bone", 0x4a3448, { rough: 0.6 });
  const g = group("bat_wing", slabShape(s, 0.004, wm, 0.0015, 8));
  for (const end of [[0.18, 0.05], [0.17, -0.04], [0.12, -0.09], [0.06, -0.1]]) g.add(tube([[0, 0, 0.002], [end[0] * 0.5, end[1] * 0.5 + 0.01, 0.003], [end[0], end[1], 0.002]], 0.0025, bm, 8, 4));
  return at(g, [-0.08, 0.01, 0.04], [-90, 0, 0]);
}
export function venomSac() {
  const vm = mat("venom", 0x7be38a, { rough: 0.15, opacity: 0.8, emissive: 0x3aa04a, glow: 0.5 });
  return group("venom_sac",
    at(sphere(0.04, vm, 18, 12), [0, 0.035, 0], [0, 0, 0], [1, 0.85, 1]),
    at(lathe([[0.012, 0], [0.008, 0.02], [0.004, 0.03]], mat("sac_neck", 0x4a7a3a, { rough: 0.5 }), 10), [0, 0.06, 0]),
    at(sphere(0.012, mat("venom_core", 0xc8ff80, { rough: 0.2, emissive: 0x9ae060, glow: 0.8 }), 10, 8), [0, 0.035, 0]),
  );
}
export function slimeGoo() {
  const gm = mat("slime", 0x5fd0d8, { rough: 0.1, opacity: 0.85, emissive: 0x2f9fcf, glow: 0.25 });
  const r = R(17);
  const g = group("slime_goo", at(lump(0.05, gm, r, 0.25, 2, [1.2, 0.45, 1]), [0, 0.022, 0]));
  g.add(at(lump(0.018, gm, r, 0.2, 1, [1, 0.6, 1]), [0.06, 0.008, 0.03]));
  g.add(at(sphere(0.006, mat("bubble", 0xffffff, { rough: 0.1, opacity: 0.5 }), 8, 6), [-0.01, 0.035, 0.015]));
  return g;
}
export function goblinCharm() {
  const cord = plain("cord", 0x5a3a22, 0.8);
  const g = group("goblin_charm", tube([[-0.05, 0.004, -0.04], [0, 0.004, -0.06], [0.05, 0.004, -0.04]], 0.0025, cord, 12, 4));
  g.add(at(lathe([[0.0, 0], [0.012, 0.004], [0.013, 0.02], [0.009, 0.04], [0.0, 0.05]], mat("fang", 0xf2ead2, { rough: 0.3 }), 10), [0, 0.008, -0.02], [-90, 0, 0], [1, 1, 0.7]));
  g.add(at(sphere(0.012, mat("bead", 0x3f8a2e, { rough: 0.3 }), 10, 8), [-0.025, 0.012, -0.045]));
  g.add(at(sphere(0.012, mat("bead_red", 0xc2431b, { rough: 0.3 }), 10, 8), [0.025, 0.012, -0.045]));
  g.add(at(slab([[0, 0], [0.012, 0.03], [0, 0.06], [-0.012, 0.03]], 0.003, mat("feather", 0x6db33f, { rough: 0.7 }), 0.001), [0.012, 0.006, -0.03], [-90, 0, -30]));
  return g;
}
export function foodScraps() {
  const r = R(41);
  const g = group("food_scraps");
  const bits = [mat("crust", 0xc9904a, { rough: 0.7, tex: "stone", normal: 0.3 }), mat("peel", 0xe8a040, { rough: 0.6 }), mat("bone", 0xece3c8, { rough: 0.6 }), mat("leaf", 0x6db33f, { rough: 0.6 })];
  for (let i = 0; i < 9; i++) g.add(at(lump(0.014 + r() * 0.01, bits[i % 4], r, 0.35, 1, [1.3, 0.6, 1]), [(r() - 0.5) * 0.09, 0.01, (r() - 0.5) * 0.08], [r() * 40, r() * 180, 0]));
  return g;
}

// ---------- Bait ----------

export function baitChum() {
  const g = group("bait_chum",
    lathe([[0, 0], [0.05, 0], [0.055, 0.004], [0.06, 0.09], [0.064, 0.094], [0.058, 0.094], [0.054, 0.01], [0, 0.008]], woodMat("pine"), 18),
    at(cyl(0.055, 0.055, 0.004, mat("chum", 0xa05a4a, { rough: 0.4 }), 18), [0, 0.08, 0]),
    at(torus(0.059, 0.004, metalMat("iron"), 6, 18), [0, 0.03, 0], [90, 0, 0]),
    at(torus(0.062, 0.004, metalMat("iron"), 6, 18), [0, 0.075, 0], [90, 0, 0]),
  );
  const r = R(6);
  for (let i = 0; i < 6; i++) g.add(at(lump(0.008, mat("chum_bit", 0xc87a6a, { rough: 0.4 }), r, 0.3, 1), [(r() - 0.5) * 0.06, 0.085, (r() - 0.5) * 0.06]));
  return g;
}
export function glowLure() {
  const lm = mat("lure_glow", 0x8fe3ff, { rough: 0.15, emissive: 0x8fe3ff, glow: 1.2 });
  const g = group("bait_glow",
    at(capsule(0.012, 0.035, lm, 6, 12), [0, 0, 0], [0, 0, 90]),
    at(slab([[0, 0], [0.02, 0.014], [0.02, -0.014]], 0.003, mat("fin", 0xf2c14e, { rough: 0.3, metal: 1 }), 0.001), [-0.028, 0, 0], [0, 180, 0]),
    tube([[0.03, 0, 0], [0.04, 0.0, 0], [0.04, -0.015, 0], [0.032, -0.02, 0]], 0.0018, metalMat("steel"), 10, 4),
    at(sphere(0.004, plain("eye", 0x2a2420, 0.1), 6, 4), [0.016, 0.006, 0.01]),
  );
  return at(g, [0, 0.025, 0]);
}

// ---------- Gems and jewelry ----------

/** A rough gem: crystals growing out of a stone base. */
export function roughGem(key: string) {
  const c = GEMS[key].color;
  const cm = mat("gem", c, { rough: 0.2, emissive: c, glow: GEMS[key].glow ?? 0.25, opacity: 0.92 });
  const r = R(key.length * 7);
  const g = group("rough_" + key, at(lump(0.035, mat("rock", 0x7a756d, { rough: 0.85, tex: "stone", normal: 0.8 }), r, 0.3, 1, [1.3, 0.6, 1]), [0, 0.018, 0]));
  for (let i = 0; i < 5; i++) {
    const h = 0.04 + r() * 0.04;
    const crystal = group("crystal", at(cyl(0.012, 0.012, h, cm, 6), [0, h / 2, 0]), at(cone(0.012, 0.018, cm, 6), [0, h + 0.009, 0]));
    g.add(at(crystal, [(r() - 0.5) * 0.04, 0.025, (r() - 0.5) * 0.03], [(r() - 0.5) * 50, r() * 60, (r() - 0.5) * 50]));
  }
  return g;
}
export function cutGem(key = "sapphire") {
  return at(gem(0.02, gemMat(GEMS[key].color, GEMS[key].glow ?? 0.3), 10, 0.5, 0.85), [0, 0.017, 0]);
}
export function amulet(jm: Parameters<typeof jewelMat>[0] = "gold", key = "emerald") {
  const chain = jewelMat(jm);
  const g = group("amulet");
  // a chain of little links in a loop
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    g.add(at(torus(0.004, 0.0012, chain, 4, 8), [Math.cos(a) * 0.07, 0.003, Math.sin(a) * 0.09 - 0.02], [90, 0, (i % 2) * 90 + (a * 180) / Math.PI]));
  }
  const s = new THREE.Shape();
  s.moveTo(0, 0.03); s.bezierCurveTo(0.025, 0.03, 0.028, 0.0, 0, -0.03); s.bezierCurveTo(-0.028, 0.0, -0.025, 0.03, 0, 0.03);
  g.add(at(slabShape(s, 0.008, chain, 0.003, 12), [0, 0.005, 0.1], [-90, 0, 0]));
  g.add(at(gem(0.012, gemMat(GEMS[key].color, 0.35), 8, 0.4, 0.4), [0, 0.01, 0.1]));
  return g;
}
export function soulGem() {
  const c = 0xff7a2f;
  const g = group("emberstone",
    at(lathe([[0, -0.04], [0.028, -0.01], [0.03, 0.01], [0.0, 0.045]], mat("gem", 0xff6a1a, { rough: 0.1, emissive: 0xff7a2f, glow: 0.9 }), 7), [0, 0.04, 0]),
    at(sphere(0.012, mat("ember_core", 0xffe08a, { rough: 0.2, emissive: 0xffe08a, glow: 2 }), 10, 8), [0, 0.04, 0]),
  );
  return g;
}

// ---------- Quest items ----------

export function scroll() {
  const pm = mat("parchment", 0xeedcb0, { rough: 0.85, tex: "paper", normal: 0.5 });
  const g = group("blessing_scroll",
    at(cyl(0.024, 0.024, 0.22, pm, 18), [0, 0.024, 0], [0, 0, 90]),
    at(cyl(0.028, 0.028, 0.012, woodMat("maple"), 14), [0.116, 0.024, 0], [0, 0, 90]),
    at(cyl(0.028, 0.028, 0.012, woodMat("maple"), 14), [-0.116, 0.024, 0], [0, 0, 90]),
    at(torus(0.026, 0.005, clothMat(0xffe9a8, "ribbon"), 6, 16), [0, 0.024, 0], [0, 90, 0]),
    at(cyl(0.014, 0.014, 0.006, mat("wax", 0xc2431b, { rough: 0.35 }), 14), [0, 0.024, 0.026], [90, 0, 0]),
  );
  return g;
}
export function lantern() {
  const mm = metalMat("bronze");
  const g = group("lantern",
    at(cyl(0.05, 0.055, 0.015, mm, 8), [0, 0.008, 0]),
    at(cyl(0.045, 0.045, 0.11, mat("lantern_glass", 0xffe8b0, { rough: 0.1, opacity: 0.45, emissive: 0xffb347, glow: 0.6 }), 8), [0, 0.07, 0]),
    at(cone(0.058, 0.05, mm, 8), [0, 0.15, 0]),
    at(torus(0.018, 0.004, mm, 6, 14), [0, 0.19, 0]),
    at(sphere(0.016, mat("flame", 0xffb347, { rough: 0.3, emissive: 0xffb347, glow: 3 }), 10, 8), [0, 0.06, 0], [0, 0, 0], [1, 1.6, 1]),
    at(cyl(0.007, 0.007, 0.03, plain("candle", 0xf2ead2, 0.6), 8), [0, 0.03, 0]),
  );
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; g.add(at(rod(0.003, 0.003, 0.11, mm, 4), [Math.cos(a) * 0.046, 0.015, Math.sin(a) * 0.046])); }
  return g;
}
export function totem() {
  const wm = woodMat("oak");
  const g = group("shrine_totem",
    at(cyl(0.04, 0.045, 0.22, wm, 10), [0, 0.11, 0]),
    at(rbox(0.12, 0.02, 0.03, 0.008, wm), [0, 0.17, 0]),
    at(sphere(0.035, wm, 12, 10), [0, 0.25, 0], [0, 0, 0], [1, 1.1, 1]),
  );
  // carved face: two eyes, a mouth line, glowing ember gem on the chest
  for (const s of [1, -1]) g.add(at(sphere(0.008, plain("paint_white", 0xf2ead2, 0.6), 8, 6), [s * 0.012, 0.255, 0.031]));
  g.add(at(rbox(0.024, 0.005, 0.006, 0.002, plain("paint_dark", 0x3b2a1f, 0.7)), [0, 0.232, 0.032]));
  g.add(at(gem(0.012, gemMat(0xff7a2f, 1), 6, 0.4, 0.4), [0, 0.11, 0.042], [90, 0, 0]));
  for (let i = 0; i < 3; i++) g.add(at(torus(0.043, 0.004, clothMat([0xb4473c, 0xf2c14e, 0x3f64a8][i], "band"), 6, 16), [0, 0.04 + i * 0.016, 0], [90, 0, 0]));
  return g;
}
/** A folded paper note, optionally scorched, with writing. */
export function note(key: string, ink = "#3b2a1f", scorched = false) {
  const tex = paint("note_" + key, 128, 160, (c, w, h) => {
    c.fillStyle = "#efe2c0"; c.fillRect(0, 0, w, h);
    c.strokeStyle = ink; c.lineWidth = 2.2; c.lineCap = "round";
    const q = R(key.length * 3);
    for (let y = 22; y < h - 20; y += 13) { let x = 14; c.beginPath(); c.moveTo(x, y); while (x < w - 18) { x += 6 + q() * 14; c.lineTo(x, y + (q() - 0.5) * 2); if (q() < 0.2) { x += 6; c.moveTo(x, y); } } c.stroke(); }
    if (scorched) { const g = c.createRadialGradient(w, h, 10, w, h, w * 0.9); g.addColorStop(0, "rgba(40,20,10,0.95)"); g.addColorStop(0.5, "rgba(120,60,20,0.5)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(0, 0, w, h); }
  });
  const pm = paintedMat("paper", tex, { rough: 0.85 });
  const half = (flip: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.065, 1, 1), pm);
    const uv = m.geometry.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, flip > 0 ? 0.5 + uv.getY(i) * 0.5 : uv.getY(i) * 0.5);
    (m.material as THREE.Material).side = THREE.DoubleSide;
    return m;
  };
  const g = group(key, at(half(1), [0, 0.002, -0.032], [-90, 0, 0]), at(half(-1), [0, 0.008, 0.031], [-96, 0, 0]));
  if (key === "rooks_note") g.add(at(cyl(0.01, 0.01, 0.004, mat("wax", 0x2b3b6e, { rough: 0.35 }), 12), [0, 0.012, 0.0]));
  return g;
}
export function charm() {
  const g = group("marens_charm");
  const cord = plain("cord", 0xe9dfc8, 0.8);
  // a woven ring with threads across, beads and a hanging feather
  g.add(at(torus(0.04, 0.004, woodMat("birch"), 6, 24), [0, 0.004, 0], [90, 0, 0]));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI; g.add(at(rod(0.0012, 0.0012, 0.08, cord, 4), [0, 0.004, 0], [90, (a * 180) / Math.PI, 0])); g.children[g.children.length - 1].position.set(0, 0.004, 0); }
  g.add(at(sphere(0.007, mat("bead", 0x7fb8f0, { rough: 0.3, emissive: 0x7fb8f0, glow: 0.3 }), 10, 8), [0, 0.006, 0]));
  g.add(tube([[0, 0.004, 0.04], [0, 0.004, 0.06], [0.004, 0.004, 0.075]], 0.0012, cord, 6, 4));
  g.add(at(sphere(0.006, mat("bead_red", 0xb4473c, { rough: 0.3 }), 8, 6), [0, 0.006, 0.06]));
  const fth = slab([[0, 0], [0.01, 0.02], [0.004, 0.05], [-0.006, 0.02]], 0.002, mat("feather", 0xf2ece0, { rough: 0.7 }), 0.0008);
  g.add(at(fth, [0.004, 0.004, 0.075], [-90, 0, 180]));
  return g;
}
export function notebook() {
  const cm = leatherMat(0x4f7f45, "cover");
  const g = group("holts_notes",
    at(rbox(0.12, 0.006, 0.16, 0.003, cm), [0, 0.003, 0]),
    at(rbox(0.116, 0.024, 0.154, 0.002, mat("pages", 0xefe4c8, { rough: 0.85, tex: "paper", normal: 0.3 })), [0.002, 0.018, 0]),
    at(rbox(0.12, 0.006, 0.16, 0.003, cm), [0, 0.033, 0]),
    at(torus(0.07, 0.0018, plain("cord", 0xc9a574, 0.8), 4, 24), [0, 0.018, 0], [0, 0, 90], [1, 0.3, 1.13]),
  );
  // a leaf pressed between the pages, sticking out
  g.add(at(slab([[0, 0], [0.015, 0.02], [0, 0.05], [-0.015, 0.02]], 0.002, plain("leaf", 0xe0913a, 0.6), 0.0008), [0.06, 0.02, 0.03], [-90, 0, -70]));
  return g;
}

// ---------- The catalogue ----------

const D = (id: string, name: string, cat: string, about: string, build: () => THREE.Object3D, game: string[] = [id], extra: Partial<ItemDef> = {}): ItemDef => ({ id, name, cat, about, build, game, ...extra });

const POTIONS: [string, string, number, "round" | "tall", string][] = [
  ["health_potion", "Health potion", 0xe8203c, "round", "Heals you. Glowing red."],
  ["stamina_potion", "Stamina potion", 0x8ad84a, "tall", "Restores stamina. Fresh green."],
  ["mana_potion", "Mana potion", 0x3a80ff, "round", "Restores mana. Deep blue."],
  ["restore_potion", "Restoration draught", 0xf28ab2, "tall", "Restores health, stamina and mana together. Pink."],
  ["strength_potion", "Strength potion", 0xff7a2f, "round", "Hit harder for a while. Ember orange."],
  ["swift_potion", "Swiftness potion", 0x5fd0d8, "tall", "Move faster. Bright teal."],
  ["hunter_potion", "Hunter's brew", 0x9a6e46, "round", "Better hunting and loot. Earthy brown."],
  ["nightsight_potion", "Night sight potion", 0x8a5cff, "tall", "See in the dark. Violet."],
  ["tithe_potion", "Tithe tonic", 0xf2c14e, "round", "A golden tonic for the Lighthall's tithe."],
  ["soultrap_potion", "Ember trap potion", 0xffb347, "tall", "Traps a defeated monster's ember in a soul gem."],
];

export const GOODS_DEFS: ItemDef[] = [
  // resources
  ...(["tin", "iron", "silver", "gold", "platinum", "iridium"] as const).map((k) => D(`ore_${k}`, `${k[0].toUpperCase() + k.slice(1)} ore`, "Resources", `A rock chunk with ${k} showing through.`, () => ore(k), [`${k}_ore`])),
  D("leather", "Leather", "Materials", "Tanned leather rolled and tied with cord, one end loose.", leatherRoll),
  D("thread", "Thread", "Materials", "Spider silk spun onto a wooden spool.", threadSpool),
  D("cloth", "Cloth", "Materials", "Three folds of linen tied with red cord.", clothStack),
  D("cowhide", "Cowhide", "Materials", "A cream hide with brown patches, ready to tan.", () => hide(0xf2ead8, { spots: 0x7a4e2c, seed: 3, name: "cowhide" })),
  D("boar_hide", "Boar hide", "Materials", "A bristly brown hide.", () => hide(0x7a5434, { fur: true, seed: 7, name: "boar_hide" })),
  D("wolf_pelt", "Wolf pelt", "Materials", "A thick grey pelt.", () => hide(0x9aa0a8, { fur: true, seed: 11, size: 0.55, name: "wolf_pelt" })),
  D("alpha_pelt", "Alpha pelt", "Materials", "The alpha wolf's dark pelt with a pale streak.", () => hide(0x3e4450, { fur: true, seed: 13, size: 0.65, spots: 0xc9d6e2, name: "alpha_pelt" })),
  D("spider_silk", "Spider silk", "Materials", "A fluffy white bundle of silk wound with strands.", silk),
  // ingredients
  D("raw_chicken", "Raw chicken", "Ingredients", "A drumstick, pink skin and a bone end.", drumstick),
  D("raw_beef", "Raw beef", "Ingredients", "A thick marbled cut with a fat rim.", () => steakCut(0xc0484a, 0xf6e6d6, "beef")),
  D("raw_boar", "Raw boar", "Ingredients", "A darker cut of boar with a thick fat rim.", () => steakCut(0x9a3a36, 0xf0dcc8, "boar")),
  D("potato", "Potato", "Ingredients", "A lumpy potato.", potato),
  D("carrot", "Carrot", "Ingredients", "A carrot with its leafy top.", carrot),
  D("onion", "Onion", "Ingredients", "A golden onion with a twist on top.", onion),
  D("wheat", "Wheat", "Ingredients", "A small sheaf of wheat tied with red cord.", wheat),
  D("mushroom", "Mushrooms", "Ingredients", "Two brown cooking mushrooms.", buttonMushrooms),
  D("truffle", "Truffle", "Foraging", "Two knobbly black truffles. Rare and valuable.", truffle),
  D("wild_root", "Wild root", "Foraging", "A gnarled root with a few leaves.", wildRoot),
  // foraging finds
  D("sage", "Sage", "Foraging", "A sprig of soft grey-green sage.", sage),
  D("ginseng", "Ginseng", "Foraging", "A forked root with leaves and red berries.", ginseng),
  D("honey", "Honeycomb", "Foraging", "Waxy hexagon cells full of glowing honey.", honeycomb),
  D("old_bone", "Old bone", "Foraging", "A big old bone dug from the ground.", oldBone),
  D("blue_lotus", "Blue lotus", "Foraging", "A softly glowing blue water lily on its pad.", () => lotus(0x7fb8f0, 0.25)),
  D("moonpetal", "Moonpetal", "Foraging", "A pale flower that glows like moonlight.", moonpetal),
  D("worm", "Worm", "Foraging", "A wriggly pink worm. Bait, or Handicraft.", worm, ["worm", "bait_worm"]),
  D("seeds", "Seed pouch", "Foraging", "A tied seed pouch with seeds spilling out. The tie colour shows the crop.", () => seedPouch(), ["seed_*"]),
  // loot
  D("feather", "Feather", "Loot", "A soft white chicken feather.", feather),
  D("rat_tail", "Rat tail", "Loot", "A long pink rat tail.", ratTail),
  D("boar_tusk", "Boar tusk", "Loot", "A curved ivory tusk.", tusk),
  D("wolf_fang", "Wolf fang", "Loot", "A sharp fang on a cord.", fang),
  D("bat_wing", "Bat wing", "Loot", "A leathery purple wing.", batWing),
  D("venom_sac", "Venom sac", "Loot", "A glowing green sac of spider venom.", venomSac),
  D("slime_goo", "Slime goo", "Loot", "A wobbly blob of glowing blue slime.", slimeGoo),
  D("goblin_charm", "Goblin charm", "Loot", "A fang, beads and a green feather on a cord.", goblinCharm),
  D("stolen_ring", "Stolen ring", "Loot", "A silver ring with a sapphire, taken by goblins.", () => ring("silver", "sapphire")),
  D("food_scraps", "Food scraps", "Loot", "Bits of crust, peel and bone. Handicraft turns them into chum.", foodScraps),
  // bait
  D("bait_chum", "Chum bucket", "Bait", "A little bucket of chum for bigger fish.", baitChum),
  D("bait_glow", "Glow lure", "Bait", "A glowing lure for deep-water fish.", glowLure),
  // potions
  ...POTIONS.filter(([id]) => id !== "health_potion").map(([id, name, c, shape, about]) => D(id, name, "Potions", about, () => potion(c, shape), [`potion_${id.replace("_potion", "")}*`])),
  D("vial", "Empty vial", "Potions", "An empty glass vial. Every potion uses one.", () => potion(0xffffff, "vial"), ["vial"]),
  // gems and jewelry
  ...Object.keys(GEMS).filter((k) => k !== "emberstone").map((k) => D(`rough_${k}`, `Rough ${GEMS[k].name.toLowerCase()}`, "Jewelry", `${GEMS[k].name} crystals growing from a stone, before cutting.`, () => roughGem(k), [`rough_${k}*`])),
  D("cut_gem", "Cut gem", "Jewelry", "A cut, polished gem. Swap the gem for each kind.", () => cutGem(), ["cut_*"], { swaps: ["gem"] }),
  D("amulet", "Amulet", "Jewelry", "A heart-shaped pendant with a gem on a fine chain.", () => amulet(), ["amulet_*"], { swaps: ["jewel", "gem"] }),
  D("emberstone", "Emberstone", "Jewelry", "A soul gem with an ember glowing inside.", soulGem, ["*soul*", "*ember*"]),
  // magic and quest items
  D("book_haste", "Spell book: Haste", "Magic", "Green covers and a glowing green gem.", () => spellBook(0x4f7f45, 0x7be38a), ["book_haste"]),
  D("book_invisibility", "Spell book: Invisibility", "Magic", "Slate covers and a pale glowing gem.", () => spellBook(0x6e7680, 0xe8f0ff), ["book_invisibility"]),
  D("book_frost_nova", "Spell book: Frost nova", "Magic", "Deep blue covers and an icy gem.", () => spellBook(0x3f64a8, 0x8fe3ff), ["book_frost_nova"]),
  D("blessing_scroll", "Blessing scroll", "Quest items", "A rolled parchment with a gold ribbon and a red wax seal.", scroll),
  D("lantern", "Lantern", "Quest items", "A bronze lantern with a glowing candle.", lantern),
  D("shrine_totem", "Shrine totem", "Quest items", "A carved wooden totem with painted bands and an ember gem.", totem),
  D("rooks_note", "Rook's note", "Quest items", "A folded note sealed with blue wax.", () => note("rooks_note")),
  D("ashbound_note", "Scrawled note", "Quest items", "A hurried note, scorched at one corner.", () => note("ashbound_note", "#5a1a10", true)),
  D("marens_charm", "Maren's charm", "Quest items", "A woven birch charm with beads and a feather.", charm),
  D("holts_notes", "Holt's notes", "Quest items", "A green leather notebook tied with string, a leaf pressed inside.", notebook),
];

void bar; void barkMat; void glassMat;
