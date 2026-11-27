// The item library: every tool, material, find, loot drop, potion, gem,
// quest item and workshop prop for the 3D game, in one list.
//
// (Trees, rocks and ore, weapons, armor, and fish and food have their own
// libraries.)
//
// How to use one in the game:
//   import { createItem } from "./items";
//   const axe = createItem("axe", { choice: [2, 1] });  // Iron axe (Oak)
//   scene.add(axe.object);
//   // every frame:  axe.update(dt, time);
//   // its action:   axe.act();   (swing, open, light... or drop)
//
// "status" is Mike's review: only "approved" items should go into the game.
// The Items Gallery page is where Mike looks at each one and approves it.
import type { ItemId } from "../../../shared/items";
import { WOOD_IDS, WOODS, METALS, toolId } from "../../../shared/tools";
import type { ToolType } from "../../../shared/tools";
import { POTIONS, potionId } from "../../../shared/alchemy";
import { GEMS } from "../../../shared/jewelry";
import { STORY_ITEMS } from "../../../shared/story";
import { CROP_IDS, seedId } from "../../../shared/farming";
import { ItemShape, Item, Rng, makeItem, makeRng } from "./kit";
import { TOOL_METALS, buildTool } from "./tools";
import { buildLogs, buildBars, buildLeather, buildThread, buildCloth } from "./materials";
import { ForageKind, buildForage, buildSeeds } from "./forage";
import { LootKind, buildLoot } from "./loot";
import { POTION_LIST, buildPotion } from "./potions";
import { GEM_LIST, JEWEL_METAL_LIST, GemKind, buildGem } from "./gems";
import { QuestKind, SPELL_BOOKS, buildQuest } from "./quest";
import { PropKind, buildProp } from "./props";

export type { Item, HeldMove } from "./kit";
export { METAL_LOOK, WOOD_LOOK } from "./kit";

/** Mike's review of an item. */
export type ReviewStatus = "waiting" | "approved" | "changes";

export type ItemGroup = "tools" | "materials" | "gathered" | "loot" | "alchemy" | "gems" | "quest" | "props";

export const ITEM_GROUPS: Record<ItemGroup, { name: string; about: string }> = {
  tools: { name: "Tools", about: "Gathering and crafting tools, in every metal (bronze to mithril) and handle wood." },
  materials: { name: "Materials", about: "Logs, bars, leather, thread and cloth: what you craft with." },
  gathered: { name: "Foraging finds", about: "Herbs, mushrooms, roots and more from dig patches, and seeds for the farm." },
  loot: { name: "Monster loot", about: "What monsters drop, and fishing bait." },
  alchemy: { name: "Potions", about: "Alchemy potions and the empty vial." },
  gems: { name: "Gems & jewelry", about: "Rough and cut gems, emberstones, rings and amulets." },
  quest: { name: "Quest items", about: "Story items and spell books." },
  props: { name: "Workshop props", about: "Stations you use in the world: chest, anvil, furnace and more." },
};
export const GROUP_IDS = Object.keys(ITEM_GROUPS) as ItemGroup[];

/** A row of choices in the gallery, e.g. "Head" with Stone, Bronze, Iron... */
export interface ItemOption {
  label: string;
  options: string[];
}

export interface ItemType {
  id: string;
  group: ItemGroup;
  name: string;
  about: string;
  /** Choices, e.g. head material and handle wood. Most items have one or none. */
  options: ItemOption[];
  /** "small" sits on a display table; "held" is a tool you can hold; "big" stands on the ground. */
  size: "small" | "held" | "big";
  /** The game item this choice makes (for its price and name), if there is one. */
  gameItem?: (choice: number[]) => ItemId | string | undefined;
  /** Mike's review. Updated from the Items Gallery. */
  status: ReviewStatus;
  build: (rng: Rng, choice: number[]) => ItemShape;
}

/** Tool heads start at bronze (level 1); there is no stone tier. */
const METAL_NAMES = TOOL_METALS.map((m) => METALS[m].name);
const WOOD_NAMES = WOOD_IDS.map((w) => WOODS[w].name);
const BAR_METALS = ["bronze", "iron", "steel", "mithril", "silver", "gold", "platinum", "iridium"] as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const TOOL_ABOUT: Record<ToolType, string> = {
  axe: "Chops trees faster. A wedge blade on a wooden handle.",
  pickaxe: "Mines rocks faster. A curved pick with one sharp point and one chisel end.",
  shovel: "Digs up foraging finds faster. A spade with a D-grip.",
  rod: "Catches fish faster. All wood (2 logs), with a reel and a red-and-white float.",
  hammer: "Raises your Smithing success at the anvil. Flat face and a wedge.",
  tongs: "Raises your Smelting success at the furnace. No handle wood: all metal.",
  pot: "Raises your Cooking success. A three-legged pot with soup bubbling in it.",
};

