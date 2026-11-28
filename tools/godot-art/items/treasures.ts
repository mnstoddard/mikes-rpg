// Jewelry, gems, spell books and quest items.
import * as THREE from "three";
import { ItemDef, Jewel, at, group, jewelMat, gem, gemMat, GEMS, torus, lathe, rbox, leatherMat, mat, sphere, slab, plain, metalMat, clothMat, paint, paintedMat } from "./kit";

export function ring(j: Jewel = "gold", gemKey = "ruby") {
  const band = torus(0.011, 0.0025, jewelMat(j), 10, 32);
  const g = group("ring",
    at(band, [0, 0.0135, 0]),
    at(lathe([[0, 0], [0.005, 0], [0.0065, 0.003], [0.006, 0.005]], jewelMat(j), 12), [0, 0.024, 0]),
    at(gem(0.0055, gemMat(GEMS[gemKey].color, 0.35), 8), [0, 0.031, 0]),
  );
  // four little prongs
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.add(at(sphere(0.0013, jewelMat(j), 6, 4), [Math.cos(a) * 0.0055, 0.0315, Math.sin(a) * 0.0055]));
  }
  return group("ring_holder", at(g, [0, 0, 0], [0, 0, 0]));
}

/** A spell book: leather covers, cream pages, metal corners, a gem and a ribbon. */
export function spellBook(cover = 0x7a4f9e, gemColor = 0x8fe3ff) {
  const coverM = leatherMat(cover, "cover");
  const pages = paintedMat("pages", paint("pages_edge", 64, 64, (c, w, h) => {
    c.fillStyle = "#efe4c8"; c.fillRect(0, 0, w, h);
    c.strokeStyle = "#d8ccae"; for (let y = 1; y < h; y += 3) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  }), { rough: 0.85 });
  const W = 0.16, H = 0.22, T = 0.05;
  const g = group("spell_book",
    at(rbox(W, 0.008, H, 0.003, coverM), [0, 0.004, 0]),
    at(rbox(W, 0.008, H, 0.003, coverM), [0, T - 0.004, 0]),
    at(rbox(0.016, T, H, 0.007, coverM), [-W / 2 + 0.004, T / 2, 0]),
    at(rbox(W - 0.012, T - 0.012, H - 0.012, 0.002, pages), [0.004, T / 2, 0]),
  );
  for (const z of [1, -1]) g.add(at(rbox(0.026, T + 0.004, 0.026, 0.006, metalMat("bronze")), [W / 2 - 0.01, T / 2, z * (H / 2 - 0.01)]));
  // a glowing gem in a bronze setting on the cover
  g.add(at(lathe([[0, 0], [0.024, 0], [0.026, 0.004], [0.02, 0.006]], metalMat("bronze"), 16), [0.008, T, 0]));
  g.add(at(gem(0.016, gemMat(gemColor, 0.8), 8, 0.4, 0.3), [0.008, T + 0.006, 0]));
  // ribbon bookmark hanging out
  g.add(at(slab([[0, 0], [0.008, 0], [0.008, -0.05], [0.004, -0.044], [0, -0.05]], 0.0015, clothMat(0xb4473c, "ribbon"), 0.0005), [0.02, T / 2, -H / 2 - 0.001], [0, 0, 0]));
  return g;
}

void THREE; void mat; void plain;

export const TREASURE_DEFS: ItemDef[] = [
  { id: "ring", name: "Ring", cat: "Jewelry", swaps: ["jewel", "gem"], game: ["ring_*"], about: "A band with a cut gem in four prongs. Swap the metal and the gem.", build: () => ring() },
  { id: "spell_book", name: "Spell book", cat: "Magic", game: ["book_*"], about: "Leather covers, cream pages, bronze corners, a glowing gem on the cover and a red ribbon.", build: () => spellBook() },
];
