// Raw ingredients and farm crops: meat from monsters, vegetables from the shop
// and the farm, and things dug up with Foraging. Sizes are real, in metres.
//
// Crops also have a "Growing" look: the plant in the ground, swaying a little,
// for the farm plots in the 3D world.
import * as THREE from "three";
import { Rng, Showpiece, still, mat, mesh, lump, jitter, lathe, leafGeo, between, shade } from "./common";

export type IngredientKind =
  | "raw_chicken" | "raw_beef" | "raw_boar" | "potato" | "carrot" | "onion" | "wheat"
  | "ginseng" | "blue_lotus" | "mushroom" | "wild_root" | "truffle";

const LEAF = 0x5f9a3a;
const DARK_LEAF = 0x467a2c;

/** Things that sway: each gets a gentle wobble in update(). */
type Swayers = { o: THREE.Object3D; p: number; amt: number }[];
function swayUpdate(sw: Swayers) {
  return (_dt: number, time: number) => {
    for (const s of sw) {
      s.o.rotation.z = Math.sin(time * 1.4 + s.p) * s.amt;
      s.o.rotation.x = Math.cos(time * 1.1 + s.p) * s.amt * 0.6;
    }
  };
}

/** A flat blob outline, extruded `depth` thick and lying flat (steaks, breasts, lily pads). */
export function slab(rng: Rng, rx: number, rz: number, depth: number, color: number, wobble = 0.18, n = 11): THREE.Mesh {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + (rng() - 0.5) * wobble * 2;
    pts.push(new THREE.Vector2(Math.cos(a) * rx * r, Math.sin(a) * rz * r));
  }
  const bevel = Math.min(depth * 0.35, rx * 0.15);
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: depth - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 2 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  return mesh(geo, mat(color, { roughness: 0.6 }));
}

/** A tapering tube along a wiggly path (roots, stalks). */
function tube(rng: Rng, from: THREE.Vector3, dir: THREE.Vector3, len: number, r0: number, r1: number, color: number, wiggle = 0.3, segs = 5): THREE.Mesh {
  const pts: THREE.Vector3[] = [];
  const p = from.clone();
  const d = dir.clone().normalize();
  for (let i = 0; i <= segs; i++) {
    pts.push(p.clone());
    d.add(new THREE.Vector3((rng() - 0.5) * wiggle, (rng() - 0.5) * wiggle * 0.5, (rng() - 0.5) * wiggle)).normalize();
    p.addScaledVector(d, len / segs);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, segs * 2, 1, 5, false);
  // Taper from r0 to r1.
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const frames = curve.computeFrenetFrames(segs * 2, false);
  for (let i = 0; i <= segs * 2; i++) {
    const c = curve.getPointAt(i / (segs * 2));
    const r = r0 + (r1 - r0) * (i / (segs * 2));
    for (let j = 0; j <= 5; j++) {
      const k = i * 6 + j;
      const v = new THREE.Vector3(pos.getX(k), pos.getY(k), pos.getZ(k)).sub(c).multiplyScalar(r);
      pos.setXYZ(k, c.x + v.x, c.y + v.y, c.z + v.z);
    }
  }
  void frames;
  geo.computeVertexNormals();
  return mesh(geo, mat(color, { roughness: 0.8 }));
}

/** A green leaf on a stem, pointing out at `angle` around and `tilt` up. */
function leaf(len: number, wide: number, color: number, angle: number, tilt: number, y = 0): THREE.Mesh {
  const m = mesh(leafGeo(len, wide), mat(color, { double: true, roughness: 0.7 }));
  m.rotation.set(0, -angle, tilt);
  m.position.y = y;
  return m;
}

// ---------- Meat ----------