function toolType(type: ToolType, name: string): ItemType {
  const handled = type !== "tongs" && type !== "pot" && type !== "rod";
  const options: ItemOption[] = [];
  if (type !== "rod") options.push({ label: "Head", options: METAL_NAMES });
  if (handled || type === "rod") options.push({ label: type === "rod" ? "Wood" : "Handle", options: WOOD_NAMES });
  return {
    id: type, group: "tools", name, about: TOOL_ABOUT[type], options, size: type === "pot" ? "small" : "held", status: "waiting",
    gameItem: (c) => toolId(type, type === "rod" ? "bronze" : TOOL_METALS[c[0] ?? 0], WOOD_IDS[(type === "rod" ? c[0] : c[1]) ?? 0] ?? "pine"),
    build: (rng, c) => buildTool(type, type === "rod" ? "bronze" : TOOL_METALS[c[0] ?? 0], WOOD_IDS[(type === "rod" ? c[0] : c[1]) ?? 0] ?? "pine", rng),
  };
}

const forage = (id: ForageKind, name: string, about: string): ItemType => ({
  id, group: "gathered", name, about, options: [], size: "small", status: "waiting", gameItem: () => id, build: (rng) => buildForage(id, rng),
});
const loot = (id: LootKind, name: string, about: string, options: ItemOption[] = [], gameItem?: ItemType["gameItem"]): ItemType => ({
  id, group: "loot", name, about, options, size: "small", status: "waiting", gameItem: gameItem ?? (() => id), build: (rng, c) => buildLoot(id, c[0] ?? 0, rng),
});
const quest = (id: QuestKind, about: string, options: ItemOption[] = [], gameItem?: ItemType["gameItem"]): ItemType => ({
  id, group: "quest", name: id in STORY_ITEMS ? STORY_ITEMS[id as keyof typeof STORY_ITEMS].name : "Spell books", about, options, size: "small", status: "waiting",
  gameItem: gameItem ?? (() => id), build: (rng, c) => buildQuest(id, c[0] ?? 0, rng),
});
const prop = (id: PropKind, name: string, about: string): ItemType => ({
  id, group: "props", name, about, options: [], size: "big", status: "waiting", build: (rng) => buildProp(id, rng),
});
const gemType = (id: GemKind, name: string, about: string, options: ItemOption[], gameItem?: ItemType["gameItem"]): ItemType => ({
  id, group: "gems", name, about, options, size: "small", status: "waiting", gameItem, build: (rng, c) => buildGem(id, c, rng),
});
const GEM_NAMES = GEM_LIST.map((g) => GEMS[g].name);
const SIZES = { label: "Size", options: ["0.5 ct", "2.4 ct", "8 ct"] };
const SIZE_TENTHS = [5, 24, 80];

