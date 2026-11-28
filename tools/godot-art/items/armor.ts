// Armor pieces, shown on their own (sitting on the ground). Plate in iron
// (Godot swaps "metal"), plus leather and cloth versions.
import * as THREE from "three";
import { ItemDef, Metal, at, group, metalMat, leatherMat, clothMat, lathe, sphere, torus, rbox, slab, rod, tube, plain, woodMat, cyl, capsule, cone, mat, V3 } from "./kit";

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

type Kind = "plate" | "leather" | "cloth";
const LEATHER = 0x8a5a34, LEATHER_DARK = 0x5a3a22, ROBE = 0x3f64a8, ROBE_TRIM = 0xf2c14e;
const skin = (k: Kind, dark = false) => k === "plate" ? metalMat(M, dark) : k === "leather" ? leatherMat(dark ? LEATHER_DARK : LEATHER, dark ? "leather_dark" : "leather") : clothMat(dark ? ROBE_TRIM : ROBE, dark ? "cloth_trim" : "cloth");
const stitch = (pts: V3[], r = 0.003) => tube(pts, r, plain("stitch", 0xe9dfc8, 0.8), Math.max(8, pts.length * 6), 4);
const buckle = (p: V3, r: V3 = [0, 0, 0]) => group("buckle", at(torus(0.016, 0.004, metalMat("bronze"), 6, 12), p, r, [1, 0.8, 1]), at(rbox(0.004, 0.026, 0.006, 0.0015, metalMat("bronze")), p, r));

/** The body piece, standing as if on an armor stand: waist at y = 0, chest facing +Z. */
export function torso(k: Kind) {
  const prof: [number, number][] = [[0.0, 0], [0.15, 0], [0.165, 0.08], [0.19, 0.24], [0.19, 0.34], [0.165, 0.42], [0.11, 0.47], [0.07, 0.49], [0.0, 0.49]];
  const body = at(lathe(prof, skin(k), 26), [0, 0, 0], [0, 0, 0], [1, 1, 0.66]);
  const g = group("torso", body, at(torus(0.07, 0.014, skin(k, true), 8, 20), [0, 0.485, 0], [90, 0, 0], [1, 0.66, 1]));
  if (k === "plate") {
    g.add(tube([[0, 0.05, 0.1], [0, 0.2, 0.126], [0, 0.34, 0.126], [0, 0.44, 0.08]], 0.008, metalMat(M, true), 16, 6));
    g.add(at(torus(0.153, 0.016, metalMat(M, true), 8, 28), [0, 0.02, 0], [90, 0, 0], [1, 0.66, 1]));
    for (const s of [1, -1]) {
      // two overlapping shoulder plates
      g.add(at(lathe([[0.1, 0], [0.095, 0.03], [0.06, 0.07], [0, 0.085]], metalMat(M), 18), [s * 0.2, 0.39, 0], [0, 0, -s * 35], [1, 1, 0.9]));
      g.add(at(lathe([[0.085, 0], [0.08, 0.025], [0.05, 0.06], [0, 0.07]], metalMat(M, true), 18), [s * 0.24, 0.33, 0], [0, 0, -s * 50], [1, 1, 0.9]));
      g.add(at(sphere(0.008, metalMat("bronze"), 8, 6), [s * 0.235, 0.455, 0]));
    }
  } else if (k === "leather") {
    g.add(at(torus(0.152, 0.018, leatherMat(LEATHER_DARK, "leather_dark"), 8, 28), [0, 0.03, 0], [90, 0, 0], [1, 0.66, 1]));
    g.add(buckle([0, 0.03, 0.1]));
    // a strap across the chest and stitched seams
    g.add(tube([[-0.16, 0.38, 0.06], [-0.05, 0.26, 0.128], [0.08, 0.14, 0.13], [0.16, 0.06, 0.08]], 0.012, leatherMat(LEATHER_DARK, "leather_dark"), 20, 6));
    g.add(stitch([[0.0, 0.06, 0.1], [0.0, 0.2, 0.127], [0.0, 0.33, 0.127], [0.0, 0.44, 0.075]]));
    for (const s of [1, -1]) {
      g.add(at(lathe([[0.085, 0], [0.08, 0.02], [0.05, 0.05], [0, 0.06]], leatherMat(LEATHER_DARK, "leather_dark"), 16), [s * 0.2, 0.39, 0], [0, 0, -s * 40], [1, 1, 0.9]));
    }
  } else {
    // robe top: a V collar in the trim colour, a sash, and wide sleeves
    g.add(tube([[-0.065, 0.47, 0.06], [-0.03, 0.42, 0.11], [0, 0.36, 0.127], [0.03, 0.42, 0.11], [0.065, 0.47, 0.06]], 0.011, skin(k, true), 20, 6));
    g.add(at(torus(0.155, 0.02, clothMat(0xb4473c, "sash"), 8, 28), [0, 0.05, 0], [90, 0, 0], [1, 0.66, 1]));
    g.add(at(rbox(0.05, 0.16, 0.015, 0.006, clothMat(0xb4473c, "sash")), [0.06, -0.06, 0.1], [0, 0, 8]));
    for (const s of [1, -1]) {
      g.add(at(sphere(0.075, skin(k), 16, 10), [s * 0.19, 0.4, 0], [0, 0, 0], [1, 0.8, 0.9]));
      // the sleeve hangs from the shoulder and flares at the cuff (built pointing down)
      const sleeve = group("sleeve",
        lathe([[0.0, 0], [0.11, 0], [0.105, 0.03], [0.085, 0.12], [0.07, 0.24], [0.065, 0.3], [0.0, 0.3]], skin(k), 18),
        at(torus(0.108, 0.011, skin(k, true), 6, 20), [0, 0.01, 0], [90, 0, 0]),
      );
      g.add(at(sleeve, [s * 0.27, 0.1, 0], [0, 0, s * 10]));
    }
  }
  return at(group(k + "_body", g), [0, 0.02, 0]);
}

