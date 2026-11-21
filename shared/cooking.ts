// Stamina, food and Cooking: what each action costs, and what eating gives back.
//
// Every action (each log, ore, fish, bar, tool or meal) costs stamina. You get
// it back slowly on your own, or quickly by eating: raw fish give a little,
// and meals cooked at the stove give a lot more.
//
// Cooking: pick a dish (Stew, Stir fry, Curry, Roast; each unlocks at a
// Cooking level), put up to 3 ingredients from your bag in the pot (more with
// the Cooking skill tree), and burn 1 log. Each dish is better with some
// ingredients than others: stew loves a good fire, curry loves fish, stir fry
// loves chicken and beef, a roast loves beef. Ingredients a dish can't use
// (like rat tails) can't go in.
//
// A meal's item id says exactly what's in it, e.g.
// "meal_curry_oak_potato-trout-trout" (ingredients sorted), so there are far
// too many to list. items.ts builds each one's name and price when it's first
// needed (see mealDef).
//
// Only type imports from items, so items.ts can build meals from this.
import type { SkillId } from "./disciplines";
import type { ItemId } from "./items";
import type { ItemMasteryXp } from "./mastery";
import { masteryIn, masteryValue } from "./mastery";
import { RESOURCES } from "./foraging";
import { WOOD_IDS, Wood } from "./tools";

// ---- Stamina ----

/** Everyone starts with this much (it will grow with levels later). */
/** Stamina at Endurance 1. Your max goes up with Endurance (shared/stats.ts maxStamina). */
export const MAX_STAMINA = 100;
/** You get 1 stamina back every 30 seconds, online or off. */
export const STAMINA_REGEN_MS = 30_000;

/** Stamina each action costs: per log, ore or fish you get, and per try at a crafting station. */
export const STAMINA_COST: Record<SkillId, number> = {
  woodcutting: 10,
  mining: 10,
  fishing: 1,
  foraging: 4,
  // Hunting is trained by fighting, which already costs stamina per attack.
  hunting: 0,
  // Enchanting uses up a soul gem instead.
  enchanting: 0,
  // Planting or harvesting one tile.
  farming: 2,
  smelting: 5,
  smithing: 5,
  cooking: 2,
  handicraft: 2,
  alchemy: 2,
  // Combat: each weapon attack costs 1 (spells cost mana instead; Defense costs nothing).
  melee: 1,
  ranged: 1,
  magic: 0,
  defense: 0,
  // Charisma: talking costs nothing.
  trading: 0,
  renown: 0,
};

// ---- Fish ----

export type FishId = "minnow" | "trout" | "perch" | "salmon" | "pike" | "tuna" | "swordfish" | "eel";
/** Fish item ids are the same as their Fishing type ids ("trout" is both). */
export const FISH_IDS: FishId[] = ["minnow", "trout", "perch", "salmon", "pike", "tuna", "swordfish", "eel"];

/** Stamina from eating one raw fish (it's also what a fish adds to a meal, before the dish's multiplier). */
export const RAW_FISH_STAMINA: Record<FishId, number> = {
  minnow: 2, trout: 3, perch: 4, salmon: 5, pike: 7, tuna: 10, swordfish: 14, eel: 20,
};

// ---- Ingredients ----

/** What sort of food it is. Each dish multiplies each sort differently. */
export type FoodKind = "fish" | "poultry" | "meat" | "veg";
export const FOOD_KINDS: Record<FoodKind, string> = { fish: "Fish", poultry: "Chicken", meat: "Meat", veg: "Vegetables" };

export type OtherIngredient = "raw_chicken" | "raw_beef" | "raw_boar" | "potato" | "carrot" | "mushroom" | "wild_root" | "truffle";
export type IngredientId = FishId | OtherIngredient;

export interface IngredientDef {
  kind: FoodKind;
  /** Stamina it adds to a meal before the dish's multiplier. */
  stamina: number;
  /** Cooking level needed to cook with it. */
  level: number;
  /** Cooking XP it adds to a meal. */
  xp: number;
  /** Where to get it (for the info card). */
  from: string;
}

