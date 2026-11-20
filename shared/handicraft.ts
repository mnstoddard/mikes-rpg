// Handicraft: a Crafting skill for small useful things, made at the workbench
// (just east of the anvil, past the tree). For now it makes fishing bait.
//
// Bait goes in your bag. While you fish, the first unlocked bait in your bag
// is used up a little with every catch (like a tool wearing down), and helps:
// - Worm bait: you catch fish faster.
// - Chum bait: more Fishing XP for every catch.
// - Glow bait: a chance to catch two fish at once.
// Lock a bait to keep it for later (fishing skips locked bait).
//
// Bait is made from worms (dug up now and then while chopping or mining, or
// bought from a shop), food scraps (left over sometimes when you cook a
// meal) and feathers (from chickens).
//
// Only type imports from items, so items.ts can build these.
import type { ItemId } from "./items";

export type BaitId = "bait_worm" | "bait_chum" | "bait_glow";
/** Things Handicraft uses that you find or get as leftovers. */
export type HandicraftMaterial = "worm" | "food_scraps";

export interface BaitDef {
  name: string;
  single: string;
  icon: string;
  tint?: string;
  /** Handicraft level needed. */
  level: number;
  inputs: ItemId[];
  /** Catches it lasts. */
  uses: number;
  /** What it does while fishing. */
  effect: "speed" | "xp" | "double";
  /** Speed: 0.3 = 30% faster. XP: 0.5 = +50% Fishing XP. Double: 0.15 = 15% chance of a second fish. */
  amount: number;
  /** Handicraft XP for one. */
  xp: number;
  /** Success at Mastery 1. */
  start: number;
  description: string;
}

export const BAITS: Record<BaitId, BaitDef> = {
  bait_worm: {
    name: "Worm bait", single: "worm bait", icon: "🪱", level: 1, inputs: ["worm", "worm"], uses: 25,
    effect: "speed", amount: 0.3, xp: 4, start: 0.6, description: "Fish bite sooner: 30% faster fishing",
  },
  bait_chum: {
    name: "Chum bait", single: "chum bait", icon: "🪣", tint: "hue-rotate(160deg)", level: 3, inputs: ["food_scraps", "food_scraps", "worm"], uses: 25,
    effect: "xp", amount: 0.5, xp: 7, start: 0.55, description: "Bigger, livelier fish: +50% Fishing XP per catch",
  },
  bait_glow: {
    name: "Glow bait", single: "glow bait", icon: "✨", level: 6, inputs: ["worm", "worm", "feather"], uses: 25,
    effect: "double", amount: 0.15, xp: 10, start: 0.5, description: "Fish crowd around it: 15% chance to catch two at once",
  },
};
export const BAIT_IDS = Object.keys(BAITS) as BaitId[];
export const isBait = (item: string | null | undefined): item is BaitId => !!item && Object.hasOwn(BAITS, item);

/** Chance of digging up a worm with each log or ore. */
export const WORM_CHANCE = 0.12;
/** Chance of finding a mushroom with each log. */
export const MUSHROOM_CHANCE = 0.06;
/** Chance a cooked meal leaves food scraps behind. */
export const SCRAPS_CHANCE = 0.35;
