// Item definitions shared by server and client.
import {
  ALL_TOOL_IDS, BAR_IDS, BarId, MATERIALS, METALS, Metal, ROD_LOGS, STONE, TOOL_TYPES, TOOL_TYPE_IDS, ToolItemId, WOODS, barId, headCount, metalOfBar, parseTool,
} from "./tools";
import { DISHES, INGREDIENTS, IngredientId, MealId, OtherIngredient, mealTitle, parseMeal } from "./cooking";
import { ARROWS_PER_CRAFT, ArrowId, BAITS, BAIT_IDS, BaitId, HandicraftMaterial, arrowId } from "./handicraft";
import { SOFT_NAMES, isWooden } from "./gear";
import { BONUSES, POTIONS, PotionId, parsePotion, potionInputs } from "./alchemy";
import { enchantedName, enchantsOf } from "./enchanting";
import { STORY_ITEMS, StoryItemId } from "./story";
import { CROPS, CROP_IDS, CropId, FarmProduce, SeedId, seedId } from "./farming";
import { GemItemId, JEWEL_BARS, JEWEL_BAR_IDS, JEWEL_METALS, JEWEL_TYPES, JewelBarId, cutId, gemItemDef, parseGem } from "./jewelry";
import {
  ARMOR, ARMOR_TYPES, GearItemId, METAL_DAMAGE, WEAPONS, WEAPON_TYPES, WeaponType, armorId, parseArmor, parseWeapon, weaponId,
} from "./gear";

/** Things you gather. */
export type BaseItemId =
  // Woodcutting
  | "pine_logs" | "oak_logs" | "birch_logs" | "maple_logs" | "yew_logs" | "ironwood_logs" | "elderwood_logs"
  // Mining
  | "stone" | "copper_ore" | "tin_ore" | "iron_ore" | "coal" | "silver_ore" | "gold_ore" | "mithril_ore" | "platinum_ore" | "iridium_ore"
  // Fishing
  | "minnow" | "trout" | "perch" | "salmon" | "pike" | "tuna" | "swordfish" | "eel";

export interface ItemDef {
  name: string;
  /** Shorter name for the bag and the item card, e.g. just "Axe" (the card says what it's made of). */
  short?: string;
  /** Name for just one, e.g. "oak log". */
  single: string;
  icon: string; // an emoji, or "svg:..." for one the client draws (tools: "svg:tool/axe/bronze/oak")
  /** CSS filter that tints the emoji so similar items look different, e.g. oak vs pine logs. */
  tint?: string;
  /** What a shop pays for one, in bronze coins (before Mastery). */
  sellPrice: number;
  /** Crafted items: what goes into one. Its value is these inputs plus 25%. */
  inputs?: ItemId[];
}

/** Things monsters drop (a shop buys them), and the health potion. */
export type LootId = "feather" | "rat_tail" | "cowhide" | "wolf_pelt" | "goblin_charm" | "spider_silk" | "stolen_ring" | "health_potion"
  | "slime_goo" | "boar_tusk" | "wolf_fang" | "bat_wing" | "venom_sac" | "vial" | "alpha_pelt";
/** Herbs and other things you dig up with Foraging (shared/foraging.ts FORAGE_FINDS). Alchemy will use them. */
export type WildId = "sage" | "moonpetal" | "old_bone" | "red_cap" | "ginseng" | "honey" | "blue_lotus";

/**
 * Bars (smelted from ore), tools (smithed from a bar and a log), meals (cooked
 * from ingredients and a log), weapons and armor, loot, cooking ingredients
 * (raw chicken, vegetables...), Handicraft materials (worms, food scraps) and bait.
 */
