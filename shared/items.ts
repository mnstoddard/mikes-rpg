// Item definitions shared by server and client.
export type ItemId = "logs" | "fish";

export interface ItemDef {
  name: string;
  /** Name for just one, e.g. "log". */
  single: string;
  icon: string; // emoji for now, swapped for pixel art later
  /** What the Merchant pays for one, in bronze coins. */
  sellPrice: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  logs: { name: "Logs", single: "log", icon: "🪵", sellPrice: 1 },
  fish: { name: "Fish", single: "fish", icon: "🐟", sellPrice: 3 },
};

export const INVENTORY_SIZE = 28;
