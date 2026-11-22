// Alchemy: a Wisdom skill. Brew potions at the alchemy table in the Mages' Guild.
//
// Pick 2 or 3 ingredients from your bag. Two of them decide the potion (red
// cap + slime goo = a health potion). A third, from a short list, adds a bonus
// (sage makes it stronger, honey adds stamina, old bones make a buff last
// longer...). Every potion also uses up an empty vial (Alchemist Moss sells them).
//
// A potion's strength is worked out when you drink it, from your Alchemy level
// (+3% a level) and its bonus, like meals use your Cooking Mastery.
// Potions stack 10 to a slot. After drinking one you wait 10 seconds before
// the next (shop health potions too).
//
// Most recipes are listed at the table. A few are hidden: mix the right two
// things and you discover them.
//
// Only type imports from items, so items.ts can build potion items from this.
import type { ItemId } from "./items";

export type PotionType = "health" | "stamina" | "mana" | "restore" | "strength" | "swift" | "hunter" | "nightsight" | "soultrap" | "tithe";
export type BonusId = "sage" | "honey" | "mushroom" | "old_bone" | "moonpetal";
export type PotionId = `potion_${PotionType}` | `potion_${PotionType}_${BonusId}`;
/** Each kind of potion has its own Alchemy Mastery ("potion_health"). */
export type PotionMastery = `potion_${PotionType}`;
/** Effects that last a while (potions, and the Ward, Haste and Invisibility spells). */
export type BuffId = "strength" | "swift" | "nightsight" | "soultrap" | "ward" | "haste" | "invisible" | "blessed";

export const VIAL: ItemId = "vial";
export const POTION_COOLDOWN_MS = 10_000;
/** Buff potions last this long (old bones make it 1.5 times as long). */
export const BUFF_MINUTES = 5;

export interface PotionDef {
  name: string;
  icon: string;
  tint?: string;
  /** Alchemy level needed. */
  level: number;
  /** The two ingredients that make it (any order). */
  pair: [ItemId, ItemId];
  /** Alchemy XP for a brew that works. */
  xp: number;
  /** Success at Mastery 1. */
  start: number;
  /** Not listed at the table until you've brewed one. */
  hidden?: boolean;
  /** What it does at Alchemy level 1 (before bonuses): restores, or a buff's strength in %. */
  heal?: number;
  stamina?: number;
  mana?: number;
  buffs?: Partial<Record<BuffId, number>>;
  /** Clears this many Tithe marks (shared/story.ts). */
  tithe?: number;
  description: string;
}

const RED = "hue-rotate(120deg) saturate(2)";
export const POTIONS: Record<PotionType, PotionDef> = {
  health:     { name: "Health potion",     icon: "🧪", tint: RED, level: 1,  pair: ["red_cap", "slime_goo"],   xp: 6,  start: 0.65, heal: 30, description: "Restores health" },
  stamina:    { name: "Stamina potion",    icon: "🧪", tint: "hue-rotate(260deg) saturate(2)", level: 3,  pair: ["ginseng", "honey"], xp: 9,  start: 0.6, stamina: 40, description: "Restores stamina" },
  mana:       { name: "Mana potion",       icon: "🧪", tint: "hue-rotate(0deg) saturate(1.6)", level: 5,  pair: ["blue_lotus", "bat_wing"], xp: 12, start: 0.6, mana: 30, description: "Restores mana" },
  restore:    { name: "Restoration draught", icon: "⚗️", level: 8, pair: ["slime_goo", "blue_lotus"], xp: 14, start: 0.5, heal: 18, mana: 18, hidden: true, description: "Restores some health and some mana" },
  strength:   { name: "Strength potion",   icon: "🧪", tint: "hue-rotate(160deg) saturate(3) brightness(.8)", level: 10, pair: ["wolf_fang", "sage"], xp: 16, start: 0.5, buffs: { strength: 10 }, description: "Your weapon hits harder for a while" },
  swift:      { name: "Swiftness potion",  icon: "🧪", tint: "hue-rotate(60deg) saturate(2)", level: 15, pair: ["boar_tusk", "ginseng"], xp: 20, start: 0.5, buffs: { swift: 15 }, description: "You walk faster for a while" },
  hunter:     { name: "Hunter's brew",     icon: "⚗️", tint: "sepia(.6) saturate(2)", level: 18, pair: ["wolf_fang", "boar_tusk"], xp: 24, start: 0.45, buffs: { strength: 6, swift: 8 }, hidden: true, description: "A little stronger and a little faster, for a while" },
  nightsight: { name: "Night sight potion", icon: "🧪", tint: "hue-rotate(200deg) saturate(1.2) brightness(1.3)", level: 20, pair: ["moonpetal", "blue_lotus"], xp: 26, start: 0.45, buffs: { nightsight: 100 }, description: "You see clearly at night, for a while" },
  // Act 1 (Tithe Tonics): Alchemist Moss tells you the recipe.
  tithe:      { name: "Tithe tonic",       icon: "🧪", tint: "sepia(1) saturate(4) hue-rotate(10deg) brightness(1.2)", level: 2, pair: ["red_cap", "wild_root"], xp: 10, start: 0.7, tithe: 1, hidden: true, description: "Clears one Tithe mark" },
  soultrap:   { name: "Soul trap potion",  icon: "🧪", tint: "hue-rotate(80deg) saturate(1.5) brightness(.7)", level: 25, pair: ["venom_sac", "moonpetal"], xp: 32, start: 0.4, buffs: { soultrap: 50 }, description: "Your Soul trap spell lasts longer, for a while" },
};
export const POTION_TYPES = Object.keys(POTIONS) as PotionType[];

