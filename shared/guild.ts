// The Mages' Guild: an enchanted storage chest you rent space in, and the
// guild's own bounty board of magic jobs that raise your guild rank.
//
// - Rent a chest from the Archmage for 1 gold: 4 spaces. Each space holds one
//   stack, like a bag slot (shared/bag.ts).
// - Pay more to add 4 spaces at a time. Each step costs more than the last.
// - How big your chest can get depends on your guild rank. Rank goes up with
//   guild points, which you earn from the guild's bounty board.
// - The same chest opens from every enchanted chest in the world (the guild
//   hall, the east island and the Dark Forest).
//
// Shared so the client shows the same costs and rewards the server uses.
import { ITEMS, ItemId } from "./items";
import { MONSTERS, MONSTER_IDS, MonsterId } from "./combat";
import { BRONZE_PER_GOLD } from "./money";

// ---- Chest ----

/** Renting a chest: 1 gold for 4 spaces. */
export const CHEST_RENT = 1 * BRONZE_PER_GOLD;
export const CHEST_START = 4;
/** Each expansion adds this many spaces. */
export const CHEST_STEP = 4;
/** What each expansion costs, in gold: 4 to 8 spaces costs 2 gold, 8 to 12 costs 4, and so on. */
export const EXPAND_GOLD = [2, 4, 7, 12, 20, 30];
export const CHEST_MAX = CHEST_START + CHEST_STEP * EXPAND_GOLD.length; // 28, a whole bag

/** What the next expansion costs (in bronze), or null if the chest is as big as it gets. */
export function expandCost(size: number): number | null {
  const step = (size - CHEST_START) / CHEST_STEP;
  const gold = EXPAND_GOLD[step];
  return gold == null ? null : gold * BRONZE_PER_GOLD;
}

// ---- Rank ----

export interface Rank { name: string; points: number; maxChest: number }

/** Guild points you need for each rank, and the biggest chest that rank may rent. */
export const RANKS: Rank[] = [
  { name: "Initiate", points: 0, maxChest: 4 },
  { name: "Apprentice", points: 5, maxChest: 8 },
  { name: "Adept", points: 15, maxChest: 12 },
  { name: "Conjurer", points: 30, maxChest: 16 },
  { name: "Enchanter", points: 50, maxChest: 20 },
  { name: "Magus", points: 80, maxChest: 24 },
  { name: "Archmage", points: 120, maxChest: 28 },
];

export const rankFor = (points: number): number => {
  let r = 0;
  RANKS.forEach((rank, i) => { if (points >= rank.points) r = i; });
  return r;
};

// ---- The guild's bounty board: magic jobs ----

/** How many guild bounties are up at once. */
export const GUILD_BOUNTY_COUNT = 3;

/**
 * - "slay": defeat monsters with spells (a staff). Progress counts up as you go.
 * - "reagent": bring things the guild uses for enchanting (from your bag, all at once).
 */
export type GuildBounty =
  | { kind: "slay"; monster: MonsterId; count: number; progress: number }
  | { kind: "reagent"; item: ItemId; count: number }
  /** Stage 12: trap souls (Soul trap), brew potions (Alchemy), enchant things (Enchanting). Count up as you go. */
  | { kind: "trap" | "brew" | "enchant"; count: number; progress: number };
/** The jobs that count up by themselves. */
export const MAGIC_JOBS = ["trap", "brew", "enchant"] as const;
export type MagicJob = typeof MAGIC_JOBS[number];
const JOB_INFO: Record<MagicJob, { icon: string; name: (n: number) => string; count: [number, number]; points: number; xp: number; coins: number }> = {
  trap: { icon: "👻", name: (n) => `Trap ${n} soul${n === 1 ? "" : "s"} in soul gems`, count: [2, 5], points: 2, xp: 15, coins: 30 },
  brew: { icon: "⚗️", name: (n) => `Brew ${n} potion${n === 1 ? "" : "s"}`, count: [3, 6], points: 1, xp: 10, coins: 25 },
  enchant: { icon: "✨", name: (n) => `Enchant ${n} thing${n === 1 ? "" : "s"} at the altar`, count: [1, 2], points: 3, xp: 25, coins: 60 },
};
export const jobIcon = (kind: MagicJob) => JOB_INFO[kind].icon;
export type JobBounty = Extract<GuildBounty, { kind: MagicJob }>;
export const isJob = (b: GuildBounty): b is JobBounty => b.kind === "trap" || b.kind === "brew" || b.kind === "enchant";

