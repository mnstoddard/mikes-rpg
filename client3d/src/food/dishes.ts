// Cooked dishes from the stove: Stew, Stir fry, Curry, Steak and Roast
// (shared/cooking.ts). Each one is shown with its main ingredient, steaming.
import * as THREE from "three";
import type { DishId } from "../../../shared/cooking";
import { Rng, Showpiece, mat, mesh, lump, jitter, lathe, leafGeo, between, steam, still } from "./common";
import { slab } from "./ingredients";

export const DISH_VARIANTS: Record<DishId, readonly string[]> = {
  stew: ["Fish", "Chicken", "Beef", "Vegetable"],
  stirfry: ["Chicken", "Beef", "Vegetable"],
  curry: ["Fish", "Chicken", "Vegetable"],
  steak: ["Beef", "Boar"],
  roast: ["Beef", "Chicken"],
};

/** Colours of cooked chunks. */
const CHUNK: Record<string, number[]> = {
  Fish: [0xf2e4cc, 0xeedabc],
  Chicken: [0xe6c08e, 0xd9ac74],
  Beef: [0x6e3a22, 0x5a2e1a],
  Boar: [0x5a2a1e, 0x4a2218],
  Vegetable: [0xe0c070, 0xe8741e, 0x5aa040],
};

const HERB = 0x4f9a3a;

function bowl(color: number, r = 0.085, h = 0.065, o: { rim?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  const k = r / 0.085;
  const outline: [number, number][] = [[0, 0], [0.04, 0], [0.045, 0.005], [0.07, 0.03], [0.085, h], [0.088, h + 0.004], [0.082, h + 0.003], [0.066, 0.034], [0.035, 0.014], [0, 0.014]];
  g.add(lathe(outline.map(([x, y]) => [x * k, y] as [number, number]), color, { roughness: 0.45, sides: 20 }));
  if (o.rim) {
    const rim = mesh(new THREE.TorusGeometry(0.086 * k, 0.003, 4, 20).rotateX(Math.PI / 2), mat(o.rim, { roughness: 0.4 }));
    rim.position.y = h + 0.002;
    g.add(rim);
  }
  return g;
}

/** A flat surface of soup or sauce inside a bowl. */
function surface(radius: number, y: number, color: number): THREE.Mesh {
  const m = mesh(new THREE.CircleGeometry(radius, 20).rotateX(-Math.PI / 2), mat(color, { roughness: 0.25 }), false);
  m.position.y = y;
  return m;
}

/** Bits floating in a soup that bob up and down. */
function chunks(rng: Rng, kind: string, n: number, radius: number, y: number, bobs: { o: THREE.Object3D; y: number; p: number }[], size = 1): THREE.Group {
  const g = new THREE.Group();
  const cols = CHUNK[kind];
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * radius;
    const c = cols[i % cols.length];
    const isCube = kind === "Vegetable" || kind === "Beef" || kind === "Boar";
    const geo = isCube ? jitter(new THREE.BoxGeometry(0.016 * size, 0.014 * size, 0.016 * size), rng, 0.004 * size) : jitter(new THREE.IcosahedronGeometry(0.011 * size, 0), rng, 0.004 * size);
    if (!isCube) geo.scale(1.4, 0.8, 1);
    const m = mesh(geo, mat(c, { roughness: 0.55 }));
    m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    g.add(m);
    bobs.push({ o: m, y, p: rng() * 6 });
  }
  // A few green herbs on top.
  for (let i = 0; i < 4; i++) {
    const l = mesh(leafGeo(0.012 * size, 0.005 * size), mat(HERB, { double: true }), false);
    l.position.set((rng() - 0.5) * radius, y + 0.004, (rng() - 0.5) * radius);
    l.rotation.y = rng() * 6;
    g.add(l);
  }
  return g;
}

function plate(r = 0.13, color = 0xf1ece2): THREE.Mesh {
  return lathe([[0, 0], [r * 0.62, 0], [r * 0.7, 0.006], [r, 0.016], [r * 1.02, 0.018], [r * 0.98, 0.019], [r * 0.7, 0.009], [0, 0.009]], color, { roughness: 0.35, sides: 24 });
}

function grillMarks(rng: Rng, g: THREE.Group, w: number, y: number, n = 4, len = 0.12) {
  for (let i = 0; i < n; i++) {
    const m = mesh(new THREE.BoxGeometry(len, 0.002, 0.005), mat(0x2a160c, { roughness: 1 }), false);
    m.position.set((i - (n - 1) / 2) * w * 0.4, y, 0);
    m.rotation.y = 0.7 + (rng() - 0.5) * 0.05;
    g.add(m);
  }
}

