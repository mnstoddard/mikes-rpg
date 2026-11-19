import { INVENTORY_SIZE, ITEMS, ItemId } from "../../shared/items";
import { formatMoney, toPurse } from "../../shared/money";
import { CraftSkill, DISCIPLINES, DISCIPLINE_IDS, DisciplineId, DisciplineXp, MAX_LEVEL, SkillId, SkillXp, emptyDisciplines, emptySkills, findSkill, isCraftSkill, levelForXp, xpForLevel } from "../../shared/disciplines";
import { ItemMasteryXp, MasteryId, craftSuccess, masteryIn, masteryLevelForXp, masterySuccess, masteryXpForLevel, percent, speedBonusPercent, valueBonusPercent } from "../../shared/mastery";
import { RESOURCES, resourcesFor } from "../../shared/foraging";
import { SHOP_STOCK, beltBonus, buyPriceFor, recipeFor, sellPriceFor, successFor } from "../../shared/crafting";
import {
  BAR_IDS, Belt, METALS, METAL_IDS, Metal, TOOL_TYPES, TOOL_TYPE_IDS, ToolType, WOODS, WOOD_IDS, Wood, barId, emptyBelt,
  isTool, maxDurability, metalOfBar, parseTool, toolBonus, toolForSkill, toolId,
} from "../../shared/tools";

const MAX_MESSAGES = 6;
const messagesEl = document.getElementById("messages")!;
const slotsEl = document.getElementById("slots")!;
const hoverEl = document.getElementById("hover")!;
const bagCountEl = document.getElementById("bag-count")!;

const skillListEl = document.getElementById("skill-list")!;

// ---- Side panel tabs (Skills / Inventory): one open at a time, tap again to close ----

type Panel = "inventory" | "skills" | "";
const isSmallScreen = () => matchMedia("(max-width: 640px), (max-height: 500px)").matches;

export function openPanel(panel: Panel) {
  document.body.dataset.panel = panel;
  document.querySelectorAll<HTMLElement>(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === panel));
}

document.querySelectorAll<HTMLElement>(".tab").forEach((b) => {
  b.addEventListener("click", () => {
    const tab = b.dataset.tab as Panel;
    openPanel(document.body.dataset.panel === tab ? "" : tab);
  });
});
// Big screens start with the inventory open; phones start with everything closed.
openPanel(isSmallScreen() ? "" : "inventory");

// ---- Disciplines (and the skills inside them) ----

let lastDisciplines: DisciplineXp = emptyDisciplines();
let lastSkillXp: SkillXp = emptySkills();
let lastMastery: ItemMasteryXp = {};
let flashSkill: SkillId | undefined;
let flashType: MasteryId | undefined;
let lastBelt: Belt = emptyBelt();
/** Which crafting window is open, and what's picked in it. */
let station: "furnace" | "anvil" | null = null;
const pick = { bar: "bronze" as Metal, type: "axe" as ToolType, metal: "bronze" as Metal, wood: "pine" as Wood };
/** The Merchant's window is on its Buy tab (otherwise Sell). */
let shopBuying = false;
/** Skills whose list of types is showing (click a skill to fold it away). */
const expanded = new Set<SkillId>(["woodcutting", "fishing", "mining", "smelting", "smithing"]);

const el = (cls: string, text = "") => {
  const d = document.createElement("div");
  d.className = cls;
  d.textContent = text;
  return d;
};