export interface BonusDef {
  /** "with sage": the potion's name ends "(sage)". */
  name: string;
  /** Strength multiplier. */
  power?: number;
  /** Extra health or stamina on top. */
  heal?: number;
  stamina?: number;
  /** Buffs last this many times longer. */
  longer?: number;
  note: string;
}

/** A third ingredient that adds something. Anything else won't go in as a third. */
export const BONUSES: Record<BonusId, BonusDef> = {
  sage:      { name: "sage",      power: 1.3,  note: "30% stronger" },
  moonpetal: { name: "moonpetal", power: 1.6,  note: "60% stronger" },
  honey:     { name: "honey",     stamina: 15, note: "also gives 15 stamina" },
  mushroom:  { name: "mushroom",  heal: 10,    note: "also heals 10" },
  old_bone:  { name: "bone",      longer: 1.5, power: 1.1, note: "buffs last half as long again, and 10% stronger" },
};
export const BONUS_IDS = Object.keys(BONUSES) as BonusId[];

export const BUFFS: Record<BuffId, { name: string; icon: string; describe: (power: number) => string }> = {
  strength:   { name: "Strength",    icon: "💪", describe: (p) => `+${p}% weapon damage` },
  swift:      { name: "Swiftness",   icon: "💨", describe: (p) => `walk ${p}% faster` },
  nightsight: { name: "Night sight", icon: "🌙", describe: () => "see clearly at night" },
  soultrap:   { name: "Soul trap",   icon: "👻", describe: (p) => `Soul trap lasts ${p}% longer` },
  ward:       { name: "Ward",        icon: "🛡️", describe: (p) => `soaks up ${p} more damage` },
  haste:      { name: "Haste",       icon: "💨", describe: (p) => `walk ${p}% faster` },
  invisible:  { name: "Invisible",   icon: "🫥", describe: () => "monsters can't see you" },
  blessed:    { name: "Blessed",     icon: "✨", describe: (p) => `+${p}% XP` },
};
export const BUFF_IDS = Object.keys(BUFFS) as BuffId[];

/** Every ingredient alchemy uses (as one of a pair, or as a bonus). */
export const ALCHEMY_INGREDIENTS = new Set<string>([...POTION_TYPES.flatMap((t) => POTIONS[t].pair), ...BONUS_IDS]);

export const potionId = (type: PotionType, bonus: BonusId | null = null): PotionId =>
  (bonus ? `potion_${type}_${bonus}` : `potion_${type}`) as PotionId;

