// Renown (stage 12): how well known you are. Renown XP comes from bounties
// (the board in the square, and the Mages' Guild's). Captain Bryn hands out
// ranks as your Renown level grows, each with a title you can show over your
// head, and sells special things to those who hold them.
//
// Titles you can pick: your Renown ranks, and your Mages' Guild rank (from
// Apprentice up), which is separate (shared/guild.ts).
import { RANKS } from "./guild";

export interface RenownRank { title: string; level: number }

/** Rank 0 is no rank yet. Bryn gives the others when you talk to him at these Renown levels. */
export const RENOWN_RANKS: RenownRank[] = [
  { title: "", level: 1 },
  { title: "Wanderer", level: 5 },
  { title: "Trusted", level: 15 },
  { title: "Champion", level: 30 },
];

/** The highest rank your Renown level is good enough for. */
export const rankForRenown = (level: number) => {
  let r = 0;
  RENOWN_RANKS.forEach((rank, i) => { if (i > 0 && level >= rank.level) r = i; });
  return r;
};

/** Every title you've earned: Renown ranks Bryn gave you, and guild ranks from Apprentice up. */
export function earnedTitles(renownRank: number, guildRank: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= renownRank; i++) out.push(RENOWN_RANKS[i].title);
  for (let i = 1; i <= guildRank; i++) out.push(RANKS[i].name);
  return out;
}

/** What Bryn's window shows. */
export interface RenownView {
  level: number;
  rank: number;
  title: string;
  titles: string[];
}