export function renderDisciplines(disciplines: DisciplineXp, flash?: DisciplineId) {
  lastDisciplines = disciplines;
  skillListEl.replaceChildren();
  for (const id of DISCIPLINE_IDS) {
    const def = DISCIPLINES[id];
    const xp = disciplines[id] ?? 0;
    const level = levelForXp(xp);
    const start = xpForLevel(level);
    const next = xpForLevel(level + 1);
    const maxed = level >= MAX_LEVEL;
    const pct = maxed ? 100 : Math.floor(((xp - start) / (next - start)) * 100);

    const row = document.createElement("div");
    row.className = "skill" + (flash === id ? " flash" : "");
    row.title = def.description;
    const bar = el("skill-bar");
    const fill = document.createElement("div");
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    row.append(
      el("skill-icon", def.icon),
      el("skill-name", def.name),
      el("skill-level", `Lv ${level}`),
      bar,
      el("skill-xp", maxed ? `${xp.toLocaleString()} XP (max level)` : `${xp.toLocaleString()} / ${next.toLocaleString()} XP · ${(next - xp).toLocaleString()} to go`),
    );

    // The skills inside this Discipline, and when they unlock.
    const subs = el("subskills");
    subs.style.gridColumn = "1 / 4";
    for (const skill of def.skills) {
      const unlocked = level >= skill.unlockLevel;
      const sub = el("subskill" + (unlocked ? "" : " locked") + (flashSkill === skill.id ? " flash" : ""));
      sub.title = `${skill.description} Click to show or hide its types.`;
      const head = el("ss-head");
      head.append(el("ss-icon", skill.icon), el("ss-name", skill.name),
        el("ss-state", unlocked ? "✓" : `🔒 Lv ${skill.unlockLevel}`));
      sub.appendChild(head);
      sub.appendChild(skillDetails(skill.id));
      sub.onclick = () => {
        if (expanded.has(skill.id)) expanded.delete(skill.id); else expanded.add(skill.id);
        renderDisciplines(lastDisciplines);
      };
      subs.appendChild(sub);
    }
    row.appendChild(subs);
    skillListEl.appendChild(row);
  }
}

/** Skill level (unlocks types), then every type with its own Mastery. */
function skillDetails(skill: SkillId): HTMLElement {
  const xp = lastSkillXp[skill] ?? 0;
  const level = levelForXp(xp);
  const maxed = level >= MAX_LEVEL;
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const box = el("mastery");
  const top = el("m-top");
  top.append(el("m-level", `Level ${level}`), el("m-speed", maxed ? "max level" : `${(next - xp).toLocaleString()} XP to ${level + 1}`));
  const bar = el("skill-bar m-bar");
  const fill = document.createElement("div");
  fill.style.width = `${maxed ? 100 : Math.floor(((xp - start) / (next - start)) * 100)}%`;
  bar.appendChild(fill);
  box.append(top, bar);
  if (isCraftSkill(skill)) return craftDetails(skill, level, box);
  const types = resourcesFor(skill);
  const upcoming = types.find((id) => RESOURCES[id].level > level);
  if (upcoming) box.append(el("m-info", `Next unlock: ${ITEMS[RESOURCES[upcoming].item].name} at level ${RESOURCES[upcoming].level}`));
  if (!expanded.has(skill)) return box;

  const list = el("m-types");
  for (const id of types) {
    const r = RESOURCES[id];
    const item = ITEMS[r.item];
    const open = level >= r.level;
    const row = el("m-type" + (open ? "" : " locked") + (flashType === id ? " flash" : ""));
    const icon = el("m-type-icon", item.icon);
    if (item.tint) icon.style.filter = item.tint;
    if (!open) {
      row.append(icon, el("m-type-name", item.name), el("m-type-state", `🔒 Lv ${r.level}`));
      row.title = `Reach ${findSkill(skill).def.name} level ${r.level} to gather ${item.name}.`;
    } else {
      const mXp = lastMastery[id] ?? 0;
      const m = masteryLevelForXp(mXp);
      const mStart = masteryXpForLevel(m), mNext = masteryXpForLevel(m + 1);
      const price = sellPriceFor(r.item, lastMastery);
      row.append(icon, el("m-type-name", item.name), el("m-type-state", `Mastery ${m}`));
      const mBar = el("skill-bar t-bar");
      const mFill = document.createElement("div");
      mFill.style.width = `${Math.floor(((mXp - mStart) / (mNext - mStart)) * 100)}%`;
      mBar.appendChild(mFill);
      const detail = el("t-info", `${speedBonusPercent(m)}% faster · sells for ${formatMoney(price)}`);
      row.append(mBar, detail);
      row.title = `${item.name} Mastery ${m}: ${(mNext - mXp).toLocaleString()} XP to ${m + 1}. ` +
        `${speedBonusPercent(m)}% faster to gather, ${valueBonusPercent(m)}% more money (base price ${formatMoney(item.sellPrice)}). ${r.xp} XP each.`;
    }
    list.appendChild(row);
  }
  box.appendChild(list);
  return box;
}

