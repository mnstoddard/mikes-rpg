import { Room, Client, ServerError } from "colyseus";
import { MapSchema, Schema, type } from "@colyseus/schema";
import { MAP, MAP_HEIGHT, MAP_WIDTH, TICK_MS, isWalkable, randomSpawn } from "../../shared/map";
import { findPath, Point } from "../../shared/pathfinding";
import {
  RESOURCES, ROCK_EMPTY_CHANCE, ResourceId, TREE_FALL_CHANCE,
  fishAt, gatherChancePerTick, gatherSuccessChance, masteryIn, nodeAt, resourcesFor, treeKey,
} from "../../shared/foraging";
import {
  ItemMasteryXp, MasteryId, masteryIn as masteryLevelIn, masteryLevelForXp, percent,
  speedBonusPercent, valueBonusPercent,
} from "../../shared/mastery";
import {
  DISCIPLINES, DISCIPLINE_IDS, DisciplineId, DisciplineXp, GatherSkill, SkillId, SkillXp, emptyDisciplines,
  emptySkills, findSkill, isCraftSkill, levelForXp, xpForLevel,
} from "../../shared/disciplines";
import {
  ALL_MASTERY_IDS, Recipe, SHOP_STOCK, buyPriceFor, failXp, masteryName, recipeFor, recipeWear, sellPriceFor,
  successFor,
} from "../../shared/crafting";
import {
  Belt, METALS, TOOL_TYPES, TOOL_TYPE_IDS, TOOL_WARN_AT, ToolType, emptyBelt, isTool, maxDurability, parseTool,
  toolBonus, toolForSkill, wearFor,
} from "../../shared/tools";
import { INVENTORY_SIZE, ITEMS, ItemId, LEGACY_ITEMS } from "../../shared/items";
import { NPCS, NpcDef, npcById } from "../../shared/npcs";
import { formatMoney } from "../../shared/money";
import { Account, SaveData, checkPassword, hashPassword, store, usernameKey } from "./storage";

const STEP_LOOP_MS = 50; // how often the server checks whether someone should take a step
const AUTOSAVE_TICKS = 100; // 100 x 0.6s = once a minute
const MIN_SAVE_GAP_MS = 10_000; // "important" saves happen right away, but at most every 10s per player
const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,11}$/;
const MIN_PASSWORD = 6;
const CRAFT_TICKS = 3; // one smelt or smith every 3 ticks (1.8s); crafting is about success, not speed

// Shared by every room on this server process.
const online = new Set<string>(); // username keys currently logged in
const pendingSaves = new Map<string, Promise<void>>(); // logout saves still being written
const failedLogins = new Map<string, { count: number; until: number }>();
// Players whose connection dropped (phone switched apps, Wi-Fi blip). They get
// RECONNECT_SECONDS to come back as if nothing happened before being logged out.
const RECONNECT_SECONDS = 120;
const waitingToReconnect = new Map<string, { reject: Function }>();

export class Player extends Schema {
  @type("string") name = "";
  @type("number") x = 0; // tile coordinates
  @type("number") y = 0;
  @type("number") color = 0xffffff;
  @type("string") action = "idle"; // "idle" | "chopping" | "fishing" | "mining" | "smelting" | "smithing" (so others see the animation)
  @type("number") faceX = 0; // tile the player is working on, for the animation
  @type("number") faceY = 0;

  // Server-only (not synced to everyone):
  path: Point[] = [];
  target: Point | null = null; // tree or water the player is heading to / working on
  activity: SkillId | null = null; // what they'll do when they get there
  resource: ResourceId | null = null; // which type of tree / rock / fish
  inventory: (ItemId | null)[] = new Array(INVENTORY_SIZE).fill(null);
  durability: (number | null)[] = new Array(INVENTORY_SIZE).fill(null); // per slot: uses left, for tools
  belt: Belt = emptyBelt(); // equipped tools (don't use bag space)
  crafting: { recipe: Recipe; remaining: number; station: NpcDef } | null = null; // smelting / smithing in progress
  craftTimer = 0;
  disciplines: DisciplineXp = emptyDisciplines(); // XP per Discipline
  skillXp: SkillXp = emptySkills(); // XP per skill (Woodcutting level etc.)
  mastery: ItemMasteryXp = {}; // Mastery XP per type (Pine, Copper, Trout...)
  coins = 0; // total money, in bronze coins
  locked: boolean[] = new Array(INVENTORY_SIZE).fill(false); // per slot: locked items can't be sold or dropped by accident
  talkTo: NpcDef | null = null; // person the player is walking over to talk to
  nextStepAt = 0; // time (ms) this player may take their next step
  dirty = false; // something changed since the last save
  lastSavedAt = 0;
}

