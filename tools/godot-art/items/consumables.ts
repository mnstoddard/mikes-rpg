// Potions, food and fish.
import * as THREE from "three";
import { ItemDef, at, group, lathe, glassMat, mat, plain, sphere, cyl, torus, paint, paintedMat, slab, slabShape, lump, rng, woodMat, clothMat, capsule, tube, cone, metalMat, rod } from "./kit";

/** A round potion flask with glowing liquid, a cork and a tied cloth. */
export function potion(color = 0xff4058, shape: "round" | "tall" | "vial" = "round") {
  const prof: Record<string, [number, number][]> = {
    round: [[0, 0], [0.04, 0.003], [0.062, 0.03], [0.066, 0.065], [0.05, 0.1], [0.02, 0.118], [0.019, 0.15], [0.024, 0.16]],
    tall: [[0, 0], [0.04, 0.002], [0.046, 0.02], [0.046, 0.1], [0.03, 0.13], [0.016, 0.145], [0.016, 0.18], [0.021, 0.19]],
    vial: [[0, 0], [0.018, 0.003], [0.022, 0.015], [0.022, 0.13], [0.026, 0.14]],
  };
  const pts = prof[shape];
  const fill = shape === "vial" ? 0.09 : shape === "tall" ? 0.11 : 0.085;
  const inner = pts.filter(([, y]) => y <= fill).map(([r, y]) => [Math.max(0, r - 0.004), y + 0.003] as [number, number]);
  inner.push([inner[inner.length - 1][0], fill], [0, fill]);
  const top = pts[pts.length - 1];
  const g = group("potion",
    lathe(pts, glassMat(), 20),
    lathe(inner, mat("liquid", color, { rough: 0.2, emissive: color, glow: 0.12 }), 20),
    at(cyl(top[0] * 0.85, top[0] * 0.75, 0.03, mat("cork", 0xc9a574, { rough: 0.9, tex: "stone", normal: 0.3 }), 12), [0, top[1] + 0.005, 0]),
  );
  if (shape !== "vial") {
    g.add(at(torus(pts[pts.length - 2][0] + 0.003, 0.004, clothMat(0xe9dfc8, "tie"), 6, 16), [0, pts[pts.length - 2][1] - 0.01, 0], [90, 0, 0]));
    // two bubbles floating in the liquid
    g.add(at(sphere(0.006, mat("bubble", 0xffffff, { rough: 0.1, opacity: 0.5 }), 8, 6), [0.015, fill - 0.02, 0.01]));
    g.add(at(sphere(0.004, mat("bubble", 0xffffff, { rough: 0.1, opacity: 0.5 }), 8, 6), [-0.012, fill - 0.035, -0.006]));
  }
  return g;
}

/** A bowl of stew: wooden bowl, thick sauce, chunks of potato, carrot and meat, herbs on top. */
export function stew() {
  const r = rng(11);
  const bowl = lathe([[0, 0], [0.05, 0], [0.06, 0.006], [0.085, 0.035], [0.098, 0.065], [0.1, 0.07], [0.092, 0.07], [0.08, 0.04], [0.05, 0.016], [0, 0.014]], woodMat("pine"), 24);
  const sauce = cyl(0.09, 0.08, 0.01, mat("stew_sauce", 0xb4622c, { rough: 0.25 }), 24);
  const g = group("stew", bowl, at(sauce, [0, 0.056, 0]));
  const bits: [number, number, number][] = [[0xf08a2a, 0.016, 5], [0xf3dc9a, 0.018, 4], [0x8a4a30, 0.017, 4]];
  bits.forEach(([col, size, n]) => {
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = r() * 0.065;
      g.add(at(lump(size, mat("stew_bit", col, { rough: 0.55 }), r, 0.25, 1, [1, 0.7, 1]), [Math.cos(a) * d, 0.062, Math.sin(a) * d], [r() * 60, r() * 180, 0]));
    }
  });
  for (let i = 0; i < 10; i++) {
    const a = r() * Math.PI * 2, d = r() * 0.07;
    g.add(at(slab([[0, 0], [0.006, 0.004], [0, 0.01], [-0.006, 0.004]], 0.0015, plain("herb", 0x4f9a3a, 0.6), 0.0006), [Math.cos(a) * d, 0.07, Math.sin(a) * d], [-90, 0, r() * 360]));
  }
  // a wooden spoon resting in it
  g.add(at(group("spoon", at(capsule(0.006, 0.13, woodMat("birch"), 3, 6), [0, 0.07, 0], [0, 0, 0]), at(sphere(0.02, woodMat("birch"), 10, 8), [0, 0, 0], [0, 0, 0], [1, 0.35, 1.3])), [0.03, 0.08, 0.02], [0, 30, -60]));
  return g;
}

