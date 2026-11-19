// People and work stations that stand around the world. They block the tile they're on.
// Click one to walk over and use it: the Merchant opens his shop, the furnace
// and anvil open their crafting windows.
export type NpcId = "merchant" | "furnace" | "anvil";

export interface NpcDef {
  id: NpcId;
  name: string;
  /** "person" you talk to, or a "station" you use. */
  kind: "person" | "station";
  x: number;
  y: number;
  color: number;
  greeting: string;
}

export const NPCS: NpcDef[] = [
  {
    id: "merchant", name: "Merchant", kind: "person", x: 16, y: 10, color: 0x8e44ad,
    greeting: "I'll buy anything you've got, and I sell tools, bars, logs and ore. Click your items to sell, or tap Buy.",
  },
  {
    id: "furnace", name: "Furnace", kind: "station", x: 14, y: 10, color: 0x8b3a1a,
    greeting: "The furnace roars. Pick a bar to smelt.",
  },
  {
    id: "anvil", name: "Anvil", kind: "station", x: 18, y: 10, color: 0x555a60,
    greeting: "Pick a tool to make at the anvil.",
  },
];

export const npcAt = (x: number, y: number) => NPCS.find((n) => n.x === x && n.y === y);
export const npcById = (id: string) => NPCS.find((n) => n.id === id);