/** Leg armor: both legs and the hips, standing up. */
export function legs(k: Kind) {
  const g = group("legs");
  if (k === "cloth") {
    // a long robe skirt with a trim band at the hem
    g.add(lathe([[0.0, 0.005], [0.25, 0.005], [0.245, 0.04], [0.2, 0.3], [0.165, 0.55], [0.145, 0.74], [0.15, 0.78], [0.0, 0.8]], skin(k), 28));
    g.add(at(torus(0.248, 0.013, skin(k, true), 6, 30), [0, 0.022, 0], [90, 0, 0]));
    // a front panel in the trim colour
    g.add(tube([[0, 0.74, 0.15], [0, 0.4, 0.192], [0, 0.04, 0.25]], 0.012, skin(k, true), 12, 6));
    g.add(at(torus(0.155, 0.016, clothMat(0xb4473c, "sash"), 6, 26), [0, 0.76, 0], [90, 0, 0]));
    return g;
  }
  const leg = lathe([[0.0, 0], [0.05, 0], [0.055, 0.12], [0.062, 0.36], [0.07, 0.42], [0.085, 0.62], [0.09, 0.78], [0.0, 0.8]], skin(k), 18);
  for (const s of [1, -1]) {
    g.add(at(leg.clone(), [s * 0.09, 0, 0]));
    if (k === "plate") {
      g.add(at(sphere(0.05, metalMat(M, true), 14, 10), [s * 0.09, 0.4, 0.04], [0, 0, 0], [1, 1, 0.7]));
      g.add(at(torus(0.06, 0.008, metalMat(M, true), 6, 18), [s * 0.09, 0.12, 0], [90, 0, 0]));
      g.add(at(slab([[-0.075, 0], [0.075, 0], [0.065, -0.17], [-0.065, -0.17]], 0.014, metalMat(M), 0.006), [s * 0.09, 0.78, 0.075], [-8, 0, 0]));
    } else {
      g.add(at(rbox(0.06, 0.07, 0.02, 0.008, leatherMat(LEATHER_DARK, "leather_dark")), [s * 0.09, 0.4, 0.055]));
      g.add(stitch([[s * 0.15, 0.05, 0], [s * 0.16, 0.4, 0], [s * 0.17, 0.78, 0]]));
    }
  }
  g.add(at(rbox(0.36, 0.1, 0.2, 0.04, skin(k)), [0, 0.76, 0]));
  g.add(at(torus(0.17, 0.014, k === "plate" ? metalMat(M, true) : leatherMat(LEATHER_DARK, "leather_dark"), 6, 26), [0, 0.8, 0], [90, 0, 0], [1, 0.62, 1]));
  if (k === "leather") g.add(buckle([0, 0.8, 0.106]));
  return g;
}

