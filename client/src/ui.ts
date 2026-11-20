import { INVENTORY_SIZE, ITEMS, ItemId } from "../../shared/items";
import { formatMoney, toPurse } from "../../shared/money";
import { CraftSkill, DISCIPLINES, DISCIPLINE_IDS, DisciplineId, DisciplineXp, MAX_LEVEL, SkillId, SkillXp, emptyDisciplines, emptySkills, findSkill, isCraftSkill, levelForXp, xpForLevel } from "../../shared/disciplines";
import { ItemMasteryXp, MasteryId, craftSuccess, masteryValue, masteryIn, masteryLevelForXp, masterySuccess, masteryXpForLevel, percent, speedBonusPercent, valueBonusPercent } from "../../shared/mastery";
import { RESOURCES, forageXp, resourcesFor } from "../../shared/foraging";
import { SHOP_STOCK, STEW_START_SUCCESS, beltBonus, buyPriceFor, masteryIdFor, masteryName, recipeFor, sellPriceFor, successFor } from "../../shared/crafting";
import { RESOURCE_FOR_ITEM } from "../../shared/foraging";
import { CRAFT_MARKUP } from "../../shared/items";
import {
  BAR_IDS, Belt, MATERIALS, MATERIAL_IDS, Material, METALS, METAL_IDS, Metal, TOOL_TYPES, TOOL_TYPE_IDS, ToolType, WOODS, WOOD_IDS, Wood, barId, emptyBelt,
  ROD_LOGS, hasHandle, isTool, isWoodTool, maxDurability, metalOfBar, parseTool, toolBonus, toolForSkill, toolId,
} from "../../shared/tools";
import { GUIDE_NAME, type QuestView } from "../../shared/quests";
import { PLAYER_COLORS } from "../../shared/colors";
import {
  ARMOR, ARMOR_TYPES, ArmorType, GEAR_SLOTS, Gear, GearSlot, SLOT_ICONS, SLOT_NAMES, WEAPONS, WEAPON_TYPES, WeaponType,
  armorId, emptyGear, isArmor, isGear, isWeapon, parseWeapon, weaponId,
} from "../../shared/gear";
import {
  ARMOR_LEVEL, CombatMasteryId, CombatMasteryXp, MONSTERS, MONSTER_IDS, POTION_HEAL, POTION_ID, SPELLS, SPELL_IDS, SpellId, armorPoints, attackFor,
  combatMasteryIn, gearEffect, gearNeeds, masteryAccuracy, masteryDamage, masteryDrops, maxHitWith,
} from "../../shared/combat";
import { gearDurability } from "../../shared/crafting";
import { Bounty, bountyReward, slotCounts } from "../../shared/bounties";
import { stackLimit } from "../../shared/bag";
import {
  CHEST_RENT, CHEST_START, CHEST_STEP, GuildBounty, GuildView, RANKS, expandCost, guildBountyName, guildReward, rankFor,
} from "../../shared/guild";
import { MONSTERS as MONSTER_DEFS } from "../../shared/combat";
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

type Panel = "inventory" | "skills" | "quests" | "";
const isSmallScreen = () => matchMedia("(max-width: 640px), (max-height: 500px)").matches;

export function openPanel(panel: Panel) {
  document.body.dataset.panel = panel;
  document.querySelectorAll<HTMLElement>(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === panel));
  if (panel === "quests") renderQuestTab();
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
let lastGear: Gear = emptyGear();
let lastSpell: SpellId = "fire_blast";
let lastCombatMastery: CombatMasteryXp = {};
let flashCombat: CombatMasteryId | undefined;
/** The Monsters list in the Combat discipline is open. */
let monstersOpen = false;
/** Which crafting window is open, and what's picked in it. */
let station: "furnace" | "anvil" | "stove" | null = null;
const pick = {
  bar: "bronze" as Metal, type: "axe" as ToolType, metal: "stone" as Material, wood: "pine" as Wood, fish: "minnow" as FishId, count: 1 as StewCount, fuel: "pine" as Wood,
  /** Anvil: what kind of thing to make. */
  category: "tools" as "tools" | "weapons" | "armor", weapon: "dagger" as WeaponType, armor: "helmet" as ArmorType, armorMetal: "bronze" as Metal,
};
const STATION_SKILL = { furnace: "smelting", anvil: "smithing", stove: "cooking" } as const;
/** The item whose info card is showing. */
type InfoTarget = { kind: "slot"; slot: number } | { kind: "belt"; type: ToolType } | { kind: "gear"; slot: GearSlot };
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
      if (open) {
        // A locked skill shows nothing as available yet (not even its level-1 types, like Bronze).
        sub.appendChild(unlocked ? skillDetails(skill.id)
          : el("mastery m-info", `🔒 Unlocks at ${def.name} level ${skill.unlockLevel}. Until then you can't use any of it.`));
      }
      sub.onclick = (e) => {
        e.stopPropagation(); // don't also fold up the Discipline
        if (expanded.has(skill.id)) expanded.delete(skill.id); else expanded.add(skill.id);
        renderDisciplines(lastDisciplines);
      };
      subs.appendChild(sub);
    }
    if (id === "combat") subs.appendChild(monsterRow());
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
  if (skill === "melee" || skill === "ranged") return weaponDetails(skill, level, box);
  if (skill === "magic") return magicDetails(level, box);
  if (skill === "defense") return defenseDetails(level, box);
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
        `${speedBonusPercent(m)}% faster to gather, ${valueBonusPercent(m)}% more money (base price ${formatMoney(item.sellPrice)}). ${r.xp} XP each` +
        (forageXp(id) !== r.xp ? ` (${forageXp(id)} Foraging XP: fishing is easy on stamina, so it gives Foraging half).` : ".");
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


// ---- Combat in the Skills panel ----

/** A combat Mastery bar (weapon type, spell or monster). */
function combatRow(id: CombatMasteryId, name: string, glyph: string, info: (m: number) => string, title: (m: number) => string) {
  const mXp = lastCombatMastery[id] ?? 0;
  const m = masteryLevelForXp(mXp);
  const mStart = masteryXpForLevel(m), mNext = masteryXpForLevel(m + 1);
  const row = el("m-type" + (flashCombat === id ? " flash" : ""));
  const mBar = el("skill-bar t-bar");
  const mFill = document.createElement("div");
  mFill.style.width = `${Math.floor(((mXp - mStart) / (mNext - mStart)) * 100)}%`;
  mBar.appendChild(mFill);
  row.append(icon("m-type-icon", glyph), el("m-type-name", name), el("m-type-state", `Mastery ${m}`), mBar, el("t-info", info(m)));
  row.title = `${name} Mastery ${m}: ${(mNext - mXp).toLocaleString()} XP to ${m + 1}. ${title(m)}`;
  return row;
}

