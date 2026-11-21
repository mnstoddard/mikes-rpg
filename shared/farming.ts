// Farming (stage 11): your own plot at the farm, east of town over the bridges.
//
// Farmer Odo teaches it and sells seeds. Buy a plot from him (it starts 2 × 2
// and grows to 6 × 6), click your plot to plant seeds, and come back to
// harvest. Crops grow in real time, even while you're logged out: about 10
// minutes for potatoes, a few hours for rare herbs. No watering.
//
// Everyone can see everyone's farm, but only you can plant and harvest yours.
// Plots live in the world (server/src/storage.ts world data), not in your save,
// so they're still there to see when you're offline.
import type { ItemId } from "./items";
import { BRONZE_PER_GOLD } from "./money";
import { WORLD_LOTS } from "./world";

export type CropId = "potato" | "carrot" | "onion" | "wheat" | "ginseng" | "blue_lotus";
export type SeedId = `seed_${CropId}`;
/** New things only the farm grows. */
export type FarmProduce = "onion" | "wheat";

export interface CropDef {
  /** What you harvest. */
  produce: ItemId;
  /** Farming level to plant it. */
  level: number;
  /** Minutes from planting to ripe. */
  minutes: number;
  /** How many you get from one tile: min to max. */
  yield: [number, number];
  /** Farming XP for harvesting one tile (planting gives a little too). */
  xp: number;
  /** One seed's price at Odo's, in bronze. */
  seedPrice: number;
  /** What the seed packet looks like. */
  tint?: string;
}

export const CROPS: Record<CropId, CropDef> = {
  potato:     { produce: "potato",     level: 1,  minutes: 10,  yield: [3, 5], xp: 8,  seedPrice: 1 },
  carrot:     { produce: "carrot",     level: 4,  minutes: 15,  yield: [3, 5], xp: 12, seedPrice: 1, tint: "hue-rotate(-60deg) saturate(2)" },
  onion:      { produce: "onion",      level: 8,  minutes: 25,  yield: [2, 4], xp: 18, seedPrice: 2, tint: "hue-rotate(-120deg)" },
  wheat:      { produce: "wheat",      level: 12, minutes: 40,  yield: [3, 5], xp: 25, seedPrice: 2, tint: "sepia(1) saturate(2)" },
  ginseng:    { produce: "ginseng",    level: 20, minutes: 120, yield: [1, 2], xp: 60, seedPrice: 8, tint: "sepia(.8) brightness(.9)" },
  blue_lotus: { produce: "blue_lotus", level: 30, minutes: 180, yield: [1, 2], xp: 90, seedPrice: 12, tint: "hue-rotate(180deg) saturate(1.5)" },
};
export const CROP_IDS = Object.keys(CROPS) as CropId[];
export const seedId = (c: CropId): SeedId => `seed_${c}`;
export const SEED_IDS = CROP_IDS.map(seedId);
export const isSeed = (item: string | null | undefined): item is SeedId => !!item && item.startsWith("seed_") && (CROP_IDS as string[]).includes(item.slice(5));
export const cropOfSeed = (seed: SeedId) => seed.slice(5) as CropId;

/** XP for planting one seed. */
export const PLANT_XP = 2;
/** A harvest gives a seed back this often (plus a little per Farming level). */
export const SEED_BACK = 0.3;
export const SEED_BACK_PER_LEVEL = 0.005;
/** Each level of a crop's Mastery: this much more likely to get one extra. */
export const MASTERY_EXTRA = 0.02;

// ---- Plots ----

/** A plot's sizes as it grows (width × height). Starts 2 × 2, then each step is a bit bigger. */
export const PLOT_SIZES: [number, number][] = [[2, 2], [3, 2], [3, 3], [4, 4], [5, 5], [6, 5], [6, 6]];
/** Gold for each size above (the first buys the plot). Odo pays for your first plot during his lesson. */
export const PLOT_GOLD = [2, 3, 5, 8, 12, 18, 25];
export const plotPrice = (step: number) => PLOT_GOLD[step] * BRONZE_PER_GOLD;
export const LOT_SIZE = 6;

/**
 * The farm's lots (top-left tile of each 6 × 6 lot). A plot fills the top-left
 * of its lot and grows into the rest. Built in shared/world.ts (the "f" tiles).
 */
export const LOTS: readonly { x: number; y: number }[] = WORLD_LOTS;

/** Which lot (and which tile in it, 0 to 35) a map tile is in, or null. */
export function lotAt(x: number, y: number): { lot: number; index: number } | null {
  const lot = LOTS.findIndex((l) => x >= l.x && x < l.x + LOT_SIZE && y >= l.y && y < l.y + LOT_SIZE);
  if (lot < 0) return null;
  return { lot, index: (y - LOTS[lot].y) * LOT_SIZE + (x - LOTS[lot].x) };
}
export const tileOf = (lot: number, index: number) => ({ x: LOTS[lot].x + (index % LOT_SIZE), y: LOTS[lot].y + Math.floor(index / LOT_SIZE) });
/** Is this tile (0 to 35) inside a plot of this size? */
export const inPlot = (index: number, w: number, h: number) => index % LOT_SIZE < w && Math.floor(index / LOT_SIZE) < h;

/** The farm chest: opens your enchanted chest (the guild's storage) from the farm, once you've paid Odo to link it. */
export const FARM_CHEST_PRICE = 5 * BRONZE_PER_GOLD;

// ---- A planted tile ----
// Stored as "crop:plantedAt:ripeAt" (times in ms), or "" when empty.

export interface Planted { crop: CropId; plantedAt: number; ripeAt: number }
export const encodeCrop = (c: Planted) => `${c.crop}:${c.plantedAt}:${c.ripeAt}`;
export function decodeCrop(s: string | null | undefined): Planted | null {
  if (!s) return null;
  const [crop, a, b] = s.split(":");
  if (!(crop in CROPS)) return null;
  return { crop: crop as CropId, plantedAt: Number(a), ripeAt: Number(b) };
}
/** How grown it is, 0 to 1 (1 = ripe). */
export const growth = (c: Planted, now: number) => Math.max(0, Math.min(1, (now - c.plantedAt) / Math.max(1, c.ripeAt - c.plantedAt)));

/** "9 min", "2 h 5 min". */
export function timeLeft(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;
}

/** What the server tells the client about your farm (for Odo's window). */
export interface FarmView {
  /** Your lot, or null if you don't have a plot yet. */
  lot: number | null;
  w: number;
  h: number;
  /** Which size you're at (index into PLOT_SIZES), -1 with no plot. */
  step: number;
  /** Lots nobody has yet. */
  free: number;
  /** Odo pays for your first plot (during his lesson). */
  firstFree: boolean;
  /** You've paid for the farm chest link. */
  chest: boolean;
}
