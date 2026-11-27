// The bag, the tool belt, worn gear, the spell bar, weight and money.
// (Part of the game's windows: client/src/ui.ts loads every file in client/src/ui/.)
import { Belt, emptyBelt, ToolType, isTool, TOOL_TYPES, parseTool, toolBonus, TOOL_TYPE_IDS, maxDurability } from "../../../shared/tools";
import { Gear, emptyGear, GearSlot, GEAR_SLOTS, SLOT_ICONS, SLOT_NAMES, isWeapon, WEAPONS, parseWeapon, WeaponType, isArmor, SOFT_NAMES, parseArmor, ARMOR, isGear } from "../../../shared/gear";
import { BoltSpellId, SpellId, gearEffect, SPELLS, combatMasteryIn, isBoltSpell } from "../../../shared/combat";
import { Bag, emptyBag, entriesIn, usedSlots, slotTotal, stackLimit } from "../../../shared/bag";
import { ItemId, ITEMS } from "../../../shared/items";
import { FarmView } from "../../../shared/farming";
import { findSkill, levelForXp } from "../../../shared/disciplines";
import { gearDurability } from "../../../shared/crafting";
import { spellMana, describeSpell, BAR_SLOT_MASTERY } from "../../../shared/spells";
import { parseMeal, DISHES } from "../../../shared/cooking";
import { isBroken } from "../../../shared/repair";
import { SHOPS } from "../../../shared/shops";
import { formatMoney, toPurse, COIN_KINDS } from "../../../shared/money";
import { carriedWeight, carryCapacity, kg } from "../../../shared/weight";
import { Spellbook, knows, el, itemIcon, icon, slotsEl, bagCountEl, sellPrice } from "./core";
import { renderDisciplines, lastDisciplines, lastSkillXp, lastCombatMastery } from "./skills";
import { showMessage } from "./messages";
import { shopId, renderShop, shopBuying, askAmount } from "./shop";
import { renderCraft } from "./craft";
import { chestIsOpen, onDeposit, renderBounties, renderGuild } from "./guild";
import { renderInfo, showInfo } from "./info";
import { setHoverText } from "./vitals";
import { isRobePiece, renderTracker } from "./quests";

export let lastBelt: Belt = emptyBelt();

export let lastGear: Gear = emptyGear();

export let lastSpell: BoltSpellId = "fire_blast";

export let spellbook: Spellbook = { bar: [], known: [], books: [], bolt: "fire_blast" };

let editingBar = false;

let pickedSlot = 0;

// Clicking a slot opens its item card (or sells it while a shop is open).
// Similar things share a slot (shared/bag.ts): the card cycles through them.
// In lock mode (the 🔒 button on the inventory), clicking a slot locks or
// unlocks everything in it instead.
export let bag: Bag = emptyBag(0);

// The bag's lists, one place per entry (an axe, 12 pine logs...). Messages to the server name an entry.
export let invItems: (ItemId | null)[] = [];

export let locked: boolean[] = [];

 // per entry
export let durability: (number | null)[] = [];

 // per entry: uses left on tools
let counts: number[] = [];

 // per entry: how many
/** How many are in this entry (0 if unused). */
export const countAt = (i: number) => (invItems[i] ? Math.max(1, counts[i] ?? 1) : 0);

export let lockMode = false;

export let onDrop: (slot: number) => void = () => {};

export let onSell: (slot: number, count?: number) => void = () => {};

export let onSellAll: () => void = () => {};

export let onLock: (slot: number, locked: boolean) => void = () => {};

export let onEquip: (slot: number) => void = () => {};

export let onUnequip: (type: ToolType) => void = () => {};

export let onBuy: (item: ItemId, count: number) => void = () => {};

export let onCraft: (item: ItemId, all: boolean) => void = () => {};

export let onEat: (slot: number) => void = () => {};

export let onWear: (slot: number) => void = () => {};

export let onRemove: (slot: GearSlot) => void = () => {};

export let onDrink: (slot: number) => void = () => {};

let onSpell: (id: SpellId) => void = () => {};

let onCast: (id: SpellId) => void = () => {};

let onSpellBar: (bar: (SpellId | null)[]) => void = () => {};

export let onRead: (slot: number) => void = () => {};

// ---- Farming (shared/farming.ts): Farmer Odo's window shows your plot, and seeds can be picked to plant first ----
export let farmView: FarmView | null = null;

export let onFarmBuy = () => {};

export let onFarmChest = () => {};

