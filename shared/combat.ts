// Combat: monsters, spells, health and mana, and the numbers behind every hit.
// Shared so the client shows the same hit chances the server uses.
//
// You fight with what's in your gear strip's Weapon slot: a melee weapon
// (dagger, sword...), a ranged one (sling, darts, bow) or a staff for spells.
// With nothing in your hand you punch. Every hit gives XP to Combat, to the
// skill you used (Melee, Ranged or Magic), to that weapon's (or spell's)
// Mastery, and to that monster's Mastery. Getting attacked trains Defense.
//
// Only type imports from items, so items.ts can import this.
import type { ItemId } from "./items";
import { masteryLevelForXp } from "./mastery";
import { WOODS } from "./tools";
import {
  ARMOR, ARMOR_METAL, CombatStyle, GEAR_SLOTS, Gear, METAL_DAMAGE, WEAPONS, WeaponType, isArmor, isWeapon, parseArmor, parseWeapon,
} from "./gear";

// ---- Health and mana ----

// Max health comes from Strength, max mana from Wisdom (shared/stats.ts).
export { maxHealth, maxMana } from "./stats";
/** Mana comes back 1 every 6 seconds (10 ticks), online or off. */
export const MANA_REGEN_TICKS = 10;
/** Health comes back very slowly on its own: 1 a minute (100 ticks). Potions are the quick way. */
export const HEALTH_REGEN_TICKS = 100;
export const HEALTH_REGEN_MS = 60_000;
/** Health potion: gives this much health. */
export const POTION_HEAL = 30;
export const POTION_ID = "health_potion";

/** Weapon attacks cost this much stamina each (spells cost mana instead). */
export const ATTACK_STAMINA = 1;

// ---- Spells (need a staff in your hand) ----

export type SpellId = "fire_blast" | "frost_bolt" | "sleep";
export interface SpellDef {
  name: string;
  icon: string;
  /** Magic level needed. */
  level: number;
  mana: number;
  /** Biggest hit (plus your staff's metal). 0 = no damage. */
  maxHit: number;
  /** Frost bolt: the monster can't move for this many ticks. */
  freeze?: number;
  /** Sleep: the monster can't move or attack for this many ticks. */
  sleep?: number;
  description: string;
}
export const SPELLS: Record<SpellId, SpellDef> = {
  fire_blast: { name: "Fire blast", icon: "🔥", level: 1,  mana: 4,  maxHit: 4, description: "A burst of flame." },
  frost_bolt: { name: "Frost bolt", icon: "❄️", level: 5,  mana: 7,  maxHit: 5, freeze: 8, description: "Hits, and freezes the monster in place for about 5 seconds." },
  sleep:      { name: "Sleep",      icon: "💤", level: 10, mana: 12, maxHit: 0, sleep: 10, description: "No damage, but the monster falls asleep for 6 seconds: it can't move or attack." },
};
export const SPELL_IDS = Object.keys(SPELLS) as SpellId[];

// ---- Monsters ----

export type MonsterId = "chicken" | "rat" | "cow" | "slime" | "boar" | "giant_bat" | "wolf" | "cave_spider" | "goblin" | "spider" | "bandit";
export interface Drop { item: ItemId; chance: number }
export interface MonsterDef {
  name: string;
  icon: string;
  level: number;
  hp: number;
  /** Biggest hit on you. 0 = never fights back. */
  maxHit: number;
  /** Ticks between its attacks. */
  speed: number;
  /** Attacks you on sight (danger zone monsters). Otherwise only if it fights back when you hit it. */
  aggressive: boolean;
  /** Bonus XP for the kill (on top of 1 XP per damage). */
  xp: number;
  /** Ticks until it comes back after you defeat it (100 = 1 minute). */
  respawnTicks: number;
  drops: Drop[];
  /** Bronze coins it drops: [least, most]. */
  coins: [number, number];
  /** Only out at night (it vanishes at sunrise and comes back at dusk). */
  night?: boolean;
  /** Runs in a pack: when one goes for you, the others nearby join in. */
  pack?: boolean;
}

