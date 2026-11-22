// Crafting: Smelting (ore -> bars at the furnace), Smithing (bar + log ->
// tools at the anvil), Cooking (ingredients + log -> a meal at the stove) and
// Handicraft (worms, scraps, feathers -> bait at the workbench), plus
// prices for everything. Shared so the client shows
// the same success chances and prices the server uses.
//
// Crafting isn't about speed: each try takes the same time, and either works or
// fails. A failed try loses its inputs and gives half the XP (at least 1).
import { CROPS, CROP_IDS, CropId } from "./farming";
import { CRAFT_MARKUP, ITEMS, ItemId } from "./items";
import { RESOURCES, RESOURCE_FOR_ITEM, ResourceId } from "./foraging";
import { ItemMasteryXp, MAX_SUCCESS, MasteryId, craftSuccess, masteryIn, masteryValue } from "./mastery";
import type { CraftSkill } from "./disciplines";
import { POTIONS, POTION_TYPES, PotionId, PotionType, VIAL, parsePotion, potionInputs } from "./alchemy";
import { JEWEL_BARS, JEWEL_BAR_IDS, JEWEL_METALS, JEWEL_TYPES, JewelBarId, JewelType, cutId, parseGem } from "./jewelry";
import {
  ALL_TOOL_IDS, BAR_IDS, BarId, Belt, MATERIALS, MATERIAL_IDS, METALS, METAL_IDS, TOOL_TYPES, TOOL_TYPE_IDS, ToolType, WOODS, WOOD_IDS,
  ROD_START_SUCCESS, barId, headCount, isTool, maxDurability, metalOfBar, parseTool, toolBonus, toolForSkill, toolId, wearFor,
} from "./tools";
import { DISHES, DISH_IDS, DishId, SHOP_STEW, isMeal, mealLevel, mealXp, parseMeal } from "./cooking";
import {
  ARROWS_PER_CRAFT, ARROW_LEVEL, BAITS, BAIT_IDS, BaitId, CLOTH_LEVEL, SOFT_LEVEL, TANNING, THREAD_LEVEL, WOOD_LEVEL, arrowId, isArrow, isBait,
} from "./handicraft";
import {
  ARMOR, ARMOR_TYPES, WEAPONS, WEAPON_TYPES, armorId, gearType, isArmor, isGear, isSoftArmor, isWeapon, isWooden, parseArmor, parseWeapon, weaponId,
} from "./gear";

// ---- Prices ----

/** A shop sells for 3 times what he pays (before Mastery), so buying to resell always loses. */
export const BUY_MARKUP = 3;

/** Whose Mastery raises an item's price: oak_logs -> oak, bronze_bar -> bronze_bar, any axe -> axe, any curry -> curry. */
export function masteryIdFor(item: ItemId): MasteryId {
  const resource = RESOURCE_FOR_ITEM[item];
  if (resource) return resource;
  if (isTool(item)) return parseTool(item).type;
  const meal = parseMeal(item);
  if (meal) return meal.dish;
  if (isGear(item)) return gearType(item);
  if (isArrow(item)) return "arrows";
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
 * What a shop pays you for one item: its value raised by your Mastery
 * (in it and in what it's made from), rounded down to whole bronze coins. A
 * worn tool or piece of gear sells for less: half price when broken, full when
 * good as new. Bait sells for its share of uses left.
 */
export function sellPriceFor(item: ItemId, mastery: ItemMasteryXp, durability?: number | null): number {
  if (isBait(item)) return Math.floor(exactValue(item, mastery) * (durability != null ? Math.max(0, durability) / BAITS[item].uses : 1));
  const max = isTool(item) ? maxDurability(item) : isGear(item) ? gearDurability(item) : 0;
  const worn = max && durability != null ? 0.5 + 0.5 * Math.min(1, Math.max(0, durability) / max) : 1;
  return Math.floor(exactValue(item, mastery) * worn);
}

/** What a shop charges: 3 times the base price. Your Mastery doesn't change it. */
export const buyPriceFor = (item: ItemId) => ITEMS[item].sellPrice * BUY_MARKUP;

/** A shop has endless stock of these: basic (bronze) tools and weapons, a stew, health potions, vegetables, worms, bars, logs and ores. */
export const SHOP_STOCK: ItemId[] = [
  ...TOOL_TYPE_IDS.map((t) => toolId(t, "bronze", "pine")),
  weaponId("dagger", "bronze", "pine"), weaponId("sling", "bronze", "pine"), weaponId("staff", "stone", "pine"),
  SHOP_STEW,
  "health_potion",
  "potato", "carrot", "worm",
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
  /** Success at Mastery 1 (25% for most things, 80% for fishing rods, 50% for stew). */
  start: number;
  /** Without the right crafting tool, is your chance halved? (Not for fishing rods.) */
  needsTool: boolean;
  /** Given back if the try fails (a potion's vial, a ring's gem). */
  keepOnFail?: ItemId[];
  /** How many one try makes (arrows: 10). */
  makes?: number;
  /** Where it's made, if not the skill's usual station (the tanning rack, the spinning wheel). */
  station?: "tanning_rack" | "spinning_wheel";
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
    RECIPES.set(tool, { output: tool, skill: "smithing", inputs: ITEMS[tool].inputs!, level: r.level, xp: r.xp * 2 + 2, mastery: type, start: ROD_START_SUCCESS, needsTool: false });
    continue;
  }
  // Better materials give more XP (and so more Mastery).
  const mat = MATERIALS[metal];
  // Tongs and the pot use 3 bars, so they give 3 times the XP.
  const xp = mat.toolXp * headCount(type) + (wood ? Math.ceil(RESOURCES[wood as ResourceId].xp / 2) : 0);
  RECIPES.set(tool, { output: tool, skill: "smithing", inputs: ITEMS[tool].inputs!, level: mat.level, xp, mastery: type, start: mat.startSuccess, needsTool: mat.needsTool });
}

// Weapons (1 bar + 1 log) and armor (1 to 3 bars) are smithed at the anvil too.
// Each kind (all swords, all helmets) shares one Smithing Mastery, like tools.
for (const type of WEAPON_TYPES) {
  // Bows and staffs are carved at Rook's workbench now (Handicraft, below).
  if (isWooden(type)) continue;
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
    const { type, metal, wood } = parseWeapon(item);
    // A wooden bow or staff lasts like an iron tool, more with better wood.
    if (isWooden(type) && metal === "stone") return Math.round(METALS.iron.durability * WOODS[wood].durability);
    return Math.round(MATERIALS[metal].durability * WOODS[wood].durability);
  }
  if (isArmor(item)) {
    const m = parseArmor(item).metal;
    return Math.round((m === "leather" ? 260 : m === "cloth" ? 160 : METALS[m].durability) * 1.5);
  }
  return 0;
}

