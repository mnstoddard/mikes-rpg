// The bounty board: 5 jobs at a time, each asking for an amount of one item.
//
// The board stands next to the Merchant and opens once Old Maren's tutorial is
// done. Bounties only ask for things you could get yourself right now: types
// you can gather, things you can smelt, smith or cook (from materials you can
// gather), and drops from monsters you've already defeated.
//
// Hand in the full amount (no part hand-ins) and you get double what the
// Merchant would pay you for them (your Mastery counts), plus XP: the same XP
// as gathering or making them once more, in that item's skill. Monster drops
// give Combat XP and that monster's Mastery instead. A finished bounty is
// replaced by a new one, and Refresh (free for now) rerolls all 5.
// Shared so the board shows the same rewards the server pays.
import { ITEMS, ItemId } from "./items";
import { RESOURCES, RESOURCE_FOR_ITEM, RESOURCE_IDS, ResourceId } from "./foraging";
import { SkillId, SkillXp, findSkill, isUnlocked, levelForXp } from "./disciplines";
import { BAR_IDS, BarId, MATERIALS, MATERIAL_IDS, Material, METAL_IDS, TOOL_TYPE_IDS, WOOD_IDS, Wood, barId, hasHandle, isTool, isWoodTool, maxDurability, toolId } from "./tools";
import { ARMOR_TYPES, WEAPON_TYPES, armorId, isGear, weaponId } from "./gear";
import { DISHES, DISH_IDS, INGREDIENTS, INGREDIENT_IDS, fitsDish, mealId } from "./cooking";
import { CombatMasteryXp, MONSTERS, MONSTER_IDS, MonsterId, POTION_ID } from "./combat";
import { ItemMasteryXp } from "./mastery";
import { gearDurability, recipeFor, sellPriceFor } from "./crafting";

/** How many bounties are on the board at once. */
export const BOUNTY_COUNT = 5;
/** You get this many times what the Merchant would pay you. */
export const BOUNTY_PAY = 2;

export interface Bounty { item: ItemId; count: number }

/** What decides which bounties you can get: your levels, and which monsters you've defeated. */
export interface BountyPlayer {
  /** Skills you've been taught (shared/quests.ts unlockedSkills). */
  unlocked: SkillId[];
  skillXp: SkillXp;
  combatMastery: CombatMasteryXp;
}

const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pickOne = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** Have you been taught this skill, and is it at least this level? */
function skillAt(p: BountyPlayer, skill: SkillId, level: number): boolean {
  return isUnlocked(p.unlocked, skill) && levelForXp(p.skillXp[skill]) >= level;
}

const canGather = (p: BountyPlayer, r: ResourceId) => skillAt(p, RESOURCES[r].skill, RESOURCES[r].level);
const canSmelt = (p: BountyPlayer, bar: BarId) => {
  const recipe = recipeFor(bar)!;
  return skillAt(p, "smelting", recipe.level) && recipe.inputs.every((ore) => canGather(p, RESOURCE_FOR_ITEM[ore]!));
};
/** A tool or weapon head: stone you can mine, or a bar you can smelt. */
const canHead = (p: BountyPlayer, m: Material) => (m === "stone" ? canGather(p, "stone") : canSmelt(p, barId(m)));
const smithAt = (p: BountyPlayer, m: Material) => skillAt(p, "smithing", MATERIALS[m].level) && canHead(p, m);

/**
 * Everything a bounty could ask you for right now, in groups. A group is one
 * kind of thing ("Oak logs", "Bronze tools", "Trout stew"); the board picks a
 * group at random, then one exact item from it (which tool, which wood for the
 * handle, how many fish in the stew). Grouping keeps the dozens of axe, sword
 * and stew variants from crowding out logs, ore and fish.
 */
export function bountyChoices(p: BountyPlayer): ItemId[][] {
  const groups: ItemId[][] = [];
  // Gathering: every type you can chop, mine or catch.
  for (const r of RESOURCE_IDS) if (canGather(p, r)) groups.push([RESOURCES[r].item]);
  // Smelting.
  for (const bar of BAR_IDS) if (canSmelt(p, bar)) groups.push([bar]);
  // Smithing: tools and weapons take a handle of wood you can chop; armor is all metal.
  const woods = WOOD_IDS.filter((w) => canGather(p, w as ResourceId));
  // One group per metal for tools, one for weapons, one for armor, so smithing
  // (dozens of variants) doesn't fill the whole board.
  for (const m of MATERIAL_IDS) {
    if (!smithAt(p, m)) continue;
    groups.push(TOOL_TYPE_IDS.filter((type) => !isWoodTool(type)).flatMap((type) => (!hasHandle(type) ? [toolId(type, m, "pine")] : woods.map((w) => toolId(type, m, w)))));
    if (woods.length) groups.push(WEAPON_TYPES.flatMap((type) => woods.map((w) => weaponId(type, m, w))));
  }
  for (const m of METAL_IDS) if (smithAt(p, m)) groups.push(ARMOR_TYPES.map((type) => armorId(type, m)));
  // Fishing rods: all wood, so any wood you can chop and carve.
  const rodWoods = woods.filter((w) => skillAt(p, "smithing", RESOURCES[w as ResourceId].level));
  if (rodWoods.length) groups.push(rodWoods.map((w) => toolId("rod", "stone", w)));
  // Cooking: a dish you can cook of 1 to 3 of one fish you can catch, over a
  // log you can chop. (Fish only, so you can always get what it asks for.)
  for (const dish of DISH_IDS) {
    if (!woods.length || !skillAt(p, "cooking", DISHES[dish].level)) continue;
    for (const fish of INGREDIENT_IDS) {
      if (INGREDIENTS[fish].kind !== "fish" || !fitsDish(dish, fish) || !canGather(p, fish as ResourceId) || !skillAt(p, "cooking", INGREDIENTS[fish].level)) continue;
      groups.push([1, 2, 3].flatMap((n) => woods.map((w: Wood) => mealId(dish, w, Array(n).fill(fish)))));
    }
  }
  // Monster drops, from monsters you've defeated before (not potions: the Merchant sells those).
  for (const m of MONSTER_IDS) {
    if (!(p.combatMastery[m] ?? 0)) continue;
    for (const d of MONSTERS[m].drops) if (d.item !== POTION_ID) groups.push([d.item]);
  }
  return groups;
}

