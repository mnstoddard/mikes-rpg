// The bag: adding, moving, dropping, eating, drinking, equipping and wearing.
// Part of the game room (server/src/WorldRoom.ts), split out to keep each file to one job.
import { Client } from "colyseus";
import { type } from "@colyseus/schema";
import { levelForXp } from "../../../shared/disciplines";
import { gearDurability, sellPriceFor } from "../../../shared/crafting";
import { POTION_HEAL, POTION_ID, gearEffect } from "../../../shared/combat";
import { GEAR_SLOTS, GearSlot, gearSlot, isGear } from "../../../shared/gear";
import { TOOL_TYPES, TOOL_TYPE_IDS, TOOL_WARN_AT, ToolType, isTool, maxDurability, parseTool } from "../../../shared/tools";
import { ITEMS, ItemId } from "../../../shared/items";
import { Bag, addItem, groupOf, newEntry, stackLimit, clearEntry, cloneBag, countIn, entriesIn, mergeStacks, putBack, reorderSlots, roomFor, stackName, takeFromEntry } from "../../../shared/bag";
import { formatMoney } from "../../../shared/money";
import { fits } from "../../../shared/enchanting";
import { JEWEL_SLOTS, JewelSlot, describeBonus, isJewelry, jewelBonus, parseGem } from "../../../shared/jewelry";
import { BUFFS, POTION_COOLDOWN_MS, isPotion, potionEffect } from "../../../shared/alchemy";
import { foodStamina, isFood, isMeal } from "../../../shared/cooking";
import { treeRoll } from "../../../shared/skilltree";
import { GUIDE_NAME, isProtected } from "../../../shared/quests";
import { isBroken } from "../../../shared/repair";
import { STORY_ITEMS, isStoryItem } from "../../../shared/story";
import { Player } from "./schema";
import { worldNow, sortGroup } from "./common";
import type { WorldRoom } from "../WorldRoom";

