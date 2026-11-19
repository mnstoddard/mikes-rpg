// Stamina and food: what each action costs, and what eating gives back.
//
// Every action (each log, ore, fish, bar, tool or stew) costs stamina. You get
// it back slowly on your own, or quickly by eating: raw fish give a little,
// and fish stew (cooked at the stove) gives a lot more.
//
// Only type imports here, so items.ts can build every stew item from this.
import type { SkillId } from "./disciplines";
import type { ItemId } from "./items";
import type { ItemMasteryXp } from "./mastery";
import { masteryIn, masteryValue } from "./mastery";
import { WOODS, Wood } from "./tools";

// ---- Stamina ----

/** Everyone starts with this much (it will grow with levels later). */
export const MAX_STAMINA = 100;
/** You get 1 stamina back every 30 seconds, online or off. */
export const STAMINA_REGEN_MS = 30_000;

/** Stamina each action costs: per log, ore or fish you get, and per try at a crafting station. */
export const STAMINA_COST: Record<SkillId, number> = {
  woodcutting: 10,
  mining: 10,
  fishing: 1,
  smelting: 5,
  smithing: 5,
  cooking: 2,
};

// ---- Fish ----

export type FishId = "minnow" | "trout" | "perch" | "salmon" | "pike" | "tuna" | "swordfish" | "eel";
/** Fish item ids are the same as their Fishing type ids ("trout" is both). */
export const FISH_IDS: FishId[] = ["minnow", "trout", "perch", "salmon", "pike", "tuna", "swordfish", "eel"];

/** Stamina from eating one raw fish. */
export const RAW_FISH_STAMINA: Record<FishId, number> = {
  minnow: 2, trout: 3, perch: 4, salmon: 5, pike: 7, tuna: 10, swordfish: 14, eel: 20,
};

// ---- Fish stew ----

/** A stew gives this many times the stamina of eating its fish raw. */
export const STEW_MULTIPLIER = 3;
/** Most fish one stew can hold. */
export const MAX_STEW_FISH = 5;
export type StewCount = 1 | 2 | 3 | 4 | 5;
export const STEW_COUNTS: StewCount[] = [1, 2, 3, 4, 5];

/**
 * Every stew burns 1 log as fuel, and the fire adds stamina to the meal. A
 * Pine log costs 10 stamina to chop, so even Pine gives a bit more back.
 */
export const FUEL_STAMINA: Record<Wood, number> = {
  pine: 12, oak: 15, birch: 18, maple: 22, yew: 28, ironwood: 35, elderwood: 45,
};

/** e.g. "stew_trout_3_oak": 3 trout cooked over an oak fire. */
export type StewId = `stew_${FishId}_${StewCount}_${Wood}`;

export const stewId = (fish: FishId, count: StewCount, wood: Wood): StewId => `stew_${fish}_${count}_${wood}`;

export const ALL_STEW_IDS: StewId[] = FISH_IDS.flatMap((f) =>
  STEW_COUNTS.flatMap((n) => (Object.keys(WOODS) as Wood[]).map((w) => stewId(f, n, w))));
const STEW_SET = new Set<string>(ALL_STEW_IDS);

export const isStew = (item: string | null | undefined): item is StewId => !!item && STEW_SET.has(item);

export function parseStew(item: StewId): { fish: FishId; count: StewCount; wood: Wood } {
  const [, fish, count, wood] = item.split("_");
  return { fish: fish as FishId, count: Number(count) as StewCount, wood: wood as Wood };
}

/** The one Mastery all fish stews share (like all axes share one). */
export const STEW_MASTERY = "fish_stew";

/** The Merchant's stew: 3 minnows over a pine fire. */
export const SHOP_STEW: StewId = "stew_minnow_3_pine";

/** Stamina from a stew before your Mastery: 3 x the fish eaten raw, plus the fire. */
export function stewBaseStamina(item: StewId): number {
  const { fish, count, wood } = parseStew(item);
  return STEW_MULTIPLIER * RAW_FISH_STAMINA[fish] * count + FUEL_STAMINA[wood];
}

const isFish = (item: string): item is FishId => (FISH_IDS as string[]).includes(item);

/** Can you eat it? */
export const isFood = (item: ItemId | null | undefined): boolean => !!item && (isFish(item) || isStew(item));

/**
 * Stamina from eating one. Stews also get your Fish stew Mastery: +2% per
 * level, like the price (Mastery 11 = +20%). Rounded down. 0 if it isn't food.
 */
export function foodStamina(item: ItemId, mastery: ItemMasteryXp): number {
  if (isFish(item)) return RAW_FISH_STAMINA[item];
  if (isStew(item)) return Math.floor(stewBaseStamina(item) * masteryValue(masteryIn(mastery, STEW_MASTERY)));
  return 0;
}