export let onSeed: (item: ItemId) => void = () => {};

export function setFarmActions(a: { buy: () => void; chest: () => void; seed: (item: ItemId) => void }) {
  onFarmBuy = a.buy; onFarmChest = a.chest; onSeed = a.seed;
}

export function setFarm(view: FarmView) {
  farmView = view;
  if (document.body.classList.contains("shop-open") && shopId === "odo") renderShop();
}

let onSort: () => void = () => {};

let onMove: (from: number, to: number) => void = () => {};

export function setInventoryActions(actions: {
  drop: (slot: number) => void;
  sell: (slot: number, count?: number) => void;
  sellAll: () => void;
  lock: (slot: number, locked: boolean) => void;
  equip: (slot: number) => void;
  unequip: (type: ToolType) => void;
  buy: (item: ItemId, count: number) => void;
  craft: (item: ItemId, all: boolean) => void;
  eat: (slot: number) => void;
  wear: (slot: number) => void;
  remove: (slot: GearSlot) => void;
  drink: (slot: number) => void;
  spell: (id: SpellId) => void;
  cast: (id: SpellId) => void;
  spellBar: (bar: (SpellId | null)[]) => void;
  read: (slot: number) => void;
  sort: () => void;
  move: (from: number, to: number) => void;
}) {
  onSort = actions.sort;
  onMove = actions.move;
  onEat = actions.eat;
  onWear = actions.wear;
  onRemove = actions.remove;
  onDrink = actions.drink;
  onSpell = actions.spell;
  onCast = actions.cast;
  onSpellBar = actions.spellBar;
  onRead = actions.read;
  onDrop = actions.drop;
  onSell = actions.sell;
  onSellAll = actions.sellAll;
  onLock = actions.lock;
  onEquip = actions.equip;
  onUnequip = actions.unequip;
  onBuy = actions.buy;
  onCraft = actions.craft;
}

/** The server sends the whole bag after every change. */
export function renderBag(b: Bag) {
  bag = b;
  ({ inventory: invItems, locked, durability, counts } = b);
  renderInventory();
}

/** A small number in the corner of a slot holding more than one. */
export function countBadge(n: number) {
  const b = document.createElement("span");
  b.className = "count-badge";
  b.textContent = String(n);
  return b;
}

/** "+10% Woodcutting speed" / "+10% fewer Smithing failures" */
export function toolEffect(item: ItemId) {
  if (!isTool(item)) return "";
  const t = TOOL_TYPES[parseTool(item).type];
  const skill = findSkill(t.skill).def.name;
  const bonus = Math.round(toolBonus(item) * 100);
  if (!knows(t.skill)) return t.helps === "speed" ? `makes ${skill} much faster` : `makes ${skill} work far more often`;
  return t.helps === "speed" ? `+${bonus}% ${skill} speed` : `${bonus}% fewer ${skill} failures`;
}

/** A thin bar showing how many uses a tool has left (red when nearly broken). */
export function durabilityBar(left: number, max: number) {
  const bar = el("dura");
  const fill = document.createElement("div");
  const pct = Math.max(0, Math.min(1, left / max));
  fill.style.width = `${Math.ceil(pct * 100)}%`;
  if (pct <= 0.1) fill.style.background = "#e74c3c";
  else if (pct <= 0.3) fill.style.background = "#f1c40f";
  bar.appendChild(fill);
  return bar;
}

// ---- Tool belt: always on, one slot per kind of tool, doesn't use bag space ----

const beltEl = document.getElementById("belt")!;

export function renderBelt(belt: Belt) {
  lastBelt = belt;
  renderWeight();
  renderInfo();
  beltEl.replaceChildren();
  for (const type of TOOL_TYPE_IDS) {
    const t = TOOL_TYPES[type];
    const on = belt[type];
    const slot = el("slot belt-slot" + (on ? " filled" : ""));
    if (on) {
      const max = maxDurability(on.item);
      slot.append(itemIcon("", on.item), durabilityBar(on.durability, max));
      slot.title = `${ITEMS[on.item].name}: ${toolEffect(on.item)}.${knows(t.skill) ? ` ${on.durability} of ${max} uses left.` : ""} Click for details.`;
      slot.onclick = () => showInfo({ kind: "belt", type });
    } else {
      slot.appendChild(icon("empty-tool", t.icon));
      slot.title = t.helps === "speed"
        ? `No ${t.name.toLowerCase()}: ${findSkill(t.skill).def.name} is much faster with one. Click one in your bag to put it here.`
        : `No ${t.name.toLowerCase()}: ${findSkill(t.skill).def.name} works far more often with one. Click one in your bag to put it here.`;
    }
    beltEl.appendChild(slot);
  }
  renderDisciplines(lastDisciplines);
  renderCraft();
}

