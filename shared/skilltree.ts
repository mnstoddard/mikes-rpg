// Mastery skill trees.
//
// Every time any of your Masteries goes up a level (Oak, Trout, Axe, Stew,
// Dagger, Chicken...), you earn 1 Mastery point. Spend points in any skill's
// tree, on whichever skill you like. Each upgrade has 3 ranks: rank 1 costs 1
// point, rank 2 costs 2 more, rank 3 costs 3 more (6 in all). Resetting a
// tree (or all of them) is free for now and gives every point back.
//
// Points aren't stored: what you've earned is worked out from your Mastery
// levels, and what you've spent from your ranks. Only the ranks are saved.
// Shared so the client shows the same numbers the server uses.
import type { SkillId } from "./disciplines";
import { ItemMasteryXp, masteryLevelForXp } from "./mastery";

export type TreeEffect =
  | "speed"        // gathering: faster
  | "double"       // gathering: chance of an extra item
  | "staminaSave"  // chance an action costs no stamina
  | "success"      // crafting: fewer failures
  | "xp"           // more skill XP
  | "extra"        // crafting: chance to make an extra one
  | "toolCare"     // chance your tools, weapons and armor don't wear down
  | "slots"        // cooking: more ingredients in the pot
  | "mealStamina"  // cooking: meals give more stamina
  | "accuracy"     // combat: hit more often
  | "damage"       // combat: hit harder
  | "manaSave"     // magic: chance a spell costs no mana
  | "health"       // defense: more max health
  | "dodge";       // defense: monsters hit you less often

export interface TreeNode {
  /** e.g. "cooking.slots". */
  id: string;
  skill: SkillId;
  name: string;
  icon: string;
  effect: TreeEffect;
  /** How much each rank gives (0.05 = 5%; for slots and health, a whole number). */
  per: number;
  maxRank: number;
}

const node = (skill: SkillId, effect: TreeEffect, name: string, icon: string, per: number, maxRank = 3): TreeNode =>
  ({ id: `${skill}.${effect}`, skill, effect, name, icon, per, maxRank });

const gather = (skill: SkillId, third: TreeNode): TreeNode[] => [
  node(skill, "speed", "Quick hands", "⏩", 0.05),
  node(skill, "double", "Lucky find", "🍀", 0.04),
  third,
];

export const TREES: Record<SkillId, TreeNode[]> = {
  woodcutting: gather("woodcutting", node("woodcutting", "staminaSave", "Light work", "🪶", 0.08)),
  mining: gather("mining", node("mining", "staminaSave", "Light work", "🪶", 0.08)),
  fishing: gather("fishing", node("fishing", "xp", "Quick learner", "📖", 0.1)),
  foraging: gather("foraging", node("foraging", "staminaSave", "Light work", "🪶", 0.08)),
  hunting: [node("hunting", "xp", "Quick learner", "📖", 0.1)],
  smelting: [
    node("smelting", "success", "Steady hands", "🎯", 0.06),
    node("smelting", "extra", "Extra bar", "🧈", 0.04),
    node("smelting", "staminaSave", "Light work", "🪶", 0.1),
  ],
  smithing: [
    node("smithing", "success", "Steady hands", "🎯", 0.06),
    node("smithing", "toolCare", "Tool care", "🧰", 0.08),
    node("smithing", "xp", "Quick learner", "📖", 0.1),
  ],
  cooking: [
    node("cooking", "slots", "Bigger pot", "🍲", 1),
    node("cooking", "success", "Steady hands", "🎯", 0.06),
    node("cooking", "mealStamina", "Hearty meals", "💪", 0.05),
  ],
  handicraft: [
    node("handicraft", "success", "Steady hands", "🎯", 0.06),
    node("handicraft", "extra", "Bait bundle", "🪱", 0.1),
    node("handicraft", "xp", "Quick learner", "📖", 0.1),
  ],
  alchemy: [
    node("alchemy", "success", "Steady hands", "🎯", 0.06),
    node("alchemy", "extra", "Extra dose", "🧪", 0.05),
    node("alchemy", "xp", "Quick learner", "📖", 0.1),
  ],
  melee: [
    node("melee", "accuracy", "Precise strikes", "🎯", 0.02),
    node("melee", "damage", "Heavy blows", "💥", 0.05),
    node("melee", "staminaSave", "Second wind", "🪶", 0.1),
  ],
  ranged: [
    node("ranged", "accuracy", "Steady aim", "🎯", 0.02),
    node("ranged", "damage", "Sharp tips", "💥", 0.05),
    node("ranged", "staminaSave", "Second wind", "🪶", 0.1),
  ],
  magic: [
    node("magic", "accuracy", "Focus", "🎯", 0.02),
    node("magic", "damage", "Power", "💥", 0.05),
    node("magic", "manaSave", "Mana flow", "🔮", 0.08),
  ],
  defense: [
    node("defense", "health", "Toughness", "❤️", 5),
    node("defense", "dodge", "Footwork", "💨", 0.02),
    node("defense", "xp", "Quick learner", "📖", 0.1),
  ],
  // Charisma skills only have "Quick learner" for now; more upgrades come with Trading and Renown's own stage.
  trading: [node("trading", "xp", "Quick learner", "📖", 0.1)],
  renown: [node("renown", "xp", "Quick learner", "📖", 0.1)],
};