/** A Mastery bar with its info line under it. */
function masteryRow(id: MasteryId, name: string, icon: string, tint: string | undefined, info: (m: number) => string, title: (m: number) => string) {
  const mXp = lastMastery[id] ?? 0;
  const m = masteryLevelForXp(mXp);
  const mStart = masteryXpForLevel(m), mNext = masteryXpForLevel(m + 1);
  const row = el("m-type" + (flashType === id ? " flash" : ""));
  const iconEl = el("m-type-icon", icon);
  if (tint) iconEl.style.filter = tint;
  const mBar = el("skill-bar t-bar");
  const mFill = document.createElement("div");
  mFill.style.width = `${Math.floor(((mXp - mStart) / (mNext - mStart)) * 100)}%`;
  mBar.appendChild(mFill);
  row.append(iconEl, el("m-type-name", name), el("m-type-state", `Mastery ${m}`), mBar, el("t-info", info(m)));
  row.title = `${name} Mastery ${m}: ${(mNext - mXp).toLocaleString()} XP to ${m + 1}. ${title(m)}`;
  return row;
}

/** Smelting: each bar's Mastery. Smithing: each kind of tool's Mastery. Shows your success chance with your belt tool. */
function craftDetails(skill: CraftSkill, level: number, box: HTMLElement) {
  const upcoming = METAL_IDS.find((m) => METALS[m].level > level);
  if (upcoming) {
    const m = METALS[upcoming];
    box.append(el("m-info", `Next unlock: ${skill === "smelting" ? `${m.name} bars` : `${m.name} tools`} at level ${m.level}`));
  }
  const tool = toolForSkill(skill)!;
  const bonus = beltBonus(lastBelt, skill);
  box.append(el("m-info", lastBelt[tool] ? `Using ${ITEMS[lastBelt[tool]!.item].name}: ${Math.round(bonus! * 100)}% fewer failures`
    : `No ${TOOL_TYPES[tool].name.toLowerCase()} on your belt: half the success chance`));
  if (!expanded.has(skill)) return box;
  const list = el("m-types");
  if (skill === "smelting") {
    for (const bar of BAR_IDS) {
      const metal = METALS[metalOfBar(bar)];
      if (level < metal.level) {
        const row = el("m-type locked");
        const icon = el("m-type-icon", "🧈");
        icon.style.filter = metal.tint;
        row.append(icon, el("m-type-name", ITEMS[bar].name), el("m-type-state", `🔒 Lv ${metal.level}`));
        list.appendChild(row);
        continue;
      }
      list.appendChild(masteryRow(bar, ITEMS[bar].name, "🧈", metal.tint,
        (m) => `${percent(craftSuccess(m, bonus))} success · sells for ${formatMoney(sellPriceFor(bar, lastMastery))}`,
        (m) => `${percent(masterySuccess(m))} base success, ${valueBonusPercent(m)}% more money. ${metal.barXp} XP each.`));
    }
  } else {
    for (const type of TOOL_TYPE_IDS) {
      const t = TOOL_TYPES[type];
      list.appendChild(masteryRow(type, type === "tongs" ? t.name : `${t.name}s`, t.icon, undefined,
        (m) => `${percent(craftSuccess(m, bonus))} success · +${valueBonusPercent(m)}% value`,
        (m) => `Every kind of ${t.name.toLowerCase()} shares this Mastery. ${percent(masterySuccess(m))} base success, ${valueBonusPercent(m)}% more money. Better metal and wood give more XP.`));
    }
  }
  box.appendChild(list);
  return box;
}