// ---- Gear strip: weapon and armor, under the tool belt. With a staff, your spells show under it. ----

const gearEl = document.getElementById("gear")!;

const spellsEl = document.getElementById("spells")!;

export function renderGear(gear: Gear, spell: BoltSpellId) {
  lastGear = gear;
  lastSpell = spell;
  renderWeight();
  renderInfo();
  gearEl.replaceChildren();
  for (const slot of GEAR_SLOTS) {
    const on = gear[slot];
    const box = el("slot belt-slot" + (on ? " filled" : ""));
    if (on) {
      const item = ITEMS[on.item];
      box.append(itemIcon("", on.item), durabilityBar(on.durability, gearDurability(on.item)));
      box.title = `${item.name}: ${gearEffect(on.item)}. ${on.durability} uses left. Click for details.`;
      box.onclick = () => showInfo({ kind: "gear", slot });
    } else {
      box.appendChild(icon("empty-tool", SLOT_ICONS[slot]));
      box.title = slot === "weapon" ? "Weapon: nothing in your hand, so you punch (hits up to 1). Click a weapon in your bag to hold it."
        : `${SLOT_NAMES[slot]}: empty. Click armor in your bag to wear it.`;
    }
    gearEl.appendChild(box);
  }
  renderSpellBar();
  renderDisciplines(lastDisciplines);
}

// ---- Spell bar (shared/spells.ts): click a slot or press its number key to cast. ----

export function setSpellbook(b: Spellbook) {
  spellbook = b;
  lastSpell = b.bolt;
  if (pickedSlot >= b.bar.length) pickedSlot = 0;
  renderSpellBar();
}

/** The number keys: cast the spell in that slot. */
export function castSlot(n: number) {
  const id = spellbook.bar[n];
  if (id && !editingBar) onCast(id);
}

function renderSpellBar() {
  spellsEl.replaceChildren();
  spellsEl.style.display = spellbook.known.length ? "" : "none";
  if (!spellbook.known.length) return;
  const magic = levelForXp(lastSkillXp.magic ?? 0);
  const holdingStaff = isWeapon(lastGear.weapon?.item) && WEAPONS[parseWeapon(lastGear.weapon!.item as `${WeaponType}_stone_pine`).type].style === "magic";
  const head = el("spell-head");
  const edit = document.createElement("button");
  edit.className = "spell-edit" + (editingBar ? " active" : "");
  edit.textContent = editingBar ? "✓ Done" : "✎";
  edit.title = editingBar ? "Done arranging your spell bar" : "Arrange your spell bar: pick a slot, then a spell to put in it.";
  edit.onclick = () => { editingBar = !editingBar; renderSpellBar(); };
  head.append(el("strip-label", `Spells (${spellbook.bar.length} slots)`), edit);
  spellsEl.appendChild(head);
  const row = el("spell-bar");
  spellbook.bar.forEach((id, i) => {
    const b = document.createElement("button");
    const picked = editingBar && i === pickedSlot;
    if (!id) {
      b.className = "pick spell empty" + (picked ? " active" : "");
      b.append(el("spell-key", String(i + 1)), el("pick-name", editingBar ? "empty" : "·"));
      b.title = editingBar ? `Slot ${i + 1}: empty. Pick a spell below to put here.` : `Slot ${i + 1}: empty. Press ✎ to put a spell here.`;
      b.onclick = () => { if (editingBar) { pickedSlot = i; renderSpellBar(); } };
      row.appendChild(b);
      return;
    }
    const sp = SPELLS[id];
    const m = combatMasteryIn(lastCombatMastery, id);
    const bolt = isBoltSpell(id);
    const active = editingBar ? picked : bolt && id === spellbook.bolt && holdingStaff;
    b.className = "pick spell" + (active ? " active" : "") + (bolt && !holdingStaff && !editingBar ? " dim" : "");
    b.append(el("spell-key", String(i + 1)), icon("pick-icon", sp.icon), el("pick-name", `${spellMana(id, m)} mana`));
    b.title = `${i + 1}. ${describeSpell(id, magic, m)} Mastery ${m}.` + (bolt ? (holdingStaff ? " Click to make your staff fire it." : "") : " Click (or press its number) to cast it.");
    b.onclick = () => {
      if (editingBar) { pickedSlot = i; renderSpellBar(); return; }
      onCast(id);
    };
    row.appendChild(b);
  });
  spellsEl.appendChild(row);
  if (!editingBar) return;
  // Arranging: every spell you know, to drop in the picked slot.
  const list = el("spell-list");
  list.appendChild(el("m-info", `Slot ${pickedSlot + 1}: pick a spell for it. Each spell at Mastery ${BAR_SLOT_MASTERY} adds a slot.`));
  const choices = el("spell-bar wrap");
  for (const id of spellbook.known) {
    const sp = SPELLS[id];
    const b = document.createElement("button");
    const at = spellbook.bar.indexOf(id);
    b.className = "pick spell" + (at === pickedSlot ? " active" : "");
    b.append(icon("pick-icon", sp.icon), el("pick-name", sp.name));
    b.title = describeSpell(id, magic, combatMasteryIn(lastCombatMastery, id)) + (at >= 0 ? ` (in slot ${at + 1} now)` : "");
    b.onclick = () => {
      const bar = [...spellbook.bar];
      if (at >= 0) bar[at] = bar[pickedSlot]; // swap places
      bar[pickedSlot] = id;
      onSpellBar(bar);
    };
    choices.appendChild(b);
  }
  const clear = document.createElement("button");
  clear.className = "pick spell";
  clear.append(icon("pick-icon", "✖"), el("pick-name", "Clear slot"));
  clear.onclick = () => { const bar = [...spellbook.bar]; bar[pickedSlot] = null; onSpellBar(bar); };
  choices.appendChild(clear);
  list.appendChild(choices);
  spellsEl.appendChild(list);
}