function chicken(rng: Rng, v: number): THREE.Group {
  const g = new THREE.Group();
  if (v === 0) {
    // Drumstick: a fat end of pale meat and a bone sticking out.
    const meat = lump(rng, 0.055, 0.032, 0.036, 0xf0c6b2, { lumpy: 0.18 });
    meat.position.set(-0.02, 0.032, 0);
    const bone = mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.06, 6).rotateZ(Math.PI / 2), mat(0xf3ead8));
    bone.position.set(0.055, 0.03, 0);
    const knob = lump(rng, 0.014, 0.012, 0.016, 0xf6eee0, { detail: 0, lumpy: 0.15 });
    knob.position.set(0.088, 0.03, 0);
    g.add(meat, bone, knob);
  } else {
    // Breast: a pale teardrop fillet.
    const b = slab(rng, 0.075, 0.045, 0.028, 0xf2b9aa, 0.1, 9);
    b.scale.x = 1;
    g.add(b);
    const skin = slab(rng, 0.06, 0.03, 0.006, 0xf6ddcc, 0.15, 8);
    skin.position.set(-0.01, 0.026, 0.005);
    g.add(skin);
  }
  return g;
}

/** A steak: fat round the edge, red meat with white marbling on top. */
function steakSlab(rng: Rng, meat: number, fat: number, size: number, skin?: number): THREE.Group {
  const g = new THREE.Group();
  const f = slab(rng, 0.1 * size, 0.07 * size, 0.024 * size, fat, 0.12);
  g.add(f);
  const m = slab(rng, 0.088 * size, 0.058 * size, 0.027 * size, meat, 0.12);
  m.position.set(0.006 * size, 0, 0);
  g.add(m);
  for (let i = 0; i < 6; i++) {
    const s = slab(rng, between(rng, 0.006, 0.014) * size, 0.003 * size, 0.001, shade(fat, 1.05), 0.3, 5);
    s.position.set(between(rng, -0.05, 0.06) * size, 0.027 * size, between(rng, -0.035, 0.035) * size);
    s.rotation.y = rng() * Math.PI;
    s.castShadow = false;
    g.add(s);
  }
  if (skin) {
    const sk = mesh(new THREE.BoxGeometry(0.15 * size, 0.022 * size, 0.012 * size), mat(skin, { roughness: 1 }));
    sk.position.set(0, 0.012 * size, -0.074 * size);
    g.add(sk);
  }
  return g;
}

function beef(rng: Rng, v: number): THREE.Group {
  if (v === 0) return steakSlab(rng, 0xb3303a, 0xf2e2c8, 1);
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const c = mesh(jitter(new THREE.BoxGeometry(0.03, 0.026, 0.03, 1, 1, 1), rng, 0.008), mat(rng() < 0.3 ? 0xc84650 : 0xa82a34, { roughness: 0.6 }));
    c.position.set(between(rng, -0.04, 0.04), 0.013 + (i > 3 ? 0.022 : 0), between(rng, -0.035, 0.035));
    c.rotation.y = rng() * 3;
    g.add(c);
  }
  return g;
}

function boar(rng: Rng, v: number): THREE.Group {
  if (v === 0) return steakSlab(rng, 0x86222c, 0xeedcbc, 1.15, 0x4a3226);
  // Haunch: a big leg joint with dark skin and the bone showing.
  const g = new THREE.Group();
  const leg = lump(rng, 0.11, 0.06, 0.065, 0x5c3e30, { lumpy: 0.15 });
  leg.position.set(-0.02, 0.06, 0);
  const cut = slab(rng, 0.055, 0.05, 0.01, 0x9a2a34, 0.1, 8);
  cut.rotation.z = Math.PI / 2;
  cut.position.set(0.085, 0.06, 0);
  const bone = mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.06, 6).rotateZ(Math.PI / 2), mat(0xf0e6d0));
  bone.position.set(0.11, 0.06, 0);
  const knob = lump(rng, 0.02, 0.018, 0.022, 0xf4ecdc, { detail: 0, lumpy: 0.1 });
  knob.position.set(0.14, 0.06, 0);
  g.add(leg, cut, bone, knob);
  return g;
}

// ---------- Vegetables ----------

function onePotato(rng: Rng, s = 1): THREE.Group {
  const g = new THREE.Group();
  const p = lump(rng, 0.048 * s, 0.032 * s, 0.038 * s, 0xb58a52, { lumpy: 0.22 });
  p.position.y = 0.03 * s;
  g.add(p);
  for (let i = 0; i < 4; i++) {
    const a = rng() * Math.PI * 2;
    const e = lump(rng, 0.005 * s, 0.003 * s, 0.005 * s, 0x6e4e2a, { detail: 0 });
    e.position.set(Math.cos(a) * 0.04 * s, 0.03 * s + (rng() - 0.3) * 0.02 * s, Math.sin(a) * 0.031 * s);
    g.add(e);
  }
  return g;
}

