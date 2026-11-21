import { INVENTORY_SIZE, ITEMS, ItemId } from "../../shared/items";
import { COIN_KINDS, formatMoney, toPurse } from "../../shared/money";
import { CraftSkill, DISCIPLINES, DISCIPLINE_IDS, DisciplineId, DisciplineView, MAX_LEVEL, SkillId, SkillXp, emptySkills, findSkill, isCraftSkill, isUnlocked, levelForXp, newDisciplineView, xpForLevel } from "../../shared/disciplines";
import { buyWithCharisma, maxHealth, maxMana, maxStamina, sellWithCharisma, walkBonus } from "../../shared/stats";
import { ItemMasteryXp, MasteryId, craftSuccess, masteryValue, masteryIn, masteryLevelForXp, masterySuccess, masteryXpForLevel, percent, speedBonusPercent, valueBonusPercent } from "../../shared/mastery";
import { FORAGE_FINDS, RESOURCES, forageFindOf, forageXp, resourcesFor } from "../../shared/foraging";
import { beltBonus, buyPriceFor, masteryIdFor, masteryName, recipeFor, sellPriceFor, successFor } from "../../shared/crafting";
import { RESOURCE_FOR_ITEM } from "../../shared/foraging";
import { CRAFT_MARKUP } from "../../shared/items";
import {
  BAR_IDS, Belt, MATERIALS, MATERIAL_IDS, Material, METALS, METAL_IDS, Metal, TOOL_TYPES, TOOL_TYPE_IDS, ToolType, WOODS, WOOD_IDS, Wood, barId, emptyBelt,
  ROD_LOGS, hasHandle, isTool, isWoodTool, maxDurability, metalOfBar, parseTool, toolBonus, toolForSkill, toolId,
} from "../../shared/tools";
import { GUIDE_NAME, teacherOf, type ChapterView, type QuestView } from "../../shared/quests";
import { SHOPS, SHOP_IDS, sellersOf, type ShopId } from "../../shared/shops";
import { npcById } from "../../shared/npcs";
import { isBroken, type RepairJob } from "../../shared/repair";
import { PLAYER_COLORS } from "../../shared/colors";
import {
  ARMOR, ARMOR_TYPES, ArmorType, GEAR_SLOTS, Gear, GearSlot, SLOT_ICONS, SLOT_NAMES, WEAPONS, WEAPON_TYPES, WeaponType,
  armorId, emptyGear, isArmor, isGear, isWeapon, parseArmor, parseWeapon, weaponId,
} from "../../shared/gear";
import {
  huntingDrops, ARMOR_LEVEL, CombatMasteryId, CombatMasteryXp, MONSTERS, MONSTER_IDS, POTION_HEAL, POTION_ID, SPELLS, SPELL_IDS, SpellId, armorPoints, attackFor,
  combatMasteryIn, gearEffect, gearNeeds, masteryAccuracy, masteryDamage, masteryDrops, maxHitWith,
} from "../../shared/combat";
import { gearDurability } from "../../shared/crafting";
import { Bounty, bountyReward, slotCounts } from "../../shared/bounties";
import { Bag, emptyBag, entriesIn, slotTotal, stackLimit, usedSlots } from "../../shared/bag";
import { carriedWeight, carryCapacity, kg, weightOf } from "../../shared/weight";
import {
  CHEST_RENT, CHEST_START, CHEST_STEP, GuildBounty, GuildView, RANKS, expandCost, guildBountyName, guildReward, rankFor,
} from "../../shared/guild";
import { MONSTERS as MONSTER_DEFS, BoltSpellId, isBoltSpell } from "../../shared/combat";
import { BAR_SLOT_MASTERY, describeSpell, isSpellBook, SPELL_BOOKS, spellMana } from "../../shared/spells";
import { isSoulGem, soulCapacity, soulFill } from "../../shared/jewelry";
import { ENCHANTS, ENCHANT_IDS, EnchantId, INLAYS, Inlay, cappedGem, describeEnchant, enchantForGem, enchantKind, enchantsOf, fits, isSpent, soulPower } from "../../shared/enchanting";
import {
  BASE_INGREDIENTS, DISHES, DISH_IDS, DishId, FOOD_KINDS, FUEL_STAMINA, INGREDIENTS, IngredientId, MAX_STAMINA, RAW_FISH_STAMINA, STAMINA_COST,
  fireStamina, fitsDish, foodStamina, ingredientStamina, isFood, isIngredient, isMeal, mealBaseStamina, mealId, parseMeal,
} from "../../shared/cooking";
import { BAITS, BAIT_IDS, BaitId, isBait } from "../../shared/handicraft";
import { TreeRanks, treeBonus } from "../../shared/skilltree";
import { setTreeData, treeButton, treeRanks } from "./tree";
import { toolSvg } from "./toolIcons";
import {
  CUT_LEVEL, GEMS, JEWEL_BARS, JEWEL_BAR_IDS, JEWEL_METALS, JEWEL_METAL_IDS, JEWEL_SLOTS, JEWEL_TYPES, JewelMetal, JewelSlot, JewelType, Jewels,
  cutChances, describeBonus, emptyJewels, isCutGem, isJewelry, isRough, jewelBonus, jewelId, parseGem,
} from "../../shared/jewelry";
import {
  ALCHEMY_INGREDIENTS, BONUSES, BONUS_IDS, BUFFS, BUFF_IDS, BonusId, Buffs, POTIONS, POTION_TYPES, PotionType, buffPower, describeEffect, isPotion, parsePotion, potionEffect, potionFrom,
} from "../../shared/alchemy";

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

let lastDisciplines: DisciplineView = newDisciplineView();
/** What a shop pays you for one, with your Mastery and Charisma. */
const sellPrice = (id: ItemId, uses?: number | null) => sellWithCharisma(sellPriceFor(id, lastMastery, uses), lastDisciplines.levels.charisma);
/** What a shop charges you for one, with your Charisma. */
const buyPrice = (id: ItemId) => buyWithCharisma(buyPriceFor(id), lastDisciplines.levels.charisma);

/** "Forester Holt teaches it, on Trainer Row (📜 Quests)." */
function teachNote(skill: SkillId): string {
  const c = teacherOf(skill);
  if (!c) return "";
  return c.id === "maren" ? `${GUIDE_NAME} will teach you this in her lessons (📜 Quests).` : `${c.name} teaches it, ${c.where} (📜 Quests).`;
}

/** What each Discipline does for you right now: "Max health 60". */
function disciplineStat(id: DisciplineId, level: number): string {
  switch (id) {
    case "strength": return `Max health ${maxHealth(level)}`;
    case "endurance": return `Max stamina ${maxStamina(level)}`;
    case "wisdom": return `Max mana ${maxMana(level)}`;
    case "dexterity": return `Carry ${kg(carryCapacity(level))} · walk ${Math.round(walkBonus(level) * 100)}% faster`;
    case "charisma": return `Shop prices ${Math.round((sellWithCharisma(1000, level) / 1000 - 1) * 100)}% better`;
  }
}
let lastSkillXp: SkillXp = emptySkills();
let lastMastery: ItemMasteryXp = {};
let flashSkill: SkillId | undefined;
let flashType: MasteryId | undefined;
let lastBelt: Belt = emptyBelt();
let lastGear: Gear = emptyGear();
let lastSpell: BoltSpellId = "fire_blast";
/** The enchanting altar uses the craft window too, with its own buttons. */
let altarOpen = false;
const altarPick: { item: number | null; soul: number | null; gem: number | null; effect: EnchantId | null; inlay: Inlay } = { item: null, soul: null, gem: null, effect: null, inlay: "none" };
/** The spell bar (shared/spells.ts), from the server. */
interface Spellbook { bar: (SpellId | null)[]; known: SpellId[]; books: SpellId[]; bolt: BoltSpellId }
let spellbook: Spellbook = { bar: [], known: [], books: [], bolt: "fire_blast" };
let editingBar = false;
let pickedSlot = 0;
let lastCombatMastery: CombatMasteryXp = {};
let flashCombat: CombatMasteryId | undefined;
/** The Monsters list in the Combat discipline is open. */
let monstersOpen = false;
/** Which crafting window is open, and what's picked in it. */
let station: Station | null = null;
const pick = {
  bar: "bronze" as Metal, type: "axe" as ToolType, metal: "stone" as Material, wood: "pine" as Wood, fuel: "pine" as Wood,
  /** Stove: the dish, and what's in the pot. Workbench: the bait. */
  dish: "stew" as DishId, pot: [] as IngredientId[], bait: "bait_worm" as BaitId,
  /** Anvil: what kind of thing to make. */
  category: "tools" as "tools" | "weapons" | "armor" | "jewelry" | "gems", weapon: "dagger" as WeaponType, armor: "helmet" as ArmorType, armorMetal: "bronze" as Metal,
  /** Alchemy table: what's in the mix (2 or 3 ingredients). */
  mix: [] as ItemId[],
  /** Furnace: which bar (metal bars and the jewelry bars). */
  furnaceBar: "bronze_bar" as ItemId,
  /** Anvil, jewelry: ring or amulet, its metal, and the cut gem to set (or none). */
  jewel: "ring" as JewelType, jewelMetal: "bronze" as JewelMetal, jewelGem: null as ItemId | null,
};
/** Gems and jewelry: what the server should do. */
let onCut: (item: ItemId) => void = () => {};
let onWearJewel: (slot: number) => void = () => {};
let onRemoveJewel: (slot: JewelSlot) => void = () => {};
export function setGemActions(a: { cut: (item: ItemId) => void; wearJewel: (slot: number) => void; removeJewel: (slot: JewelSlot) => void }) {
  onCut = a.cut; onWearJewel = a.wearJewel; onRemoveJewel = a.removeJewel;
}
/** Rings and amulet you're wearing. */
let lastJewels: Jewels = emptyJewels();
const SLOT_LABELS: Record<JewelSlot, string> = { ring1: "Ring", ring2: "Ring", amulet: "Amulet" };
export function renderJewels(j: Jewels) {
  lastJewels = j;
  const box = document.getElementById("jewels");
  if (!box) return;
  box.replaceChildren();
  for (const s of JEWEL_SLOTS) {
    const on = j[s];
    const slot = el("slot belt-slot" + (on ? " filled" : ""));
    if (on) {
      const item = ITEMS[on];
      slot.append(icon("", item.icon, item.tint));
      slot.title = `${item.name}: ${describeBonus(jewelBonus(on))}. Click to take it off.`;
      slot.onclick = () => onRemoveJewel(s);
    } else {
      slot.append(icon("empty-tool", s === "amulet" ? "📿" : "💍"));
      slot.title = `${SLOT_LABELS[s]}: empty. Click ${s === "amulet" ? "an amulet" : "a ring"} in your bag to put it on. Smith them at the anvil.`;
    }
    box.appendChild(slot);
  }
}
const STATION_SKILL = { furnace: "smelting", anvil: "smithing", stove: "cooking", workbench: "handicraft", alchemy_table: "alchemy" } as const;
/** Hidden potion recipes you've found. */
let discovered: PotionType[] = [];
export function setDiscovered(list: PotionType[]) { discovered = list; renderCraft(); }
/** Potion buffs running, and the server's clock (buffs end by it). */
let buffs: Buffs = {};
let serverOffset = 0;
export const serverNow = () => Date.now() + serverOffset;
export function setServerOffset(offset: number) { serverOffset = offset; }
export function setBuffs(b: Buffs) { buffs = b; renderVitalBars(); }
/** Called every second: the buff timers count down. */
export function tickBuffs() { if (Object.keys(buffs).length) renderVitalBars(); }
/** Is a night sight potion working right now? */
export const nightSightOn = () => buffPower(buffs, "nightsight", serverNow()) > 0;
type Station = keyof typeof STATION_SKILL;