export type ItemId = BaseItemId | BarId | ToolItemId | MealId | GearItemId | LootId | WildId | OtherIngredient | HandicraftMaterial | BaitId | PotionId | GemItemId | JewelBarId | SpellBookId | EnchantedItemId | ArrowId | SeedId | FarmProduce | StoryItemId;
/** An enchanted tool, weapon or armor piece: "axe_iron_oak+swift.20" (shared/enchanting.ts). */
export type EnchantedItemId = `${string}+${string}`;

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
  platinum_ore: { name: "Platinum ore", single: "platinum ore", icon: "🪨", tint: "grayscale(1) brightness(1.7) contrast(.8)", sellPrice: 160 },
  iridium_ore: { name: "Iridium ore", single: "iridium ore", icon: "🪨", tint: "hue-rotate(230deg) saturate(1.2) brightness(1.1)", sellPrice: 220 },
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
  alpha_pelt: { name: "Alpha wolf pelts", single: "alpha wolf pelt", icon: "🐺", tint: "grayscale(.6) brightness(1.4)", sellPrice: 150 },
  goblin_charm: { name: "Goblin charms", single: "goblin charm", icon: "🧿", sellPrice: 20 },
  spider_silk: { name: "Spider silk", single: "spider silk", icon: "🕸️", sellPrice: 30 },
  stolen_ring: { name: "Stolen rings", single: "stolen ring", icon: "💍", sellPrice: 60 },
  slime_goo: { name: "Slime goo", single: "blob of slime goo", icon: "🫧", tint: "hue-rotate(-90deg) saturate(2)", sellPrice: 2 },
  boar_tusk: { name: "Boar tusks", single: "boar tusk", icon: "🦷", tint: "sepia(.5)", sellPrice: 8 },
  wolf_fang: { name: "Wolf fangs", single: "wolf fang", icon: "🦷", sellPrice: 10 },
  bat_wing: { name: "Bat wings", single: "bat wing", icon: "🦇", sellPrice: 9 },
  // Alchemy: every potion uses up one (Alchemist Moss sells them).
  vial: { name: "Empty vials", single: "empty vial", icon: "🫙", sellPrice: 2 },
  venom_sac: { name: "Venom sacs", single: "venom sac", icon: "🧪", tint: "hue-rotate(60deg) saturate(3)", sellPrice: 35 },
  // Drink it for health (shared/combat.ts). A shop sells them.
  health_potion: { name: "Health potion", single: "health potion", icon: "🧪", tint: "hue-rotate(230deg) saturate(2.5)", sellPrice: 10 },
};

/** Things you dig up with Foraging (the roots and mushrooms you can cook are with the ingredients below). */
const WILD: Record<WildId, ItemDef> = {
  sage: { name: "Sage", single: "sprig of sage", icon: "🌿", sellPrice: 4 },
  red_cap: { name: "Red cap mushrooms", single: "red cap mushroom", icon: "🍄", tint: "saturate(2) hue-rotate(-10deg)", sellPrice: 4 },
  ginseng: { name: "Ginseng roots", single: "ginseng root", icon: "🫚", sellPrice: 6 },
  honey: { name: "Wild honeycomb", single: "piece of wild honeycomb", icon: "🍯", sellPrice: 7 },
  old_bone: { name: "Old bones", single: "old bone", icon: "🦴", sellPrice: 6 },
  blue_lotus: { name: "Blue lotus", single: "blue lotus", icon: "🪷", tint: "hue-rotate(200deg) saturate(1.5)", sellPrice: 9 },
  moonpetal: { name: "Moonpetal", single: "moonpetal", icon: "🌼", tint: "hue-rotate(180deg) brightness(1.3)", sellPrice: 14 },
};

/** Cooking ingredients that aren't fish, and Handicraft materials. */
const FOOD_AND_MATERIALS: Record<OtherIngredient | HandicraftMaterial, ItemDef> = {
  raw_chicken: { name: "Raw chicken", single: "raw chicken", icon: "🍗", tint: "saturate(.4) brightness(1.25)", sellPrice: 2 },
  raw_beef: { name: "Raw beef", single: "raw beef", icon: "🥩", sellPrice: 4 },
  raw_boar: { name: "Raw boar", single: "raw boar", icon: "🥩", tint: "hue-rotate(-15deg) brightness(.8)", sellPrice: 7 },
  wild_root: { name: "Wild roots", single: "wild root", icon: "🥕", tint: "sepia(.8) brightness(.8)", sellPrice: 2 },
  truffle: { name: "Truffles", single: "truffle", icon: "🟤", sellPrice: 30 },
  potato: { name: "Potatoes", single: "potato", icon: "🥔", sellPrice: 1 },
  carrot: { name: "Carrots", single: "carrot", icon: "🥕", sellPrice: 1 },
  mushroom: { name: "Mushrooms", single: "mushroom", icon: "🍄", sellPrice: 3 },
  worm: { name: "Worms", single: "worm", icon: "🪱", sellPrice: 1 },
  food_scraps: { name: "Food scraps", single: "food scraps", icon: "🦴", tint: "sepia(.6)", sellPrice: 1 },
  // Handicraft materials (shared/handicraft.ts): tanned at the rack, spun at the wheel.
  boar_hide: { name: "Boar hides", single: "boar hide", icon: "🐗", tint: "sepia(.8) brightness(.8)", sellPrice: 5 },
  leather: { name: "Leather", single: "piece of leather", icon: "🟫", sellPrice: 0, inputs: ["cowhide"] },
  thread: { name: "Thread", single: "spool of thread", icon: "🧵", sellPrice: 0, inputs: ["spider_silk"] },
  cloth: { name: "Cloth", single: "piece of cloth", icon: "🧶", tint: "hue-rotate(200deg)", sellPrice: 0, inputs: ["thread", "thread"] },
};

