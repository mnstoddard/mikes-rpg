// Gems and jewelry (Mining and Smithing).
//
// The crystal cave, through the spider cave past the quarry, has gem rocks
// (amethyst, topaz, emerald, sapphire, ruby) and emberstone veins. Every gem
// you mine has a size in carats, like "Ruby, 2.4 ct": a number, not a tier.
// Your Mining level and your Mastery of that rock push it bigger, and now and
// then you find a surprisingly big one. Sizes are kept in tenths of a carat in
// the item id ("rough_ruby_24" is a 2.4 ct rough ruby), so different sizes
// take separate bag slots.
//
// Rough gems need cutting at the anvil (Smithing). A cut can go well or badly:
// a flawless cut keeps the whole size, a clumsy one loses some, and now and
// then a gem shatters. A higher Smithing level cuts better. Emberstone always
// cuts cleanly into an empty refined emberstone of the same size (Spellcasting fills them later).
//
// Rings and amulets are made at the anvil from bars of bronze, silver, gold,
// platinum or iridium (each unlocks at a higher Smithing level), with a cut gem
// set in if you like. You wear 2 rings and 1 amulet. Gems give small bonuses:
// bigger gems and finer metals give more.
//
// Only type imports from items, so items.ts can build these.
import type { ItemId } from "./items";

export type GemId = "amethyst" | "topaz" | "emerald" | "sapphire" | "ruby";
export type RoughGemId = `rough_${GemId}_${number}`;
export type CutGemId = `gem_${GemId}_${number}`;
export type SoulStoneId = `soulstone_${number}`;
export type SoulGemId = `soulgem_${number}` | `soulgem_${number}_${number}`;
export type JewelMetal = "bronze" | "silver" | "gold" | "platinum" | "iridium";
export type JewelType = "ring" | "amulet";
export type JewelryId = `${JewelType}_${JewelMetal}` | `${JewelType}_${JewelMetal}_${GemId}_${number}`;
export type JewelBarId = "silver_bar" | "gold_bar" | "platinum_bar" | "iridium_bar";
export type GemItemId = RoughGemId | CutGemId | SoulStoneId | SoulGemId | JewelryId;

export interface GemDef {
  name: string;
  icon: string;
  tint: string;
  /** What it adds, per carat in a bronze setting. */
  stat: "health" | "mana" | "stamina" | "accuracy" | "armor";
  per: number;
  /** A shop pays this per carat for a rough one (cut ones are worth 3 times as much). */
  price: number;
}

export const GEMS: Record<GemId, GemDef> = {
  amethyst: { name: "Amethyst", icon: "💎", tint: "hue-rotate(60deg) saturate(1.4)", stat: "armor", per: 1, price: 15 },
  topaz:    { name: "Topaz",    icon: "💎", tint: "hue-rotate(200deg) saturate(2) brightness(1.2)", stat: "accuracy", per: 0.5, price: 25 },
  emerald:  { name: "Emerald",  icon: "💎", tint: "hue-rotate(260deg) saturate(1.6)", stat: "stamina", per: 3, price: 40 },
  sapphire: { name: "Sapphire", icon: "💎", tint: "hue-rotate(20deg) saturate(1.6) brightness(.8)", stat: "mana", per: 2, price: 60 },
  ruby:     { name: "Ruby",     icon: "💎", tint: "hue-rotate(140deg) saturate(2.5)", stat: "health", per: 2, price: 90 },
};
export const GEM_IDS = Object.keys(GEMS) as GemId[];
export const STAT_NAMES = { health: "max health", mana: "max mana", stamina: "max stamina", accuracy: "hit chance", armor: "armor" } as const;

