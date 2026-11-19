import { INVENTORY_SIZE, ITEMS, ItemId } from "../../shared/items";
import { formatMoney, toPurse } from "../../shared/money";
import { CraftSkill, DISCIPLINES, DISCIPLINE_IDS, DisciplineId, DisciplineXp, MAX_LEVEL, SkillId, SkillXp, emptyDisciplines, emptySkills, findSkill, isCraftSkill, levelForXp, xpForLevel } from "../../shared/disciplines";
import { ItemMasteryXp, MasteryId, craftSuccess, masteryValue, masteryIn, masteryLevelForXp, masterySuccess, masteryXpForLevel, percent, speedBonusPercent, valueBonusPercent } from "../../shared/mastery";
import { RESOURCES, resourcesFor } from "../../shared/foraging";
import { SHOP_STOCK, STEW_START_SUCCESS, beltBonus, buyPriceFor, masteryIdFor, masteryName, recipeFor, sellPriceFor, successFor } from "../../shared/crafting";
import { RESOURCE_FOR_ITEM } from "../../shared/foraging";
import { CRAFT_MARKUP } from "../../shared/items";
import {
  BAR_IDS, Belt, MATERIALS, MATERIAL_IDS, Material, METALS, METAL_IDS, Metal, TOOL_TYPES, TOOL_TYPE_IDS, ToolType, WOODS, WOOD_IDS, Wood, barId, emptyBelt,
  hasHandle, isTool, maxDurability, metalOfBar, parseTool, toolBonus, toolForSkill, toolId,
} from "../../shared/tools";
import {
  FISH_IDS, FUEL_STAMINA, FishId, MAX_STAMINA, RAW_FISH_STAMINA, STAMINA_COST, STEW_COUNTS, STEW_MASTERY, STEW_MULTIPLIER, StewCount,
  foodStamina, isFood, isStew, parseStew, stewBaseStamina, stewId,
} from "../../shared/cooking";

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
let station: "furnace" | "anvil" | "stove" | null = null;
const pick = { bar: "bronze" as Metal, type: "axe" as ToolType, metal: "stone" as Material, wood: "pine" as Wood, fish: "minnow" as FishId, count: 3 as StewCount, fuel: "pine" as Wood };
const STATION_SKILL = { furnace: "smelting", anvil: "smithing", stove: "cooking" } as const;
/** The item whose info card is showing. */
type InfoTarget = { kind: "slot"; slot: number } | { kind: "belt"; type: ToolType };
let info: InfoTarget | null = null;
/** The Merchant's window is on its Buy tab (otherwise Sell). */
let shopBuying = false;
/** Skills whose list of types is showing (click a skill to fold it away). */
// Everything starts folded up; click a Discipline or skill to open it.
const expanded = new Set<SkillId>();
const openDisciplines = new Set<DisciplineId>();

const el = (cls: string, text = "") => {
  const d = document.createElement("div");
  d.className = cls;
  d.textContent = text;
  return d;
};

