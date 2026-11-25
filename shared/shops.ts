// Shops: the General Store (Shopkeeper Tam) buys anything; each trainer buys
// what their own skill makes and sells the basics for it. Prices are the same
// everywhere (shared/crafting.ts sellPriceFor / buyPriceFor), with Charisma
// on top (shared/stats.ts).
import { ITEMS, ItemId } from "./items";
import { FORAGE_ITEMS, RESOURCES, RESOURCE_FOR_ITEM } from "./foraging";
import { BAR_IDS, isTool, parseTool, toolId } from "./tools";
import { armorId, isArmor, isGear, isSoftArmor, isWeapon, isWooden, parseArmor, parseWeapon, weaponId } from "./gear";
import { SHOP_STEW } from "./cooking";
import { isArrow, isBait } from "./handicraft";
import { SEED_IDS, isSeed } from "./farming";
import { ALCHEMY_INGREDIENTS, VIAL, isPotion } from "./alchemy";

export type ShopId = "tam" | "holt" | "greta" | "brann" | "rook" | "kael" | "wren" | "moss" | "odo" | "bryn";

export interface ShopDef {
  /** What the window's title says. */
  title: string;
  /** Endless stock of these. */
  stock: ItemId[];
  /** What they'll buy from you. */
  buys: (item: ItemId) => boolean;
  /** Says what they buy, for the Sell tab ("logs and axes"). */
  buysText: string;
  /** Rarer stock: shown from the start, sold once your Trading level is high enough. */
  rare?: { item: ItemId; trading: number }[];
  /** Captain Bryn: sold once you hold this Renown rank (shared/renown.ts). */
  renown?: { item: ItemId; rank: number }[];
}

const gathered = (item: ItemId, skill: string) => {
  const r = RESOURCE_FOR_ITEM[item];
  return !!r && RESOURCES[r].skill === skill;
};
const resourcesOf = (skill: string) => (Object.keys(ITEMS) as ItemId[]).filter((i) => gathered(i, skill));
const LOOT: ItemId[] = [
  "feather", "rat_tail", "cowhide", "wolf_pelt", "goblin_charm", "spider_silk", "stolen_ring",
  "slime_goo", "boar_tusk", "wolf_fang", "bat_wing", "venom_sac", "raw_boar",
];

