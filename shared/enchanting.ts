// Enchanting: a Wisdom skill. Add magic to a staff, a piece of armor or a tool
// at the enchanting altar in the Mages' Guild (Archmage Ysolde teaches it).
//
// Every enchantment uses up a soul gem with souls in it (Soul trap fills
// them). The more souls, the stronger it is. A staff also takes a cut gem,
// which decides what its bolts do:
//   ruby: fire (extra damage)       sapphire: frost (the monster is slowed)
//   emerald: poison (hurts over time)   topaz: lightning (jumps to a second monster)
//   amethyst: life steal (heals you)
// A bigger gem is stronger, up to a cap: 2 ct, or 4 ct with a silver inlay,
// or 7 ct with a gold inlay (a silver or gold bar set into the staff).
// An enchanted staff's bolts cost only 1 mana, and they hit harder.
//
// Armor: more max health, faster mana, less damage, or thorns.
// Tools: faster gathering, extra finds, less stamina, or more XP.
//
// One enchantment per item. The Enchanting skill tree adds a second slot,
// stronger enchantments, and re-enchanting. You can take an enchantment off,
// but it's gone (and so is its soul gem); without "Re-enchant" the item can't
// take a new one after that.
//
// An enchanted item keeps its plain id and adds "+" parts:
// "axe_iron_oak+swift.20", "staff_bronze_pine+fire.24.31" (power 24, a 3.1 ct gem),
// and "+spent" once an enchantment has been taken off.
import { GEMS, GemId } from "./jewelry";
import { TOOL_TYPES, baseItem, isTool, parseTool } from "./tools";
import { isArmor, isWeapon, parseWeapon, WEAPONS } from "./gear";

export type StaffEnchant = "fire" | "frost" | "poison" | "lightning" | "lifesteal";
export type ArmorEnchant = "vitality" | "manaflow" | "guard" | "thorns";
export type ToolEnchant = "swift" | "bounty" | "tireless" | "wisdom";
export type EnchantId = StaffEnchant | ArmorEnchant | ToolEnchant;
export type EnchantKind = "staff" | "armor" | "tool";

export interface EnchantDef {
  name: string;
  icon: string;
  on: EnchantKind;
  /** Staff enchantments: the cut gem that gives it. */
  gem?: GemId;
  /** Gathering tools only (an axe, not a hammer). */
  gatherOnly?: boolean;
  /** What it does at a power (and a staff's gem size in ct). */
  describe: (power: number, ct: number) => string;
}

export const ENCHANTS: Record<EnchantId, EnchantDef> = {
  fire:      { name: "Fire",       icon: "🔥", on: "staff", gem: "ruby",     describe: (p, ct) => `bolts burn for +${fireDamage(ct)} damage, +${staffHit(p)} hit` },
  frost:     { name: "Frost",      icon: "❄️", on: "staff", gem: "sapphire", describe: (p, ct) => `bolts slow the monster for ${(frostTicks(ct) * 0.6).toFixed(1)}s, +${staffHit(p)} hit` },
  poison:    { name: "Poison",     icon: "☠️", on: "staff", gem: "emerald",  describe: (p, ct) => `bolts poison for ${poisonDamage(ct)} damage 4 times, +${staffHit(p)} hit` },
  lightning: { name: "Lightning",  icon: "⚡", on: "staff", gem: "topaz",    describe: (p, ct) => `bolts jump to a second monster for ${chainPercent(ct)}% damage, +${staffHit(p)} hit` },
  lifesteal: { name: "Life steal", icon: "🩸", on: "staff", gem: "amethyst", describe: (p, ct) => `bolts heal you ${lifeStealPercent(ct)}% of the damage, +${staffHit(p)} hit` },
  vitality:  { name: "Vitality",   icon: "❤️", on: "armor", describe: (p) => `+${vitalityHp(p)} max health` },
  manaflow:  { name: "Mana flow",  icon: "🔮", on: "armor", describe: (p) => `mana comes back ${manaFlowPercent(p)}% faster` },
  guard:     { name: "Guard",      icon: "🛡️", on: "armor", describe: (p) => `${guardPercent(p)}% less damage` },
  thorns:    { name: "Thorns",     icon: "🌵", on: "armor", describe: (p) => `monsters that hit you take ${thornsDamage(p)} damage` },
  swift:     { name: "Swiftness",  icon: "⏩", on: "tool", gatherOnly: true, describe: (p) => `${swiftPercent(p)}% faster gathering` },
  bounty:    { name: "Bounty",     icon: "🍀", on: "tool", describe: (p) => `${bountyPercent(p)}% chance of an extra one` },
  tireless:  { name: "Tireless",   icon: "🪶", on: "tool", describe: (p) => `${tirelessPercent(p)}% chance it costs no stamina` },
  wisdom:    { name: "Wisdom",     icon: "📖", on: "tool", describe: (p) => `+${wisdomPercent(p)}% XP` },
};
export const ENCHANT_IDS = Object.keys(ENCHANTS) as EnchantId[];
export const isEnchantId = (id: string): id is EnchantId => Object.hasOwn(ENCHANTS, id);
/** The staff enchantment a cut gem gives. */
export const enchantForGem = (gem: GemId) => ENCHANT_IDS.find((e) => ENCHANTS[e].gem === gem)!;

// ---- Numbers ----

