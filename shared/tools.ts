// Tools, metals and woods: the numbers behind the tool belt and Smithing.
//
// Gathering tools (axe, pickaxe, fishing rod) make gathering faster. Crafting
// tools (hammer, tongs, pot) raise the chance that smithing, smelting or
// cooking works. Most tools are 1 metal bar (or 1 stone) and 1 log; tongs and
// the pot have no handle and take 3 bars (or 3 stone) instead.
// Its material and its wood each add a bonus, e.g. Bronze 5% + Pine 5% = 10%.
// Stone tools are the easy starter tier: anyone can make one from the start.
// No imports at runtime, so items.ts can build every tool item from this.
import type { BaseItemId } from "./items";

export type Metal = "bronze" | "iron" | "steel" | "mithril";
/** What a tool's head is made of: stone, or a metal bar. */
export type Material = "stone" | Metal;
export type Wood = "pine" | "oak" | "birch" | "maple" | "yew" | "ironwood" | "elderwood";
export type ToolType = "axe" | "pickaxe" | "rod" | "hammer" | "tongs" | "pot";
/** Tools with no wooden handle: all metal (or stone). */
export type HandlelessTool = "tongs" | "pot";
/** Tools with a wooden handle (everything but tongs and the pot). */
export type HandledTool = Exclude<ToolType, HandlelessTool>;
export type BarId = `${Metal}_bar`;
export type ToolItemId = `${HandledTool}_${Material}_${Wood}` | `${HandlelessTool}_${Material}`;

export interface MaterialDef {
  name: string;
  /** CSS filter that colours the bar and tool icons. */
  tint: string;
  /** Tool bonus from this metal (0.05 = 5%). */
  bonus: number;
  /** Uses before a tool of this metal breaks (with a Pine handle; better wood lasts longer). */
  durability: number;
  /** Smelting level to smelt the bar, and Smithing level to make tools from it. */
  level: number;
  /** Smithing XP for one tool (the wood adds a bit more). */
  toolXp: number;
  /** Success chance making a tool from it at Mastery 1 (it climbs with Mastery). */
  startSuccess: number;
  /** Does making a tool from it need a hammer for full success? (Stone doesn't.) */
  needsTool: boolean;
}

export interface MetalDef extends MaterialDef {
  /** Smelting XP for one bar. */
  barXp: number;
  /** Ores that go into one bar (always 2). */
  ores: BaseItemId[];
}

// Silver and gold aren't tool metals; they're saved for something else later.
export const METALS: Record<Metal, MetalDef> = {
  bronze:  { name: "Bronze",  tint: "sepia(1) saturate(2.5) hue-rotate(-15deg) brightness(.85)", bonus: 0.05, durability: 150, level: 1,  barXp: 8,  toolXp: 10, startSuccess: 0.25, needsTool: true, ores: ["copper_ore", "tin_ore"] },
  iron:    { name: "Iron",    tint: "grayscale(1) brightness(.7)",                                 bonus: 0.10, durability: 300, level: 15, barXp: 12, toolXp: 18, startSuccess: 0.25, needsTool: true, ores: ["iron_ore", "iron_ore"] },
  steel:   { name: "Steel",   tint: "grayscale(1) brightness(1.3) contrast(1.2)",                  bonus: 0.15, durability: 500, level: 30, barXp: 25, toolXp: 35, startSuccess: 0.25, needsTool: true, ores: ["iron_ore", "coal"] },
  mithril: { name: "Mithril", tint: "sepia(1) saturate(5) hue-rotate(170deg)",                     bonus: 0.25, durability: 900, level: 60, barXp: 60, toolXp: 80, startSuccess: 0.25, needsTool: true, ores: ["mithril_ore", "coal"] },
};
export const METAL_IDS = Object.keys(METALS) as Metal[];

/** Stone: the starter tier. Weak and quick to wear out, but easy to make (80% at first, no hammer needed). */
export const STONE: MaterialDef = {
  name: "Stone", tint: "grayscale(1) sepia(.25) brightness(.95)", bonus: 0.02, durability: 60, level: 1, toolXp: 4,
  startSuccess: 0.8, needsTool: false,
};
export const MATERIALS: Record<Material, MaterialDef> = { stone: STONE, ...METALS };
export const MATERIAL_IDS: Material[] = ["stone", ...METAL_IDS];

export interface WoodDef {
  name: string;
  /** Tool bonus from the handle's wood (0.05 = 5%). */
  bonus: number;
  /** Better wood makes the tool last longer: durability is multiplied by this. */
  durability: number;
}

export const WOODS: Record<Wood, WoodDef> = {
  pine:      { name: "Pine",      bonus: 0.05, durability: 1 },
  oak:       { name: "Oak",       bonus: 0.07, durability: 1.15 },
  birch:     { name: "Birch",     bonus: 0.09, durability: 1.3 },
  maple:     { name: "Maple",     bonus: 0.12, durability: 1.5 },
  yew:       { name: "Yew",       bonus: 0.15, durability: 1.75 },
  ironwood:  { name: "Ironwood",  bonus: 0.20, durability: 2.1 },
  elderwood: { name: "Elderwood", bonus: 0.25, durability: 2.5 },
};
export const WOOD_IDS = Object.keys(WOODS) as Wood[];