/** What a skill's tree gives you for one effect (from the ranks you've bought). */
const tree = (skill: SkillId, effect: Parameters<typeof treeBonus>[2]) => treeBonus(treeRanks(), skill, effect);
/** Your crafting chance with everything counted (Mastery, belt tool, skill tree). */
const chanceFor = (recipe: NonNullable<ReturnType<typeof recipeFor>>) => successFor(recipe, lastMastery, lastBelt, tree(recipe.skill, "success"));
/** Stamina from eating it, with the Cooking tree's "Hearty meals". */
const staminaOf = (item: ItemId) => foodStamina(item, lastMastery, tree("cooking", "mealStamina"));
/** How many ingredients fit in your pot. */
const potSize = () => BASE_INGREDIENTS + tree("cooking", "slots");
/** The item whose info card is showing. */
/** A bag slot shows one of the things in it at a time: `pick` is which (0 = the one on top). */
type InfoTarget = { kind: "slot"; slot: number; pick: number } | { kind: "belt"; type: ToolType } | { kind: "gear"; slot: GearSlot };
let info: InfoTarget | null = null;
/** The shop window is on its Buy tab (otherwise Sell). */
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
    img.draggable = false; // or the browser drags the picture itself, and dragging items around the bag stops working
    const name = glyph.slice(4);
    const [kind, type, material, wood] = name.split("/");
    const svg = kind === "tool" ? toolSvg(type as ToolType, (material || null) as Material | null, (wood || null) as Wood | null) : SVG_ICONS[name];
    img.src = `data:image/svg+xml,${encodeURIComponent(svg ?? "")}`;
    box.appendChild(img);
  } else {
    box.textContent = glyph;
  }
  if (tint) box.style.filter = tint;
  return box;
}

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
    const ic = icon("m-type-icon", item.icon, item.tint);
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
  const tool = toolForSkill(skill);
  if (!tool) return el("m-info", "No tool needed");
  const bonus = beltBonus(lastBelt, skill);
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
      (m) => `${percent(1 - (1 - craftSuccess(m, bonus, d.start)) * (1 - tree("cooking", "success")))} success · +${valueBonusPercent(m)}% stamina and value`,
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
      (m) => `${percent(1 - (1 - craftSuccess(m, null, b.start, false)) * (1 - tree("handicraft", "success")))} success · ${b.description.split(":")[0]}`,
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
    row.append(icon("m-type-icon", item.icon, item.tint), el("m-type-name", item.name + (f.night ? " 🌙" : "")),
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
        (m) => `${percent(craftSuccess(m, bonus))} success · sells for ${formatMoney(sellPrice(bar))}`,
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

// Clicking a slot opens its item card (or sells it while a shop is open).
// Similar things share a slot (shared/bag.ts): the card cycles through them.
// In lock mode (the 🔒 button on the inventory), clicking a slot locks or
// unlocks everything in it instead.
let bag: Bag = emptyBag(0);
// The bag's lists, one place per entry (an axe, 12 pine logs...). Messages to the server name an entry.
let invItems: (ItemId | null)[] = [];
let locked: boolean[] = []; // per entry
let durability: (number | null)[] = []; // per entry: uses left on tools
let counts: number[] = []; // per entry: how many
/** How many are in this entry (0 if unused). */
const countAt = (i: number) => (invItems[i] ? Math.max(1, counts[i] ?? 1) : 0);
let lockMode = false;
let onDrop: (slot: number) => void = () => {};
let onSell: (slot: number, count?: number) => void = () => {};
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
let onCast: (id: SpellId) => void = () => {};
let onSpellBar: (bar: (SpellId | null)[]) => void = () => {};
let onRead: (slot: number) => void = () => {};
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
  renderWeight();
  renderInfo();
  beltEl.replaceChildren();
  for (const type of TOOL_TYPE_IDS) {
    const t = TOOL_TYPES[type];
    const on = belt[type];
    const slot = el("slot belt-slot" + (on ? " filled" : ""));
    if (on) {
      const max = maxDurability(on.item);
      slot.append(icon("", ITEMS[on.item].icon, ITEMS[on.item].tint), durabilityBar(on.durability, max));
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
  renderSpellBar();
  renderDisciplines(lastDisciplines);
}
renderGear(lastGear, lastSpell);

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
function setLockMode(on: boolean) {
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

/** What to call an item in the bag and on its card: just "Axe" for tools (the card says what it's made of). */
const shortName = (id: ItemId) => ITEMS[id].short ?? ITEMS[id].name;

/** What a slot of mixed things holds, e.g. "axes", "stews", "swords" (shared/bag.ts groups them). */
function groupName(id: ItemId): string {
  const meal = parseMeal(id);
  const name = isTool(id) ? TOOL_TYPES[parseTool(id).type].name : meal ? DISHES[meal.dish].name
    : isWeapon(id) ? WEAPONS[parseWeapon(id).type].name : isArmor(id) ? ARMOR[parseArmor(id).type].name : ITEMS[id].name;
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
      slot.appendChild(icon("item-icon", item.icon, item.tint));
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
  weightEl.append(el("weight-label", `⚖️ ${kg(carried)} / ${kg(max)}`), bar);
  weightEl.title = `You're carrying ${kg(carried)} of the ${kg(max)} you can carry. Your bag, the tools on your belt and the gear you wear all count. ` +
    "When you're full you can't pick up more: sell, drop or eat something, or put it in your enchanted chest.";
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

let coins = 0;
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
renderCoins(0);

// ---- The Repairer's window (at the Mages' Guild) ----

const repairBody = document.getElementById("repair-body")!;
const repairAllBtn = document.getElementById("repair-all") as HTMLButtonElement;
let repairActions: { repair: (where: string, key: string | number) => void; repairAll: () => void } = { repair: () => {}, repairAll: () => {} };

export function setRepairActions(actions: typeof repairActions) {
  repairActions = actions;
}

export function closeRepair() {
  document.body.classList.remove("repair-open");
}

/** Everything worn or broken, with what it costs to fix. `open` opens the window (otherwise it only updates if open). */
export function showRepairs(view: { jobs: RepairJob[]; free: boolean; open: boolean }) {
  if (view.open) {
    closeDialog();
    closeShop();
    closeCraft();
    closeBounties();
    closeGuild();
    closeChest();
    closeInfo();
    document.body.classList.add("repair-open");
  }
  if (!document.body.classList.contains("repair-open")) return;
  repairBody.replaceChildren();
  const where = { belt: "on your belt", gear: "you're wearing it", bag: "in your bag" };
  if (!view.jobs.length) {
    repairBody.append(el("", "Nothing needs fixing. Come back when something wears out!"));
  } else {
    repairBody.append(el("", view.free ? "Your first repair is free (Old Maren's an old friend)." : `About 1 bronze for every 10% worn, more for finer things. You have ${formatMoney(coins)}.`));
    const list = el("");
    list.id = "repair-list";
    for (const j of view.jobs) {
      const item = ITEMS[j.item];
      const cost = view.free ? 0 : j.cost;
      const row = el("buy-row" + (coins < cost ? " poor" : ""));
      const b = document.createElement("button");
      b.className = "buy-btn";
      const state = j.durability <= 0 ? "💔 broken" : `${Math.round((j.durability / j.max) * 100)}% left`;
      b.append(icon("buy-icon", item.icon, item.tint), el("buy-name", `${item.short ?? item.name} · ${state}`), el("buy-price", cost ? formatMoney(cost) : "Free"));
      b.title = `Repair your ${item.single} (${where[j.where]}): ${j.durability} of ${j.max} uses left`;
      b.onclick = () => repairActions.repair(j.where, j.key);
      row.append(b);
      list.append(row);
    }
    repairBody.append(list);
  }
  const total = view.free ? 0 : view.jobs.reduce((sum, j) => sum + j.cost, 0);
  repairAllBtn.disabled = !view.jobs.length;
  repairAllBtn.textContent = view.jobs.length > 1 ? `Repair all (${total ? formatMoney(total) : "free"})` : "Repair all";
}

repairAllBtn.onclick = () => repairActions.repairAll();
document.getElementById("repair-close")!.onclick = closeRepair;

// ---- Shop window (the General Store or a trainer's shop) ----
// You sell by clicking items in your inventory while this is open.

const shopBody = document.getElementById("shop-body")!;

document.querySelectorAll<HTMLElement>(".shop-tab").forEach((b) => {
  b.onclick = () => {
    shopBuying = b.dataset.mode === "buy";
    resetSellAll();
    renderInventory();
  };
});

/** Which shop is open. */
let shopId: ShopId = "tam";

export function openShop(id: ShopId) {
  shopId = SHOPS[id] ? id : "tam";
  document.getElementById("shop-title")!.textContent = SHOPS[shopId].title;
  closeCraft();
  closeBounties();
  closeGuild();
  closeChest();
  closeInfo();
  document.body.classList.add("shop-open");
  openPanel("inventory"); // so you can click your items, on phones too
  renderInventory();
}

export function closeShop() {
  if (!shopIsOpen()) return;
  document.body.classList.remove("shop-open");
  closeAmount();
  resetSellAll();
  renderInventory();
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
  const shop = SHOPS[shopId];
  shopBody.append(el("", shopId === "tam" ? "Tam buys anything. Tap an item in your bag to sell it. To keep one, tap 🔒 on your bag, then tap the item."
    : `This shop buys ${shop.buysText} (Tam at the General Store buys anything). Tap an item in your bag to sell it. To keep one, tap 🔒 on your bag.`));
  const prices = el("");
  prices.id = "shop-prices";
  // Prices for the kinds of thing you're carrying (there are too many to list them all).
  const carrying = [...new Set(invItems.filter((id): id is ItemId => !!id && shop.buys(id)))];
  for (const id of carrying) {
    const span = document.createElement("span");
    span.append(icon("", ITEMS[id].icon, ITEMS[id].tint), ` ${ITEMS[id].name}: ${formatMoney(sellPrice(id))}`);
    span.className = "price";
    prices.appendChild(span);
  }
  const unlockedSlots = invItems.flatMap((id, i) => (id && !locked[i] && shop.buys(id) ? [i] : []));
  const total = unlockedSlots.reduce((sum, i) => sum + sellPrice(invItems[i]!, durability[i]) * countAt(i), 0);
  const unlockedCount = unlockedSlots.reduce((sum, i) => sum + countAt(i), 0);
  const lockedCount = invItems.reduce((sum, id, i) => sum + (id && locked[i] ? countAt(i) : 0), 0);
  shopBody.append(prices, el("", !invItems.some(Boolean) ? "You have nothing to sell. Go chop or fish!"
    : !carrying.length ? `You have nothing this shop buys.`
    : `Sell all gives you ${formatMoney(total)}` + (lockedCount ? ` (keeps ${lockedCount} locked).` : ".")));

  sellAllBtn.disabled = !unlockedCount;
  if (!unlockedCount) resetSellAll();
  sellAllBtn.textContent = sellAllArmed ? `Sell ${unlockedCount} for ${formatMoney(total)}?` : "Sell all";
  sellAllBtn.classList.toggle("armed", sellAllArmed);
}

/** The shop's goods: click one to pick how many to buy. */
function renderBuy() {
  shopBody.replaceChildren();
  shopBody.append(el("", `Never runs out. You have ${formatMoney(coins)}.`));
  const list = el("");
  list.id = "buy-list";
  for (const id of SHOPS[shopId].stock) {
    const item = ITEMS[id];
    const price = buyPrice(id);
    const row = el("buy-row" + (coins < price ? " poor" : ""));
    const ic = icon("buy-icon", item.icon, item.tint);
    const one = document.createElement("button");
    one.className = "buy-btn";
    one.append(ic, el("buy-name", item.name), el("buy-price", formatMoney(price)));
    one.title = isTool(id) ? `${item.name}: ${toolEffect(id)}, ${maxDurability(id)} uses. Tap to buy.` : `Buy ${item.name.toLowerCase()}`;
    // As many as you can afford, up to a full bag's worth (the server stops early if your bag or weight runs out).
    const most = Math.max(1, Math.min(BUY_MAX, Math.floor(coins / price)));
    one.onclick = () => askAmount({ title: `Buy ${item.name.toLowerCase()}`, glyph: item.icon, tint: item.tint, max: most, start: 1, each: price, verb: "Buy", ok: (k) => onBuy(id, k) });
    row.append(one);
    list.appendChild(row);
  }
  shopBody.appendChild(list);
}

document.getElementById("shop-close")!.onclick = closeShop;

/** The server sells at most this many in one go. */
const BUY_MAX = 28;

// ---- "How many?" box: a slider and a number box, for selling, buying and the chest ----

const amountEl = document.getElementById("amount")!;
const amountTitle = document.getElementById("amount-title")!;
const amountRange = document.getElementById("amount-range") as HTMLInputElement;
const amountNumber = document.getElementById("amount-number") as HTMLInputElement;
const amountPrice = document.getElementById("amount-price")!;
const amountOk = document.getElementById("amount-ok") as HTMLButtonElement;
let amountJob: { max: number; each?: number; verb: string; ok: (n: number) => void } | null = null;

export interface AmountAsk {
  title: string;
  glyph: string;
  tint?: string;
  /** Most you can pick (the slider goes 1 to this). */
  max: number;
  /** Where the slider starts. */
  start: number;
  /** Price of one, if money changes hands: shows "12 × 5 bronze = 60 bronze". */
  each?: number;
  /** The button: "Sell", "Buy", "Put in"... */
  verb: string;
  ok: (n: number) => void;
}

export function askAmount(a: AmountAsk) {
  const max = Math.max(1, Math.floor(a.max));
  amountJob = { max, each: a.each, verb: a.verb, ok: a.ok };
  amountTitle.replaceChildren(icon("amount-icon", a.glyph, a.tint), document.createTextNode(a.title));
  amountRange.max = amountNumber.max = String(max);
  amountRange.disabled = max === 1;
  setAmount(a.start);
  document.body.classList.add("amount-open");
}

export function closeAmount() {
  amountJob = null;
  document.body.classList.remove("amount-open");
}

function setAmount(raw: number) {
  if (!amountJob) return;
  const n = Math.max(1, Math.min(amountJob.max, Math.floor(raw) || 1));
  amountRange.value = String(n);
  if (document.activeElement !== amountNumber || Number(amountNumber.value) !== n) amountNumber.value = String(n);
  const { each } = amountJob;
  amountPrice.textContent = each === undefined ? `${n} of ${amountJob.max}`
    : `${n} × ${formatMoney(each)} = ${formatMoney(each * n)}`;
  amountPrice.style.display = each === undefined && amountJob.max === 1 ? "none" : "";
  amountOk.textContent = `${amountJob.verb} ${n}`;
}

amountRange.oninput = () => setAmount(Number(amountRange.value));
amountNumber.oninput = () => { if (amountNumber.value !== "") setAmount(Number(amountNumber.value)); };
amountNumber.onblur = () => setAmount(Number(amountNumber.value));
amountNumber.onkeydown = (e) => { if (e.key === "Enter") amountOk.click(); };
document.getElementById("amount-less")!.onclick = () => setAmount(Number(amountRange.value) - 1);
document.getElementById("amount-more")!.onclick = () => setAmount(Number(amountRange.value) + 1);
document.getElementById("amount-one")!.onclick = () => setAmount(1);
document.getElementById("amount-half")!.onclick = () => amountJob && setAmount(Math.ceil(amountJob.max / 2));
document.getElementById("amount-all")!.onclick = () => amountJob && setAmount(amountJob.max);
document.getElementById("amount-cancel")!.onclick = closeAmount;
amountOk.onclick = () => {
  if (!amountJob) return;
  const n = Number(amountRange.value);
  const ok = amountJob.ok;
  closeAmount();
  ok(n);
};

// ---- Crafting windows: the furnace (Smelting) and the anvil (Smithing) ----

const craftTitle = document.getElementById("craft-title")!;
const craftBody = document.getElementById("craft-body")!;
const craftOne = document.getElementById("craft-one") as HTMLButtonElement;
const craftAll = document.getElementById("craft-all") as HTMLButtonElement;

let onEnchant: (msg: { slot: number; soul: number; effect?: string; gem?: number; inlay?: string }) => void = () => {};
let onDisenchant: (slot: number) => void = () => {};
export function setAltarActions(a: { enchant: typeof onEnchant; disenchant: typeof onDisenchant }) {
  onEnchant = a.enchant;
  onDisenchant = a.disenchant;
}

export function openCraft(id: string) {
  altarOpen = id === "altar";
  if (altarOpen) {
    closeDialog(); closeShop(); closeBounties(); closeGuild(); closeChest(); closeInfo();
    station = null;
    document.body.classList.add("craft-open");
    openPanel("inventory");
    renderCraft();
    return;
  }
  if (!(id in STATION_SKILL)) return;
  closeDialog();
  closeShop();
  closeBounties();
  closeGuild();
  closeChest();
  closeInfo();
  station = id as Station;
  document.body.classList.add("craft-open");
  openPanel("inventory");
  renderCraft();
}

export function closeCraft() {
  station = null;
  altarOpen = false;
  document.body.classList.remove("craft-open");
}

/** The enchanting altar: pick an item, a soul gem, and (for a staff) a gem and inlay, or (otherwise) an effect. */
function renderAltar() {
  const level = levelForXp(lastSkillXp.enchanting ?? 0);
  craftTitle.textContent = `Enchanting altar · Enchanting level ${level}`;
  craftBody.replaceChildren();
  if (!isUnlocked(lastDisciplines.unlocked, "enchanting")) {
    craftBody.append(el("craft-warn", `You haven't learned Enchanting yet. ${teachNote("enchanting")}`));
    return;
  }
  const entries = invItems.map((it, i) => ({ it, i })).filter((x) => x.it && !locked[x.i]);
  const items = entries.filter((x) => enchantKind(x.it));
  const souls = entries.filter((x) => isSoulGem(x.it) && (parseGem(x.it) as { souls: number }).souls > 0);
  // Keep picks valid as the bag changes.
  if (altarPick.item != null && !enchantKind(invItems[altarPick.item])) altarPick.item = null;
  if (altarPick.soul != null && !souls.some((x) => x.i === altarPick.soul)) altarPick.soul = null;
  if (altarPick.item == null && items[0]) altarPick.item = items[0].i;
  if (altarPick.soul == null && souls[0]) altarPick.soul = souls[0].i;
  const row = (label: string, list: { i: number; it: ItemId | null }[], current: number | null, choose: (i: number) => void, empty: string) => {
    const wrap = el("pick-row");
    wrap.append(el("pick-label", label));
    if (!list.length) wrap.append(el("craft-info", empty));
    for (const { i, it } of list) {
      const d = ITEMS[it!];
      const b = document.createElement("button");
      b.className = "pick" + (i === current ? " active" : "");
      b.append(icon("pick-icon", d.icon, d.tint), el("pick-name", d.short ?? d.name));
      b.title = d.name;
      b.onclick = () => { choose(i); renderCraft(); };
      wrap.appendChild(b);
    }
    craftBody.appendChild(wrap);
  };
  row("Item", items, altarPick.item, (i) => { altarPick.item = i; altarPick.effect = null; }, "Put a staff, a piece of armor or a tool in your bag (take it off first).");
  const item = altarPick.item != null ? invItems[altarPick.item] : null;
  if (!item) return;
  const kind = enchantKind(item)!;
  const current = enchantsOf(item);
  for (const e of current) craftBody.append(el("craft-info", `On it now: ${describeEnchant(e)}`));
  if (current.length) {
    const off = document.createElement("button");
    off.className = "shop-btn";
    off.textContent = "Take the enchantment off (it's lost)";
    off.onclick = () => onDisenchant(altarPick.item!);
    craftBody.appendChild(off);
  }
  const slots = 1 + treeBonus(treeRanks(), "enchanting", "enchantSlot");
  if (isSpent(item) && !current.length && !treeBonus(treeRanks(), "enchanting", "reenchant")) {
    craftBody.append(el("craft-warn", "This one had an enchantment taken off, so it won't take another. Re-enchant in the Enchanting tree lets you."));
    return;
  }
  if (current.length >= slots) {
    craftBody.append(el("craft-warn", slots === 1 ? "One enchantment per item. Take it off first, or learn Second slot in the Enchanting tree." : "It can't hold any more enchantments."));
    return;
  }
  row("Soul gem", souls, altarPick.soul, (i) => { altarPick.soul = i; }, "No soul gem with souls in it. Cast 👻 Soul trap on a monster, then defeat it.");
  let effect: EnchantId | null = null;
  let gemSize = 0;
  if (kind === "staff") {
    const gems = entries.filter((x) => parseGem(x.it)?.kind === "cut");
    if (altarPick.gem != null && !gems.some((x) => x.i === altarPick.gem)) altarPick.gem = null;
    if (altarPick.gem == null && gems[0]) altarPick.gem = gems[0].i;
    row("Gem", gems, altarPick.gem, (i) => { altarPick.gem = i; }, "A staff needs a cut gem too (cut one at Brann's anvil).");
    const inlays = (Object.keys(INLAYS) as Inlay[]).filter((k) => k === "none" || invItems.some((it, i) => it === k && !locked[i]));
    if (!inlays.includes(altarPick.inlay)) altarPick.inlay = "none";
    craftBody.append(choices("Inlay", inlays, altarPick.inlay, (k) => ({ icon: k === "none" ? "⭕" : "🧈", tint: k === "none" ? undefined : ITEMS[k as ItemId].tint,
      name: k === "none" ? "None (2 ct)" : `${ITEMS[k as ItemId].name.replace(/ bar$/, "")} (${INLAYS[k] / 10} ct)` }), (k) => { altarPick.inlay = k; }));
    const g = altarPick.gem != null ? parseGem(invItems[altarPick.gem]) : null;
    if (g?.kind === "cut") {
      effect = enchantForGem(g.gem);
      gemSize = cappedGem(g.size, altarPick.inlay);
      if (g.size > gemSize) craftBody.append(el("craft-info", `The staff only uses ${gemSize / 10} ct of this ${g.size / 10} ct gem. A silver or gold inlay raises that.`));
    }
  } else {
    const options = ENCHANT_IDS.filter((e) => fits(item, e) && !current.some((c) => c.id === e));
    if (!altarPick.effect || !options.includes(altarPick.effect)) altarPick.effect = options[0] ?? null;
    craftBody.append(choices("Magic", options, altarPick.effect ?? options[0], (e) => ({ icon: ENCHANTS[e].icon, name: ENCHANTS[e].name }), (e) => { altarPick.effect = e; }));
    effect = altarPick.effect;
  }
  const soulGem = altarPick.soul != null ? parseGem(invItems[altarPick.soul]) : null;
  if (!effect || soulGem?.kind !== "soulgem") return;
  const power = soulPower(soulGem.souls, level, treeBonus(treeRanks(), "enchanting", "potency"));
  const detail = el("craft-detail");
  detail.append(el("craft-info", `Gives: ${describeEnchant({ id: effect, power, gem: gemSize })}`),
    el("craft-info", `Uses up the soul gem${kind === "staff" ? ", the gem" + (altarPick.inlay !== "none" ? " and the inlay bar" : "") : ""}. A fuller, bigger soul gem makes it stronger.`));
  const go = document.createElement("button");
  go.className = "shop-btn";
  go.textContent = "✨ Enchant";
  go.onclick = () => onEnchant({ slot: altarPick.item!, soul: altarPick.soul!, effect: kind === "staff" ? undefined : effect!, gem: kind === "staff" ? altarPick.gem! : undefined, inlay: altarPick.inlay });
  detail.appendChild(go);
  craftBody.appendChild(detail);
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
  if (!altarOpen && !station) return;
  craftOne.style.display = craftAll.style.display = altarOpen ? "none" : "";
  if (altarOpen) return renderAltar();
  if (!station) return;
  const skill: CraftSkill = STATION_SKILL[station];
  const level = levelForXp(lastSkillXp[skill] ?? 0);
  craftTitle.textContent = `${{ furnace: "Furnace", anvil: "Anvil", stove: "Stove", workbench: "Workbench", alchemy_table: "Alchemy table" }[station]} · ${findSkill(skill).def.name} level ${level}`;
  craftBody.replaceChildren();
  const lockedAt = (m: Material) => (level < MATERIALS[m].level ? MATERIALS[m].level : undefined);
  const { def: skillDef } = findSkill(skill);
  if (!isUnlocked(lastDisciplines.unlocked, skill)) {
    craftBody.append(el("craft-warn", `You haven't learned ${skillDef.name} yet. ${teachNote(skill)}`));
    craftOne.disabled = true;
    craftAll.disabled = true;
    return;
  }

  let output: ItemId;
  if (station === "stove") {
    const meal = renderStove(level);
    if (!meal) {
      craftOne.disabled = true;
      craftAll.disabled = true;
      craftAll.textContent = "Make all";
      return;
    }
    output = meal;
  } else if (station === "alchemy_table") {
    const potion = renderAlchemy(level);
    if (!potion) {
      craftOne.disabled = true;
      craftAll.disabled = true;
      craftAll.textContent = "Make all";
      return;
    }
    output = potion;
  } else if (station === "workbench") {
    craftBody.append(choices("Make", BAIT_IDS, pick.bait, (b) => ({ icon: BAITS[b].icon, tint: BAITS[b].tint, name: BAITS[b].name, lockedAt: level < BAITS[b].level ? BAITS[b].level : undefined }), (b) => { pick.bait = b; }));
    craftBody.append(el("craft-info", BAITS[pick.bait].description + ". Fishing uses the first unlocked bait in your bag."));
    output = pick.bait;
  } else if (station === "furnace") {
    const bars: ItemId[] = [...METAL_IDS.map((m) => barId(m) as ItemId), ...JEWEL_BAR_IDS];
    craftBody.append(choices("Bar", bars, pick.furnaceBar, (b) => ({ icon: "🧈", tint: ITEMS[b].tint, name: ITEMS[b].name.replace(/ bar$/, ""),
      lockedAt: level < recipeFor(b)!.level ? recipeFor(b)!.level : undefined }), (b) => { pick.furnaceBar = b; }));
    output = pick.furnaceBar;
  } else {
    const CATS = { tools: { icon: "🪓", name: "Tools" }, weapons: { icon: "🗡️", name: "Weapons" }, armor: { icon: "🛡️", name: "Armor" }, jewelry: { icon: "💍", name: "Jewelry" }, gems: { icon: "💎", name: "Cut gems" } };
    craftBody.append(choices("Make", ["tools", "weapons", "armor", "jewelry", "gems"] as ("tools" | "weapons" | "armor" | "jewelry" | "gems")[], pick.category, (c) => CATS[c], (c) => { pick.category = c; }));
    const head = () => choices("Head", MATERIAL_IDS, pick.metal, (m) => ({ icon: m === "stone" ? "🪨" : "🧈", tint: MATERIALS[m].tint, name: MATERIALS[m].name, lockedAt: lockedAt(m) }), (m) => { pick.metal = m; });
    const handle = () => choices("Handle", WOOD_IDS, pick.wood, (w) => ({ icon: "🪵", tint: ITEMS[`${w}_logs`].tint, name: WOODS[w].name }), (w) => { pick.wood = w; });
    if (pick.category === "gems") {
      renderCutting(level);
      craftOne.disabled = true;
      craftAll.disabled = true;
      craftAll.textContent = "Make all";
      return;
    }
    if (pick.category === "jewelry") {
      craftBody.append(
        choices("Make", ["ring", "amulet"] as JewelType[], pick.jewel, (t) => ({ icon: JEWEL_TYPES[t].icon, name: `${JEWEL_TYPES[t].name} (${JEWEL_TYPES[t].bars} bar${JEWEL_TYPES[t].bars > 1 ? "s" : ""})` }), (t) => { pick.jewel = t; }),
        choices("Metal", JEWEL_METAL_IDS, pick.jewelMetal, (m) => ({ icon: "🧈", tint: JEWEL_METALS[m].tint, name: JEWEL_METALS[m].name, lockedAt: level < JEWEL_METALS[m].level ? JEWEL_METALS[m].level : undefined }), (m) => { pick.jewelMetal = m; }),
      );
      // A cut gem from your bag to set in it (or none).
      const gems = [...new Set(invItems.filter((it, i): it is ItemId => !!it && !locked[i] && isCutGem(it)))];
      if (pick.jewelGem && !gems.includes(pick.jewelGem)) pick.jewelGem = null;
      const opts = ["none", ...gems] as string[];
      craftBody.append(choices("Gem to set in it", opts, pick.jewelGem ?? "none", (g) => g === "none" ? { icon: "⭕", name: "No gem" } : { icon: ITEMS[g as ItemId].icon, tint: ITEMS[g as ItemId].tint, name: ITEMS[g as ItemId].name }, (g) => { pick.jewelGem = g === "none" ? null : g as ItemId; }));
      if (!gems.length) craftBody.append(el("craft-info", "No cut gems in your bag. Mine gems in the crystal cave (through the spider cave by the quarry), then cut them here under Cut gems."));
      output = jewelId(pick.jewel, pick.jewelMetal, pick.jewelGem as never);
      craftBody.append(el("craft-info", `Gives: ${describeBonus(jewelBonus(output as never))}. A failed try loses the bars but keeps the gem.`));
    } else if (pick.category === "weapons") {
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
  // A hidden potion you haven't found yet stays a mystery until you brew it.
  const brew = parsePotion(output);
  const secret = !!brew && !!POTIONS[brew.type].hidden && !discovered.includes(brew.type);
  head.append(icon("craft-icon", secret ? "❓" : item.icon, secret ? undefined : item.tint), el("craft-name", secret ? "Unknown potion" : item.name));
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

  const chance = chanceFor(recipe);
  const tool = toolForSkill(skill);
  const m = masteryIn(lastMastery, recipe.mastery);
  const steady = tree(skill, "success");
  detail.append(el("craft-chance", `${percent(chance)} success`),
    el("craft-info", `Mastery ${m}` + (!tool ? " · no tool needed" : lastBelt[tool] ? ` · ${ITEMS[lastBelt[tool]!.item].name} on your belt`
      : recipe.needsTool ? ` · no ${TOOL_TYPES[tool].name.toLowerCase()} on your belt (half chance)` : ` · no ${TOOL_TYPES[tool].name.toLowerCase()} needed`) +
      (steady ? ` · skill tree: ${Math.round(steady * 100)}% fewer failures` : "")));
  const facts = secret ? [`costs ${STAMINA_COST[skill]} stamina`] : [`Sells for ${formatMoney(sellPrice(output))}`, `${recipe.xp} XP`, `costs ${STAMINA_COST[skill]} stamina`];
  if (isTool(output)) facts.unshift(`${toolEffect(output)}, ${maxDurability(output)} uses`);
  if (isGear(output)) {
    const needs = gearNeeds(output)!;
    facts.unshift(`${gearEffect(output)}, ${gearDurability(output)} uses, to use: ${findSkill(needs.skill).def.name} ${needs.level}`);
  }
  if (isMeal(output)) facts.unshift(`Gives ${staminaOf(output)} stamina`);
  if (isBait(output)) facts.unshift(`Lasts ${BAITS[output].uses} catches`);
  if (isPotion(output) && !secret) facts.unshift(describeEffect(potionEffect(output, level)) + " (stronger as your Alchemy goes up)");
  detail.append(el("craft-info", facts.join(" · ")));
  if (level < recipe.level) detail.append(el("craft-warn", `Needs ${findSkill(skill).def.name} level ${recipe.level}.`));
  else if (!canMake) detail.append(el("craft-warn", station === "stove" ? "You don't have all of that (and the log) unlocked in your bag." : station === "alchemy_table" ? "You need an empty vial for each potion. Alchemist Moss sells them." : station === "workbench" ? "You don't have the materials. Worms turn up while chopping and mining (or Rook and Tam sell them); cooking leaves food scraps." : "You don't have the materials. Miner Greta sells ore and stone, Smith Brann sells bars, and Forester Holt sells logs."));
  else detail.append(el("craft-info", `You have enough for ${canMake}. ${station === "alchemy_table" ? "A spoiled brew loses the ingredients, but you keep the vial." : "A failed try loses the materials."}`));
  craftBody.appendChild(detail);

  const ok = level >= recipe.level && canMake > 0;
  craftOne.disabled = !ok;
  craftAll.disabled = !ok;
  craftAll.textContent = ok && canMake > 1 ? `Make all (${canMake})` : "Make all";
  craftOne.onclick = () => onCraft(output, false);
  craftAll.onclick = () => onCraft(output, true);
}

/**
 * The stove: pick a dish, tap ingredients from your bag to put them in the
 * pot (ones the dish can't use are grayed out), and pick a log to burn.
 * Returns the meal that would be cooked, or null while the pot is empty.
 */
function renderStove(level: number): ItemId | null {
  if (DISHES[pick.dish].level > level) pick.dish = "stew";
  const dish = DISHES[pick.dish];
  const slots = potSize();
  // Drop anything this dish can't take, or that's no longer in your bag, or past the pot's size.
  pick.pot = pick.pot.filter((i) => fitsDish(pick.dish, i)).slice(0, slots);
  const inPot = (i: IngredientId) => pick.pot.filter((x) => x === i).length;
  pick.pot = pick.pot.filter((i, n) => pick.pot.slice(0, n + 1).filter((x) => x === i).length <= haveUnlocked(i));

  craftBody.append(choices("Dish", DISH_IDS, pick.dish, (d) => ({ icon: DISHES[d].icon, name: DISHES[d].name, lockedAt: level < DISHES[d].level ? DISHES[d].level : undefined }), (d) => { pick.dish = d; }));
  const kinds = Object.entries(dish.kinds).map(([k, x]) => `${FOOD_KINDS[k as keyof typeof FOOD_KINDS].toLowerCase()} ×${x}`).join(", ");
  craftBody.append(el("craft-info", `${dish.note}. Stamina: ${kinds}, fire ×${dish.fire}.`));

  // The pot: what's in it (tap to take out), and empty spaces.
  const potRow = el("pick-row");
  potRow.append(el("pick-label", `In the pot (${pick.pot.length}/${slots}): tap to take out`));
  pick.pot.forEach((i, n) => {
    const b = document.createElement("button");
    b.className = "pick active";
    b.append(icon("pick-icon", ITEMS[i].icon, ITEMS[i].tint), el("pick-name", ITEMS[i].single));
    b.title = `Take the ${ITEMS[i].single} out`;
    b.onclick = () => { pick.pot.splice(n, 1); renderCraft(); };
    potRow.appendChild(b);
  });
  for (let n = pick.pot.length; n < slots; n++) {
    const b = document.createElement("button");
    b.className = "pick locked";
    b.disabled = true;
    b.append(icon("pick-icon", "·"), el("pick-name", "empty"));
    potRow.appendChild(b);
  }
  craftBody.append(potRow);

  // Everything in your bag: tap to add. Things this dish can't use are grayed out.
  const bagRow = el("pick-row");
  bagRow.append(el("pick-label", "Your bag: tap to add"));
  const seen = new Set<ItemId>();
  const mine = invItems.filter((it, i): it is ItemId => !!it && !locked[i] && !seen.has(it) && !!seen.add(it));
  mine.sort((a, b) => Number(isIngredient(b) && fitsDish(pick.dish, b)) - Number(isIngredient(a) && fitsDish(pick.dish, a)));
  for (const it of mine) {
    if (/_logs$/.test(it)) continue; // logs are fuel, picked below
    const b = document.createElement("button");
    const fits = fitsDish(pick.dish, it);
    const tooHard = fits && INGREDIENTS[it].level > level;
    const left = fits ? haveUnlocked(it) - inPot(it) : 0;
    const full = pick.pot.length >= slots;
    const usable = fits && !tooHard && left > 0 && !full;
    b.className = "pick" + (usable ? "" : " locked");
    const label = !isIngredient(it) ? "can't cook" : !fits ? `not in ${dish.name.toLowerCase()}` : tooHard ? `🔒${INGREDIENTS[it].level}` : `+${Math.round(ingredientStamina(pick.dish, it))} (${left})`;
    b.append(icon("pick-icon", ITEMS[it].icon, ITEMS[it].tint), el("pick-name", label));
    b.title = !isIngredient(it) ? `${ITEMS[it].name} can't be cooked.`
      : !fits ? `${dish.name} can't use ${FOOD_KINDS[INGREDIENTS[it as IngredientId].kind].toLowerCase()}.`
      : tooHard ? `You need Cooking level ${INGREDIENTS[it].level} to cook ${ITEMS[it].name.toLowerCase()}.`
      : full ? `The pot is full (${slots}). Spend Mastery points on "Bigger pot" in the Cooking skill tree for more room.`
      : `${ITEMS[it].name}: adds ${Math.round(ingredientStamina(pick.dish, it))} stamina to a ${dish.name.toLowerCase()}. ${left} left.`;
    b.disabled = !usable;
    if (usable) b.onclick = () => { pick.pot.push(it); renderCraft(); };
    bagRow.appendChild(b);
  }
  if (!mine.some((it) => fitsDish(pick.dish, it))) bagRow.append(el("craft-warn", `Nothing in your bag goes in a ${dish.name.toLowerCase()}. Catch fish, get raw chicken or beef from chickens and cows, or buy vegetables at the General Store.`));
  craftBody.append(bagRow);

  craftBody.append(choices("Log to burn (better wood, more stamina)", WOOD_IDS, pick.fuel,
    (w) => ({ icon: "🪵", tint: ITEMS[`${w}_logs`].tint, name: `${WOODS[w].name} +${fireStamina(pick.dish, w)}` }), (w) => { pick.fuel = w; }));

  if (!pick.pot.length) {
    craftBody.append(el("craft-detail", "Put at least one ingredient in the pot."));
    return null;
  }
  return mealId(pick.dish, pick.fuel, pick.pot);
}

/** The anvil's Cut gems tab: every rough gem and soul stone in your bag, with a Cut button, and your odds. */
function renderCutting(level: number) {
  const c = cutChances(level);
  craftBody.append(el("craft-info", `Your cuts at Smithing ${level}: ${percent(c.flawless)} flawless (keeps it all), ${percent(c.good)} good (85%), ${percent(c.clumsy)} clumsy (60%), ${percent(c.shattered)} shatter. Soul stone always cuts cleanly.`));
  const rough = [...new Set(invItems.filter((it, i): it is ItemId => !!it && !locked[i] && isRough(it)))];
  if (!rough.length) {
    craftBody.append(el("craft-warn", "No rough gems or soul stones in your bag. Mine them in the crystal cave, through the spider cave east of the quarry."));
    return;
  }
  const list = el("pick-row");
  list.append(el("pick-label", "Tap one to cut it"));
  for (const it of rough) {
    const g = parseGem(it)!;
    const need = CUT_LEVEL[g.kind === "soulstone" ? "soul" : (g as { gem: keyof typeof GEMS }).gem];
    const b = document.createElement("button");
    const lockedOut = level < need;
    b.className = "pick" + (lockedOut ? " locked" : "");
    b.append(icon("pick-icon", ITEMS[it].icon, ITEMS[it].tint), el("pick-name", lockedOut ? `🔒${need}` : `${ITEMS[it].name} (${haveUnlocked(it)})`));
    b.title = lockedOut ? `Needs Smithing level ${need} to cut.` : `Cut the ${ITEMS[it].single}.`;
    b.disabled = lockedOut;
    if (!lockedOut) b.onclick = () => onCut(it);
    list.appendChild(b);
  }
  craftBody.append(list);
}

/**
 * The alchemy table: the recipes you know (tap one to fill the mix), then your
 * bag (tap to add; things alchemy can't use are grayed out). Two ingredients
 * make a potion, a third adds a bonus. Returns the potion, or null.
 */
function renderAlchemy(level: number): ItemId | null {
  // Keep only what's still in your bag.
  pick.mix = pick.mix.filter((i, n) => pick.mix.slice(0, n + 1).filter((x) => x === i).length <= haveUnlocked(i)).slice(0, 3);
  const inMix = (i: ItemId) => pick.mix.filter((x) => x === i).length;

  // Recipes: the ones you know, and ??? for hidden ones you haven't found.
  const book = el("pick-row");
  book.append(el("pick-label", "Recipes (tap to use)"));
  for (const t of POTION_TYPES) {
    const d = POTIONS[t];
    const known = !d.hidden || discovered.includes(t);
    const b = document.createElement("button");
    const locked = level < d.level;
    b.className = "pick" + (locked || !known ? " locked" : "");
    b.append(icon("pick-icon", known ? d.icon : "❓", known ? d.tint : undefined), el("pick-name", !known ? "hidden" : locked ? `🔒${d.level}` : d.name.replace(/ potion$/, "")));
    b.title = !known ? "A hidden recipe. Mix things at the table to find it."
      : `${d.name}: ${ITEMS[d.pair[0]].single} + ${ITEMS[d.pair[1]].single}. ${d.description}. Alchemy level ${d.level}.`;
    if (known) b.onclick = () => { pick.mix = [...d.pair]; renderCraft(); };
    book.appendChild(b);
  }
  craftBody.append(book);

  // The mix: what's in it (tap to take out).
  const mixRow = el("pick-row");
  mixRow.append(el("pick-label", `In the mix (${pick.mix.length}/3): tap to take out`));
  pick.mix.forEach((i, n) => {
    const b = document.createElement("button");
    b.className = "pick active";
    b.append(icon("pick-icon", ITEMS[i].icon, ITEMS[i].tint), el("pick-name", ITEMS[i].single));
    b.onclick = () => { pick.mix.splice(n, 1); renderCraft(); };
    mixRow.appendChild(b);
  });
  for (let n = pick.mix.length; n < 3; n++) {
    const b = document.createElement("button");
    b.className = "pick locked";
    b.disabled = true;
    b.append(icon("pick-icon", "·"), el("pick-name", n === 2 ? "bonus" : "empty"));
    mixRow.appendChild(b);
  }
  craftBody.append(mixRow);

  // Your bag: tap to add. A third ingredient has to be a bonus one.
  const bagRow = el("pick-row");
  bagRow.append(el("pick-label", "Your bag: tap to add"));
  const seen = new Set<ItemId>();
  const mine = invItems.filter((it, i): it is ItemId => !!it && !locked[i] && !seen.has(it) && !!seen.add(it) && it !== "vial" && !isPotion(it) && it !== POTION_ID);
  mine.sort((a, b) => Number(ALCHEMY_INGREDIENTS.has(b)) - Number(ALCHEMY_INGREDIENTS.has(a)));
  for (const it of mine) {
    const usable = ALCHEMY_INGREDIENTS.has(it);
    const left = haveUnlocked(it) - inMix(it);
    const asBonus = pick.mix.length === 2;
    const ok = usable && left > 0 && pick.mix.length < 3 && (!asBonus || (BONUS_IDS as string[]).includes(it));
    const b = document.createElement("button");
    b.className = "pick" + (ok ? "" : " locked");
    b.append(icon("pick-icon", ITEMS[it].icon, ITEMS[it].tint), el("pick-name", !usable ? "no use" : asBonus && !(BONUS_IDS as string[]).includes(it) ? "not a bonus" : `${ITEMS[it].single} (${left})`));
    const bonus = BONUSES[it as BonusId];
    b.title = !usable ? `${ITEMS[it].name} can't be used in alchemy.` : bonus ? `${ITEMS[it].name}. As a third ingredient: ${bonus.note}.` : `${ITEMS[it].name}.`;
    b.disabled = !ok;
    if (ok) b.onclick = () => { pick.mix.push(it); renderCraft(); };
    bagRow.appendChild(b);
  }
  if (!mine.some((it) => ALCHEMY_INGREDIENTS.has(it))) bagRow.append(el("craft-warn", "Nothing in your bag goes in a potion. Dig up herbs with Foraging (Herbalist Wren), and get slime goo, bat wings and fangs from monsters."));
  craftBody.append(bagRow);

  if (pick.mix.length < 2) {
    craftBody.append(el("craft-detail", "Put two ingredients in the mix (and a third for a bonus). Each potion also uses an empty vial."));
    return null;
  }
  const potion = potionFrom(pick.mix);
  const known = potion && (!POTIONS[parsePotion(potion)!.type].hidden || discovered.includes(parsePotion(potion)!.type));
  if (!potion) {
    craftBody.append(el("craft-warn", "Those don't make anything. Try a different mix."));
    return null;
  }
  if (!known) {
    // A hidden recipe: you can brew it, but you won't know what it is until you do.
    craftBody.append(el("craft-info", "✨ Something stirs in the mix... you don't know this one. Brew it and see!"));
  }
  return potion;
}

document.getElementById("craft-close")!.onclick = closeCraft;

// ---- Bounty board: 5 jobs, hand in the full amount for double a shop's price plus XP ----

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
      el("bounty-reward", `Reward: ${formatMoney(reward.coins)} · +${reward.xp} ${reward.label} XP · +${reward.renown} Renown XP`));
    bountyList.appendChild(row);
  });
}

document.getElementById("bounty-refresh")!.onclick = () => onRefreshBounties();
document.getElementById("bounty-close")!.onclick = closeBounties;

// ---- The Mages' Guild: rank, renting the enchanted chest, and magic bounties (rules in shared/guild.ts) ----

const guildBody = document.getElementById("guild-body")!;
let guild: GuildView | null = null;
let onBuySpace: () => void = () => {};
let onDeposit: (slot: number, count?: number) => void = () => {};
let onWithdraw: (slot: number, count?: number) => void = () => {};
let onGuildHandIn: (index: number) => void = () => {};
let onRefreshGuild: () => void = () => {};
const guildIsOpen = () => document.body.classList.contains("guild-open");
const chestIsOpen = () => document.body.classList.contains("chest-open");

export function setGuildActions(actions: {
  buySpace: () => void; deposit: (slot: number, count?: number) => void; withdraw: (slot: number, count?: number) => void;
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
    el("bounty-reward", `Reward: +${reward.points} guild point${reward.points === 1 ? "" : "s"} · ${formatMoney(reward.coins)} · +${reward.magicXp} Spellcasting XP`));
  return row;
}

document.getElementById("guild-refresh")!.onclick = () => onRefreshGuild();
document.getElementById("guild-close")!.onclick = closeGuild;

// ---- Enchanted chest window: tap a stack in your bag to put it in, tap one here to take it out ----

const chestSlotsEl = document.getElementById("chest-slots")!;
const chestTitle = document.getElementById("chest-title")!;
let chest: Bag = emptyBag(0);

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
    renderInventory();
  }
  renderChest();
}