/** Power from a soul gem's souls: grows with the square root, so big gems still matter but don't run away. */
export const soulPower = (souls: number, enchantingLevel: number, potency = 0) =>
  Math.max(1, Math.round(2 * Math.sqrt(souls) * (1 + 0.01 * (enchantingLevel - 1)) * (1 + potency)));

/** Biggest gem (in tenths of a carat) a staff uses: 2 ct, more with a silver or gold inlay. */
export const INLAYS = { none: 20, silver_bar: 40, gold_bar: 70 } as const;
export type Inlay = keyof typeof INLAYS;

const pct = (n: number, cap: number) => Math.min(cap, Math.round(n));
export const staffHit = (p: number) => Math.ceil(p / 6);
export const fireDamage = (ct: number) => Math.ceil(ct * 1.5);
export const frostTicks = (ct: number) => Math.round(2 + ct * 2);
export const poisonDamage = (ct: number) => Math.max(1, Math.round(ct));
export const chainPercent = (ct: number) => pct(30 + 10 * ct, 100);
export const lifeStealPercent = (ct: number) => pct(10 + 8 * ct, 60);
export const vitalityHp = (p: number) => Math.ceil(p / 2);
export const manaFlowPercent = (p: number) => pct(p, 100);
export const guardPercent = (p: number) => pct(p / 3, 25);
export const thornsDamage = (p: number) => Math.ceil(p / 5);
export const swiftPercent = (p: number) => pct(p, 60);
export const bountyPercent = (p: number) => pct(p / 2, 40);
export const tirelessPercent = (p: number) => pct(p, 60);
export const wisdomPercent = (p: number) => pct(p / 2, 40);
/** Damage reduction from all your armor together can't go past this. */
export const GUARD_CAP = 50;

// ---- Item ids ----

export interface Enchantment { id: EnchantId; power: number; /** Staffs: the gem's size, in tenths of a carat. */ gem: number }

/** The enchantments on an item (none for a plain one). */
export function enchantsOf(item: string | null | undefined): Enchantment[] {
  if (!item) return [];
  const out: Enchantment[] = [];
  for (const part of item.split("+").slice(1)) {
    const [id, power, gem] = part.split(".");
    if (isEnchantId(id) && /^\d+$/.test(power ?? "")) out.push({ id, power: Number(power), gem: Number(gem ?? 0) || 0 });
  }
  return out;
}
/** Had an enchantment taken off (it needs "Re-enchant" to take a new one). */
export const isSpent = (item: string) => item.split("+").includes("spent");
export const isEnchanted = (item: string | null | undefined) => enchantsOf(item).length > 0;

/** What kind of enchantment fits this item: staffs, armor and tools (other weapons can't be enchanted). */
export function enchantKind(item: string | null | undefined): EnchantKind | null {
  if (!item) return null;
  if (isWeapon(item)) return WEAPONS[parseWeapon(item).type].style === "magic" ? "staff" : null;
  if (isArmor(item)) return "armor";
  if (isTool(item)) return "tool";
  return null;
}
/** Can this enchantment go on this item? */
export function fits(item: string, e: EnchantId): boolean {
  const d = ENCHANTS[e];
  if (enchantKind(item) !== d.on) return false;
  return !d.gatherOnly || TOOL_TYPES[parseTool(baseItem(item) as never).type].helps === "speed";
}

/** The item with one more enchantment ("+fire.24.31"). */
export function addEnchant(item: string, e: Enchantment): string {
  const keep = enchantsOf(item).filter((x) => x.id !== e.id);
  return [baseItem(item), ...(isSpent(item) ? ["spent"] : []), ...keep.map(partOf), partOf(e)].join("+");
}
/** Every enchantment taken off: the item is marked spent. */
export const stripEnchants = (item: string) => `${baseItem(item)}+spent`;
const partOf = (e: Enchantment) => e.gem ? `${e.id}.${e.power}.${e.gem}` : `${e.id}.${e.power}`;

/** "Fire: bolts burn for +4 damage, +3 hit". */
export const describeEnchant = (e: Enchantment) => `${ENCHANTS[e.id].icon} ${ENCHANTS[e.id].name}: ${ENCHANTS[e.id].describe(e.power, e.gem / 10)}`;

/** Item name for an enchanted item: "Iron axe (Oak) of Swiftness". */
export function enchantedName(base: string, item: string): string {
  const list = enchantsOf(item);
  if (!list.length) return base;
  return `${base} of ${list.map((e) => ENCHANTS[e.id].name).join(" and ")}`;
}

/** Sum of one enchantment across several items (e.g. Vitality on all your armor). */
export const enchantTotal = (items: (string | null | undefined)[], id: EnchantId) =>
  items.reduce((sum, it) => sum + enchantsOf(it).filter((e) => e.id === id).reduce((a, e) => a + e.power, 0), 0);

/** The staff enchantment's gem size in carats, capped by its inlay already (stored that way). */
export const gemCarats = (e: Enchantment) => e.gem / 10;

/** Gem a staff enchantment uses, by its size and inlay: the size it counts as. */
export const cappedGem = (size: number, inlay: Inlay) => Math.min(size, INLAYS[inlay]);
/** Max name for a gem effect: e.g. "Ruby". */
export const gemName = (gem: GemId) => GEMS[gem].name;