export const bagMethods = {
  /** Put one item back in this bag slot (or wherever it fits). Tools keep the uses they have left. */
  place(this: WorldRoom, p: Player, slot: number, item: ItemId, durability?: number) {
    putBack(p, slot, item, this.usesFor(item, durability));
  },
  /**
   * Put items in the bag, on top of a stack if there's room (shared/bag.ts),
   * and only as many as you can carry (shared/weight.ts). Returns how many went in.
   * `force`: ignore weight (Old Maren's gifts, so the tutorial can never get stuck).
   */
  give(this: WorldRoom, p: Player, item: ItemId, n = 1, durability?: number | null, force = false): number {
    const want = force ? n : Math.min(n, this.canLift(p, item));
    return want > 0 ? addItem(p, item, want, this.usesFor(item, durability)) : 0;
  },
  /**
   * Move a saved bag into this player's bag. Similar things are joined first
   * (older saves gave every tool its own slot, and before that every item). If
   * it still doesn't fit (bags used to have 28 slots, now 12), the rest goes
   * into the enchanted chest if there's space, and the General Store buys whatever
   * is left, so nobody loses anything.
   */
  fitOldBag(this: WorldRoom, p: Player, old: Bag) {
    mergeStacks(old);
    let next = 0;
    const extra: number[] = [];
    for (let s = 0; s < old.slotCount; s++) {
      const here = entriesIn(old, s);
      if (!here.length) continue;
      if (next >= p.slotCount) { extra.push(...here); continue; }
      const key = groupOf(old.inventory[here[0]]!);
      let total = 0;
      for (const e of here) {
        const item = old.inventory[e]!;
        const n = countIn(old, e);
        if (groupOf(item) !== key || total + n > stackLimit(item)) { extra.push(e); continue; }
        newEntry(p, next, item, n, old.durability[e], old.locked[e]);
        total += n;
      }
      next++;
    }
    if (!extra.length) return;
    const stored: string[] = [];
    let sold = 0;
    let moved = false;
    for (const e of extra) {
      const item = old.inventory[e]!;
      const n = countIn(old, e);
      const inBag = addItem(p, item, n, old.durability[e]);
      if (inBag) moved = true;
      const put = addItem(p.chest, item, n - inBag, old.durability[e]);
      if (put) stored.push(stackName(item, put));
      if (n - inBag > put) sold += sellPriceFor(item, p.mastery, old.durability[e]) * (n - inBag - put);
    }
    p.coins += sold;
    p.dirty = true;
    if (!stored.length && !sold) return; // it all fit after all, just in other slots
    p.loginNotes.push(`🎒 Bags now hold ${p.slotCount} stacks.` +
      (moved ? " Some things moved to other slots." : "") +
      (stored.length ? ` What didn't fit went into your enchanted chest: ${stored.join(", ")}.` : "") +
      (sold ? ` The General Store bought the rest for ${formatMoney(sold)}.` : ""));
  },
  /** Weapons wear with each attack, armor with each attack on you. At 0 they break (Broken, back in your bag, until repaired). */
  wearGear(this: WorldRoom, p: Player, client: Client | undefined, slot: GearSlot, amount: number) {
    const g = p.gear[slot];
    if (!g || treeRoll(p.tree, "smithing", "toolCare")) return;
    const max = gearDurability(g.item);
    const before = g.durability;
    g.durability = Math.max(0, g.durability - amount);
    if (g.durability <= 0) {
      p.gear[slot] = null;
      if (client) this.gearStatsChanged(client, p);
      const kept = this.give(p, g.item, 1, 0, true) > 0;
      if (client) {
        this.say(client, kept ? `Your ${ITEMS[g.item].single} breaks! It goes in your bag. The Repairer at the Mages' Guild can fix it.`
          : `Your ${ITEMS[g.item].single} breaks, and with no room in your bag, it falls apart.`);
        this.sendInventory(client, p);
      }
    } else if (before > max * TOOL_WARN_AT && g.durability <= max * TOOL_WARN_AT) {
      if (client) this.say(client, `Your ${ITEMS[g.item].single} is about to break (${g.durability} uses left).`);
    }
    if (client) this.sendGear(client, p);
  },
  // The inventory goes only to its owner, not to every player.
  sendInventory(this: WorldRoom, client: Client, p: Player) {
    this.checkLoad(client, p);
    client.send("belt", p.belt);
    this.sendGear(client, p);
    this.sendBag(client, p);
    client.send("coins", p.coins);
    this.checkQuest(p, client); // "Have 2 copper ore" steps
  },
  /** The bag as the client sees it (shared/bag.ts), sent in one go so the lists always line up. */
  bagView(this: WorldRoom, bag: Bag) {
    return { inventory: bag.inventory, counts: bag.counts, locked: bag.locked, durability: bag.durability, slotOf: bag.slotOf, slotCount: bag.slotCount };
  },
  sendBag(this: WorldRoom, client: Client, p: Player) {
    client.send("bag", this.bagView(p));
  },
};