/** A pair of boots, toes to +Z. */
export function boots(k: Kind) {
  const one = () => {
    const b = group("boot");
    if (k === "cloth") {
      b.add(at(capsule(0.042, 0.16, skin(k), 6, 14), [0, 0.04, 0.03], [90, 0, 0], [1, 1, 0.75]));
      b.add(at(lathe([[0.05, 0], [0.052, 0.04], [0.05, 0.09], [0.0, 0.09]], skin(k), 16), [0, 0.0, -0.03]));
      b.add(at(torus(0.05, 0.008, skin(k, true), 6, 16), [0, 0.09, -0.03], [90, 0, 0]));
      b.add(tube([[0, 0.05, 0.12], [0, 0.07, 0.16], [0, 0.1, 0.165]], 0.012, skin(k), 10, 8)); // curled toe
      return b;
    }
    b.add(at(rbox(0.1, 0.07, 0.25, 0.034, skin(k)), [0, 0.035, 0.04]));
    b.add(at(lathe([[0.0, 0], [0.052, 0], [0.05, 0.08], [0.055, 0.2], [0.062, 0.24], [0.0, 0.24]], skin(k), 18), [0, 0.03, -0.03]));
    b.add(at(rbox(0.104, 0.02, 0.255, 0.008, leatherMat(LEATHER_DARK, "sole")), [0, 0.008, 0.04]));
    if (k === "plate") {
      b.add(at(sphere(0.05, metalMat(M, true), 14, 8, ), [0, 0.05, 0.11], [0, 0, 0], [1, 0.7, 1.1]));
      b.add(at(torus(0.062, 0.01, metalMat(M, true), 6, 18), [0, 0.27, -0.03], [90, 0, 0]));
      b.add(at(torus(0.054, 0.007, metalMat(M, true), 6, 18), [0, 0.13, -0.03], [90, 0, 0]));
    } else {
      b.add(at(torus(0.064, 0.014, leatherMat(LEATHER_DARK, "leather_dark"), 6, 18), [0, 0.265, -0.03], [90, 0, 0]));
      for (let i = 0; i < 3; i++) b.add(at(rbox(0.06, 0.006, 0.008, 0.002, plain("laces", 0xe9dfc8, 0.8)), [0, 0.08 + i * 0.045, 0.026 - i * 0.004]));
    }
    return b;
  };
  return group(k + "_boots", at(one(), [-0.07, 0, 0], [0, 6, 0]), at(one(), [0.07, 0, 0], [0, -6, 0]));
}

export function helmetLeather() {
  const lm = leatherMat(LEATHER), dm = leatherMat(LEATHER_DARK, "leather_dark");
  const g = group("leather_cap",
    lathe([[0.128, 0], [0.13, 0.05], [0.115, 0.13], [0.07, 0.19], [0, 0.205]], lm, 22),
    at(torus(0.13, 0.014, dm, 8, 26), [0, 0.01, 0], [90, 0, 0]),
    stitch([[0, 0.02, 0.135], [0, 0.12, 0.118], [0, 0.2, 0.02], [0, 0.12, -0.118], [0, 0.02, -0.135]]),
    stitch([[0.135, 0.02, 0], [0.118, 0.12, 0], [0.02, 0.2, 0], [-0.118, 0.12, 0], [-0.135, 0.02, 0]]),
  );
  for (const s of [1, -1]) g.add(at(slab([[0, 0], [0.07, 0], [0.06, -0.08], [0.02, -0.09]], 0.012, lm, 0.005), [s * 0.12, 0.02, 0.03], [0, s > 0 ? -90 : 90, 0], [s, 1, 1]));
  g.add(buckle([0.122, -0.05, 0.03], [0, 90, 0]));
  return at(g, [0, 0.09, 0]);
}

export function mageHat() {
  const cm = clothMat(ROBE), tm = clothMat(ROBE_TRIM, "cloth_trim");
  const g = group("mage_hat",
    lathe([[0.0, 0], [0.24, 0], [0.245, 0.008], [0.2, 0.014], [0.13, 0.02], [0.0, 0.02]], cm, 30),
    lathe([[0.12, 0.015], [0.115, 0.1], [0.08, 0.2], [0.05, 0.27], [0.0, 0.3]], cm, 22),
    at(torus(0.12, 0.016, tm, 6, 26), [0, 0.035, 0], [90, 0, 0]),
  );
  // the floppy bent tip
  g.add(tube([[0, 0.28, 0], [0.02, 0.34, 0], [0.07, 0.37, 0.02], [0.12, 0.34, 0.03]], 0.022, cm, 16, 10));
  g.add(at(sphere(0.022, tm, 10, 8), [0.125, 0.335, 0.03]));
  // a little star badge
  const star: [number, number][] = [];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.012 : 0.028; star.push([Math.cos(a) * r, Math.sin(a) * r]); }
  g.add(at(slab(star, 0.006, metalMat("bronze"), 0.002), [0, 0.09, 0.105], [-12, 0, 0]));
  return g;
}

