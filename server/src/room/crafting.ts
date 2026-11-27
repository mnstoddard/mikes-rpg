// Smelting, smithing, cooking, handicraft, alchemy and gem cutting at the stations.
// Part of the game room (server/src/WorldRoom.ts), split out to keep each file to one job.
import { Client } from "colyseus";
import { type } from "@colyseus/schema";
import { percent } from "../../../shared/mastery";
import { SkillId, findSkill, isUnlocked, levelForXp } from "../../../shared/disciplines";
import { Recipe, failXp, gearDurability, recipeFor, recipeWear, successFor } from "../../../shared/crafting";
import { isGear } from "../../../shared/gear";
import { TOOL_TYPES, TOOL_WARN_AT, ToolType, isTool, maxDurability, parseTool, toolBonus, toolForSkill } from "../../../shared/tools";
import { ITEMS, ItemId } from "../../../shared/items";
import { NPCS } from "../../../shared/npcs";
import { cloneBag, countItem, entriesInOrder, roomFor, takeFromEntry, takeItem } from "../../../shared/bag";
import { weightOf } from "../../../shared/weight";
import { OVERLOAD_MAX } from "../../../shared/stats";
import { EnchantId, enchantTotal, swiftPercent, bountyPercent, tirelessPercent, wisdomPercent } from "../../../shared/enchanting";
import { GemId, CUT_KEEPS, CUT_LEVEL, carats, cutId, cutXp, parseGem, rollCut, soulGemId } from "../../../shared/jewelry";
import { POTIONS, describeEffect, isPotion, parsePotion, potionEffect } from "../../../shared/alchemy";
import { DISHES, STAMINA_COST, foodStamina, parseMeal } from "../../../shared/cooking";
import { BAITS, SCRAPS_CHANCE, isBait } from "../../../shared/handicraft";
import { TreeEffect, treeRoll } from "../../../shared/skilltree";
import { stewsBurn } from "../../../shared/quests";
import { Bounty } from "../../../shared/bounties";
import { Player } from "./schema";
import { CRAFT_TICKS, STATION_FOR, aOr } from "./common";
import type { WorldRoom } from "../WorldRoom";

