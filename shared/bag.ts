// The bag (and the enchanted chest): slots that each hold one pile of similar things.
//
// Space is counted in slots, not weight. Similar things share a slot:
//   - the same item (pine logs with pine logs), up to its stack limit
//   - all tools of one kind (a stone axe and a bronze axe), up to STACK_LIMITS.gear
//   - all weapons of one kind, or all armor of one kind (every helmet together)
//   - all meals of one dish (every stew together, whatever went into it)
// Tap a slot to see what's in it: the item card cycles through each different
// thing in the pile, so you can pick which axe to use or which stew to eat.
//
// Under the hood the bag is a list of "entries": one per different thing (an
// axe, 12 pine logs, 3 trout stews of one recipe), each saying which slot it's in.
// Tools, weapons, armor and bait each get their own entry (each wears down on
// its own). The lists side by side, one place per entry:
//   inventory[e]  what it is (null = an unused entry)
//   counts[e]     how many
//   locked[e]     locked things can't be sold or dropped by accident
//   durability[e] uses left (tools, weapons, armor and bait only)
//   slotOf[e]     which bag slot it's in (0 to slotCount - 1)
// Messages from the game ("sell", "eat", "lock"...) name an entry, so you act
// on exactly the thing you picked. Dragging and sorting move whole slots.
import { ITEMS, ItemId } from "./items";
import { RESOURCE_FOR_ITEM } from "./foraging";
import { isTool, parseTool } from "./tools";
import { isArmor, isGear, isWeapon, parseArmor, parseWeapon } from "./gear";
import { POTION_ID } from "./combat";
import { isBait } from "./handicraft";
import { parseMeal } from "./cooking";

/** Change these to make stacks bigger or smaller. */
export const STACK_LIMITS = {
  /** Logs, ore, stone and fish. */
  gathered: 50,
  /** Feathers are light. */
  feather: 100,
  potion: 10,
  /** Tools, weapons, armor or bait of one kind in one slot (e.g. 10 axes). */
  gear: 10,
  /** Bars, meals (all of one dish), monster drops and anything else. */
  other: 25,
};

/** Tools, weapons, armor and bait wear down one at a time, so each keeps its own uses left. */
export const wearsOut = (item: ItemId) => isTool(item) || isGear(item) || isBait(item);

/**
 * Which things share a slot: "tool:axe" (every axe), "weapon:sword",
 * "armor:helmet", "meal:stew" (every stew), or the item itself for everything else.
 */
export function groupOf(item: ItemId): string {
  if (isTool(item)) return `tool:${parseTool(item).type}`;
  if (isWeapon(item)) return `weapon:${parseWeapon(item).type}`;
  if (isArmor(item)) return `armor:${parseArmor(item).type}`;
  const meal = parseMeal(item);
  if (meal) return `meal:${meal.dish}`;
  return item;
}

/** How many of this kind of thing fit in one slot. */
export function stackLimit(item: ItemId): number {
  if (wearsOut(item)) return STACK_LIMITS.gear;
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
  slotOf: number[];
  /** How many slots the bag has. */
  slotCount: number;
}

/** How many are in this entry (0 if it's unused). */
export const countIn = (bag: Bag, e: number) => (bag.inventory[e] ? Math.max(1, bag.counts[e] ?? 1) : 0);

/** Every entry in use, in no particular order. */
const usedEntries = (bag: Bag) => bag.inventory.flatMap((it, e) => (it ? [e] : []));

/**
 * The entries in one slot, best first: the one on top is what the slot shows.
 * (Most valuable first, then the one with the most uses left.)
 */
export function entriesIn(bag: Bag, slot: number): number[] {
  return usedEntries(bag)
    .filter((e) => bag.slotOf[e] === slot)
    .sort((a, b) => ITEMS[bag.inventory[b]!].sellPrice - ITEMS[bag.inventory[a]!].sellPrice
      || (bag.durability[b] ?? 0) - (bag.durability[a] ?? 0) || a - b);
}

/** Every entry, slot by slot (the order you see them in the bag). */
export const entriesInOrder = (bag: Bag) => Array.from({ length: bag.slotCount }, (_, s) => entriesIn(bag, s)).flat();

/** How many things are in this slot. */
export const slotTotal = (bag: Bag, slot: number) => usedEntries(bag).reduce((n, e) => n + (bag.slotOf[e] === slot ? countIn(bag, e) : 0), 0);

