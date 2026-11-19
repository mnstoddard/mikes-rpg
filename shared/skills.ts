// Skills, XP and levels. Shared so the client can show the same numbers the server uses.
export type SkillId = "foraging";

export interface SkillDef { name: string; icon: string; description: string }

export const SKILLS: Record<SkillId, SkillDef> = {
  foraging: { name: "Foraging", icon: "🌿", description: "Gathering from the wild: chopping trees, and later mining, fishing and more." },
};
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

export const MAX_LEVEL = 99;

/**
 * Total XP needed to reach a level. Level 2 = 10 XP, 3 = 34, 5 = 121, 10 = 521,
 * 20 = 2,003, 50 = 11,024, 99 = 38,389. Gets steeper as you go, like RuneScape,
 * but tuned for small XP drops (1 XP per log).
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(10 * Math.pow(level - 1, 1.8));
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

export type SkillXp = Record<SkillId, number>;
export const emptySkills = (): SkillXp => ({ foraging: 0 });
