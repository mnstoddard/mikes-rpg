// Weapons: the game's nine weapon types plus arrows. Each is built in iron
// and oak; Godot swaps the "metal" and "wood" materials for the other kinds.
import * as THREE from "three";
import {
  ItemDef, Metal, Wood, at, group, metalMat, woodMat, leatherMat, slab, slabShape, rod, sphere, lathe, tube, torus, gemMat, GEMS,
  rbox, cone, plain, clothMat, cyl, mat,
} from "./kit";

const M: Metal = "iron";
const W: Wood = "oak";

/** A leather-wrapped grip from y0 to y1, with raised wrap ridges. */
export function grip(y0: number, y1: number, r: number, wraps = 6, color = 0x6a4428) {
  const lm = leatherMat(color, "grip");
  const g = group("grip", rod(r, r, y1 - y0, lm, 12, y0));
  for (let i = 0; i < wraps; i++) {
    const y = y0 + ((i + 0.5) / wraps) * (y1 - y0);
    g.add(at(torus(r * 1.02, r * 0.22, lm, 6, 14), [0, y, 0], [90, 0, (i % 2 ? 1 : -1) * 12]));
  }
  return g;
}

/** A pommel: a soft ball with a small cap. */
const pommel = (y: number, r: number) => group("pommel", at(sphere(r, metalMat(M)), [0, y, 0], [0, 0, 0], [1, 0.85, 1]), at(sphere(r * 0.45, metalMat(M, true)), [0, y - r * 0.8, 0]));

/** A blade outline: half-width w at the base, straight sides, tapering to a point. */
function blade(len: number, w: number, tip = 0.22, base = 0.02) {
  const pts: [number, number][] = [
    [-w, 0], [w, 0], [w * 1.02, len * (1 - tip) * 0.5], [w * 0.95, len * (1 - tip)], [0, len], [-w * 0.95, len * (1 - tip)], [-w * 1.02, len * (1 - tip) * 0.5],
  ];
  void base;
  return pts;
}

/** A blade with a raised spine (a thinner ridge down the middle, so it catches light like a real blade). */
function bladeMesh(len: number, w: number, thick: number, y0: number) {
  const g = group("blade",
    at(slab(blade(len, w), thick, metalMat(M), thick * 0.48), [0, y0, 0]),
    at(slab(blade(len * 0.86, w * 0.28, 0.3), thick * 1.25, metalMat(M, true), thick * 0.5), [0, y0 + len * 0.04, 0]),
  );
  return g;
}

/** A crossguard: a curved bar with rounded ends and a small gem socket. */
function guard(w: number, y: number, thick = 0.03, curve = 0.025) {
  const s = new THREE.Shape();
  s.moveTo(-w, curve); s.quadraticCurveTo(0, -curve * 0.6, w, curve);
  s.lineTo(w, curve + thick); s.quadraticCurveTo(0, thick - curve * 0.6, -w, curve + thick); s.closePath();
  return group("guard",
    at(slabShape(s, 0.035, metalMat(M), 0.012, 12), [0, y - thick * 0.6, 0]),
    at(sphere(0.016, metalMat(M)), [-w, y + curve + thick * 0.0, 0]),
    at(sphere(0.016, metalMat(M)), [w, y + curve + thick * 0.0, 0]),
    at(sphere(0.012, gemMat(GEMS.ruby.color, 0.3), 10, 8), [0, y, 0.016], [0, 0, 0], [1, 1, 0.6]),
    at(sphere(0.012, gemMat(GEMS.ruby.color, 0.3), 10, 8), [0, y, -0.016], [0, 0, 0], [1, 1, 0.6]),
  );
}

export function sword() {
  return group("sword",
    grip(-0.085, 0.085, 0.017),
    pommel(-0.11, 0.026),
    guard(0.11, 0.1),
    bladeMesh(0.72, 0.034, 0.016, 0.115),
  );
}

export function dagger() {
  return group("dagger",
    grip(-0.06, 0.06, 0.015, 4),
    pommel(-0.08, 0.02),
    guard(0.065, 0.075, 0.022, 0.012),
    bladeMesh(0.3, 0.028, 0.014, 0.085),
  );
}

export function greatsword() {
  return group("greatsword",
    grip(-0.17, 0.17, 0.02, 10),
    pommel(-0.2, 0.032),
    guard(0.17, 0.19, 0.038, 0.03),
    bladeMesh(1.15, 0.05, 0.02, 0.21),
  );
}