function oneCarrot(rng: Rng, s = 1): THREE.Group {
  const g = new THREE.Group();
  const geo = jitter(new THREE.ConeGeometry(0.016 * s, 0.15 * s, 7, 3), rng, 0.003 * s);
  geo.rotateZ(Math.PI / 2); // tip points -X
  const c = mesh(geo, mat(0xe8741e, { roughness: 0.6 }));
  c.position.y = 0.016 * s;
  g.add(c);
  for (let i = 0; i < 4; i++) {
    const l = leaf(0.09 * s, 0.012 * s, i % 2 ? LEAF : DARK_LEAF, (i - 1.5) * 0.35, 0.2 + rng() * 0.2, 0.018 * s);
    l.position.x = 0.075 * s;
    g.add(l);
  }
  return g;
}

function oneOnion(rng: Rng, red: boolean): THREE.Group {
  const g = new THREE.Group();
  const b = lathe([[0, 0], [0.012, 0.002], [0.032, 0.018], [0.04, 0.04], [0.033, 0.062], [0.014, 0.078], [0.004, 0.096], [0, 0.1]], red ? 0x7c2a4c : 0xc98a3a, { sides: 9, roughness: 0.45 });
  b.geometry = jitter(b.geometry, rng, 0.002);
  g.add(b);
  for (let i = 0; i < 6; i++) {
    const r = mesh(new THREE.ConeGeometry(0.0015, 0.018, 3), mat(0xe8dcc0));
    r.position.set((rng() - 0.5) * 0.01, -0.006, (rng() - 0.5) * 0.01);
    r.rotation.set((rng() - 0.5) * 1.2, 0, (rng() - 0.5) * 1.2 + Math.PI);
    g.add(r);
  }
  return g;
}

function mushroomOne(rng: Rng, s: number, cap = 0xa8754a): THREE.Group {
  const g = new THREE.Group();
  const stem = mesh(jitter(new THREE.CylinderGeometry(0.008 * s, 0.011 * s, 0.045 * s, 6), rng, 0.002 * s), mat(0xeee2cc));
  stem.position.y = 0.0225 * s;
  const c = lathe([[0, 0.04], [0.03, 0.04], [0.034, 0.046], [0.03, 0.058], [0.018, 0.068], [0, 0.071]].map(([x, y]) => [x * s, y * s] as [number, number]), cap, { sides: 9, roughness: 0.6 });
  const gills = mesh(new THREE.CircleGeometry(0.03 * s, 9).rotateX(Math.PI / 2), mat(0xd8c4a0, { double: true }));
  gills.position.y = 0.0405 * s;
  g.add(stem, c, gills);
  g.rotation.z = (rng() - 0.5) * 0.3;
  return g;
}

function wildRoot(rng: Rng): THREE.Group {
  const g = new THREE.Group();
  g.add(tube(rng, new THREE.Vector3(-0.07, 0.012, 0), new THREE.Vector3(1, 0, 0), 0.15, 0.012, 0.003, 0x9a7348, 0.6));
  for (let i = 0; i < 4; i++) {
    const at = new THREE.Vector3(between(rng, -0.05, 0.04), 0.01, between(rng, -0.006, 0.006));
    g.add(tube(rng, at, new THREE.Vector3(rng() - 0.3, -0.05, rng() - 0.5), 0.04, 0.003, 0.001, 0x8a6440, 0.8, 3));
  }
  for (let i = 0; i < 3; i++) {
    const k = lump(rng, 0.012, 0.01, 0.011, 0x8e6a42, { detail: 0 });
    k.position.set(between(rng, -0.05, 0.03), 0.012, 0);
    g.add(k);
  }
  return g;
}

