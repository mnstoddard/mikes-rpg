// The 📊 Skills panel: Disciplines, the skills inside them, and every Mastery bar.
// (Part of the game's windows: client/src/ui.ts loads every file in client/src/ui/.)
import { DisciplineView, newDisciplineView, SkillXp, emptySkills, SkillId, DisciplineId, DISCIPLINE_IDS, DISCIPLINES, isUnlocked, levelForXp, MAX_LEVEL, xpForLevel, isCraftSkill, findSkill, CraftSkill } from "../../../shared/disciplines";
import { ItemMasteryXp, MasteryId, masteryLevelForXp, masteryXpForLevel, valueBonusPercent, craftSuccess, percent, masterySuccess, speedBonusPercent } from "../../../shared/mastery";
import { CombatMasteryXp, CombatMasteryId, huntingDrops, masteryAccuracy, masteryDamage, SPELL_IDS, SPELLS, isBoltSpell, combatMasteryIn, armorPoints, ARMOR_LEVEL, MONSTER_IDS, MONSTERS, masteryDrops } from "../../../shared/combat";
import { setTreeData, treeButton } from "../tree";
import { resourcesFor, RESOURCES, gatherSpeed, forageXp, FORAGE_FINDS } from "../../../shared/foraging";
import { masteryName, beltBonus, SMITH_ORDER, smithLevel } from "../../../shared/crafting";
import { ITEMS } from "../../../shared/items";
import { formatMoney } from "../../../shared/money";
import { toolForSkill, TOOL_TYPES, METAL_IDS, METALS, BAR_IDS, metalOfBar, TOOL_TYPE_IDS } from "../../../shared/tools";
import { DISH_IDS, DISHES, FOOD_KINDS } from "../../../shared/cooking";
import { BAIT_IDS, BAITS } from "../../../shared/handicraft";
import { WEAPON_TYPES, WEAPONS } from "../../../shared/gear";
import { spellMana, describeSpell } from "../../../shared/spells";
import { TreeRanks } from "../../../shared/skilltree";
import { skillListEl, openDisciplines, el, disciplineStat, expanded, teachNote, itemIcon, sellPrice, knows, icon, potSize, tree, chanceWords } from "./core";
import { renderInventory, shopIsOpen, lastBelt, spellbook, lastGear } from "./bag";
import { renderShop } from "./shop";
import { renderCraft } from "./craft";
import { renderInfo } from "./info";
import { vitals } from "./vitals";

// ---- Disciplines (and the skills inside them) ----

export let lastDisciplines: DisciplineView = newDisciplineView();

export let lastSkillXp: SkillXp = emptySkills();

export let lastMastery: ItemMasteryXp = {};

let flashSkill: SkillId | undefined;

let flashType: MasteryId | undefined;

export let lastCombatMastery: CombatMasteryXp = {};

let flashCombat: CombatMasteryId | undefined;

/** The Monsters list in the Combat discipline is open. */
let monstersOpen = false;