export function mace() {
  const head = group("head", at(sphere(0.075, metalMat(M), 16, 12), [0, 0.5, 0]));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    // soft rounded flanges round the head
    const f = slab([[0, -0.07], [0.05, -0.04], [0.06, 0.03], [0, 0.08]], 0.026, metalMat(M, true), 0.011);
    head.add(at(f, [Math.cos(a) * 0.055, 0.5, Math.sin(a) * 0.055], [0, (-a * 180) / Math.PI, 0]));
  }
  head.add(at(cone(0.03, 0.06, metalMat(M), 10), [0, 0.6, 0]));
  return group("mace",
    grip(-0.09, 0.09, 0.018),
    pommel(-0.115, 0.024),
    at(rod(0.019, 0.022, 0.34, woodMat(W), 10), [0, 0.09, 0]),
    at(torus(0.024, 0.008, metalMat(M, true), 6, 14), [0, 0.1, 0], [90, 0, 0]),
    at(torus(0.026, 0.008, metalMat(M, true), 6, 14), [0, 0.42, 0], [90, 0, 0]),
    head,
  );
}

export function spear() {
  const head = slab([[-0.045, 0], [0.045, 0], [0.05, 0.06], [0, 0.26], [-0.05, 0.06]], 0.02, metalMat(M), 0.009);
  return group("spear",
    at(rod(0.019, 0.017, 1.95, woodMat(W), 10), [0, -0.75, 0]),
    grip(-0.12, 0.12, 0.021, 7),
    at(lathe([[0.019, 0], [0.024, 0.02], [0.02, 0.07], [0.012, 0.09]], metalMat(M, true), 10), [0, 1.18, 0]),
    at(head, [0, 1.26, 0]),
    at(cone(0.022, 0.04, metalMat(M, true), 8), [0, -0.77, 0], [180, 0, 0]),
    // a small cloth tassel under the head
    at(tube([[0.02, 1.2, 0], [0.05, 1.13, 0.01], [0.055, 1.05, 0.02]], 0.008, clothMat(0xb4473c), 10, 6), [0, 0, 0]),
  );
}

export function bow() {
  // The bow stands upright, string toward -X, belly toward +X (it points the arrow to +X... held in the left hand).
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12 * 2 - 1; // -1..1
    const y = t * 0.7;
    const x = 0.16 * (1 - t * t) - 0.04 * Math.pow(Math.abs(t), 6) * 3; // recurve tips
    pts.push([x, y, 0]);
  }
  const limbs = group("limbs");
  // thicker in the middle: three overlapping tubes
  limbs.add(tube(pts, 0.013, woodMat(W), 40, 8));
  limbs.add(tube(pts.slice(3, 10), 0.018, woodMat(W), 20, 8));
  const tipTop = pts[12], tipBot = pts[0];
  const body = group("bowbody",
    limbs,
    at(group("gripwrap", grip(-0.07, 0.07, 0.021, 5)), [0.16, 0, 0]),
    at(sphere(0.016, metalMat(M), 10, 8), tipTop, [0, 0, 0], [1, 1.4, 1]),
    at(sphere(0.016, metalMat(M), 10, 8), tipBot, [0, 0, 0], [1, 1.4, 1]),
    tube([tipTop, [tipTop[0], 0, 0], tipBot], 0.0025, plain("string", 0xeee6d2, 0.8), 2, 4),
    // arrow rest
    at(rbox(0.03, 0.02, 0.03, 0.008, metalMat(M, true)), [0.175, 0.075, 0]),
  );
  return group("bow", at(body, [-0.16, 0, 0]));
}

export function arrow(m: Metal = M) {
  const shaft = rod(0.006, 0.006, 0.75, woodMat("birch"), 8, -0.1);
  const head = slab([[-0.016, 0], [0.016, 0], [0, 0.06]], 0.006, metalMat(m), 0.0025);
  const fl = clothMat(0xd8483c, "fletch");
  const g = group("arrow", shaft, at(head, [0, 0.645, 0]));
  for (let i = 0; i < 3; i++) {
    const f = slab([[0, 0], [0.022, 0.015], [0.022, 0.1], [0, 0.11]], 0.0025, fl, 0.001);
    g.add(at(f, [0, -0.085, 0], [0, i * 120, 0]));
  }
  g.add(at(cyl(0.007, 0.007, 0.012, plain("nock", 0x3a2e28, 0.6), 8), [0, -0.1, 0]));
  return g;
}

export function arrows() {
  // A bundle of 5 arrows in a little cloth tie (the stack you get when you craft).
  const g = group("arrows");
  const off: [number, number][] = [[0, 0], [0.016, 0.006], [-0.016, 0.004], [0.006, -0.015], [-0.008, 0.016]];
  off.forEach(([x, z], i) => g.add(at(arrow(), [x, 0.1 + i * 0.01, z], [x * 120, 0, -z * 120])));
  g.add(at(torus(0.03, 0.007, leatherMat(0x6a4428, "tie"), 6, 16), [0, 0.15, 0], [90, 0, 0]));
  return g;
}