/** The messages from players about this. */
export function registerBag(this: WorldRoom) {
    // Click a tool in your bag to put it on your tool belt (swapping out the one there).
    this.onMessage("equip", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      const item = p.inventory[msg.slot];
      if (!isTool(item)) return;
      if (isBroken(item, p.durability[msg.slot])) return this.say(client, `Your ${ITEMS[item].single} is broken. Take it to the Repairer at the Mages' Guild (south-west of town) to fix it.`);
      const type = parseTool(item).type;
      const old = p.belt[type];
      const slot = p.slotOf[msg.slot];
      p.belt[type] = { item, durability: p.durability[msg.slot] ?? maxDurability(item) };
      clearEntry(p, msg.slot);
      if (old) this.place(p, slot, old.item, old.durability); // the same kind of tool, so it goes where this one was
      this.sendInventory(client, p);
      this.say(client, `You equip the ${ITEMS[item].single} (it goes on your tool belt): ${this.toolEffect(item)}.` +
        (old ? ` Your ${ITEMS[old.item].single} goes in your bag.` : ""));
      this.saveSoon(p);
    });
    // Click a tool on your belt to put it back in your bag.
    this.onMessage("unequip", (client, msg: { type: string }) => {
      const p = this.state.players.get(client.sessionId);
      const type = msg?.type as ToolType;
      if (!p || !TOOL_TYPE_IDS.includes(type) || !p.belt[type]) return;
      const t = p.belt[type]!;
      if (roomFor(p, t.item) < 1) return this.say(client, "Your inventory is full.");
      p.belt[type] = null;
      this.give(p, t.item, 1, t.durability, true);
      this.sendInventory(client, p);
      this.say(client, `You unequip the ${ITEMS[t.item].single}.`);
      if (this.step(p)?.needsTool === type) this.say(client, `${GUIDE_NAME} said to keep your ${TOOL_TYPES[type].name.toLowerCase()} on your belt for this. Put it back on before you carry on.`);
      this.saveSoon(p);
    });
    // Eat a fish or a stew from your bag to get stamina back. Doesn't stop what you're doing.
    this.onMessage("eat", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      const item = p.inventory[msg.slot];
      if (!item || !isFood(item)) return;
      if (isProtected(p.quest, item)) return this.say(client, this.keepIt(p, item, "eat"));
      // Maren's stew lesson (Mike's note, version 0.22): with stamina already full the stew would do nothing, so use some up first.
      if (p.stamina >= p.maxStamina && this.step(p)?.goal.kind === "eat" && isMeal(item)) return this.say(client, "⚡ Your stamina's full, so the stew would go to waste. Catch a few fish at the pond to use some up, then eat it.");
      if (p.stamina >= p.maxStamina) return this.say(client, "You're not hungry. Your stamina is full.");
      const gain = foodStamina(item, p.mastery, this.tree(p, "cooking", "mealStamina"));
      takeFromEntry(p, msg.slot, 1);
      const before = p.stamina;
      p.stamina = Math.min(p.maxStamina, p.stamina + gain);
      this.sendInventory(client, p);
      this.sendStamina(client, p);
      const wasted = gain - (p.stamina - before);
      this.say(client, `You eat the ${ITEMS[item].single}. +${p.stamina - before} stamina (${p.stamina}/${p.maxStamina}).` +
        (wasted > 0 ? ` (${wasted} more would have gone past full.)` : ""));
      this.questEvent(p, client, { kind: "eat", item });
      this.saveSoon(p);
    });
    // Drag an item to another bag slot: the two slots swap (locks and uses left go with them).
    this.onMessage("moveItem", (client, msg: { from: number; to: number }) => {
      const p = this.state.players.get(client.sessionId);
      const n = p?.slotCount ?? 0;
      if (!p || !Number.isInteger(msg?.from) || !Number.isInteger(msg?.to) || msg.from < 0 || msg.to < 0 || msg.from >= n || msg.to >= n || msg.from === msg.to) return;
      const order = Array.from({ length: n }, (_, i) => i);
      [order[msg.from], order[msg.to]] = [order[msg.to], order[msg.from]];
      reorderSlots(p, order);
      this.sendInventory(client, p);
      p.dirty = true;
    });
    // Sort the bag: tools, weapons, armor, food, potions, bars, logs, ore, fish, then everything else; empty slots last.
    this.onMessage("sortInventory", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      mergeStacks(p); // join slots of the same kind of thing first
      // Each slot sorts by the thing on top of it.
      const top = Array.from({ length: p.slotCount }, (_, s) => entriesIn(p, s)[0] ?? -1);
      const order = top.map((_, i) => i).sort((a, b) => {
        const A = p.inventory[top[a]] ?? null, B = p.inventory[top[b]] ?? null;
        if (!A || !B) return (A ? 0 : 1) - (B ? 0 : 1) || a - b;
        return sortGroup(A) - sortGroup(B) || ITEMS[A].name.localeCompare(ITEMS[B].name) || A.localeCompare(B)
          || (p.durability[top[b]] ?? 0) - (p.durability[top[a]] ?? 0) || a - b;
      });
      reorderSlots(p, order);
      this.sendInventory(client, p);
      this.say(client, "🎒 Bag sorted.");
      p.dirty = true;
    });
    // Lock or unlock one item (the one in this inventory slot).
    this.onMessage("lock", (client, msg: { slot: number; locked: boolean }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot) || !p.inventory[msg.slot]) return;
      p.locked[msg.slot] = !!msg.locked;
      this.sendBag(client, p);
      this.saveSoon(p);
    });
    this.onMessage("drop", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot) || !p.inventory[msg.slot]) return;
      const item = p.inventory[msg.slot]!;
      if (p.locked[msg.slot]) return this.say(client, `That ${ITEMS[item].single} is locked. Unlock it to trash it.`);
      if (isProtected(p.quest, item)) return this.say(client, this.keepIt(p, item, "drop"));
      if (isStoryItem(item) && !STORY_ITEMS[item].droppable) return this.say(client, `Better keep your ${ITEMS[item].single}. It's part of your story.`);
      clearEntry(p, msg.slot); // the whole stack
      this.sendInventory(client, p);
      this.questEvent(p, client, { kind: "trash", item });
      this.saveSoon(p);
    });
    // Click a weapon or armor in your bag to hold or wear it (swapping out what was there).
    this.onMessage("wear", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      const item = p.inventory[msg.slot];
      if (!isGear(item)) return;
      if (isBroken(item, p.durability[msg.slot])) return this.say(client, `Your ${ITEMS[item].single} is broken. Take it to the Repairer at the Mages' Guild (south-west of town) to fix it.`);
      const why = this.cantWear(p, item);
      if (why) return this.say(client, why);
      const slot = gearSlot(item);
      // Two-handed weapons and shields don't go together: the other one goes in your bag.
      const clash: GearSlot | null = slot === "weapon" && this.twoHanded(item) && p.gear.offhand ? "offhand"
        : slot === "offhand" && this.twoHanded(p.gear.weapon?.item) ? "weapon" : null;
      const old = p.gear[slot];
      const bagSlot = p.slotOf[msg.slot];
      // What comes off goes in your bag: check it all fits first.
      const goingBack = [old, clash ? p.gear[clash] : null].filter((g) => !!g);
      const after = cloneBag(p);
      clearEntry(after, msg.slot);
      if (!goingBack.every((g) => putBack(after, bagSlot, g!.item, g!.durability))) {
        return this.say(client, "Your bag is too full to swap those. Make room for one more item.");
      }
      p.gear[slot] = { item, durability: p.durability[msg.slot] ?? gearDurability(item) };
      clearEntry(p, msg.slot);
      if (old) this.place(p, bagSlot, old.item, old.durability);
      let moved = "";
      if (clash) {
        const c = p.gear[clash]!;
        p.gear[clash] = null;
        this.place(p, bagSlot, c.item, c.durability);
        moved = ` Your ${ITEMS[c.item].single} goes in your bag (${slot === "weapon" ? "that weapon takes both hands" : "you need a free hand for a shield"}).`;
      }
      const verb = slot === "weapon" ? "hold" : "put on";
      this.say(client, `You ${verb} the ${ITEMS[item].single}. ${gearEffect(item)}.` + (old ? ` Your ${ITEMS[old.item].single} goes in your bag.` : "") + moved);
      this.sendInventory(client, p);
      this.gearStatsChanged(client, p); // Vitality armor
      this.saveSoon(p);
    });
    // Click a piece in your gear strip to take it off.
    this.onMessage("remove", (client, msg: { slot: string }) => {
      const p = this.state.players.get(client.sessionId);
      const slot = msg?.slot as GearSlot;
      if (!p || !GEAR_SLOTS.includes(slot) || !p.gear[slot]) return;
      const g = p.gear[slot]!;
      if (roomFor(p, g.item) < 1) return this.say(client, "Your inventory is full.");
      p.gear[slot] = null;
      this.give(p, g.item, 1, g.durability, true);
      this.say(client, `You take off the ${ITEMS[g.item].single}.`);
      const blocked = this.fightBlock(p);
      if (blocked && slot === "weapon") this.say(client, blocked);
      this.sendInventory(client, p);
      this.gearStatsChanged(client, p);
      this.saveSoon(p);
    });
    // Jewelry: put on a ring or amulet from the bag (2 ring fingers, 1 neck), or take one off.
    this.onMessage("wearJewel", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      const item = p.inventory[msg.slot];
      if (!isJewelry(item)) return;
      const g = parseGem(item) as { type: "ring" | "amulet" };
      const slot: JewelSlot = g.type === "amulet" ? "amulet" : !p.jewels.ring1 ? "ring1" : !p.jewels.ring2 ? "ring2" : "ring1";
      const old = p.jewels[slot];
      takeFromEntry(p, msg.slot, 1);
      if (old) this.give(p, old, 1, null, true);
      p.jewels[slot] = item;
      this.say(client, `You put on the ${ITEMS[item].single}: ${describeBonus(jewelBonus(item))}.` + (old ? ` (You take off the ${ITEMS[old].single}.)` : ""));
      this.jewelsChanged(client, p);
    });
    this.onMessage("removeJewel", (client, msg: { slot: string }) => {
      const p = this.state.players.get(client.sessionId);
      const slot = msg?.slot as JewelSlot;
      if (!p || !JEWEL_SLOTS.includes(slot) || !p.jewels[slot]) return;
      const item = p.jewels[slot]!;
      if (roomFor(p, item) < 1) return this.say(client, "Your inventory is full.");
      p.jewels[slot] = null;
      this.give(p, item, 1, null, true);
      this.say(client, `You take off the ${ITEMS[item].single}.`);
      this.jewelsChanged(client, p);
    });
    // Drink a health potion.
    this.onMessage("drink", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      const item = p.inventory[msg.slot];
      if (item !== POTION_ID && !isPotion(item)) return;
      const questDrink = this.step(p)?.goal.kind === "drink"; // the trainer asked you to, so you can even at full health
      const now = Date.now();
      if (now < p.potionReadyAt) return this.say(client, `You need a moment before another potion (${Math.ceil((p.potionReadyAt - now) / 1000)}s).`);
      const effect = isPotion(item) ? potionEffect(item, levelForXp(p.skillXp.alchemy)) : { heal: POTION_HEAL, stamina: 0, mana: 0, buffs: [], minutes: 0, tithe: 0 };
      const manaMax = this.maxManaOf(p);
      if (effect.tithe && !p.tithe && !questDrink) return this.say(client, "You don't have any Tithe marks to clear.");
      const useful = (effect.tithe && p.tithe) || (effect.heal && p.hp < p.maxHp) || (effect.stamina && p.stamina < p.maxStamina) || (effect.mana && p.mana < manaMax) || effect.buffs.length;
      if (!useful && !questDrink) {
        return this.say(client, effect.heal ? `You're already at full health (${p.maxHp}).` : effect.stamina ? "Your stamina is already full." : "Your mana is already full.");
      }
      takeFromEntry(p, msg.slot, 1);
      p.potionReadyAt = now + POTION_COOLDOWN_MS;
      const got: string[] = [];
      if (effect.heal) { const b = p.hp; p.hp = Math.min(p.maxHp, p.hp + effect.heal); got.push(`+${p.hp - b} health (${p.hp}/${p.maxHp})`); }
      if (effect.stamina) { const b = p.stamina; p.stamina = Math.min(p.maxStamina, p.stamina + effect.stamina); got.push(`+${p.stamina - b} stamina`); }
      if (effect.mana) { const b = p.mana; p.mana = Math.min(manaMax, p.mana + effect.mana); got.push(`+${p.mana - b} mana`); }
      if (effect.tithe && p.tithe) {
        p.tithe = Math.max(0, p.tithe - effect.tithe);
        if (!p.tithe) p.titheXp = 0;
        got.push(`a Tithe mark fades (${p.tithe} left)`);
      }
      for (const b of effect.buffs) {
        p.buffs[b.id] = { until: worldNow() + effect.minutes * 60_000, power: b.power };
        got.push(`${BUFFS[b.id].icon} ${BUFFS[b.id].describe(b.power)} for ${effect.minutes} minutes`);
      }
      p.stepMs = this.stepMsOf(p);
      this.say(client, `You drink the ${ITEMS[item].single}. ${got.join(", ")}.`);
      this.sendInventory(client, p);
      this.sendVitals(client, p);
      this.sendStamina(client, p);
      this.sendBuffs(client, p);
      this.questEvent(p, client, { kind: "drink" });
      this.saveSoon(p);
    });
}
