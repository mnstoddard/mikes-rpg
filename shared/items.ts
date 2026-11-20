// Item definitions shared by server and client.
import {
  ALL_TOOL_IDS, BAR_IDS, BarId, MATERIALS, METALS, ROD_LOGS, TOOL_TYPES, ToolItemId, WOODS, barId, headCount, metalOfBar, parseTool,
} from "./tools";
import { DISHES, INGREDIENTS, IngredientId, MealId, OtherIngredient, mealTitle, parseMeal } from "./cooking";
import { BAITS, BAIT_IDS, BaitId, HandicraftMaterial } from "./handicraft";
import {
  ARMOR, ARMOR_TYPES, GearItemId, METAL_DAMAGE, WEAPONS, WEAPON_TYPES, armorId, parseArmor, parseWeapon, weaponId,
} from "./gear";

/** Things you gather. */
export type BaseItemId =
  // Woodcutting
  | "pine_logs" | "oak_logs" | "birch_logs" | "maple_logs" | "yew_logs" | "ironwood_logs" | "elderwood_logs"
  // Mining
  | "stone" | "copper_ore" | "tin_ore" | "iron_ore" | "coal" | "silver_ore" | "gold_ore" | "mithril_ore"
  // Fishing
  | "minnow" | "trout" | "perch" | "salmon" | "pike" | "tuna" | "swordfish" | "eel";

export interface ItemDef {
  name: string;
  /** Name for just one, e.g. "oak log". */
  single: string;
  icon: string; // emoji for now, swapped for pixel art later
  /** CSS filter that tints the emoji so similar items look different, e.g. oak vs pine logs. */
  tint?: string;
  /** What the Merchant pays for one, in bronze coins (before Mastery). */
  sellPrice: number;
  /** Crafted items: what goes into one. Its value is these inputs plus 25%. */
  inputs?: ItemId[];
}

/** Things monsters drop (the Merchant buys them), and the health potion. */
export type LootId = "feather" | "rat_tail" | "cowhide" | "wolf_pelt" | "goblin_charm" | "spider_silk" | "stolen_ring" | "health_potion";

/**
 * Bars (smelted from ore), tools (smithed from a bar and a log), meals (cooked
 * from ingredients and a log), weapons and armor, loot, cooking ingredients
 * (raw chicken, vegetables...), Handicraft materials (worms, food scraps) and bait.
 */
export type ItemId = BaseItemId | BarId | ToolItemId | MealId | GearItemId | LootId | OtherIngredient | HandicraftMaterial | BaitId;

/** A crafted item is worth what goes into it, plus 25%. */
export const CRAFT_MARKUP = 1.25;

const BASE_ITEMS: Record<BaseItemId, ItemDef> = {
  pine_logs: { name: "Pine logs", single: "pine log", icon: "🪵", sellPrice: 1 },
  oak_logs: { name: "Oak logs", single: "oak log", icon: "🪵", tint: "sepia(.6) brightness(.85)", sellPrice: 3 },
  birch_logs: { name: "Birch logs", single: "birch log", icon: "🪵", tint: "grayscale(.8) brightness(1.5)", sellPrice: 5 },
  maple_logs: { name: "Maple logs", single: "maple log", icon: "🪵", tint: "hue-rotate(-25deg) saturate(2)", sellPrice: 10 },
  yew_logs: { name: "Yew logs", single: "yew log", icon: "🪵", tint: "hue-rotate(60deg) saturate(1.4) brightness(.8)", sellPrice: 25 },
  ironwood_logs: { name: "Ironwood logs", single: "ironwood log", icon: "🪵", tint: "grayscale(1) brightness(.7) contrast(1.4)", sellPrice: 50 },
  elderwood_logs: { name: "Elderwood logs", single: "elderwood log", icon: "🪵", tint: "hue-rotate(230deg) saturate(1.6)", sellPrice: 100 },

  stone: { name: "Stone", single: "stone", icon: "🪨", sellPrice: 2 },
  copper_ore: { name: "Copper ore", single: "copper ore", icon: "🪨", tint: "sepia(1) saturate(4) hue-rotate(-15deg)", sellPrice: 4 },
  tin_ore: { name: "Tin ore", single: "tin ore", icon: "🪨", tint: "grayscale(1) brightness(1.5)", sellPrice: 5 },
  iron_ore: { name: "Iron ore", single: "iron ore", icon: "🪨", tint: "sepia(.8) saturate(2) hue-rotate(-40deg) brightness(.7)", sellPrice: 12 },
  coal: { name: "Coal", single: "coal", icon: "🪨", tint: "grayscale(1) brightness(.35)", sellPrice: 18 },
  silver_ore: { name: "Silver ore", single: "silver ore", icon: "🪨", tint: "grayscale(1) brightness(1.9) contrast(1.2)", sellPrice: 30 },
  gold_ore: { name: "Gold ore", single: "gold ore", icon: "🪨", tint: "sepia(1) saturate(6) brightness(1.3)", sellPrice: 60 },
  mithril_ore: { name: "Mithril ore", single: "mithril ore", icon: "🪨", tint: "sepia(1) saturate(5) hue-rotate(170deg)", sellPrice: 120 },

  minnow: { name: "Minnow", single: "minnow", icon: "🐟", tint: "grayscale(.6) brightness(1.2)", sellPrice: 3 },
  trout: { name: "Trout", single: "trout", icon: "🐟", tint: "hue-rotate(80deg)", sellPrice: 5 },
  perch: { name: "Perch", single: "perch", icon: "🐠", sellPrice: 7 },
  salmon: { name: "Salmon", single: "salmon", icon: "🐟", tint: "hue-rotate(150deg) saturate(1.6)", sellPrice: 14 },
  pike: { name: "Pike", single: "pike", icon: "🐟", tint: "hue-rotate(260deg) saturate(.7) brightness(.8)", sellPrice: 22 },
  tuna: { name: "Tuna", single: "tuna", icon: "🐡", tint: "hue-rotate(180deg)", sellPrice: 40 },
  swordfish: { name: "Swordfish", single: "swordfish", icon: "🐬", tint: "hue-rotate(20deg) brightness(.9)", sellPrice: 70 },
  eel: { name: "Eel", single: "eel", icon: "🐍", tint: "hue-rotate(100deg) brightness(.75)", sellPrice: 120 },
};

