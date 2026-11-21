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
import type { ArmorType } from "./gear";
import type { Material, Wood } from "./tools";

export type BaitId = "bait_worm" | "bait_chum" | "bait_glow";
/** Things Handicraft uses that you find or get as leftovers. */
export type HandicraftMaterial = "worm" | "food_scraps" | "boar_hide" | "leather" | "thread" | "cloth";

// ---- Woodwork, leather and cloth (stage 10) ----
// Rook teaches it all. Things unlock one by one as your Handicraft level goes up.

/** Arrows: a log, a tip (stone or a metal bar) and 2 feathers make 10. The tip decides the damage. */
export type ArrowId = `arrows_${Material}`;
export const ARROW_LEVEL: Record<Material, number> = { stone: 1, bronze: 5, iron: 15, steel: 30, mithril: 50 };
export const ARROWS_PER_CRAFT = 10;
/** Each arrow you shoot has this chance of being picked up again. */
export const ARROW_RECOVER = 1 / 3;
export const arrowId = (m: Material): ArrowId => `arrows_${m}`;
export const isArrow = (item: string | null | undefined): item is ArrowId => !!item && /^arrows_(stone|bronze|iron|steel|mithril)$/.test(item);

/** Handicraft level to carve a bow or staff from each wood. */
export const WOOD_LEVEL: Record<Wood, number> = { pine: 1, oak: 8, birch: 16, maple: 25, yew: 35, ironwood: 50, elderwood: 65 };
/** A bow's or staff's wood adds this much to its hits (bows) or spells (staffs). */
export const WOOD_DAMAGE: Record<Wood, number> = { pine: 0, oak: 1, birch: 2, maple: 3, yew: 4, ironwood: 6, elderwood: 8 };

/** Tanning (at the tanning rack): one hide makes one leather. */
export const TANNING: { hide: ItemId; level: number; xp: number }[] = [
  { hide: "cowhide", level: 3, xp: 6 },
  { hide: "boar_hide", level: 6, xp: 8 },
  { hide: "wolf_pelt", level: 10, xp: 12 },
];
/** Spinning (at the spinning wheel): spider silk into thread, 2 thread into cloth. */
export const THREAD_LEVEL = 6;
export const CLOTH_LEVEL = 10;
/** Handicraft level for each leather and cloth piece. */
export const SOFT_LEVEL: Record<"leather" | "cloth", Partial<Record<ArmorType, number>>> = {
  leather: { boots: 5, helmet: 7, platelegs: 9, platebody: 12, shield: 14 },
  cloth: { boots: 12, helmet: 14, platelegs: 16, platebody: 20 },
};

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