export interface JewelMetalDef {
  name: string;
  tint: string;
  /** Smithing level to make jewelry from it. */
  level: number;
  /** A gem's bonus is multiplied by this. */
  mult: number;
  /** Smithing XP for a ring (an amulet takes 2 bars and gives twice as much). */
  xp: number;
  bar: ItemId;
}
export const JEWEL_METALS: Record<JewelMetal, JewelMetalDef> = {
  bronze:   { name: "Bronze",   tint: "sepia(1) saturate(2.5) hue-rotate(-15deg) brightness(.85)", level: 5,  mult: 1,   xp: 12, bar: "bronze_bar" },
  silver:   { name: "Silver",   tint: "grayscale(1) brightness(1.6)", level: 15, mult: 1.5, xp: 30, bar: "silver_bar" },
  gold:     { name: "Gold",     tint: "sepia(1) saturate(5) brightness(1.2)", level: 25, mult: 2,   xp: 50, bar: "gold_bar" },
  platinum: { name: "Platinum", tint: "grayscale(1) brightness(1.3) contrast(.9) hue-rotate(180deg)", level: 45, mult: 3, xp: 80, bar: "platinum_bar" },
  iridium:  { name: "Iridium",  tint: "hue-rotate(230deg) saturate(1.4) brightness(1.1)", level: 65, mult: 4,   xp: 120, bar: "iridium_bar" },
};
export const JEWEL_METAL_IDS = Object.keys(JEWEL_METALS) as JewelMetal[];
export const JEWEL_TYPES: Record<JewelType, { name: string; icon: string; bars: number }> = {
  ring: { name: "Ring", icon: "💍", bars: 1 },
  amulet: { name: "Amulet", icon: "📿", bars: 2 },
};

/** The new bars, smelted at the furnace from 2 ore each (iridium: 2 iridium ore and a coal). */
export const JEWEL_BARS: Record<JewelBarId, { name: string; tint: string; ores: ItemId[]; level: number; xp: number }> = {
  silver_bar:   { name: "Silver bar",   tint: JEWEL_METALS.silver.tint,   ores: ["silver_ore", "silver_ore"], level: 15, xp: 20 },
  gold_bar:     { name: "Gold bar",     tint: JEWEL_METALS.gold.tint,     ores: ["gold_ore", "gold_ore"], level: 25, xp: 30 },
  platinum_bar: { name: "Platinum bar", tint: JEWEL_METALS.platinum.tint, ores: ["platinum_ore", "platinum_ore"], level: 45, xp: 50 },
  iridium_bar:  { name: "Iridium bar",  tint: JEWEL_METALS.iridium.tint,  ores: ["iridium_ore", "iridium_ore", "coal"], level: 65, xp: 75 },
};
export const JEWEL_BAR_IDS = Object.keys(JEWEL_BARS) as JewelBarId[];

/** Sizes are tenths of a carat: 1 (0.1 ct) up to 100 (10 ct). */
export const MIN_SIZE = 1;
export const MAX_SIZE = 100;
const okSize = (s: string) => /^[1-9]\d*$/.test(s) && Number(s) >= MIN_SIZE && Number(s) <= MAX_SIZE;
/** 24 -> "2.4 ct". */
export const carats = (tenths: number) => `${(tenths / 10).toFixed(1)} ct`;
const isGemName = (g: string): g is GemId => (GEM_IDS as string[]).includes(g);

export type ParsedGem =
  | { kind: "rough" | "cut"; gem: GemId; size: number }
  | { kind: "soulstone"; size: number }
  | { kind: "soulgem"; size: number; souls: number }
  | { kind: "jewel"; type: JewelType; metal: JewelMetal; gem: GemId | null; size: number };

export function parseGem(item: string | null | undefined): ParsedGem | null {
  if (!item) return null;
  const p = item.split("_");
  if ((p[0] === "rough" || p[0] === "gem") && p.length === 3 && isGemName(p[1]) && okSize(p[2])) {
    return { kind: p[0] === "rough" ? "rough" : "cut", gem: p[1], size: Number(p[2]) };
  }
  if (p[0] === "soulstone" && p.length === 2 && okSize(p[1])) return { kind: "soulstone", size: Number(p[1]) };
  if (p[0] === "soulgem" && p.length === 2 && okSize(p[1])) return { kind: "soulgem", size: Number(p[1]), souls: 0 };
  if (p[0] === "soulgem" && p.length === 3 && okSize(p[1]) && /^[1-9]\d*$/.test(p[2]) && Number(p[2]) <= soulCapacity(Number(p[1]))) {
    return { kind: "soulgem", size: Number(p[1]), souls: Number(p[2]) };
  }
  if ((p[0] === "ring" || p[0] === "amulet") && Object.hasOwn(JEWEL_METALS, p[1] ?? "")) {
    if (p.length === 2) return { kind: "jewel", type: p[0], metal: p[1] as JewelMetal, gem: null, size: 0 };
    if (p.length === 4 && isGemName(p[2]) && okSize(p[3])) return { kind: "jewel", type: p[0], metal: p[1] as JewelMetal, gem: p[2], size: Number(p[3]) };
  }
  return null;
}
export const isGemItem = (item: string | null | undefined): item is GemItemId => parseGem(item) !== null;
export const isJewelry = (item: string | null | undefined): item is JewelryId => parseGem(item)?.kind === "jewel";
export const isRough = (item: string | null | undefined) => { const g = parseGem(item); return g?.kind === "rough" || g?.kind === "soulstone"; };
export const isCutGem = (item: string | null | undefined): item is CutGemId => parseGem(item)?.kind === "cut";