export function mushroom(cap = 0xd8483c) {
  const capM = mat("cap", cap, { rough: 0.5 });
  const spot = plain("spots", 0xf6efe0, 0.6);
  const stem = mat("stem", 0xf1e6cc, { rough: 0.7, tex: "paper", normal: 0.4 });
  const g = group("mushroom",
    lathe([[0, 0], [0.022, 0.002], [0.019, 0.03], [0.016, 0.06], [0.0, 0.065]], stem, 14),
    at(new THREE.Mesh(new THREE.SphereGeometry(0.058, 18, 7, 0, Math.PI * 2, 0, Math.PI / 2), capM), [0, 0.058, 0], [0, 0, 0], [1, 0.8, 1]),
    at(lathe([[0.058, 0], [0.05, -0.006], [0.02, -0.004]], capM, 24), [0, 0.058, 0]),
    at(cyl(0.048, 0.048, 0.003, mat("gills", 0xe8d6b8, { rough: 0.8 }), 22), [0, 0.053, 0]),
  );
  const r = rng(3);
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, e = 0.25 + r() * 1.0;
    const R = 0.058;
    const p = new THREE.Vector3(Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R * 0.8, Math.sin(a) * Math.cos(e) * R);
    const s = at(sphere(0.007 + r() * 0.004, spot, 6, 4), [p.x, 0.058 + p.y, p.z], [0, 0, 0], [1, 1, 0.35]);
    s.lookAt(new THREE.Vector3(p.x * 1.2, 0.058 + p.y * 1.56, p.z * 1.2).multiplyScalar(2));
    g.add(s);
  }
  // a smaller one beside it
  const small = g.clone();
  return group("mushrooms", g, at(small, [0.05, 0, 0.03], [0, 40, 10], 0.6));
}

/** A glazed plate. */
function plate(r = 0.12) {
  return lathe([[0, 0], [r * 0.6, 0], [r * 0.65, 0.004], [r * 0.7, 0.008], [r, 0.018], [r * 1.02, 0.02], [r * 0.98, 0.021], [r * 0.68, 0.011], [0, 0.009]], mat("plate", 0xf2ece0, { rough: 0.25 }), 28);
}
const veg = (r: () => number, g: THREE.Group, n: number, spread: number, y: number) => {
  const cols = [0xf08a2a, 0x6db33f, 0xffd75a, 0xd8483c];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = r() * spread;
    g.add(at(lump(0.009 + r() * 0.005, mat("veg", cols[i % 4], { rough: 0.5 }), r, 0.3, 1, [1.3, 0.7, 1]), [Math.cos(a) * d, y, Math.sin(a) * d], [r() * 90, r() * 180, 0]));
  }
};

export function stirFry() {
  const r = rng(21);
  const pan = lathe([[0, 0], [0.07, 0], [0.11, 0.03], [0.13, 0.055], [0.134, 0.058], [0.128, 0.058], [0.106, 0.034], [0.068, 0.006], [0, 0.006]], metalMat("iron"), 26);
  const g = group("stir_fry", pan, at(rod(0.012, 0.014, 0.16, woodMat("oak"), 10), [0.13, 0.05, 0], [0, 0, -78]));
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = r() * 0.07;
    g.add(at(capsule(0.007, 0.03, mat("meat_strip", 0xa86a3a, { rough: 0.45 }), 3, 6), [Math.cos(a) * d, 0.022, Math.sin(a) * d], [90, 0, r() * 180]));
  }
  veg(r, g, 14, 0.08, 0.022);
  for (let i = 0; i < 6; i++) g.add(at(slab([[0, 0], [0.006, 0.004], [0, 0.01], [-0.006, 0.004]], 0.0015, plain("herb", 0x4f9a3a, 0.6), 0.0006), [(r() - 0.5) * 0.12, 0.034, (r() - 0.5) * 0.12], [-90, 0, r() * 360]));
  return g;
}

export function curry() {
  const r = rng(23);
  const bowl = lathe([[0, 0], [0.05, 0], [0.06, 0.006], [0.088, 0.035], [0.1, 0.06], [0.102, 0.064], [0.094, 0.064], [0.082, 0.038], [0.05, 0.014], [0, 0.012]], mat("bowl", 0x3f64a8, { rough: 0.3 }), 24);
  const g = group("curry", bowl,
    at(cyl(0.088, 0.078, 0.01, mat("curry_sauce", 0xe0912a, { rough: 0.25 }), 24), [0, 0.05, 0]),
    // a mound of rice on one side
    at(lump(0.04, mat("rice", 0xf6f0e0, { rough: 0.7, tex: "stone", normal: 0.5 }), r, 0.12, 2, [1, 0.5, 1]), [-0.03, 0.058, -0.01]),
  );
  for (let i = 0; i < 5; i++) { const a = r() * Math.PI * 2, d = 0.04 + r() * 0.03; g.add(at(lump(0.013, mat("curry_bit", 0xc86a3a, { rough: 0.5 }), r, 0.25, 1), [Math.cos(a) * d + 0.02, 0.058, Math.sin(a) * d], [0, r() * 180, 0])); }
  for (let i = 0; i < 6; i++) g.add(at(slab([[0, 0], [0.006, 0.004], [0, 0.01], [-0.006, 0.004]], 0.0015, plain("herb", 0x4f9a3a, 0.6), 0.0006), [(r() - 0.5) * 0.1, 0.063, (r() - 0.5) * 0.1], [-90, 0, r() * 360]));
  return g;
}

