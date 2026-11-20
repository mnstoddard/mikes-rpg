// Wear and repair. Tools wear with each use, weapons with each hit, armor
// each time something hits you. At 0 uses left a tool or piece of gear is
// "Broken": it goes back in your bag and can't be used until the Repairer
// at the Mages' Guild fixes it. Until then it works at full strength.
//
// Repairs cost about 1 bronze coin for every 10% worn on basic (stone or pine)
// gear, more for better materials. Old Maren's lesson sends you there with
// your broken rod, and that first repair is free.
import type { ItemId } from "./items";
import { isTool, maxDurability, parseTool, Material, Wood } from "./tools";
import { isArmor, isGear, isWeapon, parseArmor, parseWeapon } from "./gear";
import { gearDurability } from "./crafting";

/** How much more a repair costs for each material (stone and pine are 1). */
const MATERIAL_COST: Record<Material, number> = { stone: 1, bronze: 2, iron: 4, steel: 8, mithril: 16 };
/** Fishing rods are all wood. */
const WOOD_COST: Record<Wood, number> = { pine: 1, oak: 2, birch: 3, maple: 5, yew: 8, ironwood: 12, elderwood: 16 };

/** Can this wear out (and be repaired)? */
export const isRepairable = (item: ItemId | null | undefined): item is ItemId => isTool(item) || isGear(item);

/** Uses a fresh one has. */
export function maxUses(item: ItemId): number {
  return isTool(item) ? maxDurability(item) : isGear(item) ? gearDurability(item) : 0;
}

/** No uses left: it can't be used until it's repaired. */
export const isBroken = (item: ItemId | null | undefined, durability: number | null | undefined) =>
  isRepairable(item) && durability != null && durability <= 0;

function costTier(item: ItemId): number {
  if (isTool(item)) {
    const { metal, wood } = parseTool(item);
    return metal ? MATERIAL_COST[metal] : WOOD_COST[wood!];
  }
  if (isWeapon(item)) return MATERIAL_COST[parseWeapon(item).metal];
  if (isArmor(item)) return MATERIAL_COST[parseArmor(item).metal];
  return 1;
}

/** What the Repairer charges to make it good as new, in bronze coins (0 if it isn't worn). */
export function repairCost(item: ItemId, durability: number | null | undefined): number {
  const max = maxUses(item);
  if (!max || durability == null || durability >= max) return 0;
  const worn = 1 - Math.max(0, durability) / max;
  return Math.max(1, Math.ceil(worn * 10 * costTier(item)));
}

/** One thing the Repairer could fix: on your belt, in your gear, or in your bag. */
export interface RepairJob {
  where: "belt" | "gear" | "bag";
  /** Tool type, gear slot, or bag entry. */
  key: string | number;
  item: ItemId;
  durability: number;
  max: number;
  cost: number;
}