export const roughId = (gem: GemId, size: number) => `rough_${gem}_${size}` as RoughGemId;
export const cutId = (gem: GemId, size: number) => `gem_${gem}_${size}` as CutGemId;
export const soulStoneId = (size: number) => `soulstone_${size}` as SoulStoneId;
/** A refined emberstone, empty or holding some ember. */
export const soulGemId = (size: number, souls = 0) => (souls > 0 ? `soulgem_${size}_${Math.min(souls, soulCapacity(size))}` : `soulgem_${size}`) as SoulGemId;
/** Ember a refined emberstone holds when full: 50 per carat (size is in tenths of a carat). */
export const soulCapacity = (size: number) => size * 5;
/** How full a refined emberstone is, 0 to 1 (null if it isn't a refined emberstone). */
export function soulFill(item: string | null | undefined): number | null {
  const g = parseGem(item);
  return g?.kind === "soulgem" ? g.souls / soulCapacity(g.size) : null;
}
export const isSoulGem = (item: string | null | undefined): item is SoulGemId => parseGem(item)?.kind === "soulgem";
export function jewelId(type: JewelType, metal: JewelMetal, gem: CutGemId | null): JewelryId {
  if (!gem) return `${type}_${metal}`;
  const g = parseGem(gem) as { gem: GemId; size: number };
  return `${type}_${metal}_${g.gem}_${g.size}`;
}

/** Item name, icon and price for every gem item. */
export function gemItemDef(item: string): { name: string; single: string; icon: string; tint?: string; sellPrice: number } | null {
  const g = parseGem(item);
  if (!g) return null;
  const ct = g.size / 10;
  if (g.kind === "rough" || g.kind === "cut") {
    const d = GEMS[g.gem];
    const name = `${g.kind === "rough" ? "Rough " + d.name.toLowerCase() : d.name}, ${carats(g.size)}`;
    // Big gems are worth more than their size alone: price grows a bit faster than the carats.
    const price = Math.max(1, Math.round(d.price * Math.pow(ct, 1.3) * (g.kind === "cut" ? 3 : 1)));
    return { name, single: name.charAt(0).toLowerCase() + name.slice(1), icon: d.icon, tint: g.kind === "rough" ? `${d.tint} brightness(.75) contrast(.8)` : d.tint, sellPrice: price };
  }
  if (g.kind === "soulstone") {
    const name = `Emberstone, ${carats(g.size)}`;
    return { name, single: name.toLowerCase(), icon: "🪨", tint: "hue-rotate(220deg) saturate(1.5) brightness(.8)", sellPrice: Math.max(1, Math.round(30 * Math.pow(ct, 1.3))) };
  }
  if (g.kind === "soulgem") {
    // "Refined emberstone, 3.1 ct (45% full)": a fuller gem glows brighter and is worth more.
    const fill = g.souls / soulCapacity(g.size);
    const state = g.souls === 0 ? "empty" : fill >= 1 ? "full" : `${Math.floor(fill * 100)}% full`;
    const name = `Refined emberstone, ${carats(g.size)} (${state})`;
    return {
      name, single: name.toLowerCase(), icon: "🔮",
      tint: `hue-rotate(40deg) brightness(${(0.75 + 0.5 * fill).toFixed(2)}) saturate(${(1 + fill).toFixed(2)})`,
      sellPrice: Math.max(1, Math.round(60 * Math.pow(ct, 1.3) * (1 + fill))),
    };
  }
  if (g.kind !== "jewel") return null;
  const m = JEWEL_METALS[g.metal];
  const t = JEWEL_TYPES[g.type];
  const name = `${m.name} ${t.name.toLowerCase()}` + (g.gem ? ` (${GEMS[g.gem].name.toLowerCase()}, ${carats(g.size)})` : "");
  return { name, single: name.toLowerCase(), icon: t.icon, tint: m.tint, sellPrice: 0 };
}