/** Drawn icons for things with no good emoji (tongs, pot). Tinted the same way as emoji. */
const SVG_ICONS: Record<string, string> = {
  tongs: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 30 L15 15 Q19 9 22 4 L26 3" stroke="#2b2f33" stroke-width="4.5"/><path d="M9 31 L15 15 Q22 11 27 9 L29 6" stroke="#2b2f33" stroke-width="4.5"/><path d="M3 30 L15 15 Q19 9 22 4 L26 3" stroke="#a9b0b7" stroke-width="2.5"/><path d="M9 31 L15 15 Q22 11 27 9 L29 6" stroke="#a9b0b7" stroke-width="2.5"/></g><circle cx="15" cy="15" r="2.6" fill="#555b61" stroke="#2b2f33" stroke-width="1"/></svg>`,
  pot: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g stroke="#2b2f33" stroke-width="1.6" stroke-linejoin="round"><path d="M2 13 h5 M25 13 h5" stroke-width="3.5" stroke-linecap="round"/><path d="M5 11 h22 v3 q0 14 -11 14 q-11 0 -11 -14 z" fill="#a9b0b7"/><rect x="4" y="8.5" width="24" height="3.5" rx="1.5" fill="#c9d0d6"/><path d="M13 8.5 q3 -4 6 0" fill="none" stroke-width="2.2"/></g><path d="M9 15 q0 8 5 10" fill="none" stroke="#e4e9ed" stroke-width="1.6" stroke-linecap="round"/></svg>`,
};

/** An icon: an emoji, or "svg:name" for a drawn one. */
function icon(cls: string, glyph: string, tint?: string): HTMLElement {
  const box = document.createElement("span");
  box.className = cls;
  if (glyph.startsWith("svg:")) {
    const img = document.createElement("img");
    img.className = "svg-icon";
    img.alt = "";
    img.src = `data:image/svg+xml,${encodeURIComponent(SVG_ICONS[glyph.slice(4)] ?? "")}`;
    box.appendChild(img);
  } else {
    box.textContent = glyph;
  }
  if (tint) box.style.filter = tint;
  return box;
}

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
    const isOpen = openDisciplines.has(id);
    row.className = "skill" + (flash === id ? " flash" : "") + (isOpen ? " open" : "");
    row.title = `${def.description} Click to ${isOpen ? "fold it up" : "show its skills"}.`;
    row.onclick = () => {
      if (isOpen) openDisciplines.delete(id); else openDisciplines.add(id);
      renderDisciplines(lastDisciplines);
    };
    const bar = el("skill-bar");
    const fill = document.createElement("div");
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    row.append(
      el("skill-icon", def.icon),
      el("skill-name", `${isOpen ? "▾" : "▸"} ${def.name}`),
      el("skill-level", `Lv ${level}`),
      bar,
      el("skill-xp", maxed ? `${xp.toLocaleString()} XP (max level)` : `${xp.toLocaleString()} / ${next.toLocaleString()} XP · ${(next - xp).toLocaleString()} to go`),
    );

    if (!isOpen) {
      skillListEl.appendChild(row);
      continue;
    }
    // The skills inside this Discipline, and when they unlock.
    const subs = el("subskills");
    subs.style.gridColumn = "1 / 4";
    for (const skill of def.skills) {
      const unlocked = level >= skill.unlockLevel;
      const sub = el("subskill" + (unlocked ? "" : " locked") + (flashSkill === skill.id ? " flash" : ""));
      sub.title = `${skill.description} Click to show or hide its details.`;
      const head = el("ss-head");
      const open = expanded.has(skill.id);
      head.append(el("ss-icon", skill.icon), el("ss-name", `${open ? "▾" : "▸"} ${skill.name}`),
        el("ss-state", unlocked ? `Lv ${levelForXp(lastSkillXp[skill.id] ?? 0)}` : `🔒 ${def.name} ${skill.unlockLevel}`));
      sub.appendChild(head);
      if (open) sub.appendChild(skillDetails(skill.id));
      sub.onclick = (e) => {
        e.stopPropagation(); // don't also fold up the Discipline
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
  if (skill === "cooking") return cookingDetails(level, box);
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
    const ic = icon("m-type-icon", item.icon, item.tint);
    if (!open) {
      row.append(ic, el("m-type-name", item.name), el("m-type-state", `🔒 Lv ${r.level}`));
      row.title = `Reach ${findSkill(skill).def.name} level ${r.level} to gather ${item.name}.`;
    } else {
      const mXp = lastMastery[id] ?? 0;
      const m = masteryLevelForXp(mXp);
      const mStart = masteryXpForLevel(m), mNext = masteryXpForLevel(m + 1);
      const price = sellPriceFor(r.item, lastMastery);
      row.append(ic, el("m-type-name", item.name), el("m-type-state", `Mastery ${m}`));
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
function masteryRow(id: MasteryId, name: string, glyph: string, tint: string | undefined, info: (m: number) => string, title: (m: number) => string) {
  const mXp = lastMastery[id] ?? 0;
  const m = masteryLevelForXp(mXp);
  const mStart = masteryXpForLevel(m), mNext = masteryXpForLevel(m + 1);
  const row = el("m-type" + (flashType === id ? " flash" : ""));
  const iconEl = icon("m-type-icon", glyph, tint);
  const mBar = el("skill-bar t-bar");
  const mFill = document.createElement("div");
  mFill.style.width = `${Math.floor(((mXp - mStart) / (mNext - mStart)) * 100)}%`;
  mBar.appendChild(mFill);
  row.append(iconEl, el("m-type-name", name), el("m-type-state", `Mastery ${m}`), mBar, el("t-info", info(m)));
  row.title = `${name} Mastery ${m}: ${(mNext - mXp).toLocaleString()} XP to ${m + 1}. ${title(m)}`;
  return row;
}

/** Your belt tool for a crafting skill, or what having none does. */
function beltLine(skill: CraftSkill) {
  const tool = toolForSkill(skill)!;
  const bonus = beltBonus(lastBelt, skill);
  return el("m-info", lastBelt[tool] ? `Using ${ITEMS[lastBelt[tool]!.item].name}: ${Math.round(bonus! * 100)}% fewer failures`
    : `No ${TOOL_TYPES[tool].name.toLowerCase()} on your belt: half the success chance`);
}

/** Cooking: which fish you can cook, and your Fish stew Mastery. */
function cookingDetails(level: number, box: HTMLElement) {
  const upcoming = FISH_IDS.find((f) => RESOURCES[f].level > level);
  if (upcoming) box.append(el("m-info", `Next unlock: ${ITEMS[upcoming].name} stew at level ${RESOURCES[upcoming].level}`));
  box.append(beltLine("cooking"));
  if (!expanded.has("cooking")) return box;
  const list = el("m-types");
  const bonus = beltBonus(lastBelt, "cooking");
  list.appendChild(masteryRow(STEW_MASTERY, "Fish stew", "🍲", undefined,
    (m) => `${percent(craftSuccess(m, bonus, STEW_START_SUCCESS))} success · +${valueBonusPercent(m)}% stamina and value`,
    (m) => `Every fish stew shares this Mastery. ${percent(masterySuccess(m, STEW_START_SUCCESS))} base success; stews give ${valueBonusPercent(m)}% more stamina and sell for ${valueBonusPercent(m)}% more.`));
  for (const fish of FISH_IDS) {
    const lv = RESOURCES[fish].level;
    const row = el("m-type" + (level < lv ? " locked" : ""));
    row.append(icon("m-type-icon", ITEMS[fish].icon, ITEMS[fish].tint), el("m-type-name", `${ITEMS[fish].name} stew`),
      el("m-type-state", level < lv ? `🔒 Lv ${lv}` : `${RAW_FISH_STAMINA[fish] * STEW_MULTIPLIER} per fish`));
    list.appendChild(row);
  }
  box.appendChild(list);
  return box;
}

/** Smelting: each bar's Mastery. Smithing: each kind of tool's Mastery. Shows your success chance with your belt tool. */
function craftDetails(skill: CraftSkill, level: number, box: HTMLElement) {
  const upcoming = METAL_IDS.find((m) => METALS[m].level > level);
  if (upcoming) {
    const m = METALS[upcoming];
    box.append(el("m-info", `Next unlock: ${skill === "smelting" ? `${m.name} bars` : `${m.name} tools`} at level ${m.level}`));
  }
  const bonus = beltBonus(lastBelt, skill);
  box.append(beltLine(skill));
  if (!expanded.has(skill)) return box;
  const list = el("m-types");
  if (skill === "smelting") {
    for (const bar of BAR_IDS) {
      const metal = METALS[metalOfBar(bar)];
      if (level < metal.level) {
        const row = el("m-type locked");
        row.append(icon("m-type-icon", "🧈", metal.tint), el("m-type-name", ITEMS[bar].name), el("m-type-state", `🔒 Lv ${metal.level}`));
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
      if (type === "pot") continue; // pots are made at the anvil, but they help Cooking
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
let onEat: (slot: number) => void = () => {};

export function setInventoryActions(actions: {
  drop: (slot: number) => void;
  sell: (slot: number) => void;
  sellAll: () => void;
  lock: (slot: number, locked: boolean) => void;
  equip: (slot: number) => void;
  unequip: (type: ToolType) => void;
  buy: (item: ItemId, count: number) => void;
  craft: (item: ItemId, all: boolean) => void;
  eat: (slot: number) => void;
}) {
  onEat = actions.eat;
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
  renderInfo();
  beltEl.replaceChildren();
  for (const type of TOOL_TYPE_IDS) {
    const t = TOOL_TYPES[type];
    const on = belt[type];
    const slot = el("slot belt-slot" + (on ? " filled" : ""));
    if (on) {
      const max = maxDurability(on.item);
      slot.append(icon("", t.icon, ITEMS[on.item].tint), durabilityBar(on.durability, max));
      slot.title = `${ITEMS[on.item].name}: ${toolEffect(on.item)}. ${on.durability} of ${max} uses left. Click for details.`;
      slot.onclick = () => showInfo({ kind: "belt", type });
    } else {
      slot.appendChild(icon("empty-tool", t.icon));
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
      slot.appendChild(icon("item-icon", item.icon, item.tint));
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
        : `${item.name}: click for details`;
      slot.onclick = () => {
        if (lockMode) return toggleLock(i);
        if (shopIsOpen() && !shopBuying) {
          if (isLocked) return showMessage(`That ${item.single} is locked. Tap 🔒 on your inventory, then tap it to unlock.`);
          return onSell(i);
        }
        showInfo({ kind: "slot", slot: i });
      };
    }
    slotsEl.appendChild(slot);
  }
  if (selling) renderShop();
  renderCraft();
  renderInfo();
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
  closeInfo();
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
    span.append(icon("", ITEMS[id].icon, ITEMS[id].tint), ` ${ITEMS[id].name}: ${formatMoney(sellPriceFor(id, lastMastery))}`);
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
    const ic = icon("buy-icon", item.icon, item.tint);
    const one = document.createElement("button");
    one.className = "buy-btn";
    one.append(ic, el("buy-name", item.name), el("buy-price", formatMoney(price)));
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
  if (id !== "furnace" && id !== "anvil" && id !== "stove") return;
  closeShop();
  closeInfo();
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
    b.append(icon("pick-icon", c.icon, c.tint), el("pick-name", c.lockedAt ? `🔒${c.lockedAt}` : c.name));
    b.title = c.lockedAt ? `${c.name}: needs level ${c.lockedAt}` : c.name;
    b.onclick = () => { choose(id); renderCraft(); };
    wrap.appendChild(b);
  }
  return wrap;
}

function renderCraft() {
  if (!station) return;
  const skill: CraftSkill = STATION_SKILL[station];
  const level = levelForXp(lastSkillXp[skill] ?? 0);
  craftTitle.textContent = `${{ furnace: "Furnace", anvil: "Anvil", stove: "Stove" }[station]} · ${findSkill(skill).def.name} level ${level}`;
  craftBody.replaceChildren();
  const lockedAt = (m: Material) => (level < MATERIALS[m].level ? MATERIALS[m].level : undefined);
  const { discipline, def: skillDef } = findSkill(skill);
  const disciplineLevel = levelForXp(lastDisciplines[discipline] ?? 0);
  if (disciplineLevel < skillDef.unlockLevel) {
    craftBody.append(el("craft-warn", `${skillDef.name} unlocks at ${DISCIPLINES[discipline].name} level ${skillDef.unlockLevel} (you're level ${disciplineLevel}). Make a few stone tools at the anvil first.`));
    craftOne.disabled = true;
    craftAll.disabled = true;
    return;
  }

  let output: ItemId;
  if (station === "furnace") {
    craftBody.append(choices("Bar", METAL_IDS, pick.bar, (m) => ({ icon: "🧈", tint: METALS[m].tint, name: METALS[m].name, lockedAt: lockedAt(m) }), (m) => { pick.bar = m; }));
    output = barId(pick.bar);
  } else if (station === "stove") {
    craftBody.append(
      choices("Fish", FISH_IDS, pick.fish, (f) => ({ icon: ITEMS[f].icon, tint: ITEMS[f].tint, name: ITEMS[f].name, lockedAt: level < RESOURCES[f].level ? RESOURCES[f].level : undefined }), (f) => { pick.fish = f; }),
      choices("How many fish", STEW_COUNTS.map(String), String(pick.count), (n) => ({ icon: "🐟", name: `×${n}` }), (n) => { pick.count = Number(n) as StewCount; }),
      choices("Log to burn (better wood, more stamina)", WOOD_IDS, pick.fuel, (w) => ({ icon: "🪵", tint: ITEMS[`${w}_logs`].tint, name: `${WOODS[w].name} +${FUEL_STAMINA[w]}` }), (w) => { pick.fuel = w; }),
    );
    output = stewId(pick.fish, pick.count, pick.fuel);
  } else {
    craftBody.append(
      choices("Tool", TOOL_TYPE_IDS, pick.type, (t) => ({ icon: TOOL_TYPES[t].icon, name: TOOL_TYPES[t].name }), (t) => { pick.type = t; }),
      choices("Head", MATERIAL_IDS, pick.metal, (m) => ({ icon: m === "stone" ? "🪨" : "🧈", tint: MATERIALS[m].tint, name: MATERIALS[m].name, lockedAt: lockedAt(m) }), (m) => { pick.metal = m; }),
    );
    if (hasHandle(pick.type)) {
      craftBody.append(choices("Handle", WOOD_IDS, pick.wood, (w) => ({ icon: "🪵", tint: ITEMS[`${w}_logs`].tint, name: WOODS[w].name }), (w) => { pick.wood = w; }));
    }
    output = toolId(pick.type, pick.metal, pick.wood);
  }

  const recipe = recipeFor(output)!;
  const item = ITEMS[output];
  const detail = el("craft-detail");
  const head = el("craft-head");
  head.append(icon("craft-icon", item.icon, item.tint), el("craft-name", item.name));
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
    el("craft-info", `Mastery ${m}` + (lastBelt[tool] ? ` · ${ITEMS[lastBelt[tool]!.item].name} on your belt`
      : recipe.needsTool ? ` · no ${TOOL_TYPES[tool].name.toLowerCase()} on your belt (half chance)` : ` · no ${TOOL_TYPES[tool].name.toLowerCase()} needed`)));
  const facts = [`Sells for ${formatMoney(sellPriceFor(output, lastMastery))}`, `${recipe.xp} XP`, `costs ${STAMINA_COST[skill]} stamina`];
  if (isTool(output)) facts.unshift(`${toolEffect(output)}, ${maxDurability(output)} uses`);
  if (isStew(output)) facts.unshift(`Gives ${foodStamina(output, lastMastery)} stamina`);
  detail.append(el("craft-info", facts.join(" · ")));
  if (level < recipe.level) detail.append(el("craft-warn", `Needs ${findSkill(skill).def.name} level ${recipe.level}.`));
  else if (!canMake) detail.append(el("craft-warn", station === "stove" ? "You don't have the fish and log. Go fishing!" : "You don't have the materials. The Merchant sells them."));
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

