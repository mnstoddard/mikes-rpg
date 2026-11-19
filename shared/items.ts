// Item definitions shared by server and client.
export type ItemId =
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
  /** What the Merchant pays for one, in bronze coins. */
  sellPrice: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
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

/**
 * Items from before each skill had several types. Old saves turn them into
 * the starting type, which sells for the same price, so nobody loses money.
 */
export const LEGACY_ITEMS: Record<string, ItemId> = { logs: "pine_logs", ore: "stone", fish: "minnow" };

export const INVENTORY_SIZE = 28;
