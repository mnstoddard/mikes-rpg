// Armor pieces, shown on their own (sitting on the ground). Plate in iron
// (Godot swaps "metal"), plus leather and cloth versions.
import * as THREE from "three";
import { ItemDef, Metal, at, group, metalMat, leatherMat, clothMat, lathe, sphere, torus, rbox, slab, slabShape, rod, tube, plain, woodMat, cyl } from "./kit";

const M: Metal = "iron";

/** Rivets: small domes on a surface. */
const rivet = (p: [number, number, number], r = 0.008) => at(sphere(r, metalMat(M, true), 8, 6), p, [0, 0, 0], [1, 1, 0.6]);

export function helmetPlate() {
  const shell = lathe([[0.135, 0], [0.138, 0.04], [0.13, 0.12], [0.1, 0.19], [0.05, 0.225], [0, 0.232]], metalMat(M), 24);
  const g = group("helmet",
    shell,
    at(torus(0.137, 0.012, metalMat(M, true), 8, 28), [0, 0.012, 0], [90, 0, 0]),
    // a ridge over the top, front to back
    tube([[0, 0.02, 0.14], [0, 0.13, 0.133], [0, 0.2, 0.1], [0, 0.236, 0.0], [0, 0.2, -0.1], [0, 0.13, -0.133], [0, 0.02, -0.14]], 0.011, metalMat(M, true), 30, 6),
    // nose guard
    at(rbox(0.03, 0.09, 0.016, 0.007, metalMat(M, true)), [0, -0.02, 0.142], [-4, 0, 0]),
    // cheek guards
    at(slab([[0, 0], [0.065, 0], [0.06, -0.08], [0.015, -0.1]], 0.012, metalMat(M), 0.005), [0.095, 0.01, 0.09], [0, 50, 0]),
    at(slab([[0, 0], [-0.065, 0], [-0.06, -0.08], [-0.015, -0.1]], 0.012, metalMat(M), 0.005), [-0.095, 0.01, 0.09], [0, -50, 0]),
  );
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.add(rivet([Math.sin(a) * 0.146, 0.025, Math.cos(a) * 0.146])); }
  return at(group("helmet_plate", g), [0, 0.1, 0]);
}

export function shieldRound() {
  // Wooden planks behind a domed face, a metal rim and boss. It faces +Z; the handle is at the origin, on the back.
  const face = group("face", lathe([[0.305, 0], [0.3, 0.01], [0.24, 0.028], [0.12, 0.045], [0, 0.05]], woodMat("oak"), 32), lathe([[0, -0.005], [0.305, 0]], woodMat("oak"), 32));
  const g = group("shield",
    at(face, [0, 0, 0], [90, 0, 0]),
    at(torus(0.3, 0.016, metalMat(M), 8, 40), [0, 0, 0.004]),
    at(lathe([[0.085, 0], [0.08, 0.025], [0.05, 0.06], [0, 0.07]], metalMat(M), 20), [0, 0, 0.04], [90, 0, 0]),
    // two iron straps across the planks
    ...[-0.13, 0.13].map((y) => at(rbox(0.56, 0.04, 0.012, 0.005, metalMat(M, true)), [0, y, 0.035 - Math.abs(y) * 0.06])),
    // handle on the back
    at(tube([[-0.06, 0, -0.005], [-0.04, 0, -0.05], [0.04, 0, -0.05], [0.06, 0, -0.005]], 0.011, leatherMat(0x6a4428, "grip"), 16, 6), [0, 0, 0]),
  );
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.add(rivet([Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0.022], 0.009)); }
  return g;
}

/** The plank lines on the face are painted on by the planks texture? No: split the face into planks with gaps. */
void slabShape; void rod; void tube; void plain; void cyl; void clothMat;

export const ARMOR_DEFS: ItemDef[] = [
  { id: "helmet_plate", name: "Plate helmet", cat: "Armor", swaps: ["metal"], game: ["helmet_bronze", "helmet_iron", "helmet_steel", "helmet_mithril"], about: "A rounded helm with a raised ridge, nose guard, cheek guards and a ring of rivets.", build: helmetPlate },
  { id: "shield_round", name: "Round shield", cat: "Armor", swaps: ["metal"], game: ["shield_bronze", "shield_iron", "shield_steel", "shield_mithril"], about: "Oak planks behind a domed face, with a metal rim, straps, rivets and a central boss.", build: shieldRound },
];
void THREE;
