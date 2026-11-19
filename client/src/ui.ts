import { INVENTORY_SIZE, ITEMS, ItemId } from "../../shared/items";
import { formatMoney, toPurse } from "../../shared/money";
import { DISCIPLINES, DISCIPLINE_IDS, DisciplineId, DisciplineXp, MAX_LEVEL, SkillId, SkillXp, emptyDisciplines, emptySkills, findSkill, levelForXp, xpForLevel } from "../../shared/disciplines";
import { ItemMasteryXp, masteryLevelForXp, masteryXpForLevel, speedBonusPercent, valueBonusPercent } from "../../shared/mastery";
import { RESOURCES, ResourceId, resourcesFor, sellPriceFor } from "../../shared/foraging";

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
let flashType: ResourceId | undefined;
/** Skills whose list of types is showing (click a skill to fold it away). */
const expanded = new Set<SkillId>(["woodcutting", "fishing", "mining"]);

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

export function renderSkillXp(skillXp: SkillXp) {
  lastSkillXp = skillXp;
  renderDisciplines(lastDisciplines);
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

export function flashMastery(type: ResourceId) {
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
let lockMode = false;
let onDrop: (slot: number) => void = () => {};
let onSell: (slot: number) => void = () => {};
let onSellAll: () => void = () => {};
let onLock: (slot: number, locked: boolean) => void = () => {};

export function setInventoryActions(actions: {
  drop: (slot: number) => void;
  sell: (slot: number) => void;
  sellAll: () => void;
  lock: (slot: number, locked: boolean) => void;
}) {
  onDrop = actions.drop;
  onSell = actions.sell;
  onSellAll = actions.sellAll;
  onLock = actions.lock;
}

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
      const tag = document.createElement("span");
      tag.className = "price-tag";
      const price = sellPriceFor(id, lastMastery);
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
        : selling ? `Sell ${item.single} for ${formatMoney(price)}` : `${item.name}: click to drop`;
      slot.onclick = () => {
        if (lockMode) return toggleLock(i);
        if (isLocked) return showMessage(`That ${item.single} is locked. Tap 🔒 on your inventory, then tap it to unlock.`);
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
