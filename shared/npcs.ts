// People and work stations that stand around the world. They block the tile they're on.
// Click one to walk over and use it: trainers teach you their skill (and run a little shop),
// Old Maren talks to you, the furnace, anvil, stove and workbench open their crafting windows,
// the bounty board shows its jobs.
export type NpcId = "maren" | "tam" | "holt" | "greta" | "brann" | "rook" | "kael" | "wren" | "moss" | "bryn"
  | "furnace" | "anvil" | "stove" | "workbench" | "board"
  | "archmage" | "guildboard" | "repairer" | "alchemy_table" | "chest" | "chest_east" | "chest_forest";

export interface NpcDef {
  id: NpcId;
  name: string;
  /** "person" you talk to, or a "station" you use. */
  kind: "person" | "station";
  x: number;
  y: number;
  color: number;
  greeting: string;
  /** People: a little emoji they carry (Tam's money bag, Maren's rod). */
  badge?: string;
  /** A name over their building's door: where to draw it (the door tile) and what it says. */
  sign?: { x: number; y: number; text: string };
}

export const NPCS: NpcDef[] = [
  {
    // The guide (shared/quests.ts). Click her to talk; a ❗ shows when she has something for you.
    id: "maren", name: "Old Maren", kind: "person", x: 29, y: 13, color: 0x2e86c1, badge: "🎣",
    greeting: "",
  },
  {
    id: "stove", name: "Stove", kind: "station", x: 31, y: 13, color: 0x3a3a3a,
    greeting: "The stove is ready. Pick a dish, put ingredients in the pot, and pick a log to burn.",
  },
  {
    // Jobs that pay double (shared/bounties.ts). Opens in Captain Bryn's lessons.
    id: "board", name: "Bounty board", kind: "station", x: 28, y: 15, color: 0x8b5a2b,
    greeting: "Folk pin jobs here. Bring the full amount and they pay double what a shop would.",
  },
  {
    id: "bryn", name: "Captain Bryn", kind: "person", x: 31, y: 15, color: 0x7f8c8d, badge: "📋",
    greeting: "Folk round here need a hand with all sorts. Check the board.",
  },
  // ---- The General Store (in the square) ----
  {
    id: "tam", name: "Shopkeeper Tam", kind: "person", x: 15, y: 14, color: 0x8e44ad, badge: "💰",
    greeting: "Welcome to the General Store! I'll buy anything you've got, and I sell rods, pots, food and potions.",
    sign: { x: 15, y: 12, text: "💰 General Store" },
  },
  // ---- Trainer Row (north of the road) ----
  {
    id: "holt", name: "Forester Holt", kind: "person", x: 15, y: 7, color: 0x27ae60, badge: "🪓",
    greeting: "I buy logs and axes, and I sell stone axes and logs.",
    sign: { x: 15, y: 9, text: "🪓 Forester Holt" },
  },
  {
    id: "greta", name: "Miner Greta", kind: "person", x: 23, y: 7, color: 0x95a5a6, badge: "⛏️",
    greeting: "I buy ore, stone and pickaxes, and I sell stone pickaxes and ore.",
    sign: { x: 23, y: 9, text: "⛏️ Miner Greta" },
  },
  {
    id: "brann", name: "Smith Brann", kind: "person", x: 30, y: 7, color: 0xc0392b, badge: "🔨",
    greeting: "I buy bars, tools, weapons and armor, and I sell hammers, tongs and bars.",
    sign: { x: 30, y: 9, text: "🔨 Smith Brann" },
  },
  {
    id: "furnace", name: "Furnace", kind: "station", x: 29, y: 7, color: 0x8b3a1a,
    greeting: "The furnace roars. Pick a bar to smelt.",
  },
  {
    id: "anvil", name: "Anvil", kind: "station", x: 31, y: 7, color: 0x555a60,
    greeting: "Pick a tool, weapon or piece of armor to make at the anvil.",
  },
  // ---- Rook's workshop (in the square) ----
  {
    id: "rook", name: "Woodworker Rook", kind: "person", x: 22, y: 14, color: 0xa0522d, badge: "🪚",
    greeting: "I buy bait, worms, feathers and hides, and I sell worms.",
    sign: { x: 23, y: 12, text: "🪚 Woodworker Rook" },
  },
  {
    // Handicraft (shared/handicraft.ts): fishing bait for now.
    id: "workbench", name: "Workbench", kind: "station", x: 24, y: 14, color: 0x8b5a2b,
    greeting: "A sturdy workbench. Pick something to make.",
  },
  // ---- Kael's lodge (by the gate to the Dark Forest) ----
  {
    id: "kael", name: "Huntmaster Kael", kind: "person", x: 22, y: 18, color: 0x6e2c00, badge: "🏹",
    greeting: "I buy weapons, armor and what monsters drop, and I sell starter weapons and potions.",
    sign: { x: 24, y: 19, text: "🏹 Huntmaster Kael" },
  },
  // ---- Wren's hut (by the lake, east of the Mages' Guild) ----
  {
    id: "wren", name: "Herbalist Wren", kind: "person", x: 14, y: 18, color: 0x3d8b37, badge: "🌱",
    greeting: "I buy roots, herbs, mushrooms and shovels, and I sell stone shovels.",
    sign: { x: 15, y: 17, text: "🌱 Herbalist Wren" },
  },
  // ---- The Mages' Guild (shared/guild.ts): the hall south-west of town, by the coast ----
  {
    id: "archmage", name: "Archmage Ysolde", kind: "person", x: 8, y: 19, color: 0x5b2c9f, badge: "🔮",
    greeting: "Welcome to the Mages' Guild. Rent space in our enchanted chest, or help the guild to rise in rank.",
  },
  {
    // Alchemy (shared/alchemy.ts): teaches it, sells empty vials, buys potions and herbs.
    id: "moss", name: "Alchemist Moss", kind: "person", x: 6, y: 17, color: 0x1e8449, badge: "⚗️",
    greeting: "I buy potions, herbs and monster parts, and I sell empty vials.",
  },
  {
    id: "alchemy_table", name: "Alchemy table", kind: "station", x: 10, y: 17, color: 0x4a3a6a,
    greeting: "Bottles, burners and a pestle. Pick two ingredients (and maybe a third) to brew.",
  },
  {
    // Fixes worn and broken tools, weapons and armor (shared/repair.ts), for anyone.
    id: "repairer", name: "Repairer Oswin", kind: "person", x: 10, y: 18, color: 0x7d6608, badge: "🔧",
    greeting: "Worn out? Broken? I'll make it good as new, for a few coins.",
  },
  {
    // Magic jobs that raise your guild rank. Opens once Old Maren's tutorial is done.
    id: "guildboard", name: "Guild board", kind: "station", x: 10, y: 19, color: 0x5b2c9f,
    greeting: "Magic jobs for the guild. Finish them to rise in rank.",
  },
  // Enchanted chests: all of them open the same storage, wherever you are.
  {
    id: "chest", name: "Enchanted chest", kind: "station", x: 6, y: 19, color: 0x6a3fb5,
    greeting: "The chest hums with magic.",
  },
  {
    id: "chest_east", name: "Enchanted chest", kind: "station", x: 47, y: 10, color: 0x6a3fb5,
    greeting: "The chest hums with magic.",
  },
  {
    id: "chest_forest", name: "Enchanted chest", kind: "station", x: 28, y: 22, color: 0x6a3fb5,
    greeting: "The chest hums with magic.",
  },
];

/** Every enchanted chest opens the same storage. */
export const CHEST_IDS: NpcId[] = ["chest", "chest_east", "chest_forest"];
export const isChest = (id: string) => (CHEST_IDS as string[]).includes(id);

export const npcAt = (x: number, y: number) => NPCS.find((n) => n.x === x && n.y === y);
export const npcById = (id: string) => NPCS.find((n) => n.id === id);
