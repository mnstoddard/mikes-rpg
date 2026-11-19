// Foraging discipline: tuning numbers for its skills (Woodcutting, Fishing).
import { MAP, MAP_HEIGHT, MAP_WIDTH, isWalkable } from "./map";

// ---- Woodcutting ----

/** Chance of getting logs on each tick spent chopping (about one every 4 ticks / 2.4s). */
export const CHOP_SUCCESS_CHANCE = 0.25;
/** After each log, chance the tree falls and becomes a stump. */
export const TREE_FALL_CHANCE = 1 / 4;
/** How long a stump takes to grow back, in ticks (50 ticks = 30 seconds). */
export const TREE_RESPAWN_TICKS = 50;
/** Foraging XP for each log you get. */
export const XP_PER_LOG = 1;

export const treeKey = (x: number, y: number) => `${x},${y}`;

// ---- Fishing ----

/** Chance of catching a fish on each tick (about one every 10 ticks / 6s, vs 2.4s per log). */
export const FISH_SUCCESS_CHANCE = 0.1;
/** Foraging XP for each fish. More than a log, since fish take longer. */
export const XP_PER_FISH = 2;

const CARDINAL = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

/** You can fish any water tile that's right next to land you can stand on. */
export function isFishingSpot(x: number, y: number): boolean {
  if (y < 0 || y >= MAP_HEIGHT || x < 0 || x >= MAP_WIDTH || MAP[y][x] !== "water") return false;
  return CARDINAL.some((d) => isWalkable(x + d.x, y + d.y));
}
