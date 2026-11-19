// Disciplines and skills.
//
// A Discipline is a broad area you level up (Foraging). Each Discipline holds
// Skills, the actual things you do (Woodcutting, Fishing), which unlock as the
// Discipline's level goes up. All XP from a Discipline's skills goes into the
// Discipline. Shared so the client shows the same numbers the server uses.

export type DisciplineId = "foraging";
export type SkillId = "woodcutting" | "fishing";

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
export const emptyDisciplines = (): DisciplineXp => ({ foraging: 0 });
