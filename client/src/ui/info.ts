// The item info card: what a thing is worth and what it does.
// (Part of the game's windows: client/src/ui.ts loads every file in client/src/ui/.)
import { ItemId, ITEMS, CRAFT_MARKUP } from "../../../shared/items";
import { entriesIn, slotTotal, stackLimit } from "../../../shared/bag";
import { isTool, parseTool, hasHandle, MATERIALS, WOODS, maxDurability } from "../../../shared/tools";
import { masteryIdFor, masteryName, recipeFor, gearDurability } from "../../../shared/crafting";
import { masteryIn, masteryValue, percent } from "../../../shared/mastery";
import { kg, weightOf } from "../../../shared/weight";
import { formatMoney } from "../../../shared/money";
import { SHOP_IDS, SHOPS, sellersOf } from "../../../shared/shops";
import { npcById } from "../../../shared/npcs";
import { enchantsOf, describeEnchant } from "../../../shared/enchanting";
import { isStoryItem, STORY_ITEMS } from "../../../shared/story";
import { isSpellBook, SPELL_BOOKS } from "../../../shared/spells";
import { SPELLS, gearNeeds, gearEffect, attackFor, combatMasteryIn, maxHitWith, POTION_ID, POTION_HEAL } from "../../../shared/combat";
import { isSoulGem, parseGem, soulCapacity, soulFill, isJewelry, describeBonus, jewelBonus, isRough, isCutGem, jewelId } from "../../../shared/jewelry";
import { RESOURCE_FOR_ITEM, RESOURCES, forageFindOf } from "../../../shared/foraging";
import { findSkill, levelForXp } from "../../../shared/disciplines";
import { parseMeal, DISHES, ingredientStamina, fireStamina, mealBaseStamina, isFood, isIngredient, INGREDIENTS, DISH_IDS, fitsDish, FOOD_KINDS } from "../../../shared/cooking";
import { isBait, BAITS } from "../../../shared/handicraft";
import { isGear, isWeapon, emptyGear } from "../../../shared/gear";
import { isBroken } from "../../../shared/repair";
import { isPotion } from "../../../shared/alchemy";
import { isSeed } from "../../../shared/farming";
import { InfoTarget, el, itemIcon, sellPrice, buyPrice, knows, chanceFor, chanceWords, tree, staminaOf, onWearJewel } from "./core";
import { lastMastery, lastSkillXp, lastCombatMastery } from "./skills";
import { bag, invItems, durability, lastBelt, lastGear, locked, shortName, countAt, durabilityBar, lastSpell, toolEffect, onUnequip, onRemove, shopIsOpen, onSell, onEquip, onWear, onDrink, onRead, onSeed, onEat, onLock, onDrop } from "./bag";
import { shopBuying, shopId, askAmount } from "./shop";
import { closeChest } from "./guild";
import { vitals } from "./vitals";
import { isRobePiece } from "./quests";

let info: InfoTarget | null = null;

document.getElementById("chest-close")!.onclick = closeChest;

// ---- Item info card: click an item (or a belt tool) to see what it's worth and does ----

const infoBody = document.getElementById("info-body")!;

const infoButtons = document.getElementById("info-buttons")!;

export function showInfo(target: InfoTarget) {
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

export function renderInfo() {
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
  // Several kinds in this slot (a bronze axe and an iron axe, or stews of different recipes): flip through them.
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
  head.append(itemIcon("craft-icon", id), el("craft-name", shortName(id) + (isLocked ? " 🔒" : "")));
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
  if (isStoryItem(id)) infoBody.append(infoLine("Story", STORY_ITEMS[id].description));
  if (isSpellBook(id)) {
    const sp = SPELLS[SPELL_BOOKS[id]];
    infoBody.append(infoLine("Read it", `learn ${sp.icon} ${sp.name}`, `needs Spellcasting ${sp.level}. ${sp.description}`));
  }
  if (isSoulGem(id)) {
    const g = parseGem(id) as { size: number; souls: number };
    infoBody.append(infoLine("Ember", `${g.souls} / ${soulCapacity(g.size)} (${Math.floor((soulFill(id) ?? 0) * 100)}%)`,
      "Cast 👻 Ember trap on a monster, then defeat it in time: its ember fills your best refined emberstone. Full gems power enchantments."));
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
      knows(recipe.skill) ? `${percent(chanceFor(recipe))} success for you · ${recipe.xp} XP` : chanceWords(chanceFor(recipe)).toLowerCase() + " for you"));
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
    infoButton("Unequip", () => { onUnequip(target.type); closeInfo(); });
  } else if (target.kind === "gear") {
    infoButton("Unequip", () => { onRemove(target.slot); closeInfo(); });
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
    if (isTool(id)) infoButton("Equip", () => { onEquip(e); closeInfo(); }, broken);
    if (isGear(id)) {
      infoButton("Equip", () => { onWear(e); closeInfo(); }, broken);
      if (isRobePiece(id)) infoButtons.lastElementChild!.classList.add("robe-glow");
    }
    if (id === POTION_ID) infoButton(`Drink (+${POTION_HEAL})`, () => { onDrink(e); closeInfo(); });
    if (isPotion(id)) infoButton("Drink", () => { onDrink(e); closeInfo(); });
    if (isJewelry(id)) infoButton("Equip", () => { onWearJewel(e); closeInfo(); });
    if (isSpellBook(id)) infoButton("Read", () => { onRead(e); closeInfo(); });
    if (isStoryItem(id) && STORY_ITEMS[id].use) infoButton(STORY_ITEMS[id].use!, () => { onRead(e); closeInfo(); });
    if (isSeed(id)) infoButton("Plant these first", () => { onSeed(id); closeInfo(); });
    if (isFood(id)) infoButton(`Eat (+${staminaOf(id)})`, () => { onEat(e); done(); }, false);
    infoButton(isLocked ? "Unlock" : "Lock", () => onLock(e, !isLocked));
    infoButton(stack > 1 ? `🗑️ Trash all ${stack}` : "🗑️ Trash", () => { onDrop(e); done(); }, isLocked);
  }
  infoButton("Close", closeInfo);
}