export function renderSkillXp(skillXp: SkillXp) {
  lastSkillXp = skillXp;
  renderDisciplines(lastDisciplines);
  renderCraft();
}

export function renderMastery(mastery: ItemMasteryXp) {
  lastMastery = mastery;
  renderDisciplines(lastDisciplines);
  renderInventory(invItems); // prices depend on Mastery
}

export function flashDiscipline(id: DisciplineId) {
  renderDisciplines(lastDisciplines, id);
}

export function flashSkillRow(skill: SkillId) {
  flashSkill = skill;
  renderDisciplines(lastDisciplines);
  flashSkill = undefined;
}

export function flashMastery(type: MasteryId) {
  flashType = type;
  renderDisciplines(lastDisciplines);
  flashType = undefined;
}

renderDisciplines(lastDisciplines);

export function showMessage(text: string) {
  const line = document.createElement("div");
  line.textContent = text;
  messagesEl.appendChild(line);
  while (messagesEl.children.length > MAX_MESSAGES) messagesEl.firstChild!.remove();
}

// Clicking an item drops it, or sells it while the Merchant's shop is open.
// In lock mode (the 🔒 button on the inventory), clicking an item locks or
// unlocks just that one item instead.
let invItems: (ItemId | null)[] = [];
let locked: boolean[] = []; // per inventory slot
let durability: (number | null)[] = []; // per inventory slot: uses left on tools
let lockMode = false;
let onDrop: (slot: number) => void = () => {};
let onSell: (slot: number) => void = () => {};
let onSellAll: () => void = () => {};
let onLock: (slot: number, locked: boolean) => void = () => {};
let onEquip: (slot: number) => void = () => {};
let onUnequip: (type: ToolType) => void = () => {};
let onBuy: (item: ItemId, count: number) => void = () => {};
let onCraft: (item: ItemId, all: boolean) => void = () => {};

export function setInventoryActions(actions: {
  drop: (slot: number) => void;
  sell: (slot: number) => void;
  sellAll: () => void;
  lock: (slot: number, locked: boolean) => void;
  equip: (slot: number) => void;
  unequip: (type: ToolType) => void;
  buy: (item: ItemId, count: number) => void;
  craft: (item: ItemId, all: boolean) => void;
}) {
  onDrop = actions.drop;
  onSell = actions.sell;
  onSellAll = actions.sellAll;
  onLock = actions.lock;
  onEquip = actions.equip;
  onUnequip = actions.unequip;
  onBuy = actions.buy;
  onCraft = actions.craft;
}

export function renderDurability(slots: (number | null)[]) {
  durability = slots;
}

/** "+10% Woodcutting speed" / "+10% fewer Smithing failures" */
function toolEffect(item: ItemId) {
  if (!isTool(item)) return "";
  const t = TOOL_TYPES[parseTool(item).type];
  const skill = findSkill(t.skill).def.name;
  const bonus = Math.round(toolBonus(item) * 100);
  return t.helps === "speed" ? `+${bonus}% ${skill} speed` : `${bonus}% fewer ${skill} failures`;
}

