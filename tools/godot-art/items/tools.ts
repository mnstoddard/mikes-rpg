// Gathering and crafting tools. Built in iron and oak; Godot swaps "metal" and "wood".
import * as THREE from "three";
import { ItemDef, Metal, Wood, at, group, metalMat, woodMat, slab, slabShape, rod, sphere, lathe, tube, torus, rbox, cyl, plain, leatherMat } from "./kit";
import { grip } from "./weapons";

const M: Metal = "iron";
const W: Wood = "oak";

/** A wooden haft from y0 up `len`, thicker at the top, with a leather grip round the origin. */
function haft(y0: number, len: number, r = 0.02, gripLen = 0.16) {
  return group("haft", at(rod(r * 0.9, r * 1.08, len, woodMat(W), 10), [0, y0, 0]), grip(-gripLen / 2, gripLen / 2, r * 1.12, 6));
}

export function axe() {
  // The head: a soft, bearded blade sweeping to +X with a curved edge.
  const s = new THREE.Shape();
  s.moveTo(-0.03, -0.035);
  s.lineTo(0.05, -0.03);
  s.quadraticCurveTo(0.09, -0.06, 0.13, -0.1);
  s.quadraticCurveTo(0.175, 0.0, 0.13, 0.095);
  s.quadraticCurveTo(0.09, 0.06, 0.05, 0.04);
  s.lineTo(-0.03, 0.045);
  s.quadraticCurveTo(-0.06, 0.005, -0.03, -0.035);
  const head = group("head",
    slabShape(s, 0.04, metalMat(M), 0.017, 14),
    // a brighter sharpened edge strip
    at(slabShape((() => { const e = new THREE.Shape(); e.moveTo(0.118, -0.085); e.quadraticCurveTo(0.162, 0, 0.118, 0.08); e.quadraticCurveTo(0.17, 0, 0.13, -0.1); e.closePath(); return e; })(), 0.03, metalMat("steel"), 0.012, 12), [0, 0, 0]),
  );
  return group("axe",
    haft(-0.22, 0.72),
    at(head, [0, 0.43, 0]),
    at(torus(0.024, 0.008, metalMat(M, true), 6, 14), [0, 0.37, 0], [90, 0, 0]),
    at(sphere(0.022, woodMat(W), 10, 8), [0, 0.5, 0], [0, 0, 0], [1, 0.6, 1]),
  );
}

export function pickaxe() {
  // A curved head with two tapering picks, thick in the middle.
  const pts = (side: number): THREE.Vector2[] => [];
  void pts;
  const s = new THREE.Shape();
  s.moveTo(-0.24, -0.04);
  s.quadraticCurveTo(-0.12, 0.03, -0.03, 0.03);
  s.lineTo(0.03, 0.03);
  s.quadraticCurveTo(0.12, 0.03, 0.24, -0.04);
  s.quadraticCurveTo(0.12, 0.065, 0.03, 0.075);
  s.lineTo(-0.03, 0.075);
  s.quadraticCurveTo(-0.12, 0.065, -0.24, -0.04);
  const head = group("head",
    at(slabShape(s, 0.036, metalMat(M), 0.014, 14), [0, -0.04, 0]),
    at(rbox(0.07, 0.075, 0.05, 0.016, metalMat(M, true)), [0, 0, 0]),
  );
  return group("pickaxe", haft(-0.24, 0.76), at(head, [0, 0.47, 0]));
}

export function shovel() {
  const s = new THREE.Shape();
  s.moveTo(-0.075, 0.2);
  s.lineTo(0.075, 0.2);
  s.quadraticCurveTo(0.09, 0.05, 0, -0.03);
  s.quadraticCurveTo(-0.09, 0.05, -0.075, 0.2);
  const blade = slabShape(s, 0.014, metalMat(M), 0.006, 12);
  // dish the blade slightly by bending the vertices
  const p = blade.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + p.getX(i) * p.getX(i) * 2.2);
  blade.geometry.computeVertexNormals();
  return group("shovel",
    at(rod(0.018, 0.019, 1.0, woodMat(W), 10), [0, -0.3, 0]),
    grip(-0.08, 0.08, 0.021, 5),
    // T handle
    at(rod(0.017, 0.017, 0.14, woodMat(W), 10), [-0.07, 0.72, 0], [0, 0, -90]),
    at(lathe([[0.02, 0], [0.026, 0.03], [0.024, 0.08]], metalMat(M, true), 10), [0, -0.36, 0]),
    at(blade, [0, -0.33, 0], [180, 0, 0]),
  );
}

