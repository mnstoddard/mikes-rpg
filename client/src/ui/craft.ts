// Crafting windows: furnace, anvil, stove, workbench, alchemy table and the enchanting altar.
// (Part of the game's windows: client/src/ui.ts loads every file in client/src/ui/.)
import { levelForXp, isUnlocked, CraftSkill, findSkill } from "../../../shared/disciplines";
import { enchantKind, enchantsOf, describeEnchant, isSpent, EnchantId, INLAYS, Inlay, enchantForGem, cappedGem, ENCHANT_IDS, fits, ENCHANTS, soulPower } from "../../../shared/enchanting";
import { isSoulGem, parseGem, JEWEL_BAR_IDS, JewelType, JEWEL_TYPES, JEWEL_METAL_IDS, JEWEL_METALS, isCutGem, jewelId, describeBonus, jewelBonus, cutChances, isRough, CUT_LEVEL, GEMS } from "../../../shared/jewelry";
import { ItemId, ITEMS } from "../../../shared/items";
import { treeBonus } from "../../../shared/skilltree";
import { treeRanks } from "../tree";
import { Material, MATERIALS, WOOD_IDS, WOODS, MATERIAL_IDS, METAL_IDS, barId, METALS, TOOL_TYPE_IDS, TOOL_TYPES, isWoodTool, ROD_LOGS, hasHandle, toolId, toolForSkill, isTool, maxDurability } from "../../../shared/tools";
import { TANNING_IDS, recipeFor, SMITH_UNLOCK, smithLevel, SMITH_ORDER, gearDurability, levelGapFactor } from "../../../shared/crafting";
import { THREAD_LEVEL, CLOTH_LEVEL, WOOD_LEVEL, ARROW_LEVEL, SOFT_LEVEL, ARROW_RECOVER, arrowId, BAIT_IDS, BAITS, isBait, isArrow } from "../../../shared/handicraft";
import { weaponId, ARMOR_TYPES, ARMOR, SOFT_NAMES, armorId, WEAPON_TYPES, isWooden, WeaponType, WEAPONS, isGear, METAL_DAMAGE } from "../../../shared/gear";
import { RESOURCES } from "../../../shared/foraging";
import { parsePotion, POTIONS, isPotion, describeEffect, potionEffect, POTION_TYPES, ALCHEMY_INGREDIENTS, BONUS_IDS, BONUSES, BonusId, potionFrom } from "../../../shared/alchemy";
import { masteryIn, percent } from "../../../shared/mastery";
import { STAMINA_COST, isMeal, mealRichness, DISHES, fitsDish, IngredientId, DISH_IDS, FOOD_KINDS, isIngredient, INGREDIENTS, ingredientStamina, WOOD_COOK_LEVEL, fireStamina, mealId } from "../../../shared/cooking";
import { formatMoney } from "../../../shared/money";
import { gearNeeds, gearEffect, POTION_ID } from "../../../shared/combat";
import { Station, openPanel, STATION_SKILL, el, teachNote, altarPick, icon, pick, discovered, chanceFor, tree, knows, chanceWords, sellPrice, staminaOf, potSize, itemIcon, onCut } from "./core";
import { lastSkillXp, lastDisciplines, lastMastery } from "./skills";
import { invItems, locked, countAt, lastBelt, toolEffect, onCraft } from "./bag";
import { closeShop } from "./shop";
import { closeBounties, closeGuild, closeChest } from "./guild";
import { closeInfo } from "./info";
import { closeDialog } from "./quests";

/** The enchanting altar uses the craft window too, with its own buttons. */
let altarOpen = false;

/** Which crafting window is open, and what's picked in it. */
let station: Station | null = null;

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

/** The enchanting altar: pick an item, a refined emberstone, and (for a staff) a gem and inlay, or (otherwise) an effect. */
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
  row("Refined emberstone", souls, altarPick.soul, (i) => { altarPick.soul = i; }, "No refined emberstone with ember in it. Cast 👻 Ember trap on a monster, then defeat it.");
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
    el("craft-info", `Uses up the refined emberstone${kind === "staff" ? ", the gem" + (altarPick.inlay !== "none" ? " and the inlay bar" : "") : ""}. A fuller, bigger refined emberstone makes it stronger.`));
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

