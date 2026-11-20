// Crafting: Smelting (ore -> bars at the furnace), Smithing (bar + log ->
// tools at the anvil) and Cooking (fish + log -> stew at the stove), plus
// prices for everything. Shared so the client shows
// the same success chances and prices the server uses.
//
// Crafting isn't about speed: each try takes the same time, and either works or
// fails. A failed try loses its inputs and gives half the XP (at least 1).
import { CRAFT_MARKUP, ITEMS, ItemId } from "./items";
import { RESOURCES, RESOURCE_FOR_ITEM, ResourceId } from "./foraging";
import { ItemMasteryXp, MasteryId, craftSuccess, masteryIn, masteryValue } from "./mastery";
import type { CraftSkill } from "./disciplines";
import {
  ALL_TOOL_IDS, BAR_IDS, BarId, Belt, MATERIALS, MATERIAL_IDS, METALS, METAL_IDS, TOOL_TYPES, TOOL_TYPE_IDS, ToolType, WOODS, WOOD_IDS,
  STONE, headCount, isTool, maxDurability, metalOfBar, parseTool, toolBonus, toolForSkill, toolId, wearFor,
} from "./tools";
import { ALL_STEW_IDS, SHOP_STEW, STEW_MASTERY, isStew, parseStew } from "./cooking";
import {
  ARMOR, ARMOR_TYPES, WEAPONS, WEAPON_TYPES, armorId, gearType, isArmor, isGear, isWeapon, parseArmor, parseWeapon, weaponId,
} from "./gear";

// ---- Prices ----

/** The Merchant sells for 3 times what he pays (before Mastery), so buying to resell always loses. */
export const BUY_MARKUP = 3;

/** Whose Mastery raises an item's price: oak_logs -> oak, bronze_bar -> bronze_bar, any axe -> axe, any stew -> fish_stew. */
export function masteryIdFor(item: ItemId): MasteryId {
  const resource = RESOURCE_FOR_ITEM[item];
  if (resource) return resource;
  if (isTool(item)) return parseTool(item).type;
  if (isStew(item)) return STEW_MASTERY;
  if (isGear(item)) return gearType(item);
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
  const max = isTool(item) ? maxDurability(item) : isGear(item) ? gearDurability(item) : 0;
  const worn = max && durability != null ? Math.max(0, durability) / max : 1;
  return Math.floor(exactValue(item, mastery) * worn);
}

/** What the Merchant charges: 3 times the base price. Your Mastery doesn't change it. */
export const buyPriceFor = (item: ItemId) => ITEMS[item].sellPrice * BUY_MARKUP;

/** The Merchant has endless stock of these: basic (stone) tools and weapons, a fish stew, health potions, bars, logs and ores. */
export const SHOP_STOCK: ItemId[] = [
  ...TOOL_TYPE_IDS.map((t) => toolId(t, "stone", "pine")),
  weaponId("dagger", "stone", "pine"), weaponId("sling", "stone", "pine"), weaponId("staff", "stone", "pine"),
  SHOP_STEW,
  "health_potion",
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
  /** Smelting, Smithing or Cooking level needed. */
  level: number;
  /** XP for a success (a failure gives half, at least 1). Goes to Crafting, the skill and the Mastery. */
  xp: number;
  mastery: MasteryId;
  /** Success at Mastery 1 (25% for most things, 80% for stone tools, 50% for stew). */
  start: number;
  /** Without the right crafting tool, is your chance halved? (Not for stone tools.) */
  needsTool: boolean;
}

const RECIPES = new Map<ItemId, Recipe>();
for (const bar of BAR_IDS) {
  const m = METALS[metalOfBar(bar)];
  RECIPES.set(bar, { output: bar, skill: "smelting", inputs: ITEMS[bar].inputs!, level: m.level, xp: m.barXp, mastery: bar, start: m.startSuccess, needsTool: true });
}
for (const tool of ALL_TOOL_IDS) {
  const { type, metal, wood } = parseTool(tool);
  if (!metal) {
    // Fishing rods: carved from 2 logs at the anvil. You can make one from any wood you
    // could chop (same level in Smithing), it's easy (80% at first) and needs no hammer.
    const r = RESOURCES[wood as ResourceId];
    RECIPES.set(tool, { output: tool, skill: "smithing", inputs: ITEMS[tool].inputs!, level: r.level, xp: r.xp * 2 + 2, mastery: type, start: STONE.startSuccess, needsTool: false });
    continue;
  }
  // Better materials give more XP (and so more Mastery).
  const mat = MATERIALS[metal];
  // Tongs and the pot use 3 bars, so they give 3 times the XP.
  const xp = mat.toolXp * headCount(type) + (wood ? Math.ceil(RESOURCES[wood as ResourceId].xp / 2) : 0);
  RECIPES.set(tool, { output: tool, skill: "smithing", inputs: ITEMS[tool].inputs!, level: mat.level, xp, mastery: type, start: mat.startSuccess, needsTool: mat.needsTool });
}