const LOOT: Record<LootId, ItemDef> = {
  feather: { name: "Feathers", single: "feather", icon: "🪶", sellPrice: 1 },
  rat_tail: { name: "Rat tails", single: "rat tail", icon: "🐁", tint: "grayscale(.7)", sellPrice: 2 },
  cowhide: { name: "Cowhides", single: "cowhide", icon: "🐮", sellPrice: 4 },
  wolf_pelt: { name: "Wolf pelts", single: "wolf pelt", icon: "🐺", tint: "grayscale(.5) brightness(.9)", sellPrice: 12 },
  goblin_charm: { name: "Goblin charms", single: "goblin charm", icon: "🧿", sellPrice: 20 },
  spider_silk: { name: "Spider silk", single: "spider silk", icon: "🕸️", sellPrice: 30 },
  stolen_ring: { name: "Stolen rings", single: "stolen ring", icon: "💍", sellPrice: 60 },
  // Drink it for health (shared/combat.ts). The Merchant sells them.
  health_potion: { name: "Health potion", single: "health potion", icon: "🧪", tint: "hue-rotate(230deg) saturate(2.5)", sellPrice: 10 },
};

/** Cooking ingredients that aren't fish, and Handicraft materials. */
const FOOD_AND_MATERIALS: Record<OtherIngredient | HandicraftMaterial, ItemDef> = {
  raw_chicken: { name: "Raw chicken", single: "raw chicken", icon: "🍗", tint: "saturate(.4) brightness(1.25)", sellPrice: 2 },
  raw_beef: { name: "Raw beef", single: "raw beef", icon: "🥩", sellPrice: 4 },
  potato: { name: "Potatoes", single: "potato", icon: "🥔", sellPrice: 1 },
  carrot: { name: "Carrots", single: "carrot", icon: "🥕", sellPrice: 1 },
  mushroom: { name: "Mushrooms", single: "mushroom", icon: "🍄", sellPrice: 3 },
  worm: { name: "Worms", single: "worm", icon: "🪱", sellPrice: 1 },
  food_scraps: { name: "Food scraps", single: "food scraps", icon: "🦴", tint: "sepia(.6)", sellPrice: 1 },
};

const TABLE = { ...BASE_ITEMS, ...LOOT, ...FOOD_AND_MATERIALS } as Record<ItemId, ItemDef>;

/**
 * Every item's definition. Meals ("meal_curry_oak_potato-trout") are built the
 * first time something asks for one, since every mix of ingredients is its own
 * item and there are far too many to list.
 */
export const ITEMS: Record<ItemId, ItemDef> = new Proxy(TABLE, {
  get(table, key) {
    if (typeof key !== "string" || key in table) return Reflect.get(table, key);
    const def = mealDef(key);
    if (def) table[key as ItemId] = def;
    return def;
  },
  has(table, key) {
    return key in table || (typeof key === "string" && !!parseMeal(key));
  },
});

/** Value before rounding, so a tool's price isn't rounded twice. */
function exactBase(item: ItemId): number {
  const def = ITEMS[item];
  return def.inputs ? def.inputs.reduce((sum, i) => sum + exactBase(i), 0) * CRAFT_MARKUP : def.sellPrice;
}