/** Lock everything in a slot, or unlock it if it's all locked already. */
function toggleLock(slot: number) {
  const here = entriesIn(bag, slot);
  const lock = !here.every((e) => locked[e]);
  for (const e of here) if (!!locked[e] !== lock) onLock(e, lock);
}

const lockModeBtn = document.getElementById("lock-mode")!;

const invTitle = document.getElementById("inv-title")!;

export function setLockMode(on: boolean) {
  lockMode = on;
  lockModeBtn.classList.toggle("active", on);
  document.body.classList.toggle("lock-mode", on);
  invTitle.textContent = on ? "Tap items to lock" : "Inventory";
  renderInventory();
}

lockModeBtn.onclick = () => setLockMode(!lockMode);

document.getElementById("sort-bag")!.onclick = () => onSort();

// ---- Dragging items around the bag: press on an item and move it onto another slot ----
// (A short tap still opens the item, sells it, or locks it as before.)

let drag: { from: number; x: number; y: number; ghost: HTMLElement | null; over: HTMLElement | null } | null = null;

/** A drag just ended: ignore the click that the browser sends right after. */
let justDragged = false;

const slotAt = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("#slots .slot") ?? null;

function startDrag(e: PointerEvent, from: number) {
  if (e.button !== 0) return;
  drag = { from, x: e.clientX, y: e.clientY, ghost: null, over: null };
  window.addEventListener("pointermove", onDragMove);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", cancelDrag);
}

function onDragMove(e: PointerEvent) {
  if (!drag) return;
  if (!drag.ghost) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return; // still a tap
    const id = invItems[entriesIn(bag, drag.from)[0]];
    if (!id) return cancelDrag();
    drag.ghost = itemIcon("", id);
    drag.ghost.id = "drag-ghost";
    document.body.appendChild(drag.ghost);
    document.body.classList.add("dragging");
    slotsEl.children[drag.from]?.classList.add("drag-from");
    setHoverText(null);
  }
  drag.ghost.style.left = `${e.clientX}px`;
  drag.ghost.style.top = `${e.clientY}px`;
  const over = slotAt(e.clientX, e.clientY);
  if (over !== drag.over) {
    drag.over?.classList.remove("drag-over");
    over?.classList.add("drag-over");
    drag.over = over;
  }
}

function endDrag(e: PointerEvent) {
  if (drag?.ghost) {
    const target = slotAt(e.clientX, e.clientY);
    const to = target ? Number(target.dataset.slot) : -1;
    if (to >= 0 && to !== drag.from) onMove(drag.from, to);
    justDragged = true;
    setTimeout(() => { justDragged = false; }, 0);
  }
  cancelDrag();
}