function ginsengRoot(rng: Rng): THREE.Group {
  // A pale forked root, a bit like a little person.
  const g = new THREE.Group();
  const body = lump(rng, 0.016, 0.045, 0.016, 0xe2c99a, { lumpy: 0.15 });
  body.position.y = 0.06;
  g.add(body);
  for (const side of [-1, 1]) g.add(tube(rng, new THREE.Vector3(side * 0.006, 0.025, 0), new THREE.Vector3(side * 0.4, -1, 0), 0.05, 0.008, 0.002, 0xd8bd8c, 0.4, 3));
  for (const side of [-1, 1]) g.add(tube(rng, new THREE.Vector3(side * 0.01, 0.07, 0), new THREE.Vector3(side, -0.4, 0.2), 0.035, 0.004, 0.001, 0xd8bd8c, 0.5, 3));
  const neck = mesh(new THREE.CylinderGeometry(0.004, 0.007, 0.03, 5), mat(0xb89a6a));
  neck.position.y = 0.115;
  g.add(neck);
  return g;
}

function truffleOne(rng: Rng, s = 1): THREE.Mesh {
  const t = lump(rng, 0.03 * s, 0.026 * s, 0.028 * s, 0x3b2b22, { detail: 2, lumpy: 0.12, roughness: 1 });
  t.position.y = 0.025 * s;
  return t;
}

function lotusFlower(rng: Rng): THREE.Group {
  const g = new THREE.Group();
  const rings: [number, number, number, number, number][] = [
    // count, length, width, tilt, colour
    [8, 0.07, 0.022, 0.35, 0x4f74d8],
    [8, 0.06, 0.02, 0.75, 0x6f93ee],
    [6, 0.045, 0.016, 1.1, 0x9bb6ff],
  ];
  rings.forEach(([n, len, w, tilt, c], ri) => {
    for (let i = 0; i < n; i++) {
      const p = leaf(len, w, c, (i / n) * Math.PI * 2 + ri * 0.4 + rng() * 0.1, tilt, 0.01 + ri * 0.006);
      g.add(p);
    }
  });
  const heart = mesh(new THREE.CylinderGeometry(0.012, 0.009, 0.016, 8), mat(0xf2c84a, { roughness: 0.5, emissive: 0x6a4a00, emissiveIntensity: 0.2 }));
  heart.position.y = 0.022;
  g.add(heart);
  return g;
}