export const SHOPS: Record<ShopId, ShopDef> = {
  tam: {
    title: "💰 General Store",
    stock: [toolId("rod", "bronze", "pine"), toolId("pot", "bronze", "pine"), SHOP_STEW, "health_potion", "potato", "carrot", "worm"],
    buys: () => true,
    buysText: "anything",
  },
  holt: {
    title: "🪓 Forester Holt",
    stock: [toolId("axe", "bronze", "pine"), ...resourcesOf("woodcutting")],
    buys: (i) => gathered(i, "woodcutting") || (isTool(i) && parseTool(i).type === "axe"),
    buysText: "logs and axes",
    rare: [{ item: toolId("axe", "iron", "oak"), trading: 10 }, { item: toolId("axe", "steel", "maple"), trading: 25 }, { item: toolId("axe", "mithril", "yew"), trading: 40 }],
  },
  greta: {
    title: "⛏️ Miner Greta",
    stock: [toolId("pickaxe", "bronze", "pine"), ...resourcesOf("mining")],
    buys: (i) => gathered(i, "mining") || (isTool(i) && parseTool(i).type === "pickaxe"),
    buysText: "ore and pickaxes",
    rare: [{ item: toolId("pickaxe", "iron", "oak"), trading: 10 }, { item: toolId("pickaxe", "steel", "maple"), trading: 25 }, { item: toolId("pickaxe", "mithril", "yew"), trading: 40 }],
  },
  brann: {
    title: "🔨 Smith Brann",
    stock: [toolId("hammer", "bronze", "pine"), toolId("tongs", "bronze", "pine"), ...BAR_IDS],
    buys: (i) => (BAR_IDS as string[]).includes(i) || isTool(i) || isGear(i),
    buysText: "bars, tools, weapons and armor",
    rare: [{ item: "silver_bar", trading: 8 }, { item: weaponId("sword", "iron", "oak"), trading: 12 }, { item: "gold_bar", trading: 20 }, { item: armorId("platebody", "steel"), trading: 30 }],
  },
  rook: {
    title: "🪚 Woodworker Rook",
    stock: ["worm", "feather", "thread"],
    buys: (i) => isBait(i) || i === "worm" || i === "food_scraps" || i === "feather" || i === "cowhide" || i === "wolf_pelt" || i === "spider_silk"
      || i === "boar_hide" || i === "leather" || i === "thread" || i === "cloth" || isArrow(i) || (isWeapon(i) && isWooden(parseWeapon(i).type)) || (isArmor(i) && isSoftArmor(parseArmor(i).metal)),
    buysText: "bait, worms, feathers, hides, silk, leather, cloth, arrows, bows, staffs and leather or cloth armor",
    rare: [{ item: "leather", trading: 8 }, { item: "arrows_iron", trading: 12 }, { item: weaponId("bow", "stone", "maple"), trading: 25 }, { item: weaponId("staff", "stone", "yew"), trading: 35 }],
  },
  kael: {
    title: "🏹 Huntmaster Kael",
    stock: [weaponId("dagger", "bronze", "pine"), weaponId("sling", "bronze", "pine"), weaponId("staff", "stone", "pine"), weaponId("bow", "stone", "pine"), "arrows_bronze", "health_potion"],
    buys: (i) => isWeapon(i) || isArmor(i) || LOOT.includes(i) || i === "health_potion",
    buysText: "weapons, armor and monster drops",
    rare: [{ item: weaponId("sword", "bronze", "oak"), trading: 5 }, { item: "arrows_bronze", trading: 10 }, { item: armorId("platelegs", "iron"), trading: 18 }],
  },
  bryn: {
    // Captain Bryn: special things for those with Renown (shared/renown.ts ranks).
    title: "⚔️ Captain Bryn",
    stock: ["health_potion"],
    buys: (i) => LOOT.includes(i),
    buysText: "monster drops",
    renown: [
      { item: armorId("shield", "steel"), rank: 1 },
      { item: weaponId("spear", "steel", "yew"), rank: 2 },
      { item: "book_invisibility", rank: 2 },
      { item: weaponId("greatsword", "mithril", "elderwood"), rank: 3 },
      { item: armorId("platebody", "mithril"), rank: 3 },
    ],
  },
  odo: {
    title: "🌾 Farmer Odo",
    stock: SEED_IDS,
    buys: (i) => isSeed(i) || i === "potato" || i === "carrot" || i === "onion" || i === "wheat",
    buysText: "seeds, potatoes, carrots, onions and wheat",
  },
  wren: {
    title: "🌱 Herbalist Wren",
    stock: [toolId("shovel", "bronze", "pine"), "wild_root"],
    buys: (i) => FORAGE_ITEMS.has(i) || (isTool(i) && parseTool(i).type === "shovel"),
    buysText: "roots, herbs, mushrooms, worms and shovels",
    rare: [{ item: "sage", trading: 6 }, { item: toolId("shovel", "iron", "oak"), trading: 12 }, { item: "ginseng", trading: 20 }, { item: "truffle", trading: 35 }],
  },
  moss: {
    title: "⚗️ Alchemist Moss",
    // Moss keeps a few of Rowan's spell books for sale too.
    stock: [VIAL, "book_haste", "book_frost_nova"],
    buys: (i) => isPotion(i) || i === VIAL || i.startsWith("book_") || i === "health_potion" || ALCHEMY_INGREDIENTS.has(i),
    buysText: "potions, vials, herbs, monster parts and spell books",
  },
};

export const SHOP_IDS = Object.keys(SHOPS) as ShopId[];
export const isShop = (id: string): id is ShopId => Object.hasOwn(SHOPS, id);
/** Everything any shop sells. */
export const ALL_STOCK: ItemId[] = [...new Set(SHOP_IDS.flatMap((s) => SHOPS[s].stock))];
/** Who sells this, for the item card ("Forester Holt"). */
export const sellersOf = (item: ItemId): ShopId[] => SHOP_IDS.filter((s) => SHOPS[s].stock.includes(item));

/** Can you buy this here: plain stock, rare stock your Trading level unlocks, or Bryn's Renown stock? */
export function canBuyHere(shop: ShopDef, item: ItemId, trading: number, renownRank: number): boolean {
  if (shop.stock.includes(item)) return true;
  if (shop.rare?.some((r) => r.item === item && trading >= r.trading)) return true;
  return !!shop.renown?.some((r) => r.item === item && renownRank >= r.rank);
}
