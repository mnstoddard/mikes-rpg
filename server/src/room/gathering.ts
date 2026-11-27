// Chopping, mining, fishing and digging.
// Part of the game room (server/src/WorldRoom.ts), split out to keep each file to one job.
import { Client } from "colyseus";
import { isDanger } from "../../../shared/map";
import { Point } from "../../../shared/pathfinding";
import { RESOURCES, ROCK_EMPTY_CHANCE, ResourceId, TREE_FALL_CHANCE, PATCH_EMPTY_CHANCE, isDigPatch, rollForageFind, fishAt, gatherChancePerTick, gatherStepPerTick, gatherSuccessChance, steadyGather, masteryIn, nodeAt, treeKey } from "../../../shared/foraging";
import { GatherSkill, SkillId, findSkill, isUnlocked, levelForXp } from "../../../shared/disciplines";
import { TOOL_TYPES, toolBonus, toolForSkill, wearFor } from "../../../shared/tools";
import { ITEMS } from "../../../shared/items";
import { clearEntry, entriesInOrder } from "../../../shared/bag";
import { isNight } from "../../../shared/daynight";
import { rollGemSize, roughId, soulStoneId } from "../../../shared/jewelry";
import { STAMINA_COST } from "../../../shared/cooking";
import { BAITS, BaitId, MUSHROOM_CHANCE, WORM_CHANCE, isBait } from "../../../shared/handicraft";
import { TreeEffect, treeBonus } from "../../../shared/skilltree";
import { gateOpen } from "../../../shared/quests";
import { Player } from "./schema";
import { FAST_GATHER_FOR_TESTS, worldNow, isRock, isTree, aOr, verbFor } from "./common";
import type { WorldRoom } from "../WorldRoom";

