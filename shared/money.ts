// Money is stored as one number: the total in bronze coins.
// 100 bronze = 1 silver, 100 silver = 1 gold.
export const BRONZE_PER_SILVER = 100;
export const SILVER_PER_GOLD = 100;
export const BRONZE_PER_GOLD = BRONZE_PER_SILVER * SILVER_PER_GOLD;

export interface Purse { gold: number; silver: number; bronze: number }

export function toPurse(totalBronze: number): Purse {
  const gold = Math.floor(totalBronze / BRONZE_PER_GOLD);
  const silver = Math.floor((totalBronze % BRONZE_PER_GOLD) / BRONZE_PER_SILVER);
  const bronze = totalBronze % BRONZE_PER_SILVER;
  return { gold, silver, bronze };
}

/** "1 gold, 2 silver, 5 bronze" (skips zero parts; "0 bronze" when broke). */
export function formatMoney(totalBronze: number): string {
  const { gold, silver, bronze } = toPurse(totalBronze);
  const parts: string[] = [];
  if (gold) parts.push(`${gold} gold`);
  if (silver) parts.push(`${silver} silver`);
  if (bronze || !parts.length) parts.push(`${bronze} bronze`);
  return parts.join(", ");
}
