// Shared bits for every window: the side panel tabs, prices, icons, and what the server last told us about your skills.
// (Part of the game's windows: client/src/ui.ts loads every file in client/src/ui/.)
import { ItemId, ITEMS } from "../../../shared/items";
import { sellWithCharisma, buyWithCharisma, maxHealth, maxStamina, maxMana, walkBonus } from "../../../shared/stats";
import { sellPriceFor, buyPriceFor, TANNING_IDS, recipeFor, successFor } from "../../../shared/crafting";
import { isUnlocked, levelForXp, SkillId, DisciplineId } from "../../../shared/disciplines";
import { RenownView } from "../../../shared/renown";
import { teacherOf, GUIDE_NAME } from "../../../shared/quests";
import { kg, carryCapacity } from "../../../shared/weight";
import { EnchantId, Inlay } from "../../../shared/enchanting";
import { SpellId, BoltSpellId } from "../../../shared/combat";
import { Metal, ToolType, Wood, Material } from "../../../shared/tools";
import { DishId, IngredientId, foodStamina, BASE_INGREDIENTS } from "../../../shared/cooking";
import { BaitId } from "../../../shared/handicraft";
import { WeaponType, ArmorType, GearSlot } from "../../../shared/gear";
import { JewelType, JewelMetal, JewelSlot, Jewels, emptyJewels, JEWEL_SLOTS, describeBonus, jewelBonus } from "../../../shared/jewelry";
import { PotionType, Buffs, buffPower } from "../../../shared/alchemy";
import { treeBonus } from "../../../shared/skilltree";
import { treeRanks } from "../tree";
import { toolSvg } from "../toolIcons";
import { ICON_INDEX, ICON_SHEET } from "../itemIconIndex";
import { iconKey } from "../../../shared/iconKey";
import { lastMastery, lastDisciplines, lastSkillXp } from "./skills";
import { lastBelt } from "./bag";
import { shopId, renderShop } from "./shop";
import { renderCraft } from "./craft";
import { renderVitalBars } from "./vitals";
import { renderQuestTab } from "./quests";

export const slotsEl = document.getElementById("slots")!;

export const hoverEl = document.getElementById("hover")!;

export const bagCountEl = document.getElementById("bag-count")!;

export const skillListEl = document.getElementById("skill-list")!;

// ---- Side panel tabs (Skills / Inventory): one open at a time, tap again to close ----

type Panel = "inventory" | "skills" | "quests" | "";

export const isSmallScreen = () => matchMedia("(max-width: 640px), (max-height: 500px)").matches;

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

/** What a shop pays you for one, with your Mastery and Charisma. */
export const sellPrice = (id: ItemId, uses?: number | null) => sellWithCharisma(sellPriceFor(id, lastMastery, uses), lastDisciplines.levels.charisma, tradingLv());

/** What a shop charges you for one, with your Charisma and Trading. */
export const buyPrice = (id: ItemId) => buyWithCharisma(buyPriceFor(id), lastDisciplines.levels.charisma, tradingLv());

/** Your Trading and Renown levels (1 until taught). */
export function tradingLv() { return isUnlocked(lastDisciplines.unlocked, "trading") ? levelForXp(lastSkillXp.trading ?? 0) : 1; }

export function renownLv() { return isUnlocked(lastDisciplines.unlocked, "renown") ? levelForXp(lastSkillXp.renown ?? 0) : 1; }

// ---- Captain Bryn: Renown ranks and titles (shared/renown.ts) ----
export let renown: RenownView = { level: 1, rank: 0, title: "", titles: [] };

export let onTitle: (title: string) => void = () => {};

export function setRenownActions(a: { title: (title: string) => void }) { onTitle = a.title; }

export function setRenown(view: RenownView) {
  renown = view;
  if (document.body.classList.contains("shop-open") && shopId === "bryn") renderShop();
}

/** "Forester Holt teaches it, on Trainer Row (📜 Quests)." */
export function teachNote(skill: SkillId): string {
  const c = teacherOf(skill);
  if (!c) return "";
  return c.id === "maren" ? `${GUIDE_NAME} will teach you this in her lessons (📜 Quests).` : `${c.name} teaches it, ${c.where} (📜 Quests).`;
}

/** What each Discipline does for you right now: "Max health 60". */
export function disciplineStat(id: DisciplineId, level: number): string {
  switch (id) {
    case "strength": return `Max health ${maxHealth(level)}`;
    case "endurance": return `Max stamina ${maxStamina(level)}`;
    case "wisdom": return `Max mana ${maxMana(level)}`;
    case "dexterity": return `Carry ${kg(carryCapacity(level))} · walk ${Math.round(walkBonus(level) * 100)}% faster`;
    case "charisma": return `Shop prices ${Math.round((sellWithCharisma(1000, level) / 1000 - 1) * 100)}% better`;
  }
}

export const altarPick: { item: number | null; soul: number | null; gem: number | null; effect: EnchantId | null; inlay: Inlay } = { item: null, soul: null, gem: null, effect: null, inlay: "none" };

/** The spell bar (shared/spells.ts), from the server. */
export interface Spellbook { bar: (SpellId | null)[]; known: SpellId[]; books: SpellId[]; bolt: BoltSpellId }