export const gatheringMethods = {
  /** Walk next to a tree, rock or the water, then start working it on the next tick. */
  startGathering(this: WorldRoom, client: Client, p: Player, resource: ResourceId, target: Point) {
    const res = RESOURCES[resource];
    const skill = res.skill;
    const { def } = findSkill(skill);
    if (!isUnlocked(p.unlocked, skill)) return this.say(client, this.notTaught(skill, p));
    const skillLevel = levelForXp(p.skillXp[skill]);
    if (skillLevel < res.level) {
      return this.say(client, `You need ${def.name} level ${res.level} to ${verbFor(resource)}. (You're level ${skillLevel}.)`);
    }
    const blocked = this.toolBlock(p, skill);
    if (blocked) return this.say(client, blocked);
    this.breakInvisible(p, client, "gather");
    if (!this.hasStamina(client, p, skill)) return;
    this.stopActions(p);
    p.target = target;
    p.activity = skill;
    p.resource = resource;
    p.path = this.pathNextTo(p, target);
    if (!p.path.length && !this.isNextTo(p, target)) {
      this.stopActions(p);
      this.say(client, "You can't reach that.");
    }
  },
  gatherTick(this: WorldRoom, p: Player, sessionId: string) {
    const client = this.clients.getById(sessionId);
    const t = p.target!;
    const skill = p.activity;
    const resource = p.resource;
    if (!skill || !resource || !this.isNextTo(p, t)) return this.stopActions(p);
    // Someone else felled the tree or emptied the rock.
    if (skill !== "fishing" && this.state.depleted.has(treeKey(t.x, t.y))) return this.stopActions(p);

    const res = RESOURCES[resource];
    if (!this.fits(p, res.item)) {
      if (client) this.say(client, this.fullReason(p, res.item));
      return this.stopActions(p);
    }

    const item = ITEMS[res.item];
    const gather = skill as GatherSkill;
    const tool = toolForSkill(skill)!;
    const belt = p.belt[tool];
    const ACTIONS = { woodcutting: "chopping", fishing: "fishing", mining: "mining", foraging: "digging" } as const;
    const START = {
      woodcutting: `You swing at the ${res.node.toLowerCase()}.`,
      fishing: "You cast out your line...",
      mining: `You swing your pick at the ${res.node.toLowerCase()}.`,
      foraging: "You start digging at the patch.",
    };
    const action = ACTIONS[gather];
    const blocked = this.toolBlock(p, skill);
    if (blocked) {
      if (client) this.say(client, blocked);
      return this.stopActions(p);
    }
    if (p.action !== action) {
      p.action = action;
      p.gatherFill = 0;
      p.faceX = t.x;
      p.faceY = t.y;
      if (client) {
        this.say(client, START[gather] + (belt ? "" : ` It's much faster with ${aOr(TOOL_TYPES[tool].name.toLowerCase())} on your belt. The trainers sell them.`));
      }
      return;
    }

    if (p.stamina < STAMINA_COST[skill]) {
      if (client) this.hasStamina(client, p, skill);
      return this.stopActions(p);
    }
    const mastery = masteryIn(p.mastery, resource);
    // Fishing uses the first unlocked bait in your bag (see shared/handicraft.ts).
    const baitSlot = skill === "fishing" ? entriesInOrder(p).find((e) => isBait(p.inventory[e]) && !p.locked[e]) ?? -1 : -1;
    const bait = baitSlot >= 0 ? BAITS[p.inventory[baitSlot] as BaitId] : null;
    // Faster with the skill tree's "Quick hands", and with speed bait.
    const boost = 1 + this.tree(p, skill, "speed") + (bait?.effect === "speed" ? bait.amount : 0);
    if (!FAST_GATHER_FOR_TESTS) {
      const tb = belt ? toolBonus(belt.item) : null;
      if (steadyGather(resource)) {
        // Steady (version 0.22): each swing fills toward the next log, no lucky streaks.
        p.gatherFill += gatherStepPerTick(resource, mastery, tb) * boost;
        if (p.gatherFill < p.gatherNeed) return;
        p.gatherFill = 0;
        p.gatherNeed = 0.85 + Math.random() * 0.3;
      } else if (Math.random() >= gatherChancePerTick(resource, mastery, tb) * boost) return;
    }
    if (Math.random() >= gatherSuccessChance(resource, mastery)) {
      // Never happens yet (success is always 100%); here for harder types later.
      if (client) this.say(client, skill === "fishing" ? "Something bites, but it gets away." : "You don't manage to get anything.");
      return;
    }

    // Dig patches: what you turn up is rolled from what your Foraging level can find (moonpetal only at night).
    const find = skill === "foraging" ? rollForageFind(levelForXp(p.skillXp.foraging), isNight(worldNow())) : null;
    // Gem rocks and emberstone veins: the size is rolled (bigger with Mining level and this rock's Mastery).
    const size = res.gem ? rollGemSize(levelForXp(p.skillXp.mining), res.level, mastery) : 0;
    const gotItem = find ? find.item : res.gem === "soul" ? soulStoneId(size) : res.gem ? roughId(res.gem, size) : res.item;
    const gotXp = find ? find.xp : res.xp;
    const got = ITEMS[gotItem];
    if (!this.give(p, gotItem)) {
      if (client) this.say(client, this.fullReason(p, gotItem));
      return this.stopActions(p);
    }
    if (skill === "fishing") this.broadcast("caught", { id: sessionId, item: gotItem }); // everyone sees the fish come out of the water
    if (!this.roll(p, skill, "staminaSave")) this.useStamina(p, skill);
    this.questEvent(p, client, { kind: "gather", skill: gather, resource, withTool: !!belt });
    this.wearTool(p, client, tool, wearFor(res.level));
    const extras: string[] = [];
    // A second one: the skill tree's "Lucky find", or glow bait.
    const luck = this.tree(p, skill, "double") + (bait?.effect === "double" ? bait.amount : 0);
    if (Math.random() < luck && this.give(p, gotItem)) extras.push(`a second ${got.single}`);
    // Now and then you dig up a worm (for bait) or find a mushroom (for cooking).
    if (skill !== "fishing" && skill !== "foraging" && Math.random() < WORM_CHANCE && this.give(p, "worm")) extras.push("a worm");
    if (skill === "woodcutting" && Math.random() < MUSHROOM_CHANCE && this.give(p, "mushroom")) extras.push("a mushroom");
    if (bait) this.useBait(p, client, baitSlot);
    if (client) {
      this.sendInventory(client, p);
      this.sendStamina(client, p);
      const GOT = {
        woodcutting: `You get some ${item.name.toLowerCase()}.`,
        mining: res.gem ? `You mine ${aOr(got.single)}!${size >= 30 ? " 💎 A big one!" : ""}` : `You mine some ${item.name.toLowerCase()}.`,
        fishing: `You catch ${aOr(item.single)}!`,
        foraging: `You dig up ${aOr(got.single)}!` + (find?.night ? " 🌙 It only opens at night." : ""),
      };
      this.say(client, GOT[gather] + (extras.length ? ` You also get ${extras.join(" and ")}!` : ""));
    }
    // Chum bait: more Fishing XP (the skill only, like the tree's "Quick learner").
    const skillXp = bait?.effect === "xp" ? Math.round(gotXp * (1 + bait.amount)) : gotXp;
    this.addMasteryXp(p, client, resource, gotXp);
    this.addSkillXp(p, client, skill, skillXp); // sends both skill levels and Mastery
    this.saveSoon(p);

    if (skill === "fishing") return; // fishing spots never run out
    const isTreeNode = skill === "woodcutting";
    const emptyChance = isTreeNode ? TREE_FALL_CHANCE : skill === "foraging" ? PATCH_EMPTY_CHANCE : ROCK_EMPTY_CHANCE;
    if (Math.random() < emptyChance) {
      this.state.depleted.set(treeKey(t.x, t.y), this.state.tick + res.respawnTicks);
      if (client) this.say(client, isTreeNode ? "The tree falls down." : skill === "foraging" ? "The patch is dug out. It'll glint again in a while." : "The rock is out of ore.");
      // Everyone working this tree or rock stops.
      this.state.players.forEach((other) => {
        if (other.activity === skill && other.target?.x === t.x && other.target?.y === t.y) this.stopActions(other);
      });
    }
  },
  /** One catch uses up a little of the bait. When it runs out, it's gone. */
  useBait(this: WorldRoom, p: Player, client: Client | undefined, slot: number) {
    const left = (p.durability[slot] ?? 1) - 1;
    if (left > 0) { p.durability[slot] = left; return; }
    const name = ITEMS[p.inventory[slot]!].single;
    clearEntry(p, slot);
    if (client) this.say(client, `You've used up your ${name}.`);
  },
  // ---- Mastery skill trees (shared/skilltree.ts) ----

  /** What a skill's tree gives this player for one effect (0.1 = 10%). */
  tree(this: WorldRoom, p: Player, skill: SkillId, effect: TreeEffect) {
    return treeBonus(p.tree, skill, effect) + this.toolEnchant(p, skill, effect);
  },
  /** A chance from the skill tree plus the tool's enchantment (e.g. "does this cost no stamina?"). */
  roll(this: WorldRoom, p: Player, skill: SkillId, effect: TreeEffect) {
    return Math.random() < this.tree(p, skill, effect);
  },
};

