// Foraging: the gathering skill. Right now it only covers chopping trees.

/** Chance of getting logs on each tick spent chopping (about one every 4 ticks / 2.4s). */
export const CHOP_SUCCESS_CHANCE = 0.25;
/** After each log, chance the tree falls and becomes a stump. */
export const TREE_FALL_CHANCE = 1 / 4;
/** How long a stump takes to grow back, in ticks (50 ticks = 30 seconds). */
export const TREE_RESPAWN_TICKS = 50;

export const treeKey = (x: number, y: number) => `${x},${y}`;

/** Foraging XP for each log you get. */
export const XP_PER_LOG = 1;
