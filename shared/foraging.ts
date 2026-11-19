// Foraging discipline: the types of tree, rock and fish, and tuning numbers.
import { MAP, MAP_HEIGHT, MAP_NODES, MAP_WIDTH, TICK_MS, isWalkable } from "./map";
import type { SkillId } from "./disciplines";
import type { ItemId } from "./items";
import { ItemMasteryXp, masteryIn as masteryLevelIn, masterySpeed } from "./mastery";
import { NO_TOOL_SLOWDOWN } from "./tools";

export type ResourceId =
  | "pine" | "oak" | "birch" | "maple" | "yew" | "ironwood" | "elderwood"
  | "stone" | "copper" | "tin" | "iron" | "coal" | "silver" | "gold" | "mithril"
  | "minnow" | "trout" | "perch" | "salmon" | "pike" | "tuna" | "swordfish" | "eel";

export interface ResourceDef {
  skill: SkillId;
  /** What you click, e.g. "Oak tree", "Copper rock", "Trout spot". */
  node: string;
  /** What you get. */
  item: ItemId;
  /** Skill level (e.g. Woodcutting level) needed to gather it. */
  level: number;
  /** Average seconds per item at Mastery 1 (Mastery in this type makes it faster). */
  seconds: number;
  /** XP per item. It goes to Foraging, to the skill, and to this type's Mastery. */
  xp: number;
  /** Trees and rocks: ticks until it grows back / refills (50 ticks = 30s). */
  respawnTicks: number;
  /** Colour used to draw it on the map (leaves, ore flecks, ripples). */
  color: number;
}

// Better types: need a higher skill level, are slower, give more XP and sell for more (prices in items.ts).
export const RESOURCES: Record<ResourceId, ResourceDef> = {
  // ---- Woodcutting ----
  pine:      { skill: "woodcutting", node: "Pine tree",      item: "pine_logs",      level: 1,  seconds: 2.4, xp: 1,  respawnTicks: 50,  color: 0x2e5e22 },
  oak:       { skill: "woodcutting", node: "Oak tree",       item: "oak_logs",       level: 5,  seconds: 3.6, xp: 3,  respawnTicks: 60,  color: 0x6b8e23 },
  birch:     { skill: "woodcutting", node: "Birch tree",     item: "birch_logs",     level: 10, seconds: 4.5, xp: 5,  respawnTicks: 70,  color: 0x9acd32 },
  maple:     { skill: "woodcutting", node: "Maple tree",     item: "maple_logs",     level: 20, seconds: 6,   xp: 9,  respawnTicks: 80,  color: 0xd2531f },
  yew:       { skill: "woodcutting", node: "Yew tree",       item: "yew_logs",       level: 35, seconds: 9,   xp: 16, respawnTicks: 100, color: 0x14422a },
  ironwood:  { skill: "woodcutting", node: "Ironwood tree",  item: "ironwood_logs",  level: 50, seconds: 12,  xp: 28, respawnTicks: 120, color: 0x56636b },
  elderwood: { skill: "woodcutting", node: "Elderwood tree", item: "elderwood_logs", level: 70, seconds: 15,  xp: 45, respawnTicks: 150, color: 0x7b4fbf },

  // ---- Mining ----
  stone:   { skill: "mining", node: "Stone rock",   item: "stone",       level: 1,  seconds: 4,   xp: 2,  respawnTicks: 25,  color: 0xa8a8a8 },
  copper:  { skill: "mining", node: "Copper rock",  item: "copper_ore",  level: 5,  seconds: 4.8, xp: 4,  respawnTicks: 30,  color: 0xd9822b },
  tin:     { skill: "mining", node: "Tin rock",     item: "tin_ore",     level: 5,  seconds: 4.8, xp: 5,  respawnTicks: 30,  color: 0xdfe6e9 },
  iron:    { skill: "mining", node: "Iron rock",    item: "iron_ore",    level: 20, seconds: 6.6, xp: 10, respawnTicks: 45,  color: 0x8e3b2a },
  coal:    { skill: "mining", node: "Coal rock",    item: "coal",        level: 30, seconds: 7.8, xp: 14, respawnTicks: 55,  color: 0x1a1a1a },
  silver:  { skill: "mining", node: "Silver rock",  item: "silver_ore",  level: 40, seconds: 9,   xp: 20, respawnTicks: 70,  color: 0xf5f7fa },
  gold:    { skill: "mining", node: "Gold rock",    item: "gold_ore",    level: 55, seconds: 12,  xp: 30, respawnTicks: 90,  color: 0xf5c542 },
  mithril: { skill: "mining", node: "Mithril rock", item: "mithril_ore", level: 70, seconds: 15,  xp: 45, respawnTicks: 120, color: 0x3fa9f5 },

  // ---- Fishing (spots never run out) ----
  minnow:    { skill: "fishing", node: "Shallow water",  item: "minnow",    level: 1,  seconds: 6,    xp: 2,  respawnTicks: 0, color: 0xffffff },
  trout:     { skill: "fishing", node: "Trout spot",     item: "trout",     level: 5,  seconds: 7.2,  xp: 4,  respawnTicks: 0, color: 0x9be28a },
  perch:     { skill: "fishing", node: "Perch spot",     item: "perch",     level: 10, seconds: 7.8,  xp: 6,  respawnTicks: 0, color: 0xffd84a },
  salmon:    { skill: "fishing", node: "Salmon spot",    item: "salmon",    level: 20, seconds: 9,    xp: 10, respawnTicks: 0, color: 0xff8a65 },
  pike:      { skill: "fishing", node: "Pike spot",      item: "pike",      level: 30, seconds: 10.8, xp: 15, respawnTicks: 0, color: 0x7fe0ff },
  tuna:      { skill: "fishing", node: "Tuna spot",      item: "tuna",      level: 45, seconds: 12,   xp: 24, respawnTicks: 0, color: 0x4a7bd9 },
  swordfish: { skill: "fishing", node: "Swordfish spot", item: "swordfish", level: 60, seconds: 15,   xp: 36, respawnTicks: 0, color: 0xc0c0ff },
  eel:       { skill: "fishing", node: "Eel spot",       item: "eel",       level: 75, seconds: 18,   xp: 50, respawnTicks: 0, color: 0xb36bff },
};
export const RESOURCE_IDS = Object.keys(RESOURCES) as ResourceId[];