export function buckler() {
  const g = group("buckler",
    at(lathe([[0.22, 0], [0.215, 0.012], [0.16, 0.03], [0.0, 0.04]], leatherMat(LEATHER), 30), [0, 0, 0], [90, 0, 0]),
    at(lathe([[0.0, -0.006], [0.22, 0]], woodMat("oak"), 30), [0, 0, 0], [90, 0, 0]),
    at(torus(0.215, 0.014, leatherMat(LEATHER_DARK, "leather_dark"), 8, 32), [0, 0, 0.004]),
    at(lathe([[0.06, 0], [0.055, 0.02], [0.03, 0.04], [0, 0.045]], metalMat("bronze"), 18), [0, 0, 0.03], [90, 0, 0]),
    at(tube([[-0.05, 0, -0.005], [-0.035, 0, -0.045], [0.035, 0, -0.045], [0.05, 0, -0.005]], 0.01, leatherMat(LEATHER_DARK, "grip"), 16, 6), [0, 0, 0]),
  );
  // stitching ring
  const pts: V3[] = [];
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2; pts.push([Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0.016]); }
  g.add(stitch(pts, 0.0025));
  // crossed straps with bronze studs
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(at(sphere(0.008, metalMat("bronze"), 8, 6), [Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.034])); }
  return g;
}

void rod; void cyl; void cone; void mat;

const plateIds = (piece: string) => ["bronze", "iron", "steel", "mithril"].map((m) => `${piece}_${m}`);
export const ARMOR_DEFS: ItemDef[] = [
  { id: "helmet_plate", name: "Plate helmet", cat: "Armor", swaps: ["metal"], game: plateIds("helmet"), about: "A rounded helm with a raised ridge, nose guard, cheek guards and a ring of rivets.", build: helmetPlate },
  { id: "platebody", name: "Platebody", cat: "Armor", swaps: ["metal"], game: plateIds("platebody"), about: "A breastplate with a centre ridge, a rolled waist and two layered shoulder plates.", build: () => torso("plate") },
  { id: "platelegs", name: "Platelegs", cat: "Armor", swaps: ["metal"], game: plateIds("platelegs"), about: "Leg plates with knee cops and hip guards.", build: () => legs("plate") },
  { id: "boots_plate", name: "Plate boots", cat: "Armor", swaps: ["metal"], game: plateIds("boots"), about: "Sabatons with toe caps and banded cuffs.", build: () => boots("plate") },
  { id: "shield_round", name: "Round shield", cat: "Armor", swaps: ["metal"], game: plateIds("shield"), about: "Oak planks behind a domed face, with a metal rim, straps, rivets and a central boss.", build: shieldRound },
  { id: "helmet_leather", name: "Leather cap", cat: "Armor", game: ["helmet_leather"], about: "A stitched leather cap with ear flaps and a buckle.", build: helmetLeather },
  { id: "platebody_leather", name: "Leather jerkin", cat: "Armor", game: ["platebody_leather"], about: "A leather jerkin with a belt, a cross strap and shoulder pads.", build: () => torso("leather") },
  { id: "platelegs_leather", name: "Leather trousers", cat: "Armor", game: ["platelegs_leather"], about: "Stitched leather trousers with knee patches and a belt.", build: () => legs("leather") },
  { id: "boots_leather", name: "Leather boots", cat: "Armor", game: ["boots_leather"], about: "Tall boots with folded cuffs and laces.", build: () => boots("leather") },
  { id: "shield_leather", name: "Leather buckler", cat: "Armor", game: ["shield_leather"], about: "A small leather-covered shield with a stitched ring and a bronze boss.", build: buckler },
  { id: "helmet_cloth", name: "Mage hat", cat: "Armor", game: ["helmet_cloth"], about: "A wide-brimmed blue hat with a floppy tip and a bronze star.", build: mageHat },
  { id: "platebody_cloth", name: "Robe top", cat: "Armor", game: ["platebody_cloth"], about: "A blue robe with a gold V collar, a red sash and wide sleeves.", build: () => torso("cloth") },
  { id: "platelegs_cloth", name: "Robe skirt", cat: "Armor", game: ["platelegs_cloth"], about: "A long robe skirt with a gold hem.", build: () => legs("cloth") },
  { id: "boots_cloth", name: "Cloth shoes", cat: "Armor", game: ["boots_cloth"], about: "Soft blue shoes with curled toes.", build: () => boots("cloth") },
];
void THREE;