/** A thin bar showing how many uses a tool has left (red when nearly broken). */
function durabilityBar(left: number, max: number) {
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
  beltEl.replaceChildren();
  for (const type of TOOL_TYPE_IDS) {
    const t = TOOL_TYPES[type];
    const on = belt[type];
    const slot = el("slot belt-slot" + (on ? " filled" : ""));
    const icon = document.createElement("span");
    icon.textContent = t.icon;
    if (on) {
      if (ITEMS[on.item].tint) icon.style.filter = ITEMS[on.item].tint!;
      const max = maxDurability(on.item);
      slot.append(icon, durabilityBar(on.durability, max));
      slot.title = `${ITEMS[on.item].name}: ${toolEffect(on.item)}. ${on.durability} of ${max} uses left. Click to put it back in your bag.`;
      slot.onclick = () => onUnequip(type);
    } else {
      icon.className = "empty-tool";
      slot.appendChild(icon);
      slot.title = t.helps === "speed"
        ? `No ${t.name.toLowerCase()}: ${findSkill(t.skill).def.name} is 3 times slower. Click one in your bag to put it here.`
        : `No ${t.name.toLowerCase()}: half the ${findSkill(t.skill).def.name} success chance. Click one in your bag to put it here.`;
    }
    beltEl.appendChild(slot);
  }
  renderDisciplines(lastDisciplines);
  renderCraft();
}
renderBelt(lastBelt);

/** The server tells us which inventory slots are locked. */
export function renderLocks(slots: boolean[]) {
  locked = slots;
  renderInventory(invItems);
}

const toggleLock = (slot: number) => onLock(slot, !locked[slot]);

const lockModeBtn = document.getElementById("lock-mode")!;
const invTitle = document.getElementById("inv-title")!;
function setLockMode(on: boolean) {
  lockMode = on;
  lockModeBtn.classList.toggle("active", on);
  document.body.classList.toggle("lock-mode", on);
  invTitle.textContent = on ? "Tap items to lock" : "Inventory";
  renderInventory(invItems);
}
lockModeBtn.onclick = () => setLockMode(!lockMode);

const shopIsOpen = () => document.body.classList.contains("shop-open");

export function renderInventory(items: (ItemId | null)[]) {
  invItems = items;
  slotsEl.replaceChildren();
  const used = items.filter(Boolean).length;
  bagCountEl.textContent = used ? String(used) : "";
  const selling = shopIsOpen();
  for (let i = 0; i < INVENTORY_SIZE; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";
    const id = items[i];
    if (id) {
      const item = ITEMS[id];
      slot.classList.add("filled");
      const icon = document.createElement("span");
      icon.textContent = item.icon;
      if (item.tint) icon.style.filter = item.tint;
      slot.appendChild(icon);
      if (isTool(id)) slot.appendChild(durabilityBar(durability[i] ?? maxDurability(id), maxDurability(id)));
      const tag = document.createElement("span");
      tag.className = "price-tag";
      const price = sellPriceFor(id, lastMastery, durability[i]);
      tag.textContent = `${price}b`;
      slot.appendChild(tag);
      const isLocked = !!locked[i];
      if (isLocked) {
        slot.classList.add("locked");
        const lock = document.createElement("span");
        lock.className = "lock-badge";
        lock.textContent = "🔒";
        slot.appendChild(lock);
      }
      slot.title = lockMode ? `${isLocked ? "Unlock" : "Lock"} this ${item.single}`
        : isLocked ? `${item.name} (locked)`
        : selling ? `Sell ${item.single} for ${formatMoney(price)}`
        : isTool(id) ? `${item.name}: ${toolEffect(id)}, ${durability[i] ?? maxDurability(id)} of ${maxDurability(id)} uses left. Click to put it on your belt.`
        : `${item.name}: click to drop`;
      slot.onclick = () => {
        if (lockMode) return toggleLock(i);
        if (shopIsOpen() && !shopBuying) {
          if (isLocked) return showMessage(`That ${item.single} is locked. Tap 🔒 on your inventory, then tap it to unlock.`);
          return onSell(i);
        }
        if (isTool(id)) return onEquip(i);
        if (isLocked) return showMessage(`That ${item.single} is locked. Tap 🔒 on your inventory, then tap it to unlock.`);
        onDrop(i);
      };
    }
    slotsEl.appendChild(slot);
  }
  if (selling) renderShop();
  renderCraft();
}

// ---- Money: shown under the inventory, doesn't use a slot ----

const moneyEl = document.getElementById("money")!;