export const MONSTERS: Record<MonsterId, MonsterDef> = {
  // Near town: chickens and cows never fight back; rats bite back.
  chicken: { name: "Chicken",      icon: "🐔", level: 1,  hp: 4,  maxHit: 0, speed: 4, aggressive: false, xp: 1,  respawnTicks: 50,  drops: [{ item: "feather", chance: 0.6 }, { item: "raw_chicken", chance: 0.7 }], coins: [0, 0] },
  rat:     { name: "Rat",          icon: "🐀", level: 2,  hp: 6,  maxHit: 1, speed: 4, aggressive: false, xp: 2,  respawnTicks: 50,  drops: [{ item: "rat_tail", chance: 0.5 }], coins: [0, 2] },
  cow:     { name: "Cow",          icon: "🐄", level: 3,  hp: 12, maxHit: 0, speed: 4, aggressive: false, xp: 4,  respawnTicks: 70,  drops: [{ item: "cowhide", chance: 0.6 }, { item: "raw_beef", chance: 0.7 }], coins: [0, 0] },
  slime:   { name: "Slime",        icon: "🟢", level: 2,  hp: 8,  maxHit: 1, speed: 5, aggressive: false, xp: 2,  respawnTicks: 50,  drops: [{ item: "slime_goo", chance: 0.7 }], coins: [0, 1] },
  boar:    { name: "Boar",         icon: "🐗", level: 7,  hp: 22, maxHit: 3, speed: 4, aggressive: false, xp: 7,  respawnTicks: 90,  drops: [{ item: "raw_boar", chance: 0.8 }, { item: "boar_tusk", chance: 0.4 }], coins: [0, 0] },
  // Out at night only: over the meadows (they only bite back there) and in the forest (they attack on sight).
  giant_bat: { name: "Giant bat",  icon: "🦇", level: 6,  hp: 14, maxHit: 2, speed: 3, aggressive: true,  xp: 6,  respawnTicks: 80,  drops: [{ item: "bat_wing", chance: 0.6 }], coins: [0, 3], night: true },
  // The Dark Forest: they attack on sight.
  wolf:    { name: "Wolf",         icon: "🐺", level: 8,  hp: 20, maxHit: 3, speed: 4, aggressive: true,  xp: 8,  respawnTicks: 100, drops: [{ item: "wolf_pelt", chance: 0.5 }, { item: "wolf_fang", chance: 0.4 }], coins: [1, 5], pack: true },
  // The little cave east of the quarry (it counts as danger, like the forest).
  cave_spider: { name: "Cave spider", icon: "🕷️", level: 14, hp: 34, maxHit: 5, speed: 3, aggressive: true, xp: 14, respawnTicks: 110, drops: [{ item: "spider_silk", chance: 0.5 }, { item: "venom_sac", chance: 0.3 }], coins: [2, 10] },
  goblin:  { name: "Goblin",       icon: "👺", level: 12, hp: 30, maxHit: 4, speed: 4, aggressive: true,  xp: 12, respawnTicks: 100, drops: [{ item: "goblin_charm", chance: 0.35 }, { item: POTION_ID, chance: 0.1 }], coins: [3, 12] },
  spider:  { name: "Giant spider", icon: "🕷️", level: 18, hp: 42, maxHit: 6, speed: 3, aggressive: true,  xp: 18, respawnTicks: 120, drops: [{ item: "spider_silk", chance: 0.5 }, { item: POTION_ID, chance: 0.1 }], coins: [5, 15] },
  bandit:  { name: "Bandit",       icon: "🦹", level: 25, hp: 60, maxHit: 8, speed: 4, aggressive: true,  xp: 26, respawnTicks: 150, drops: [{ item: "stolen_ring", chance: 0.25 }, { item: POTION_ID, chance: 0.25 }], coins: [15, 45] },
};
export const MONSTER_IDS = Object.keys(MONSTERS) as MonsterId[];