export function fishingRod() {
  const wm = woodMat(W);
  const line = plain("line", 0xf2f6f8, 0.4);
  const g = group("fishing_rod",
    at(rod(0.016, 0.005, 1.7, wm, 8), [0, -0.3, 0]),
    grip(-0.12, 0.12, 0.02, 6, 0x5a3a22),
    // reel
    at(cyl(0.035, 0.035, 0.03, metalMat(M), 16), [0.045, 0.16, 0], [0, 0, 90]),
    at(cyl(0.012, 0.012, 0.05, metalMat(M, true), 8), [0.025, 0.16, 0], [0, 0, 90]),
    at(rbox(0.01, 0.04, 0.008, 0.003, metalMat(M, true)), [0.065, 0.14, 0.03]),
    at(sphere(0.008, plain("knob", 0x5a3a22, 0.6), 8, 6), [0.07, 0.12, 0.03]),
  );
  for (const y of [0.45, 0.8, 1.1, 1.32]) g.add(at(torus(0.008, 0.0018, metalMat(M), 4, 10), [0.012, y, 0], [0, 90, 0]));
  // the line runs up the rod and hangs from the tip with a red-white float
  g.add(tube([[0.03, 0.17, 0], [0.012, 0.45, 0], [0.01, 1.1, 0], [0.006, 1.39, 0]], 0.0012, line, 12, 3));
  g.add(tube([[0.006, 1.4, 0], [0.06, 1.2, 0], [0.09, 0.95, 0]], 0.0012, line, 12, 3));
  const bob = group("float", at(sphere(0.018, plain("float_red", 0xe0403a, 0.4), 12, 8), [0, 0.008, 0], [0, 0, 0], [1, 1, 1]), at(sphere(0.018, plain("float_white", 0xf2ece0, 0.4), 12, 8), [0, -0.008, 0]));
  g.add(at(bob, [0.09, 0.93, 0]));
  return g;
}

export function hammer() {
  const head = group("head",
    at(rbox(0.16, 0.065, 0.065, 0.02, metalMat(M)), [0, 0, 0]),
    at(lathe([[0, 0], [0.04, 0], [0.042, 0.012], [0.038, 0.02]], metalMat(M, true), 14), [-0.08, 0, 0], [0, 0, 90]),
    at(lathe([[0, 0], [0.04, 0], [0.042, 0.012], [0.038, 0.02]], metalMat(M, true), 14), [0.08, 0, 0], [0, 0, -90]),
  );
  return group("hammer", haft(-0.12, 0.48, 0.018, 0.14), at(head, [0, 0.35, 0]));
}

export function tongs() {
  const arm = (side: number) => tube([[side * 0.012, -0.15, 0], [side * 0.014, 0.05, 0], [side * 0.03, 0.18, 0], [side * 0.012, 0.3, 0]], 0.008, metalMat(M), 20, 6);
  return group("tongs",
    arm(1), arm(-1),
    at(cyl(0.012, 0.012, 0.03, metalMat(M, true), 10), [0, 0.06, 0], [90, 0, 0]),
    at(rod(0.014, 0.014, 0.12, leatherMat(0x5a3a22, "grip"), 8), [0.013, -0.13, 0]),
    at(rod(0.014, 0.014, 0.12, leatherMat(0x5a3a22, "grip"), 8), [-0.013, -0.13, 0]),
    at(rbox(0.018, 0.04, 0.026, 0.006, metalMat(M, true)), [0.014, 0.31, 0]),
    at(rbox(0.018, 0.04, 0.026, 0.006, metalMat(M, true)), [-0.014, 0.31, 0]),
  );
}

export function cookingPot() {
  const body = lathe([[0, 0], [0.1, 0.002], [0.135, 0.04], [0.145, 0.1], [0.14, 0.16], [0.15, 0.175], [0.155, 0.18], [0.14, 0.18], [0.13, 0.165], [0.13, 0.12], [0.12, 0.04], [0, 0.02]], metalMat(M), 22);
  const handle = tube([[-0.15, 0.15, 0], [-0.1, 0.3, 0], [0, 0.34, 0], [0.1, 0.3, 0], [0.15, 0.15, 0]], 0.006, metalMat(M, true), 24, 6);
  return group("cooking_pot",
    body, handle,
    at(sphere(0.016, metalMat(M, true), 8, 6), [-0.148, 0.15, 0]),
    at(sphere(0.016, metalMat(M, true), 8, 6), [0.148, 0.15, 0]),
    at(cyl(0.128, 0.128, 0.01, plain("stew", 0xb9733a, 0.3), 22), [0, 0.13, 0]),
  );
}

export const TOOL_DEFS: ItemDef[] = [
  { id: "axe", name: "Axe", cat: "Tools", held: true, swaps: ["metal", "wood"], game: ["axe_*"], about: "A bearded axe head with a brighter sharpened edge, on a wooden haft with a leather grip.", build: axe },
  { id: "pickaxe", name: "Pickaxe", cat: "Tools", held: true, swaps: ["metal", "wood"], game: ["pickaxe_*"], about: "A curved two-point head, thick in the middle, on a wooden haft.", build: pickaxe },
  { id: "shovel", name: "Shovel", cat: "Tools", held: true, swaps: ["metal", "wood"], game: ["shovel_*"], about: "A dished spade with a T-handle, for Foraging (digging up roots, herbs and treasures).", build: shovel },
  { id: "fishing_rod", name: "Fishing rod", cat: "Tools", held: true, swaps: ["wood"], game: ["rod_*"], about: "A tapering rod with line guides, a little reel and a red-and-white float.", build: fishingRod },
  { id: "hammer", name: "Smithing hammer", cat: "Tools", held: true, swaps: ["metal", "wood"], game: ["hammer_*"], about: "A two-faced hammer for the anvil.", build: hammer },
  { id: "tongs", name: "Tongs", cat: "Tools", held: true, swaps: ["metal"], game: ["tongs_*"], about: "Smith's tongs with leather-wrapped handles, for holding hot metal.", build: tongs },
  { id: "cooking_pot", name: "Cooking pot", cat: "Tools", swaps: ["metal"], game: ["pot_*"], about: "A round pot with a rolled rim and a wire handle, with some stew inside.", build: cookingPot },
];
