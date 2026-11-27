// People and work stations that stand around the world. They block the tile they're on.
// Click one to walk over and use it: trainers teach you their skill (and run a little shop),
// Old Maren talks to you, the furnace, anvil, stove and workbench open their crafting windows,
// the bounty board shows its jobs.
import { PLACES, WORLD_W } from "./world";

const at = (place: string) => {
  const p = PLACES[place];
  if (!p) throw new Error(`No place called ${place}`);
  return p;
};

export type NpcId = "maren" | "tam" | "holt" | "greta" | "brann" | "rook" | "kael" | "wren" | "moss" | "bryn" | "odo"
  | "furnace" | "anvil" | "stove" | "workbench" | "tanning_rack" | "spinning_wheel" | "board"
  | "archmage" | "altar" | "guildboard" | "repairer" | "alchemy_table" | "chest" | "chest_east" | "chest_forest" | "chest_farm" | "chest_inn"
  // The Emberhall (the Emberguard's temple) and its people.
  | "heart_shrine" | "aldric" | "celene" | "vale" | "oren" | "lisette" | "tomas" | "wynne" | "plinth" | "book_1" | "book_2" | "book_3" | "book_4"
  | "extinguished_1" | "extinguished_2" | "extinguished_3" | "extinguished_4"
  | "circle_vale" | "circle_aldemar" | "circle_crowe" | "circle_flint" | "circle_ivy" | "circle_merrow" | "circle_dunn" | "circle_reed"
  // The story (shared/story.ts): lanterns to light, the shrines out in Heartvale, and Rhys.
  | "lantern_1" | "lantern_2" | "lantern_3" | "lantern_4" | "lantern_5" | "lantern_6"
  | "round_1" | "round_2" | "round_3" | "round_4" | "round_5" | "round_6"
  | "west_shrine" | "thorn_shrine" | "rhys";

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
}