/** Where monsters live: [type, home x, home y]. They wander a few tiles from home. */
export const MONSTER_SPAWNS: [MonsterId, number, number][] = [
  // Chickens in the field north-west of town.
  ["chicken", 6, 3], ["chicken", 8, 4], ["chicken", 6, 5], ["chicken", 9, 3], ["chicken", 7, 7],
  // Rats around the quarry rocks, north of Trainer Row.
  ["rat", 20, 2], ["rat", 25, 1], ["rat", 25, 3], ["rat", 20, 3],
  // Slimes in the wet meadow by the lake.
  ["slime", 2, 7], ["slime", 9, 8], ["slime", 2, 13], ["slime", 9, 14],
  // Cows and boars in the meadow south-east of the square.
  ["cow", 29, 18], ["cow", 31, 17], ["boar", 34, 17], ["boar", 33, 19],
  // Giant bats come out at night.
  ["giant_bat", 36, 9], ["giant_bat", 2, 10], ["giant_bat", 28, 17], ["giant_bat", 24, 23],
  // Cave spiders in the little cave east of the quarry.
  ["cave_spider", 29, 1], ["cave_spider", 31, 2],
  // The Dark Forest, past the gate: wolf packs near the gate, goblins west, spiders east, bandits deep south.
  ["wolf", 22, 23], ["wolf", 23, 24], ["wolf", 31, 23], ["wolf", 32, 24], ["wolf", 25, 25], ["wolf", 26, 26], ["wolf", 34, 25],
  ["goblin", 11, 26], ["goblin", 14, 28], ["goblin", 10, 29], ["goblin", 16, 25],
  ["spider", 40, 27], ["spider", 44, 26], ["spider", 46, 29],
  ["bandit", 28, 30], ["bandit", 33, 31],
];
/** How far from home a monster wanders, and chases you before giving up. */
export const WANDER_RADIUS = 3;
export const LEASH_RADIUS = 8;
/** Danger zone monsters notice you within this many tiles. */
export const AGGRO_RADIUS = 4;

// ---- Mastery in combat ----
// Each weapon type, spell and monster has its own Mastery. Weapon and spell
// Mastery help you hit and hit harder; monster Mastery helps you hit that
// monster and makes it drop things more often.

export type CombatMasteryId = WeaponType | "fists" | SpellId | MonsterId;
export type CombatMasteryXp = Partial<Record<CombatMasteryId, number>>;
export const combatMasteryIn = (m: CombatMasteryXp, id: CombatMasteryId) => masteryLevelForXp(m[id] ?? 0);

/** Hit chance from Mastery: +0 at Mastery 1, about +7% at 10, +20% at 50, never more than +25%. */
export const masteryAccuracy = (level: number) => 0.25 * (1 - Math.exp(-0.0436 * (level - 1)));
/** Weapon and spell Mastery: +1% damage per level (rounded down, so it shows on small hits later). */
export const masteryDamage = (level: number) => 1 + (level - 1) * 0.01;
/** Monster Mastery: each drop is +2% per level more likely (Mastery 51 = twice as likely). */
export const masteryDrops = (level: number) => 1 + (level - 1) * 0.02;

// ---- Hunting ----
// Every defeated monster gives Hunting XP to everyone who hurt it, shared out by
// how much of its health each one took. Hunting makes drops more likely.

/** Hunting XP for a whole kill (split by damage share). */
export const huntingXp = (monster: MonsterId) => MONSTERS[monster].xp + MONSTERS[monster].level;
/** Hunting: each drop is +1% per level more likely (Hunting 51 = +50%). */
export const huntingDrops = (level: number) => 1 + (level - 1) * 0.01;

export const ALL_COMBAT_MASTERY_IDS: CombatMasteryId[] = [...(Object.keys(WEAPONS) as WeaponType[]), "fists", ...SPELL_IDS, ...MONSTER_IDS];

export function combatMasteryName(id: CombatMasteryId): string {
  if (id === "fists") return "Fists";
  if (id in SPELLS) return SPELLS[id as SpellId].name;
  if (id in MONSTERS) return MONSTERS[id as MonsterId].name;
  return WEAPONS[id as WeaponType].name;
}

// ---- Your attack ----

/** What you're attacking with right now: from your Weapon slot (and spell, for a staff). */
export interface Attack {
  style: CombatStyle;
  /** Whose Mastery it trains: the weapon type, "fists", or the spell. */
  mastery: CombatMasteryId;
  maxHit: number;
  speed: number;
  range: number;
  /** Extra hit chance from the weapon's wood. */
  accuracy: number;
  spell?: SpellId;
  name: string;
}

