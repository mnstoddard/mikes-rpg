// Potions, food and fish.
import * as THREE from "three";
import { ItemDef, at, group, lathe, glassMat, mat, plain, sphere, cyl, torus, paint, paintedMat, slab, lump, rng, woodMat, clothMat, capsule, tube, cone } from "./kit";

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
    lathe(inner, mat("liquid", color, { rough: 0.15, emissive: color, glow: 0.35 }), 20),
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

/** Fish markings, painted round the body: dark back, pale belly, spots and a stripe. */
function fishTex(key: string, back: string, side: string, belly: string, stripe: string | null, spots: string | null) {
  return paint("fish_" + key, 256, 128, (c, w, h) => {
    // the lathe texture runs u = round the body (0 = the side facing you, 0.25 = back, 0.75 = belly), v = nose to tail
    const grad = c.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, side); grad.addColorStop(0.25, back); grad.addColorStop(0.5, side); grad.addColorStop(0.62, belly);
    grad.addColorStop(0.88, belly); grad.addColorStop(1, side);
    c.fillStyle = grad; c.fillRect(0, 0, w, h);
    if (stripe) {
      c.fillStyle = stripe; c.globalAlpha = 0.75;
      for (const u0 of [-0.035, 0.465, 0.965]) c.fillRect(u0 * w, h * 0.12, w * 0.07, h * 0.78);
      c.globalAlpha = 1;
    }
    if (spots) {
      const r = rng(7);
      c.fillStyle = spots;
      for (let i = 0; i < 120; i++) {
        const u = r(), v = 0.1 + r() * 0.85;
        if (Math.abs(u - 0.25) > 0.22) continue;
        c.beginPath(); c.arc(u * w, v * h, 1.4 + r() * 1.6, 0, Math.PI * 2); c.fill();
      }
    }
  });
}

/** A fish lying on its side (as caught). Length in metres, nose toward +X. */
export function fish(len = 0.32, tex = fishTex("trout", "#5d7a4a", "#b9c49a", "#f1ead8", "#e98a8a", "#3d4a30"), fin = 0x9aa070) {
  const prof: [number, number][] = [[0, 0], [0.06, 0.02], [0.11, 0.08], [0.13, 0.25], [0.11, 0.55], [0.06, 0.82], [0.03, 0.95], [0.022, 1]];
  const body = lathe(prof.map(([r, y]) => [r * len, y * len]), paintedMat("fish_skin", tex, { rough: 0.35 }), 18);
  body.scale.set(1, 1, 0.5);
  const finM = mat("fin", fin, { rough: 0.5, opacity: 0.85 });
  const g = group("fish",
    at(body, [0, 0, 0], [0, 0, 90]),
    // tail
    at(slab([[0, 0], [len * 0.2, len * 0.12], [len * 0.16, 0], [len * 0.2, -len * 0.12]], 0.006, finM, 0.002), [-len * 0.98, 0, 0], [0, 180, 0]),
    // dorsal and belly fins
    at(slab([[0, 0], [len * 0.2, 0], [len * 0.05, len * 0.09]], 0.005, finM, 0.002), [-len * 0.45, len * 0.115, 0]),
    at(slab([[0, 0], [len * 0.12, 0], [len * 0.03, -len * 0.05]], 0.005, finM, 0.002), [-len * 0.6, -len * 0.09, 0]),
    // side fin
    at(slab([[0, 0], [len * 0.09, len * 0.02], [len * 0.1, -len * 0.03]], 0.004, finM, 0.0015), [-len * 0.2, -len * 0.03, len * 0.06], [0, 30, -20]),
    // eye
    at(sphere(len * 0.022, plain("eye_white", 0xf2f0ea, 0.2), 10, 8), [-len * 0.1, len * 0.025, len * 0.05]),
    at(sphere(len * 0.013, plain("eye", 0x2a2420, 0.1), 8, 6), [-len * 0.1, len * 0.026, len * 0.062]),
  );
  // upright, belly just above the ground, centred, nose to +X
  return group("trout", at(g, [len * 0.5, len * 0.15, 0]));
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
    at(new THREE.Mesh(new THREE.SphereGeometry(0.058, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), capM), [0, 0.058, 0], [0, 0, 0], [1, 0.8, 1]),
    at(lathe([[0.058, 0], [0.05, -0.006], [0.02, -0.004]], capM, 24), [0, 0.058, 0]),
    at(cyl(0.048, 0.048, 0.003, mat("gills", 0xe8d6b8, { rough: 0.8 }), 22), [0, 0.053, 0]),
  );
  const r = rng(3);
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, e = 0.25 + r() * 1.0;
    const R = 0.058;
    const p = new THREE.Vector3(Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R * 0.8, Math.sin(a) * Math.cos(e) * R);
    const s = at(sphere(0.007 + r() * 0.004, spot, 8, 6), [p.x, 0.058 + p.y, p.z], [0, 0, 0], [1, 1, 0.35]);
    s.lookAt(new THREE.Vector3(p.x * 1.2, 0.058 + p.y * 1.56, p.z * 1.2).multiplyScalar(2));
    g.add(s);
  }
  // a smaller one beside it
  const small = g.clone();
  return group("mushrooms", g, at(small, [0.05, 0, 0.03], [0, 40, 10], 0.6));
}

void THREE; void tube; void cone;

export const CONSUMABLE_DEFS: ItemDef[] = [
  { id: "health_potion", name: "Health potion", cat: "Potions", game: ["health_potion"], about: "A round flask of glowing red liquid with a cork and a linen tie.", build: () => potion(0xe8203c, "round") },
  { id: "trout", name: "Trout", cat: "Fish", game: ["trout"], about: "Olive back, pink side stripe, dark spots. Lies on its side as caught.", build: () => fish() },
  { id: "stew", name: "Stew", cat: "Food", game: ["meal_stew*"], about: "A wooden bowl of stew with potato, carrot and meat, herbs and a spoon.", build: stew },
  { id: "red_cap", name: "Red cap mushroom", cat: "Foraging", game: ["red_cap"], about: "A red-capped mushroom with cream spots, and a little one beside it.", build: () => mushroom() },
];