function stew(rng: Rng, kind: string, bobs: { o: THREE.Object3D; y: number; p: number }[]): THREE.Group {
  const g = new THREE.Group();
  g.add(bowl(0x8a5a34)); // a wooden bowl
  g.add(surface(0.078, 0.054, kind === "Fish" ? 0xb8803c : 0x7a4420));
  g.add(chunks(rng, kind, 9, 0.055, 0.056, bobs));
  if (kind !== "Vegetable") g.add(chunks(rng, "Vegetable", 5, 0.055, 0.056, bobs));
  // A wooden spoon resting in it.
  const spoon = new THREE.Group();
  const handle = mesh(new THREE.BoxGeometry(0.15, 0.006, 0.012), mat(0xb88a52));
  handle.position.x = 0.075;
  const head = lump(rng, 0.02, 0.006, 0.014, 0xb88a52, { detail: 0, lumpy: 0.05 });
  spoon.add(handle, head);
  spoon.position.set(0.01, 0.06, 0.02);
  spoon.rotation.set(0, -0.5, 0.35);
  g.add(spoon);
  return g;
}

function stirfry(rng: Rng, kind: string): THREE.Group {
  const g = new THREE.Group();
  const iron = { roughness: 0.4, metalness: 0.6 };
  g.add(lathe([[0, 0], [0.05, 0], [0.1, 0.03], [0.13, 0.06], [0.133, 0.062], [0.127, 0.062], [0.097, 0.034], [0.048, 0.006], [0, 0.006]], 0x2e2e33, { ...iron, sides: 22 }));
  const handle = mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.14, 6).rotateZ(Math.PI / 2 - 0.25), mat(0x5a3a22));
  handle.position.set(0.19, 0.07, 0);
  g.add(handle);
  const meat = CHUNK[kind === "Vegetable" ? "Vegetable" : kind];
  const veg = [0xd23a2a, 0x4a9a3a, 0xf2d24a, 0x6fb04a, 0xf3eee0];
  for (let i = 0; i < 26; i++) {
    const isMeat = kind !== "Vegetable" && i % 3 === 0;
    const c = isMeat ? meat[i % meat.length] : veg[i % veg.length];
    const geo = jitter(new THREE.BoxGeometry(between(rng, 0.03, 0.05), 0.008, 0.01), rng, 0.003);
    const m = mesh(geo, mat(c, { roughness: 0.3 }));
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * 0.08;
    m.position.set(Math.cos(a) * r, 0.02 + (0.08 - r) * 0.35 + rng() * 0.012, Math.sin(a) * r);
    m.rotation.set((rng() - 0.5) * 0.6, rng() * 6, (rng() - 0.5) * 0.6);
    g.add(m);
  }
  // Sesame-ish seeds.
  for (let i = 0; i < 14; i++) {
    const s = mesh(new THREE.SphereGeometry(0.0022, 4, 3), mat(0xf4ecd0), false);
    s.position.set((rng() - 0.5) * 0.12, 0.045, (rng() - 0.5) * 0.12);
    g.add(s);
  }
  return g;
}

function curry(rng: Rng, kind: string, bobs: { o: THREE.Object3D; y: number; p: number }[]): THREE.Group {
  const g = new THREE.Group();
  g.add(bowl(0xf2ede2, 0.1, 0.06, { rim: 0x3a6ab0 }));
  g.add(surface(0.088, 0.048, 0xd98a24));
  const rice = lump(rng, 0.042, 0.022, 0.038, 0xf7f4ea, { detail: 2, lumpy: 0.08, roughness: 0.9 });
  rice.position.set(-0.04, 0.05, 0);
  g.add(rice);
  const c = chunks(rng, kind, 7, 0.04, 0.05, bobs);
  c.position.x = 0.025;
  g.add(c);
  return g;
}