export function attackFor(gear: Gear, spell: SpellId): Attack {
  const w = gear.weapon?.item;
  if (!isWeapon(w)) return { style: "melee", mastery: "fists", maxHit: 1, speed: 4, range: 1, accuracy: 0, name: "your fists" };
  const { type, metal, wood } = parseWeapon(w);
  const def = WEAPONS[type];
  const accuracy = WOODS[wood].bonus;
  if (def.style === "magic") {
    const s = SPELLS[spell];
    return { style: "magic", mastery: spell, maxHit: s.maxHit ? s.maxHit + METAL_DAMAGE[metal] : 0, speed: def.speed, range: def.range, accuracy, spell, name: s.name };
  }
  return { style: def.style, mastery: type, maxHit: def.maxHit + METAL_DAMAGE[metal], speed: def.speed, range: def.range, accuracy, name: def.name.toLowerCase() };
}

/** Your biggest hit after Mastery. */
export const maxHitWith = (a: Attack, masteryLevel: number) => a.maxHit ? Math.max(1, Math.floor(a.maxHit * masteryDamage(masteryLevel))) : 0;

/**
 * Chance one of your attacks lands: 55%, +2% per level your skill is above the
 * monster's (−2% below), plus your weapon's wood, your weapon (or spell) Mastery
 * and your Mastery of that monster. Between 5% and 95%.
 */
export function hitChance(skillLevel: number, monster: MonsterId, a: Attack, weaponMastery: number, monsterMastery: number, treeAccuracy = 0): number {
  const c = 0.55 + 0.02 * (skillLevel - MONSTERS[monster].level) + a.accuracy + masteryAccuracy(weaponMastery) + masteryAccuracy(monsterMastery) + treeAccuracy;
  return Math.max(0.05, Math.min(0.95, c));
}

// ---- Defense ----

/** Armor points from everything you're wearing. Each point takes 1% off monsters' hit chance. */
export function armorPoints(gear: Gear): number {
  let total = 0;
  for (const slot of GEAR_SLOTS) {
    const it = gear[slot]?.item;
    if (isArmor(it)) {
      const { type, metal } = parseArmor(it);
      total += ARMOR[type].points * ARMOR_METAL[metal];
    }
  }
  return total;
}

/** Chance a monster's attack lands on you: 50%, +2% per level it's above your Defense, −1% per armor point. 5% to 90%. */
export function monsterHitChance(monster: MonsterId, defenseLevel: number, armor: number, treeDodge = 0): number {
  const c = 0.5 + 0.02 * (MONSTERS[monster].level - defenseLevel) - armor / 100 - treeDodge;
  return Math.max(0.05, Math.min(0.9, c));
}

/** Defense XP each time a monster attacks you (hit or miss). */
export const defenseXp = (monster: MonsterId) => Math.max(1, Math.ceil(MONSTERS[monster].level / 4));

/** Tiles between two points, counting diagonals as 1 (like walking). */
export const tileDistance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// ---- Describing gear (item cards, anvil, messages) ----

/** "Hits up to 3, every 1.8s, +5% to hit" / "+4 armor: monsters hit you 4% less often". */
export function gearEffect(item: string): string {
  if (isWeapon(item)) {
    const { type, metal, wood } = parseWeapon(item);
    const def = WEAPONS[type];
    const acc = Math.round(WOODS[wood].bonus * 100);
    if (def.style === "magic") return `Spells hit up to ${METAL_DAMAGE[metal]} harder, +${acc}% to hit`;
    return `Hits up to ${def.maxHit + METAL_DAMAGE[metal]}, every ${(def.speed * 0.6).toFixed(1)}s, +${acc}% to hit` +
      (def.range > 1 ? `, from ${def.range} tiles away` : "") + (def.twoHanded ? ", two hands (no shield)" : "");
  }
  if (isArmor(item)) {
    const { type, metal } = parseArmor(item);
    const pts = ARMOR[type].points * ARMOR_METAL[metal];
    return `+${pts} armor: monsters hit you ${pts}% less often`;
  }
  return "";
}

/** What you need to hold or wear it: { skill: "melee", level: 5 }. Armor needs Defense at its metal's level. */
export function gearNeeds(item: string): { skill: "melee" | "ranged" | "magic" | "defense"; level: number } | null {
  if (isWeapon(item)) {
    const def = WEAPONS[parseWeapon(item).type];
    return { skill: def.style, level: def.level };
  }
  if (isArmor(item)) return { skill: "defense", level: ARMOR_LEVEL[parseArmor(item).metal] };
  return null;
}
/** Defense level to wear each metal (the same as the Smithing level to make it). */
export const ARMOR_LEVEL = { bronze: 1, iron: 15, steel: 30, mithril: 60 } as const;