export function staff(gemColor = GEMS.amethyst.color) {
  const wm = woodMat(W);
  const g = group("staff", at(rod(0.022, 0.019, 1.7, wm, 10), [0, -0.6, 0]), grip(-0.1, 0.1, 0.024, 6, 0x4a5aa0));
  // A curled top of three branches holding a glowing gem.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    g.add(tube([[c * 0.012, 1.05, s * 0.012], [c * 0.06, 1.14, s * 0.06], [c * 0.055, 1.24, s * 0.055], [c * 0.018, 1.3, s * 0.018]], 0.011, wm, 16, 6));
  }
  g.add(at(torus(0.025, 0.009, metalMat(M), 6, 14), [0, 1.08, 0], [90, 0, 0]));
  g.add(at(torus(0.022, 0.008, metalMat(M), 6, 14), [0, 0.95, 0], [90, 0, 0]));
  g.add(at(lathe([[0, -0.07], [0.045, -0.01], [0.045, 0.01], [0, 0.07]], gemMat(gemColor, 0.9), 8), [0, 1.18, 0]));
  g.add(at(cone(0.024, 0.05, metalMat(M, true), 8), [0, -0.62, 0], [180, 0, 0]));
  return g;
}

export function sling() {
  const cord = plain("cord", 0xc9a574, 0.85);
  const pouch = lathe([[0, -0.03], [0.03, -0.022], [0.042, 0], [0.036, 0.012]], leatherMat(), 12);
  const g = group("sling",
    at(pouch, [0, -0.42, 0], [0, 0, 0], [1.2, 0.8, 0.9]),
    tube([[-0.04, -0.41, 0], [-0.03, -0.2, 0.01], [-0.006, 0, 0]], 0.004, cord, 20, 5),
    tube([[0.04, -0.41, 0], [0.03, -0.2, -0.01], [0.006, 0, 0]], 0.004, cord, 20, 5),
    at(torus(0.022, 0.006, leatherMat(0x6a4428, "grip"), 6, 14), [0, 0.015, 0], [0, 0, 0]),
    at(sphere(0.025, metalMat(M), 12, 10), [0, -0.41, 0.01]),
  );
  return g;
}

export function darts() {
  const one = () => group("dart",
    at(rod(0.005, 0.009, 0.09, woodMat(W), 8), [0, -0.05, 0]),
    at(lathe([[0.009, 0], [0.012, 0.012], [0, 0.09]], metalMat(M), 10), [0, 0.04, 0]),
    ...[0, 1, 2].map((i) => at(slab([[0, 0], [0.018, 0.01], [0.018, 0.04], [0, 0.05]], 0.0025, clothMat(0x3f64a8, "fletch"), 0.001), [0, -0.075, 0], [0, i * 120, 0])),
  );
  return group("darts", at(one(), [-0.03, 0, 0], [0, 0, 8]), at(one(), [0, 0.02, 0.01]), at(one(), [0.03, 0, 0], [0, 0, -8]));
}

void mat;

export const WEAPON_DEFS: ItemDef[] = [
  { id: "sword", name: "Sword", cat: "Weapons", held: true, swaps: ["metal", "wood"], game: ["sword_*"], about: "A one-handed sword with a raised spine, a curved crossguard with a little ruby, and a leather-wrapped grip.", build: sword },
  { id: "dagger", name: "Dagger", cat: "Weapons", held: true, swaps: ["metal", "wood"], game: ["dagger_*"], about: "Short and quick, the same family look as the sword.", build: dagger },
  { id: "greatsword", name: "Two-handed sword", cat: "Weapons", held: true, swaps: ["metal", "wood"], game: ["greatsword_*"], about: "A long two-handed blade with a wide guard and a long grip.", build: greatsword },
  { id: "mace", name: "Mace", cat: "Weapons", held: true, swaps: ["metal", "wood"], game: ["mace_*"], about: "A round head with six soft flanges on a banded wooden haft.", build: mace },
  { id: "spear", name: "Spear", cat: "Weapons", held: true, swaps: ["metal", "wood"], game: ["spear_*"], about: "A leaf-shaped head on a long shaft, with a red tassel.", build: spear },
  { id: "bow", name: "Bow", cat: "Weapons", held: true, swaps: ["metal", "wood"], game: ["bow_*"], about: "A recurve bow with a wrapped grip, metal tip caps and an arrow rest.", build: bow },
  { id: "arrows", name: "Arrows", cat: "Weapons", swaps: ["metal"], game: ["arrows_*"], about: "A tied bundle of birch arrows with red fletching. The head is the metal.", build: arrows },
  { id: "staff", name: "Staff", cat: "Weapons", held: true, swaps: ["metal", "wood", "gem"], game: ["staff_*"], about: "Three curling branches hold a glowing gem. The gem colour shows its enchantment.", build: () => staff() },
  { id: "sling", name: "Sling", cat: "Weapons", held: true, swaps: ["metal"], game: ["sling_*"], about: "A leather pouch on two cords, loaded with a metal shot.", build: sling },
  { id: "darts", name: "Darts", cat: "Weapons", held: true, swaps: ["metal", "wood"], game: ["darts_*"], about: "Three throwing darts with blue fletching.", build: darts },
];