/** A crop growing in the soil. */
function growing(rng: Rng, kind: IngredientKind, sw: Swayers): THREE.Group {
  const g = new THREE.Group();
  const plant = (o: THREE.Object3D, amt = 0.06) => {
    sw.push({ o, p: rng() * 6, amt });
    g.add(o);
  };
  if (kind === "potato") {
    // A bushy plant with a couple of potatoes peeking out.
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Group();
      s.position.set(between(rng, -0.08, 0.08), 0, between(rng, -0.08, 0.08));
      for (let j = 0; j < 7; j++) s.add(leaf(0.09, 0.035, j % 2 ? LEAF : DARK_LEAF, rng() * 6.3, between(rng, 0.2, 0.9), between(rng, 0.05, 0.22)));
      const stem = mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.22, 5), mat(DARK_LEAF));
      stem.position.y = 0.11;
      s.add(stem);
      plant(s, 0.05);
    }
    for (let i = 0; i < 2; i++) {
      const p = onePotato(rng, 0.9);
      p.position.set(between(rng, -0.12, 0.12), -0.02, between(rng, 0.06, 0.14));
      g.add(p);
    }
  } else if (kind === "carrot") {
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Group();
      s.position.set((i % 2) * 0.1 - 0.05, 0, Math.floor(i / 2) * 0.1 - 0.05);
      const top = mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.02, 7), mat(0xe8741e));
      top.position.y = 0.005;
      s.add(top);
      for (let j = 0; j < 6; j++) s.add(leaf(0.14, 0.016, j % 2 ? LEAF : DARK_LEAF, (j / 6) * Math.PI * 2 + rng(), between(rng, 0.9, 1.3), 0.012));
      plant(s, 0.07);
    }
  } else if (kind === "onion") {
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Group();
      s.position.set((i - 1) * 0.09, 0, (rng() - 0.5) * 0.05);
      const b = oneOnion(rng, false);
      b.position.y = -0.04;
      s.add(b);
      for (let j = 0; j < 4; j++) {
        const t = mesh(new THREE.CylinderGeometry(0.003, 0.005, 0.2, 5), mat(j % 2 ? LEAF : 0x6fae48));
        t.geometry.translate(0, 0.1, 0);
        t.position.y = 0.05;
        t.rotation.set((rng() - 0.5) * 0.5, 0, (rng() - 0.5) * 0.5);
        s.add(t);
      }
      plant(s, 0.05);
    }
  } else if (kind === "wheat") {
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Group();
      s.position.set(between(rng, -0.13, 0.13), 0, between(rng, -0.13, 0.13));
      s.add(wheatStalk(rng, between(rng, 0.42, 0.55)));
      plant(s, 0.09);
    }
  } else if (kind === "ginseng") {
    const s = new THREE.Group();
    const stem = mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.26, 5), mat(0x6a8a3a));
    stem.position.y = 0.13;
    s.add(stem);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      for (let j = 0; j < 5; j++) s.add(leaf(0.12 - Math.abs(j - 2) * 0.02, 0.034, j % 2 ? LEAF : DARK_LEAF, a + (j - 2) * 0.35, 0.25, 0.2));
    }
    for (let i = 0; i < 9; i++) {
      const b = lump(rng, 0.006, 0.006, 0.006, 0xd2232a, { detail: 0, roughness: 0.3 });
      b.position.set((rng() - 0.5) * 0.02, 0.27 + rng() * 0.015, (rng() - 0.5) * 0.02);
      s.add(b);
    }
    plant(s, 0.05);
  } else if (kind === "blue_lotus") {
    const water = mesh(new THREE.CircleGeometry(0.2, 14).rotateX(-Math.PI / 2), mat(0x3f86a0, { roughness: 0.15, metalness: 0.1 }), false);
    water.position.y = 0.004;
    g.add(water);
    for (let i = 0; i < 3; i++) {
      const pad = slab(rng, 0.06, 0.06, 0.004, i ? DARK_LEAF : LEAF, 0.06, 12);
      pad.position.set(between(rng, -0.1, 0.1), 0.006, between(rng, -0.1, 0.1));
      g.add(pad);
    }
    const f = lotusFlower(rng);
    f.position.y = 0.01;
    plant(f, 0.03);
  }
  return g;
}

function wheatStalk(rng: Rng, h: number): THREE.Group {
  const s = new THREE.Group();
  const stalk = mesh(new THREE.CylinderGeometry(0.0022, 0.003, h, 4), mat(0xd6b45c));
  stalk.position.y = h / 2;
  s.add(stalk);
  for (let k = 0; k < 8; k++) {
    const ear = lump(rng, 0.004, 0.009, 0.004, k % 2 ? 0xe0bc5c : 0xc9a24a, { detail: 0, lumpy: 0.1 });
    ear.position.set((k % 2 ? 0.004 : -0.004), h + k * 0.008, 0);
    ear.rotation.z = k % 2 ? -0.3 : 0.3;
    s.add(ear);
  }
  s.rotation.z = (rng() - 0.5) * 0.12;
  return s;
}

function wheatSheaf(rng: Rng): THREE.Group {
  // A bundle of stalks tied in the middle, lying down.
  const g = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const s = wheatStalk(rng, 0.3);
    s.position.set((rng() - 0.5) * 0.03, 0, (rng() - 0.5) * 0.03);
    s.rotation.set((rng() - 0.5) * 0.25, 0, (rng() - 0.5) * 0.25);
    g.add(s);
  }
  const tie = mesh(new THREE.TorusGeometry(0.024, 0.005, 4, 10).rotateX(Math.PI / 2), mat(0x9a6a3a));
  tie.position.y = 0.15;
  g.add(tie);
  g.rotation.z = Math.PI / 2;
  g.position.set(0.17, 0.025, 0);
  const holder = new THREE.Group();
  holder.add(g);
  return holder;
}

// ---------- The list ----------