export function renderDisciplines(disciplines: DisciplineView, flash?: DisciplineId) {
  if (disciplines !== lastDisciplines) setTreeData({ unlocked: disciplines.unlocked });
  const charismaChanged = disciplines.levels.charisma !== lastDisciplines.levels.charisma;
  lastDisciplines = disciplines;
  if (charismaChanged) { renderInventory(); if (shopIsOpen()) renderShop(); }
  skillListEl.replaceChildren();
  for (const id of DISCIPLINE_IDS) {
    const def = DISCIPLINES[id];
    // A Discipline's level is the average of its unlocked skills' levels; the bar shows how close the next one is.
    const level = disciplines.levels[id] ?? 1;
    const taught = def.skills.filter((s) => isUnlocked(disciplines.unlocked, s.id));
    const levels = taught.map((s) => levelForXp(lastSkillXp[s.id] ?? 0));
    const sum = levels.reduce((a, b) => a + b, 0);
    const maxed = level >= MAX_LEVEL;
    const toNext = taught.length ? taught.length * (level + 1) - sum : 0;
    const pct = maxed || !taught.length ? (maxed ? 100 : 0) : Math.floor(((sum - level * taught.length) / taught.length) * 100);

    const row = document.createElement("div");
    const isOpen = openDisciplines.has(id);
    row.className = "skill" + (flash === id ? " flash" : "") + (isOpen ? " open" : "");
    row.title = `${def.description} Its level is the average of its skills' levels. Click to ${isOpen ? "fold it up" : "show its skills"}.`;
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
      el("skill-xp", (taught.length
        ? `${disciplineStat(id, level)} · average of ${taught.length} skill${taught.length === 1 ? "" : "s"}` + (maxed ? "" : ` · ${toNext} more skill level${toNext === 1 ? "" : "s"} to go`)
        : `${disciplineStat(id, level)} · no skills learned yet`)),
    );

    if (!isOpen) {
      skillListEl.appendChild(row);
      continue;
    }
    // The skills inside this Discipline, and when they unlock.
    const subs = el("subskills");
    subs.style.gridColumn = "1 / 4";
    for (const skill of def.skills) {
      const unlocked = isUnlocked(disciplines.unlocked, skill.id);
      const sub = el("subskill" + (unlocked ? "" : " locked") + (flashSkill === skill.id ? " flash" : ""));
      sub.title = `${skill.description} Click to show or hide its details.`;
      const head = el("ss-head");
      const open = expanded.has(skill.id);
      head.append(el("ss-icon", skill.icon), el("ss-name", `${open ? "▾" : "▸"} ${skill.name}`),
        el("ss-state", unlocked ? `Lv ${levelForXp(lastSkillXp[skill.id] ?? 0)}` : "🔒 not learned"));
      sub.appendChild(head);
      if (open) {
        // A locked skill shows nothing as available yet (not even its level-1 types, like Bronze).
        sub.appendChild(unlocked ? skillDetails(skill.id)
          : el("mastery m-info", `🔒 ${teachNote(skill.id)} Until then you can't use any of it.`));
      }
      sub.onclick = (e) => {
        e.stopPropagation(); // don't also fold up the Discipline
        if (expanded.has(skill.id)) expanded.delete(skill.id); else expanded.add(skill.id);
        renderDisciplines(lastDisciplines);
      };
      subs.appendChild(sub);
    }
    if (id === "strength") subs.appendChild(monsterRow());
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
  box.append(top, bar, treeButton(skill));
  if (skill === "cooking") return cookingDetails(level, box);
  if (skill === "handicraft") return handicraftDetails(level, box);
  if (skill === "foraging") return forageDetails(level, box);
  if (skill === "hunting") return huntingDetails(level, box);
  if (skill === "melee" || skill === "ranged") return weaponDetails(skill, level, box);
  if (skill === "magic") return magicDetails(level, box);
  if (skill === "defense") return defenseDetails(level, box);
  if (isCraftSkill(skill)) return craftDetails(skill, level, box);
  const types = resourcesFor(skill);
  const upcoming = types.find((id) => RESOURCES[id].level > level);
  if (upcoming) box.append(el("m-info", `Next unlock: ${masteryName(upcoming)} at level ${RESOURCES[upcoming].level}`));
  if (!expanded.has(skill)) return box;

  const list = el("m-types");
  for (const id of types) {
    const r = RESOURCES[id];
    const item = ITEMS[r.item];
    const open = level >= r.level;
    const row = el("m-type" + (open ? "" : " locked") + (flashType === id ? " flash" : ""));
    const ic = itemIcon("m-type-icon", r.item);
    if (!open) {
      row.append(ic, el("m-type-name", item.name), el("m-type-state", `🔒 Lv ${r.level}`));
      row.title = `Reach ${findSkill(skill).def.name} level ${r.level} to gather ${item.name}.`;
    } else {
      const mXp = lastMastery[id] ?? 0;
      const m = masteryLevelForXp(mXp);
      const mStart = masteryXpForLevel(m), mNext = masteryXpForLevel(m + 1);
      const price = sellPrice(r.item);
      row.append(ic, el("m-type-name", item.name), el("m-type-state", `Mastery ${m}`));
      const mBar = el("skill-bar t-bar");
      const mFill = document.createElement("div");
      mFill.style.width = `${Math.floor(((mXp - mStart) / (mNext - mStart)) * 100)}%`;
      mBar.appendChild(mFill);
      const faster = Math.round((gatherSpeed(id, m) - 1) * 100);
      const detail = el("t-info", knows(r.skill) ? `${faster}% faster · sells for ${formatMoney(price)}` : `sells for ${formatMoney(price)}`);
      row.append(mBar, detail);
      row.title = `${item.name} Mastery ${m}: ${(mNext - mXp).toLocaleString()} XP to ${m + 1}. ` +
        `${faster}% faster to gather, ${valueBonusPercent(m)}% more money (base price ${formatMoney(item.sellPrice)}). ${r.xp} XP each` +
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
  const tool = toolForSkill(skill);
  if (!tool) return el("m-info", "No tool needed");
  const bonus = beltBonus(lastBelt, skill);
  if (!knows(skill)) return el("m-info", lastBelt[tool] ? `Using ${ITEMS[lastBelt[tool]!.item].name}: it helps a lot` : `A ${TOOL_TYPES[tool].name.toLowerCase()} on your belt helps a lot`);
  return el("m-info", lastBelt[tool] ? `Using ${ITEMS[lastBelt[tool]!.item].name}: ${Math.round(bonus! * 100)}% fewer failures`
    : `No ${TOOL_TYPES[tool].name.toLowerCase()} on your belt: half the success chance`);
}

/** Cooking: each dish's Mastery (or when it unlocks), and what it's good with. */
function cookingDetails(level: number, box: HTMLElement) {
  const upcoming = DISH_IDS.find((d) => DISHES[d].level > level);
  if (upcoming) box.append(el("m-info", `Next unlock: ${DISHES[upcoming].name} at level ${DISHES[upcoming].level}`));
  box.append(beltLine("cooking"), el("m-info", `Your pot holds ${potSize()} ingredients`));
  if (!expanded.has("cooking")) return box;
  const list = el("m-types");
  const bonus = beltBonus(lastBelt, "cooking");
  for (const dish of DISH_IDS) {
    const d = DISHES[dish];
    if (level < d.level) {
      const row = el("m-type locked");
      row.append(icon("m-type-icon", d.icon), el("m-type-name", d.name), el("m-type-state", `🔒 Lv ${d.level}`));
      row.title = `${d.name}: ${d.note}.`;
      list.appendChild(row);
      continue;
    }
    const kinds = Object.entries(d.kinds).map(([k, x]) => `${FOOD_KINDS[k as keyof typeof FOOD_KINDS].toLowerCase()} ×${x}`).join(", ");
    list.appendChild(masteryRow(dish, d.name, d.icon, undefined,
      (m) => { const c = 1 - (1 - craftSuccess(m, bonus, d.start)) * (1 - tree("cooking", "success")); return knows("cooking") ? `${percent(c)} success · +${valueBonusPercent(m)}% stamina and value` : chanceWords(c); },
      (m) => `${d.note}. Stamina: ${kinds}, fire ×${d.fire}. Every ${d.name.toLowerCase()} shares this Mastery: ${percent(masterySuccess(m, d.start))} base success; they give ${valueBonusPercent(m)}% more stamina and sell for ${valueBonusPercent(m)}% more.`));
  }
  box.appendChild(list);
  return box;
}

/** Handicraft: each bait's Mastery (or when it unlocks). */
function handicraftDetails(level: number, box: HTMLElement) {
  const upcoming = BAIT_IDS.find((b) => BAITS[b].level > level);
  if (upcoming) box.append(el("m-info", `Next unlock: ${BAITS[upcoming].name} at level ${BAITS[upcoming].level}`));
  box.append(beltLine("handicraft"));
  if (!expanded.has("handicraft")) return box;
  const list = el("m-types");
  for (const bait of BAIT_IDS) {
    const b = BAITS[bait];
    if (level < b.level) {
      const row = el("m-type locked");
      row.append(icon("m-type-icon", b.icon, b.tint), el("m-type-name", b.name), el("m-type-state", `🔒 Lv ${b.level}`));
      row.title = `${b.name}: ${b.description}.`;
      list.appendChild(row);
      continue;
    }
    list.appendChild(masteryRow(bait, b.name, b.icon, b.tint,
      (m) => { const c = 1 - (1 - craftSuccess(m, null, b.start, false)) * (1 - tree("handicraft", "success")); return `${knows("handicraft") ? `${percent(c)} success` : chanceWords(c)} · ${b.description.split(":")[0]}`; },
      (m) => `${b.description}, for ${b.uses} catches. ${percent(masterySuccess(m, b.start))} base success, ${valueBonusPercent(m)}% more money.`));
  }
  box.appendChild(list);
  return box;
}

/** Foraging: what dig patches can turn up at your level (moonpetal only at night), and the Dig patch Mastery. */
function forageDetails(level: number, box: HTMLElement) {
  const upcoming = FORAGE_FINDS.find((f) => f.level > level);
  if (upcoming) box.append(el("m-info", `Next find: ${ITEMS[upcoming.item].name} at level ${upcoming.level}`));
  if (!expanded.has("foraging")) return box;
  const m = masteryLevelForXp(lastMastery.dig ?? 0);
  box.append(el("m-info", `Dig patch Mastery ${m}: ${speedBonusPercent(m)}% faster digging`));
  const list = el("m-types");
  for (const f of FORAGE_FINDS) {
    const item = ITEMS[f.item];
    const row = el("m-type" + (level >= f.level ? "" : " locked"));
    row.append(itemIcon("m-type-icon", f.item), el("m-type-name", item.name + (f.night ? " 🌙" : "")),
      el("m-type-state", level >= f.level ? `${f.xp} XP` : `🔒 Lv ${f.level}`));
    row.title = `${item.name}: Foraging level ${f.level}, ${f.xp} XP${f.night ? ". Only at night" : ""}. Sells for ${formatMoney(sellPrice(f.item))}.`;
    list.appendChild(row);
  }
  box.appendChild(list);
  return box;
}

/** Hunting: how much it raises drop chances. */
function huntingDetails(level: number, box: HTMLElement) {
  box.append(el("m-info", `Monsters drop things ${Math.round((huntingDrops(level) - 1) * 100)}% more often`));
  box.append(el("m-info", "Every monster you help defeat gives Hunting XP, shared by how much damage each hunter did."));
  return box;
}

/** Smelting: each bar's Mastery. Smithing: each kind of tool's Mastery. Shows your success chance with your belt tool. */
function craftDetails(skill: CraftSkill, level: number, box: HTMLElement) {
  const upcoming = METAL_IDS.find((m) => METALS[m].level > level);
  const nextSmith = skill === "smithing" ? SMITH_ORDER.find((t) => smithLevel(t) > level) : undefined;
  if (nextSmith) box.append(el("m-info", `Next unlock at the anvil: ${nextSmith === "rod" ? "fishing rods" : nextSmith} at level ${smithLevel(nextSmith)}`));
  else if (upcoming) {
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
        (m) => `${knows(skill) ? `${percent(craftSuccess(m, bonus))} success` : chanceWords(craftSuccess(m, bonus))} · sells for ${formatMoney(sellPrice(bar))}`,
        (m) => `${percent(masterySuccess(m))} base success, ${valueBonusPercent(m)}% more money. ${metal.barXp} XP each.`));
    }
  } else {
    for (const type of TOOL_TYPE_IDS) {
      const t = TOOL_TYPES[type];
      if (type === "pot") continue; // pots are made at the anvil, but they help Cooking
      list.appendChild(masteryRow(type, type === "tongs" ? t.name : `${t.name}s`, t.icon, undefined,
        (m) => knows(skill) ? `${percent(craftSuccess(m, bonus))} success · +${valueBonusPercent(m)}% value` : chanceWords(craftSuccess(m, bonus)),
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
      () => `Hits up to ${w.maxHit}, plus its metal (bronze +1, better metal more), every ${(w.speed * 0.6).toFixed(1)}s${w.range > 1 ? `, from ${w.range} tiles` : ""}.`));
  }
  box.appendChild(list);
  return box;
}

