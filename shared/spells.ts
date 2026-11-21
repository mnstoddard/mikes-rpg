// Spellcasting: the spell bar, spell books, and what Mastery does to a spell.
//
// - You learn most spells as your Spellcasting level goes up (Firebolt, Ward,
//   Frost bolt, Soul trap, Heal, Sleep). A few only come from spell books:
//   Haste, Invisibility and Frost nova. Books are rare monster drops, a guild
//   rank reward, and a few are sold at the Mages' Guild (Alchemist Moss).
// - The spell bar has 4 slots, plus 1 more for each spell you've raised to
//   Mastery 10 (up to 8). Click a slot, or press its number key, to cast it.
//   Bolts (Firebolt, Frost bolt, Sleep) need a staff: clicking one picks it as
//   the spell your staff fires.
// - Mastery of a spell makes it cheaper (-1% mana a level, down to half) and
//   stronger or longer (+2% a level).
// - Soul trap: a trapped monster glows purple for 60 seconds (blinking near the
//   end). If it dies trapped, its soul goes into the caster's best soul gem.
import { MONSTERS, MonsterId, SPELLS, SPELL_IDS, SpellId, CombatMasteryXp, combatMasteryIn } from "./combat";
import type { ItemId, SpellBookId } from "./items";
export type { SpellBookId };

export { SPELL_IDS };

/** Slots on the spell bar to start with, and the most it can have. */
export const BAR_START = 4;
export const BAR_MAX = 8;
/** Each spell at this Mastery adds a slot. */
export const BAR_SLOT_MASTERY = 10;

/** How many slots your spell bar has. */
export function barSlots(mastery: CombatMasteryXp): number {
  const strong = SPELL_IDS.filter((id) => combatMasteryIn(mastery, id) >= BAR_SLOT_MASTERY).length;
  return Math.min(BAR_MAX, BAR_START + strong);
}

/** Spells you know: everything at your level, and book spells you've read. */
export function knownSpells(level: number, books: readonly SpellId[]): SpellId[] {
  return SPELL_IDS.filter((id) => SPELLS[id].level <= level && (!SPELLS[id].book || books.includes(id)));
}

/** Mana a spell costs at this Mastery: -1% a level, never below half. */
export const spellMana = (id: SpellId, mastery: number) =>
  Math.max(1, Math.round(SPELLS[id].mana * (1 - Math.min(0.5, 0.01 * (mastery - 1)))));
/** How much stronger or longer a spell is at this Mastery: +2% a level. */
export const spellBoost = (mastery: number) => 1 + 0.02 * (mastery - 1);

/** Ward's shield or Heal's health: its power plus half your level, times Mastery. Haste: % faster (up to 50). */
export function spellPower(id: SpellId, level: number, mastery: number): number {
  const d = SPELLS[id];
  if (id === "haste") return Math.min(50, Math.round((d.power ?? 0) * spellBoost(mastery)));
  return Math.round(((d.power ?? 0) + Math.floor(level / 2)) * spellBoost(mastery));
}
/** How long it lasts, in seconds (Soul trap also gets the soul trap potion's bonus, in %). */
export const spellSeconds = (id: SpellId, mastery: number, potionBonus = 0) =>
  Math.round((SPELLS[id].seconds ?? 0) * spellBoost(mastery) * (1 + potionBonus / 100));
/** Frost nova's biggest hit: grows with your level. */
export const novaMaxHit = (level: number, mastery: number) => Math.round((SPELLS.frost_nova.maxHit + Math.floor(level / 5)) * spellBoost(mastery));
/** Frost nova reaches this far. */
export const NOVA_RADIUS = 2;
/** Soul trap and other target spells reach this far. */
export const TARGET_RANGE = 6;
/** Soul trap's glow starts blinking this many seconds before it ends. */
export const TRAP_BLINK_SECONDS = 10;

/** "Firebolt: 4 mana. A bolt of flame..." with your Mastery and level in it. */
export function describeSpell(id: SpellId, level: number, mastery: number): string {
  const d = SPELLS[id];
  const mana = spellMana(id, mastery);
  const bits: string[] = [];
  if (id === "ward") bits.push(`soaks up ${spellPower(id, level, mastery)} damage for ${spellSeconds(id, mastery)}s`);
  if (id === "heal") bits.push(`heals ${spellPower(id, level, mastery)}`);
  if (id === "haste") bits.push(`walk ${spellPower(id, level, mastery)}% faster for ${spellSeconds(id, mastery)}s`);
  if (id === "invisibility") bits.push(`lasts ${spellSeconds(id, mastery)}s`);
  if (id === "soul_trap") bits.push(`lasts ${spellSeconds(id, mastery)}s`);
  if (id === "frost_nova") bits.push(`hits up to ${novaMaxHit(level, mastery)}`);
  return `${d.name}: ${mana} mana${bits.length ? `, ${bits.join(", ")}` : ""}. ${d.description}${d.kind === "bolt" ? " Needs a staff in your hand." : ""}`;
}

// ---- Spell books ----

export type BookSpell = "haste" | "invisibility" | "frost_nova";
/** Which spell each book teaches (the books themselves are in shared/items.ts). */
export const SPELL_BOOKS: Record<SpellBookId, BookSpell> = {
  book_haste: "haste",
  book_invisibility: "invisibility",
  book_frost_nova: "frost_nova",
};
export const SPELL_BOOK_IDS = Object.keys(SPELL_BOOKS) as SpellBookId[];
export const isSpellBook = (item: string | null | undefined): item is SpellBookId => !!item && Object.hasOwn(SPELL_BOOKS, item);
export const bookFor = (spell: SpellId) => `book_${spell}` as ItemId;

// ---- Soul trap ----

/** Souls a monster gives a soul gem: stronger monsters give more. */
export const soulsOf = (kind: MonsterId) => MONSTERS[kind].level * 4 + Math.ceil(MONSTERS[kind].hp / 2);