export function steakPlate() {
  const r = rng(25);
  const s = new THREE.Shape();
  s.moveTo(-0.07, -0.02); s.bezierCurveTo(-0.08, 0.04, -0.02, 0.06, 0.03, 0.05); s.bezierCurveTo(0.08, 0.04, 0.085, -0.02, 0.06, -0.045); s.bezierCurveTo(0.02, -0.06, -0.05, -0.06, -0.07, -0.02);
  const sm = paintedMat("steak", paint("grill_marks", 128, 128, (c, w, h) => {
    c.fillStyle = "#8a4a2a"; c.fillRect(0, 0, w, h);
    c.strokeStyle = "#3b2216"; c.lineWidth = 6;
    for (let i = -2; i < 8; i++) { c.beginPath(); c.moveTo(i * 22, 0); c.lineTo(i * 22 + 60, h); c.stroke(); }
  }), { rough: 0.45 });
  const g = group("steak", plate(), at(slabShape(s, 0.026, sm, 0.009, 12), [-0.01, 0.024, 0], [-90, 0, 10]));
  // greens and a few roast potatoes on the side
  for (let i = 0; i < 3; i++) g.add(at(lump(0.017, mat("roast_potato", 0xe0a850, { rough: 0.5 }), r, 0.2, 1), [0.07, 0.024, -0.04 + i * 0.035]));
  for (let i = 0; i < 4; i++) g.add(at(slab([[0, 0], [0.01, 0.012], [0, 0.03], [-0.01, 0.012]], 0.002, plain("leaf", 0x4f9a3a, 0.6), 0.0008), [-0.07 + i * 0.012, 0.014, 0.055], [-80, 0, i * 30]));
  return g;
}

export function roast() {
  const r = rng(27);
  const g = group("roast", plate(0.14));
  g.add(at(lump(0.06, mat("roast_skin", 0xb86a2e, { rough: 0.35, tex: "leather", normal: 0.3 }), r, 0.12, 2, [1.3, 0.75, 1]), [0, 0.055, 0]));
  g.add(at(rod(0.009, 0.008, 0.06, plain("bone", 0xf4eedc, 0.6), 10), [0.07, 0.06, 0], [0, 0, -70]));
  g.add(at(sphere(0.012, plain("bone", 0xf4eedc, 0.6), 10, 8), [0.128, 0.08, 0]));
  veg(r, g, 10, 0.12, 0.02);
  g.add(at(sphere(0.012, mat("garnish", 0xd8483c, { rough: 0.3 }), 10, 8), [-0.05, 0.1, 0.01]));
  return g;
}

void THREE; void tube; void cone;

export const CONSUMABLE_DEFS: ItemDef[] = [
  { id: "health_potion", name: "Health potion", cat: "Potions", game: ["health_potion", "potion_health*"], about: "A round flask of glowing red liquid with a cork and a linen tie.", build: () => potion(0xe8203c, "round") },
  { id: "stew", name: "Stew", cat: "Food", game: ["meal_stew_*"], about: "A wooden bowl of stew with potato, carrot and meat, herbs and a spoon.", build: stew },
  { id: "stir_fry", name: "Stir fry", cat: "Food", game: ["meal_stirfry_*"], about: "An iron pan of meat strips and bright vegetables with herbs.", build: stirFry },
  { id: "curry", name: "Curry", cat: "Food", game: ["meal_curry_*"], about: "A blue bowl of golden curry with rice and herbs.", build: curry },
  { id: "steak", name: "Steak", cat: "Food", game: ["meal_steak_*"], about: "A grilled steak with roast potatoes and greens.", build: steakPlate },
  { id: "roast", name: "Roast", cat: "Food", game: ["meal_roast_*"], about: "A roast joint with vegetables on a big plate.", build: roast },
  { id: "red_cap", name: "Red cap mushroom", cat: "Foraging", game: ["red_cap"], about: "A red-capped mushroom with cream spots, and a little one beside it.", build: () => mushroom() },
];
