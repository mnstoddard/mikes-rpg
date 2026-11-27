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
import { WOOD_DAMAGE } from "./handicraft";
import { WORLD_SPAWNS } from "./world";
import {
  ARMOR, ARMOR_METAL, CLOTH_MANA_PER, CLOTH_SPELL_DAMAGE, CombatStyle, GEAR_SLOTS, Gear, METAL_DAMAGE, METAL_SLOW_PER_BAR, WEAPONS, WeaponType, isArmor, isSoftArmor, isWeapon, isWooden, parseArmor, parseWeapon,
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

// ---- Spells ----
// Bolts (Firebolt, Frost bolt, Sleep) fly from a staff in your hand. The rest
// are cast straight from your spell bar (shared/spells.ts): on yourself, on a
// monster, or all around you.

/** Spells you fire from a staff. */
export type BoltSpellId = "fire_blast" | "frost_bolt" | "sleep";
export type SpellId = BoltSpellId | "ward" | "soul_trap" | "heal" | "mend" | "haste" | "invisibility" | "frost_nova";
export interface SpellDef {
  name: string;
  icon: string;
  /** bolt: fired from a staff. self: on you. target: on a monster. area: every monster around you. */
  kind: "bolt" | "self" | "target" | "area";
  /** Spellcasting level needed. */
  level: number;
  /** Only learned from a spell book (shared/spells.ts SPELL_BOOKS). */
  book?: boolean;
  /** Mana at Mastery 1 (Mastery lowers it). */
  mana: number;
  /** Biggest hit (a bolt adds its staff's metal). 0 = no damage. */
  maxHit: number;
  /** The monster can't move for this many ticks. */
  freeze?: number;
  /** Sleep: the monster can't move or attack for this many ticks. */
  sleep?: number;
  /** Ward: damage it soaks up. Heal: health. Haste: % faster. (Plus half your level for Ward and Heal; Mastery adds more.) */
  power?: number;
  /** How long it lasts at Mastery 1, in seconds. */
  seconds?: number;
  description: string;
}
export const SPELLS: Record<SpellId, SpellDef> = {
  fire_blast:   { name: "Firebolt",     icon: "🔥", kind: "bolt",   level: 1,  mana: 4,  maxHit: 4, description: "A bolt of flame from your staff." },
  ward:         { name: "Ward",         icon: "🛡️", kind: "self",   level: 3,  mana: 10, maxHit: 0, power: 8, seconds: 120, description: "A shield of light that soaks up damage until it breaks or runs out." },
  frost_bolt:   { name: "Frost bolt",   icon: "❄️", kind: "bolt",   level: 5,  mana: 7,  maxHit: 5, freeze: 8, description: "Hits, and freezes the monster in place for about 5 seconds." },
  soul_trap:    { name: "Ember trap",    icon: "👻", kind: "target", level: 6,  mana: 8,  maxHit: 0, seconds: 60, description: "Traps a monster's ember. Defeat it before the glow fades and its ember fills one of your refined emberstones." },
  heal:         { name: "Heal",         icon: "💚", kind: "self",   level: 8,  mana: 12, maxHit: 0, power: 12, description: "Heals you." },
  sleep:        { name: "Sleep",        icon: "💤", kind: "bolt",   level: 10, mana: 12, maxHit: 0, sleep: 10, description: "No damage, but the monster falls asleep for 6 seconds: it can't move or attack." },
  mend:         { name: "Mend",         icon: "🪡", kind: "self",   level: 18, mana: 20, maxHit: 0, description: "Mends your most worn tool, weapon or armor piece by drawing the ember out of a spare of the same kind in your bag (any axe for an axe). The spare is used up. A spare as good as yours fixes it fully; a poorer one only a little." },
  haste:        { name: "Haste",        icon: "💨", kind: "self",   level: 12, book: true, mana: 15, maxHit: 0, power: 20, seconds: 60, description: "You walk faster for a while." },
  invisibility: { name: "Invisibility", icon: "🫥", kind: "self",   level: 15, book: true, mana: 20, maxHit: 0, seconds: 15, description: "Monsters can't see you. It breaks when you attack or gather." },
  frost_nova:   { name: "Frost nova",   icon: "🌨️", kind: "area",   level: 20, book: true, mana: 18, maxHit: 6, freeze: 8, description: "Hits every monster next to you (2 tiles) and freezes them." },
};
export const BOLT_SPELLS: BoltSpellId[] = ["fire_blast", "frost_bolt", "sleep"];
export const isBoltSpell = (id: string): id is BoltSpellId => (BOLT_SPELLS as string[]).includes(id);
export const SPELL_IDS = Object.keys(SPELLS) as SpellId[];

// ---- Monsters ----

export type MonsterId = "chicken" | "rat" | "cow" | "slime" | "boar" | "giant_bat" | "wolf" | "cave_spider" | "goblin" | "spider" | "bandit" | "alpha_wolf"
  | "ashbound_scout" | "hollow_wolf";
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
  boar:    { name: "Boar",         icon: "🐗", level: 7,  hp: 22, maxHit: 3, speed: 4, aggressive: false, xp: 7,  respawnTicks: 90,  drops: [{ item: "raw_boar", chance: 0.8 }, { item: "boar_tusk", chance: 0.4 }, { item: "boar_hide", chance: 0.5 }], coins: [0, 0] },
  // Out at night only: over the meadows (they only bite back there) and in the forest (they attack on sight).
  giant_bat: { name: "Giant bat",  icon: "🦇", level: 6,  hp: 14, maxHit: 2, speed: 3, aggressive: true,  xp: 6,  respawnTicks: 80,  drops: [{ item: "bat_wing", chance: 0.6 }], coins: [0, 3], night: true },
  // The Dark Forest: they attack on sight.
  wolf:    { name: "Wolf",         icon: "🐺", level: 8,  hp: 20, maxHit: 3, speed: 4, aggressive: true,  xp: 8,  respawnTicks: 100, drops: [{ item: "wolf_pelt", chance: 0.5 }, { item: "wolf_fang", chance: 0.4 }], coins: [1, 5], pack: true },
  // The little cave east of the quarry (it counts as danger, like the forest).
  cave_spider: { name: "Cave spider", icon: "🕷️", level: 14, hp: 34, maxHit: 5, speed: 3, aggressive: true, xp: 14, respawnTicks: 110, drops: [{ item: "spider_silk", chance: 0.5 }, { item: "venom_sac", chance: 0.3 }], coins: [2, 10] },
  goblin:  { name: "Goblin",       icon: "👺", level: 12, hp: 30, maxHit: 4, speed: 4, aggressive: true,  xp: 12, respawnTicks: 100, drops: [{ item: "goblin_charm", chance: 0.35 }, { item: POTION_ID, chance: 0.1 }, { item: "book_haste", chance: 0.02 }], coins: [3, 12] },
  spider:  { name: "Giant spider", icon: "🕷️", level: 18, hp: 42, maxHit: 6, speed: 3, aggressive: true,  xp: 18, respawnTicks: 120, drops: [{ item: "spider_silk", chance: 0.5 }, { item: POTION_ID, chance: 0.1 }, { item: "book_frost_nova", chance: 0.02 }], coins: [5, 15] },
  // The wolf den (Kael's Wolf Hunt): a big, tough pack leader. Best fought as a party.
  alpha_wolf: { name: "Alpha wolf", icon: "🐺", level: 22, hp: 160, maxHit: 9, speed: 4, aggressive: true, xp: 90, respawnTicks: 500, drops: [{ item: "alpha_pelt", chance: 1 }, { item: "wolf_fang", chance: 1 }, { item: POTION_ID, chance: 0.3 }], coins: [40, 90], pack: true },
  // The story's Ashbound (shared/story.ts): scouts on the Westroad, raiders deep in the Thornwood (id "bandit" from before).
  ashbound_scout: { name: "Ashbound scout", icon: "🥷", level: 9, hp: 24, maxHit: 3, speed: 4, aggressive: false, xp: 10, respawnTicks: 60, drops: [{ item: POTION_ID, chance: 0.08 }, { item: "red_cap", chance: 0.3 }], coins: [2, 8] },
  // Blighted wolves at Wolf Hollow (Act 1): grey, glowing and mean.
  hollow_wolf: { name: "Hollow wolf", icon: "🐺", level: 13, hp: 32, maxHit: 4, speed: 4, aggressive: true, xp: 14, respawnTicks: 80, drops: [{ item: "wolf_pelt", chance: 0.5 }, { item: "wolf_fang", chance: 0.6 }], coins: [3, 9], pack: true },
  bandit:  { name: "Ashbound raider",       icon: "🦹", level: 25, hp: 60, maxHit: 8, speed: 4, aggressive: true,  xp: 26, respawnTicks: 150, drops: [{ item: "stolen_ring", chance: 0.25 }, { item: POTION_ID, chance: 0.25 }, { item: "book_invisibility", chance: 0.03 }], coins: [15, 45] },
};
export const MONSTER_IDS = Object.keys(MONSTERS) as MonsterId[];