/** What kind of thing a slot holds (see groupOf), or null if it's empty. */
export function slotGroup(bag: Bag, slot: number): string | null {
  const e = bag.inventory.findIndex((it, i) => it && bag.slotOf[i] === slot);
  return e >= 0 ? groupOf(bag.inventory[e]!) : null;
}

/** How many of this item the bag holds, optionally only in entries that pass `ok`. */
export function countItem(bag: Bag, item: ItemId, ok: (e: number) => boolean = () => true): number {
  let n = 0;
  bag.inventory.forEach((it, e) => { if (it === item && ok(e)) n += countIn(bag, e); });
  return n;
}

/** Every item in the bag, counting stacks ("how many things am I carrying"). */
export const totalItems = (bag: Bag) => bag.inventory.reduce((sum, _, e) => sum + countIn(bag, e), 0);

/** Which slots have something in them. */
function slotsInUse(bag: Bag): boolean[] {
  const used = new Array<boolean>(bag.slotCount).fill(false);
  for (const e of usedEntries(bag)) if (bag.slotOf[e] < bag.slotCount) used[bag.slotOf[e]] = true;
  return used;
}

export const freeSlots = (bag: Bag) => slotsInUse(bag).filter((u) => !u).length;
export const usedSlots = (bag: Bag) => bag.slotCount - freeSlots(bag);

/** Slots this item could go in: ones already holding its kind (with room), then empty ones. */
function slotsFor(bag: Bag, item: ItemId): number[] {
  const key = groupOf(item);
  const limit = stackLimit(item);
  const used = slotsInUse(bag);
  const same: number[] = [];
  const empty: number[] = [];
  for (let s = 0; s < bag.slotCount; s++) {
    if (!used[s]) empty.push(s);
    else if (slotGroup(bag, s) === key && slotTotal(bag, s) < limit) same.push(s);
  }
  return [...same, ...empty];
}

/** How many more of this item fit: room on its slots, plus empty slots. */
export function roomFor(bag: Bag, item: ItemId): number {
  const limit = stackLimit(item);
  return slotsFor(bag, item).reduce((room, s) => room + limit - slotTotal(bag, s), 0);
}

/** Room for all of these at once? (A list like Old Maren's gifts.) */
export function roomForAll(bag: Bag, items: ItemId[]): boolean {
  const copy = cloneBag(bag);
  return items.every((item) => addItem(copy, item) === 1);
}

/** Start a new entry in this slot (reusing an unused place in the lists if there is one). */
export function newEntry(bag: Bag, slot: number, item: ItemId, count: number, durability: number | null, locked = false): number {
  let e = bag.inventory.indexOf(null);
  if (e < 0) e = bag.inventory.length;
  bag.inventory[e] = item;
  bag.counts[e] = count;
  bag.locked[e] = locked;
  bag.durability[e] = wearsOut(item) ? durability : null;
  bag.slotOf[e] = slot;
  return e;
}

/** Put up to n in one slot. Returns how many went in. */
function addToSlot(bag: Bag, slot: number, item: ItemId, n: number, durability: number | null): number {
  const room = Math.min(n, stackLimit(item) - slotTotal(bag, slot));
  if (room <= 0) return 0;
  if (wearsOut(item)) {
    for (let k = 0; k < room; k++) newEntry(bag, slot, item, 1, durability);
  } else {
    const e = bag.inventory.findIndex((it, i) => it === item && bag.slotOf[i] === slot && !bag.locked[i]);
    if (e >= 0) bag.counts[e] = countIn(bag, e) + room;
    else newEntry(bag, slot, item, room, null);
  }
  return room;
}

/**
 * Put items in the bag: in slots that already hold that kind of thing first,
 * then in empty slots. Returns how many went in (fewer than asked if the bag
 * fills up). Tools, weapons and armor keep the uses they have left (new ones are full).
 */
export function addItem(bag: Bag, item: ItemId, n = 1, durability: number | null = null): number {
  let left = n;
  for (const s of slotsFor(bag, item)) {
    if (left <= 0) break;
    left -= addToSlot(bag, s, item, left, durability);
  }
  return n - left;
}

/**
 * Put one thing back where something just came out (swapping gear or tools):
 * into that slot if it's the same kind (or now empty), otherwise wherever it fits.
 * Returns false if there's no room anywhere.
 */