export function renderCraft() {
  if (!altarOpen && !station) return;
  craftOne.style.display = craftAll.style.display = altarOpen ? "none" : "";
  if (altarOpen) return renderAltar();
  if (!station) return;
  const skill: CraftSkill = STATION_SKILL[station];
  const level = levelForXp(lastSkillXp[skill] ?? 0);
  craftTitle.textContent = `${{ furnace: "Furnace", anvil: "Anvil", stove: "Stove", workbench: "Workbench", tanning_rack: "Tanning rack", spinning_wheel: "Spinning wheel", alchemy_table: "Alchemy table" }[station]} · ${findSkill(skill).def.name} level ${level}`;
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
  } else if (station === "tanning_rack") {
    craftBody.append(choices("Tan", TANNING_IDS, pick.tan, (t) => { const r = recipeFor(t)!; const hide = r.inputs[0];
      return { icon: ITEMS[hide].icon, tint: ITEMS[hide].tint, name: ITEMS[hide].name, lockedAt: level < r.level ? r.level : undefined }; }, (t) => { pick.tan = t; }));
    craftBody.append(el("craft-info", "Each hide makes one leather. Cows and boars drop hides; wolves drop pelts. Leather goes into leather armor at the workbench."));
    output = pick.tan;
  } else if (station === "spinning_wheel") {
    craftBody.append(choices("Spin", ["thread", "cloth"] as ItemId[], pick.spin, (t) => ({ icon: ITEMS[t].icon, tint: ITEMS[t].tint, name: ITEMS[t].name,
      lockedAt: level < (t === "thread" ? THREAD_LEVEL : CLOTH_LEVEL) ? (t === "thread" ? THREAD_LEVEL : CLOTH_LEVEL) : undefined }), (t) => { pick.spin = t; }));
    craftBody.append(el("craft-info", "Spider silk spins into thread; 2 thread weave into cloth. Thread strings bows, cloth makes robes. (Wool comes with Farming.)"));
    output = pick.spin;
  } else if (station === "workbench") {
    const BENCH = { bait: { icon: "🪱", name: "Bait" }, bow: { icon: "🏹", name: "Bows" }, staff: { icon: "🪄", name: "Staffs" }, arrows: { icon: "➶", name: "Arrows" }, leather: { icon: "🦺", name: "Leather" }, cloth: { icon: "👘", name: "Cloth" } };
    const firstLevel = { bait: 1, bow: WOOD_LEVEL.pine + 2, staff: WOOD_LEVEL.pine, arrows: ARROW_LEVEL.bronze, leather: SOFT_LEVEL.leather.boots!, cloth: SOFT_LEVEL.cloth.boots! };
    craftBody.append(choices("Make", Object.keys(BENCH) as (keyof typeof BENCH)[], pick.bench, (c) => ({ ...BENCH[c], lockedAt: level < firstLevel[c] ? firstLevel[c] : undefined }), (c) => { pick.bench = c; }));
    if (pick.bench === "bow" || pick.bench === "staff") {
      const t = pick.bench;
      craftBody.append(choices("Wood (2 logs)", WOOD_IDS, pick.benchWood, (w) => { const lv = WOOD_LEVEL[w] + (t === "bow" ? 2 : 0);
        return { icon: "🪵", tint: ITEMS[`${w}_logs`].tint, name: WOODS[w].name, lockedAt: level < lv ? lv : undefined }; }, (w) => { pick.benchWood = w; }));
      craftBody.append(el("craft-info", t === "bow" ? "Better wood hits harder. A bow also needs a thread (from the spinning wheel, or Rook sells it) and arrows to shoot." : "Better wood makes stronger spells. Enchant a staff at the altar."));
      output = weaponId(t, "stone", pick.benchWood);
    } else if (pick.bench === "arrows") {
      craftBody.append(choices("Tip", MATERIAL_IDS, pick.tip, (m) => ({ icon: "🧈", tint: MATERIALS[m].tint, name: MATERIALS[m].name, lockedAt: level < ARROW_LEVEL[m] ? ARROW_LEVEL[m] : undefined }), (m) => { pick.tip = m; }));
      craftBody.append(el("craft-info", `Makes 10 from a pine log, the tip and 2 feathers. The tip sets the damage. Each shot uses one; about ${Math.round(ARROW_RECOVER * 100)}% can be picked up again.`));
      output = arrowId(pick.tip);
    } else if (pick.bench === "leather" || pick.bench === "cloth") {
      const soft = pick.bench;
      const pieces = ARMOR_TYPES.filter((t) => SOFT_LEVEL[soft][t] != null);
      if (!pieces.includes(pick.softPiece)) pick.softPiece = pieces[0];
      craftBody.append(choices("Piece", pieces, pick.softPiece, (t) => { const lv = SOFT_LEVEL[soft][t]!;
        return { icon: ARMOR[t].icon, name: `${SOFT_NAMES[soft][t]} (${ARMOR[t].bars})`, lockedAt: level < lv ? lv : undefined }; }, (t) => { pick.softPiece = t; }));
      craftBody.append(el("craft-info", soft === "leather" ? "Leather is light and a bit tougher than bronze, and doesn't slow you down like metal." : "Cloth is thin, but each piece adds max mana and makes your spells stronger."));
      output = armorId(pick.softPiece, soft);
    } else {
      craftBody.append(choices("Bait", BAIT_IDS, pick.bait, (b) => ({ icon: BAITS[b].icon, tint: BAITS[b].tint, name: BAITS[b].name, lockedAt: level < BAITS[b].level ? BAITS[b].level : undefined }), (b) => { pick.bait = b; }));
      craftBody.append(el("craft-info", BAITS[pick.bait].description + ". Fishing uses the first unlocked bait in your bag."));
      output = pick.bait;
    }
  } else if (station === "furnace") {
    const bars: ItemId[] = [...METAL_IDS.map((m) => barId(m) as ItemId), ...JEWEL_BAR_IDS];
    craftBody.append(choices("Bar", bars, pick.furnaceBar, (b) => ({ icon: "🧈", tint: ITEMS[b].tint, name: ITEMS[b].name.replace(/ bar$/, ""),
      lockedAt: level < recipeFor(b)!.level ? recipeFor(b)!.level : undefined }), (b) => { pick.furnaceBar = b; }));
    output = pick.furnaceBar;
  } else {
    const CATS = { tools: { icon: "🪓", name: "Tools" }, weapons: { icon: "🗡️", name: "Weapons" }, armor: { icon: "🛡️", name: "Armor" }, jewelry: { icon: "💍", name: "Jewelry" }, gems: { icon: "💎", name: "Cut gems" } };
    craftBody.append(choices("Make", ["tools", "weapons", "armor", "jewelry", "gems"] as ("tools" | "weapons" | "armor" | "jewelry" | "gems")[], pick.category, (c) => CATS[c], (c) => { pick.category = c; }));
    // Smithing unlocks one thing per level (version 0.22): show what you can make, and the next one (locked). Nothing further.
    const smithLocked = (t: keyof typeof SMITH_UNLOCK, metal: Material = "bronze") => level < smithLevel(t, MATERIALS[metal].level) ? smithLevel(t, MATERIALS[metal].level) : undefined;
    const nextUp = SMITH_ORDER.find((t) => level < smithLevel(t));
    const shown = <T extends keyof typeof SMITH_UNLOCK>(ids: readonly T[]) => ids.filter((t) => !smithLocked(t) || t === nextUp);
    const smithType = (): keyof typeof SMITH_UNLOCK => pick.category === "weapons" ? pick.weapon : pick.category === "armor" ? pick.armor : pick.type;
    const head = () => choices("Head", MATERIAL_IDS, pick.metal, (m) => ({ icon: "🧈", tint: MATERIALS[m].tint, name: MATERIALS[m].name, lockedAt: smithLocked(smithType(), m) }), (m) => { pick.metal = m; });
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
      const ws = shown(WEAPON_TYPES.filter((t) => !isWooden(t)));
      if (!ws.length) { craftBody.append(el("craft-info", `Your first weapon (a dagger) unlocks at Smithing ${smithLevel("dagger")}.`)); craftOne.disabled = craftAll.disabled = true; return; }
      if (!(ws as WeaponType[]).includes(pick.weapon)) pick.weapon = ws[0];
      craftBody.append(choices("Weapon", ws, pick.weapon, (t) => ({ icon: WEAPONS[t].icon, name: WEAPONS[t].name, lockedAt: smithLocked(t) }), (t) => { pick.weapon = t; }), head(), handle());
      output = weaponId(pick.weapon, pick.metal, pick.wood);
    } else if (pick.category === "armor") {
      craftBody.append(
        ...(() => {
          const as = shown(ARMOR_TYPES);
          if (!as.length) return [el("craft-info", `Your first armor (a helmet) unlocks at Smithing ${smithLevel("helmet")}.`)];
          if (!as.includes(pick.armor)) pick.armor = as[0];
          return [choices("Armor", as, pick.armor, (t) => ({ icon: ARMOR[t].icon, name: `${ARMOR[t].name} (${ARMOR[t].bars})`, lockedAt: smithLocked(t) }), (t) => { pick.armor = t; }),
            choices("Metal", METAL_IDS, pick.armorMetal, (m) => ({ icon: "🧈", tint: METALS[m].tint, name: METALS[m].name, lockedAt: smithLocked(pick.armor, m) }), (m) => { pick.armorMetal = m; })];
        })(),
      );
      if (!shown(ARMOR_TYPES).length) { craftOne.disabled = craftAll.disabled = true; return; }
      output = armorId(pick.armor, pick.armorMetal);
    } else {
      const ts = shown(TOOL_TYPE_IDS);
      if (!ts.includes(pick.type)) pick.type = ts[0];
      craftBody.append(choices("Tool", ts, pick.type, (t) => ({ icon: TOOL_TYPES[t].icon, name: TOOL_TYPES[t].name, lockedAt: smithLocked(t) }), (t) => { pick.type = t; }));
      if (isWoodTool(pick.type)) {
        // Fishing rods are all wood: pick which logs to carve it from.
        craftBody.append(choices(`Wood (${ROD_LOGS} logs)`, WOOD_IDS, pick.wood, (w) => ({ icon: "🪵", tint: ITEMS[`${w}_logs`].tint, name: WOODS[w].name,
          lockedAt: level < Math.max(RESOURCES[w].level, smithLevel("rod")) ? Math.max(RESOURCES[w].level, smithLevel("rod")) : undefined }), (w) => { pick.wood = w; }));
      } else {
        craftBody.append(head());
        if (hasHandle(pick.type)) craftBody.append(handle());
      }
      output = toolId(pick.type, pick.metal, pick.wood);
    }
  }

  const recipe = recipeFor(output)!;
  // Tanning recipes are keyed "tan_<hide>" but make leather.
  const made = recipe.output;
  const item = ITEMS[made];
  const detail = el("craft-detail");
  const head = el("craft-head");
  // A hidden potion you haven't found yet stays a mystery until you brew it.
  const brew = parsePotion(output);
  const secret = !!brew && !!POTIONS[brew.type].hidden && !discovered.includes(brew.type);
  head.append(icon("craft-icon", secret ? "❓" : item.icon, secret ? undefined : item.tint), el("craft-name", secret ? "Unknown potion" : (recipe.makes ? `${recipe.makes} ` : "") + item.name));
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
  const sees = knows(skill);
  detail.append(el("craft-chance", sees ? `${percent(chance)} success` : chanceWords(chance)),
    el("craft-info", `Mastery ${m}` + (!tool ? " · no tool needed" : lastBelt[tool] ? ` · ${ITEMS[lastBelt[tool]!.item].name} on your belt`
      : recipe.needsTool ? ` · a ${TOOL_TYPES[tool].name.toLowerCase()} on your belt would help a lot` : ` · no ${TOOL_TYPES[tool].name.toLowerCase()} needed`) +
      (steady && sees ? ` · skill tree: ${Math.round(steady * 100)}% fewer failures` : "")));
  const facts = secret ? [`costs ${STAMINA_COST[skill]} stamina`] : [`Sells for ${formatMoney(sellPrice(made))}${recipe.makes ? " each" : ""}`, ...(sees ? [`${recipe.xp} XP`, `costs ${STAMINA_COST[skill]} stamina`] : [])];
  if (isTool(output)) facts.unshift(sees ? `${toolEffect(output)}, ${maxDurability(output)} uses` : toolEffect(output));
  if (isGear(output)) {
    const needs = gearNeeds(output)!;
    facts.unshift(`${gearEffect(output)}, ${gearDurability(output)} uses, to use: ${findSkill(needs.skill).def.name} ${needs.level}`);
  }
  if (isMeal(output)) {
    facts.unshift(`Gives ${staminaOf(output)} stamina`);
    const rich = mealRichness(output);
    if (rich < 0.995) detail.append(el("craft-info", `🔥 A rich meal is harder to get right: ${Math.round((1 - rich) * 100)}% lower starting chance (the more stamina a meal gives, the harder it is).`));
    // Better fish and wood need a better cook (report #25).
    const gap = levelGapFactor(recipe, level);
    if (level >= recipe.level && gap < 0.995) detail.append(el("craft-info", `🎓 This needs Cooking ${recipe.level} and you're Cooking ${level}, so it's tricky: ${Math.round((1 - gap) * 100)}% lower starting chance. It gets easier every level until Cooking ${recipe.level + 10}.`));
  }
  if (isBait(output)) facts.unshift(`Lasts ${BAITS[output].uses} catches`);
  if (isArrow(output)) facts.unshift(`Adds up to ${METAL_DAMAGE[output.slice(7) as Material]} to a bow's hit`);
  if (isPotion(output) && !secret) facts.unshift(describeEffect(potionEffect(output, level)) + " (stronger as your Alchemy goes up)");
  detail.append(el("craft-info", facts.join(" · ")));
  if (level < recipe.level) detail.append(el("craft-warn", `Needs ${findSkill(skill).def.name} level ${recipe.level}.`));
  else if (!canMake) detail.append(el("craft-warn", station === "stove" ? "You don't have all of that (and the log) unlocked in your bag." : station === "alchemy_table" ? "You need an empty vial for each potion. Alchemist Moss sells them." : station === "workbench" ? (pick.bench === "bait" ? "You don't have the materials. Worms turn up while chopping and mining (or Rook and Tam sell them); cooking leaves food scraps." : "You don't have the materials. Logs come from trees (or Forester Holt), feathers from chickens (or Rook), bars from the furnace, leather from the tanning rack and cloth from the spinning wheel.")
    : station === "tanning_rack" ? "You need a hide. Cows drop cowhide, boars drop boar hide, and wolves drop pelts."
    : station === "spinning_wheel" ? (output === "cloth" ? "You need 2 thread. Spin it from spider silk here, or buy it from Rook." : "You need spider silk. Spiders drop it in the cave by the quarry.") : "You don't have the materials. Miner Greta sells ore, Smith Brann sells bars, and Forester Holt sells logs."));
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

  // Only what you can cook (version 0.22, Mike's note): the dishes you know, and the next one to come.
  const nextDish = DISH_IDS.filter((d) => DISHES[d].level > level).sort((a, b) => DISHES[a].level - DISHES[b].level)[0];
  craftBody.append(choices("Dish", DISH_IDS.filter((d) => DISHES[d].level <= level || d === nextDish), pick.dish, (d) => ({ icon: DISHES[d].icon, name: DISHES[d].name, lockedAt: level < DISHES[d].level ? DISHES[d].level : undefined }), (d) => { pick.dish = d; }));
  const kinds = Object.entries(dish.kinds).map(([k, x]) => `${FOOD_KINDS[k as keyof typeof FOOD_KINDS].toLowerCase()} ×${x}`).join(", ");
  craftBody.append(el("craft-info", knows("cooking") ? `${dish.note}. Stamina: ${kinds}, fire ×${dish.fire}.` : `${dish.note}.`));

  // The pot: what's in it (tap to take out), and empty spaces.
  const potRow = el("pick-row");
  potRow.append(el("pick-label", `In the pot (${pick.pot.length}/${slots}): tap to take out`));
  pick.pot.forEach((i, n) => {
    const b = document.createElement("button");
    b.className = "pick active";
    b.append(itemIcon("pick-icon", i), el("pick-name", ITEMS[i].single));
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
  // Only things you could put in this dish at your level: no "can't cook" clutter.
  const mine = invItems.filter((it, i): it is ItemId => !!it && !locked[i] && !seen.has(it) && !!seen.add(it))
    .filter((it) => isIngredient(it) && fitsDish(pick.dish, it) && INGREDIENTS[it].level <= level);
  for (const it of mine) {
    const b = document.createElement("button");
    const fits = fitsDish(pick.dish, it);
    const tooHard = fits && INGREDIENTS[it].level > level;
    const left = fits ? haveUnlocked(it) - inPot(it) : 0;
    const full = pick.pot.length >= slots;
    const usable = fits && !tooHard && left > 0 && !full;
    b.className = "pick" + (usable ? "" : " locked");
    const label = !isIngredient(it) ? "can't cook" : !fits ? `not in ${dish.name.toLowerCase()}` : tooHard ? `🔒${INGREDIENTS[it].level}` : knows("cooking") ? `+${Math.round(ingredientStamina(pick.dish, it))} (${left})` : `${ITEMS[it].single} (${left})`;
    b.append(itemIcon("pick-icon", it), el("pick-name", label));
    b.title = !isIngredient(it) ? `${ITEMS[it].name} can't be cooked.`
      : !fits ? `${dish.name} can't use ${FOOD_KINDS[INGREDIENTS[it as IngredientId].kind].toLowerCase()}.`
      : tooHard ? `You need Cooking level ${INGREDIENTS[it].level} to cook ${ITEMS[it].name.toLowerCase()}.`
      : full ? `The pot is full (${slots}). Spend Mastery points on "Bigger pot" in the Cooking skill tree for more room.`
      : `${ITEMS[it].name}: adds ${Math.round(ingredientStamina(pick.dish, it))} stamina to a ${dish.name.toLowerCase()}. ${left} left.`;
    b.disabled = !usable;
    if (usable) b.onclick = () => { pick.pot.push(it); renderCraft(); };
    bagRow.appendChild(b);
  }
  if (!mine.length) bagRow.append(el("craft-warn", `Nothing in your bag that you can cook goes in a ${dish.name.toLowerCase()}. Catch fish, get raw chicken or beef from chickens and cows, or buy vegetables at the General Store.`));
  craftBody.append(bagRow);

  // Only logs you have and can cook over.
  const fuels = WOOD_IDS.filter((w) => WOOD_COOK_LEVEL[w] <= level && haveUnlocked(`${w}_logs` as ItemId) > 0);
  if (!fuels.length) { craftBody.append(el("craft-warn", "You need a log to burn. Chop one, or buy pine logs at the General Store.")); return null; }
  if (!fuels.includes(pick.fuel)) pick.fuel = fuels[fuels.length - 1];
  craftBody.append(choices("Log to burn (better wood, more stamina)", fuels, pick.fuel,
    (w) => ({ icon: "🪵", tint: ITEMS[`${w}_logs`].tint, name: knows("cooking") ? `${WOODS[w].name} +${fireStamina(pick.dish, w)}` : WOODS[w].name }), (w) => { pick.fuel = w; }));

  if (!pick.pot.length) {
    craftBody.append(el("craft-detail", "Put at least one ingredient in the pot."));
    return null;
  }
  return mealId(pick.dish, pick.fuel, pick.pot);
}

/** The anvil's Cut gems tab: every rough gem and emberstone in your bag, with a Cut button, and your odds. */
function renderCutting(level: number) {
  const c = cutChances(level);
  craftBody.append(el("craft-info", `Your cuts at Smithing ${level}: ${percent(c.flawless)} flawless (keeps it all), ${percent(c.good)} good (85%), ${percent(c.clumsy)} clumsy (60%), ${percent(c.shattered)} shatter. Emberstone always cuts cleanly.`));
  const rough = [...new Set(invItems.filter((it, i): it is ItemId => !!it && !locked[i] && isRough(it)))];
  if (!rough.length) {
    craftBody.append(el("craft-warn", "No rough gems or emberstones in your bag. Mine them in the crystal cave, through the spider cave east of the quarry."));
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
    b.append(itemIcon("pick-icon", it), el("pick-name", lockedOut ? `🔒${need}` : `${ITEMS[it].name} (${haveUnlocked(it)})`));
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
    b.append(itemIcon("pick-icon", i), el("pick-name", ITEMS[i].single));
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
    b.append(itemIcon("pick-icon", it), el("pick-name", !usable ? "no use" : asBonus && !(BONUS_IDS as string[]).includes(it) ? "not a bonus" : `${ITEMS[it].single} (${left})`));
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