// ---- Item info card: click an item (or a belt tool) to see what it's worth and does ----

const infoBody = document.getElementById("info-body")!;
const infoButtons = document.getElementById("info-buttons")!;

function showInfo(target: InfoTarget) {
  info = target;
  document.body.classList.add("info-open");
  renderInfo();
}

export function closeInfo() {
  info = null;
  document.body.classList.remove("info-open");
}

function infoLine(label: string, value: string, note = "") {
  const row = el("info-row");
  row.append(el("info-label", label), el("info-value", value));
  if (note) row.append(el("info-note", note));
  return row;
}

function infoButton(text: string, action: () => void, disabled = false) {
  const b = document.createElement("button");
  b.className = "shop-btn";
  b.textContent = text;
  b.disabled = disabled;
  b.onclick = action;
  infoButtons.appendChild(b);
}

function renderInfo() {
  if (!info) return;
  const target = info;
  let id: ItemId | null;
  let uses: number | null = null;
  if (target.kind === "slot") {
    id = invItems[target.slot] ?? null;
    uses = durability[target.slot] ?? null;
  } else {
    const t = lastBelt[target.type];
    id = t?.item ?? null;
    uses = t?.durability ?? null;
  }
  if (!id) return closeInfo();
  const item = ITEMS[id];
  const isLocked = target.kind === "slot" && !!locked[target.slot];
  infoBody.replaceChildren();
  infoButtons.replaceChildren();
  const head = el("craft-head");
  head.append(icon("craft-icon", item.icon, item.tint), el("craft-name", item.name + (isLocked ? " 🔒" : "")));
  infoBody.appendChild(head);

  // Value: base price, your Mastery multiplier, and what the Merchant pays and charges.
  const mid = masteryIdFor(id);
  const m = masteryIn(lastMastery, mid);
  infoBody.append(infoLine("Base value", formatMoney(item.sellPrice), item.inputs ? "its materials + 25%" : ""));
  infoBody.append(infoLine("Mastery", `${masteryName(mid)} ${m}`, `×${masteryValue(m).toFixed(2)} value`));
  if (item.inputs) {
    const counts = new Map<ItemId, number>();
    for (const i of item.inputs) counts.set(i, (counts.get(i) ?? 0) + 1);
    const parts = [...counts].map(([i, n]) => `${n} ${n === 1 ? ITEMS[i].single : ITEMS[i].name.toLowerCase()} (${formatMoney(sellPriceFor(i, lastMastery))} each)`).join(" + ");
    infoBody.append(infoLine("Made from", parts, `×${CRAFT_MARKUP}, then your Mastery`));
  }
  const price = sellPriceFor(id, lastMastery, uses);
  infoBody.append(infoLine("Merchant pays", formatMoney(price), isTool(id) && uses != null && uses < maxDurability(id) ? "less because it's worn" : ""));
  if (SHOP_STOCK.includes(id)) infoBody.append(infoLine("Merchant sells", formatMoney(buyPriceFor(id))));

  // Where it comes from.
  const res = RESOURCE_FOR_ITEM[id];
  const recipe = recipeFor(id);
  if (res) {
    const r = RESOURCES[res];
    infoBody.append(infoLine("Gathered", `${findSkill(r.skill).def.name} level ${r.level}`, `${r.xp} XP each`));
  } else if (recipe) {
    infoBody.append(infoLine("Made with", `${findSkill(recipe.skill).def.name} level ${recipe.level}`,
      `${percent(successFor(recipe, lastMastery, lastBelt))} success for you · ${recipe.xp} XP`));
  }

  // Food: how much stamina it gives (stews: what goes into that).
  if (isFood(id)) {
    const gain = foodStamina(id, lastMastery);
    if (isStew(id)) {
      const { fish, count, wood } = parseStew(id);
      const sm = masteryIn(lastMastery, STEW_MASTERY);
      infoBody.append(infoLine("Stamina", `+${gain}`,
        `${count} ${ITEMS[fish].single} × ${RAW_FISH_STAMINA[fish]} × ${STEW_MULTIPLIER} + ${WOODS[wood].name.toLowerCase()} fire ${FUEL_STAMINA[wood]} = ${stewBaseStamina(id)}, ×${masteryValue(sm).toFixed(2)} Mastery`));
    } else {
      infoBody.append(infoLine("Stamina", `+${gain}`, `raw; cook it into stew at the stove for ${STEW_MULTIPLIER} times as much`));
    }
  }

  // Tools: what it does and how long it lasts.
  if (isTool(id)) {
    const max = maxDurability(id);
    const left = uses ?? max;
    infoBody.append(infoLine("Bonus", toolEffect(id)));
    const bar = durabilityBar(left, max);
    const row = infoLine("Uses left", `${left} of ${max}`, "harder trees, rocks, fish and recipes wear it faster");
    row.appendChild(bar);
    infoBody.append(row);
  }

  if (target.kind === "belt") {
    infoButton("Take off", () => { onUnequip(target.type); closeInfo(); });
  } else {
    const slot = target.slot;
    if (isTool(id)) infoButton("Put on belt", () => { onEquip(slot); closeInfo(); });
    if (isFood(id)) infoButton(`Eat (+${foodStamina(id, lastMastery)})`, () => { onEat(slot); closeInfo(); }, staminaNow >= MAX_STAMINA);
    infoButton(isLocked ? "Unlock" : "Lock", () => onLock(slot, !isLocked));
    infoButton("Drop", () => { onDrop(slot); closeInfo(); }, isLocked);
  }
  infoButton("Close", closeInfo);
}

// ---- Stamina bar (top left, always showing) ----

const staminaEl = document.getElementById("stamina")!;
let staminaNow = MAX_STAMINA;

export function renderStamina(stamina: number, max: number) {
  staminaNow = stamina;
  staminaEl.replaceChildren();
  const bar = el("stamina-bar");
  const fill = document.createElement("div");
  fill.style.width = `${Math.floor((stamina / max) * 100)}%`;
  if (stamina < 10) fill.style.background = "#e74c3c";
  else if (stamina < 30) fill.style.background = "#f1c40f";
  bar.appendChild(fill);
  staminaEl.append(el("stamina-label", `⚡ ${stamina}/${max}`), bar);
  const c = STAMINA_COST;
  staminaEl.title = `Stamina ${stamina} of ${max}. Chopping costs ${c.woodcutting}, mining ${c.mining}, smelting ${c.smelting}, smithing ${c.smithing}, cooking ${c.cooking}, fishing ${c.fishing}. ` +
    "It comes back 1 every 30 seconds. Eat fish or stew (click it in your bag) for more.";
  renderInfo(); // the Eat button turns off when you're full
}
renderStamina(MAX_STAMINA, MAX_STAMINA);

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
