// Disciplines and skills.
//
// A Discipline is a broad area you level up (Foraging). Each Discipline holds
// Skills, the actual things you do (Woodcutting, Fishing), which unlock as the
// Discipline's level goes up. All XP from a Discipline's skills goes into the
// Discipline. Shared so the client shows the same numbers the server uses.

export type DisciplineId = "foraging" | "crafting";
export type GatherSkill = "woodcutting" | "fishing" | "mining";
export type CraftSkill = "smelting" | "smithing";
export type SkillId = GatherSkill | CraftSkill;

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: string;
  /** Discipline level needed to use this skill. */
  unlockLevel: number;
  description: string;
}

export interface DisciplineDef {
  name: string;
  icon: string;
  description: string;
  skills: SkillDef[];
}

export const DISCIPLINES: Record<DisciplineId, DisciplineDef> = {
  foraging: {
    name: "Foraging", icon: "🌿",
    description: "Gathering from the wild.",
    skills: [
      { id: "woodcutting", name: "Woodcutting", icon: "🪓", unlockLevel: 1, description: "Click a tree to chop logs." },
      { id: "fishing", name: "Fishing", icon: "🎣", unlockLevel: 3, description: "Click the water's edge to fish." },
      { id: "mining", name: "Mining", icon: "⛏️", unlockLevel: 5, description: "Click a rock to mine ore." },
    ],
  },
  crafting: {
    name: "Crafting", icon: "⚒️",
    description: "Making things from what you gather.",
    skills: [
      { id: "smithing", name: "Smithing", icon: "🔨", unlockLevel: 1, description: "Use the anvil by the Merchant to make tools from stone or a metal bar, plus a log." },
      { id: "smelting", name: "Smelting", icon: "🔥", unlockLevel: 3, description: "Use the furnace by the Merchant to turn ore into bars." },
    ],
  },
};
export const DISCIPLINE_IDS = Object.keys(DISCIPLINES) as DisciplineId[];

/** Which Discipline a skill belongs to, and its definition. */
export function findSkill(skill: SkillId): { discipline: DisciplineId; def: SkillDef } {
  for (const discipline of DISCIPLINE_IDS) {
    const def = DISCIPLINES[discipline].skills.find((s) => s.id === skill);
    if (def) return { discipline, def };
  }
  throw new Error(`Unknown skill ${skill}`);
}

export const MAX_LEVEL = 99;

/**
 * Total XP needed to reach a level. Level 2 = 10 XP, 3 = 34, 5 = 121, 10 = 521,
 * 20 = 2,003, 50 = 11,024, 99 = 38,389. Gets steeper as you go, like RuneScape,
 * but tuned for small XP drops.
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

export type DisciplineXp = Record<DisciplineId, number>;

/** Each skill also has its own level (same curve, up to 99). It unlocks better types. */
export type SkillXp = Record<SkillId, number>;
export const emptySkills = (): SkillXp => ({ woodcutting: 0, fishing: 0, mining: 0, smelting: 0, smithing: 0 });
export const emptyDisciplines = (): DisciplineXp => ({ foraging: 0, crafting: 0 });
export const isCraftSkill = (skill: SkillId): skill is CraftSkill => skill === "smelting" || skill === "smithing";
