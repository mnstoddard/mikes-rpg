// What each Discipline does for you. Every number here is a first guess, to be
// balanced after playing (see docs/DESIGN.md, section 1).
//
// - Strength raises max health.
// - Endurance raises max stamina.
// - Wisdom raises max mana.
// - Dexterity raises how much you can carry, and how fast you walk (up to a cap).
// - Charisma gets you better prices: shops pay you more and charge you less.
// Shared so the client shows the same numbers the server uses.

/** Health: 50 at Strength 1, +5 per level (540 at 99). */
export const maxHealth = (strength: number) => 45 + 5 * strength;
/** Stamina: 100 at Endurance 1, +5 per level (590 at 99). */
export const maxStamina = (endurance: number) => 95 + 5 * endurance;
/** Mana: 50 at Wisdom 1, +5 per level (540 at 99). */
export const maxMana = (wisdom: number) => 45 + 5 * wisdom;
/** What you can carry, in tenths of a kg: 45 kg at Dexterity 1, +1 kg per level (143 kg at 99). */
export const carryCapacity = (dexterity: number) => 440 + 10 * dexterity;
/** Walking: 1% faster per Dexterity level above 1, capped at 30% (reached at Dexterity 31). */
export const WALK_BONUS_CAP = 0.3;
export const walkBonus = (dexterity: number) => Math.min(WALK_BONUS_CAP, 0.01 * Math.max(0, dexterity - 1));
/**
 * Running: hold Shift or tap 🏃 to run 80% faster. Each tile you run uses 1 of
 * your stamina for the moment ("out of breath"), so you can run as many tiles
 * as you have stamina. Stop running (or stand still) and after RUN_REST_MS it
 * all comes back, RUN_REFILL a tick: running never costs stamina for good.
 */
export const RUN_SPEED = 1.8;
export const RUN_COST = 1;
export const RUN_REST_MS = 2500;
export const RUN_REFILL = 8;
/** Prices: 0.3% better per Charisma level above 1 (about 29% at 99), both selling and buying. */
export const priceBonus = (charisma: number) => 0.003 * Math.max(0, charisma - 1);
/** Trading (a Charisma skill): another 0.2% better per level above 1 (about 20% at 99), on top of Charisma. */
export const tradingBonus = (trading: number) => 0.002 * Math.max(0, trading - 1);
/** What a shop pays you for something worth `price`, with your Charisma (and Trading level). */
export const sellWithCharisma = (price: number, charisma: number, trading = 1) => Math.floor(price * (1 + priceBonus(charisma) + tradingBonus(trading)));
/** What a shop charges you for something priced `price`, with your Charisma and Trading (never under 1 bronze, and never below 60%). */
export const buyWithCharisma = (price: number, charisma: number, trading = 1) => Math.max(1, Math.ceil(price * Math.max(0.6, 1 - priceBonus(charisma) - tradingBonus(trading))));
/** Trading XP for a sale worth this much (in bronze): 1 XP per 5 bronze, at least 1. Buying gives none. */
export const tradingXp = (bronze: number) => Math.max(1, Math.floor(bronze / 5));