// Weapons (1 stone or bar + 1 log) and armor (1 to 3 bars) are smithed at the anvil too.
// Each kind (all swords, all helmets) shares one Smithing Mastery, like tools.
for (const type of WEAPON_TYPES) {
  for (const metal of MATERIAL_IDS) {
    for (const wood of WOOD_IDS) {
      const id = weaponId(type, metal, wood);
      const mat = MATERIALS[metal];
      const xp = mat.toolXp + Math.ceil(RESOURCES[wood as ResourceId].xp / 2);
      RECIPES.set(id, { output: id, skill: "smithing", inputs: ITEMS[id].inputs!, level: mat.level, xp, mastery: type, start: mat.startSuccess, needsTool: mat.needsTool });
    }
  }
}
for (const type of ARMOR_TYPES) {
  for (const metal of METAL_IDS) {
    const id = armorId(type, metal);
    const mat = METALS[metal];
    RECIPES.set(id, { output: id, skill: "smithing", inputs: ITEMS[id].inputs!, level: mat.level, xp: mat.toolXp * ARMOR[type].bars, mastery: type, start: mat.startSuccess, needsTool: true });
  }
}

/** Uses a new weapon or armor piece has: like tools (metal × handle wood); armor is all metal, so ×1.5. */
export function gearDurability(item: ItemId): number {
  if (isWeapon(item)) {
    const { metal, wood } = parseWeapon(item);
    return Math.round(MATERIALS[metal].durability * WOODS[wood].durability);
  }
  if (isArmor(item)) return Math.round(METALS[parseArmor(item).metal].durability * 1.5);
  return 0;
}

/** Cooking starts at 50% (it's your way back to stamina), and climbs with Fish stew Mastery. */
export const STEW_START_SUCCESS = 0.5;
for (const stew of ALL_STEW_IDS) {
  const { fish, count } = parseStew(stew);
  // You can cook a fish once you can catch it (Cooking level = its Fishing level).
  // XP: the fish's Fishing XP for each fish, plus 2 for tending the fire.
  const r = RESOURCES[fish];
  const xp = r.xp * count + 2;
  RECIPES.set(stew, { output: stew, skill: "cooking", inputs: ITEMS[stew].inputs!, level: r.level, xp, mastery: STEW_MASTERY, start: STEW_START_SUCCESS, needsTool: true });
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
  return craftSuccess(masteryIn(mastery, recipe.mastery), beltBonus(belt, recipe.skill), recipe.start, recipe.needsTool);
}

/** Failing still teaches you a little: half the XP, at least 1. */
export const failXp = (xp: number) => Math.max(1, Math.floor(xp / 2));

/** Display name for a Mastery: "Oak logs", "Bronze bar", "Axe", "Fish stew". */
export function masteryName(id: MasteryId): string {
  if (id === STEW_MASTERY) return "Fish stew";
  if (id in WEAPONS) return WEAPONS[id as keyof typeof WEAPONS].name;
  if (id in ARMOR) return ARMOR[id as keyof typeof ARMOR].name;
  if (id in RESOURCES) return ITEMS[RESOURCES[id as ResourceId].item].name;
  if (id in TOOL_TYPES) return TOOL_TYPES[id as ToolType].name;
  return ITEMS[id as BarId].name;
}

/** Every Mastery id there is (for loading saves). */
export const ALL_MASTERY_IDS: MasteryId[] = [...(Object.keys(RESOURCES) as ResourceId[]), ...BAR_IDS, ...TOOL_TYPE_IDS, STEW_MASTERY, ...WEAPON_TYPES, ...ARMOR_TYPES];
