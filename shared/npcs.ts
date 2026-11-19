// People and work stations that stand around the world. They block the tile they're on.
// Click one to walk over and use it: Old Maren talks to you, the Merchant opens his shop, the furnace,
// anvil and stove open their crafting windows.
export type NpcId = "maren" | "merchant" | "furnace" | "anvil" | "stove";

export interface NpcDef {
  id: NpcId;
  name: string;
  /** "person" you talk to, or a "station" you use. */
  kind: "person" | "station";
  x: number;
  y: number;
  color: number;
  greeting: string;
  /** People: a little emoji they carry (the Merchant's money bag, Maren's rod). */
  badge?: string;
}

export const NPCS: NpcDef[] = [
  {
    // The tutorial guide (shared/quests.ts). Click her to talk; a ❗ shows when she has something for you.
    id: "maren", name: "Old Maren", kind: "person", x: 14, y: 12, color: 0x2e86c1, badge: "🎣",
    greeting: "",
  },
  {
    id: "merchant", name: "Merchant", kind: "person", x: 16, y: 10, color: 0x8e44ad,
    badge: "💰",
    greeting: "I'll buy anything you've got, and I sell tools, starter weapons, health potions, fish stew, bars, logs and ore. Click your items to sell, or tap Buy.",
  },
  {
    id: "furnace", name: "Furnace", kind: "station", x: 14, y: 10, color: 0x8b3a1a,
    greeting: "The furnace roars. Pick a bar to smelt.",
  },
  {
    id: "anvil", name: "Anvil", kind: "station", x: 18, y: 10, color: 0x555a60,
    greeting: "Pick a tool, weapon or piece of armor to make at the anvil.",
  },
  {
    id: "stove", name: "Stove", kind: "station", x: 12, y: 10, color: 0x3a3a3a,
    greeting: "The stove is ready. Pick a fish, how many, and a log to burn.",
  },
];

export const npcAt = (x: number, y: number) => NPCS.find((n) => n.x === x && n.y === y);
export const npcById = (id: string) => NPCS.find((n) => n.id === id);