const lockedRow = (glyph: string, name: string, state: string) => {
  const row = el("m-type locked");
  row.append(icon("m-type-icon", glyph), el("m-type-name", name), el("m-type-state", state));
  return row;
};

/** Melee and Ranged: each weapon type, when it unlocks, and its Mastery. */
function weaponDetails(skill: "melee" | "ranged", level: number, box: HTMLElement) {
  const types = WEAPON_TYPES.filter((t) => WEAPONS[t].style === skill);
  const upcoming = types.find((t) => WEAPONS[t].level > level);
  if (upcoming) box.append(el("m-info", `Next unlock: ${WEAPONS[upcoming].name} at level ${WEAPONS[upcoming].level}`));
  if (!expanded.has(skill)) return box;
  const list = el("m-types");
  if (skill === "melee") {
    list.appendChild(combatRow("fists", "Fists", "👊", (m) => `+${Math.round(masteryAccuracy(m) * 100)}% to hit`, () => "Fighting with nothing in your hand: hits up to 1."));
  }
  for (const t of types) {
    const w = WEAPONS[t];
    if (level < w.level) { list.appendChild(lockedRow(w.icon, w.name, `🔒 Lv ${w.level}`)); continue; }
    list.appendChild(combatRow(t, w.name, w.icon,
      (m) => `+${Math.round(masteryAccuracy(m) * 100)}% to hit · +${Math.round((masteryDamage(m) - 1) * 100)}% damage`,
      () => `Hits up to ${w.maxHit} (stone; better metal adds more), every ${(w.speed * 0.6).toFixed(1)}s${w.range > 1 ? `, from ${w.range} tiles` : ""}.`));
  }
  box.appendChild(list);
  return box;
}

/** Magic: your mana, and each spell with its Mastery. */
function magicDetails(level: number, box: HTMLElement) {
  const upcoming = SPELL_IDS.find((id) => SPELLS[id].level > level);
  box.append(el("m-info", `Mana ${vitals.mana}/${vitals.maxMana} · needs a staff in your hand`));
  if (upcoming) box.append(el("m-info", `Next spell: ${SPELLS[upcoming].name} at level ${SPELLS[upcoming].level}`));
  if (!expanded.has("magic")) return box;
  const list = el("m-types");
  for (const id of SPELL_IDS) {
    const sp = SPELLS[id];
    if (level < sp.level) { list.appendChild(lockedRow(sp.icon, sp.name, `🔒 Lv ${sp.level}`)); continue; }
    list.appendChild(combatRow(id, sp.name, sp.icon, (m) => `${sp.mana} mana · +${Math.round(masteryAccuracy(m) * 100)}% to hit`, () => sp.description));
  }
  box.appendChild(list);
  return box;
}

/** Defense: health, armor, and which metals you can wear. */
function defenseDetails(level: number, box: HTMLElement) {
  box.append(el("m-info", `Health ${vitals.maxHp} · armor ${armorPoints(lastGear)} (monsters hit you ${armorPoints(lastGear)}% less)`));
  if (!expanded.has("defense")) return box;
  const list = el("m-types");
  for (const metal of METAL_IDS) {
    const lv = ARMOR_LEVEL[metal];
    const row = el("m-type" + (level < lv ? " locked" : ""));
    row.append(icon("m-type-icon", "🦺", METALS[metal].tint), el("m-type-name", `${METALS[metal].name} armor`), el("m-type-state", level < lv ? `🔒 Lv ${lv}` : "✓ can wear"));
    list.appendChild(row);
  }
  box.appendChild(list);
  return box;
}

/** Every monster's Mastery: helps you hit it, and makes it drop things more often. */
function monsterRow() {
  const sub = el("subskill");
  const head = el("ss-head");
  head.append(el("ss-icon", "🐾"), el("ss-name", `${monstersOpen ? "▾" : "▸"} Monsters`), el("ss-state", "Mastery"));
  sub.appendChild(head);
  sub.title = "Each monster has its own Mastery: you hit it more often, and it drops things more often.";
  sub.onclick = (e) => { e.stopPropagation(); monstersOpen = !monstersOpen; renderDisciplines(lastDisciplines); };
  if (monstersOpen) {
    const list = el("m-types mastery");
    for (const id of MONSTER_IDS) {
      const d = MONSTERS[id];
      list.appendChild(combatRow(id, `${d.name} (Lv ${d.level})`, d.icon,
        (m) => `+${Math.round(masteryAccuracy(m) * 100)}% to hit · drops ×${masteryDrops(m).toFixed(2)}`,
        () => `${d.hp} health, ${d.maxHit ? `hits up to ${d.maxHit}` : "never fights back"}${d.aggressive ? ", attacks on sight" : ""}.`));
    }
    sub.appendChild(list);
  }
  return sub;
}

export function renderCombatMastery(m: CombatMasteryXp) {
  lastCombatMastery = m;
  renderDisciplines(lastDisciplines);
}

