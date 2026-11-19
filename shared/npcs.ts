// People who stand around the world. They block the tile they stand on.
export type NpcId = "merchant";

export interface NpcDef {
  id: NpcId;
  name: string;
  x: number;
  y: number;
  color: number;
  greeting: string;
}

export const NPCS: NpcDef[] = [
  {
    id: "merchant", name: "Merchant", x: 16, y: 10, color: 0x8e44ad,
    greeting: "Logs! I'll buy all the logs you've got, 1 bronze coin apiece.",
  },
];

export const npcAt = (x: number, y: number) => NPCS.find((n) => n.x === x && n.y === y);
export const npcById = (id: string) => NPCS.find((n) => n.id === id);