export class WorldState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  /** Chopped-down trees and emptied rocks: key "x,y" -> tick when it comes back. */
  @type({ map: "number" }) depleted = new MapSchema<number>();
  @type("number") tick = 0;
}

const COLORS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1, 0xff6ec7];
const CARDINAL = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

const isRock = (x: number, y: number) =>
  y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH && MAP[y][x] === "rock";
const isTree = (x: number, y: number) =>
  y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH && MAP[y][x] === "tree";

/** "chop Oak trees", "mine Copper rocks", "fish at Trout spots": for messages. */
function verbFor(id: ResourceId) {
  const r = RESOURCES[id];
  if (r.skill === "woodcutting") return `chop ${r.node}s`;
  if (r.skill === "mining") return `mine ${r.node}s`;
  return id === "minnow" ? "catch Minnows" : `fish at ${r.node}s`;
}

export class WorldRoom extends Room<WorldState> {
  maxClients = 100;
  state = new WorldState();

  onCreate() {
    // Walking runs on each player's own 600ms step timer, so a click starts you
    // moving right away instead of waiting for the next world tick. Everything
    // else (chopping, trees growing back, saving) runs on the 600ms world tick.
    // State is sent out every 50ms so clients see changes as soon as they happen.
    this.setPatchRate(STEP_LOOP_MS);
    let sinceTick = 0;
    this.setSimulationInterval((dt) => {
      this.stepPlayers();
      sinceTick += dt;
      if (sinceTick >= TICK_MS) {
        sinceTick -= TICK_MS;
        this.gameTick();
      }
    }, STEP_LOOP_MS);

    // Clients only send intent; the server decides what actually happens.
    this.onMessage("move", (client, msg: { x: number; y: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.x) || !Number.isInteger(msg?.y)) return;
      if (!isWalkable(msg.x, msg.y)) return;
      this.stopActions(p);
      p.path = findPath({ x: p.x, y: p.y }, { x: msg.x, y: msg.y });
    });

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

