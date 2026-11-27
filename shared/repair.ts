// Wear and repair. Tools wear with each use, weapons with each hit, armor
// each time something hits you. At 0 uses left a tool or piece of gear is
// "Broken": it goes back in your bag and can't be used until the Repairer
// at the Mages' Guild fixes it. Until then it works at full strength.
//
// Repairing (version 0.22, Mike's note) is magic: everything comes from the land
// and holds a little ember, even an axe. Oswin (or your own Mend spell) draws the
// ember out of a spare of the same kind (any axe for an axe, any helmet for a
// helmet) and pours it into the one you're fixing. The spare is used up. A spare
// as good as the one you're fixing restores it fully; a poorer one only a little
// (a bronze axe barely helps a mithril one). So it pays to smith lots of cheap
// things, and your fine gear can last for ever. Oswin also asks a small fee.
import type { ItemId } from "./items";
import { isTool, maxDurability, parseTool, Material, Wood } from "./tools";
import { isArmor, isGear, isWeapon, parseArmor, parseWeapon } from "./gear";
import { gearDurability } from "./crafting";

/** How much more a repair costs for each material (pine and wooden bows and staffs are 1). */
const MATERIAL_COST: Record<Material | "leather" | "cloth", number> = { stone: 1, bronze: 2, iron: 4, steel: 8, mithril: 16, leather: 2, cloth: 3 };
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
  if (isWeapon(item)) {
    const w = parseWeapon(item);
    return w.metal === "stone" && (w.type === "bow" || w.type === "staff") ? WOOD_COST[w.wood] : MATERIAL_COST[w.metal];
  }
  if (isArmor(item)) return MATERIAL_COST[parseArmor(item).metal];
  return 1;
}

/** What kind of thing it is, for finding spares: "tool:axe", "weapon:sword", "armor:helmet". */
export function repairKind(item: ItemId): string | null {
  if (isTool(item)) return `tool:${parseTool(item).type}`;
  if (isWeapon(item)) return `weapon:${parseWeapon(item).type}`;
  if (isArmor(item)) return `armor:${parseArmor(item).type}`;
  return null;
}
/** "axe", "sword", "helmet": a spare of this kind fixes it. */
export const kindName = (kind: string) => kind.split(":")[1];

/** Uses a spare (with `spareLeft` uses of its own left) gives back to `target`: all of them from one at least as good, a share from a poorer one. */
export function restoreFrom(spare: ItemId, spareLeft: number, target: ItemId): number {
  return Math.floor(Math.max(0, spareLeft) * Math.min(1, costTier(spare) / costTier(target)));
}

/** Oswin's fee for drawing the ember across: a few bronze coins, more for finer things. */
export const repairFee = (target: ItemId, restored: number) => Math.max(1, Math.ceil((restored / Math.max(1, maxUses(target))) * 3 * Math.sqrt(costTier(target))));

/** Which spare to use: the plainest one that fixes it fully, or else the one that fixes it most. */
export function pickSpare(target: ItemId, need: number, spares: { entry: number; item: ItemId; left: number }[]): { entry: number; item: ItemId; restores: number } | null {
  const kind = repairKind(target);
  const ok = spares.filter((s) => repairKind(s.item) === kind && s.left > 0)
    .map((s) => ({ entry: s.entry, item: s.item, restores: Math.min(need, restoreFrom(s.item, s.left, target)), tier: costTier(s.item) }))
    .filter((s) => s.restores > 0);
  if (!ok.length) return null;
  const full = ok.filter((s) => s.restores >= need).sort((a, b) => a.tier - b.tier)[0];
  const best = full ?? ok.sort((a, b) => b.restores - a.restores)[0];
  return { entry: best.entry, item: best.item, restores: best.restores };
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
  /** "tool:axe": a spare of this kind is needed. */
  kind: string;
  /** The spare Oswin would use (from your bag), and how many uses it gives back. None: you have no spare of this kind. */
  spare?: { entry: number; item: ItemId; restores: number };
}
