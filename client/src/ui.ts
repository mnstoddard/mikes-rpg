import { INVENTORY_SIZE, ITEMS, ItemId } from "../../shared/items";
import { formatMoney, toPurse } from "../../shared/money";
import { DISCIPLINES, DISCIPLINE_IDS, DisciplineId, DisciplineXp, MAX_LEVEL, SkillId, emptyDisciplines, levelForXp, xpForLevel } from "../../shared/disciplines";
import { MasteryXp, emptyMastery, masteryLevelForXp, masteryXpForLevel, speedBonusPercent } from "../../shared/mastery";
import { RESOURCES, resourcesFor } from "../../shared/foraging";

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
let lastMastery: MasteryXp = emptyMastery();
let flashSkill: SkillId | undefined;
/** Skills whose list of types is opened up (click a skill to toggle). */
const expanded = new Set<SkillId>();

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
      sub.title = `${skill.description} Click to see what Mastery unlocks.`;
      const head = el("ss-head");
      head.append(el("ss-icon", skill.icon), el("ss-name", skill.name),
        el("ss-state", unlocked ? "✓" : `🔒 Lv ${skill.unlockLevel}`));
      sub.appendChild(head);
      sub.appendChild(masteryDetails(skill.id));
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

/** Mastery level, progress bar, speed bonus and what's next, under each skill. */
function masteryDetails(skill: SkillId): HTMLElement {
  const xp = lastMastery[skill] ?? 0;
  const level = masteryLevelForXp(xp);
  const start = masteryXpForLevel(level);
  const next = masteryXpForLevel(level + 1);
  const box = el("mastery");
  const top = el("m-top");
  top.append(el("m-level", `Mastery ${level}`), el("m-speed", `${speedBonusPercent(level)}% faster`));
  const bar = el("skill-bar m-bar");
  const fill = document.createElement("div");
  fill.style.width = `${Math.floor(((xp - start) / (next - start)) * 100)}%`;
  bar.appendChild(fill);
  const types = resourcesFor(skill);
  const upcoming = types.find((id) => RESOURCES[id].mastery > level);
  const info = el("m-info", `${(next - xp).toLocaleString()} XP to Mastery ${level + 1}` +
    (upcoming ? ` · Next: ${ITEMS[RESOURCES[upcoming].item].name} at ${RESOURCES[upcoming].mastery}` : ""));
  box.append(top, bar, info);
  if (expanded.has(skill)) {
    const list = el("m-types");
    for (const id of types) {
      const r = RESOURCES[id];
      const item = ITEMS[r.item];
      const open = level >= r.mastery;
      const row = el("m-type" + (open ? "" : " locked"));
      const icon = el("m-type-icon", item.icon);
      if (item.tint) icon.style.filter = item.tint;
      row.append(icon, el("m-type-name", item.name), el("m-type-state", open ? `${r.xp} XP` : `🔒 ${r.mastery}`));
      row.title = `${r.node}: about ${r.seconds}s each for a new player, ${r.xp} XP, sells for ${formatMoney(item.sellPrice)}`;
      list.appendChild(row);
    }
    box.appendChild(list);
  }
  return box;
}

export function renderMastery(mastery: MasteryXp) {
  lastMastery = mastery;
  renderDisciplines(lastDisciplines);
}

export function flashDiscipline(id: DisciplineId) {
  renderDisciplines(lastDisciplines, id);
}

