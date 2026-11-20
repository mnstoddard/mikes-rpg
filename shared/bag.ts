// Stacks: how many of one thing fit in one bag slot (or one chest space).
//
// Space is counted in slots, not weight: every slot holds one stack. Tools,
// weapons and armor don't stack (each one wears down on its own), so they take
// a slot each. Everything else stacks up to its limit, then starts a new slot.
//
// The bag is a few lists side by side, one entry per slot:
//   inventory[i]  what's in slot i (null = empty)
//   counts[i]     how many of it
//   locked[i]     locked slots can't be sold or dropped by accident
//   durability[i] uses left (tools, weapons and armor only)
import { ITEMS, ItemId } from "./items";
import { RESOURCE_FOR_ITEM } from "./foraging";
import { isTool } from "./tools";
import { isGear } from "./gear";
import { POTION_ID } from "./combat";

/** Change these to make stacks bigger or smaller. */
export const STACK_LIMITS = {
  /** Logs, ore, stone and fish. */
  gathered: 50,
  /** Feathers are light. */
  feather: 100,
  potion: 10,
  /** Bars, stews, monster drops and anything else. */
  other: 25,
};

/** How many of this item fit in one slot (1 = it doesn't stack). */
export function stackLimit(item: ItemId): number {
  if (isTool(item) || isGear(item)) return 1;
  if (RESOURCE_FOR_ITEM[item]) return STACK_LIMITS.gathered;
  if (item === "feather") return STACK_LIMITS.feather;
  if (item === POTION_ID) return STACK_LIMITS.potion;
  return STACK_LIMITS.other;
}

export interface Bag {
  inventory: (ItemId | null)[];
  counts: number[];
  locked: boolean[];
  durability: (number | null)[];
}

/** How many are in this slot (0 if it's empty). */
export const countIn = (bag: Bag, slot: number) => (bag.inventory[slot] ? Math.max(1, bag.counts[slot] ?? 1) : 0);

/** How many of this item the bag holds, optionally only in slots that pass `ok`. */
export function countItem(bag: Bag, item: ItemId, ok: (slot: number) => boolean = () => true): number {
  let n = 0;
  bag.inventory.forEach((it, i) => { if (it === item && ok(i)) n += countIn(bag, i); });
  return n;
}

/** Every item in the bag, counting stacks ("how many things am I carrying"). */
export const totalItems = (bag: Bag) => bag.inventory.reduce((sum, _, i) => sum + countIn(bag, i), 0);

export const freeSlots = (bag: Bag) => bag.inventory.filter((it) => !it).length;

/** How many more of this item fit: room on its stacks, plus empty slots. */
export function roomFor(bag: Bag, item: ItemId): number {
  const limit = stackLimit(item);
  let room = 0;
  bag.inventory.forEach((it, i) => {
    if (!it) room += limit;
    else if (it === item) room += Math.max(0, limit - countIn(bag, i));
  });
  return room;
}

/** Room for all of these at once? (A list like Old Maren's gifts.) */
export function roomForAll(bag: Bag, items: ItemId[]): boolean {
  const copy = cloneBag(bag);
  return items.every((item) => addItem(copy, item) === 1);
}

/**
 * Put items in the bag: on top of stacks that have room first, then in empty
 * slots. Returns how many went in (fewer than asked if the bag fills up).
 * Tools, weapons and armor keep the uses they have left (new ones are full).
 */
export function addItem(bag: Bag, item: ItemId, n = 1, durability: number | null = null): number {
  const limit = stackLimit(item);
  let left = n;
  if (limit > 1) {
    for (let i = 0; i < bag.inventory.length && left > 0; i++) {
      if (bag.inventory[i] !== item) continue;
      const add = Math.min(left, limit - countIn(bag, i));
      if (add <= 0) continue;
      bag.counts[i] = countIn(bag, i) + add;
      left -= add;
    }
  }
  for (let i = 0; i < bag.inventory.length && left > 0; i++) {
    if (bag.inventory[i]) continue;
    const add = Math.min(left, limit);
    bag.inventory[i] = item;
    bag.counts[i] = add;
    bag.locked[i] = false; // new stacks start unlocked
    bag.durability[i] = limit === 1 ? durability : null;
    left -= add;
  }
  return n - left;
}

/** Put exactly this stack into one empty slot (used when swapping gear back into the slot it came from). */
export function putInSlot(bag: Bag, slot: number, item: ItemId, count = 1, durability: number | null = null) {
  bag.inventory[slot] = item;
  bag.counts[slot] = count;
  bag.locked[slot] = false;
  bag.durability[slot] = stackLimit(item) === 1 ? durability : null;
}

/** Take some from one slot (all of it if n is left out). Returns how many came out. */
export function takeFromSlot(bag: Bag, slot: number, n = Infinity): number {
  const have = countIn(bag, slot);
  const take = Math.min(have, n);
  if (take <= 0) return 0;
  if (take >= have) clearSlot(bag, slot);
  else bag.counts[slot] = have - take;
  return take;
}

export function clearSlot(bag: Bag, slot: number) {
  bag.inventory[slot] = null;
  bag.counts[slot] = 0;
  bag.locked[slot] = false;
  bag.durability[slot] = null;
}

/**
 * Take n of an item from the slots that pass `ok` (e.g. not locked), from the
 * last slot backwards so the front of your bag stays put. Returns how many came out.
 */
export function takeItem(bag: Bag, item: ItemId, n: number, ok: (slot: number) => boolean = () => true): number {
  let left = n;
  for (let i = bag.inventory.length - 1; i >= 0 && left > 0; i--) {
    if (bag.inventory[i] === item && ok(i)) left -= takeFromSlot(bag, i, left);
  }
  return n - left;
}

/**
 * Join stacks of the same thing that are split over several slots (old saves
 * had one item per slot). Locked and unlocked stacks stay apart.
 */
export function mergeStacks(bag: Bag) {
  for (let i = 0; i < bag.inventory.length; i++) {
    const item = bag.inventory[i];
    if (!item) continue;
    const limit = stackLimit(item);
    if (limit === 1) { bag.counts[i] = 1; continue; }
    bag.counts[i] = Math.min(limit, countIn(bag, i));
    for (let j = i + 1; j < bag.inventory.length && bag.counts[i] < limit; j++) {
      if (bag.inventory[j] !== item || bag.locked[j] !== bag.locked[i]) continue;
      const move = Math.min(limit - bag.counts[i], countIn(bag, j));
      bag.counts[i] += move;
      takeFromSlot(bag, j, move);
    }
  }
}

export function emptyBag(size: number): Bag {
  return {
    inventory: new Array(size).fill(null),
    counts: new Array(size).fill(0),
    locked: new Array(size).fill(false),
    durability: new Array(size).fill(null),
  };
}

export function cloneBag(bag: Bag): Bag {
  return { inventory: [...bag.inventory], counts: [...bag.counts], locked: [...bag.locked], durability: [...bag.durability] };
}

/** "12 pine logs" / "1 pine log" / "a bronze axe" style names for a stack. */
export const stackName = (item: ItemId, n: number) => (n === 1 ? `1 ${ITEMS[item].single}` : `${n} ${ITEMS[item].name.toLowerCase()}`);