export const INGREDIENT_VARIANTS: Record<IngredientKind, readonly string[]> = {
  raw_chicken: ["Drumstick", "Breast"],
  raw_beef: ["Steak", "Chunks"],
  raw_boar: ["Cut", "Haunch"],
  potato: ["Harvested", "Growing"],
  carrot: ["Harvested", "Growing"],
  onion: ["Golden", "Red", "Growing"],
  wheat: ["Sheaf", "Growing"],
  ginseng: ["Root", "Growing"],
  blue_lotus: ["Flower", "Growing"],
  mushroom: ["Single", "Cluster"],
  wild_root: ["Root", "Bundle"],
  truffle: ["Truffle", "Pair"],
};

/** Make an ingredient. `variant` picks from INGREDIENT_VARIANTS. */
export function createIngredient(kind: IngredientKind, rng: Rng, variant: number): Showpiece {
  const name = INGREDIENT_VARIANTS[kind][variant] ?? "";
  const sw: Swayers = [];
  if (name === "Growing") return still(growing(rng, kind, sw), kind === "blue_lotus" ? "table" : "soil", swayUpdate(sw));
  const g = new THREE.Group();
  switch (kind) {
    case "raw_chicken": g.add(chicken(rng, variant)); break;
    case "raw_beef": g.add(beef(rng, variant)); break;
    case "raw_boar": g.add(boar(rng, variant)); break;
    case "potato":
      for (let i = 0; i < 3; i++) {
        const p = onePotato(rng, between(rng, 0.85, 1.1));
        p.position.set((i - 1) * 0.085, 0, (i % 2) * 0.05);
        p.rotation.y = rng() * 3;
        g.add(p);
      }
      break;
    case "carrot":
      for (let i = 0; i < 3; i++) {
        const c = oneCarrot(rng, between(rng, 0.9, 1.1));
        c.position.set(0, 0, (i - 1) * 0.035);
        c.rotation.y = (i - 1) * 0.15;
        g.add(c);
      }
      break;
    case "onion": {
      const red = variant === 1;
      for (let i = 0; i < 2; i++) {
        const o = oneOnion(rng, red);
        o.position.set(i * 0.09 - 0.045, 0.006, (i - 0.5) * 0.03);
        g.add(o);
      }
      break;
    }
    case "wheat": g.add(wheatSheaf(rng)); break;
    case "ginseng": {
      const r = ginsengRoot(rng);
      r.rotation.z = Math.PI / 2;
      r.position.set(0.06, 0.016, 0);
      g.add(r);
      break;
    }
    case "blue_lotus": {
      const f = lotusFlower(rng);
      const stem = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 5).rotateZ(Math.PI / 2), mat(0x5a8a3a));
      stem.position.set(0.08, 0.006, 0);
      f.rotation.z = -1.2;
      f.position.set(0, 0.03, 0);
      g.add(f, stem);
      break;
    }
    case "mushroom":
      if (variant === 0) g.add(mushroomOne(rng, 1));
      else
        for (let i = 0; i < 4; i++) {
          const m = mushroomOne(rng, between(rng, 0.6, 1.1));
          m.position.set(between(rng, -0.04, 0.04), 0, between(rng, -0.04, 0.04));
          g.add(m);
        }
      break;
    case "wild_root":
      if (variant === 0) g.add(wildRoot(rng));
      else {
        for (let i = 0; i < 3; i++) {
          const r = wildRoot(rng);
          r.position.set(0, i === 2 ? 0.018 : 0, (i - 1) * 0.02);
          r.rotation.y = (rng() - 0.5) * 0.2;
          g.add(r);
        }
        const tie = mesh(new THREE.TorusGeometry(0.022, 0.003, 4, 10).rotateY(Math.PI / 2), mat(0x7a5a32));
        tie.position.set(0, 0.016, 0);
        g.add(tie);
      }
      break;
    case "truffle":
      g.add(truffleOne(rng));
      if (variant === 1) {
        const t = truffleOne(rng, 0.75);
        t.position.x = 0.055;
        g.add(t);
        const l = leaf(0.08, 0.03, 0x8a6a2a, 2.4, 0.05, 0.002);
        g.add(l);
      }
      break;
  }
  return still(g, "board");
}