/** What a piece of jewelry gives you: one stat, from its gem's size and its metal. */
export function jewelBonus(item: JewelryId): { stat: GemDef["stat"]; amount: number } | null {
  const g = parseGem(item);
  if (!g || g.kind !== "jewel" || !g.gem) return null;
  const d = GEMS[g.gem];
  const raw = d.per * (g.size / 10) * JEWEL_METALS[g.metal].mult * (g.type === "amulet" ? 1.5 : 1);
  return { stat: d.stat, amount: d.stat === "accuracy" ? Math.round(raw * 10) / 10 : Math.max(1, Math.round(raw)) };
}

/** "+5 max health", "+1.5% hit chance". */
export function describeBonus(b: { stat: GemDef["stat"]; amount: number } | null): string {
  if (!b) return "No gem set in it";
  return b.stat === "accuracy" ? `+${b.amount}% ${STAT_NAMES[b.stat]}` : `+${b.amount} ${STAT_NAMES[b.stat]}`;
}

// ---- Wearing it ----

export type JewelSlot = "ring1" | "ring2" | "amulet";
export const JEWEL_SLOTS: JewelSlot[] = ["ring1", "ring2", "amulet"];
export type Jewels = Record<JewelSlot, JewelryId | null>;
export const emptyJewels = (): Jewels => ({ ring1: null, ring2: null, amulet: null });

/** Everything your jewelry adds up to, per stat. */
export function jewelTotals(j: Jewels): Record<GemDef["stat"], number> {
  const out = { health: 0, mana: 0, stamina: 0, accuracy: 0, armor: 0 };
  for (const s of JEWEL_SLOTS) {
    const item = j[s];
    const b = item ? jewelBonus(item) : null;
    if (b) out[b.stat] += b.amount;
  }
  return out;
}

// ---- Mining a gem ----

/** Mining a gem rock: the size, in tenths of a carat. Mostly 0.1 to 1 ct at first, bigger with Mining level and the rock's Mastery. */
export function rollGemSize(miningLevel: number, nodeLevel: number, mastery: number): number {
  const mean = 0.4 + 0.03 * Math.max(0, miningLevel - nodeLevel) + 0.02 * (mastery - 1);
  // A spread around the average (a few much smaller, a few bigger)...
  let ct = mean * Math.exp((Math.random() + Math.random() + Math.random() - 1.5) * 0.9);
  // ...and once in a while a surprisingly big one.
  if (Math.random() < 0.03) ct *= 2.5 + Math.random() * 2;
  return Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(ct * 10)));
}

// ---- Cutting ----

export type CutResult = "flawless" | "good" | "clumsy" | "shattered";
/** Your chances at a Smithing level: shattering and clumsy cuts get rarer, flawless ones more common. */
export function cutChances(smithing: number): Record<CutResult, number> {
  const shattered = Math.max(0.02, 0.2 - 0.004 * smithing);
  const flawless = Math.min(0.6, 0.1 + 0.008 * smithing);
  const clumsy = Math.max(0.08, 0.4 - 0.006 * smithing);
  return { shattered, flawless, clumsy, good: Math.max(0, 1 - shattered - flawless - clumsy) };
}
/** How much of its size a cut keeps. */
export const CUT_KEEPS: Record<CutResult, number> = { flawless: 1, good: 0.85, clumsy: 0.6, shattered: 0 };
export function rollCut(smithing: number): CutResult {
  const c = cutChances(smithing);
  let r = Math.random();
  for (const k of ["shattered", "clumsy", "flawless", "good"] as CutResult[]) if ((r -= c[k]) < 0) return k;
  return "good";
}
/** Smithing XP for cutting one, by its size. */
export const cutXp = (size: number) => 4 + Math.ceil(size / 4);
/** Smithing level to cut each kind of gem. */
export const CUT_LEVEL: Record<GemId | "soul", number> = { amethyst: 5, topaz: 10, emerald: 15, sapphire: 20, ruby: 25, soul: 10 };