export const NPCS: NpcDef[] = [
  {
    // The guide (shared/quests.ts). Click her to talk; a ❗ shows when she has something for you.
    id: "maren", name: "Old Maren", kind: "person", ...at("tg.maren"), color: 0x2e86c1, badge: "🎣",
    greeting: "",
  },
  {
    id: "stove", name: "Stove", kind: "station", ...at("tg.stove"), color: 0x3a3a3a,
    greeting: "The stove is ready. Pick a dish, put ingredients in the pot, and pick a log to burn.",
  },
  {
    // Jobs that pay double (shared/bounties.ts). Opens in Captain Bryn's lessons.
    id: "board", name: "Bounty board", kind: "station", ...at("board"), color: 0x8b5a2b,
    greeting: "Folk pin jobs here. Bring the full amount and they pay double what a shop would.",
  },
  {
    id: "bryn", name: "Captain Bryn", kind: "person", ...at("bryn"), color: 0x7f8c8d, badge: "📋",
    greeting: "Folk round here need a hand with all sorts. Check the board.",
  },
  // ---- The General Store (just west of the square) ----
  {
    id: "tam", name: "Shopkeeper Tam", kind: "person", ...at("tam.tam"), color: 0x8e44ad, badge: "💰",
    greeting: "Welcome to the General Store! I'll buy anything you've got, and I sell rods, pots, food and potions.",
  },
  // ---- Trainer Row (east of the square, north of the road) ----
  {
    id: "holt", name: "Forester Holt", kind: "person", ...at("tg.holt"), color: 0x27ae60, badge: "🪓",
    greeting: "I buy logs and axes, and I sell bronze axes and logs.",
  },
  {
    id: "greta", name: "Miner Greta", kind: "person", ...at("tg.greta"), color: 0x95a5a6, badge: "⛏️",
    greeting: "I buy ore and pickaxes, and I sell bronze pickaxes and ore.",
  },
  {
    id: "brann", name: "Smith Brann", kind: "person", ...at("tg.brann"), color: 0xc0392b, badge: "🔨",
    greeting: "I buy bars, tools, weapons and armor, and I sell hammers, tongs and bars.",
  },
  {
    id: "furnace", name: "Furnace", kind: "station", ...at("tg.furnace"), color: 0x8b3a1a,
    greeting: "The furnace roars. Pick a bar to smelt.",
  },
  {
    id: "anvil", name: "Anvil", kind: "station", ...at("tg.anvil"), color: 0x555a60,
    greeting: "Pick a tool, weapon, armor or jewelry to make at the anvil, or cut a gem.",
  },
  // ---- Rook's workshop (just west of the square) ----
  {
    // Farming (shared/farming.ts): the farm east of the island, over the second bridge.
    id: "odo", name: "Farmer Odo", kind: "person", ...at("odo"), color: 0x7a8c3a, badge: "🌾",
    greeting: "Seeds for sale, and land if you want it. Everyone's crops grow while they sleep!",
  },
  {
    id: "rook", name: "Woodworker Rook", kind: "person", ...at("tg.rook"), color: 0xa0522d, badge: "🪚",
    greeting: "Bows, arrows, staffs, leather and cloth: it all starts at my bench. I buy hides, silk and what you make, and sell worms, feathers and thread.",
  },
  {
    // Handicraft (shared/handicraft.ts): fishing bait for now.
    id: "workbench", name: "Workbench", kind: "station", ...at("tg.workbench"), color: 0x8b5a2b,
    greeting: "A sturdy workbench. Pick something to make.",
  },
  {
    // Handicraft: hides into leather. It stands outside, by the east wall (tanning smells).
    id: "tanning_rack", name: "Tanning rack", kind: "station", ...at("tanning_rack"), color: 0x8b5a2b,
    greeting: "A frame for stretching and tanning hides into leather.",
  },
  {
    // Handicraft: spider silk into thread, thread into cloth.
    id: "spinning_wheel", name: "Spinning wheel", kind: "station", ...at("tg.spinning_wheel"), color: 0x8b5a2b,
    greeting: "Spin spider silk into thread, and weave thread into cloth.",
  },
  // ---- Kael's lodge (by the gate to the Dark Forest) ----
  {
    id: "kael", name: "Huntmaster Kael", kind: "person", ...at("tg.kael"), color: 0x6e2c00, badge: "🏹",
    greeting: "I buy weapons, armor and what monsters drop, and I sell starter weapons and potions.",
  },
  // ---- Wren's hut (by the lake, east of the Mages' Guild) ----
  {
    id: "wren", name: "Herbalist Wren", kind: "person", ...at("tg.wren"), color: 0x3d8b37, badge: "🌱",
    greeting: "I buy roots, herbs, mushrooms and shovels, and I sell bronze shovels.",
  },
  // ---- The Mages' Guild (shared/guild.ts): the hall south-west of town, past the lake ----
  {
    id: "archmage", name: "Archmage Rowan", kind: "person", ...at("tg.archmage"), color: 0x5b2c9f, badge: "🔮",
    greeting: "Welcome to the Mages' Guild. Rent space in our enchanted chest, or help the guild to rise in rank.",
  },
  {
    // Alchemy (shared/alchemy.ts): teaches it, sells empty vials, buys potions and herbs.
    id: "moss", name: "Alchemist Moss", kind: "person", ...at("tg.moss"), color: 0x1e8449, badge: "⚗️",
    greeting: "I buy potions, herbs and monster parts, and I sell empty vials.",
  },
  {
    id: "alchemy_table", name: "Alchemy table", kind: "station", ...at("tg.alchemy_table"), color: 0x4a3a6a,
    greeting: "Bottles, burners and a pestle. Pick two ingredients (and maybe a third) to brew.",
  },
  {
    // Enchanting (shared/enchanting.ts): refined emberstones add magic to staffs, armor and tools.
    id: "altar", name: "Enchanting altar", kind: "station", ...at("tg.altar"), color: 0x8e44ad,
    greeting: "Runes glow on the stone. Place an item and a refined emberstone to enchant it.",
  },
  {
    // Fixes worn and broken tools, weapons and armor (shared/repair.ts), for anyone.
    id: "repairer", name: "Repairer Oswin", kind: "person", ...at("guild.repairer"), color: 0x7d6608, badge: "🔧",
    greeting: "Worn out? Broken? I'll make it good as new, for a few coins.",
  },
  {
    // Magic jobs that raise your guild rank. Opens once Old Maren's tutorial is done.
    id: "guildboard", name: "Guild board", kind: "station", ...at("guild.guildboard"), color: 0x5b2c9f,
    greeting: "Magic jobs for the guild. Finish them to rise in rank.",
  },
  // Enchanted chests: all of them open the same storage, wherever you are.
  {
    id: "chest", name: "Enchanted chest", kind: "station", ...at("guild.chest"), color: 0x6a3fb5,
    greeting: "The chest hums with magic.",
  },
  {
    id: "chest_east", name: "Enchanted chest", kind: "station", ...at("chest_east"), color: 0x6a3fb5,
    greeting: "The chest hums with magic.",
  },
  {
    // The farm (shared/farming.ts): opens the same storage, once Farmer Odo has linked it for you.
    id: "chest_farm", name: "Farm chest", kind: "station", ...at("chest_farm"), color: 0x6a3fb5,
    greeting: "A sturdy chest, humming faintly. Farmer Odo can link it to your enchanted chest.",
  },
  {
    id: "chest_forest", name: "Enchanted chest", kind: "station", ...at("chest_forest"), color: 0x6a3fb5,
    greeting: "The chest hums with magic.",
  },
  {
    id: "chest_inn", name: "Enchanted chest", kind: "station", ...at("inn.chest_inn"), color: 0x6a3fb5,
    greeting: "The chest hums with magic.",
  },
  // ---- The Emberhall: the Emberguard's great white temple, at the heart of town ----
  {
    // Where new heroes wake (and come back to when they're knocked out).
    id: "heart_shrine", name: "The Heart Shrine", kind: "station", ...at("lighthall.heartShrine"), color: 0xfff2b0,
    greeting: "The Heart Shrine's flame burns tall and gold. Its warmth feels like being remembered.",
  },
  {
    id: "aldric", name: "High Keeper Aldric", kind: "person", ...at("lighthall.aldric"), color: 0xf4e3b0, badge: "🕯️",
    greeting: "Welcome, friend! The Emberheart made you for a reason. Everything here is yours to learn.",
  },
  {
    id: "celene", name: "Keeper Celene", kind: "person", ...at("lighthall.celene"), color: 0xfdfdfd, badge: "🤍",
    greeting: "Bless you. If you're hurt or lost, the shrine always brings you home.",
  },
  {
    id: "vale", name: "Enchanter Vale", kind: "person", ...at("lighthall.vale"), color: 0x9b7fd1, badge: "💠",
    greeting: "Hm? Oh, a new spark. How bright you are. Come back when you know a little magic.",
  },
  {
    id: "oren", name: "Keeper Oren", kind: "person", ...at("lighthall.oren"), color: 0xeadcb5, badge: "🏛️",
    greeting: "These are the Ember Circle, who raised the shrines. The Extinguished, our greatest heroes, stand out in the garden. Perhaps one day, you.",
  },
  {
    id: "lisette", name: "Keeper Lisette", kind: "person", ...at("lighthall.lisette"), color: 0xeadcb5, badge: "📚",
    greeting: "The library is open to every Emberborn. Mind the dust: the oldest books are older than the town.",
  },
  {
    id: "tomas", name: "Keeper Tomas", kind: "person", ...at("lighthall.tomas"), color: 0xeadcb5, badge: "🗝️",
    greeting: "Build your flame, Initiate. Every lesson, every day. A dim Emberborn is a wasted one.",
  },
  {
    id: "wynne", name: "Keeper Wynne", kind: "person", ...at("lighthall.wynne"), color: 0xeadcb5, badge: "🛏️",
    greeting: "The infirmary is here whenever you need it. Every patient gets a room of their own, and the Emberhall's doors never close to an Emberborn.",
  },
  {
    id: "plinth", name: "Empty plinth", kind: "station", ...at("lighthall.plinth"), color: 0xbdb6a0,
    greeting: "A plinth with no statue, among the Ember Circle. Someone has scratched the name off the stone, letter by letter. The first letter might have been a W.",
  },
  // Keeper Lisette's Four Books (version 0.21, shared/story.ts): four lecterns in the library, read in order.
  {
    id: "book_1", name: "Aldmera, the Old Kingdom", kind: "station", ...at("lighthall.book_1"), color: 0x8a5a2e,
    greeting: "A heavy history book on a lectern: Aldmera, the Old Kingdom.",
  },
  {
    id: "book_2", name: "The Emberfall", kind: "station", ...at("lighthall.book_2"), color: 0x8a2e1e,
    greeting: "A heavy history book on a lectern: The Emberfall.",
  },
  {
    id: "book_3", name: "On the Shrines", kind: "station", ...at("lighthall.book_3"), color: 0xc8a040,
    greeting: "A heavy history book on a lectern: On the Shrines.",
  },
  {
    id: "book_4", name: "The Lands of Embervale", kind: "station", ...at("lighthall.book_4"), color: 0x2e6a4a,
    greeting: "A heavy history book on a lectern: The Lands of Embervale.",
  },
  // The Extinguished: four statues in the Emberhall's garden, one at each corner. Their plaques:
  {
    id: "extinguished_1", name: "Halric the Dawnbringer", kind: "station", ...at("extinguished_1"), color: 0xf3efe4,
    greeting: "HALRIC THE DAWNBRINGER, ONE OF THE EXTINGUISHED. He held the Greyspine pass alone for three days, and fell eleven times. \"Again.\"",
  },
  {
    id: "extinguished_2", name: "Ida of the Saltmere", kind: "station", ...at("extinguished_2"), color: 0xf3efe4,
    greeting: "IDA OF THE SALTMERE, ONE OF THE EXTINGUISHED. She lit the coast's shrines from a fishing boat. Someone has left a seashell at her feet.",
  },
  {
    id: "extinguished_3", name: "Tilda Ashwalker", kind: "station", ...at("extinguished_3"), color: 0xf3efe4,
    greeting: "TILDA ASHWALKER, ONE OF THE EXTINGUISHED. She walked into the Withering and led two hundred people home.",
  },
  {
    id: "extinguished_4", name: "Orla the Kind", kind: "station", ...at("extinguished_4"), color: 0xf3efe4,
    greeting: "ORLA THE KIND, ONE OF THE EXTINGUISHED. A healer through the Grey Fever. The stone of her hands is worn smooth where people touch them.",
  },
  // The statues of the Ember Circle, in the great hall (Keeper Oren's tour, in shared/story.ts). Their plaques tell the
  // official story (see the wiki's Emberfall page): Wick is the traitor, Vale the saviour.
  {
    id: "circle_vale", name: "Archmage Vale", kind: "station", ...at("lighthall.circle_vale"), color: 0xf3efe4,
    greeting: "ARCHMAGE VALE, THE SAVIOUR. He raised the Heart Shrine in the year the king bought, and gave his life to win the Sundering War. \"The flame endures.\"",
  },
  {
    id: "circle_aldemar", name: "King Aldemar XVIII", kind: "station", ...at("lighthall.circle_aldemar"), color: 0xf3efe4,
    greeting: "KING ALDEMAR XVIII, THE LAST KING OF ALDMERA. He went down into the fire on the night of the Fall, and gave his life to hold it back. His stone crown has a crack across it.",
  },
  {
    id: "circle_crowe", name: "Crowe of the Circle", kind: "station", ...at("lighthall.circle_crowe"), color: 0xf3efe4,
    greeting: "CROWE. Raised the great shrine of the Thornwood. Warden Crowe keeps it now, and carries the name.",
  },
  {
    id: "circle_flint", name: "Flint of the Circle", kind: "station", ...at("lighthall.circle_flint"), color: 0xf3efe4,
    greeting: "FLINT. Raised the great shrine of the Greyspine Peaks. Warden Flint keeps it now, and carries the name.",
  },
  {
    id: "circle_ivy", name: "Ivy of the Circle", kind: "station", ...at("lighthall.circle_ivy"), color: 0xf3efe4,
    greeting: "IVY. Raised the great shrine of the Tangle. Warden Ivy keeps it now, and carries the name.",
  },
  {
    id: "circle_merrow", name: "Merrow of the Circle", kind: "station", ...at("lighthall.circle_merrow"), color: 0xf3efe4,
    greeting: "MERROW. Raised the great shrine of the Saltmere Coast. Warden Merrow keeps it now, and carries the name. Someone has left a seashell at the statue's feet.",
  },
  {
    id: "circle_dunn", name: "Dunn of the Circle", kind: "station", ...at("lighthall.circle_dunn"), color: 0xf3efe4,
    greeting: "DUNN. Raised the great shrine of the Ashen Barrens. Warden Dunn keeps it now, and carries the name.",
  },
  {
    id: "circle_reed", name: "Reed of the Circle", kind: "station", ...at("lighthall.circle_reed"), color: 0xf3efe4,
    greeting: "REED. Raised the great shrine of Blackfen. Warden Reed keeps it now, and carries the name.",
  },
  // ---- The story: lanterns, shrines and Rhys (shared/story.ts) ----
  ...([1, 2, 3, 4, 5, 6] as const).map((n): NpcDef => ({
    id: `lantern_${n}`, name: "Lantern", kind: "station", ...at(`lantern_${n}`), color: 0xffd36b,
    greeting: "A tall iron lantern on a post. The Emberguard light these every evening.",
  })),
  ...([1, 2, 3, 4, 5, 6] as const).map((n): NpcDef => ({
    id: `round_${n}`, name: "Shrine lantern", kind: "station", ...at(`round_${n}`), color: 0xffd36b,
    greeting: "A shrine lantern on a white stone post, with the Emberhall's flame carved on it.",
  })),
  {
    id: "west_shrine", name: "Westroad shrine", kind: "station", ...at("westShrine"), color: 0xbdb6a0,
    greeting: "A roadside shrine. The Ashbound have smashed it to rubble.",
  },
  {
    id: "thorn_shrine", name: "Thornwood shrine", kind: "station", ...at("thornShrine"), color: 0xbdb6a0,
    greeting: "Shrine stones laid out in a ring, waiting for the flame.",
  },
  {
    id: "rhys", name: "Rhys", kind: "person", ...at("rhys"), color: 0xe67e22, badge: "🔥",
    greeting: "Ha! Still at it? I'm going to have a statue in the Emberhall before you do, you know.",
  },
];

/** Every enchanted chest opens the same storage. */
export const CHEST_IDS: NpcId[] = ["chest", "chest_east", "chest_forest", "chest_farm", "chest_inn"];
export const isChest = (id: string) => (CHEST_IDS as string[]).includes(id);

// Looked up on every step of every path, so keep it quick: one map from tile to NPC.
const BY_TILE = new Map<number, NpcDef>(NPCS.map((n) => [n.y * WORLD_W + n.x, n]));
const BY_ID = new Map<string, NpcDef>(NPCS.map((n) => [n.id, n]));
export const npcAt = (x: number, y: number) => (x < 0 || x >= WORLD_W ? undefined : BY_TILE.get(y * WORLD_W + x));
export const npcById = (id: string) => BY_ID.get(id);