function steak(rng: Rng, kind: string): THREE.Group {
  const g = new THREE.Group();
  g.add(plate());
  const boar = kind === "Boar";
  const s = new THREE.Group();
  const fat = slab(rng, 0.075, 0.052, 0.022, boar ? 0xc9a070 : 0xb88a5a, 0.12);
  const meat = slab(rng, 0.066, 0.045, 0.025, boar ? 0x4a2216 : 0x6a3420, 0.12);
  meat.position.x = 0.004;
  s.add(fat, meat);
  grillMarks(rng, s, 0.1, 0.0255, 4, 0.07);
  s.position.set(-0.02, 0.009, 0);
  g.add(s);
  // Sides: carrot coins and potato wedges.
  for (let i = 0; i < 4; i++) {
    const c = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.005, 7), mat(0xe8741e, { roughness: 0.4 }));
    c.position.set(0.07 + (i % 2) * 0.018, 0.013, -0.03 + i * 0.02);
    g.add(c);
  }
  for (let i = 0; i < 3; i++) {
    const w = lump(rng, 0.022, 0.012, 0.012, 0xdca04a, { detail: 0, lumpy: 0.1 });
    w.position.set(0.02 + i * 0.025, 0.017, 0.07);
    w.rotation.y = rng() * 3;
    g.add(w);
  }
  return g;
}

function roast(rng: Rng, kind: string): THREE.Group {
  const g = new THREE.Group();
  const p = plate(0.17, 0xe8e0d0);
  p.scale.set(1.3, 1, 0.9);
  g.add(p);
  if (kind === "Chicken") {
    const body = lump(rng, 0.075, 0.05, 0.06, 0xc0782e, { lumpy: 0.12, detail: 1, roughness: 0.4 });
    body.position.y = 0.055;
    g.add(body);
    for (const side of [-1, 1]) {
      const leg = lump(rng, 0.035, 0.022, 0.022, 0xb06a28, { lumpy: 0.1, roughness: 0.4 });
      leg.position.set(0.06, 0.04, side * 0.045);
      leg.rotation.y = side * 0.5;
      const bone = mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.03, 5).rotateZ(Math.PI / 2), mat(0xf1e6cc));
      bone.position.set(0.1, 0.045, side * 0.06);
      const wing = lump(rng, 0.025, 0.012, 0.018, 0xb87030, { detail: 0 });
      wing.position.set(-0.02, 0.06, side * 0.055);
      g.add(leg, bone, wing);
    }
  } else {
    const joint = mesh(jitter(new THREE.CylinderGeometry(0.05, 0.055, 0.12, 10).rotateZ(Math.PI / 2), rng, 0.008), mat(0x7a3e22, { roughness: 0.5 }));
    joint.position.y = 0.06;
    g.add(joint);
    // The cut end shows pink inside.
    const end = mesh(new THREE.CircleGeometry(0.047, 10).rotateY(Math.PI / 2), mat(0xc4606a, { roughness: 0.6 }));
    end.position.set(0.062, 0.06, 0);
    g.add(end);
    for (let i = 0; i < 3; i++) {
      const tie = mesh(new THREE.TorusGeometry(0.054, 0.0025, 4, 14).rotateY(Math.PI / 2), mat(0xf0e6cc));
      tie.position.set(-0.035 + i * 0.035, 0.06, 0);
      g.add(tie);
    }
  }
  // Roast potatoes and a herb sprig.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rng() * 0.3;
    const pt = lump(rng, 0.02, 0.016, 0.018, i % 3 ? 0xd9a04a : 0xc48a3a, { lumpy: 0.2, roughness: 0.5 });
    pt.position.set(Math.cos(a) * 0.15, 0.024, Math.sin(a) * 0.1);
    g.add(pt);
  }
  for (let i = 0; i < 5; i++) {
    const l = mesh(leafGeo(0.025, 0.006), mat(HERB, { double: true }), false);
    l.position.set(-0.02 + i * 0.008, 0.11, 0.005);
    l.rotation.set(0, i * 1.2, 0.3);
    g.add(l);
  }
  return g;
}

/** Make a dish. `variant` picks the main ingredient from DISH_VARIANTS. */
export function createDish(dish: DishId, rng: Rng, variant: number): Showpiece {
  const kind = DISH_VARIANTS[dish][variant] ?? DISH_VARIANTS[dish][0];
  const bobs: { o: THREE.Object3D; y: number; p: number }[] = [];
  const g = new THREE.Group();
  let top = 0.07;
  if (dish === "stew") g.add(stew(rng, kind, bobs));
  else if (dish === "stirfry") g.add(stirfry(rng, kind));
  else if (dish === "curry") g.add(curry(rng, kind, bobs));
  else if (dish === "steak") (g.add(steak(rng, kind)), (top = 0.04));
  else (g.add(roast(rng, kind)), (top = 0.1));
  const st = steam(rng, 0.05, top, 7, 0.2);
  g.add(st.object);
  return still(g, "table", (_dt, time) => {
    st.update(time);
    // Soup bubbles gently.
    for (const b of bobs) b.o.position.y = b.y + Math.sin(time * 2.2 + b.p) * 0.0025;
  });
}