// Handicraft (stage 10), at Rook's workshop. Things unlock one by one with your Handicraft level.
// Bows and staffs: 2 logs (a bow also takes a thread for its string). No tool needed.
for (const type of ["bow", "staff"] as const) {
  for (const wood of WOOD_IDS) {
    const id = weaponId(type, "stone", wood);
    const level = WOOD_LEVEL[wood] + (type === "bow" ? 2 : 0);
    RECIPES.set(id, { output: id, skill: "handicraft", inputs: ITEMS[id].inputs!, level, xp: 8 + level, mastery: type, start: 0.5, needsTool: false });
  }
}
// Arrows: 10 from a log, a tip and 2 feathers.
for (const m of MATERIAL_IDS) {
  const id = arrowId(m);
  const level = ARROW_LEVEL[m];
  RECIPES.set(id, { output: id, skill: "handicraft", inputs: ["pine_logs", barId(m), "feather", "feather"], level, xp: 6 + level, mastery: "arrows", start: 0.6, needsTool: false, makes: ARROWS_PER_CRAFT });
}
// Tanning at the rack: one hide makes one leather. (Keyed by "tan_<hide>", since every hide makes the same leather.)
for (const t of TANNING) {
  RECIPES.set(`tan_${t.hide}` as ItemId, { output: "leather", skill: "handicraft", inputs: [t.hide], level: t.level, xp: t.xp, mastery: "leather", start: 0.6, needsTool: false, station: "tanning_rack" });
}
// Spinning at the wheel: spider silk into thread, 2 thread into cloth.
RECIPES.set("thread", { output: "thread", skill: "handicraft", inputs: ["spider_silk"], level: THREAD_LEVEL, xp: 10, mastery: "thread", start: 0.6, needsTool: false, station: "spinning_wheel" });
RECIPES.set("cloth", { output: "cloth", skill: "handicraft", inputs: ["thread", "thread"], level: CLOTH_LEVEL, xp: 16, mastery: "cloth", start: 0.55, needsTool: false, station: "spinning_wheel" });
// Leather and cloth armor, at the workbench.
for (const soft of ["leather", "cloth"] as const) {
  for (const type of ARMOR_TYPES) {
    const level = SOFT_LEVEL[soft][type];
    if (level == null) continue;
    const id = armorId(type, soft);
    RECIPES.set(id, { output: id, skill: "handicraft", inputs: ITEMS[id].inputs!, level, xp: 6 * ARMOR[type].bars + level, mastery: type, start: 0.5, needsTool: false });
  }
}
/** The tanning recipes' ids ("tan_cowhide"), for the tanning rack's window. */
export const TANNING_IDS = TANNING.map((t) => `tan_${t.hide}` as ItemId);

// Silver, gold, platinum and iridium bars (for jewelry), smelted at the furnace.
for (const bar of JEWEL_BAR_IDS) {
  const b = JEWEL_BARS[bar];
  RECIPES.set(bar, { output: bar, skill: "smelting", inputs: b.ores, level: b.level, xp: b.xp, mastery: bar, start: 0.25, needsTool: true });
}