/** All types for one skill, easiest first. */
export const resourcesFor = (skill: SkillId) =>
  RESOURCE_IDS.filter((id) => RESOURCES[id].skill === skill).sort((a, b) => RESOURCES[a].level - RESOURCES[b].level);

/** How a tool changes gathering speed: 1.1 = 10% faster. No tool (null): 3 times slower. */
export const toolSpeed = (toolBonus: number | null) => toolBonus === null ? 1 / NO_TOOL_SLOWDOWN : 1 + toolBonus;

/**
 * Chance per tick (0.6s) of getting an item. Works out to `seconds` on average
 * at Mastery 1, and faster as your Mastery in this type goes up and with a
 * better tool. With no tool for the job it's 3 times slower.
 */
export function gatherChancePerTick(id: ResourceId, masteryLevel: number, toolBonus: number | null): number {
  return Math.min(1, (TICK_MS / 1000) * masterySpeed(masteryLevel) * toolSpeed(toolBonus) / RESOURCES[id].seconds);
}

/**
 * Hook for later: chance that a catch actually works out (e.g. the fish gets
 * away). Everything always succeeds for now. Later a hard type could start
 * around 40% and climb with Mastery, or with a better tool.
 */
export function gatherSuccessChance(_id: ResourceId, _masteryLevel: number): number {
  return 1;
}

/**
 * Foraging (Discipline) XP for one item. Fishing costs much less stamina than
 * chopping or mining, so it gives half the Foraging XP (at least 1). The
 * Fishing skill and the fish's Mastery still get the full XP.
 */
export const FISHING_FORAGE_SHARE = 0.5;
export function forageXp(id: ResourceId): number {
  const r = RESOURCES[id];
  return r.skill === "fishing" ? Math.max(1, Math.floor(r.xp * FISHING_FORAGE_SHARE)) : r.xp;
}

/** Which type an item comes from (oak_logs -> oak). */
export const RESOURCE_FOR_ITEM = Object.fromEntries(RESOURCE_IDS.map((id) => [RESOURCES[id].item, id])) as Partial<Record<ItemId, ResourceId>>;

/** Your Mastery level in one type (Pine, Copper, Trout...). */
export const masteryIn = (mastery: ItemMasteryXp, id: ResourceId) => masteryLevelIn(mastery, id);

// ---- Trees and rocks ----

/** After each log, chance the tree falls and becomes a stump. */
export const TREE_FALL_CHANCE = 1 / 4;
/** After each ore, chance the rock is emptied. */
export const ROCK_EMPTY_CHANCE = 1 / 3;

/** Key for a tree or rock in the world's "depleted" list. */
export const treeKey = (x: number, y: number) => `${x},${y}`;

const inMap = (x: number, y: number) => y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH;

/** The tree or rock type standing on a tile, if any. */
export function nodeAt(x: number, y: number): ResourceId | null {
  if (!inMap(x, y) || (MAP[y][x] !== "tree" && MAP[y][x] !== "rock")) return null;
  return MAP_NODES[y][x];
}

// ---- Fishing ----

const CARDINAL = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

/** You can fish any water tile that's right next to land you can stand on. */
export function isFishingSpot(x: number, y: number): boolean {
  if (!inMap(x, y) || MAP[y][x] !== "water") return false;
  return CARDINAL.some((d) => isWalkable(x + d.x, y + d.y));
}

/** What you catch at a fishing spot: Minnows anywhere, better fish at marked spots. */
export function fishAt(x: number, y: number): ResourceId | null {
  if (!isFishingSpot(x, y)) return null;
  return MAP_NODES[y][x] ?? "minnow";
}