export const INGREDIENTS: Record<IngredientId, IngredientDef> = {
  // You can cook a fish once you could catch it (Cooking level = its Fishing level), for its Fishing XP.
  ...Object.fromEntries(FISH_IDS.map((f) => [f, {
    kind: "fish", stamina: RAW_FISH_STAMINA[f], level: RESOURCES[f].level, xp: RESOURCES[f].xp, from: `Fishing (level ${RESOURCES[f].level})`,
  }])) as Record<FishId, IngredientDef>,
  raw_chicken: { kind: "poultry", stamina: 4, level: 1, xp: 3, from: "Chickens drop it" },
  raw_beef:    { kind: "meat",    stamina: 6, level: 5, xp: 5, from: "Cows drop it" },
  raw_boar:    { kind: "meat",    stamina: 9, level: 8, xp: 7, from: "Boars drop it, in the meadow south-east of the square" },
  potato:      { kind: "veg",     stamina: 2, level: 1, xp: 1, from: "The General Store sells them" },
  carrot:      { kind: "veg",     stamina: 2, level: 1, xp: 1, from: "The General Store sells them" },
  mushroom:    { kind: "veg",     stamina: 3, level: 3, xp: 2, from: "Dug up with Foraging, or found now and then while chopping trees" },
  wild_root:   { kind: "veg",     stamina: 3, level: 1, xp: 1, from: "Dug up with Foraging" },
  truffle:     { kind: "veg",     stamina: 10, level: 15, xp: 9, from: "Dug up with Foraging (level 15), rarely" },
};
export const INGREDIENT_IDS = Object.keys(INGREDIENTS) as IngredientId[];
export const isIngredient = (item: string | null | undefined): item is IngredientId => !!item && Object.hasOwn(INGREDIENTS, item);

// ---- Dishes ----

export type DishId = "stew" | "stirfry" | "curry" | "roast" | "steak";

export interface DishDef {
  name: string;
  icon: string;
  /** Cooking level that unlocks it. */
  level: number;
  /** Stamina multiplier for each sort of ingredient. Missing = can't go in this dish. */
  kinds: Partial<Record<FoodKind, number>>;
  /** Multiplier on the fire's stamina (the log you burn). Stew gets the most from it. */
  fire: number;
  /** Success at Mastery 1. Fancier dishes burn more at first. */
  start: number;
  /** Extra XP on top of its ingredients. */
  xp: number;
  /** One line on what it's good with. */
  note: string;
}

export const DISHES: Record<DishId, DishDef> = {
  stew:    { name: "Stew",     icon: "🍲", level: 1, kinds: { fish: 3, poultry: 3, meat: 3, veg: 3 },           fire: 1.5,  start: 0.5,  xp: 2, note: "Takes anything, and gets the most from a good fire" },
  stirfry: { name: "Stir fry", icon: "🥘", level: 3, kinds: { poultry: 4, meat: 4, veg: 3.5 },                  fire: 1,    start: 0.45, xp: 3, note: "Best with chicken and beef. No fish" },
  curry:   { name: "Curry",    icon: "🍛", level: 5, kinds: { fish: 4.5, poultry: 3.5, veg: 3, meat: 3 },        fire: 1,    start: 0.4,  xp: 4, note: "Best with fish" },
  steak:   { name: "Steak",    icon: "🥩", level: 4, kinds: { meat: 5.5, veg: 2 },                          fire: 1,    start: 0.45, xp: 4, note: "Just meat (beef or boar), with a little veg on the side" },
  roast:   { name: "Roast",    icon: "🍖", level: 7, kinds: { meat: 5, poultry: 4.5, veg: 2.5 },                fire: 1.25, start: 0.35, xp: 5, note: "Best with beef, then chicken. No fish" },
};
export const DISH_IDS = Object.keys(DISHES) as DishId[];

/** Can this go in this dish? */
export const fitsDish = (dish: DishId, item: string | null | undefined): item is IngredientId =>
  isIngredient(item) && DISHES[dish].kinds[INGREDIENTS[item].kind] !== undefined;

/** Ingredients in a pot to start with. The Cooking skill tree's "Bigger pot" adds more. */
export const BASE_INGREDIENTS = 3;
/** Most a meal can ever hold (3 + 3 ranks of Bigger pot). */
export const MAX_INGREDIENTS = 6;

/**
 * Every meal burns 1 log as fuel, and the fire adds stamina to the meal (times
 * the dish's fire multiplier). A Pine log costs 10 stamina to chop, so even
 * Pine gives a bit more back.
 */
export const FUEL_STAMINA: Record<Wood, number> = {
  pine: 12, oak: 15, birch: 18, maple: 22, yew: 28, ironwood: 35, elderwood: 45,
};

// ---- Meal items ----

export type MealId = `meal_${DishId}_${Wood}_${string}`;

export interface Meal { dish: DishId; wood: Wood; ingredients: IngredientId[] }

/** Ingredients in a fixed order, so the same meal always has the same id. */
const sortIngredients = (list: IngredientId[]) =>
  [...list].sort((a, b) => INGREDIENT_IDS.indexOf(a) - INGREDIENT_IDS.indexOf(b));

export const mealId = (dish: DishId, wood: Wood, ingredients: IngredientId[]): MealId =>
  `meal_${dish}_${wood}_${sortIngredients(ingredients).join("-")}`;

