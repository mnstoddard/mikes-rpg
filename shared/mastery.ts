// Mastery: each skill (Woodcutting, Fishing, Mining) has its own Mastery level,
// raised by doing that skill. It has no cap. Higher Mastery unlocks better
// types (Oak trees, Copper rocks, Trout...) and makes you faster at the skill.
import type { SkillId } from "./disciplines";

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

/** "33%": how much faster than a brand new player. */
export const speedBonusPercent = (level: number) => Math.round((masterySpeed(level) - 1) * 100);

export type MasteryXp = Record<SkillId, number>;
export const emptyMastery = (): MasteryXp => ({ woodcutting: 0, fishing: 0, mining: 0 });