function cancelDrag() {
  if (drag) {
    drag.ghost?.remove();
    drag.over?.classList.remove("drag-over");
    slotsEl.querySelector(".drag-from")?.classList.remove("drag-from");
  }
  drag = null;
  document.body.classList.remove("dragging");
  window.removeEventListener("pointermove", onDragMove);
  window.removeEventListener("pointerup", endDrag);
  window.removeEventListener("pointercancel", cancelDrag);
}

export const shopIsOpen = () => document.body.classList.contains("shop-open");

/** What to call an item in the bag and on its card: just "Axe" for tools (the card says what it's made of). */
export const shortName = (id: ItemId) => ITEMS[id].short ?? ITEMS[id].name;

/** What a slot of mixed things holds, e.g. "axes", "stews", "swords" (shared/bag.ts groups them). */
function groupName(id: ItemId): string {
  const meal = parseMeal(id);
  const name = isTool(id) ? TOOL_TYPES[parseTool(id).type].name : meal ? DISHES[meal.dish].name
    : isWeapon(id) ? WEAPONS[parseWeapon(id).type].name : isArmor(id) ? (SOFT_NAMES[parseArmor(id).metal as "leather"]?.[parseArmor(id).type] ?? ARMOR[parseArmor(id).type].name) : ITEMS[id].name;
  return /s$/.test(name) ? name.toLowerCase() : `${name.toLowerCase()}s`;
}

export function renderInventory() {
  slotsEl.replaceChildren();
  const used = usedSlots(bag); // each slot holds one pile of similar things
  bagCountEl.textContent = `${used}/${bag.slotCount}`;
  document.getElementById("bag-tab")!.title = `Inventory: ${used} of ${bag.slotCount} slots used`;
  const selling = shopIsOpen();
  renderWeight();
  for (let i = 0; i < bag.slotCount; i++) {
    const slot = document.createElement("div");
    slot.className = "slot" + (drag?.ghost && drag.from === i ? " drag-from" : "");
    slot.dataset.slot = String(i);
    const here = entriesIn(bag, i);
    if (here.length) {
      const top = here[0]; // the best one shows on top
      const id = invItems[top]!;
      const item = ITEMS[id];
      const kinds = here.length;
      slot.classList.add("filled");
      if (kinds > 1) slot.classList.add("mixed"); // drawn like a little pile of cards
      slot.appendChild(itemIcon("item-icon", id));
      if (isRobePiece(id)) slot.classList.add("robe-glow");
      if (isTool(id)) slot.appendChild(durabilityBar(durability[top] ?? maxDurability(id), maxDurability(id)));
      if (isGear(id)) slot.appendChild(durabilityBar(durability[top] ?? gearDurability(id), gearDurability(id)));
      if (isBroken(id, durability[top])) {
        slot.classList.add("broken");
        const b = document.createElement("span");
        b.className = "broken-badge";
        b.textContent = "💔";
        slot.appendChild(b);
      }
      const n = slotTotal(bag, i);
      if (n > 1) slot.appendChild(countBadge(n));
      const tag = document.createElement("span");
      tag.className = "price-tag";
      const price = sellPrice(id, durability[top]);
      tag.textContent = `${price}b`;
      slot.appendChild(tag);
      const lockedHere = here.filter((e) => locked[e]).length;
      const allLocked = lockedHere === kinds;
      const noBuy = selling && !shopBuying && !SHOPS[shopId].buys(id);
      if (noBuy) slot.classList.add("no-buy");
      if (lockedHere) {
        if (allLocked) slot.classList.add("locked");
        const lock = document.createElement("span");
        lock.className = "lock-badge" + (allLocked ? "" : " some");
        lock.textContent = "🔒";
        slot.appendChild(lock);
      }
      const name = shortName(id);
      const many = kinds > 1 ? `${n} ${groupName(id)} (${kinds} kinds)` : n > 1 ? `${n} ${item.name.toLowerCase()}` : item.single;
      slot.title = lockMode ? `${allLocked ? "Unlock" : "Lock"} ${n > 1 ? "these" : "this"} ${many}`
        : allLocked ? `${n > 1 ? `${n} × ` : ""}${name} (locked)`
        : chestIsOpen() ? `Put ${many} in your chest`
        : noBuy ? `${SHOPS[shopId].title.replace(/^\S+ /, "")} doesn't buy ${item.name.toLowerCase()} (Tam at the General Store buys anything)`
        : selling && kinds > 1 ? `${many}: tap to pick which to sell`
        : selling ? `Sell ${many} for ${formatMoney(price * n)}`
        : kinds > 1 ? `${many}: click to see each one, or drag to move them`
        : `${n > 1 ? `${n} × ` : ""}${name} (stacks to ${stackLimit(id)}): click for details, or drag to move it`;
      slot.onpointerdown = (e) => startDrag(e, i);
      slot.onclick = () => {
        if (justDragged) return;
        if (lockMode) return toggleLock(i);
        if (chestIsOpen()) {
          // One stack of one kind: pick how many to put in. A pile of several kinds goes in all at once.
          if (kinds === 1 && n > 1) return askAmount({ title: `Put ${item.name.toLowerCase()} in your chest`, glyph: item.icon, tint: item.tint, max: n, start: n, verb: "Put in", ok: (k) => onDeposit(top, k) });
          for (const e of here) onDeposit(e);
          return;
        }
        if (noBuy) return showMessage(`This shop only buys ${SHOPS[shopId].buysText}. Shopkeeper Tam at the General Store buys anything.`);
        if (shopIsOpen() && !shopBuying && kinds === 1) {
          if (allLocked) return showMessage(`That ${item.single} is locked. Tap 🔒 on your inventory, then tap it to unlock.`);
          if (n > 1) return askAmount({ title: `Sell ${item.name.toLowerCase()}`, glyph: item.icon, tint: item.tint, max: n, start: n, each: price, verb: "Sell", ok: (k) => onSell(top, k) });
          return onSell(top);
        }
        showInfo({ kind: "slot", slot: i, pick: 0 });
      };
    }
    slotsEl.appendChild(slot);
  }
  if (selling) renderShop();
  renderBounties();
  renderGuild();
  renderCraft();
  renderInfo();
  renderTracker();
}

