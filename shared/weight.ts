// Weight: how much you can carry, on top of bag slots.
//
// Everything has a weight, in kilograms. What's in your bag counts, and so do
// the tools on your belt and the weapon and armor you're wearing. When you're
// at your limit you can't pick anything else up (gathering stops, a shop
// won't hand you more) until you sell, drop, eat or store something.
//
// A new player can carry about 20 ore or logs (2 kg each) on top of their
// starting tools.
//
// Weights are stored in tenths of a kilogram (so 0.1 kg feathers add up
// exactly); `kg()` turns them back into "12.5 kg" for showing.
import type { ItemId } from "./items";
import { RESOURCE_FOR_ITEM, RESOURCES } from "./foraging";
import { BAR_IDS, TOOL_TYPES, ToolType, isTool, parseTool } from "./tools";
import { ARMOR, WEAPONS, isArmor, isWeapon, parseArmor, parseWeapon } from "./gear";
import { isMeal } from "./cooking";
import { isBait } from "./handicraft";
import { isPotion } from "./alchemy";

/** What you can carry comes from Dexterity: 45 kg at level 1 (shared/stats.ts). */
export { carryCapacity } from "./stats";

/** Tools, by type (tenths of a kg). */
const TOOL_WEIGHT: Record<ToolType, number> = { axe: 20, pickaxe: 20, shovel: 20, rod: 10, hammer: 15, tongs: 10, pot: 15 };

/** Weapons, by type. */
const WEAPON_WEIGHT: Record<string, number> = {
  dagger: 10, sword: 30, mace: 40, spear: 30, greatsword: 60, sling: 5, darts: 10, bow: 15, staff: 20,
};

/** Armor weighs 1.5 kg per bar that went into it. Mithril is light: 60% of that. */
const ARMOR_PER_BAR = 15;

/** Everything else, by item. Anything not listed (and not covered above) weighs 1 kg. */
const ITEM_WEIGHT: Partial<Record<string, number>> = {
  // Big fish are heavy.
  tuna: 20, swordfish: 25, eel: 15,
  // Other food.
  raw_chicken: 10, raw_beef: 15, raw_boar: 20, potato: 5, carrot: 3, mushroom: 2, wild_root: 3, truffle: 3,
  sage: 1, moonpetal: 1, red_cap: 2, ginseng: 2, honey: 3, blue_lotus: 1, old_bone: 5, slime_goo: 3, boar_tusk: 5, wolf_fang: 2, bat_wing: 2, venom_sac: 2,
  worm: 1, food_scraps: 2,
  // Monster drops and potions.
  vial: 2, feather: 1, rat_tail: 2, cowhide: 30, wolf_pelt: 20, goblin_charm: 2, spider_silk: 2, stolen_ring: 1, health_potion: 5,
};

/** One of this item's weight, in tenths of a kg. */
export function weightOf(item: ItemId): number {
  if (isTool(item)) return TOOL_WEIGHT[parseTool(item).type];
  if (isWeapon(item)) return WEAPON_WEIGHT[parseWeapon(item).type] ?? 20;
  if (isArmor(item)) {
    const { type, metal } = parseArmor(item);
    return Math.round(ARMOR[type].bars * ARMOR_PER_BAR * (metal === "mithril" ? 0.6 : 1));
  }
  const listed = ITEM_WEIGHT[item];
  if (listed != null) return listed;
  const res = RESOURCE_FOR_ITEM[item];
  if (res) return RESOURCES[res].skill === "fishing" ? 10 : 20; // logs, stone and ore 2 kg, fish 1 kg
  if ((BAR_IDS as string[]).includes(item)) return 20;
  if (isMeal(item)) return 10;
  if (isBait(item)) return 1;
  if (isPotion(item)) return 5;
  return 10;
}

/** What you're carrying: bag (counting stacks), tool belt and worn gear. In tenths of a kg. */
export function carriedWeight(
  bag: { inventory: (ItemId | null)[]; counts: number[] },
  belt: Record<string, { item: string } | null>,
  gear: Record<string, { item: string } | null>,
): number {
  let total = 0;
  bag.inventory.forEach((it, i) => { if (it) total += weightOf(it) * Math.max(1, bag.counts[i] ?? 1); });
  for (const t of Object.values(belt)) if (t) total += weightOf(t.item as ItemId);
  for (const g of Object.values(gear)) if (g) total += weightOf(g.item as ItemId);
  return total;
}

/** 125 -> "12.5 kg", 120 -> "12 kg". */
export const kg = (tenths: number) => `${Number((tenths / 10).toFixed(1))} kg`;