/** Spell books: read one to learn its spell (shared/spells.ts SPELL_BOOKS). */
export type SpellBookId = "book_haste" | "book_invisibility" | "book_frost_nova";
const BOOKS: Record<SpellBookId, ItemDef> = {
  book_haste: { name: "Spell book: Haste", single: "Haste spell book", icon: "📗", sellPrice: 150 },
  book_invisibility: { name: "Spell book: Invisibility", single: "Invisibility spell book", icon: "📘", tint: "grayscale(.6) brightness(1.2)", sellPrice: 500 },
  book_frost_nova: { name: "Spell book: Frost nova", single: "Frost nova spell book", icon: "📘", sellPrice: 350 },
};

/** Farming (shared/farming.ts): seeds from Farmer Odo, and what only the farm grows. */
const FARM: Record<FarmProduce, ItemDef> = {
  onion: { name: "Onions", single: "onion", icon: "🧅", sellPrice: 2 },
  wheat: { name: "Wheat", single: "sheaf of wheat", icon: "🌾", sellPrice: 2 },
};
const CROP_NAMES: Record<CropId, [string, string]> = {
  potato: ["Seed potatoes", "seed potato"], carrot: ["Carrot seeds", "carrot seed"], onion: ["Onion sets", "onion set"],
  wheat: ["Wheat seeds", "wheat seed"], ginseng: ["Ginseng seeds", "ginseng seed"], blue_lotus: ["Blue lotus seeds", "blue lotus seed"],
};
const SEEDS = Object.fromEntries(CROP_IDS.map((c) => [seedId(c), { name: CROP_NAMES[c][0], single: CROP_NAMES[c][1], icon: "🌱", tint: CROPS[c].tint, sellPrice: CROPS[c].seedPrice }])) as Record<SeedId, ItemDef>;

const TABLE = { ...BASE_ITEMS, ...LOOT, ...WILD, ...FOOD_AND_MATERIALS, ...BOOKS, ...FARM, ...SEEDS, ...STORY_ITEMS } as unknown as Record<ItemId, ItemDef>;

/**
 * Every item's definition. Meals ("meal_curry_oak_potato-trout") are built the
 * first time something asks for one, since every mix of ingredients is its own
 * item and there are far too many to list.
 */