/** "meal_curry_oak_potato-trout" -> its parts, or null if it isn't a meal that could be cooked. */
export function parseMeal(item: string | null | undefined): Meal | null {
  if (!item || !item.startsWith("meal_")) return null;
  const [, dish, wood, ...rest] = item.split("_");
  const ingredients = rest.join("_").split("-") as IngredientId[];
  if (!Object.hasOwn(DISHES, dish) || !WOOD_IDS.includes(wood as Wood)) return null;
  if (ingredients.length < 1 || ingredients.length > MAX_INGREDIENTS) return null;
  if (!ingredients.every((i) => fitsDish(dish as DishId, i))) return null;
  if (mealId(dish as DishId, wood as Wood, ingredients) !== item) return null; // must be in the sorted order
  return { dish: dish as DishId, wood: wood as Wood, ingredients };
}

export const isMeal = (item: string | null | undefined): item is MealId => parseMeal(item) !== null;

/** The Mastery each dish has (all stews share one, all curries another...). */
export const dishOf = (item: MealId): DishId => parseMeal(item)!.dish;

/** What it adds to this dish, before Mastery: its stamina times the dish's multiplier for its sort. */
export const ingredientStamina = (dish: DishId, i: IngredientId) => INGREDIENTS[i].stamina * DISHES[dish].kinds[INGREDIENTS[i].kind]!;
export const fireStamina = (dish: DishId, wood: Wood) => Math.round(FUEL_STAMINA[wood] * DISHES[dish].fire);

/** Stamina from a meal before your Mastery: each ingredient times the dish's multiplier, plus the fire. */
export function mealBaseStamina(item: MealId): number {
  const { dish, wood, ingredients } = parseMeal(item)!;
  return Math.round(ingredients.reduce((sum, i) => sum + ingredientStamina(dish, i), 0)) + fireStamina(dish, wood);
}

/** Cooking XP for one meal: its ingredients' XP plus the dish's own. */
export function mealXp(item: MealId): number {
  const { dish, ingredients } = parseMeal(item)!;
  return ingredients.reduce((sum, i) => sum + INGREDIENTS[i].xp, 0) + DISHES[dish].xp;
}

/** Cooking level to make it: the dish's level, or the hardest ingredient's. */
export function mealLevel(item: MealId): number {
  const { dish, ingredients } = parseMeal(item)!;
  return Math.max(DISHES[dish].level, ...ingredients.map((i) => INGREDIENTS[i].level));
}

/** "Trout curry", "Mixed stew": named after an ingredient if it's at least half the pot. */
export function mealTitle(m: Meal, names: (i: IngredientId) => string): string {
  const counts = new Map<IngredientId, number>();
  for (const i of m.ingredients) counts.set(i, (counts.get(i) ?? 0) + 1);
  const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
  const dish = DISHES[m.dish].name.toLowerCase();
  return n * 2 >= m.ingredients.length ? `${names(top)} ${dish}` : `Mixed ${dish}`;
}

/** The General Store's stew (and Old Maren's spare): 3 minnows over a pine fire. */
export const SHOP_STEW: MealId = mealId("stew", "pine", ["minnow", "minnow", "minnow"]);
/** The tutorial's first stew: 1 minnow over a pine fire. */
export const FIRST_STEW: MealId = mealId("stew", "pine", ["minnow"]);

/**
 * Before dishes, there were only fish stews: "stew_trout_3_oak". Old saves turn
 * them into the same stew with the new ids (3 trout over an oak fire).
 */
export function legacyStew(item: string): MealId | null {
  const m = /^stew_([a-z]+)_([1-5])_([a-z]+)$/.exec(item);
  if (!m || !FISH_IDS.includes(m[1] as FishId) || !WOOD_IDS.includes(m[3] as Wood)) return null;
  return mealId("stew", m[3] as Wood, Array<IngredientId>(Number(m[2])).fill(m[1] as FishId));
}

const isFish = (item: string): item is FishId => (FISH_IDS as string[]).includes(item);

/** Can you eat it? (Raw fish and meals. Raw chicken and beef need cooking first.) */
export const isFood = (item: ItemId | null | undefined): boolean => !!item && (isFish(item) || isMeal(item));

/**
 * Stamina from eating one. Meals also get your Mastery in that dish (+2% per
 * level, like the price: Mastery 11 = +20%), and `bonus` from the Cooking
 * skill tree ("Hearty meals", 0.1 = +10%). Rounded down. 0 if it isn't food.
 */
export function foodStamina(item: ItemId, mastery: ItemMasteryXp, bonus = 0): number {
  if (isFish(item)) return RAW_FISH_STAMINA[item];
  const meal = parseMeal(item);
  if (meal) return Math.floor(mealBaseStamina(item as MealId) * (masteryValue(masteryIn(mastery, meal.dish)) + bonus));
  return 0;
}