export const pick = {
  bar: "bronze" as Metal, type: "axe" as ToolType, metal: "bronze" as Metal, wood: "pine" as Wood, fuel: "pine" as Wood,
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
  /** Workbench: what kind of thing, the wood for a bow or staff, the arrow tip, and the leather or cloth piece. */
  bench: "bait" as "bait" | "bow" | "staff" | "arrows" | "leather" | "cloth", benchWood: "pine" as Wood, tip: "bronze" as Metal, softPiece: "boots" as ArmorType,
  /** Tanning rack and spinning wheel: which recipe. */
  tan: TANNING_IDS[0], spin: "thread" as ItemId,
};

/** Gems and jewelry: what the server should do. */
export let onCut: (item: ItemId) => void = () => {};

export let onWearJewel: (slot: number) => void = () => {};

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
      slot.append(itemIcon("", on));
      slot.title = `${item.name}: ${describeBonus(jewelBonus(on))}. Click to take it off.`;
      slot.onclick = () => onRemoveJewel(s);
    } else {
      slot.append(icon("empty-tool", s === "amulet" ? "📿" : "💍"));
      slot.title = `${SLOT_LABELS[s]}: empty. Click ${s === "amulet" ? "an amulet" : "a ring"} in your bag to put it on. Smith them at the anvil.`;
    }
    box.appendChild(slot);
  }
}

export const STATION_SKILL = { furnace: "smelting", anvil: "smithing", stove: "cooking", workbench: "handicraft", tanning_rack: "handicraft", spinning_wheel: "handicraft", alchemy_table: "alchemy" } as const;

/** Hidden potion recipes you've found. */
export let discovered: PotionType[] = [];

export function setDiscovered(list: PotionType[]) { discovered = list; renderCraft(); }

/** Potion buffs running, and the server's clock (buffs end by it). */
export let buffs: Buffs = {};

let serverOffset = 0;

export const serverNow = () => Date.now() + serverOffset;

export function setServerOffset(offset: number) { serverOffset = offset; }

export function setBuffs(b: Buffs) { buffs = b; renderVitalBars(); }

/** Called every second: the buff timers count down. */
export function tickBuffs() { if (Object.keys(buffs).length) renderVitalBars(); }

/** Is a night sight potion working right now? */
export const nightSightOn = () => buffPower(buffs, "nightsight", serverNow()) > 0;

export type Station = keyof typeof STATION_SKILL;

/** What a skill's tree gives you for one effect (from the ranks you've bought). */
export const tree = (skill: SkillId, effect: Parameters<typeof treeBonus>[2]) => treeBonus(treeRanks(), skill, effect);

/** Keen eye (version 0.22, Mike's note): only show a skill's numbers once you've bought it in that skill's tree. */
export const knows = (skill: string) => (treeRanks()[`${skill}.insight`] ?? 0) > 0;

/** A success chance in words, for players without Keen eye. */
export const chanceWords = (c: number) => c >= 0.9 ? "Almost sure to work" : c >= 0.65 ? "Likely to work" : c >= 0.4 ? "Might work" : c >= 0.2 ? "Tricky: often fails" : "Very hard: usually fails";

/** Your crafting chance with everything counted (Mastery, belt tool, skill tree). */
export const chanceFor = (recipe: NonNullable<ReturnType<typeof recipeFor>>) => successFor(recipe, lastMastery, lastBelt, tree(recipe.skill, "success"), levelForXp(lastSkillXp[recipe.skill as SkillId] ?? 0));

/** Stamina from eating it, with the Cooking tree's "Hearty meals". */
export const staminaOf = (item: ItemId) => foodStamina(item, lastMastery, tree("cooking", "mealStamina"));

/** How many ingredients fit in your pot. */
export const potSize = () => BASE_INGREDIENTS + tree("cooking", "slots");

/** The item whose info card is showing. */
/** A bag slot shows one of the things in it at a time: `pick` is which (0 = the one on top). */
export type InfoTarget = { kind: "slot"; slot: number; pick: number } | { kind: "belt"; type: ToolType } | { kind: "gear"; slot: GearSlot };

/** Skills whose list of types is showing (click a skill to fold it away). */
// Everything starts folded up; click a Discipline or skill to open it.
export const expanded = new Set<SkillId>();

export const openDisciplines = new Set<DisciplineId>();

export const el = (cls: string, text = "") => {
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
export function icon(cls: string, glyph: string, tint?: string): HTMLElement {
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

/**
 * An item's picture (version 0.21): its own 3D model, from the picture sheet tools/make-icons.mjs draws
 * (client3d/public/icons/items.png). Anything without a picture keeps its emoji.
 */
export function itemIcon(cls: string, id: ItemId): HTMLElement {
  const at = ICON_INDEX[iconKey(id)];
  if (at == null) return icon(cls, ITEMS[id].icon, ITEMS[id].tint);
  const box = document.createElement("span");
  box.className = cls;
  const pic = document.createElement("span");
  pic.className = "pic-icon";
  const n = ICON_SHEET.cols;
  pic.style.backgroundSize = `${n * 100}% ${n * 100}%`;
  pic.style.backgroundPosition = `${((at % n) / (n - 1)) * 100}% ${(Math.floor(at / n) / (n - 1)) * 100}%`;
  box.appendChild(pic);
  return box;
}