export const ITEMS: Record<ItemId, ItemDef> = new Proxy(TABLE, {
  get(table, key) {
    if (typeof key !== "string" || key in table) return Reflect.get(table, key);
    const def = mealDef(key) ?? potionDef(key) ?? gemDef(key) ?? enchantedDef(key, table);
    if (def) table[key as ItemId] = def;
    return def;
  },
  has(table, key) {
    return key in table || (typeof key === "string" && (!!parseMeal(key) || !!parsePotion(key) || !!parseGem(key) || !!enchantedDef(key, table)));
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
/** Tools are drawn by the client: the head in its metal, the handle in its wood. */
function toolIcon(tool: ToolItemId) {
  const { type, metal, wood } = parseTool(tool);
  return `svg:tool/${type}/${metal ?? ""}/${wood ?? ""}`;
}
for (const tool of ALL_TOOL_IDS) {
  const { type, metal, wood } = parseTool(tool);
  if (!metal) {
    // Fishing rods: all wood, 2 logs.
    const name = `${WOODS[wood!].name} ${TOOL_TYPES[type].name.toLowerCase()}`;
    const logs = `${wood}_logs` as BaseItemId;
    ITEMS[tool] = { name, short: TOOL_TYPES[type].name, single: name.toLowerCase(), icon: toolIcon(tool), sellPrice: 0, inputs: Array<ItemId>(ROD_LOGS).fill(logs) };
    ITEMS[tool].sellPrice = Math.floor(exactBase(tool));
    continue;
  }
  const name = `${MATERIALS[metal].name} ${TOOL_TYPES[type].name.toLowerCase()}`;
  ITEMS[tool] = {
    name: wood ? `${name} (${WOODS[wood].name})` : name,
    short: TOOL_TYPES[type].name,
    single: wood ? `${name.toLowerCase()} (${WOODS[wood].name.toLowerCase()})` : name.toLowerCase(),
    icon: toolIcon(tool), sellPrice: 0,
    inputs: [...Array<ItemId>(headCount(type)).fill(barId(metal as Metal)), ...(wood ? [`${wood}_logs` as BaseItemId] : [])],
  };
  ITEMS[tool].sellPrice = Math.floor(exactBase(tool));
}
// Weapons: a head of a metal bar, plus a wooden handle (like tools). Bows and
// staffs also come carved from wood alone: their id says "stone", meaning no metal.
for (const type of WEAPON_TYPES) {
  for (const metal of ["stone", ...Object.keys(METALS)] as (keyof typeof METAL_DAMAGE)[]) {
    if (metal === "stone" && !isWooden(type)) continue; // no stone daggers, swords or slings any more
    for (const wood of Object.keys(WOODS) as (keyof typeof WOODS)[]) {
      const id = weaponId(type, metal, wood);
      const { metal: m } = parseWeapon(id);
      if (m === "stone") {
        // Carved from wood at Rook's workbench (Handicraft): "Oak bow", "Yew staff". A bow takes a string of thread too.
        const name = `${WOODS[wood].name} ${WEAPONS[type].name.toLowerCase()}`;
        ITEMS[id] = {
          name, single: name.toLowerCase(), icon: WEAPONS[type].icon, sellPrice: 0,
          inputs: [`${wood}_logs` as BaseItemId, `${wood}_logs` as BaseItemId, ...(type === "bow" ? ["thread" as ItemId] : [])],
        };
        ITEMS[id].sellPrice = Math.floor(exactBase(id));
        continue;
      }
      const name = `${MATERIALS[m].name} ${WEAPONS[type].name.toLowerCase()}`;
      ITEMS[id] = {
        name: `${name} (${WOODS[wood].name})`, single: `${name.toLowerCase()} (${WOODS[wood].name.toLowerCase()})`,
        icon: WEAPONS[type].icon, tint: MATERIALS[m].tint, sellPrice: 0,
        inputs: [barId(m as Metal), `${wood}_logs` as BaseItemId],
      };
      ITEMS[id].sellPrice = Math.floor(exactBase(id));
    }
  }
}
// Armor: all metal, 1 to 3 bars.
for (const type of ARMOR_TYPES) {
  for (const metal of Object.keys(METALS) as (keyof typeof METALS)[]) {
    const id = armorId(type, metal);
    const name = `${METALS[metal].name} ${ARMOR[type].name.toLowerCase()}`;
    ITEMS[id] = {
      name, single: name.toLowerCase(), icon: ARMOR[type].icon, tint: METALS[metal].tint, sellPrice: 0,
      inputs: Array<ItemId>(ARMOR[type].bars).fill(barId(metal)),
    };
    ITEMS[id].sellPrice = Math.floor(exactBase(id));
  }
  // Leather and cloth (Handicraft): as many pieces of leather or cloth as a metal one takes bars.
  for (const soft of ["leather", "cloth"] as const) {
    const name = SOFT_NAMES[soft][type];
    if (!name) continue;
    const id = armorId(type, soft);
    ITEMS[id] = {
      name, single: name.toLowerCase(), icon: ARMOR[type].icon, tint: soft === "leather" ? "sepia(1) saturate(1.5) brightness(.75)" : "hue-rotate(200deg) saturate(.7) brightness(1.2)", sellPrice: 0,
      inputs: Array<ItemId>(ARMOR[type].bars).fill(soft),
    };
    ITEMS[id].sellPrice = Math.floor(exactBase(id));
  }
}
// Arrows: a log, a tip and 2 feathers make 10. One arrow is worth a tenth of that.
for (const m of Object.keys(METALS) as Metal[]) {
  const id = arrowId(m);
  const inputs: ItemId[] = ["pine_logs", barId(m), "feather", "feather"];
  const name = `${MATERIALS[m].name} arrows`;
  ITEMS[id] = { name, single: `${MATERIALS[m].name.toLowerCase()} arrow`, icon: "🏹", tint: MATERIALS[m].tint, sellPrice: 0 };
  ITEMS[id].sellPrice = Math.max(1, Math.floor(inputs.reduce((sum, i) => sum + exactBase(i), 0) * CRAFT_MARKUP / ARROWS_PER_CRAFT));
}
// Leather, thread and cloth are worth what goes into them.
for (const id of ["leather", "thread", "cloth"] as ItemId[]) ITEMS[id].sellPrice = Math.floor(exactBase(id));
// Silver, gold, platinum and iridium bars (for jewelry).
for (const bar of JEWEL_BAR_IDS) {
  const b = JEWEL_BARS[bar];
  ITEMS[bar] = { name: b.name, single: b.name.toLowerCase(), icon: "🧈", tint: b.tint, sellPrice: 0, inputs: b.ores };
  ITEMS[bar].sellPrice = Math.floor(exactBase(bar));
}
// Bait (Handicraft).
for (const bait of BAIT_IDS) {
  const b = BAITS[bait];
  ITEMS[bait] = { name: b.name, single: b.single, icon: b.icon, tint: b.tint, sellPrice: 0, inputs: b.inputs };
  ITEMS[bait].sellPrice = Math.floor(exactBase(bait));
}

/** Gems, soul stones and jewelry (shared/jewelry.ts). Jewelry is worth its bars and gem, plus 25%. */
/** An enchanted (or once-enchanted) tool, weapon or armor piece: the plain one's def, renamed, and worth more. */
function enchantedDef(id: string, table: Record<string, ItemDef>): ItemDef | undefined {
  const plus = id.indexOf("+");
  if (plus < 0) return undefined;
  const base = table[id.slice(0, plus)];
  if (!base) return undefined;
  const list = enchantsOf(id);
  const parts = id.slice(plus + 1).split("+");
  if (parts.length !== list.length + (parts.includes("spent") ? 1 : 0) || parts.filter((x) => x === "spent").length > 1) return undefined;
  const power = list.reduce((a, e) => a + e.power, 0);
  return {
    ...base,
    name: enchantedName(base.name, id),
    short: base.short ? enchantedName(base.short, id) : undefined,
    single: enchantedName(base.single, id),
    sellPrice: Math.round(base.sellPrice * (1 + (list.length ? 0.5 + power / 20 : 0))),
  };
}

function gemDef(id: string): ItemDef | undefined {
  const base = gemItemDef(id);
  if (!base) return undefined;
  const g = parseGem(id)!;
  if (g.kind !== "jewel") return base;
  const inputs: ItemId[] = [...Array<ItemId>(JEWEL_TYPES[g.type].bars).fill(JEWEL_METALS[g.metal].bar), ...(g.gem ? [cutId(g.gem, g.size)] : [])];
  return { ...base, inputs, sellPrice: Math.floor(inputs.reduce((sum, i) => sum + ITEMS[i].sellPrice, 0) * CRAFT_MARKUP) };
}

/** A potion: "Health potion (sage)". Worth its ingredients and vial, plus 25%. */
function potionDef(id: string): ItemDef | undefined {
  const p = parsePotion(id);
  if (!p) return undefined;
  const d = POTIONS[p.type];
  const name = p.bonus ? `${d.name} (${BONUSES[p.bonus].name})` : d.name;
  const inputs = potionInputs(id as PotionId);
  return {
    name, single: name.charAt(0).toLowerCase() + name.slice(1), icon: d.icon, tint: d.tint, inputs,
    sellPrice: Math.floor(inputs.reduce((sum, i) => sum + TABLE[i].sellPrice, 0) * CRAFT_MARKUP),
  };
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

/**
 * There used to be a stone tier below bronze. Old saves turn stone tools,
 * stone weapons and stone arrows into bronze ones, keeping any enchantments
 * ("axe_stone_pine+swift.20" -> "axe_bronze_pine+swift.20"). Wooden bows and
 * staffs ("bow_stone_oak") stay as they are: their "stone" just means no metal.
 * Gives null if the item wasn't a stone one.
 */
export function legacyStone(item: string): string | null {
  const plus = item.indexOf("+");
  const base = plus < 0 ? item : item.slice(0, plus);
  const rest = plus < 0 ? "" : item.slice(plus);
  if (base === "arrows_stone") return `arrows_bronze${rest}`;
  const parts = base.split("_");
  if (parts[1] !== "stone") return null;
  const type = parts[0];
  const tool = type !== "rod" && (TOOL_TYPE_IDS as string[]).includes(type);
  const weapon = (WEAPON_TYPES as string[]).includes(type) && !isWooden(type as WeaponType);
  if (!tool && !weapon) return null;
  parts[1] = "bronze";
  return parts.join("_") + rest;
}
/** Bronze lasts longer than stone did, so a converted stone tool or weapon gets this many times its uses left. */
export const STONE_TO_BRONZE_USES = METALS.bronze.durability / STONE.durability;

/** Bag slots a player starts with. Each slot holds one stack (shared/bag.ts); weight is limited too (shared/weight.ts). */
export const INVENTORY_SIZE = 12;