/** Where monsters live: [type, home x, home y]. They wander a few tiles from home. Placed in shared/world.ts. */
export const MONSTER_SPAWNS: readonly [MonsterId, number, number][] = WORLD_SPAWNS;
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
  spell?: BoltSpellId;
  name: string;
}

export function attackFor(gear: Gear, spell: BoltSpellId): Attack {
  const w = gear.weapon?.item;
  if (!isWeapon(w)) return { style: "melee", mastery: "fists", maxHit: 1, speed: 4, range: 1, accuracy: 0, name: "your fists" };
  const { type, metal, wood } = parseWeapon(w);
  const def = WEAPONS[type];
  const accuracy = WOODS[wood].bonus;
  // Bows and staffs get their strength from the wood; everything else from its metal.
  const extra = isWooden(type) ? WOOD_DAMAGE[wood] + (metal === "stone" ? 0 : METAL_DAMAGE[metal]) : METAL_DAMAGE[metal];
  if (def.style === "magic") {
    const s = SPELLS[spell];
    const cloth = 1 + clothPieces(gear) * CLOTH_SPELL_DAMAGE;
    return { style: "magic", mastery: spell, maxHit: s.maxHit ? Math.round((s.maxHit + extra) * cloth) : 0, speed: def.speed, range: def.range, accuracy, spell, name: s.name };
  }
  return { style: def.style, mastery: type, maxHit: def.maxHit + extra, speed: def.speed, range: def.range, accuracy, name: def.name.toLowerCase() };
}