// Bait (Handicraft): no tool needed.
for (const bait of BAIT_IDS) {
  const b = BAITS[bait];
  RECIPES.set(bait, { output: bait, skill: "handicraft", inputs: b.inputs, level: b.level, xp: b.xp, mastery: bait, start: b.start, needsTool: false });
}

/**
 * Meals are made on the spot, since every mix of ingredients is its own item.
 * Cooking level: the dish's (or the hardest ingredient's). XP: each
 * ingredient's, plus the dish's. Success starts at the dish's (50% for stew)
 * and climbs with that dish's Mastery. (How many ingredients you may use
 * depends on your skill tree, so the server checks that separately.)
 */
function mealRecipe(item: ItemId): Recipe | undefined {
  const meal = parseMeal(item);
  if (!meal) return undefined;
  const d = DISHES[meal.dish];
  return { output: item, skill: "cooking", inputs: ITEMS[item].inputs!, level: mealLevel(item as never), xp: mealXp(item as never), mastery: meal.dish, start: d.start, needsTool: true };
}

/** Potions (shared/alchemy.ts): made on the spot too, one id per potion and bonus. */
function potionRecipe(item: ItemId): Recipe | undefined {
  const p = parsePotion(item);
  if (!p) return undefined;
  const d = POTIONS[p.type];
  return { output: item, skill: "alchemy", inputs: potionInputs(item as PotionId), level: d.level, xp: d.xp + (p.bonus ? 2 : 0), mastery: `potion_${p.type}`, start: d.start, needsTool: false, keepOnFail: [VIAL] };
}

/** Rings and amulets (shared/jewelry.ts): bars, and a cut gem if you set one in. A failed try keeps the gem. */
function jewelRecipe(item: ItemId): Recipe | undefined {
  const g = parseGem(item);
  if (!g || g.kind !== "jewel") return undefined;
  const m = JEWEL_METALS[g.metal];
  const bars = JEWEL_TYPES[g.type].bars;
  const gem = g.gem ? cutId(g.gem, g.size) : null;
  return {
    output: item, skill: "smithing", inputs: [...Array<ItemId>(bars).fill(m.bar), ...(gem ? [gem] : [])],
    level: m.level, xp: m.xp * bars + (gem ? Math.ceil(g.size / 2) : 0), mastery: g.type, start: 0.45, needsTool: true, keepOnFail: gem ? [gem] : undefined,
  };
}

export const recipeFor = (item: ItemId): Recipe | undefined => RECIPES.get(item) ?? mealRecipe(item) ?? potionRecipe(item) ?? jewelRecipe(item);
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
export function successFor(recipe: Recipe, mastery: ItemMasteryXp, belt: Belt, treeSuccess = 0): number {
  const chance = craftSuccess(masteryIn(mastery, recipe.mastery), beltBonus(belt, recipe.skill), recipe.start, recipe.needsTool);
  // The skill tree's "Steady hands" removes that share of your failures, like a tool does.
  return Math.min(MAX_SUCCESS, 1 - (1 - chance) * (1 - treeSuccess));
}

/** Failing still teaches you a little: half the XP, at least 1. */
export const failXp = (xp: number) => Math.max(1, Math.floor(xp / 2));

/** Display name for a Mastery: "Oak logs", "Bronze bar", "Axe", "Stew", "Worm bait". */
export function masteryName(id: MasteryId): string {
  if (id.startsWith("potion_")) return POTIONS[id.slice(7) as PotionType].name;
  if (id in JEWEL_TYPES) return JEWEL_TYPES[id as JewelType].name;
  if (id in JEWEL_BARS) return JEWEL_BARS[id as JewelBarId].name;
  if (id in DISHES) return DISHES[id as DishId].name;
  if (id in BAITS) return BAITS[id as BaitId].name;
  if (id in WEAPONS) return WEAPONS[id as keyof typeof WEAPONS].name;
  if (id in ARMOR) return ARMOR[id as keyof typeof ARMOR].name;
  if (id in RESOURCES) { const r = RESOURCES[id as ResourceId]; return r.gem ? r.node : ITEMS[r.item].name; }
  if (id in TOOL_TYPES) return TOOL_TYPES[id as ToolType].name;
  if (id === "arrows") return "Arrows";
  if (id.startsWith("crop_")) return ITEMS[CROPS[id.slice(5) as CropId].produce].name;
  return ITEMS[id as BarId].name;
}

/** Every Mastery id there is (for loading saves). */
export const ALL_MASTERY_IDS: MasteryId[] = [...(Object.keys(RESOURCES) as ResourceId[]), ...BAR_IDS, ...TOOL_TYPE_IDS, ...DISH_IDS, ...BAIT_IDS, ...WEAPON_TYPES, ...ARMOR_TYPES, ...POTION_TYPES.map((t) => `potion_${t}` as const), ...JEWEL_BAR_IDS, "ring", "amulet", "arrows", "leather", "thread", "cloth", ...CROP_IDS.map((c) => `crop_${c}` as const)];