export interface ToolTypeDef {
  name: string;
  icon: string;
  /** The skill it helps. */
  skill: "woodcutting" | "mining" | "fishing" | "smithing" | "smelting" | "cooking";
  /** What it does: gathering tools speed you up, crafting tools raise success. */
  helps: "speed" | "success";
}

// Tongs and the pot have no emoji, so "svg:tongs" and "svg:pot" are drawn by the client instead.
export const TOOL_TYPES: Record<ToolType, ToolTypeDef> = {
  axe:     { name: "Axe",         icon: "🪓", skill: "woodcutting", helps: "speed" },
  pickaxe: { name: "Pickaxe",     icon: "⛏️", skill: "mining",      helps: "speed" },
  rod:     { name: "Fishing rod", icon: "🎣", skill: "fishing",     helps: "speed" },
  hammer:  { name: "Hammer",      icon: "🔨", skill: "smithing",    helps: "success" },
  tongs:   { name: "Tongs",       icon: "svg:tongs", skill: "smelting",    helps: "success" },
  pot:     { name: "Pot",         icon: "svg:pot",   skill: "cooking",     helps: "success" },
};
export const TOOL_TYPE_IDS = Object.keys(TOOL_TYPES) as ToolType[];

/** Which tool helps a skill (Woodcutting -> axe). */
export const toolForSkill = (skill: string) => TOOL_TYPE_IDS.find((t) => TOOL_TYPES[t].skill === skill) ?? null;

/** Without the right gathering tool, gathering takes this many times longer. */
export const NO_TOOL_SLOWDOWN = 3;
/** Without the right crafting tool, your success chance is cut in half. */
export const NO_TOOL_SUCCESS = 0.5;
/** "Your axe is about to break" when it drops to this share of its uses. */
export const TOOL_WARN_AT = 0.1;

export const barId = (metal: Metal): BarId => `${metal}_bar`;
export const BAR_IDS = METAL_IDS.map(barId);
export const metalOfBar = (bar: BarId) => bar.slice(0, -4) as Metal;

/** Tongs and the pot have no wooden handle. */
export const hasHandle = (type: ToolType): type is HandledTool => type !== "tongs" && type !== "pot";
/** How many bars (or stone) go into a tool's head: 3 for tongs and the pot, 1 for the rest. */
export const headCount = (type: ToolType) => hasHandle(type) ? 1 : 3;

export function toolId(type: ToolType, metal: Material, wood: Wood): ToolItemId {
  return hasHandle(type) ? `${type}_${metal}_${wood}` : `${type}_${metal}`;
}

export const ALL_TOOL_IDS: ToolItemId[] = TOOL_TYPE_IDS.flatMap((type) =>
  !hasHandle(type) ? MATERIAL_IDS.map((m) => toolId(type, m, "pine"))
    : MATERIAL_IDS.flatMap((m) => WOOD_IDS.map((w) => toolId(type, m, w))));
const TOOL_SET = new Set<string>(ALL_TOOL_IDS);

export const isTool = (item: string | null | undefined): item is ToolItemId => !!item && TOOL_SET.has(item);

/** "axe_iron_oak" -> { type: "axe", metal: "iron", wood: "oak" }. Tongs and the pot have no wood. */
export function parseTool(item: ToolItemId): { type: ToolType; metal: Material; wood: Wood | null } {
  const [type, metal, wood] = item.split("_") as [ToolType, Material, Wood | undefined];
  return { type, metal, wood: wood ?? null };
}

/** Bonus as a fraction: 0.10 = 10% faster (gathering) or 10% fewer failures (crafting). Tongs and the pot count their metal twice. */
export function toolBonus(item: ToolItemId): number {
  const { metal, wood } = parseTool(item);
  return MATERIALS[metal].bonus + (wood ? WOODS[wood].bonus : MATERIALS[metal].bonus);
}

/** How many uses a fresh tool has. */
export function maxDurability(item: ToolItemId): number {
  const { metal, wood } = parseTool(item);
  return Math.round(MATERIALS[metal].durability * (wood ? WOODS[wood].durability : 1.5));
}

/** Uses a tool loses each time: harder trees, rocks, fish and recipes wear tools faster (1 at level 1-9 ... 8 at level 70+). */
export const wearFor = (level: number) => 1 + Math.floor(level / 10);

/** One tool on the belt, with how many uses it has left. */
export interface BeltTool { item: ToolItemId; durability: number }
export type Belt = Record<ToolType, BeltTool | null>;
export const emptyBelt = (): Belt => ({ axe: null, pickaxe: null, rod: null, hammer: null, tongs: null, pot: null });
