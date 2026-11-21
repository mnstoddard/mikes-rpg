// Disciplines and skills.
//
// A Discipline is a broad area (Strength, Endurance...). Each Discipline holds
// Skills, the actual things you do (Woodcutting, Fishing). A Discipline's level
// is the average level of its unlocked skills (rounded down), so
// it goes up as they do. Skills unlock through quests, when someone teaches you.
// Each Discipline raises one of your stats (see shared/stats.ts).
// Shared so the client shows the same numbers the server uses.

export type DisciplineId = "strength" | "endurance" | "wisdom" | "dexterity" | "charisma";
export type GatherSkill = "woodcutting" | "fishing" | "mining" | "foraging";
/** Hunting: trained by defeating monsters (shared by everyone who hurt it). */
export type WildSkill = "hunting";
export type CraftSkill = "smelting" | "smithing" | "cooking" | "handicraft" | "alchemy";
/** "magic" is Spellcasting (its id stays "magic" so spells, staffs and trees keep working). */
export type CombatSkill = "melee" | "ranged" | "magic" | "defense";
export type SocialSkill = "trading" | "renown";
/** Enchanting: at the altar in the Mages' Guild (shared/enchanting.ts). */
export type EnchantSkill = "enchanting";
/** Farming: your own plot at the farm (shared/farming.ts). */
export type FarmSkill = "farming";
export type SkillId = GatherSkill | WildSkill | CraftSkill | CombatSkill | SocialSkill | EnchantSkill | FarmSkill;

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: string;
  /** Who teaches it (shown while it's still locked). */
  teacher?: string;
  description: string;
}

export interface DisciplineDef {
  name: string;
  icon: string;
  description: string;
  skills: SkillDef[];
}