/** "potion_health_sage" -> { type: "health", bonus: "sage" }, or null. */
export function parsePotion(item: string | null | undefined): { type: PotionType; bonus: BonusId | null } | null {
  if (!item || !item.startsWith("potion_")) return null;
  const rest = item.slice(7);
  for (const type of POTION_TYPES) {
    if (rest === type) return { type, bonus: null };
    if (rest.startsWith(`${type}_`)) {
      const b = rest.slice(type.length + 1);
      // A bonus can't be one of the potion's own two ingredients.
      if ((BONUS_IDS as string[]).includes(b) && !POTIONS[type].pair.includes(b as ItemId)) return { type, bonus: b as BonusId };
    }
  }
  return null;
}
export const isPotion = (item: string | null | undefined): item is PotionId => parsePotion(item) !== null;

/**
 * What 2 or 3 ingredients make, or null. Two must be a potion's pair; a third
 * must be a bonus. (Includes hidden recipes: whether you know them is up to the caller.)
 */
export function potionFrom(ingredients: string[]): PotionId | null {
  if (ingredients.length < 2 || ingredients.length > 3) return null;
  for (const type of POTION_TYPES) {
    const rest = [...ingredients];
    let ok = true;
    for (const need of POTIONS[type].pair) {
      const i = rest.indexOf(need);
      if (i < 0) { ok = false; break; }
      rest.splice(i, 1);
    }
    if (!ok) continue;
    if (!rest.length) return potionId(type);
    const id = potionId(type, rest[0] as BonusId);
    if (parsePotion(id)) return id;
  }
  return null;
}

/** What goes into one: its pair, its bonus, and a vial. */
export function potionInputs(id: PotionId): ItemId[] {
  const { type, bonus } = parsePotion(id)!;
  return [...POTIONS[type].pair, ...(bonus ? [bonus as ItemId] : []), VIAL];
}

export interface PotionEffect {
  heal: number;
  stamina: number;
  mana: number;
  buffs: { id: BuffId; power: number }[];
  /** How long the buffs last. */
  minutes: number;
  /** Tithe marks it clears. */
  tithe: number;
}

/** Strength from your Alchemy level: +3% a level. */
export const alchemyPower = (level: number) => 1 + 0.03 * (level - 1);

/** What drinking it does, for someone at this Alchemy level. */
export function potionEffect(id: PotionId, alchemyLevel: number): PotionEffect {
  const { type, bonus } = parsePotion(id)!;
  const d = POTIONS[type];
  const b = bonus ? BONUSES[bonus] : null;
  const mult = alchemyPower(alchemyLevel) * (b?.power ?? 1);
  const r = (n?: number) => (n ? Math.round(n * mult) : 0);
  return {
    heal: r(d.heal) + (b?.heal ?? 0),
    stamina: r(d.stamina) + (b?.stamina ?? 0),
    mana: r(d.mana),
    buffs: Object.entries(d.buffs ?? {}).map(([k, v]) => ({ id: k as BuffId, power: k === "nightsight" ? 100 : r(v) })),
    minutes: BUFF_MINUTES * (b?.longer ?? 1),
    tithe: d.tithe ?? 0,
  };
}

/** "Heals 34, +15 stamina" / "+12% weapon damage for 5 minutes". */
export function describeEffect(e: PotionEffect): string {
  const parts: string[] = [];
  if (e.heal) parts.push(`heals ${e.heal}`);
  if (e.stamina) parts.push(`+${e.stamina} stamina`);
  if (e.mana) parts.push(`+${e.mana} mana`);
  if (e.tithe) parts.push(`clears ${e.tithe} Tithe mark${e.tithe === 1 ? "" : "s"}`);
  if (e.buffs.length) parts.push(`${e.buffs.map((b) => BUFFS[b.id].describe(b.power)).join(", ")} for ${e.minutes} minutes`);
  const s = parts.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Buffs on a character: when each runs out (server time, ms) and how strong it is. */
export type Buffs = Partial<Record<BuffId, { until: number; power: number }>>;
/** A buff's strength right now (0 if it's not on). */
export const buffPower = (buffs: Buffs, id: BuffId, now: number) => ((buffs[id]?.until ?? 0) > now ? buffs[id]!.power : 0);