export const ALL_TREE_NODES = Object.values(TREES).flat();
export const treeNode = (id: string) => ALL_TREE_NODES.find((n) => n.id === id);

/** Ranks bought, per node id, e.g. { "cooking.slots": 2 }. Missing = 0. */
export type TreeRanks = Record<string, number>;

/** Buying rank r costs r points (so a full 3-rank upgrade costs 1 + 2 + 3 = 6). */
export const rankCost = (rank: number) => rank;
/** Points that ranks 1..rank cost in all. */
export const totalCost = (rank: number) => (rank * (rank + 1)) / 2;

export const spentPoints = (ranks: TreeRanks) =>
  Object.entries(ranks).reduce((sum, [id, r]) => sum + (treeNode(id) ? totalCost(r) : 0), 0);
export const spentIn = (ranks: TreeRanks, skill: SkillId) =>
  TREES[skill].reduce((sum, n) => sum + totalCost(ranks[n.id] ?? 0), 0);

/** 1 point for every Mastery level above 1, in everything (items, tools, dishes, weapons, spells, monsters). */
export function earnedPoints(mastery: ItemMasteryXp, combatMastery: Record<string, number | undefined>): number {
  let points = 0;
  for (const xp of [...Object.values(mastery), ...Object.values(combatMastery)]) {
    if (typeof xp === "number" && xp > 0) points += masteryLevelForXp(xp) - 1;
  }
  return points;
}

/** What one skill's tree gives for one effect: e.g. cooking + success = 0.12 at rank 2. */
export function treeBonus(ranks: TreeRanks, skill: SkillId, effect: TreeEffect): number {
  return TREES[skill].reduce((sum, n) => sum + (n.effect === effect ? (ranks[n.id] ?? 0) * n.per : 0), 0);
}

/** Roll a chance from the tree (e.g. "does this try cost no stamina?"). */
export const treeRoll = (ranks: TreeRanks, skill: SkillId, effect: TreeEffect) => Math.random() < treeBonus(ranks, skill, effect);

/** "+10% Woodcutting speed": what a node gives at a rank. */
export function nodeEffect(n: TreeNode, rank: number, skillName: string): string {
  const v = n.per * rank;
  const pct = `${Math.round(v * 100)}%`;
  switch (n.effect) {
    case "speed": return `+${pct} ${skillName} speed`;
    case "double": return `${pct} chance of an extra one each time`;
    case "staminaSave": return `${pct} chance ${n.skill === "melee" || n.skill === "ranged" ? "an attack" : "it"} costs no stamina`;
    case "success": return `${pct} fewer failures`;
    case "xp": return `+${pct} ${skillName} XP`;
    case "extra": return `${pct} chance to make an extra one`;
    case "toolCare": return `${pct} chance your tools, weapons and armor don't wear down`;
    case "slots": return `+${v} ingredient${v === 1 ? "" : "s"} in the pot`;
    case "mealStamina": return `+${pct} stamina from every meal you eat`;
    case "accuracy": return `+${pct} hit chance`;
    case "damage": return `+${pct} damage`;
    case "manaSave": return `${pct} chance a spell costs no mana`;
    case "health": return `+${v} max health`;
    case "dodge": return `monsters hit you ${pct} less often`;
  }
}

/** Clean up ranks from a save: only real nodes, whole numbers within their max. */
export function cleanRanks(raw: unknown): TreeRanks {
  const out: TreeRanks = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, r] of Object.entries(raw as Record<string, unknown>)) {
    const n = treeNode(id);
    if (n && Number.isInteger(r) && (r as number) > 0) out[id] = Math.min(n.maxRank, r as number);
  }
  return out;
}
