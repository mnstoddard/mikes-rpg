// Mastery: every type you gather (Pine, Oak, Copper, Trout...) has its own
// Mastery level, raised by gathering that type. It has no cap. Higher Mastery
// makes you faster at gathering that type, and makes it sell for more.
// Crafted things have Mastery too: each bar (Bronze bar...) and each kind of
// tool (all axes share one). There, Mastery raises your success chance instead.
// (Unlocking new types is done by the skill level, e.g. Woodcutting level.)
import type { ResourceId } from "./foraging";
import type { BarId, ToolType } from "./tools";
import type { GearType } from "./gear";
import type { CropId } from "./farming";
import type { DishId } from "./cooking";
import type { BaitId } from "./handicraft";
import type { PotionMastery } from "./alchemy";
import type { JewelBarId, JewelType } from "./jewelry";

/** XP to go from Mastery 1 to 2. Each level after needs 10% more than the one before. */
export const MASTERY_FIRST_LEVEL_XP = 10;
export const MASTERY_GROWTH = 1.1;

/**
 * Total XP needed to reach a Mastery level.
 * 5 = 46, 10 = 135, 20 = 511, 35 = 2,454, 50 = 10,571, 70 = 71,695, 100 = 1.25 million.
 */
export function masteryXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(MASTERY_FIRST_LEVEL_XP * (Math.pow(MASTERY_GROWTH, level - 1) - 1) / (MASTERY_GROWTH - 1));
}

export function masteryLevelForXp(xp: number): number {
  // Jump straight near the answer, then nudge (floating point can be off by one).
  let level = Math.max(1, Math.floor(1 + Math.log(1 + (xp * (MASTERY_GROWTH - 1)) / MASTERY_FIRST_LEVEL_XP) / Math.log(MASTERY_GROWTH)));
  while (level > 1 && masteryXpForLevel(level) > xp) level--;
  while (masteryXpForLevel(level + 1) <= xp) level++;
  return level;
}

/**
 * How much faster Mastery makes you: 1 = normal speed. Shrinking gains that never
 * reach instant: Mastery 10 = 8% faster, 25 = 19%, 50 = 33%, 100 = 50%, 200 = 67%,
 * and it creeps toward (but never reaches) twice as fast.
 */
export function masterySpeed(level: number): number {
  return 1 + (level - 1) / (level + 99);
}

/** "33%": how much faster than Mastery 1. */
export const speedBonusPercent = (level: number) => Math.round((masterySpeed(level) - 1) * 100);

/** Each Mastery level adds 2% to what a shop pays: Mastery 11 = +20%, 51 = double. */
export const MASTERY_VALUE_PER_LEVEL = 0.02;
export const masteryValue = (level: number) => 1 + (level - 1) * MASTERY_VALUE_PER_LEVEL;
export const valueBonusPercent = (level: number) => Math.round((masteryValue(level) - 1) * 100);

/** What can have Mastery: a gathered type (oak), a bar (bronze_bar), a kind of tool (axe), a dish (stew), a bait, or a kind of weapon or armor you smith (sword). */
/** Handicraft (stage 10): arrows of every tip share one Mastery; leather, thread and cloth have their own. */
export type HandicraftMastery = "arrows" | "leather" | "thread" | "cloth";
/** Farming: one Mastery per crop ("crop_potato"). */
export type CropMastery = `crop_${CropId}`;
export type MasteryId = ResourceId | BarId | ToolType | DishId | BaitId | GearType | PotionMastery | JewelBarId | JewelType | HandicraftMastery | CropMastery;

/** Mastery XP per type. Types you've never gathered or made aren't listed. */
export type ItemMasteryXp = Partial<Record<MasteryId, number>>;

/** Your Mastery level in one type. */
export const masteryIn = (mastery: ItemMasteryXp, id: MasteryId) => masteryLevelForXp(mastery[id] ?? 0);

// ---- Crafting success ----

/** Success never quite reaches 100%. */
export const MAX_SUCCESS = 0.999;
const START_SUCCESS = 0.25;
const SUCCESS_CURVE = 0.0436;

/**
 * Chance a smelt or smith works, from Mastery alone: 25% at Mastery 1, 50% at 10,
 * 91% at 50, 99% at 100. Never 100%. (Your tool then changes this; see craftSuccess.)
 */
export function masterySuccess(level: number, start = START_SUCCESS): number {
  return Math.min(MAX_SUCCESS, 1 - (1 - start) * Math.exp(-SUCCESS_CURVE * (level - 1)));
}

/**
 * Your real chance with a tool: its bonus removes that share of your failures
 * (a +10% tool turns 75% failure into 67.5%). No tool: half your chance.
 */
export function craftSuccess(level: number, toolBonus: number | null, start = START_SUCCESS, needsTool = true): number {
  const base = masterySuccess(level, start);
  if (toolBonus === null) return needsTool ? base * 0.5 : base;
  return Math.min(MAX_SUCCESS, 1 - (1 - base) * (1 - toolBonus));
}

/** "32%" or "99.5%": one decimal only when it matters. */
export function percent(chance: number): string {
  const p = chance * 100;
  return `${p >= 99 || p < 10 ? Math.floor(p * 10) / 10 : Math.round(p)}%`;
}