    this.onMessage("fish", (client, msg: { x: number; y: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.x) || !Number.isInteger(msg?.y)) return;
      const fish = fishAt(msg.x, msg.y);
      if (!fish) return;
      this.startGathering(client, p, fish, { x: msg.x, y: msg.y });
    });

    this.onMessage("talk", (client, msg: { id: string }) => {
      const p = this.state.players.get(client.sessionId);
      const npc = npcById(String(msg?.id));
      if (!p || !npc) return;
      this.stopActions(p);
      if (this.isNextTo(p, npc)) return this.openShop(client, p, npc);
      p.talkTo = npc;
      p.path = this.pathNextTo(p, npc);
      if (!p.path.length) {
        p.talkTo = null;
        this.say(client, "You can't reach them.");
      }
    });

    // While the Merchant's shop is open, clicking an inventory item sells it.
    this.onMessage("sell", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      const item = p.inventory[msg.slot];
      if (!item) return;
      if (p.locked[msg.slot]) return this.say(client, `That ${ITEMS[item].single} is locked. Unlock it to sell it.`);
      if (!this.nearNpc(p, "merchant")) return this.say(client, "You need to be next to the Merchant to sell.");
      const price = sellPriceFor(item, p.mastery, p.durability[msg.slot]);
      p.inventory[msg.slot] = null;
      p.coins += price;
      this.sendInventory(client, p);
      this.say(client, `You sell 1 ${ITEMS[item].single} for ${formatMoney(price)}.`);
      this.saveSoon(p);
    });

    // Sell everything that isn't locked, in one go.
    this.onMessage("sellAll", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (!this.nearNpc(p, "merchant")) return this.say(client, "You need to be next to the Merchant to sell.");
      let count = 0;
      let total = 0;
      for (let i = 0; i < INVENTORY_SIZE; i++) {
        const item = p.inventory[i];
        if (!item || p.locked[i]) continue;
        total += sellPriceFor(item, p.mastery, p.durability[i]);
        p.inventory[i] = null;
        count++;
      }
      if (!count) return this.say(client, "You have nothing to sell that isn't locked.");
      p.coins += total;
      this.sendInventory(client, p);
      this.say(client, `You sell ${count} item${count === 1 ? "" : "s"} for ${formatMoney(total)}.`);
      this.saveSoon(p);
    });

    // Buy from the Merchant (he has endless stock). Prices don't use your Mastery.
    this.onMessage("buy", (client, msg: { item: string; count?: number }) => {
      const p = this.state.players.get(client.sessionId);
      const item = msg?.item as ItemId;
      if (!p || !SHOP_STOCK.includes(item)) return;
      if (!this.nearNpc(p, "merchant")) return this.say(client, "You need to be next to the Merchant to buy.");
      const want = Math.max(1, Math.min(28, Math.floor(Number(msg.count) || 1)));
      const price = buyPriceFor(item);
      let bought = 0;
      while (bought < want) {
        const free = p.inventory.indexOf(null);
        if (free === -1 || p.coins < price) break;
        p.coins -= price;
        this.place(p, free, item);
        bought++;
      }
      if (!bought) {
        return this.say(client, p.inventory.includes(null)
          ? `You need ${formatMoney(price)} for a ${ITEMS[item].single}.` : "Your inventory is full.");
      }
      this.sendInventory(client, p);
      this.say(client, `You buy ${bought} ${bought === 1 ? ITEMS[item].single : ITEMS[item].name.toLowerCase()} for ${formatMoney(price * bought)}.`);
      this.saveSoon(p);
    });

    // Click a tool in your bag to put it on your tool belt (swapping out the one there).
    this.onMessage("equip", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      const item = p.inventory[msg.slot];
      if (!isTool(item)) return;
      const type = parseTool(item).type;
      const old = p.belt[type];
      p.belt[type] = { item, durability: p.durability[msg.slot] ?? maxDurability(item) };
      p.inventory[msg.slot] = null;
      if (old) this.place(p, msg.slot, old.item, old.durability);
      this.sendInventory(client, p);
      this.say(client, `You put the ${ITEMS[item].single} on your belt: ${this.toolEffect(item)}.` +
        (old ? ` Your ${ITEMS[old.item].single} goes in your bag.` : ""));
      this.saveSoon(p);
    });

    // Click a tool on your belt to put it back in your bag.
    this.onMessage("unequip", (client, msg: { type: string }) => {
      const p = this.state.players.get(client.sessionId);
      const type = msg?.type as ToolType;
      if (!p || !TOOL_TYPE_IDS.includes(type) || !p.belt[type]) return;
      const free = p.inventory.indexOf(null);
      if (free === -1) return this.say(client, "Your inventory is full.");
      const t = p.belt[type]!;
      p.belt[type] = null;
      this.place(p, free, t.item, t.durability);
      this.sendInventory(client, p);
      this.say(client, `You take the ${ITEMS[t.item].single} off your belt.`);
      this.saveSoon(p);
    });

    // At the furnace or anvil: make one, or keep going until you run out.
    this.onMessage("craft", (client, msg: { item: string; all?: boolean }) => {
      const p = this.state.players.get(client.sessionId);
      const recipe = p && recipeFor(msg?.item as ItemId);
      if (!p || !recipe) return;
      const station = NPCS.find((n) => n.id === (recipe.skill === "smelting" ? "furnace" : "anvil"))!;
      if (!this.nearNpc(p, station.id)) return this.say(client, `You need to be next to the ${station.name.toLowerCase()}.`);
      const { discipline, def } = findSkill(recipe.skill);
      if (levelForXp(p.disciplines[discipline]) < def.unlockLevel) {
        return this.say(client, `You need ${DISCIPLINES[discipline].name} level ${def.unlockLevel} to use ${def.name}. Make a few tools at the anvil first.`);
      }
      const level = levelForXp(p.skillXp[recipe.skill]);
      if (level < recipe.level) {
        return this.say(client, `You need ${def.name} level ${recipe.level} to make a ${ITEMS[recipe.output].single}. (You're level ${level}.)`);
      }
      const missing = this.missingInputs(p, recipe);
      if (missing) return this.say(client, `You need ${missing} to make a ${ITEMS[recipe.output].single}.`);
      this.stopActions(p);
      p.crafting = { recipe, remaining: msg.all ? Infinity : 1, station };
      p.target = { x: station.x, y: station.y };
      p.activity = recipe.skill;
      p.craftTimer = 0;
      p.action = recipe.skill;
      p.faceX = station.x;
      p.faceY = station.y;
      const chance = successFor(recipe, p.mastery, p.belt);
      const tool = toolForSkill(recipe.skill)!;
      this.say(client, `You start ${recipe.skill === "smelting" ? "smelting" : "making"} ${msg.all ? "" : "a "}${msg.all ? ITEMS[recipe.output].name.toLowerCase() : ITEMS[recipe.output].single}. ` +
        `${percent(chance)} chance each.` + (p.belt[tool] || !recipe.needsTool ? "" : ` (No ${TOOL_TYPES[tool].name.toLowerCase()} on your belt: half the chance.)`));
    });

    // Lock or unlock one item (the one in this inventory slot).
    this.onMessage("lock", (client, msg: { slot: number; locked: boolean }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot) || !p.inventory[msg.slot]) return;
      p.locked[msg.slot] = !!msg.locked;
      client.send("locks", p.locked);
      this.saveSoon(p);
    });

    // The client says it's ready once its message handlers are set up.
    this.onMessage("ready", (client, msg?: { reconnected?: boolean }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (msg?.reconnected) {
        this.sendInventory(client, p);
        this.sendDisciplines(client, p);
        this.sendMastery(client, p);
        return;
      }
      this.sendInventory(client, p);
      this.sendDisciplines(client, p);
      this.sendMastery(client, p);
      this.say(client, "Welcome! Chop trees for logs (fish from Foraging level 3, mine from level 5), then sell them to the Merchant.");
      this.say(client, "Tools on your belt make gathering faster; without one it's 3 times slower. The Merchant sells basic tools.");
      this.say(client, "Smelt ore into bars at the furnace and make tools at the anvil, both next to the Merchant.");
    });

    this.onMessage("drop", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot) || !p.inventory[msg.slot]) return;
      const item = p.inventory[msg.slot]!;
      if (p.locked[msg.slot]) return this.say(client, `That ${ITEMS[item].single} is locked. Unlock it to drop it.`);
      p.inventory[msg.slot] = null;
      this.sendInventory(client, p);
      this.saveSoon(p);
    });
  }

  gameTick() {
    const tick = ++this.state.tick;
    if (tick % AUTOSAVE_TICKS === 0) this.autosave();

    // Grow back trees whose time is up.
    this.state.depleted.forEach((respawnAt, key) => {
      if (tick >= respawnAt) this.state.depleted.delete(key);
    });

    this.state.players.forEach((p, sessionId) => {
      if (p.path.length || !p.target) return;
      if (p.crafting) this.craftTick(p, sessionId); else this.gatherTick(p, sessionId);
    });
  }

  /** Walking speed: one tile per 600ms, timed per player. */
  private stepPlayers() {
    const now = Date.now();
    this.state.players.forEach((p) => {
      if (!p.path.length || now < p.nextStepAt) return;
      const next = p.path.shift()!;
      p.x = next.x;
      p.y = next.y;
      p.dirty = true;
      if (!p.path.length && p.talkTo) {
        const npc = p.talkTo;
        p.talkTo = null;
        const client = this.clients.find((c) => this.state.players.get(c.sessionId) === p);
        if (client && this.isNextTo(p, npc)) this.openShop(client, p, npc);
      }
      // Keep a steady pace; if they'd been standing still, start the clock from now.
      p.nextStepAt = Math.max(p.nextStepAt + TICK_MS, now + TICK_MS - STEP_LOOP_MS);
    });
  }

  /** Walk next to a tree, rock or the water, then start working it on the next tick. */
  private startGathering(client: Client, p: Player, resource: ResourceId, target: Point) {
    const res = RESOURCES[resource];
    const skill = res.skill;
    const { discipline, def } = findSkill(skill);
    const level = levelForXp(p.disciplines[discipline]);
    if (level < def.unlockLevel) {
      return this.say(client, `You need ${DISCIPLINES[discipline].name} level ${def.unlockLevel} to use ${def.name}.`);
    }
    const skillLevel = levelForXp(p.skillXp[skill]);
    if (skillLevel < res.level) {
      return this.say(client, `You need ${def.name} level ${res.level} to ${verbFor(resource)}. (You're level ${skillLevel}.)`);
    }
    this.stopActions(p);
    p.target = target;
    p.activity = skill;
    p.resource = resource;
    p.path = this.pathNextTo(p, target);
    if (!p.path.length && !this.isNextTo(p, target)) {
      this.stopActions(p);
      this.say(client, "You can't reach that.");
    }
  }

  private gatherTick(p: Player, sessionId: string) {
    const client = this.clients.getById(sessionId);
    const t = p.target!;
    const skill = p.activity;
    const resource = p.resource;
    if (!skill || !resource || !this.isNextTo(p, t)) return this.stopActions(p);
    // Someone else felled the tree or emptied the rock.
    if (skill !== "fishing" && this.state.depleted.has(treeKey(t.x, t.y))) return this.stopActions(p);

    const free = p.inventory.indexOf(null);
    if (free === -1) {
      if (client) this.say(client, "Your inventory is full. Sell or drop something first.");
      return this.stopActions(p);
    }

    const res = RESOURCES[resource];
    const item = ITEMS[res.item];
    const gather = skill as GatherSkill;
    const tool = toolForSkill(skill)!;
    const belt = p.belt[tool];
    const ACTIONS = { woodcutting: "chopping", fishing: "fishing", mining: "mining" } as const;
    const START = {
      woodcutting: `You swing at the ${res.node.toLowerCase()}.`,
      fishing: "You cast out your line...",
      mining: `You swing your pick at the ${res.node.toLowerCase()}.`,
    };
    const action = ACTIONS[gather];
    if (p.action !== action) {
      p.action = action;
      p.faceX = t.x;
      p.faceY = t.y;
      if (client) {
        this.say(client, START[gather] + (belt ? "" : ` You have no ${TOOL_TYPES[tool].name.toLowerCase()} on your belt, so it's 3 times slower. The Merchant sells them.`));
      }
      return;
    }

    const mastery = masteryIn(p.mastery, resource);
    if (Math.random() >= gatherChancePerTick(resource, mastery, belt ? toolBonus(belt.item) : null)) return;
    if (Math.random() >= gatherSuccessChance(resource, mastery)) {
      // Never happens yet (success is always 100%); here for harder types later.
      if (client) this.say(client, skill === "fishing" ? "Something bites, but it gets away." : "You don't manage to get anything.");
      return;
    }

    this.place(p, free, res.item);
    this.wearTool(p, client, tool, wearFor(res.level));
    if (client) {
      this.sendInventory(client, p);
      const GOT = {
        woodcutting: `You get some ${item.name.toLowerCase()}.`,
        mining: `You mine some ${item.name.toLowerCase()}.`,
        fishing: `You catch a ${item.single}!`,
      };
      this.say(client, GOT[gather]);
    }
    this.addXp(p, client, "foraging", res.xp);
    this.addMasteryXp(p, client, resource, res.xp);
    this.addSkillXp(p, client, skill, res.xp); // sends both skill levels and Mastery
    this.saveSoon(p);

    if (skill === "fishing") return; // fishing spots never run out
    const isTreeNode = skill === "woodcutting";
    if (Math.random() < (isTreeNode ? TREE_FALL_CHANCE : ROCK_EMPTY_CHANCE)) {
      this.state.depleted.set(treeKey(t.x, t.y), this.state.tick + res.respawnTicks);
      if (client) this.say(client, isTreeNode ? "The tree falls down." : "The rock is out of ore.");
      // Everyone working this tree or rock stops.
      this.state.players.forEach((other) => {
        if (other.activity === skill && other.target?.x === t.x && other.target?.y === t.y) this.stopActions(other);
      });
    }
  }

  /** One try at the furnace or anvil every few ticks: it works or it fails (losing the inputs). */
  private craftTick(p: Player, sessionId: string) {
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
    // Use the inputs (never locked ones).
    let freed = -1;
    for (const input of recipe.inputs) {
      const slot = p.inventory.findIndex((it, i) => it === input && !p.locked[i]);
      p.inventory[slot] = null;
      if (freed === -1) freed = slot;
    }
    const output = ITEMS[recipe.output];
    const chance = successFor(recipe, p.mastery, p.belt);
    const worked = Math.random() < chance;
    const xp = worked ? recipe.xp : failXp(recipe.xp);
    if (worked) this.place(p, freed, recipe.output);
    const tool = toolForSkill(recipe.skill)!;
    this.wearTool(p, client, tool, recipeWear(recipe));
    if (client) {
      this.sendInventory(client, p);
      if (worked) {
        this.say(client, recipe.skill === "smelting" ? `You smelt a ${output.single}.` : `You make a ${output.single}!`);
      } else {
        this.say(client, recipe.skill === "smelting"
          ? `The ore burns away. You fail to smelt a ${output.single}.`
          : `You ruin the metal. You fail to make a ${output.single}.`);
      }
    }
    this.addXp(p, client, "crafting", xp);
    this.addMasteryXp(p, client, recipe.mastery, xp);
    this.addSkillXp(p, client, recipe.skill, xp);
    this.saveSoon(p);

    if (--job.remaining <= 0) return this.stopActions(p);
    const next = this.missingInputs(p, recipe);
    if (next) {
      if (client) this.say(client, `You've run out: you need ${next}.`);
      this.stopActions(p);
    }
  }

  /** "1 tin ore" if you're short of something for this recipe (locked items don't count), else null. */
  private missingInputs(p: Player, recipe: Recipe): string | null {
    const need = new Map<ItemId, number>();
    for (const i of recipe.inputs) need.set(i, (need.get(i) ?? 0) + 1);
    const short: string[] = [];
    for (const [item, n] of need) {
      const have = p.inventory.filter((it, i) => it === item && !p.locked[i]).length;
      if (have < n) short.push(`${n - have} ${n - have === 1 ? ITEMS[item].single : ITEMS[item].name.toLowerCase()}`);
    }
    return short.length ? short.join(" and ") : null;
  }

  /** Put an item in a bag slot. Tools keep the uses they have left (new ones are full). */
  private place(p: Player, slot: number, item: ItemId, durability?: number) {
    p.inventory[slot] = item;
    p.locked[slot] = false; // new items start unlocked
    p.durability[slot] = isTool(item) ? durability ?? maxDurability(item) : null;
  }

  /** Each use wears the belt tool down. Warn at 10%; at 0 it breaks and is gone. */
  private wearTool(p: Player, client: Client | undefined, type: ToolType, amount: number) {
    const t = p.belt[type];
    if (!t) return;
    const max = maxDurability(t.item);
    const before = t.durability;
    t.durability = Math.max(0, t.durability - amount);
    if (t.durability <= 0) {
      p.belt[type] = null;
      if (client) this.say(client, `Your ${ITEMS[t.item].single} breaks!`);
    } else if (before > max * TOOL_WARN_AT && t.durability <= max * TOOL_WARN_AT) {
      if (client) this.say(client, `Your ${ITEMS[t.item].single} is about to break (${t.durability} uses left).`);
    }
    if (client) client.send("belt", p.belt);
  }

  /** "+10% gathering speed, 150 uses" */
  private toolEffect(item: ItemId) {
    if (!isTool(item)) return "";
    const { type } = parseTool(item);
    const bonus = Math.round(toolBonus(item) * 100);
    return TOOL_TYPES[type].helps === "speed" ? `+${bonus}% ${findSkill(TOOL_TYPES[type].skill).def.name} speed` : `${bonus}% fewer ${findSkill(TOOL_TYPES[type].skill).def.name} failures`;
  }

  private openShop(client: Client, p: Player, npc: NpcDef) {
    p.faceX = npc.x;
    p.faceY = npc.y;
    this.say(client, `${npc.name}: ${npc.greeting}`);
    client.send(npc.kind === "station" ? "station" : "shop", { npc: npc.id });
  }

  /** Standing on one of the 8 tiles around the Merchant, furnace or anvil. */
  private nearNpc(p: Player, id: string) {
    const npc = NPCS.find((n) => n.id === id)!;
    return Math.max(Math.abs(p.x - npc.x), Math.abs(p.y - npc.y)) <= 1;
  }

  private stopActions(p: Player) {
    p.target = null;
    p.activity = null;
    p.resource = null;
    p.talkTo = null;
    p.crafting = null;
    p.action = "idle";
  }

  private isNextTo(p: Point, t: Point) {
    return Math.abs(p.x - t.x) + Math.abs(p.y - t.y) === 1;
  }

  /** Shortest path to any tile directly north/south/east/west of the target. */
  private pathNextTo(from: Point, t: Point): Point[] {
    if (this.isNextTo(from, t)) return [];
    let best: Point[] = [];
    for (const d of CARDINAL) {
      const goal = { x: t.x + d.x, y: t.y + d.y };
      if (!isWalkable(goal.x, goal.y)) continue;
      const path = findPath({ x: from.x, y: from.y }, goal);
      if (path.length && (!best.length || path.length < best.length)) best = path;
    }
    return best;
  }

  private addXp(p: Player, client: Client | undefined, discipline: DisciplineId, xp: number) {
    const before = levelForXp(p.disciplines[discipline]);
    p.disciplines[discipline] += xp;
    const after = levelForXp(p.disciplines[discipline]);
    if (!client) return;
    this.sendDisciplines(client, p);
    if (after > before) {
      const d = DISCIPLINES[discipline];
      this.say(client, `Congratulations, you just advanced a ${d.name} level! You are now level ${after}.`);
      for (const skill of d.skills) {
        if (skill.unlockLevel > before && skill.unlockLevel <= after) {
          this.say(client, `You've unlocked ${skill.name}! ${skill.description}`);
        }
      }
      client.send("levelup", { discipline, level: after });
    }
  }

  /** Skill level (up to 99): unlocks better types. */
  private addSkillXp(p: Player, client: Client | undefined, skill: SkillId, xp: number) {
    const before = levelForXp(p.skillXp[skill]);
    p.skillXp[skill] += xp;
    const after = levelForXp(p.skillXp[skill]);
    if (!client) return;
    this.sendMastery(client, p);
    if (after > before) {
      const { def } = findSkill(skill);
      this.say(client, `Your ${def.name} level is now ${after}!`);
      if (isCraftSkill(skill)) {
        for (const m of Object.values(METALS)) {
          if (m.level > before && m.level <= after) {
            this.say(client, skill === "smelting" ? `You can now smelt ${m.name.toLowerCase()} bars!` : `You can now make ${m.name.toLowerCase()} tools!`);
          }
        }
      } else {
        for (const id of resourcesFor(skill)) {
          const r = RESOURCES[id];
          if (r.level > before && r.level <= after) this.say(client, `You can now ${verbFor(id)}!`);
        }
      }
      client.send("skillup", { skill, level: after });
    }
  }

  /** Mastery in one type (no cap): faster at it, and it sells for more. */
  private addMasteryXp(p: Player, client: Client | undefined, id: MasteryId, xp: number) {
    const before = masteryLevelIn(p.mastery, id);
    p.mastery[id] = (p.mastery[id] ?? 0) + xp;
    const after = masteryLevelIn(p.mastery, id);
    if (!client || after <= before) return;
    const crafted = !(id in RESOURCES);
    this.say(client, `${masteryName(id)} Mastery ${after}! ` + (crafted
      ? `Fewer failures, and it sells for ${valueBonusPercent(after)}% more.`
      : `${speedBonusPercent(after)}% faster, sells for ${valueBonusPercent(after)}% more.`));
    client.send("masteryup", { resource: id, level: after });
  }

  private sendDisciplines(client: Client, p: Player) {
    client.send("disciplines", p.disciplines);
  }

  /** Skill levels and per-type Mastery, both shown in the Skills panel. */
  private sendMastery(client: Client, p: Player) {
    client.send("skillxp", p.skillXp);
    client.send("mastery", p.mastery);
  }

  private say(client: Client, text: string) {
    client.send("message", text);
  }

  // The inventory goes only to its owner, not to every player.
  private sendInventory(client: Client, p: Player) {
    client.send("locks", p.locked);
    client.send("durability", p.durability);
    client.send("belt", p.belt);
    client.send("inventory", p.inventory);
    client.send("coins", p.coins);
  }

  // ---- Accounts ----

  /** Runs before a player joins: checks their username and password. */
  async onAuth(_client: Client, options: { username?: string; password?: string; create?: boolean }) {
    const username = String(options?.username ?? "").trim();
    const password = String(options?.password ?? "");
    const k = usernameKey(username);
    if (!USERNAME_RE.test(username)) {
      throw new ServerError(400, "Usernames are 1-12 letters, numbers, spaces, _ or -, starting with a letter or number.");
    }
    if (password.length < MIN_PASSWORD) throw new ServerError(400, `Passwords need at least ${MIN_PASSWORD} characters.`);
    if (password.length > 100) throw new ServerError(400, "That password is too long.");

    const lock = failedLogins.get(k);
    if (lock && lock.until > Date.now()) throw new ServerError(429, "Too many wrong passwords. Wait a minute and try again.");
    // Logging in again while an old connection waits to reconnect: end the old one first.
    const waiting = waitingToReconnect.get(k);
    if (waiting) {
      waiting.reject(new Error("logged in again"));
      await new Promise((r) => setTimeout(r, 50));
    }
    await pendingSaves.get(k); // finish saving a previous session first

    let account: Account | null;
    if (options?.create) {
      const created = await store.create(username, await hashPassword(password));
      if (!created) throw new ServerError(409, "That username is taken. Try another one.");
      account = await store.get(username);
      console.log(`New account: ${username}`);
    } else {
      account = await store.get(username);
      if (!account || !(await checkPassword(password, account.passwordHash))) {
        const f = failedLogins.get(k) ?? { count: 0, until: 0 };
        f.count++;
        if (f.count >= 5) { f.count = 0; f.until = Date.now() + 60_000; }
        failedLogins.set(k, f);
        throw new ServerError(401, "Wrong username or password.");
      }
    }
    failedLogins.delete(k);
    if (online.has(k)) throw new ServerError(409, "That account is already logged in.");
    store.touchLogin(username).catch((err) => console.error("touchLogin failed:", err.message));
    return account; // becomes client.auth
  }

  onJoin(client: Client) {
    const account = client.auth as Account;
    const k = usernameKey(account.username);
    if (online.has(k)) throw new ServerError(409, "That account is already logged in.");
    online.add(k);
    const p = new Player();
    p.name = account.username;
    p.color = COLORS[this.state.players.size % COLORS.length];
    this.restore(p, account.save);
    p.lastSavedAt = Date.now();
    this.state.players.set(client.sessionId, p);
    console.log(`${p.name} logged in (${this.state.players.size} online)`);
  }

  async onLeave(client: Client, consented: boolean) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const k = usernameKey(p.name);
    if (!consented) {
      // The connection dropped rather than the player leaving: keep them in the
      // world (standing still) and let the same browser pick up where it left off.
      this.stopActions(p);
      p.path = [];
      const reconnection = this.allowReconnection(client, RECONNECT_SECONDS);
      waitingToReconnect.set(k, reconnection);
      try {
        await reconnection;
        waitingToReconnect.delete(k);
        console.log(`${p.name} reconnected`);
        return;
      } catch {
        waitingToReconnect.delete(k);
      }
    }
    this.state.players.delete(client.sessionId);
    console.log(`${p.name} logged out (${this.state.players.size} online)`);
    const saving = this.save(p).finally(() => { pendingSaves.delete(k); });
    pendingSaves.set(k, saving);
    online.delete(k);
    await saving;
  }

  async onDispose() {
    // Normally onLeave already saved everyone; this is a safety net.
    await Promise.all([...this.state.players.values()].map((p) => this.save(p)));
  }

  // ---- Saving and loading ----

  private restore(p: Player, save: SaveData) {
    if (Number.isInteger(save.x) && Number.isInteger(save.y) && isWalkable(save.x!, save.y!)) {
      p.x = save.x!;
      p.y = save.y!;
    } else {
      const spawn = randomSpawn();
      p.x = spawn.x;
      p.y = spawn.y;
    }
    if (Array.isArray(save.inventory)) {
      for (let i = 0; i < INVENTORY_SIZE; i++) {
        let item = save.inventory[i];
        if (typeof item === "string" && item in LEGACY_ITEMS) item = LEGACY_ITEMS[item]; // logs -> pine logs, etc.
        p.inventory[i] = typeof item === "string" && item in ITEMS ? (item as ItemId) : null;
        const it = p.inventory[i];
        if (isTool(it)) {
          const d = save.durability?.[i];
          p.durability[i] = typeof d === "number" && d > 0 ? Math.min(Math.floor(d), maxDurability(it)) : maxDurability(it);
        }
      }
    }
    for (const type of TOOL_TYPE_IDS) {
      const t = save.belt?.[type];
      if (t && isTool(t.item) && parseTool(t.item).type === type && typeof t.durability === "number" && t.durability > 0) {
        p.belt[type] = { item: t.item, durability: Math.min(Math.floor(t.durability), maxDurability(t.item)) };
      }
    }
    if (typeof save.coins === "number" && Number.isFinite(save.coins) && save.coins >= 0) p.coins = Math.floor(save.coins);
    if (Array.isArray(save.lockedSlots)) {
      for (const i of save.lockedSlots) if (Number.isInteger(i) && i >= 0 && i < INVENTORY_SIZE && p.inventory[i]) p.locked[i] = true;
    } else if (Array.isArray(save.locked)) {
      // Briefly, locks were per item type: lock every item of those types that's in the bag.
      p.inventory.forEach((item, i) => { if (item && save.locked!.includes(item)) p.locked[i] = true; });
    }
    // Saved under "skills" (its name before Disciplines existed), so old saves keep working.
    for (const id of DISCIPLINE_IDS) {
      const xp = save.skills?.[id];
      if (typeof xp === "number" && Number.isFinite(xp) && xp >= 0) p.disciplines[id] = Math.floor(xp);
    }
    const ok = (xp: unknown): xp is number => typeof xp === "number" && Number.isFinite(xp) && xp >= 0;
    for (const id of Object.keys(p.skillXp) as SkillId[]) {
      if (save.skillXp) {
        if (ok(save.skillXp[id])) p.skillXp[id] = Math.floor(save.skillXp[id]);
      } else if (ok(save.mastery?.[id])) {
        // Older saves had one Mastery per skill. That level becomes the skill's level.
        p.skillXp[id] = xpForLevel(Math.min(99, masteryLevelForXp(save.mastery[id])));
      }
    }
    if (save.skillXp) {
      for (const id of ALL_MASTERY_IDS) if (ok(save.mastery?.[id])) p.mastery[id] = Math.floor(save.mastery![id]);
    }
  }

  private snapshot(p: Player): SaveData {
    // Save where the player is heading, so walking off mid-path doesn't lose the move.
    const dest = p.path.length ? p.path[p.path.length - 1] : p;
    return { x: dest.x, y: dest.y, inventory: [...p.inventory], coins: p.coins, skills: { ...p.disciplines }, skillXp: { ...p.skillXp }, mastery: { ...p.mastery }, durability: [...p.durability], belt: { ...p.belt }, lockedSlots: p.locked.flatMap((on, i) => (on && p.inventory[i] ? [i] : [])) };
  }

  private async save(p: Player) {
    p.dirty = false;
    p.lastSavedAt = Date.now();
    try {
      await store.save(p.name, this.snapshot(p));
    } catch (err: any) {
      p.dirty = true; // try again on the next autosave
      console.error(`Saving ${p.name} failed:`, err.message);
    }
  }

  /** For important changes (items gained or lost): save now, unless we saved very recently. */
  private saveSoon(p: Player) {
    p.dirty = true;
    if (Date.now() - p.lastSavedAt >= MIN_SAVE_GAP_MS) void this.save(p);
  }

  private autosave() {
    this.state.players.forEach((p) => { if (p.dirty) void this.save(p); });
  }
}