export function putBack(bag: Bag, slot: number, item: ItemId, durability: number | null = null): boolean {
  const key = slotGroup(bag, slot);
  if ((key === null || key === groupOf(item)) && addToSlot(bag, slot, item, 1, durability)) return true;
  return addItem(bag, item, 1, durability) === 1;
}

/** Take some from one entry (all of it if n is left out). Returns how many came out. */
export function takeFromEntry(bag: Bag, e: number, n = Infinity): number {
  const have = countIn(bag, e);
  const take = Math.min(have, n);
  if (take <= 0) return 0;
  if (take >= have) clearEntry(bag, e);
  else bag.counts[e] = have - take;
  return take;
}

export function clearEntry(bag: Bag, e: number) {
  bag.inventory[e] = null;
  bag.counts[e] = 0;
  bag.locked[e] = false;
  bag.durability[e] = null;
  bag.slotOf[e] = -1;
}

/**
 * Take n of an item from the entries that pass `ok` (e.g. not locked), from the
 * last slot backwards so the front of your bag stays put. Returns how many came out.
 */
export function takeItem(bag: Bag, item: ItemId, n: number, ok: (e: number) => boolean = () => true): number {
  let left = n;
  for (const e of entriesInOrder(bag).reverse()) {
    if (left <= 0) break;
    if (bag.inventory[e] === item && ok(e)) left -= takeFromEntry(bag, e, left);
  }
  return n - left;
}

/** Rearrange the slots: slot i gets what was in slot order[i]. */
export function reorderSlots(bag: Bag, order: number[]) {
  const to = new Array<number>(order.length);
  order.forEach((from, i) => { to[from] = i; });
  bag.inventory.forEach((it, e) => { if (it && to[bag.slotOf[e]] !== undefined) bag.slotOf[e] = to[bag.slotOf[e]]; });
}

/**
 * Tidy up: join slots that hold the same kind of thing (old saves gave every
 * tool its own slot), and join entries of the same item in one slot (locked
 * and unlocked ones stay apart).
 */
export function mergeStacks(bag: Bag) {
  for (let s = 0; s < bag.slotCount; s++) {
    const key = slotGroup(bag, s);
    if (!key) continue;
    for (let t = s + 1; t < bag.slotCount; t++) {
      if (slotGroup(bag, t) !== key) continue;
      for (const e of entriesIn(bag, t)) {
        const item = bag.inventory[e]!;
        const room = stackLimit(item) - slotTotal(bag, s);
        if (room <= 0) break;
        const n = countIn(bag, e);
        if (n <= room) bag.slotOf[e] = s;
        else {
          bag.counts[e] = n - room;
          newEntry(bag, s, item, room, bag.durability[e], bag.locked[e]);
        }
      }
    }
    // Same item, same lock, in this slot: one entry.
    const seen = new Map<string, number>();
    for (const e of entriesIn(bag, s)) {
      const item = bag.inventory[e]!;
      if (wearsOut(item)) continue;
      const k = `${item}|${bag.locked[e]}`;
      const first = seen.get(k);
      if (first === undefined) { seen.set(k, e); continue; }
      bag.counts[first] = countIn(bag, first) + countIn(bag, e);
      clearEntry(bag, e);
    }
  }
}

/** Drop the unused entries (before saving), so the lists stay short. */
export function compact(bag: Bag) {
  const keep = usedEntries(bag).sort((a, b) => a - b);
  for (const list of [bag.inventory, bag.counts, bag.locked, bag.durability, bag.slotOf] as unknown[][]) {
    const old = [...list];
    list.length = 0;
    for (const e of keep) list.push(old[e]);
  }
}

export function emptyBag(slotCount: number): Bag {
  return { inventory: [], counts: [], locked: [], durability: [], slotOf: [], slotCount };
}

export function cloneBag(bag: Bag): Bag {
  return {
    inventory: [...bag.inventory], counts: [...bag.counts], locked: [...bag.locked], durability: [...bag.durability],
    slotOf: [...bag.slotOf], slotCount: bag.slotCount,
  };
}

/** "12 pine logs" / "1 pine log" / "a bronze axe" style names for a stack. */
export const stackName = (item: ItemId, n: number) => (n === 1 ? `1 ${ITEMS[item].single}` : `${n} ${ITEMS[item].name.toLowerCase()}`);
