// Item definitions shared by server and client.
export type ItemId = "logs";

export interface ItemDef {
  name: string;
  icon: string; // emoji for now, swapped for pixel art later
}

export const ITEMS: Record<ItemId, ItemDef> = {
  logs: { name: "Logs", icon: "🪵" },
};

export const INVENTORY_SIZE = 28;
