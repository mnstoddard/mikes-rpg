// Shops: the General Store (Shopkeeper Tam) buys anything; each trainer buys
// what their own skill makes and sells the basics for it. Prices are the same
// everywhere (shared/crafting.ts sellPriceFor / buyPriceFor), with Charisma
// on top (shared/stats.ts).
import { ITEMS, ItemId } from "./items";
import { FORAGE_ITEMS, RESOURCES, RESOURCE_FOR_ITEM } from "./foraging";
import { BAR_IDS, isTool, parseTool, toolId } from "./tools";
import { isArmor, isGear, isWeapon, weaponId } from "./gear";
import { SHOP_STEW } from "./cooking";
import { isBait } from "./handicraft";
import { ALCHEMY_INGREDIENTS, VIAL, isPotion } from "./alchemy";

export type ShopId = "tam" | "holt" | "greta" | "brann" | "rook" | "kael" | "wren" | "moss";

export interface ShopDef {
  /** What the window's title says. */
  title: string;
  /** Endless stock of these. */
  stock: ItemId[];
  /** What they'll buy from you. */
  buys: (item: ItemId) => boolean;
  /** Says what they buy, for the Sell tab ("logs and axes"). */
  buysText: string;
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
    stock: [toolId("rod", "stone", "pine"), toolId("pot", "stone", "pine"), SHOP_STEW, "health_potion", "potato", "carrot", "worm"],
    buys: () => true,
    buysText: "anything",
  },
  holt: {
    title: "🪓 Forester Holt",
    stock: [toolId("axe", "stone", "pine"), ...resourcesOf("woodcutting")],
    buys: (i) => gathered(i, "woodcutting") || (isTool(i) && parseTool(i).type === "axe"),
    buysText: "logs and axes",
  },
  greta: {
    title: "⛏️ Miner Greta",
    stock: [toolId("pickaxe", "stone", "pine"), ...resourcesOf("mining")],
    buys: (i) => gathered(i, "mining") || (isTool(i) && parseTool(i).type === "pickaxe"),
    buysText: "stone, ore and pickaxes",
  },
  brann: {
    title: "🔨 Smith Brann",
    stock: [toolId("hammer", "stone", "pine"), toolId("tongs", "stone", "pine"), ...BAR_IDS],
    buys: (i) => (BAR_IDS as string[]).includes(i) || isTool(i) || isGear(i),
    buysText: "bars, tools, weapons and armor",
  },
  rook: {
    title: "🪚 Woodworker Rook",
    stock: ["worm"],
    buys: (i) => isBait(i) || i === "worm" || i === "food_scraps" || i === "feather" || i === "cowhide" || i === "wolf_pelt" || i === "spider_silk",
    buysText: "bait, worms, scraps, feathers, hides and silk",
  },
  kael: {
    title: "🏹 Huntmaster Kael",
    stock: [weaponId("dagger", "stone", "pine"), weaponId("sling", "stone", "pine"), weaponId("staff", "stone", "pine"), "health_potion"],
    buys: (i) => isWeapon(i) || isArmor(i) || LOOT.includes(i) || i === "health_potion",
    buysText: "weapons, armor and monster drops",
  },
  wren: {
    title: "🌱 Herbalist Wren",
    stock: [toolId("shovel", "stone", "pine"), "wild_root"],
    buys: (i) => FORAGE_ITEMS.has(i) || (isTool(i) && parseTool(i).type === "shovel"),
    buysText: "roots, herbs, mushrooms, worms and shovels",
  },
  moss: {
    title: "⚗️ Alchemist Moss",
    // Moss keeps a few of Ysolde's spell books for sale too.
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