/** Cloth pieces you're wearing (they make spells stronger). */
export const clothPieces = (gear: Gear) => GEAR_SLOTS.filter((s) => { const it = gear[s]?.item; return isArmor(it) && parseArmor(it).metal === "cloth"; }).length;
/** Extra max mana from cloth. */
export const clothMana = (gear: Gear) => GEAR_SLOTS.reduce((sum, s) => {
  const it = gear[s]?.item;
  return sum + (isArmor(it) && parseArmor(it).metal === "cloth" ? ARMOR[parseArmor(it).type].bars * CLOTH_MANA_PER : 0);
}, 0);
/** How much metal armor slows your walking (0.05 = 5% slower). */
export const metalSlow = (gear: Gear) => GEAR_SLOTS.reduce((sum, s) => {
  const it = gear[s]?.item;
  return sum + (isArmor(it) && !isSoftArmor(parseArmor(it).metal) ? ARMOR[parseArmor(it).type].bars * METAL_SLOW_PER_BAR : 0);
}, 0);

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
    const extra = isWooden(type) ? WOOD_DAMAGE[wood] + (metal === "stone" ? 0 : METAL_DAMAGE[metal]) : METAL_DAMAGE[metal];
    if (def.style === "magic") return `Spells hit up to ${extra} harder, +${acc}% to hit`;
    return `Hits up to ${def.maxHit + extra}${type === "bow" ? " (plus the arrow's tip)" : ""}, every ${(def.speed * 0.6).toFixed(1)}s, +${acc}% to hit` +
      (def.range > 1 ? `, from ${def.range} tiles away` : "") + (def.twoHanded ? ", two hands (no shield)" : "");
  }
  if (isArmor(item)) {
    const { type, metal } = parseArmor(item);
    const pts = ARMOR[type].points * ARMOR_METAL[metal];
    const bars = ARMOR[type].bars;
    const more = metal === "cloth" ? `, +${bars * CLOTH_MANA_PER} max mana, spells ${Math.round(CLOTH_SPELL_DAMAGE * 100)}% stronger`
      : metal === "leather" ? "" : `, walk ${bars}% slower`;
    return `+${pts} armor: monsters hit you ${pts}% less often${more}`;
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
export const ARMOR_LEVEL = { bronze: 1, iron: 15, steel: 30, mithril: 60, leather: 1, cloth: 1 } as const;