export const DISCIPLINES: Record<DisciplineId, DisciplineDef> = {
  strength: {
    name: "Strength", icon: "💪",
    description: "Fighting, and staying alive. Raises your max health.",
    skills: [
      { id: "melee", name: "Melee", icon: "🗡️", description: "Hold a dagger, sword, mace, spear or two-handed sword and click a monster." },
      { id: "defense", name: "Defense", icon: "🛡️", description: "Trained by being attacked. Higher Defense means monsters miss more, and you can wear better armor." },
      { id: "ranged", name: "Ranged", icon: "🏹", description: "Hold a sling, darts or a bow and hit monsters from a distance." },
    ],
  },
  endurance: {
    name: "Endurance", icon: "🌿",
    description: "Gathering from the wild. Raises your max stamina.",
    skills: [
      { id: "fishing", name: "Fishing", icon: "🎣", description: "Click the water's edge to fish." },
      { id: "woodcutting", name: "Woodcutting", icon: "🪓", description: "Click a tree to chop logs." },
      { id: "mining", name: "Mining", icon: "⛏️", description: "Click a rock to mine ore." },
      { id: "foraging", name: "Foraging", icon: "🌱", description: "Click a glinting dig patch to dig it up with a shovel: roots, mushrooms, worms, herbs, old bones, truffles, and moonpetal at night. Herbalist Wren teaches it." },
      { id: "farming", name: "Farming", icon: "🌾", description: "Buy a plot at the farm (east of the island, over the second bridge) from Farmer Odo, plant his seeds, and come back to harvest. Crops grow even while you're logged out. Farmer Odo teaches it." },
      { id: "hunting", name: "Hunting", icon: "🐾", description: "Trained by defeating monsters. Everyone who hurt it shares the XP by how much damage they did. Higher Hunting makes monsters drop things more often." },
    ],
  },
  wisdom: {
    name: "Wisdom", icon: "🔮",
    description: "Magic. Raises your max mana.",
    skills: [
      { id: "magic", name: "Spellcasting", icon: "🪄", description: "Cast spells from your spell bar (bolts fly from a staff in your hand). Spells use mana." },
      { id: "enchanting", name: "Enchanting", icon: "✨", description: "Use the enchanting altar in the Mages' Guild: a soul gem with souls in it adds magic to a staff, a piece of armor or a tool. Archmage Ysolde teaches it." },
      { id: "alchemy", name: "Alchemy", icon: "⚗️", description: "Brew potions at the alchemy table in the Mages' Guild: pick 2 ingredients (and maybe a third for a bonus) and an empty vial. Alchemist Moss teaches it." },
    ],
  },
  dexterity: {
    name: "Dexterity", icon: "🤲",
    description: "Making things. Raises how much you can carry and how fast you walk.",
    skills: [
      { id: "cooking", name: "Cooking", icon: "🍲", description: "Use the stove in the town square, by Old Maren, to cook meals (stew, stir fry, curry, roast) from fish, meat and vegetables. Meals give back lots of stamina." },
      { id: "handicraft", name: "Handicraft", icon: "🧵", description: "Use Woodworker Rook's workshop: fishing bait, bows, arrows and staffs at the workbench, leather at the tanning rack (outside), thread and cloth at the spinning wheel, and leather and cloth armor." },
      { id: "smithing", name: "Smithing", icon: "🔨", description: "Use the anvil in Smith Brann's smithy to make tools from stone or a metal bar, plus a log." },
      { id: "smelting", name: "Smelting", icon: "🔥", description: "Use the furnace in Smith Brann's smithy to turn ore into bars." },
    ],
  },
  charisma: {
    name: "Charisma", icon: "🤝",
    description: "Dealing with people. Better shop prices.",
    skills: [
      { id: "trading", name: "Trading", icon: "💰", description: "Trained by selling things to any shop (the more it's worth, the more XP). Each level makes prices a little better, and trainers sell you rarer things as it goes up." },
      { id: "renown", name: "Renown", icon: "📋", description: "Trained by finishing bounties, on the bounty board and the Mages' Guild board. Bounties get bigger and pay more as it goes up, and Captain Bryn gives you ranks and titles (Wanderer at 5, Trusted at 15, Champion at 30)." },
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

/** Each skill has its own XP and level (up to 99). A Discipline's level comes from its skills' levels. */
export type SkillXp = Record<SkillId, number>;
export const SKILL_IDS: SkillId[] = DISCIPLINE_IDS.flatMap((d) => DISCIPLINES[d].skills.map((s) => s.id));
export const emptySkills = (): SkillXp => Object.fromEntries(SKILL_IDS.map((id) => [id, 0])) as SkillXp;
export const isCombatSkill = (skill: SkillId): skill is CombatSkill => skill === "melee" || skill === "ranged" || skill === "magic" || skill === "defense";
export const isCraftSkill = (skill: SkillId): skill is CraftSkill => skill === "smelting" || skill === "smithing" || skill === "cooking" || skill === "handicraft" || skill === "alchemy";

/** A Discipline's level for each Discipline. */
export type DisciplineLevels = Record<DisciplineId, number>;

const skillLevel = (xp: SkillXp, id: SkillId) => levelForXp(xp[id] ?? 0);

const average = (levels: number[]) => (levels.length ? Math.floor(levels.reduce((a, b) => a + b, 0) / levels.length) : 1);

/** Which skills a character has unlocked. Skills unlock through quests (shared/quests.ts), not by level. */
export type Unlocked = ReadonlySet<SkillId> | readonly SkillId[];
const has = (u: Unlocked, id: SkillId) => (Array.isArray(u) ? (u as readonly SkillId[]).includes(id) : (u as ReadonlySet<SkillId>).has(id));

/**
 * A Discipline's level: the average level of its unlocked skills, rounded down
 * (level 1 if none are unlocked yet). A newly unlocked skill starts at level 1,
 * so it pulls the average down a little until you train it.
 */
export const disciplineLevel = (xp: SkillXp, d: DisciplineId, unlocked: Unlocked) =>
  average(DISCIPLINES[d].skills.filter((s) => has(unlocked, s.id)).map((s) => skillLevel(xp, s.id)));

export const disciplineLevels = (xp: SkillXp, unlocked: Unlocked): DisciplineLevels =>
  Object.fromEntries(DISCIPLINE_IDS.map((d) => [d, disciplineLevel(xp, d, unlocked)])) as DisciplineLevels;

export const isUnlocked = (unlocked: Unlocked, skill: SkillId) => has(unlocked, skill);

/** What the server sends the client: each Discipline's level, and the skills you've been taught. */
export interface DisciplineView { levels: DisciplineLevels; unlocked: SkillId[] }
export const newDisciplineView = (): DisciplineView => ({ levels: { strength: 1, endurance: 1, wisdom: 1, dexterity: 1, charisma: 1 }, unlocked: [] });