// ---- Weight: under the bag. Bag, tool belt and worn gear all count (shared/weight.ts) ----

function renderWeight() {
  const weightEl = document.getElementById("weight")!; // looked up here: this runs before the rest of this file has loaded
  const carried = carriedWeight({ inventory: invItems, counts }, lastBelt, lastGear);
  const max = carryCapacity(lastDisciplines.levels.dexterity);
  const pct = Math.min(1, carried / max);
  weightEl.replaceChildren();
  const bar = el("weight-bar");
  const fill = document.createElement("div");
  fill.style.width = `${Math.floor(pct * 100)}%`;
  fill.style.background = carried >= max ? "#e74c3c" : pct >= 0.8 ? "#f1c40f" : "#5fb84a";
  bar.appendChild(fill);
  const slow = carried > max ? ` 🐢 ${["½", "¼", "⅛"][Math.min(3, Math.ceil(carried / max) - 1) - 1]} speed` : "";
  weightEl.append(el("weight-label", `⚖️ ${kg(carried)} / ${kg(max)}${slow}`), bar);
  weightEl.title = `You're carrying ${kg(carried)} of the ${kg(max)} you can carry. Your bag, the tools on your belt and the gear you wear all count. ` +
    "Carry more than that and you slow down: half speed with no running, a quarter at twice as much, an eighth at three times. Four times is the most you can drag.";
  weightEl.classList.toggle("full", carried >= max);
  // The same bar, small, along the bottom of the 🎒 button: green, yellow when nearly full, red when full.
  const tabBar = document.querySelector<HTMLElement>("#bag-weight span");
  if (tabBar) {
    tabBar.style.width = `${Math.floor(pct * 100)}%`;
    tabBar.style.background = fill.style.background;
  }
}

// ---- Money: shown under the inventory, doesn't use a slot ----

const moneyEl = document.getElementById("money")!;

export let coins = 0;

export function renderCoins(totalBronze: number) {
  coins = totalBronze;
  if (shopIsOpen()) renderShop();
  const purse = toPurse(totalBronze);
  moneyEl.replaceChildren();
  moneyEl.title = formatMoney(totalBronze);
  // Platinum and iridium only show once you have some.
  for (const kind of COIN_KINDS.filter((k) => (k !== "iridium" && k !== "platinum") || purse[k] > 0 || (k === "platinum" && purse.iridium > 0))) {
    const span = document.createElement("span");
    const coin = document.createElement("i");
    coin.className = `coin ${kind}`;
    span.append(coin, String(purse[kind]));
    span.title = `${purse[kind]} ${kind}`;
    moneyEl.appendChild(span);
  }
}