export function flashCombatMastery(id: CombatMasteryId) {
  flashCombat = id;
  renderDisciplines(lastDisciplines);
  flashCombat = undefined;
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

// ---- Messages: the last few in the box, and every one since you logged in when you tap it ----

const MAX_HISTORY = 500;
const history: { at: Date; text: string }[] = [];
const historyList = document.getElementById("history-list")!;

export function showMessage(text: string) {
  const line = document.createElement("div");
  line.textContent = text;
  messagesEl.appendChild(line);
  while (messagesEl.children.length > MAX_MESSAGES) messagesEl.firstChild!.remove();
  history.push({ at: new Date(), text });
  if (history.length > MAX_HISTORY) history.shift();
  if (document.body.classList.contains("history-open")) renderHistory();
}

function renderHistory() {
  // Only jump to the newest message if you were already at the bottom (not while reading back).
  const atBottom = historyList.scrollHeight - historyList.scrollTop - historyList.clientHeight < 30;
  historyList.replaceChildren();
  if (!history.length) historyList.append(el("", "No messages yet."));
  for (const h of history) {
    const row = document.createElement("div");
    const time = document.createElement("span");
    time.className = "h-time";
    time.textContent = h.at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    row.append(time, h.text);
    historyList.appendChild(row);
  }
  if (atBottom || !historyList.dataset.shown) historyList.scrollTop = historyList.scrollHeight;
  historyList.dataset.shown = "1";
}

messagesEl.onclick = () => {
  closeSettings();
  document.body.classList.add("history-open");
  delete historyList.dataset.shown;
  renderHistory();
};
document.getElementById("history-close")!.onclick = () => document.body.classList.remove("history-open");

// Clicking an item drops it, or sells it while the Merchant's shop is open.
// In lock mode (the 🔒 button on the inventory), clicking an item locks or
// unlocks just that one item instead.
let invItems: (ItemId | null)[] = [];
let locked: boolean[] = []; // per inventory slot
let durability: (number | null)[] = []; // per inventory slot: uses left on tools
let counts: number[] = []; // per inventory slot: how many are in the stack
/** How many are in this bag slot (0 if empty). */
const countAt = (i: number) => (invItems[i] ? Math.max(1, counts[i] ?? 1) : 0);
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
let onWear: (slot: number) => void = () => {};
let onRemove: (slot: GearSlot) => void = () => {};
let onDrink: (slot: number) => void = () => {};
let onSpell: (id: SpellId) => void = () => {};
let onSort: () => void = () => {};
let onMove: (from: number, to: number) => void = () => {};

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
  wear: (slot: number) => void;
  remove: (slot: GearSlot) => void;
  drink: (slot: number) => void;
  spell: (id: SpellId) => void;
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

/** How many are in each bag slot. The server sends this just before the inventory, which redraws the bag. */
export function renderCounts(slots: number[]) {
  counts = slots;
}

/** A small number in the corner of a slot holding more than one. */
function countBadge(n: number) {
  const b = document.createElement("span");
  b.className = "count-badge";
  b.textContent = String(n);
  return b;
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

// ---- Gear strip: weapon and armor, under the tool belt. With a staff, your spells show under it. ----

const gearEl = document.getElementById("gear")!;
const spellsEl = document.getElementById("spells")!;

export function renderGear(gear: Gear, spell: SpellId) {
  lastGear = gear;
  lastSpell = spell;
  renderInfo();
  gearEl.replaceChildren();
  for (const slot of GEAR_SLOTS) {
    const on = gear[slot];
    const box = el("slot belt-slot" + (on ? " filled" : ""));
    if (on) {
      const item = ITEMS[on.item];
      box.append(icon("", item.icon, item.tint), durabilityBar(on.durability, gearDurability(on.item)));
      box.title = `${item.name}: ${gearEffect(on.item)}. ${on.durability} uses left. Click for details.`;
      box.onclick = () => showInfo({ kind: "gear", slot });
    } else {
      box.appendChild(icon("empty-tool", SLOT_ICONS[slot]));
      box.title = slot === "weapon" ? "Weapon: nothing in your hand, so you punch (hits up to 1). Click a weapon in your bag to hold it."
        : `${SLOT_NAMES[slot]}: empty. Click armor in your bag to wear it.`;
    }
    gearEl.appendChild(box);
  }
  // Spells: only when holding a staff.
  spellsEl.replaceChildren();
  const holdingStaff = isWeapon(gear.weapon?.item) && WEAPONS[parseWeapon(gear.weapon!.item as `${WeaponType}_stone_pine`).type].style === "magic";
  spellsEl.style.display = holdingStaff ? "" : "none";
  if (holdingStaff) {
    const magic = levelForXp(lastSkillXp.magic ?? 0);
    for (const id of SPELL_IDS) {
      const sp = SPELLS[id];
      const b = document.createElement("button");
      const locked = magic < sp.level;
      b.className = "pick spell" + (id === spell ? " active" : "") + (locked ? " locked" : "");
      b.append(icon("pick-icon", sp.icon), el("pick-name", locked ? `🔒${sp.level}` : `${sp.mana} mana`));
      b.title = locked ? `${sp.name}: needs Magic level ${sp.level}` : `${sp.name} (${sp.mana} mana): ${sp.description}`;
      b.onclick = () => onSpell(id);
      spellsEl.appendChild(b);
    }
  }
  renderDisciplines(lastDisciplines);
}
renderGear(lastGear, lastSpell);

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
    const id = invItems[drag.from];
    if (!id) return cancelDrag();
    drag.ghost = icon("", ITEMS[id].icon, ITEMS[id].tint);
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

const shopIsOpen = () => document.body.classList.contains("shop-open");

export function renderInventory(items: (ItemId | null)[]) {
  invItems = items;
  slotsEl.replaceChildren();
  const used = items.filter(Boolean).length; // slots in use (each stack takes one)
  bagCountEl.textContent = used ? String(used) : "";
  const selling = shopIsOpen();
  for (let i = 0; i < INVENTORY_SIZE; i++) {
    const slot = document.createElement("div");
    slot.className = "slot" + (drag?.ghost && drag.from === i ? " drag-from" : "");
    slot.dataset.slot = String(i);
    const id = items[i];
    if (id) {
      const item = ITEMS[id];
      slot.classList.add("filled");
      slot.appendChild(icon("item-icon", item.icon, item.tint));
      if (isTool(id)) slot.appendChild(durabilityBar(durability[i] ?? maxDurability(id), maxDurability(id)));
      if (isGear(id)) slot.appendChild(durabilityBar(durability[i] ?? gearDurability(id), gearDurability(id)));
      const n = countAt(i);
      if (n > 1) slot.appendChild(countBadge(n));
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
      const many = n > 1 ? `${n} ${item.name.toLowerCase()}` : item.single;
      slot.title = lockMode ? `${isLocked ? "Unlock" : "Lock"} ${n > 1 ? "these" : "this"} ${many}`
        : isLocked ? `${n > 1 ? `${n} × ` : ""}${item.name} (locked)`
        : chestIsOpen() ? `Put ${many} in your chest`
        : selling ? `Sell ${many} for ${formatMoney(price * n)}`
        : `${n > 1 ? `${n} × ` : ""}${item.name} (stacks to ${stackLimit(id)}): click for details, or drag to move it`;
      slot.onpointerdown = (e) => startDrag(e, i);
      slot.onclick = () => {
        if (justDragged) return;
        if (lockMode) return toggleLock(i);
        if (chestIsOpen()) return onDeposit(i);
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
  renderBounties();
  renderGuild();
  renderCraft();
  renderInfo();
  renderTracker();
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
  closeBounties();
  closeGuild();
  closeChest();
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
  shopBody.append(el("", "Tap an item in your bag to sell it (a stack sells all at once). To keep one, tap 🔒 on your bag, then tap the item."));
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
  const unlockedSlots = invItems.flatMap((id, i) => (id && !locked[i] ? [i] : []));
  const total = unlockedSlots.reduce((sum, i) => sum + sellPriceFor(invItems[i]!, lastMastery, durability[i]) * countAt(i), 0);
  const unlockedCount = unlockedSlots.reduce((sum, i) => sum + countAt(i), 0);
  const lockedCount = invItems.reduce((sum, id, i) => sum + (id && locked[i] ? countAt(i) : 0), 0);
  shopBody.append(prices, el("", !invItems.some(Boolean) ? "You have nothing to sell. Go chop or fish!"
    : `Sell all gives you ${formatMoney(total)}` + (lockedCount ? ` (keeps ${lockedCount} locked).` : ".")));

  sellAllBtn.disabled = !unlockedCount;
  if (!unlockedCount) resetSellAll();
  sellAllBtn.textContent = sellAllArmed ? `Sell ${unlockedCount} for ${formatMoney(total)}?` : "Sell all";
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
  closeBounties();
  closeGuild();
  closeChest();
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
const haveUnlocked = (item: ItemId) => invItems.reduce((sum, id, i) => sum + (id === item && !locked[i] ? countAt(i) : 0), 0);

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
    craftBody.append(el("craft-warn", `${skillDef.name} unlocks at ${DISCIPLINES[discipline].name} level ${skillDef.unlockLevel} (you're level ${disciplineLevel}). Old Maren will tell you how to get there.`));
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
    const CATS = { tools: { icon: "🪓", name: "Tools" }, weapons: { icon: "🗡️", name: "Weapons" }, armor: { icon: "🛡️", name: "Armor" } };
    craftBody.append(choices("Make", ["tools", "weapons", "armor"] as const as unknown as ("tools" | "weapons" | "armor")[], pick.category, (c) => CATS[c], (c) => { pick.category = c; }));
    const head = () => choices("Head", MATERIAL_IDS, pick.metal, (m) => ({ icon: m === "stone" ? "🪨" : "🧈", tint: MATERIALS[m].tint, name: MATERIALS[m].name, lockedAt: lockedAt(m) }), (m) => { pick.metal = m; });
    const handle = () => choices("Handle", WOOD_IDS, pick.wood, (w) => ({ icon: "🪵", tint: ITEMS[`${w}_logs`].tint, name: WOODS[w].name }), (w) => { pick.wood = w; });
    if (pick.category === "weapons") {
      craftBody.append(choices("Weapon", WEAPON_TYPES, pick.weapon, (t) => ({ icon: WEAPONS[t].icon, name: WEAPONS[t].name }), (t) => { pick.weapon = t; }), head(), handle());
      output = weaponId(pick.weapon, pick.metal, pick.wood);
    } else if (pick.category === "armor") {
      craftBody.append(
        choices("Armor", ARMOR_TYPES, pick.armor, (t) => ({ icon: ARMOR[t].icon, name: `${ARMOR[t].name} (${ARMOR[t].bars})` }), (t) => { pick.armor = t; }),
        choices("Metal", METAL_IDS, pick.armorMetal, (m) => ({ icon: "🧈", tint: METALS[m].tint, name: METALS[m].name, lockedAt: lockedAt(m) }), (m) => { pick.armorMetal = m; }),
      );
      output = armorId(pick.armor, pick.armorMetal);
    } else {
      craftBody.append(choices("Tool", TOOL_TYPE_IDS, pick.type, (t) => ({ icon: TOOL_TYPES[t].icon, name: TOOL_TYPES[t].name }), (t) => { pick.type = t; }));
      if (isWoodTool(pick.type)) {
        // Fishing rods are all wood: pick which logs to carve it from.
        craftBody.append(choices(`Wood (${ROD_LOGS} logs)`, WOOD_IDS, pick.wood, (w) => ({ icon: "🪵", tint: ITEMS[`${w}_logs`].tint, name: WOODS[w].name,
          lockedAt: level < RESOURCES[w].level ? RESOURCES[w].level : undefined }), (w) => { pick.wood = w; }));
      } else {
        craftBody.append(head());
        if (hasHandle(pick.type)) craftBody.append(handle());
      }
      output = toolId(pick.type, pick.metal, pick.wood);
    }
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
  if (isGear(output)) {
    const needs = gearNeeds(output)!;
    facts.unshift(`${gearEffect(output)}, ${gearDurability(output)} uses, to use: ${findSkill(needs.skill).def.name} ${needs.level}`);
  }
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

// ---- Bounty board: 5 jobs, hand in the full amount for double the Merchant's price plus XP ----

const bountyList = document.getElementById("bounty-list")!;
let bounties: Bounty[] = [];
let onHandIn: (index: number) => void = () => {};
let onRefreshBounties: () => void = () => {};
const bountyIsOpen = () => document.body.classList.contains("bounty-open");

export function setBountyActions(actions: { handIn: (index: number) => void; refresh: () => void }) {
  onHandIn = actions.handIn;
  onRefreshBounties = actions.refresh;
}

/** The server sent the board's bounties. `open`: the player just clicked the board. */
export function showBounties(list: Bounty[], open: boolean) {
  bounties = list;
  renderTracker();
  if (open) {
    closeShop();
    closeCraft();
    closeGuild();
    closeChest();
    closeInfo();
    closeDialog();
    document.body.classList.add("bounty-open");
    if (!isSmallScreen()) openPanel("inventory"); // see what you're carrying (on phones it would cover the board)
  }
  renderBounties();
}

export function closeBounties() {
  document.body.classList.remove("bounty-open");
}

function renderBounties() {
  if (!bountyIsOpen()) return;
  bountyList.replaceChildren();
  if (!bounties.length) bountyList.append(el("bounty-note", "No one needs anything right now. Try Refresh."));
  bounties.forEach((b, index) => {
    const item = ITEMS[b.item];
    const have = invItems.reduce((sum, id, i) => sum + (slotCounts(b.item, id, !!locked[i], durability[i]) ? countAt(i) : 0), 0);
    const ready = have >= b.count;
    const reward = bountyReward(b, lastMastery);
    const row = el("bounty-row" + (ready ? " ready" : ""));
    const btn = document.createElement("button");
    btn.className = "shop-btn";
    btn.textContent = "Hand in";
    btn.disabled = !ready;
    btn.title = ready ? `Hand in ${b.count} ${item.name.toLowerCase()}` : `You need ${b.count - have} more`;
    btn.onclick = () => onHandIn(index);
    const unused = isTool(b.item) || isGear(b.item) ? " (unused)" : "";
    row.append(icon("bounty-icon", item.icon, item.tint), el("bounty-what", `${b.count} × ${item.name}${unused}`), btn,
      el("bounty-have", `You have ${Math.min(have, b.count)} / ${b.count}`),
      el("bounty-reward", `Reward: ${formatMoney(reward.coins)} · +${reward.xp} ${reward.label} XP`));
    bountyList.appendChild(row);
  });
}

document.getElementById("bounty-refresh")!.onclick = () => onRefreshBounties();
document.getElementById("bounty-close")!.onclick = closeBounties;

// ---- The Mages' Guild: rank, renting the enchanted chest, and magic bounties (rules in shared/guild.ts) ----

const guildBody = document.getElementById("guild-body")!;
let guild: GuildView | null = null;
let onBuySpace: () => void = () => {};
let onDeposit: (slot: number) => void = () => {};
let onWithdraw: (slot: number) => void = () => {};
let onGuildHandIn: (index: number) => void = () => {};
let onRefreshGuild: () => void = () => {};
const guildIsOpen = () => document.body.classList.contains("guild-open");
const chestIsOpen = () => document.body.classList.contains("chest-open");

export function setGuildActions(actions: {
  buySpace: () => void; deposit: (slot: number) => void; withdraw: (slot: number) => void;
  handIn: (index: number) => void; refresh: () => void;
}) {
  onBuySpace = actions.buySpace;
  onDeposit = actions.deposit;
  onWithdraw = actions.withdraw;
  onGuildHandIn = actions.handIn;
  onRefreshGuild = actions.refresh;
}

/** The server sent the guild's state. `open`: the player just clicked the Archmage or the guild board. */
export function showGuild(g: GuildView, open: boolean) {
  guild = g;
  if (open) {
    closeShop();
    closeCraft();
    closeBounties();
    closeChest();
    closeInfo();
    closeDialog();
    document.body.classList.add("guild-open");
    if (!isSmallScreen()) openPanel("inventory");
  }
  renderGuild();
}

export function closeGuild() {
  document.body.classList.remove("guild-open");
}

function renderGuild() {
  if (!guildIsOpen() || !guild) return;
  const g = guild;
  guildBody.replaceChildren();

  // Rank: points and what the next rank needs.
  const rank = rankFor(g.points);
  const next = RANKS[rank + 1];
  const rankBox = el("guild-rank");
  rankBox.append(el("guild-rank-name", `Rank: ${RANKS[rank].name}`),
    el("bounty-note", next ? `${g.points} guild points · ${next.name} at ${next.points}` : `${g.points} guild points · the highest rank`));
  if (next) {
    const bar = el("q-bar");
    const fill = document.createElement("div");
    const from = RANKS[rank].points;
    fill.style.width = `${Math.floor(((g.points - from) / (next.points - from)) * 100)}%`;
    bar.appendChild(fill);
    rankBox.appendChild(bar);
  }
  guildBody.appendChild(rankBox);

  // The chest: rent it, or buy more space (as much as your rank allows).
  const chestBox = el("guild-section");
  chestBox.append(el("guild-head", "📦 Enchanted chest"));
  const size = g.chestSize;
  const cost = size ? expandCost(size) : CHEST_RENT;
  const nextSize = size ? size + CHEST_STEP : CHEST_START;
  const btn = document.createElement("button");
  btn.className = "shop-btn";
  if (!size) {
    chestBox.append(el("bounty-note", `Rent ${CHEST_START} spaces for ${formatMoney(CHEST_RENT)}. Each space holds a whole stack. Open it from any enchanted chest: here, on the east island, or in the Dark Forest.`));
    btn.textContent = `Rent (${formatMoney(CHEST_RENT)})`;
  } else {
    chestBox.append(el("bounty-note", `You have ${size} spaces.` + (cost == null ? " That's as big as they get." : "")));
    btn.textContent = cost == null ? "Full size" : `+${CHEST_STEP} spaces (${formatMoney(cost)})`;
  }
  const allowed = RANKS[rank].maxChest;
  if (cost != null && nextSize > allowed) {
    const need = RANKS.find((r) => r.maxChest >= nextSize)!;
    chestBox.append(el("craft-warn", `${/^[AEIOU]/.test(RANKS[rank].name) ? "An" : "A"} ${RANKS[rank].name} may rent up to ${allowed} spaces. Reach ${need.name} for more.`));
    btn.disabled = true;
  } else if (cost != null && coins < cost) {
    chestBox.append(el("craft-warn", `You have ${formatMoney(coins)}.`));
    btn.disabled = true;
  }
  if (cost == null) btn.disabled = true;
  btn.onclick = () => onBuySpace();
  chestBox.appendChild(btn);
  guildBody.appendChild(chestBox);

  // Magic bounties.
  const list = el("guild-section");
  list.append(el("guild-head", "📜 Guild bounties"),
    el("bounty-note", "Defeat monsters with spells (hold a staff), or bring things the guild enchants with. Each one earns guild points."));
  g.bounties.forEach((b, index) => list.appendChild(guildBountyRow(b, index)));
  guildBody.appendChild(list);
}

function guildBountyRow(b: GuildBounty, index: number) {
  const reward = guildReward(b);
  const icon_ = b.kind === "slay" ? MONSTER_DEFS[b.monster].icon : ITEMS[b.item].icon;
  const tint = b.kind === "reagent" ? ITEMS[b.item].tint : undefined;
  let done: number;
  let ready = false;
  const row = el("bounty-row");
  const btn = document.createElement("button");
  btn.className = "shop-btn";
  if (b.kind === "slay") {
    done = b.progress;
    btn.textContent = "🔮";
    btn.disabled = true;
    btn.title = "Counts up by itself each time you defeat one with a spell.";
  } else {
    done = invItems.reduce((sum, id, i) => sum + (id === b.item && !locked[i] ? countAt(i) : 0), 0);
    ready = done >= b.count;
    btn.textContent = "Hand in";
    btn.disabled = !ready;
    btn.onclick = () => onGuildHandIn(index);
  }
  if (ready) row.classList.add("ready");
  row.append(icon("bounty-icon", icon_, tint), el("bounty-what", guildBountyName(b)), btn,
    el("bounty-have", `${b.kind === "slay" ? "Done" : "You have"} ${Math.min(done, b.count)} / ${b.count}`),
    el("bounty-reward", `Reward: +${reward.points} guild point${reward.points === 1 ? "" : "s"} · ${formatMoney(reward.coins)} · +${reward.magicXp} Magic XP`));
  return row;
}

document.getElementById("guild-refresh")!.onclick = () => onRefreshGuild();
document.getElementById("guild-close")!.onclick = closeGuild;

// ---- Enchanted chest window: tap a stack in your bag to put it in, tap one here to take it out ----

const chestSlotsEl = document.getElementById("chest-slots")!;
const chestTitle = document.getElementById("chest-title")!;
let chest: { items: (ItemId | null)[]; counts: number[]; durability: (number | null)[] } = { items: [], counts: [], durability: [] };

export function showChest(c: typeof chest, open: boolean) {
  chest = c;
  if (open) {
    closeShop();
    closeCraft();
    closeBounties();
    closeGuild();
    closeInfo();
    closeDialog();
    document.body.classList.add("chest-open");
    openPanel("inventory"); // so you can tap your items, on phones too
    renderInventory(invItems);
  }
  renderChest();
}

export function closeChest() {
  if (!chestIsOpen()) return;
  document.body.classList.remove("chest-open");
  renderInventory(invItems);
}

function renderChest() {
  if (!chestIsOpen()) return;
  const used = chest.items.filter(Boolean).length;
  chestTitle.textContent = `📦 Enchanted chest (${used}/${chest.items.length})`;
  chestSlotsEl.replaceChildren();
  chest.items.forEach((id, i) => {
    const slot = document.createElement("div");
    slot.className = "slot";
    if (id) {
      const item = ITEMS[id];
      const n = Math.max(1, chest.counts[i] ?? 1);
      slot.classList.add("filled");
      slot.appendChild(icon("item-icon", item.icon, item.tint));
      if (isTool(id)) slot.appendChild(durabilityBar(chest.durability[i] ?? maxDurability(id), maxDurability(id)));
      if (isGear(id)) slot.appendChild(durabilityBar(chest.durability[i] ?? gearDurability(id), gearDurability(id)));
      if (n > 1) slot.appendChild(countBadge(n));
      slot.title = `Take out ${n > 1 ? `${n} ${item.name.toLowerCase()}` : item.single}`;
      slot.onclick = () => onWithdraw(i);
    }
    chestSlotsEl.appendChild(slot);
  });
}

document.getElementById("chest-close")!.onclick = closeChest;

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
  } else if (target.kind === "belt") {
    const t = lastBelt[target.type];
    id = t?.item ?? null;
    uses = t?.durability ?? null;
  } else {
    const g = lastGear[target.slot];
    id = g?.item ?? null;
    uses = g?.durability ?? null;
  }
  if (!id) return closeInfo();
  const item = ITEMS[id];
  const isLocked = target.kind === "slot" && !!locked[target.slot];
  infoBody.replaceChildren();
  infoButtons.replaceChildren();
  const head = el("craft-head");
  head.append(icon("craft-icon", item.icon, item.tint), el("craft-name", item.name + (isLocked ? " 🔒" : "")));
  infoBody.appendChild(head);
  const stack = target.kind === "slot" ? countAt(target.slot) : 1;
  if (stackLimit(id) > 1) infoBody.append(infoLine("In this stack", `${stack} of ${stackLimit(id)}`, "a full stack takes one bag slot"));

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

  // Weapons and armor: what they do, what you need, and how long they last.
  if (isGear(id)) {
    const max = gearDurability(id);
    const left = uses ?? max;
    const needs = gearNeeds(id)!;
    const have = levelForXp(lastSkillXp[needs.skill] ?? 0);
    infoBody.append(infoLine(isWeapon(id) ? "Weapon" : "Armor", gearEffect(id)));
    if (isWeapon(id)) {
      const a = attackFor({ ...emptyGear(), weapon: { item: id, durability: 1 } }, lastSpell);
      const m = combatMasteryIn(lastCombatMastery, a.mastery);
      if (a.maxHit) infoBody.append(infoLine("Your best hit", String(maxHitWith(a, m)), `${a.name} Mastery ${m}`));
    }
    infoBody.append(infoLine("Needs", `${findSkill(needs.skill).def.name} level ${needs.level}`, have < needs.level ? `you're level ${have}` : ""));
    const bar = durabilityBar(left, max);
    const row = infoLine("Uses left", `${left} of ${max}`, isWeapon(id) ? "each attack wears it down" : "each attack on you wears down one piece");
    row.appendChild(bar);
    infoBody.append(row);
  }
  if (id === POTION_ID) infoBody.append(infoLine("Health", `+${POTION_HEAL}`, `you have ${vitals.hp}/${vitals.maxHp}`));

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
  } else if (target.kind === "gear") {
    infoButton("Take off", () => { onRemove(target.slot); closeInfo(); });
  } else {
    const slot = target.slot;
    if (isTool(id)) infoButton("Put on belt", () => { onEquip(slot); closeInfo(); });
    if (isGear(id)) infoButton(isWeapon(id) ? "Hold" : "Wear", () => { onWear(slot); closeInfo(); });
    if (id === POTION_ID) infoButton(`Drink (+${POTION_HEAL})`, () => { onDrink(slot); closeInfo(); });
    if (isFood(id)) infoButton(`Eat (+${foodStamina(id, lastMastery)})`, () => { onEat(slot); closeInfo(); }, staminaNow >= MAX_STAMINA);
    infoButton(isLocked ? "Unlock" : "Lock", () => onLock(slot, !isLocked));
    infoButton(stack > 1 ? `Drop all ${stack}` : "Drop", () => { onDrop(slot); closeInfo(); }, isLocked);
  }
  infoButton("Close", closeInfo);
}

// ---- Stamina bar (top left, always showing) ----

// ---- Health, stamina and mana bars (top left, always showing) ----

const staminaEl = document.getElementById("stamina")!;
let staminaNow = MAX_STAMINA;
let staminaMax = MAX_STAMINA;
const vitals = { hp: 50, maxHp: 50, mana: 50, maxMana: 50 };

function vitalRow(label: string, now: number, max: number, color: string, title: string) {
  const row = el("vital");
  row.title = title;
  const bar = el("stamina-bar");
  const fill = document.createElement("div");
  fill.style.width = `${Math.floor((now / max) * 100)}%`;
  fill.style.background = color;
  bar.appendChild(fill);
  row.append(el("stamina-label", `${label} ${now}/${max}`), bar);
  return row;
}

function renderVitalBars() {
  staminaEl.replaceChildren();
  const c = STAMINA_COST;
  const hpLow = vitals.hp <= vitals.maxHp / 4;
  staminaEl.append(
    vitalRow("❤", vitals.hp, vitals.maxHp, hpLow ? "#ff3b30" : "#d6443a",
      `Health ${vitals.hp} of ${vitals.maxHp}. Monsters take it away. Drink a health potion to get it back (it also comes back 1 a minute). At 0 you wake up next to Old Maren.`),
    vitalRow("⚡", staminaNow, staminaMax, staminaNow < 10 ? "#e74c3c" : staminaNow < 30 ? "#f1c40f" : "#f5c542",
      `Stamina ${staminaNow} of ${staminaMax}. Chopping costs ${c.woodcutting}, mining ${c.mining}, smelting ${c.smelting}, smithing ${c.smithing}, cooking ${c.cooking}, fishing ${c.fishing}, each weapon attack ${c.melee}. ` +
      "It comes back 1 every 30 seconds. Eat fish or stew (click it in your bag) for more."),
    vitalRow("🔮", vitals.mana, vitals.maxMana, "#4a7bd9", `Mana ${vitals.mana} of ${vitals.maxMana}. Spells use it. It comes back 1 every 6 seconds.`),
  );
  staminaEl.classList.toggle("hurt", hpLow);
}

export function renderStamina(stamina: number, max: number) {
  staminaNow = stamina;
  staminaMax = max;
  renderVitalBars();
  renderInfo(); // the Eat button turns off when you're full
}

export function renderVitals(hp: number, maxHp: number, mana: number, maxMana: number) {
  Object.assign(vitals, { hp, maxHp, mana, maxMana });
  renderVitalBars();
  renderInfo();
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

// ---- Old Maren: the quest tracker and her dialog ----

// ---- The quest tracker (next to your health) and the 📜 Quests tab ----
// The tracker shows one thing: Maren's current step, or a bounty you picked in the Quests tab.

const questEl = document.getElementById("quest")!;
const questListEl = document.getElementById("quest-list")!;
let lastQuest: QuestView | null = null;
/** The tracked bounty's item, or null for Maren's quest. */
let trackedItem: ItemId | null = null;
let onTrack: (bounty: number | null) => void = () => {};

export function setQuestActions(actions: { track: (bounty: number | null) => void }) {
  onTrack = actions.track;
}

questEl.onclick = () => openPanel(document.body.dataset.panel === "quests" ? "" : "quests");

/** How many of a bounty's items you have that count (unlocked, unused). */
const bountyHave = (b: Bounty) => invItems.reduce((sum, id, i) => sum + (slotCounts(b.item, id, !!locked[i], durability[i]) ? countAt(i) : 0), 0);
const trackedBounty = () => bounties.find((b) => b.item === trackedItem) ?? null;

export function renderTracked(item: ItemId | null) {
  trackedItem = item;
  renderTracker();
}

export function renderQuest(q: QuestView, flash = false) {
  lastQuest = q;
  renderTracker(flash);
}

function bar(fraction: number) {
  const b = el("q-bar");
  const fill = document.createElement("div");
  fill.style.width = `${Math.floor(Math.min(1, fraction) * 100)}%`;
  b.appendChild(fill);
  return b;
}

function renderTracker(flash = false) {
  if (document.body.dataset.panel === "quests") renderQuestTab();
  const b = trackedBounty();
  const q = lastQuest;
  if (!b && !q) return;
  document.body.classList.add("has-quest");
  questEl.replaceChildren();
  if (b) {
    const have = bountyHave(b);
    const item = ITEMS[b.item];
    questEl.append(el("q-title", "📋 Bounty"), el("q-task", `${b.count} × ${item.name}${isTool(b.item) || isGear(b.item) ? " (unused)" : ""}`),
      el("q-progress", have >= b.count ? `✓ ${b.count} / ${b.count}: hand it in at the board!` : `${have} / ${b.count}`), bar(have / b.count));
  } else if (q) {
    questEl.append(el("q-title", q.done ? `📜 ${q.quest}` : `📜 Quest ${q.number}/${q.of}: ${q.quest}`), el("q-task", (q.talk ? "❗ " : "") + q.task));
    if (q.warning) questEl.append(el("q-warn", `⚠️ ${q.warning}`));
    if (q.progress) questEl.append(el("q-progress", q.progress));
    if (q.fraction != null) questEl.append(bar(q.fraction));
  }
  if (bounties.length) questEl.append(el("q-switch", "Tap to switch quest or bounty"));
  if (flash) {
    questEl.classList.remove("flash");
    void questEl.offsetWidth; // restart the animation
    questEl.classList.add("flash");
  }
}

/** The 📜 tab: Maren's quest, then each bounty on the board. Tap one to track it. */
function renderQuestTab() {
  questListEl.replaceChildren();
  const row = (glyph: string, tint: string | undefined, title: string, sub: string, state: string, tracked: boolean, onclick: () => void) => {
    const r = el("qt-row" + (tracked ? " tracked" : ""));
    r.append(icon("qt-icon", glyph, tint), el("qt-title", title), el("qt-sub", sub), el("qt-state", tracked ? "📍 Tracking" : state));
    r.title = tracked ? "Showing next to your health" : "Tap to track this";
    r.onclick = onclick;
    return r;
  };
  const tb = trackedBounty();
  questListEl.append(el("qt-head", `${GUIDE_NAME}'s lessons`));
  if (lastQuest) {
    const q = lastQuest;
    questListEl.append(row("📜", undefined, q.done ? q.quest : `Quest ${q.number}/${q.of}: ${q.quest}`, q.task, q.progress ?? (q.done ? "" : "Tap to track"), !tb, () => onTrack(null)));
  }
  questListEl.append(el("qt-head", "📋 Bounties"));
  if (!bounties.length) {
    questListEl.append(el("qt-note", `The bounty board next to the Merchant opens later in ${GUIDE_NAME}'s lessons.`));
    return;
  }
  bounties.forEach((b, i) => {
    const item = ITEMS[b.item];
    const have = bountyHave(b);
    const reward = bountyReward(b, lastMastery);
    questListEl.append(row(item.icon, item.tint, `${b.count} × ${item.name}`, `${formatMoney(reward.coins)} · +${reward.xp} ${reward.label} XP`,
      have >= b.count ? "✓ Ready to hand in" : `You have ${have} / ${b.count}`, tb === b, () => onTrack(i)));
  });
  questListEl.append(el("qt-note", "Hand bounties in at the board next to the Merchant."));
}

const dialogName = document.getElementById("dialog-name")!;
const dialogText = document.getElementById("dialog-text")!;
const dialogPage = document.getElementById("dialog-page")!;
const dialogNext = document.getElementById("dialog-next") as HTMLButtonElement;
let dialogLines: string[] = [];
let dialogAt = 0;

/** Show what someone says, one paragraph at a time (Next, then OK). */
export function openDialog(name: string, lines: string[]) {
  if (!lines.length) return;
  closeShop();
  closeBounties();
  closeCraft();
  closeGuild();
  closeChest();
  closeInfo();
  dialogLines = lines;
  dialogAt = 0;
  dialogName.textContent = name;
  document.body.classList.add("dialog-open");
  renderDialog();
}

function renderDialog() {
  dialogText.textContent = dialogLines[dialogAt];
  dialogPage.textContent = dialogLines.length > 1 ? `${dialogAt + 1} / ${dialogLines.length}` : "";
  dialogNext.textContent = dialogAt < dialogLines.length - 1 ? "Next ▸" : "OK";
}

dialogNext.onclick = () => {
  if (dialogAt < dialogLines.length - 1) { dialogAt++; renderDialog(); } else closeDialog();
};

export function closeDialog() {
  document.body.classList.remove("dialog-open");
}

// ---- ⚙️ Settings: change your name, password or colour, or sign out ----

const settingsEl = document.getElementById("settings")!;
const nameForm = document.getElementById("set-name-form") as HTMLFormElement;
const nameInput = document.getElementById("set-name") as HTMLInputElement;
const nameMsg = document.getElementById("set-name-msg")!;
const pwForm = document.getElementById("set-pw-form") as HTMLFormElement;
const pwCurrent = document.getElementById("set-pw-current") as HTMLInputElement;
const pwNew = document.getElementById("set-pw-new") as HTMLInputElement;
const pwMsg = document.getElementById("set-pw-msg")!;
const colorsEl = document.getElementById("set-colors")!;
let myName = "";
let myColor = 0;
let pendingAccount: "name" | "password" | null = null;
let account = {
  rename: (_name: string) => {},
  password: (_current: string, _next: string) => {},
  color: (_color: number) => {},
  signOut: () => {},
};

export function setAccountActions(actions: typeof account) {
  account = actions;
}

/** Your own name and colour, as the server has them. */
export function renderMe(name: string, color: number) {
  myName = name;
  myColor = color;
  if (settingsEl.contains(document.activeElement) && document.activeElement === nameInput) return;
  if (document.body.classList.contains("settings-open")) renderSettings();
}

function setMsg(box: HTMLElement, ok: boolean, text: string) {
  box.textContent = text;
  box.className = "set-msg " + (ok ? "ok" : "bad");
}

function renderSettings() {
  colorsEl.replaceChildren();
  for (const c of PLAYER_COLORS) {
    const b = document.createElement("button");
    b.className = "swatch" + (c.color === myColor ? " active" : "");
    b.style.background = `#${c.color.toString(16).padStart(6, "0")}`;
    b.title = c.name;
    b.setAttribute("aria-label", c.name);
    b.onclick = () => account.color(c.color);
    colorsEl.appendChild(b);
  }
}

export function openSettings() {
  document.body.classList.remove("history-open");
  document.body.classList.add("settings-open");
  nameInput.value = myName;
  nameMsg.textContent = "";
  pwMsg.textContent = "";
  pwCurrent.value = pwNew.value = "";
  renderSettings();
}

export function closeSettings() {
  document.body.classList.remove("settings-open");
}

/** The server answered a name or password change. */
export function accountResult(ok: boolean, text: string, name: string) {
  const box = pendingAccount === "password" ? pwMsg : nameMsg;
  pendingAccount = null;
  setMsg(box, ok, text);
  if (box === pwMsg && ok) pwCurrent.value = pwNew.value = "";
  if (box === nameMsg) nameInput.value = name;
  if (ok && name) {
    myName = name;
    try { localStorage.setItem("rpg.lastUsername", name); } catch { /* storage blocked */ }
  }
}

nameForm.onsubmit = (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name || name === myName) return setMsg(nameMsg, false, name ? "That's already your name." : "Type a new name first.");
  pendingAccount = "name";
  setMsg(nameMsg, true, "Saving…");
  account.rename(name);
};

pwForm.onsubmit = (e) => {
  e.preventDefault();
  if (!pwCurrent.value) return setMsg(pwMsg, false, "Type your current password first.");
  if (pwNew.value.length < 6) return setMsg(pwMsg, false, "New passwords need at least 6 characters.");
  pendingAccount = "password";
  setMsg(pwMsg, true, "Changing…");
  account.password(pwCurrent.value, pwNew.value);
};

document.getElementById("settings-btn")!.onclick = () => (document.body.classList.contains("settings-open") ? closeSettings() : openSettings());
document.getElementById("settings-close")!.onclick = closeSettings;
document.getElementById("sign-out")!.onclick = () => { closeSettings(); account.signOut(); };

/** After signing out: forget the last character's messages, bounties and tracker. */
export function resetForSignOut() {
  closeSettings();
  closeShop();
  closeBounties();
  closeCraft();
  closeGuild();
  closeChest();
  closeInfo();
  closeDialog();
  document.body.classList.remove("history-open", "has-quest");
  messagesEl.replaceChildren();
  history.length = 0;
  bounties = [];
  trackedItem = null;
  lastQuest = null;
  if (lockMode) setLockMode(false);
}