for (const bar of BAR_IDS) {
  const metal = METALS[metalOfBar(bar)];
  ITEMS[bar] = { name: `${metal.name} bar`, single: `${metal.name.toLowerCase()} bar`, icon: "🧈", tint: metal.tint, sellPrice: 0, inputs: metal.ores };
  ITEMS[bar].sellPrice = Math.floor(exactBase(bar));
}
for (const tool of ALL_TOOL_IDS) {
  const { type, metal, wood } = parseTool(tool);
  if (!metal) {
    // Fishing rods: all wood, 2 logs.
    const name = `${WOODS[wood!].name} ${TOOL_TYPES[type].name.toLowerCase()}`;
    const logs = `${wood}_logs` as BaseItemId;
    ITEMS[tool] = { name, single: name.toLowerCase(), icon: TOOL_TYPES[type].icon, tint: ITEMS[logs].tint, sellPrice: 0, inputs: Array<ItemId>(ROD_LOGS).fill(logs) };
    ITEMS[tool].sellPrice = Math.floor(exactBase(tool));
    continue;
  }
  const name = `${MATERIALS[metal].name} ${TOOL_TYPES[type].name.toLowerCase()}`;
  ITEMS[tool] = {
    name: wood ? `${name} (${WOODS[wood].name})` : name,
    single: wood ? `${name.toLowerCase()} (${WOODS[wood].name.toLowerCase()})` : name.toLowerCase(),
    icon: TOOL_TYPES[type].icon, tint: MATERIALS[metal].tint, sellPrice: 0,
    inputs: [...Array<ItemId>(headCount(type)).fill(metal === "stone" ? "stone" : barId(metal)), ...(wood ? [`${wood}_logs` as BaseItemId] : [])],
  };
  ITEMS[tool].sellPrice = Math.floor(exactBase(tool));
}
// Weapons: a head of stone or a metal bar, plus a wooden handle (like tools).
for (const type of WEAPON_TYPES) {
  for (const metal of ["stone", ...Object.keys(METALS)] as (keyof typeof METAL_DAMAGE)[]) {
    for (const wood of Object.keys(WOODS) as (keyof typeof WOODS)[]) {
      const id = weaponId(type, metal, wood);
      const { metal: m } = parseWeapon(id);
      const name = `${MATERIALS[m].name} ${WEAPONS[type].name.toLowerCase()}`;
      ITEMS[id] = {
        name: `${name} (${WOODS[wood].name})`, single: `${name.toLowerCase()} (${WOODS[wood].name.toLowerCase()})`,
        icon: WEAPONS[type].icon, tint: MATERIALS[m].tint, sellPrice: 0,
        inputs: [m === "stone" ? "stone" : barId(m), `${wood}_logs` as BaseItemId],
      };
      ITEMS[id].sellPrice = Math.floor(exactBase(id));
    }
  }
}
// Armor: all metal, 1 to 3 bars.
for (const type of ARMOR_TYPES) {
  for (const metal of Object.keys(METALS) as (keyof typeof METALS)[]) {
    const id = armorId(type, metal);
    const { metal: m } = parseArmor(id);
    const name = `${METALS[m].name} ${ARMOR[type].name.toLowerCase()}`;
    ITEMS[id] = {
      name, single: name.toLowerCase(), icon: ARMOR[type].icon, tint: METALS[m].tint, sellPrice: 0,
      inputs: Array<ItemId>(ARMOR[type].bars).fill(barId(m)),
    };
    ITEMS[id].sellPrice = Math.floor(exactBase(id));
  }
}
// Bait (Handicraft).
for (const bait of BAIT_IDS) {
  const b = BAITS[bait];
  ITEMS[bait] = { name: b.name, single: b.single, icon: b.icon, tint: b.tint, sellPrice: 0, inputs: b.inputs };
  ITEMS[bait].sellPrice = Math.floor(exactBase(bait));
}

/** A meal's name and price: "Trout curry (2 trout, potato · oak)". */
function mealDef(id: string): ItemDef | undefined {
  const meal = parseMeal(id);
  if (!meal) return undefined;
  const counts = new Map<IngredientId, number>();
  for (const i of meal.ingredients) counts.set(i, (counts.get(i) ?? 0) + 1);
  const list = [...counts].map(([i, n]) => (n === 1 ? TABLE[i].single : `${n} ${TABLE[i].name.toLowerCase()}`)).join(", ");
  const title = mealTitle(meal, (i) => (INGREDIENTS[i].kind === "fish" ? TABLE[i].name : TABLE[i].single.replace(/^raw /, "").replace(/^./, (c) => c.toUpperCase())));
  const def: ItemDef = {
    name: `${title} (${list} · ${WOODS[meal.wood].name.toLowerCase()})`,
    single: title.toLowerCase(),
    icon: DISHES[meal.dish].icon, sellPrice: 0,
    inputs: [...meal.ingredients, `${meal.wood}_logs` as BaseItemId],
  };
  def.sellPrice = Math.floor(def.inputs!.reduce((sum, i) => sum + TABLE[i].sellPrice, 0) * CRAFT_MARKUP);
  return def;
}

/**
 * Items from before each skill had several types. Old saves turn them into
 * the starting type, which sells for the same price, so nobody loses money.
 */
export const LEGACY_ITEMS: Record<string, ItemId> = { logs: "pine_logs", ore: "stone", fish: "minnow" };
// (Old fish stews, "stew_trout_3_oak", become new stews: see legacyStew in cooking.ts.)

export const INVENTORY_SIZE = 28;