/** Things the guild enchants with. Only ones you can get show up (see `reagentChoices`). */
export const REAGENTS: ItemId[] = [
  "feather", "rat_tail", "cowhide", "wolf_pelt", "goblin_charm", "spider_silk", "stolen_ring",
  "yew_logs", "ironwood_logs", "elderwood_logs", "silver_ore", "gold_ore", "mithril_ore", "eel", "swordfish",
];

/** What a player can be asked for: their Magic level, and which reagents they could get right now. */
export interface GuildPlayer {
  magicLevel: number;
  /** Reagents this player can gather or has seen drop (from the normal bounty board's rules). */
  reagents: ItemId[];
  /** Magic jobs this player can do: knows Soul trap, has learned Alchemy, has learned Enchanting. */
  jobs?: MagicJob[];
}

const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pickOne = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** Monsters you can be sent to blast: up to a few levels above your Magic level. */
export const slayChoices = (p: GuildPlayer) => MONSTER_IDS.filter((m) => MONSTERS[m].level <= p.magicLevel + 3);

export function newGuildBounty(p: GuildPlayer, taken: GuildBounty[] = []): GuildBounty {
  const monsters = slayChoices(p).filter((m) => !taken.some((b) => b.kind === "slay" && b.monster === m));
  const reagents = p.reagents.filter((r) => !taken.some((b) => b.kind === "reagent" && b.item === r));
  // A soul trapping, brewing or enchanting job about a third of the time (one of each at most).
  const jobs = (p.jobs ?? []).filter((j) => !taken.some((b) => b.kind === j));
  if (jobs.length && Math.random() < 0.35) {
    const kind = pickOne(jobs);
    return { kind, count: rand(...JOB_INFO[kind].count), progress: 0 };
  }
  // About half of each, when both are possible.
  if (monsters.length && (!reagents.length || Math.random() < 0.55)) {
    const monster = pickOne(monsters);
    return { kind: "slay", monster, count: rand(3, 6), progress: 0 };
  }
  if (reagents.length) {
    const item = pickOne(reagents);
    return { kind: "reagent", item, count: ITEMS[item].sellPrice >= 50 ? rand(1, 3) : rand(3, 8) };
  }
  return { kind: "slay", monster: "chicken", count: rand(3, 6), progress: 0 };
}

export function newGuildBoard(p: GuildPlayer): GuildBounty[] {
  const board: GuildBounty[] = [];
  while (board.length < GUILD_BOUNTY_COUNT) board.push(newGuildBounty(p, board));
  return board;
}

export interface GuildReward { points: number; magicXp: number; coins: number }

/**
 * Guild points (rank), Magic XP and a little money. Tougher monsters and
 * rarer reagents are worth more points.
 */
export function guildReward(b: GuildBounty): GuildReward {
  if (isJob(b)) {
    const j = JOB_INFO[b.kind];
    return { points: j.points + Math.floor(b.count / 3), magicXp: j.xp * b.count, coins: j.coins * b.count };
  }
  if (b.kind === "slay") {
    const m = MONSTERS[b.monster];
    return { points: 1 + Math.floor(m.level / 6), magicXp: m.xp * b.count, coins: 5 * m.level * b.count };
  }
  const value = ITEMS[b.item].sellPrice * b.count;
  return { points: 1 + Math.floor(value / 60), magicXp: Math.ceil(value / 3), coins: 2 * value };
}

/** "Defeat 4 Wolves with spells" / "Bring 5 Feathers". */
export function guildBountyName(b: GuildBounty): string {
  if (isJob(b)) return JOB_INFO[b.kind].name(b.count);
  if (b.kind === "slay") return `Defeat ${b.count} × ${MONSTERS[b.monster].name} with spells`;
  return `Bring ${b.count} × ${ITEMS[b.item].name}`;
}

/** Is this a guild bounty a save could hold? */
export function validGuildBounty(b: unknown): b is GuildBounty {
  if (!b || typeof b !== "object") return false;
  const x = b as GuildBounty;
  if (!Number.isInteger(x.count) || x.count < 1 || x.count > 50) return false;
  if (x.kind === "slay") return MONSTER_IDS.includes(x.monster) && Number.isInteger(x.progress) && x.progress >= 0;
  if (x.kind === "trap" || x.kind === "brew" || x.kind === "enchant") return Number.isInteger(x.progress) && x.progress >= 0;
  return x.kind === "reagent" && x.item in ITEMS;
}

/** What the client needs to draw the guild window. */
export interface GuildView {
  points: number;
  rank: number;
  chestSize: number; // 0 = no chest rented yet
  bounties: GuildBounty[];
}

/** Renown XP for finishing a guild bounty: 5, plus 2 for each guild point it gives. */
export const guildRenown = (points: number) => 5 + 2 * points;