/** How many a bounty asks for: lots of raw things, a few bars and stews, one or two pieces of gear. */
function amountFor(item: ItemId): number {
  if (isTool(item) || isGear(item)) return rand(1, 2);
  const recipe = recipeFor(item);
  if (recipe?.skill === "cooking") return rand(1, 3);
  if (recipe) return rand(2, 5);
  if (RESOURCE_FOR_ITEM[item]) return rand(3, 8);
  return rand(2, 6); // monster drops
}

/** One new random bounty, for something not already on the board if possible. Null if nothing is unlocked. */
export function newBounty(p: BountyPlayer, taken: ItemId[] = []): Bounty | null {
  const groups = bountyChoices(p);
  if (!groups.length) return null;
  const fresh = groups.filter((g) => !g.some((item) => taken.includes(item)));
  const item = pickOne(pickOne(fresh.length ? fresh : groups));
  return { item, count: amountFor(item) };
}

/** A whole new board of 5. */
export function newBoard(p: BountyPlayer): Bounty[] {
  const board: Bounty[] = [];
  while (board.length < BOUNTY_COUNT) {
    const b = newBounty(p, board.map((x) => x.item));
    if (!b) break;
    board.push(b);
  }
  return board;
}

/** Which monster drops this (the first one that does), for monster-drop bounties. */
const dropper = (item: ItemId): MonsterId | null => MONSTER_IDS.find((m) => MONSTERS[m].drops.some((d) => d.item === item)) ?? null;

export interface BountyReward {
  coins: number;
  xp: number;
  /** Where the XP goes: a skill (Woodcutting...), or a monster's Mastery for monster drops. */
  skill?: SkillId;
  monster?: MonsterId;
  /** "Woodcutting", or "Wolf Mastery" for monster drops. */
  label: string;
  /** Renown XP: every bounty trains Renown, bigger ones more. */
  renown: number;
}

/** Renown for finishing a bounty: 5, plus 1 for each thing handed in. */
export const bountyRenown = (count: number) => 5 + count;

/**
 * What handing in a bounty pays: double what the Merchant would give you for
 * the items (with your Mastery), and the XP of gathering or making them once
 * more (monster drops: the monster's kill bonus each).
 */
export function bountyReward(b: Bounty, mastery: ItemMasteryXp): BountyReward {
  const coins = BOUNTY_PAY * sellPriceFor(b.item, mastery) * b.count;
  const resource = RESOURCE_FOR_ITEM[b.item];
  if (resource) {
    const r = RESOURCES[resource];
    return { coins, xp: r.xp * b.count, skill: r.skill, label: findSkill(r.skill).def.name, renown: bountyRenown(b.count) };
  }
  const recipe = recipeFor(b.item);
  if (recipe) {
    return { coins, xp: recipe.xp * b.count, skill: recipe.skill, label: findSkill(recipe.skill).def.name, renown: bountyRenown(b.count) };
  }
  const monster = dropper(b.item);
  return { coins, xp: (monster ? MONSTERS[monster].xp : 1) * b.count, monster: monster ?? undefined, label: monster ? `${MONSTERS[monster].name} Mastery` : "Mastery", renown: bountyRenown(b.count) };
}

/**
 * Can this bag slot go toward a bounty for `item`? Not if it's locked, and
 * tools, weapons and armor must be unused (full uses left).
 */
export function slotCounts(item: ItemId, slotItem: ItemId | null, locked: boolean, durability: number | null | undefined): boolean {
  if (slotItem !== item || locked) return false;
  if (isTool(item)) return durability == null || durability >= maxDurability(item);
  if (isGear(item)) return durability == null || durability >= gearDurability(item);
  return true;
}

/** "8 Pine logs", "1 Bronze axe (Oak)". */
export const bountyName = (b: Bounty) => `${b.count} ${ITEMS[b.item].name}`;

/** Is this a bounty a save could hold? (Guards against old or broken saves.) */
export const validBounty = (b: unknown): b is Bounty =>
  !!b && typeof b === "object" && typeof (b as Bounty).item === "string" && (b as Bounty).item in ITEMS &&
  Number.isInteger((b as Bounty).count) && (b as Bounty).count >= 1 && (b as Bounty).count <= 28;