export const craftingMethods = {
  /** One try at the furnace or anvil every few ticks: it works or it fails (losing the inputs). */
  craftTick(this: WorldRoom, p: Player, sessionId: string) {
    const client = this.clients.getById(sessionId);
    const job = p.crafting!;
    const { recipe, station } = job;
    if (!this.nearNpc(p, station.id)) return this.stopActions(p);
    if (++p.craftTimer < CRAFT_TICKS) return;
    p.craftTimer = 0;

    const missing = this.missingInputs(p, recipe);
    if (missing) {
      if (client) this.say(client, `You've run out: you need ${missing}.`);
      return this.stopActions(p);
    }
    if (p.stamina < STAMINA_COST[recipe.skill]) {
      if (client) this.hasStamina(client, p, recipe.skill);
      return this.stopActions(p);
    }
    // Will what you make fit, once the inputs are used up?
    const after = cloneBag(p);
    for (const input of recipe.inputs) takeItem(after, input, 1, (i) => !after.locked[i]);
    const inputsWeight = recipe.inputs.reduce((sum, i) => sum + weightOf(i), 0);
    if (roomFor(after, recipe.output) < 1 || this.carried(p) - inputsWeight + weightOf(recipe.output) > this.capacity(p) * OVERLOAD_MAX) {
      if (client) this.say(client, roomFor(after, recipe.output) < 1 ? "Your bag is full. Make room first." : this.fullReason(p, recipe.output));
      return this.stopActions(p);
    }
    if (!this.roll(p, recipe.skill, "staminaSave")) this.useStamina(p, recipe.skill);
    // Use the inputs (never locked ones).
    for (const input of recipe.inputs) takeItem(p, input, 1, (i) => !p.locked[i]);
    const output = ITEMS[recipe.output];
    const chance = this.craftChance(p, recipe);
    const forced = this.forcedCraft(p, recipe); // the tutorial's first stew always burns; some tries always work
    const worked = forced ? forced === "success" : Math.random() < chance;
    const xp = worked ? recipe.xp : failXp(recipe.xp);
    if (worked) this.give(p, recipe.output, recipe.makes ?? 1);
    else for (const kept of recipe.keepOnFail ?? []) this.give(p, kept); // a spoiled brew leaves the vial; a botched ring, the gem
    // Hidden potion recipes: brewing one is how you find it.
    const brewed = worked ? parsePotion(recipe.output) : null;
    if (brewed && POTIONS[brewed.type].hidden && !p.discovered.includes(brewed.type)) {
      p.discovered.push(brewed.type);
      if (client) {
        this.say(client, `✨ You've discovered a hidden recipe: ${POTIONS[brewed.type].name}! It's in your recipe list now.`);
        client.send("discovered", p.discovered);
      }
    }
    const tool = toolForSkill(recipe.skill);
    if (tool) this.wearTool(p, client, tool, recipeWear(recipe));
    const extras: string[] = [];
    // The skill tree's "Extra bar" / "Bait bundle": sometimes you make two.
    if (worked && this.roll(p, recipe.skill, "extra") && this.give(p, recipe.output)) extras.push(`a second ${output.single}`);
    // Cooking leaves food scraps behind now and then (for chum bait).
    if (worked && recipe.skill === "cooking" && Math.random() < SCRAPS_CHANCE && this.give(p, "food_scraps")) extras.push("some food scraps");
    if (client) {
      this.sendInventory(client, p);
      this.sendStamina(client, p);
      const WORKED = {
        smelting: `You smelt ${aOr(output.single)}.`,
        smithing: `You make ${aOr(output.single)}!`,
        cooking: `You cook ${aOr(output.single)}! Eat it for ${foodStamina(recipe.output, p.mastery, this.tree(p, "cooking", "mealStamina"))} stamina.`,
        handicraft: recipe.makes ? `You make ${recipe.makes} ${output.name.toLowerCase()}.` : `You make ${aOr(output.single)}.`,
        alchemy: `You brew ${aOr(output.single)}! ${isPotion(recipe.output) ? `${describeEffect(potionEffect(recipe.output, levelForXp(p.skillXp.alchemy)))}.` : ""}`,
      };
      const FAILED = {
        smelting: `The ore burns away. You fail to smelt ${aOr(output.single)}.`,
        smithing: `You ruin the metal. You fail to make ${aOr(output.single)}.`,
        cooking: `You burn the ${output.single}. The ingredients and the log are gone.`,
        handicraft: `It falls apart in your hands. You fail to make ${aOr(output.single)}.`,
        alchemy: "The mixture curdles and spoils. The ingredients are gone, but you keep the vial.",
      };
      this.say(client, (worked ? WORKED : FAILED)[recipe.skill] + (extras.length ? ` You also get ${extras.join(" and ")}!` : ""));
    }
    this.addMasteryXp(p, client, recipe.mastery, xp);
    this.addSkillXp(p, client, recipe.skill, xp);
    this.questEvent(p, client, { kind: "craft", item: recipe.output, worked });
    if (worked && recipe.skill === "alchemy") this.guildJob(p, client, "brew");
    this.saveSoon(p);

    if (--job.remaining <= 0) return this.stopActions(p);
    const next = this.missingInputs(p, recipe);
    if (next) {
      if (client) this.say(client, `You've run out: you need ${next}.`);
      this.stopActions(p);
    }
  },
  /** "1 tin ore" if you're short of something for this recipe (locked items don't count), else null. */
  missingInputs(this: WorldRoom, p: Player, recipe: Recipe): string | null {
    const need = new Map<ItemId, number>();
    for (const i of recipe.inputs) need.set(i, (need.get(i) ?? 0) + 1);
    const short: string[] = [];
    for (const [item, n] of need) {
      const have = countItem(p, item, (i) => !p.locked[i]);
      if (have < n) short.push(`${n - have} ${n - have === 1 ? ITEMS[item].single : ITEMS[item].name.toLowerCase()}`);
    }
    return short.length ? short.join(" and ") : null;
  },
  /** Uses left on a tool, weapon or armor (new ones are full); null for everything else. */
  usesFor(this: WorldRoom, item: ItemId, durability?: number | null): number | null {
    return isTool(item) ? durability ?? maxDurability(item) : isGear(item) ? durability ?? gearDurability(item)
      : isBait(item) ? durability ?? BAITS[item].uses : null;
  },
  /** What the enchantment on this skill's belt tool adds (Swiftness, Bounty, Tireless, Wisdom), as a fraction. */
  toolEnchant(this: WorldRoom, p: Player, skill: SkillId, effect: TreeEffect): number {
    const type = toolForSkill(skill);
    const item = type ? p.belt[type]?.item : null;
    if (!item) return 0;
    const total = (id: EnchantId) => enchantTotal([item], id);
    switch (effect) {
      case "speed": return swiftPercent(total("swift")) / 100;
      case "double": case "extra": return bountyPercent(total("bounty")) / 100;
      case "staminaSave": return tirelessPercent(total("tireless")) / 100;
      case "xp": return wisdomPercent(total("wisdom")) / 100;
      default: return 0;
    }
  },
  /** Your chance at one crafting try: Mastery, belt tool, and the skill tree's "Steady hands". */
  craftChance(this: WorldRoom, p: Player, recipe: Recipe) {
    return successFor(recipe, p.mastery, p.belt, this.tree(p, recipe.skill, "success"), levelForXp(p.skillXp[recipe.skill as SkillId] ?? 0));
  },
  /** Each use wears the belt tool down. Warn at 10%; at 0 it breaks: it goes back in your bag, Broken, until it's repaired. */
  wearTool(this: WorldRoom, p: Player, client: Client | undefined, type: ToolType, amount: number) {
    const t = p.belt[type];
    if (!t || treeRoll(p.tree, "smithing", "toolCare")) return;
    const max = maxDurability(t.item);
    const before = t.durability;
    t.durability = Math.max(0, t.durability - amount);
    if (t.durability <= 0) {
      p.belt[type] = null;
      const kept = this.give(p, t.item, 1, 0, true) > 0;
      if (client) {
        this.say(client, kept ? `Your ${ITEMS[t.item].single} breaks! It goes in your bag. The Repairer at the Mages' Guild can fix it.`
          : `Your ${ITEMS[t.item].single} breaks, and with no room in your bag, it falls apart.`);
        this.sendInventory(client, p);
      }
      this.questEvent(p, client, { kind: "toolBreak", tool: type });
    } else if (before > max * TOOL_WARN_AT && t.durability <= max * TOOL_WARN_AT) {
      if (client) this.say(client, `Your ${ITEMS[t.item].single} is about to break (${t.durability} uses left).`);
    }
    if (client) {
      client.send("belt", p.belt);
      this.sendQuest(client, p); // "5 uses left" on the tracker
    }
  },
  /** "+10% gathering speed, 150 uses" */
  toolEffect(this: WorldRoom, item: ItemId) {
    if (!isTool(item)) return "";
    const { type } = parseTool(item);
    const bonus = Math.round(toolBonus(item) * 100);
    return TOOL_TYPES[type].helps === "speed" ? `+${bonus}% ${findSkill(TOOL_TYPES[type].skill).def.name} speed` : `${bonus}% fewer ${findSkill(TOOL_TYPES[type].skill).def.name} failures`;
  },
  /** The tutorial makes some crafting turn out a set way: every stew burns until Maren explains it, and some tries always work. */
  forcedCraft(this: WorldRoom, p: Player, recipe: Recipe): "fail" | "success" | null {
    if (recipe.skill === "cooking" && stewsBurn(p.quest)) return "fail";
    const step = this.step(p);
    if (!step) return null;
    if (step.guaranteed && step.goal.kind === "craft" && recipe.output.startsWith(step.goal.prefix)) return "success";
    // A story step that asks you to bring something you make: the ones you need always work.
    if (step.guaranteed && step.goal.kind === "have") {
      const need = (step.goal.items as Record<string, number>)[recipe.output];
      if (need && countItem(p, recipe.output) < need) return "success";
    }
    return null;
  },
  /** Is this step's work refused right now? (Needs a tool you've taken off, or must be done by hand.) Returns what to say. */
  toolBlock(this: WorldRoom, p: Player, skill: SkillId): string | null {
    const step = this.step(p);
    if (!step) return null;
    const tool = toolForSkill(skill);
    if (!tool) return null;
    const name = TOOL_TYPES[tool].name.toLowerCase();
    if (step.needsTool === tool && !p.belt[tool]) {
      return `${this.giverName(p)} wants you to use your ${name} for this. Click it in your bag and press "Equip" first.`;
    }
    const g = step.goal;
    if (g.kind === "gather" && g.byHand && g.skill === skill && p.belt[tool]) {
      return `${this.giverName(p)} asked you to do this by hand. Take the ${name} off your belt first (click it on the belt).`;
    }
    return null;
  },
};