export function flashMastery(skill: SkillId) {
  flashSkill = skill;
  renderDisciplines(lastDisciplines);
  flashSkill = undefined;
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
// unlocks every item of that type instead.
let invItems: (ItemId | null)[] = [];
let locked = new Set<ItemId>();
let lockMode = false;
let onDrop: (slot: number) => void = () => {};
let onSell: (slot: number) => void = () => {};
let onSellAll: () => void = () => {};
let onLock: (item: ItemId, locked: boolean) => void = () => {};

export function setInventoryActions(actions: {
  drop: (slot: number) => void;
  sell: (slot: number) => void;
  sellAll: () => void;
  lock: (item: ItemId, locked: boolean) => void;
}) {
  onDrop = actions.drop;
  onSell = actions.sell;
  onSellAll = actions.sellAll;
  onLock = actions.lock;
}

/** The server tells us which item types are locked. */
export function renderLocks(items: ItemId[]) {
  locked = new Set(items);
  renderInventory(invItems);
}

const toggleLock = (id: ItemId) => onLock(id, !locked.has(id));

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
      const tag = document.createElement("span");
      tag.className = "price-tag";
      tag.textContent = `${item.sellPrice}b`;
      slot.appendChild(tag);
      const isLocked = locked.has(id);
      if (isLocked) {
        slot.classList.add("locked");
        const lock = document.createElement("span");
        lock.className = "lock-badge";
        lock.textContent = "🔒";
        slot.appendChild(lock);
      }
      slot.title = lockMode ? `${isLocked ? "Unlock" : "Lock"} ${item.name.toLowerCase()}`
        : isLocked ? `${item.name} (locked)`
        : selling ? `Sell ${item.single} for ${formatMoney(item.sellPrice)}` : `${item.name}: click to drop`;
      slot.onclick = () => {
        if (lockMode) return toggleLock(id);
        if (isLocked) return showMessage(`You locked your ${item.name.toLowerCase()}. Tap 🔒 on your inventory to unlock.`);
        if (shopIsOpen()) onSell(i); else onDrop(i);
      };
    }
    slotsEl.appendChild(slot);
  }
  if (selling) renderShop();
}

// ---- Money: shown under the inventory, doesn't use a slot ----

const moneyEl = document.getElementById("money")!;

export function renderCoins(totalBronze: number) {
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

export function openShop() {
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
  shopBody.replaceChildren();
  shopBody.append(el("", "Tap an item in your bag to sell it. Tap a price to 🔒 lock that item."));
  const prices = el("");
  prices.id = "shop-prices";
  // Prices for the kinds of thing you're carrying (there are too many to list them all).
  const carrying = [...new Set(invItems.filter((id): id is ItemId => !!id))];
  for (const id of carrying) {
    const btn = document.createElement("button");
    const icon = document.createElement("span");
    icon.textContent = ITEMS[id].icon;
    if (ITEMS[id].tint) icon.style.filter = ITEMS[id].tint!;
    const isLocked = locked.has(id);
    btn.append(icon, ` ${ITEMS[id].name}: ${formatMoney(ITEMS[id].sellPrice)}${isLocked ? " 🔒" : ""}`);
    btn.className = "price" + (isLocked ? " locked" : "");
    btn.title = isLocked ? `Unlock ${ITEMS[id].name.toLowerCase()}` : `Lock ${ITEMS[id].name.toLowerCase()} so they won't be sold`;
    btn.onclick = () => toggleLock(id);
    prices.appendChild(btn);
  }
  const unlocked = invItems.filter((id): id is ItemId => !!id && !locked.has(id));
  const total = unlocked.reduce((sum, id) => sum + ITEMS[id].sellPrice, 0);
  const lockedCount = invItems.filter((id) => id && locked.has(id)).length;
  shopBody.append(prices, el("", !invItems.some(Boolean) ? "You have nothing to sell. Go chop or fish!"
    : `Sell all gives you ${formatMoney(total)}` + (lockedCount ? ` (keeps ${lockedCount} locked).` : ".")));

  sellAllBtn.disabled = !unlocked.length;
  if (!unlocked.length) resetSellAll();
  sellAllBtn.textContent = sellAllArmed ? `Sell ${unlocked.length} for ${formatMoney(total)}?` : "Sell all";
  sellAllBtn.classList.toggle("armed", sellAllArmed);
}

document.getElementById("shop-close")!.onclick = closeShop;

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