export function closeChest() {
  if (!chestIsOpen()) return;
  document.body.classList.remove("chest-open");
  closeAmount();
  renderInventory();
}

function renderChest() {
  if (!chestIsOpen()) return;
  chestTitle.textContent = `📦 Enchanted chest (${usedSlots(chest)}/${chest.slotCount})`;
  chestSlotsEl.replaceChildren();
  for (let i = 0; i < chest.slotCount; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";
    const here = entriesIn(chest, i);
    if (here.length) {
      const top = here[0];
      const id = chest.inventory[top]!;
      const item = ITEMS[id];
      const n = slotTotal(chest, i);
      slot.classList.add("filled");
      if (here.length > 1) slot.classList.add("mixed");
      slot.appendChild(icon("item-icon", item.icon, item.tint));
      if (isTool(id)) slot.appendChild(durabilityBar(chest.durability[top] ?? maxDurability(id), maxDurability(id)));
      if (isGear(id)) slot.appendChild(durabilityBar(chest.durability[top] ?? gearDurability(id), gearDurability(id)));
      if (n > 1) slot.appendChild(countBadge(n));
      slot.title = `Take out ${here.length > 1 ? `all ${n} (${here.length} kinds)` : n > 1 ? `${n} ${item.name.toLowerCase()}` : item.single}`;
      slot.onclick = () => {
        if (here.length === 1 && n > 1) return askAmount({ title: `Take out ${item.name.toLowerCase()}`, glyph: item.icon, tint: item.tint, max: n, start: n, verb: "Take out", ok: (k) => onWithdraw(top, k) });
        for (const e of here) onWithdraw(e);
      };
    }
    chestSlotsEl.appendChild(slot);
  }
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
  let entry = -1; // the bag entry being shown
  let here: number[] = []; // everything in that bag slot
  if (target.kind === "slot") {
    here = entriesIn(bag, target.slot);
    target.pick = Math.max(0, Math.min(target.pick, here.length - 1));
    entry = here[target.pick] ?? -1;
    id = invItems[entry] ?? null;
    uses = durability[entry] ?? null;
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
  const isLocked = entry >= 0 && !!locked[entry];
  infoBody.replaceChildren();
  infoButtons.replaceChildren();
  // Several kinds in this slot (a stone axe and a bronze axe, or stews of different recipes): flip through them.
  if (here.length > 1 && target.kind === "slot") {
    const nav = el("info-nav");
    const flip = (d: number) => { target.pick = (target.pick + d + here.length) % here.length; renderInfo(); };
    const prev = document.createElement("button");
    prev.className = "shop-btn info-flip";
    prev.textContent = "◀";
    prev.title = "Previous one";
    prev.onclick = () => flip(-1);
    const next = document.createElement("button");
    next.className = "shop-btn info-flip";
    next.textContent = "▶";
    next.title = "Next one";
    next.onclick = () => flip(1);
    nav.append(prev, el("info-nav-text", `${target.pick + 1} of ${here.length} in this slot`), next);
    infoBody.appendChild(nav);
  }
  const head = el("craft-head");
  head.append(icon("craft-icon", item.icon, item.tint), el("craft-name", shortName(id) + (isLocked ? " 🔒" : "")));
  infoBody.appendChild(head);
  const stack = entry >= 0 ? countAt(entry) : 1;
  if (target.kind === "slot") {
    const total = slotTotal(bag, target.slot);
    if (here.length > 1) infoBody.append(infoLine("In this slot", `${total} of ${stackLimit(id)}`, stack > 1 ? `${stack} of this one` : "similar things share a slot"));
    else if (stackLimit(id) > 1) infoBody.append(infoLine("In this stack", `${stack} of ${stackLimit(id)}`, "a full stack takes one bag slot"));
  }
  // Tools: what the head and handle are made of.
  if (isTool(id)) {
    const { metal, wood } = parseTool(id);
    if (metal) infoBody.append(infoLine(hasHandle(parseTool(id).type) ? "Head" : "Made of", MATERIALS[metal].name));
    if (wood) infoBody.append(infoLine(metal ? "Handle" : "Wood", WOODS[wood].name));
  }

  // Value: base price, your Mastery multiplier, and what shops pay and charge.
  const mid = masteryIdFor(id);
  const m = masteryIn(lastMastery, mid);
  infoBody.append(infoLine("Weight", kg(weightOf(id)) + (stack > 1 ? ` each, ${kg(weightOf(id) * stack)} for the stack` : ""),
    target.kind === "slot" ? "" : "tools and gear you wear still count"));
  infoBody.append(infoLine("Base value", formatMoney(item.sellPrice), item.inputs ? "its materials + 25%" : ""));
  infoBody.append(infoLine("Mastery", `${masteryName(mid)} ${m}`, `×${masteryValue(m).toFixed(2)} value`));
  if (item.inputs) {
    const counts = new Map<ItemId, number>();
    for (const i of item.inputs) counts.set(i, (counts.get(i) ?? 0) + 1);
    const parts = [...counts].map(([i, n]) => `${n} ${n === 1 ? ITEMS[i].single : ITEMS[i].name.toLowerCase()} (${formatMoney(sellPrice(i))} each)`).join(" + ");
    infoBody.append(infoLine("Made from", parts, `×${CRAFT_MARKUP}, then your Mastery`));
  }
  const price = sellPrice(id, uses);
  const buyers = SHOP_IDS.filter((s) => s !== "tam" && SHOPS[s].buys(id)).map((s) => npcById(s)!.name);
  for (const e of enchantsOf(id)) infoBody.append(infoLine("Enchanted", describeEnchant(e)));
  if (isSpellBook(id)) {
    const sp = SPELLS[SPELL_BOOKS[id]];
    infoBody.append(infoLine("Read it", `learn ${sp.icon} ${sp.name}`, `needs Spellcasting ${sp.level}. ${sp.description}`));
  }
  if (isSoulGem(id)) {
    const g = parseGem(id) as { size: number; souls: number };
    infoBody.append(infoLine("Souls", `${g.souls} / ${soulCapacity(g.size)} (${Math.floor((soulFill(id) ?? 0) * 100)}%)`,
      "Cast 👻 Soul trap on a monster, then defeat it in time: its soul fills your best soul gem. Full gems power enchantments."));
  }
  if (isJewelry(id)) infoBody.append(infoLine("Wear it", describeBonus(jewelBonus(id)), "2 rings and 1 amulet at a time"));
  else if (isRough(id)) infoBody.append(infoLine("Cut it", "at the anvil", "under Cut gems (Smithing). A cut can go well or badly."));
  else if (isCutGem(id)) infoBody.append(infoLine("Set it", "in a ring or amulet", `at the anvil: ${describeBonus(jewelBonus(jewelId("ring", "bronze", id)))} in a bronze ring, more in finer metals`));
  infoBody.append(infoLine("Shops pay", formatMoney(price), (isTool(id) && uses != null && uses < maxDurability(id) ? "less because it's worn. " : "") +
    `Tam at the General Store${buyers.length ? `, ${buyers.join(", ")}` : ""}`));
  const sellers = sellersOf(id);
  if (sellers.length) infoBody.append(infoLine("Shops sell", formatMoney(buyPrice(id)), sellers.map((s) => npcById(s)!.name).join(", ")));

  // Where it comes from.
  const res = RESOURCE_FOR_ITEM[id];
  const recipe = recipeFor(id);
  if (res) {
    const r = RESOURCES[res];
    infoBody.append(infoLine("Gathered", `${findSkill(r.skill).def.name} level ${r.level}`, `${r.xp} XP each`));
  } else if (forageFindOf(id)) {
    const f = forageFindOf(id)!;
    infoBody.append(infoLine("Dug up", `Foraging level ${f.level}`, `from glinting dig patches, ${f.xp} XP${f.night ? ", only at night" : ""}`));
  } else if (recipe) {
    infoBody.append(infoLine("Made with", `${findSkill(recipe.skill).def.name} level ${recipe.level}`,
      `${percent(chanceFor(recipe))} success for you · ${recipe.xp} XP`));
  }

  // Food: how much stamina it gives (meals: what goes into that).
  const meal = parseMeal(id);
  if (meal) {
    const d = DISHES[meal.dish];
    const parts = meal.ingredients.map((i) => `${ITEMS[i].single} ${Math.round(ingredientStamina(meal.dish, i))}`).join(" + ");
    const hearty = tree("cooking", "mealStamina");
    infoBody.append(infoLine("Stamina", `+${staminaOf(id)}`,
      `${parts} + ${WOODS[meal.wood].name.toLowerCase()} fire ${fireStamina(meal.dish, meal.wood)} = ${mealBaseStamina(id as never)}, ×${(masteryValue(masteryIn(lastMastery, meal.dish)) + hearty).toFixed(2)} ${d.name} Mastery${hearty ? " and Hearty meals" : ""}`));
  } else if (isFood(id)) {
    infoBody.append(infoLine("Stamina", `+${staminaOf(id)}`, "raw; cook it at the stove for 3 to 4.5 times as much"));
  }
  // Cooking ingredients: which dishes take it, and where it comes from.
  if (isIngredient(id)) {
    const ing = INGREDIENTS[id];
    const goes = DISH_IDS.filter((d) => fitsDish(d, id)).map((d) => `${DISHES[d].name} +${Math.round(ingredientStamina(d, id))}`).join(", ");
    infoBody.append(infoLine("Cook it", goes, `${FOOD_KINDS[ing.kind]} · Cooking level ${ing.level}${RESOURCE_FOR_ITEM[id] ? "" : ` · ${ing.from}`}`));
  }
  // Bait: what it does and how many catches it has left.
  if (isBait(id)) {
    const b = BAITS[id];
    const left = uses ?? b.uses;
    infoBody.append(infoLine("Bait", b.description, "fishing uses the first unlocked bait in your bag; lock it to save it"));
    const row = infoLine("Catches left", `${left} of ${b.uses}`);
    row.appendChild(durabilityBar(left, b.uses));
    infoBody.append(row);
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
    const row = infoLine("Uses left", left <= 0 ? `Broken (0 of ${max})` : `${left} of ${max}`,
      left <= 0 ? "the Repairer at the Mages' Guild can fix it" : isWeapon(id) ? "each attack wears it down" : "each attack on you wears down one piece");
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
    const row = infoLine("Uses left", left <= 0 ? `Broken (0 of ${max})` : `${left} of ${max}`,
      left <= 0 ? "the Repairer at the Mages' Guild can fix it" : "harder trees, rocks, fish and recipes wear it faster");
    row.appendChild(bar);
    infoBody.append(row);
  }

  if (target.kind === "belt") {
    infoButton("Take off", () => { onUnequip(target.type); closeInfo(); });
  } else if (target.kind === "gear") {
    infoButton("Take off", () => { onRemove(target.slot); closeInfo(); });
  } else {
    // Buttons act on the one showing. With several kinds in the slot, the card stays open so you can pick another.
    const e = entry;
    const done = () => { if (here.length === 1) closeInfo(); };
    if (shopIsOpen() && !shopBuying && SHOPS[shopId].buys(id)) {
      const each = sellPrice(id, uses);
      infoButton(stack > 1 ? `Sell… (${formatMoney(each)} each)` : `Sell (${formatMoney(each)})`, () => {
        if (stack === 1) { onSell(e); done(); return; }
        askAmount({ title: `Sell ${ITEMS[id].name.toLowerCase()}`, glyph: ITEMS[id].icon, tint: ITEMS[id].tint, max: stack, start: stack, each, verb: "Sell", ok: (k) => { onSell(e, k); done(); } });
      }, isLocked);
    }
    const broken = isBroken(id, uses);
    if (isTool(id)) infoButton("Put on belt", () => { onEquip(e); closeInfo(); }, broken);
    if (isGear(id)) infoButton(isWeapon(id) ? "Hold" : "Wear", () => { onWear(e); closeInfo(); }, broken);
    if (id === POTION_ID) infoButton(`Drink (+${POTION_HEAL})`, () => { onDrink(e); closeInfo(); });
    if (isPotion(id)) infoButton("Drink", () => { onDrink(e); closeInfo(); });
    if (isJewelry(id)) infoButton("Put on", () => { onWearJewel(e); closeInfo(); });
    if (isSpellBook(id)) infoButton("Read", () => { onRead(e); closeInfo(); });
    if (isFood(id)) infoButton(`Eat (+${staminaOf(id)})`, () => { onEat(e); done(); }, staminaNow >= staminaMax);
    infoButton(isLocked ? "Unlock" : "Lock", () => onLock(e, !isLocked));
    infoButton(stack > 1 ? `Drop all ${stack}` : "Drop", () => { onDrop(e); done(); }, isLocked);
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
      `Stamina ${staminaNow} of ${staminaMax}. Chopping costs ${c.woodcutting}, mining ${c.mining}, digging ${c.foraging}, smelting ${c.smelting}, smithing ${c.smithing}, cooking ${c.cooking}, fishing ${c.fishing}, each weapon attack ${c.melee}. ` +
      "It comes back 1 every 30 seconds. Eat fish or a meal (click it in your bag) for more."),
    vitalRow("🔮", vitals.mana, vitals.maxMana, "#4a7bd9", `Mana ${vitals.mana} of ${vitals.maxMana}. Spells use it. It comes back 1 every 6 seconds.`),
  );
  // Potion buffs: an icon and the minutes (or seconds) left for each.
  const now = serverNow();
  const running = BUFF_IDS.filter((id) => (buffs[id]?.until ?? 0) > now);
  if (running.length) {
    const row = el("buff-row");
    for (const id of running) {
      const left = Math.ceil((buffs[id]!.until - now) / 1000);
      const chip = el("buff", `${BUFFS[id].icon} ${left >= 60 ? `${Math.ceil(left / 60)}m` : `${left}s`}`);
      chip.title = `${BUFFS[id].name}: ${BUFFS[id].describe(buffs[id]!.power)}. ${left >= 60 ? `About ${Math.ceil(left / 60)} minutes` : `${left} seconds`} left.`;
      row.appendChild(chip);
    }
    staminaEl.append(row);
  }
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

// ---- The quest tracker and the trainers' dialog ----

// ---- The quest tracker (next to your health) and the 📜 Quests tab ----
// The tracker shows one thing: the current lesson's step, or a bounty you picked in the Quests tab.

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
    questEl.append(el("q-title", q.done || !q.giver ? `📜 ${q.quest}` : `📜 ${q.quest} · ${q.giver}`), el("q-task", (q.talk ? "❗ " : "") + q.task));
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

/** The 📜 tab: the lessons (every trainer's chapter), then each bounty on the board. Tap one to track it. */
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
  const q = lastQuest;
  questListEl.append(el("qt-head", q ? `📜 Lessons (${q.number} of ${q.of} done)` : "📜 Lessons"));
  if (q) {
    // What you're on now (or "pick your next lesson"), then every chapter.
    questListEl.append(row("📜", undefined, q.giver ? `${q.quest} · ${q.giver}` : q.quest, q.task, q.progress ?? (q.done ? "" : "Tap to track"), !tb, () => onTrack(null)));
    const glyph: Record<ChapterView["state"], string> = { done: "✅", active: "📍", started: "⏸️", open: "❗", locked: "🔒" };
    for (const c of q.chapters) {
      const sub = c.state === "done" ? "Done" : c.state === "locked" ? `Opens after ${GUIDE_NAME}'s lessons` : c.task ? `${c.task} (step ${c.step + 1} of ${c.of})` : `Talk to ${c.name}, ${c.where}`;
      const r = el("qt-row qt-chapter" + (c.state === "done" ? " done" : ""));
      r.append(el("qt-icon", glyph[c.state]), el("qt-title", `${c.title} · ${c.name}`), el("qt-sub", sub));
      questListEl.append(r);
    }
  }
  questListEl.append(el("qt-head", "📋 Bounties"));
  if (!bounties.length) {
    questListEl.append(el("qt-note", "Captain Bryn opens the bounty board for you in one of the lessons."));
    return;
  }
  bounties.forEach((b, i) => {
    const item = ITEMS[b.item];
    const have = bountyHave(b);
    const reward = bountyReward(b, lastMastery);
    questListEl.append(row(item.icon, item.tint, `${b.count} × ${item.name}`, `${formatMoney(reward.coins)} · +${reward.xp} ${reward.label} XP · +${reward.renown} Renown`,
      have >= b.count ? "✓ Ready to hand in" : `You have ${have} / ${b.count}`, tb === b, () => onTrack(i)));
  });
  questListEl.append(el("qt-note", "Hand bounties in at the board in the town square, next to Captain Bryn."));
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
  closeRepair();
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
  closeRepair();
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