/** The messages from players about this. */
export function registerGathering(this: WorldRoom) {
    this.onMessage("chop", (client, msg: { x: number; y: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.x) || !Number.isInteger(msg?.y)) return;
      if (!isTree(msg.x, msg.y)) return;
      if (this.state.depleted.has(treeKey(msg.x, msg.y))) return this.say(client, "That tree has been cut down.");
      this.startGathering(client, p, nodeAt(msg.x, msg.y)!, { x: msg.x, y: msg.y });
    });
    this.onMessage("mine", (client, msg: { x: number; y: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.x) || !Number.isInteger(msg?.y)) return;
      if (!isRock(msg.x, msg.y)) return;
      if (this.state.depleted.has(treeKey(msg.x, msg.y))) return this.say(client, "There's no ore left in that rock right now.");
      this.startGathering(client, p, nodeAt(msg.x, msg.y)!, { x: msg.x, y: msg.y });
    });
    this.onMessage("dig", (client, msg: { x: number; y: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.x) || !Number.isInteger(msg?.y)) return;
      if (!isDigPatch(msg.x, msg.y)) return;
      if (this.state.depleted.has(treeKey(msg.x, msg.y))) return this.say(client, "That patch has been dug out. It'll glint again soon.");
      if (isDanger(msg.x, msg.y) && !isDanger(p.x, p.y) && !gateOpen(p.quest)) return this.say(client, this.notReady());
      this.startGathering(client, p, "dig", { x: msg.x, y: msg.y });
    });
    this.onMessage("fish", (client, msg: { x: number; y: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.x) || !Number.isInteger(msg?.y)) return;
      const fish = fishAt(msg.x, msg.y);
      if (!fish) return;
      this.startGathering(client, p, fish, { x: msg.x, y: msg.y });
    });
}