let coins = 0;
export function renderCoins(totalBronze: number) {
  coins = totalBronze;
  if (shopIsOpen()) renderShop();
  const purse = toPurse(totalBronze);
  moneyEl.replaceChildren();
  moneyEl.title = formatMoney(totalBronze);
  for (const kind of ["gold", "silver", "bronze"] as const) {
    const span = document.createElement("span");
    const coin = document.createElement("i");
    coin.className = `coin ${kind}`;
    span.append(coin, String(purse[kind]));
    span.title = `${purse[kind]} ${kind}`;
    moneyEl.appendChild(span);
  }
}
renderCoins(0);

// ---- Shop window (the Merchant) ----
// You sell by clicking items in your inventory while this is open.

const shopBody = document.getElementById("shop-body")!;

document.querySelectorAll<HTMLElement>(".shop-tab").forEach((b) => {
  b.onclick = () => {
    shopBuying = b.dataset.mode === "buy";
    resetSellAll();
    renderInventory(invItems);
  };
});

export function openShop() {
  closeCraft();
  document.body.classList.add("shop-open");
  openPanel("inventory"); // so you can click your items, on phones too
  renderInventory(invItems);
}

export function closeShop() {
  if (!shopIsOpen()) return;
  document.body.classList.remove("shop-open");
  resetSellAll();
  renderInventory(invItems);
}

// "Sell all" asks once more before selling ("Tap again to sell..."), so one
// stray tap can't empty your bag.
const sellAllBtn = document.getElementById("shop-sell-all") as HTMLButtonElement;
let sellAllArmed = false;
let sellAllTimer: number | undefined;

function resetSellAll() {
  sellAllArmed = false;
  clearTimeout(sellAllTimer);
}

sellAllBtn.onclick = () => {
  if (!sellAllArmed) {
    sellAllArmed = true;
    sellAllTimer = window.setTimeout(() => { resetSellAll(); renderShop(); }, 4000);
  } else {
    resetSellAll();
    onSellAll();
  }
  renderShop();
};

function renderShop() {
  document.querySelectorAll<HTMLElement>(".shop-tab").forEach((b) => b.classList.toggle("active", (b.dataset.mode === "buy") === shopBuying));
  document.body.classList.toggle("shop-buying", shopBuying);
  if (shopBuying) return renderBuy();
  shopBody.replaceChildren();
  shopBody.append(el("", "Tap an item in your bag to sell it. To keep one, tap 🔒 on your bag, then tap the item."));
  const prices = el("");
  prices.id = "shop-prices";
  // Prices for the kinds of thing you're carrying (there are too many to list them all).
  const carrying = [...new Set(invItems.filter((id): id is ItemId => !!id))];
  for (const id of carrying) {
    const span = document.createElement("span");
    const icon = document.createElement("span");
    icon.textContent = ITEMS[id].icon;
    if (ITEMS[id].tint) icon.style.filter = ITEMS[id].tint!;
    span.append(icon, ` ${ITEMS[id].name}: ${formatMoney(sellPriceFor(id, lastMastery))}`);
    span.className = "price";
    prices.appendChild(span);
  }
  const unlocked = invItems.filter((id, i): id is ItemId => !!id && !locked[i]);
  const total = unlocked.reduce((sum, id) => sum + sellPriceFor(id, lastMastery), 0);
  const lockedCount = invItems.filter((id, i) => id && locked[i]).length;
  shopBody.append(prices, el("", !invItems.some(Boolean) ? "You have nothing to sell. Go chop or fish!"
    : `Sell all gives you ${formatMoney(total)}` + (lockedCount ? ` (keeps ${lockedCount} locked).` : ".")));

  sellAllBtn.disabled = !unlocked.length;
  if (!unlocked.length) resetSellAll();
  sellAllBtn.textContent = sellAllArmed ? `Sell ${unlocked.length} for ${formatMoney(total)}?` : "Sell all";
  sellAllBtn.classList.toggle("armed", sellAllArmed);
}

