// Gathered and smelted materials: logs, ores, bars.
import * as THREE from "three";
import { ItemDef, Wood, Metal, at, group, barkMat, endGrain, woodMat, lump, mat, metalMat, slab, rng, plain, METALS, JEWELS, Jewel, jewelMat, cyl } from "./kit";

export function logs(w: Wood = "oak") {
  const g = group("logs");
  const one = (len: number, r: number) => {
    const body = cyl(r, r * 1.04, len, barkMat(w), 14);
    const capA = cyl(r * 0.93, r * 0.93, 0.006, endGrain(w), 14);
    const capB = capA.clone();
    // the bark rim is thicker than the end grain, so the ends look cut
    return group("log", body, at(capA, [0, len / 2, 0]), at(capB, [0, -len / 2, 0], [180, 0, 0]),
      // a little side branch stub
      at(cyl(r * 0.25, r * 0.3, r * 0.5, barkMat(w), 8), [r * 0.95, len * 0.15, 0], [0, 0, -80]));
  };
  g.add(at(one(0.5, 0.075), [-0.08, 0.075, 0], [0, 10, 90]));
  g.add(at(one(0.46, 0.07), [0.08, 0.072, 0.02], [0, -6, 90]));
  g.add(at(one(0.48, 0.068), [0, 0.2, 0.01], [0, 3, 90]));
  return g;
}

/** An ingot: wider at the bottom, soft edges, a stamped mark on top. */
export function bar(m: Metal | Jewel = "iron") {
  const material = m in METALS ? metalMat(m as Metal) : jewelMat(m as Jewel);
  const ingot = slab([[-0.085, 0], [0.085, 0], [0.07, 0.042], [-0.07, 0.042]], 0.075, material, 0.012);
  const mark = slab([[-0.012, -0.012], [0.012, -0.012], [0.0, 0.014]], 0.004, material, 0.0015);
  return group("bar", at(ingot, [0, 0, 0], [0, 0, 0]), at(mark, [0, 0.043, 0], [-90, 0, 0]));
}

const ORE_COLOR: Record<string, { color: number; rough: number; metal: number; glow?: number; name: string }> = {
  copper: { name: "Copper", color: 0xc87447, rough: 0.35, metal: 1 },
  tin: { name: "Tin", color: 0xc8ccd0, rough: 0.4, metal: 1 },
  iron: { name: "Iron", color: 0xb06a4a, rough: 0.6, metal: 0.4 },
  coal: { name: "Coal", color: 0x34322f, rough: 0.5, metal: 0.2 },
  silver: { name: "Silver", color: 0xe3e6ea, rough: 0.25, metal: 1 },
  gold: { name: "Gold", color: 0xf2c14e, rough: 0.27, metal: 1 },
  mithril: { name: "Mithril", color: 0x7cc4ee, rough: 0.25, metal: 1, glow: 0.5 },
  platinum: { name: "Platinum", color: 0xdce3e6, rough: 0.22, metal: 1 },
  iridium: { name: "Iridium", color: 0xb9b2d8, rough: 0.28, metal: 1, glow: 0.35 },
};

/** A chunk of rock with ore showing through. */
export function ore(kind: keyof typeof ORE_COLOR = "copper") {
  const r = rng(kind.length * 31 + 7);
  const o = ORE_COLOR[kind];
  const rock = mat("rock", 0x7a756d, { rough: 0.85, tex: "stone", normal: 0.8 });
  const nug = mat("ore", o.color, { rough: o.rough, metal: o.metal, emissive: o.glow ? o.color : undefined, glow: o.glow });
  const g = group("ore");
  if (kind === "coal") {
    g.add(at(lump(0.07, nug, r, 0.35, 1, [1, 0.8, 0.9]), [0, 0.055, 0]));
    g.add(at(lump(0.04, nug, r, 0.35, 1), [0.07, 0.035, 0.03]));
    return g;
  }
  g.add(at(lump(0.075, rock, r, 0.3, 2, [1.1, 0.8, 1]), [0, 0.06, 0]));
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2, e = 0.2 + r() * 0.9;
    const d = 0.07;
    g.add(at(lump(0.018 + r() * 0.014, nug, r, 0.35, 1), [Math.cos(a) * Math.cos(e) * d * 1.05, 0.06 + Math.sin(e) * d * 0.75, Math.sin(a) * Math.cos(e) * d]));
  }
  return g;
}

void THREE; void woodMat; void plain;

export const RESOURCE_DEFS: ItemDef[] = [
  { id: "logs", name: "Logs", cat: "Resources", swaps: ["wood"], game: ["*_logs"], about: "Three cut logs with bark, ringed end grain and a branch stub. Swap the wood for every tree.", build: () => logs("oak") },
  { id: "bar", name: "Metal bar", cat: "Resources", swaps: ["metal", "jewel"], game: ["*_bar"], about: "An ingot with soft edges and the smith's mark. One model for all eight bars.", build: () => bar("iron") },
  { id: "ore_copper", name: "Copper ore", cat: "Resources", game: ["copper_ore"], about: "A rock chunk with copper nuggets showing.", build: () => ore("copper") },
  { id: "ore_mithril", name: "Mithril ore", cat: "Resources", game: ["mithril_ore"], about: "Glowing blue mithril in grey rock.", build: () => ore("mithril") },
  { id: "coal", name: "Coal", cat: "Resources", game: ["coal"], about: "Two glossy black lumps.", build: () => ore("coal") },
];
