// Money is stored as one number: the total in bronze coins.
// 100 bronze = 1 silver, 100 silver = 1 gold, 100 gold = 1 platinum,
// 100 platinum = 1 iridium.
export const BRONZE_PER_SILVER = 100;
export const SILVER_PER_GOLD = 100;
export const BRONZE_PER_GOLD = BRONZE_PER_SILVER * SILVER_PER_GOLD;
export const BRONZE_PER_PLATINUM = BRONZE_PER_GOLD * 100;
export const BRONZE_PER_IRIDIUM = BRONZE_PER_PLATINUM * 100;

export interface Purse { iridium: number; platinum: number; gold: number; silver: number; bronze: number }
/** Biggest coin first. */
export const COIN_KINDS = ["iridium", "platinum", "gold", "silver", "bronze"] as const;

export function toPurse(totalBronze: number): Purse {
  const iridium = Math.floor(totalBronze / BRONZE_PER_IRIDIUM);
  const platinum = Math.floor((totalBronze % BRONZE_PER_IRIDIUM) / BRONZE_PER_PLATINUM);
  const gold = Math.floor((totalBronze % BRONZE_PER_PLATINUM) / BRONZE_PER_GOLD);
  const silver = Math.floor((totalBronze % BRONZE_PER_GOLD) / BRONZE_PER_SILVER);
  const bronze = totalBronze % BRONZE_PER_SILVER;
  return { iridium, platinum, gold, silver, bronze };
}

/** "1 gold, 2 silver, 5 bronze" (skips zero parts; "0 bronze" when broke). */
export function formatMoney(totalBronze: number): string {
  const purse = toPurse(totalBronze);
  const parts: string[] = [];
  for (const kind of COIN_KINDS) if (purse[kind] && kind !== "bronze") parts.push(`${purse[kind]} ${kind}`);
  if (purse.bronze || !parts.length) parts.push(`${purse.bronze} bronze`);
  return parts.join(", ");
}
