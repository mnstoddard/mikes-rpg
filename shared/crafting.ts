// Crafting: Smelting (ore -> bars at the furnace) and Smithing (bar + log ->
// tools at the anvil), plus prices for everything. Shared so the client shows
// the same success chances and prices the server uses.
//
// Crafting isn't about speed: each try takes the same time, and either works or
// fails. A failed try loses its inputs and gives half the XP (at least 1).
import { CRAFT_MARKUP, ITEMS, ItemId } from "./items";
import { RESOURCES, RESOURCE_FOR_ITEM, ResourceId } from "./foraging";
import { ItemMasteryXp, MasteryId, craftSuccess, masteryIn, masteryValue } from "./mastery";
import type { CraftSkill } from "./disciplines";
import {
  ALL_TOOL_IDS, BAR_IDS, BarId, Belt, METALS, TOOL_TYPES, TOOL_TYPE_IDS, ToolType,
  isTool, maxDurability, metalOfBar, parseTool, toolBonus, toolForSkill, toolId, wearFor,
} from "./tools";

// ---- Prices ----

/** The Merchant sells for 3 times what he pays (before Mastery), so buying to resell always loses. */
export const BUY_MARKUP = 3;

/** Whose Mastery raises an item's price: oak_logs -> oak, bronze_bar -> bronze_bar, any axe -> axe. */
export function masteryIdFor(item: ItemId): MasteryId {
  const resource = RESOURCE_FOR_ITEM[item];
  if (resource) return resource;
  if (isTool(item)) return parseTool(item).type;
  return item as BarId;
}

/** Value before rounding. Crafted items: their inputs (with your Mastery in those) + 25%, times your Mastery in this one. */
function exactValue(item: ItemId, mastery: ItemMasteryXp): number {
  const def = ITEMS[item];
  const own = masteryValue(masteryIn(mastery, masteryIdFor(item)));
  if (!def.inputs) return def.sellPrice * own;
  return def.inputs.reduce((sum, i) => sum + exactValue(i, mastery), 0) * CRAFT_MARKUP * own;
}

/**
 * What the Merchant pays you for one item: its value raised by your Mastery
 * (in it and in what it's made from), rounded down to whole bronze coins. A
 * worn tool sells for its share of uses left.
 */
export function sellPriceFor(item: ItemId, mastery: ItemMasteryXp, durability?: number | null): number {
  const worn = isTool(item) && durability != null ? Math.max(0, durability) / maxDurability(item) : 1;
  return Math.floor(exactValue(item, mastery) * worn);
}

/** What the Merchant charges: 3 times the base price. Your Mastery doesn't change it. */
export const buyPriceFor = (item: ItemId) => ITEMS[item].sellPrice * BUY_MARKUP;

/** The Merchant has endless stock of these: basic tools, bars, logs and ores. */
export const SHOP_STOCK: ItemId[] = [
  ...TOOL_TYPE_IDS.map((t) => toolId(t, "bronze", "pine")),
  ...BAR_IDS,
  ...(Object.keys(ITEMS) as ItemId[]).filter((i) => {
    const r = RESOURCE_FOR_ITEM[i];
    return r && RESOURCES[r].skill !== "fishing";
  }),
];

// ---- Recipes ----

export interface Recipe {
  output: ItemId;
  skill: CraftSkill;
  /** Items used up by one try. */
  inputs: ItemId[];
  /** Smelting or Smithing level needed. */
  level: number;
  /** XP for a success (a failure gives half, at least 1). Goes to Crafting, the skill and the Mastery. */
  xp: number;
  mastery: MasteryId;
}

const RECIPES = new Map<ItemId, Recipe>();
for (const bar of BAR_IDS) {
  const m = METALS[metalOfBar(bar)];
  RECIPES.set(bar, { output: bar, skill: "smelting", inputs: ITEMS[bar].inputs!, level: m.level, xp: m.barXp, mastery: bar });
}
for (const tool of ALL_TOOL_IDS) {
  const { type, metal, wood } = parseTool(tool);
  // Better materials give more XP (and so more Mastery).
  const xp = METALS[metal].toolXp + (wood ? Math.ceil(RESOURCES[wood as ResourceId].xp / 2) : 0);
  RECIPES.set(tool, { output: tool, skill: "smithing", inputs: ITEMS[tool].inputs!, level: METALS[metal].level, xp, mastery: type });
}

export const recipeFor = (item: ItemId): Recipe | undefined => RECIPES.get(item);
export const SMELTING_RECIPES = BAR_IDS.map((b) => RECIPES.get(b)!);

/** How much a crafting tool wears down on one try of this recipe. */
export const recipeWear = (r: Recipe) => wearFor(r.level);

/** Bonus of the tool on your belt for a skill, or null if that belt slot is empty. */
export function beltBonus(belt: Belt, skill: string): number | null {
  const type = toolForSkill(skill);
  const t = type && belt[type];
  return t ? toolBonus(t.item) : null;
}

/** Your chance that one try of this recipe works, with what's on your belt. */
export function successFor(recipe: Recipe, mastery: ItemMasteryXp, belt: Belt): number {
  return craftSuccess(masteryIn(mastery, recipe.mastery), beltBonus(belt, recipe.skill));
}

/** Failing still teaches you a little: half the XP, at least 1. */
export const failXp = (xp: number) => Math.max(1, Math.floor(xp / 2));

/** Display name for a Mastery: "Oak logs", "Bronze bar", "Axe". */
export function masteryName(id: MasteryId): string {
  if (id in RESOURCES) return ITEMS[RESOURCES[id as ResourceId].item].name;
  if (id in TOOL_TYPES) return TOOL_TYPES[id as ToolType].name;
  return ITEMS[id as BarId].name;
}

/** Every Mastery id there is (for loading saves). */
export const ALL_MASTERY_IDS: MasteryId[] = [...(Object.keys(RESOURCES) as ResourceId[]), ...BAR_IDS, ...TOOL_TYPE_IDS];