/** The Merchant's goods: click one to buy it, or ×5 for five. */
function renderBuy() {
  shopBody.replaceChildren();
  shopBody.append(el("", `He never runs out. You have ${formatMoney(coins)}.`));
  const list = el("");
  list.id = "buy-list";
  for (const id of SHOP_STOCK) {
    const item = ITEMS[id];
    const price = buyPriceFor(id);
    const row = el("buy-row" + (coins < price ? " poor" : ""));
    const icon = el("buy-icon", item.icon);
    if (item.tint) icon.style.filter = item.tint;
    const one = document.createElement("button");
    one.className = "buy-btn";
    one.append(icon, el("buy-name", item.name), el("buy-price", formatMoney(price)));
    one.title = isTool(id) ? `${item.name}: ${toolEffect(id)}, ${maxDurability(id)} uses.` : `Buy 1 ${item.single}`;
    one.onclick = () => onBuy(id, 1);
    const five = document.createElement("button");
    five.className = "buy-five";
    five.textContent = "×5";
    five.title = `Buy 5 for ${formatMoney(price * 5)}`;
    five.onclick = () => onBuy(id, 5);
    row.append(one, five);
    list.appendChild(row);
  }
  shopBody.appendChild(list);
}

document.getElementById("shop-close")!.onclick = closeShop;

// ---- Crafting windows: the furnace (Smelting) and the anvil (Smithing) ----

const craftTitle = document.getElementById("craft-title")!;
const craftBody = document.getElementById("craft-body")!;
const craftOne = document.getElementById("craft-one") as HTMLButtonElement;
const craftAll = document.getElementById("craft-all") as HTMLButtonElement;

export function openCraft(id: string) {
  if (id !== "furnace" && id !== "anvil") return;
  closeShop();
  station = id;
  document.body.classList.add("craft-open");
  openPanel("inventory");
  renderCraft();
}

export function closeCraft() {
  station = null;
  document.body.classList.remove("craft-open");
}

/** How many of this item you have that aren't locked (crafting never uses locked items). */
const haveUnlocked = (item: ItemId) => invItems.filter((id, i) => id === item && !locked[i]).length;

/** A row of choices (metal, wood, tool type...). Locked ones show the level they need. */
function choices<T extends string>(label: string, ids: T[], current: T, show: (id: T) => { icon: string; tint?: string; name: string; lockedAt?: number }, choose: (id: T) => void) {
  const wrap = el("pick-row");
  wrap.append(el("pick-label", label));
  for (const id of ids) {
    const c = show(id);
    const b = document.createElement("button");
    b.className = "pick" + (id === current ? " active" : "") + (c.lockedAt ? " locked" : "");
    const icon = el("pick-icon", c.icon);
    if (c.tint) icon.style.filter = c.tint;
    b.append(icon, el("pick-name", c.lockedAt ? `🔒${c.lockedAt}` : c.name));
    b.title = c.lockedAt ? `${c.name}: needs level ${c.lockedAt}` : c.name;
    b.onclick = () => { choose(id); renderCraft(); };
    wrap.appendChild(b);
  }
  return wrap;
}