export const ITEM_LIST: ItemType[] = [
  // Tools
  toolType("axe", "Axe"),
  toolType("pickaxe", "Pickaxe"),
  toolType("shovel", "Shovel"),
  toolType("rod", "Fishing rod"),
  toolType("hammer", "Hammer"),
  toolType("tongs", "Tongs"),
  toolType("pot", "Cooking pot"),

  // Materials
  {
    id: "logs", group: "materials", name: "Logs", about: "Bark round the outside and pale cut ends with a ring, in the colours of each tree.",
    options: [{ label: "Wood", options: WOOD_NAMES }, { label: "Show", options: ["One log", "A stack"] }], size: "small", status: "waiting",
    gameItem: (c) => `${WOOD_IDS[c[0] ?? 0]}_logs`, build: (rng, c) => buildLogs(WOOD_IDS[c[0] ?? 0], c[1] === 1, rng),
  },
  {
    id: "bars", group: "materials", name: "Metal bars", about: "Ingots smelted at the furnace, wider at the bottom, with the smith's mark on top.",
    options: [{ label: "Metal", options: BAR_METALS.map(cap) }, { label: "Show", options: ["One bar", "A stack"] }], size: "small", status: "waiting",
    gameItem: (c) => `${BAR_METALS[c[0] ?? 0]}_bar`, build: (_rng, c) => buildBars(BAR_METALS[c[0] ?? 0], c[1] === 1),
  },
  { id: "leather", group: "materials", name: "Leather", about: "Tanned cowhide from the tanning rack, for leather armor.", options: [], size: "small", status: "waiting", gameItem: () => "leather", build: (rng) => buildLeather(rng) },
  { id: "thread", group: "materials", name: "Thread", about: "Spider silk spun at the spinning wheel, on a wooden spool.", options: [], size: "small", status: "waiting", gameItem: () => "thread", build: () => buildThread() },
  { id: "cloth", group: "materials", name: "Cloth", about: "Woven from thread, folded in a stack. For robes and bows.", options: [], size: "small", status: "waiting", gameItem: () => "cloth", build: () => buildCloth() },

  // Foraging finds
  forage("worm", "Worms", "The most common find. It wriggles. Used for worm bait."),
  forage("wild_root", "Wild roots", "A twisty brown root with a green tuft."),
  forage("red_cap", "Red cap mushrooms", "Bright red with white spots. For health potions."),
  forage("mushroom", "Mushrooms", "Plain brown mushrooms for cooking."),
  forage("sage", "Sage", "A tied bunch of soft grey-green leaves."),
  forage("ginseng", "Ginseng roots", "A pale root with little arms and legs."),
  forage("honey", "Wild honeycomb", "Golden wax cells full of honey."),
  forage("old_bone", "Old bones", "An old, cracked bone. Makes potion buffs last longer."),
  forage("blue_lotus", "Blue lotus", "A blue flower on a lily pad."),
  forage("moonpetal", "Moonpetal", "Only found at night. It glows softly."),
  forage("truffle", "Truffles", "Rare dark lumps from under oak trees."),
  {
    id: "seeds", group: "gathered", name: "Seeds", about: "Seed pouches from Farmer Odo. The tie and seeds show the crop.",
    options: [{ label: "Crop", options: ["Potato", "Carrot", "Onion", "Wheat", "Ginseng", "Blue lotus"] }], size: "small", status: "waiting",
    gameItem: (c) => seedId(CROP_IDS[c[0] ?? 0]),
    build: (rng, c) => buildSeeds([0xb8905a, 0xf08a2a, 0xc8a8d8, 0xe8c860, 0xe6cf9e, 0x5a8af0][c[0] ?? 0], rng),
  },

  // Monster loot
  loot("feather", "Feathers", "From chickens. For arrows and glow bait."),
  loot("rat_tail", "Rat tails", "Pink and bendy."),
  loot("cowhide", "Cowhides", "Black and white. Tan it into leather."),
  loot("wolf_pelt", "Wolf pelts", "Thick grey fur. The alpha's is pale.", [{ label: "Wolf", options: ["Wolf", "Alpha wolf"] }], (c) => (c[0] ? "alpha_pelt" : "wolf_pelt")),
  loot("boar_hide", "Boar hides", "Bristly brown hide."),
  loot("boar_tusk", "Boar tusks", "A curved ivory tusk."),
  loot("wolf_fang", "Wolf fangs", "A small curved fang."),
  loot("bat_wing", "Bat wings", "Thin dark leathery wing. For mana potions."),
  loot("slime_goo", "Slime goo", "A wobbly green blob."),
  loot("venom_sac", "Venom sacs", "Glowing green and pulsing. Handle with care."),
  loot("spider_silk", "Spider silk", "Shiny white skein. Spin it into thread."),
  loot("goblin_charm", "Goblin charms", "A bone disc with a glaring eye."),
  loot("stolen_ring", "Stolen rings", "A gold ring with a red stone."),
  loot("food_scraps", "Food scraps", "Leftovers. For chum bait."),
  loot("bait", "Bait", "Tins of fishing bait from Handicraft.", [{ label: "Bait", options: ["Worm bait", "Chum bait", "Glow bait"] }], (c) => ["bait_worm", "bait_chum", "bait_glow"][c[0] ?? 0]),

  // Potions
  {
    id: "potion", group: "alchemy", name: "Potions", about: "Glass bottles with glowing, bubbling liquid. Round flasks, long-necked draughts, and thin vials.",
    options: [{ label: "Potion", options: POTION_LIST.map((p) => POTIONS[p].name) }], size: "small", status: "waiting",
    gameItem: (c) => potionId(POTION_LIST[c[0] ?? 0]), build: (rng, c) => buildPotion(POTION_LIST[c[0] ?? 0], rng),
  },
  { id: "vial", group: "alchemy", name: "Empty vials", about: "Every potion uses one up. Alchemist Moss sells them.", options: [], size: "small", status: "waiting", gameItem: () => "vial", build: (rng) => buildPotion("vial", rng) },

  // Gems and jewelry
  gemType("rough_gem", "Rough gems", "From the crystal cave: grey rock with crystals poking out. Bigger carats, bigger lump.", [{ label: "Gem", options: GEM_NAMES }, SIZES], (c) => `rough_${GEM_LIST[c[0] ?? 0]}_${SIZE_TENTHS[c[1] ?? 1]}`),
  gemType("cut_gem", "Cut gems", "Cut at the anvil. Sparkly, and it slowly turns.", [{ label: "Gem", options: GEM_NAMES }, SIZES], (c) => `gem_${GEM_LIST[c[0] ?? 0]}_${SIZE_TENTHS[c[1] ?? 1]}`),
  gemType("soul_stone", "Emberstones", "Dark rock with pale glints; cut, it's a refined emberstone that glows once it holds ember.", [{ label: "Kind", options: ["Emberstone", "Empty refined emberstone", "Filled refined emberstone"] }], (c) => (c[0] === 0 ? "soulstone_24" : c[0] === 1 ? "soulgem_24" : "soulgem_24_1")),
  gemType("ring", "Rings", "A band with an optional gem on top.", [{ label: "Metal", options: JEWEL_METAL_LIST.map(cap) }, { label: "Gem", options: ["None", ...GEM_NAMES] }], (c) => `ring_${JEWEL_METAL_LIST[c[0] ?? 0]}${c[1] ? `_${GEM_LIST[c[1] - 1]}_24` : ""}`),
  gemType("amulet", "Amulets", "A chain with a round pendant and an optional gem.", [{ label: "Metal", options: JEWEL_METAL_LIST.map(cap) }, { label: "Gem", options: ["None", ...GEM_NAMES] }], (c) => `amulet_${JEWEL_METAL_LIST[c[0] ?? 0]}${c[1] ? `_${GEM_LIST[c[1] - 1]}_24` : ""}`),

  // Quest items
  quest("lantern", "High Keeper Aldric's gift. It glows and flickers, and lights up the night around you."),
  quest("blessing_scroll", "A rolled scroll with a gold ribbon and seal. Read it for an Emberguard blessing."),
  quest("shrine_totem", "Carved from oak by Woodworker Rook, with the Emberguard flame on top."),
  quest("rooks_note", "A neat folded letter sealed with red wax. It fell out of Rook's totem."),
  quest("ashbound_note", "A crumpled, scorched scrap with black scrawl, dropped by an Ashbound scout."),
  quest("marens_charm", "A little wooden flame worn smooth, on a leather cord."),
  quest("holts_notes", "Forester Holt's notebook, with a pencil."),
  quest("spell_book", "Read one to learn its spell. A glowing rune on the cover.", [{ label: "Spell", options: SPELL_BOOKS.map((b) => b.name) }], (c) => ["book_haste", "book_invisibility", "book_frost_nova"][c[0] ?? 0]),

  // Workshop props
  prop("chest", "Storage chest", "Keeps your things safe. Iron bands, a bronze lock and a lid that opens."),
  prop("furnace", "Furnace", "Smelt ore into bars. A stone dome with a fire and a smoking chimney."),
  prop("anvil", "Anvil", "Smith tools, weapons and armor, and cut gems. Sparks fly when you strike."),
  prop("workbench", "Workbench", "Woodworker Rook's bench for carving bows, staffs and totems."),
  prop("spinning_wheel", "Spinning wheel", "Spin spider silk into thread."),
  prop("tanning_rack", "Tanning rack", "Stretch and tan hides into leather."),
  prop("stove", "Cooking stove", "A brick range with a fire and a steaming pot."),
  prop("alchemy_table", "Alchemy table", "Alchemist Moss's table, with a flask bubbling over a blue flame."),
  prop("altar", "Enchanting altar", "A floating crystal with rune stones circling it."),
  prop("guild_board", "Guild board", "Notices and bounties, pinned under a little roof."),
];

// Mike reviewed and approved every item (Nov 2026).
for (const t of ITEM_LIST) t.status = "approved";

export const ITEM_TYPES: Record<string, ItemType> = Object.fromEntries(ITEM_LIST.map((t) => [t.id, t]));
export const ITEM_IDS = ITEM_LIST.map((t) => t.id);

/** Make an item. The same seed and choice always give the same item. */
export function createItem(id: string, opts: { seed?: number; choice?: number[] } = {}): Item {
  const type = ITEM_TYPES[id];
  if (!type) throw new Error(`No item called ${id}`);
  const choice = type.options.map((o, i) => Math.max(0, Math.min(o.options.length - 1, opts.choice?.[i] ?? 0)));
  return makeItem(type.build(makeRng(opts.seed ?? 1), choice));
}