/** The messages from players about this. */
export function registerCrafting(this: WorldRoom) {
    // At the furnace, anvil or stove: make one, or keep going until you run out.
    this.onMessage("craft", (client, msg: { item: string; all?: boolean }) => {
      const p = this.state.players.get(client.sessionId);
      const recipe = p && recipeFor(msg?.item as ItemId);
      if (!p || !recipe) return;
      const station = NPCS.find((n) => n.id === (recipe.station ?? STATION_FOR[recipe.skill]))!;
      if (!this.nearNpc(p, station.id)) return this.say(client, `You need to be next to the ${station.name.toLowerCase()}.`);
      if (!isUnlocked(p.unlocked, recipe.skill)) return this.say(client, this.notTaught(recipe.skill));
      const blocked = this.toolBlock(p, recipe.skill);
      if (blocked) return this.say(client, blocked);
      if (!this.hasStamina(client, p, recipe.skill)) return;
      const level = levelForXp(p.skillXp[recipe.skill]);
      if (level < recipe.level) {
        return this.say(client, `You need ${findSkill(recipe.skill).def.name} level ${recipe.level} to make ${aOr(ITEMS[recipe.output].single)}. (You're level ${level}.)`);
      }
      const meal = parseMeal(recipe.output);
      if (meal) {
        const dish = DISHES[meal.dish];
        if (level < dish.level) return this.say(client, `You need Cooking level ${dish.level} to cook ${dish.name.toLowerCase()}. (You're level ${level}.)`);
        const slots = this.potSize(p);
        if (meal.ingredients.length > slots) {
          return this.say(client, `Your pot only holds ${slots} ingredients. Spend Mastery points on "Bigger pot" in the Cooking skill tree for more.`);
        }
      }
      const missing = this.missingInputs(p, recipe);
      if (missing) return this.say(client, `You need ${missing} to make ${aOr(ITEMS[recipe.output].single)}.`);
      this.stopActions(p);
      p.crafting = { recipe, remaining: msg.all ? Infinity : 1, station };
      p.target = { x: station.x, y: station.y };
      p.activity = recipe.skill;
      p.craftTimer = 0;
      p.action = recipe.skill;
      p.faceX = station.x;
      p.faceY = station.y;
      const chance = this.craftChance(p, recipe);
      const tool = toolForSkill(recipe.skill);
      const verb = { smelting: "smelting", smithing: "making", cooking: "cooking", handicraft: "making", alchemy: "brewing" }[recipe.skill];
      this.say(client, `You start ${verb} ${msg.all ? ITEMS[recipe.output].name.toLowerCase() : aOr(ITEMS[recipe.output].single)}. ` +
        (this.forcedCraft(p, recipe) === "success" ? `${this.giverName(p)} is guiding your hand, so this one will work.`
          : `${percent(chance)} chance each.` + (!tool || p.belt[tool] || !recipe.needsTool ? "" : ` (No ${TOOL_TYPES[tool].name.toLowerCase()} on your belt: half the chance.)`)));
    });
    // Cut a rough gem (or emberstone) at the anvil. It can go well or badly; Smithing helps.
    this.onMessage("cut", (client, msg: { item: string }) => {
      const p = this.state.players.get(client.sessionId);
      const parsed = parseGem(msg?.item);
      if (!p || !parsed || (parsed.kind !== "rough" && parsed.kind !== "soulstone")) return;
      const g = parsed as { kind: "rough" | "soulstone"; gem: GemId; size: number };
      const item = msg.item as ItemId;
      if (!this.nearNpc(p, "anvil")) return this.say(client, "You need to be next to the anvil in Smith Brann's smithy.");
      if (!isUnlocked(p.unlocked, "smithing")) return this.say(client, this.notTaught("smithing"));
      const need = CUT_LEVEL[g.kind === "soulstone" ? "soul" : g.gem];
      const level = levelForXp(p.skillXp.smithing);
      if (level < need) return this.say(client, `You need Smithing level ${need} to cut that. (You're level ${level}.)`);
      const slot = entriesInOrder(p).find((e) => p.inventory[e] === item && !p.locked[e]);
      if (slot == null) return this.say(client, "You don't have that (unlocked) in your bag.");
      if (!this.hasStamina(client, p, "smithing")) return;
      takeFromEntry(p, slot, 1);
      if (!treeRoll(p.tree, "smithing", "staminaSave")) this.useStamina(p, "smithing");
      if (g.kind === "soulstone") {
        // Emberstone always cuts cleanly: the gem is the stone's size.
        this.give(p, soulGemId(g.size), 1, null, true);
        this.say(client, `You cut the emberstone into an empty refined emberstone, ${carats(g.size)}.`);
      } else {
        const result = rollCut(level);
        const size = Math.round(g.size * CUT_KEEPS[result]);
        if (result === "shattered" || size < 1) {
          this.say(client, `💥 The ${ITEMS[item].single.replace(/^rough /, "")} shatters under your chisel. It's gone.`);
        } else {
          this.give(p, cutId(g.gem, size), 1, null, true);
          const how = { flawless: "A flawless cut! ✨", good: "A good cut.", clumsy: "A clumsy cut: you lose quite a bit of it." }[result];
          this.say(client, `${how} You get ${aOr(ITEMS[cutId(g.gem, size)].single)}.`);
        }
      }
      this.addSkillXp(p, client, "smithing", cutXp(g.size));
      this.sendInventory(client, p);
      this.sendStamina(client, p);
      this.saveSoon(p);
    });
}