/** Magic: your mana, and each spell with its Mastery. */
function magicDetails(level: number, box: HTMLElement) {
  const upcoming = SPELL_IDS.find((id) => SPELLS[id].level > level && !SPELLS[id].book);
  box.append(el("m-info", `Mana ${vitals.mana}/${vitals.maxMana} · bolts need a staff, other spells cast from your spell bar`));
  if (upcoming) box.append(el("m-info", `Next spell: ${SPELLS[upcoming].name} at level ${SPELLS[upcoming].level}`));
  if (!expanded.has("magic")) return box;
  const list = el("m-types");
  for (const id of SPELL_IDS) {
    const sp = SPELLS[id];
    if (sp.book && !spellbook.books.includes(id)) { list.appendChild(lockedRow(sp.icon, sp.name, `📖 book, Lv ${sp.level}`)); continue; }
    if (level < sp.level) { list.appendChild(lockedRow(sp.icon, sp.name, `🔒 Lv ${sp.level}`)); continue; }
    list.appendChild(combatRow(id, sp.name, sp.icon,
      (m) => isBoltSpell(id) ? `${spellMana(id, m)} mana · +${Math.round(masteryAccuracy(m) * 100)}% to hit` : `${spellMana(id, m)} mana`,
      () => describeSpell(id, level, combatMasteryIn(lastCombatMastery, id))));
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
  setTreeData({ combatMastery: m });
  renderDisciplines(lastDisciplines);
}

export function flashCombatMastery(id: CombatMasteryId) {
  flashCombat = id;
  renderDisciplines(lastDisciplines);
  flashCombat = undefined;
}

export function renderSkillXp(skillXp: SkillXp) {
  lastSkillXp = skillXp;
  setTreeData({ skillXp });
  renderDisciplines(lastDisciplines);
  renderCraft();
}

/** The server sent your skill tree ranks: they change pot size, success chances and more. */
export function renderTreeRanks(ranks: TreeRanks) {
  setTreeData({ ranks });
  renderDisciplines(lastDisciplines);
  renderCraft();
  renderInfo();
}

export function renderMastery(mastery: ItemMasteryXp) {
  lastMastery = mastery;
  setTreeData({ mastery });
  renderDisciplines(lastDisciplines);
  renderInventory(); // prices depend on Mastery
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