function renderCraft() {
  if (!station) return;
  const skill: CraftSkill = station === "furnace" ? "smelting" : "smithing";
  const level = levelForXp(lastSkillXp[skill] ?? 0);
  craftTitle.textContent = station === "furnace" ? `Furnace · Smelting level ${level}` : `Anvil · Smithing level ${level}`;
  craftBody.replaceChildren();
  const lockedAt = (m: Metal) => (level < METALS[m].level ? METALS[m].level : undefined);

  let output: ItemId;
  if (station === "furnace") {
    craftBody.append(choices("Bar", METAL_IDS, pick.bar, (m) => ({ icon: "🧈", tint: METALS[m].tint, name: METALS[m].name, lockedAt: lockedAt(m) }), (m) => { pick.bar = m; }));
    output = barId(pick.bar);
  } else {
    craftBody.append(
      choices("Tool", TOOL_TYPE_IDS, pick.type, (t) => ({ icon: TOOL_TYPES[t].icon, name: TOOL_TYPES[t].name }), (t) => { pick.type = t; }),
      choices("Metal", METAL_IDS, pick.metal, (m) => ({ icon: "🧈", tint: METALS[m].tint, name: METALS[m].name, lockedAt: lockedAt(m) }), (m) => { pick.metal = m; }),
    );
    if (pick.type !== "tongs") {
      craftBody.append(choices("Handle", WOOD_IDS, pick.wood, (w) => ({ icon: "🪵", tint: ITEMS[`${w}_logs`].tint, name: WOODS[w].name }), (w) => { pick.wood = w; }));
    }
    output = toolId(pick.type, pick.metal, pick.wood);
  }

  const recipe = recipeFor(output)!;
  const item = ITEMS[output];
  const detail = el("craft-detail");
  const head = el("craft-head");
  const icon = el("craft-icon", item.icon);
  if (item.tint) icon.style.filter = item.tint;
  head.append(icon, el("craft-name", item.name));
  detail.appendChild(head);

  // What it takes, and how many you have.
  const need = new Map<ItemId, number>();
  for (const i of recipe.inputs) need.set(i, (need.get(i) ?? 0) + 1);
  let canMake = Infinity;
  const needs = el("craft-needs");
  needs.append("Needs: ");
  [...need].forEach(([id, n], idx) => {
    const have = haveUnlocked(id);
    canMake = Math.min(canMake, Math.floor(have / n));
    const span = document.createElement("span");
    span.className = have >= n ? "have" : "short";
    span.textContent = `${n} ${ITEMS[id].single} (have ${have})`;
    if (idx) needs.append(" + ");
    needs.append(span);
  });
  detail.appendChild(needs);

  const chance = successFor(recipe, lastMastery, lastBelt);
  const tool = toolForSkill(skill)!;
  const m = masteryIn(lastMastery, recipe.mastery);
  detail.append(el("craft-chance", `${percent(chance)} success`),
    el("craft-info", `Mastery ${m}` + (lastBelt[tool] ? ` · ${ITEMS[lastBelt[tool]!.item].name} on your belt` : ` · no ${TOOL_TYPES[tool].name.toLowerCase()} on your belt (half chance)`)));
  const facts = [`Sells for ${formatMoney(sellPriceFor(output, lastMastery))}`, `${recipe.xp} XP`];
  if (isTool(output)) facts.unshift(`${toolEffect(output)}, ${maxDurability(output)} uses`);
  detail.append(el("craft-info", facts.join(" · ")));
  if (level < recipe.level) detail.append(el("craft-warn", `Needs ${findSkill(skill).def.name} level ${recipe.level}.`));
  else if (!canMake) detail.append(el("craft-warn", "You don't have the materials. The Merchant sells them."));
  else detail.append(el("craft-info", `You have enough for ${canMake}. A failed try loses the materials.`));
  craftBody.appendChild(detail);

  const ok = level >= recipe.level && canMake > 0;
  craftOne.disabled = !ok;
  craftAll.disabled = !ok;
  craftAll.textContent = ok && canMake > 1 ? `Make all (${canMake})` : "Make all";
  craftOne.onclick = () => onCraft(output, false);
  craftAll.onclick = () => onCraft(output, true);
}

document.getElementById("craft-close")!.onclick = closeCraft;

/** RuneScape-style "Action Target" text next to the cursor. */
export function setHoverText(action: string | null, target = "", x = 0, y = 0) {
  if (!action) { hoverEl.style.display = "none"; return; }
  hoverEl.innerHTML = "";
  hoverEl.append(action + " ");
  const b = document.createElement("b");
  b.textContent = target;
  hoverEl.append(b);
  hoverEl.style.left = `${x + 14}px`;
  hoverEl.style.top = `${y + 14}px`;
  hoverEl.style.display = "block";
}
