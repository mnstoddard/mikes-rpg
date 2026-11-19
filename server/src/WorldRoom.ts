import { Room, Client, ServerError } from "colyseus";
import { MapSchema, Schema, type } from "@colyseus/schema";
import { MAP, MAP_HEIGHT, MAP_WIDTH, TICK_MS, isDanger, isWalkable, randomSpawn } from "../../shared/map";
import { findPath, Point } from "../../shared/pathfinding";
import {
  RESOURCES, RESOURCE_FOR_ITEM, ROCK_EMPTY_CHANCE, ResourceId, TREE_FALL_CHANCE,
  fishAt, forageXp, gatherChancePerTick, gatherSuccessChance, masteryIn, nodeAt, resourcesFor, treeKey,
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
  ALL_MASTERY_IDS, Recipe, SHOP_STOCK, buyPriceFor, failXp, gearDurability, masteryName, recipeFor, recipeWear, sellPriceFor,
  successFor,
} from "../../shared/crafting";
import {
  AGGRO_RADIUS, ALL_COMBAT_MASTERY_IDS, ATTACK_STAMINA, Attack, CombatMasteryId, CombatMasteryXp, HEALTH_REGEN_MS, HEALTH_REGEN_TICKS,
  LEASH_RADIUS, MANA_REGEN_TICKS, MONSTERS, MONSTER_SPAWNS, MonsterId, POTION_HEAL, POTION_ID, SPELLS, SPELL_IDS, SpellId, WANDER_RADIUS,
  armorPoints, attackFor, gearEffect, combatMasteryIn, combatMasteryName, defenseXp, hitChance, masteryDrops, maxHealth, maxHitWith, maxMana,
  monsterHitChance, tileDistance,
} from "../../shared/combat";
import {
  ARMOR, CombatStyle, GEAR_SLOTS, Gear, GearSlot, SLOT_NAMES, WEAPONS, emptyGear, gearSlot, isArmor, isGear, isWeapon, parseArmor,
  parseWeapon,
} from "../../shared/gear";
import {
  Belt, METALS, TOOL_TYPES, TOOL_TYPE_IDS, TOOL_WARN_AT, ToolType, emptyBelt, isTool, maxDurability, parseTool,
  toolBonus, toolForSkill, wearFor,
} from "../../shared/tools";
import { INVENTORY_SIZE, ITEMS, ItemId, LEGACY_ITEMS } from "../../shared/items";
import { NPCS, NpcDef, npcById } from "../../shared/npcs";
import { findSkill as skillInfo } from "../../shared/disciplines";
import { formatMoney } from "../../shared/money";
import { MAX_STAMINA, STAMINA_COST, STAMINA_REGEN_MS, FISH_IDS, foodStamina, isFood, isStew } from "../../shared/cooking";
import {
  BURN_UNTIL, GUIDE_NAME, Gift, QUESTS, isProtected, QuestProgress, QuestStep, QuestView, STEPS, gateOpen, giftItems, newQuestProgress, tutorialDone,
} from "../../shared/quests";
import { Account, SAVE_VERSION, SaveData, checkPassword, hashPassword, store, usernameKey } from "./storage";

const STEP_LOOP_MS = 50; // how often the server checks whether someone should take a step
const AUTOSAVE_TICKS = 100; // 100 x 0.6s = once a minute
const MIN_SAVE_GAP_MS = 10_000; // "important" saves happen right away, but at most every 10s per player
const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,11}$/;
const MIN_PASSWORD = 6;
const CRAFT_TICKS = 3; // one smelt, smith or cook every 3 ticks (1.8s); crafting is about success, not speed
const REGEN_TICKS = Math.round(STAMINA_REGEN_MS / TICK_MS); // 50 ticks = 30s per stamina
// For automated play-tests only (never set on Render): every gathering tick gets an item.
const FAST_GATHER_FOR_TESTS = process.env.RPG_FAST_GATHER === "1";

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
  @type("string") action = "idle"; // "idle" | "chopping" | "fishing" | "mining" | "smelting" | "smithing" | "cooking" (so others see the animation)
  @type("number") faceX = 0; // tile the player is working on, for the animation
  @type("number") faceY = 0;
  @type("number") hp = 50; // health (others see your health bar)
  @type("number") maxHp = 50;

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
  stamina = MAX_STAMINA; // each action costs some; food and time bring it back
  regenTicks = 0; // ticks since the last stamina came back on its own
  locked: boolean[] = new Array(INVENTORY_SIZE).fill(false); // per slot: locked items can't be sold or dropped by accident
  talkTo: NpcDef | null = null; // person the player is walking over to talk to
  quest: QuestProgress = newQuestProgress(); // where they are in Old Maren's tutorial
  nextStepAt = 0; // time (ms) this player may take their next step
  gear: Gear = emptyGear(); // weapon and armor being worn (don't use bag space)
  mana = 50;
  spell: SpellId = "fire_blast"; // the spell cast when holding a staff
  combatMastery: CombatMasteryXp = {}; // Mastery XP per weapon type, spell and monster
  fighting: string | null = null; // id of the monster being attacked
  attackTimer = 0; // ticks since the last attack
  healthTicks = 0; // ticks since health last came back on its own
  manaTicks = 0;
  dirty = false; // something changed since the last save
  lastSavedAt = 0;
}

/** A monster in the world. Everyone sees where it is and its health. */
export class Monster extends Schema {
  @type("string") kind: MonsterId = "chicken";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") hp = 1;
  @type("number") maxHp = 1;
  @type("boolean") alive = true;
  @type("string") status = ""; // "" | "asleep" | "frozen" | "fighting"

  // Server-only:
  homeX = 0;
  homeY = 0;
  target: string | null = null; // session id of the player it's after
  attackTimer = 0;
  respawnAt = 0; // tick it comes back, while defeated
  sleepUntil = 0;
  frozenUntil = 0;
}

export class WorldState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Monster }) monsters = new MapSchema<Monster>();
  /** Chopped-down trees and emptied rocks: key "x,y" -> tick when it comes back. */
  @type({ map: "number" }) depleted = new MapSchema<number>();
  @type("number") tick = 0;
}

const COLORS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1, 0xff6ec7];
const CARDINAL = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

/** Things that can count toward a tutorial step. */
type QuestEvent =
  | { kind: "gather"; skill: GatherSkill; resource: ResourceId; withTool: boolean }
  | { kind: "toolBreak"; tool: ToolType }
  | { kind: "craft"; item: ItemId; worked: boolean }
  | { kind: "eat"; item: ItemId }
  | { kind: "sell"; item: ItemId }
  | { kind: "kill"; monster: MonsterId; style: CombatStyle }
  | { kind: "drink" };

/** Where each crafting skill is done. */
const STATION_FOR = { smelting: "furnace", smithing: "anvil", cooking: "stove" } as const;

const isRock = (x: number, y: number) =>
  y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH && MAP[y][x] === "rock";
const isTree = (x: number, y: number) =>
  y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH && MAP[y][x] === "tree";

/** "a bronze bar" / "an iron bar". */
const aOr = (word: string) => /(tongs|platelegs|boots)\b/.test(word) ? `a pair of ${word}` : `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
/** "2 bronze bars", "3 health potions" (names already plural, like "Pine logs", stay as they are). */
const plural = (name: string) => /[a-rt-z]$/i.test(name) ? `${name.toLowerCase()}s` : name.toLowerCase();

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

    MONSTER_SPAWNS.forEach(([kind, x, y], i) => {
      const m = new Monster();
      m.kind = kind;
      m.x = m.homeX = x;
      m.y = m.homeY = y;
      m.hp = m.maxHp = MONSTERS[kind].hp;
      this.state.monsters.set(`m${i}`, m);
    });

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
      if (isProtected(p.quest, item)) return this.say(client, this.keepIt(item, "sell"));
      if (!this.nearNpc(p, "merchant")) return this.say(client, "You need to be next to the Merchant to sell.");
      const price = sellPriceFor(item, p.mastery, p.durability[msg.slot]);
      p.inventory[msg.slot] = null;
      p.coins += price;
      this.say(client, `You sell 1 ${ITEMS[item].single} for ${formatMoney(price)}.`);
      this.questEvent(p, client, { kind: "sell", item });
      this.sendInventory(client, p);
      this.saveSoon(p);
    });

    // Sell everything that isn't locked, in one go.
    this.onMessage("sellAll", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (!this.nearNpc(p, "merchant")) return this.say(client, "You need to be next to the Merchant to sell.");
      let count = 0;
      let total = 0;
      const sold: ItemId[] = [];
      const kept = new Set<ItemId>();
      for (let i = 0; i < INVENTORY_SIZE; i++) {
        const item = p.inventory[i];
        if (!item || p.locked[i]) continue;
        if (isProtected(p.quest, item)) { kept.add(item); continue; }
        total += sellPriceFor(item, p.mastery, p.durability[i]);
        p.inventory[i] = null;
        sold.push(item);
        count++;
      }
      if (kept.size) this.say(client, `Merchant: I'll leave your ${[...kept].map((i) => ITEMS[i].name.toLowerCase()).join(" and ")} alone. ${GUIDE_NAME} needs you to use those first.`);
      if (!count) return this.say(client, kept.size ? "You have nothing else to sell." : "You have nothing to sell that isn't locked.");
      p.coins += total;
      this.say(client, `You sell ${count} item${count === 1 ? "" : "s"} for ${formatMoney(total)}.`);
      for (const item of sold) this.questEvent(p, client, { kind: "sell", item });
      this.sendInventory(client, p);
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
          ? `You need ${formatMoney(price)} for ${aOr(ITEMS[item].single)}.` : "Your inventory is full.");
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
      if (this.step(p)?.needsTool === type) this.say(client, `${GUIDE_NAME} said to keep your ${TOOL_TYPES[type].name.toLowerCase()} on your belt for this. Put it back on before you carry on.`);
      this.saveSoon(p);
    });

    // Eat a fish or a stew from your bag to get stamina back. Doesn't stop what you're doing.
    this.onMessage("eat", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      const item = p.inventory[msg.slot];
      if (!item || !isFood(item)) return;
      if (isProtected(p.quest, item)) return this.say(client, this.keepIt(item, "eat"));
      const questEat = this.step(p)?.goal.kind === "eat" && isStew(item); // Maren asked you to eat it, so you can even when full
      if (p.stamina >= MAX_STAMINA && !questEat) return this.say(client, `You're not hungry. Your stamina is full (${MAX_STAMINA}).`);
      const gain = foodStamina(item, p.mastery);
      p.inventory[msg.slot] = null;
      p.locked[msg.slot] = false;
      const before = p.stamina;
      p.stamina = Math.min(MAX_STAMINA, p.stamina + gain);
      this.sendInventory(client, p);
      this.sendStamina(client, p);
      const wasted = gain - (p.stamina - before);
      this.say(client, `You eat the ${ITEMS[item].single}. +${p.stamina - before} stamina (${p.stamina}/${MAX_STAMINA}).` +
        (wasted > 0 ? ` (${wasted} more would have gone past full.)` : ""));
      this.questEvent(p, client, { kind: "eat", item });
      this.saveSoon(p);
    });

    // At the furnace, anvil or stove: make one, or keep going until you run out.
    this.onMessage("craft", (client, msg: { item: string; all?: boolean }) => {
      const p = this.state.players.get(client.sessionId);
      const recipe = p && recipeFor(msg?.item as ItemId);
      if (!p || !recipe) return;
      const station = NPCS.find((n) => n.id === STATION_FOR[recipe.skill])!;
      if (!this.nearNpc(p, station.id)) return this.say(client, `You need to be next to the ${station.name.toLowerCase()}.`);
      const { discipline, def } = findSkill(recipe.skill);
      if (levelForXp(p.disciplines[discipline]) < def.unlockLevel) {
        return this.say(client, `You need ${DISCIPLINES[discipline].name} level ${def.unlockLevel} to use ${def.name}. ${GUIDE_NAME} will tell you how to get there.`);
      }
      const blocked = this.toolBlock(p, recipe.skill);
      if (blocked) return this.say(client, blocked);
      if (!this.hasStamina(client, p, recipe.skill)) return;
      const level = levelForXp(p.skillXp[recipe.skill]);
      if (level < recipe.level) {
        return this.say(client, `You need ${def.name} level ${recipe.level} to make ${aOr(ITEMS[recipe.output].single)}. (You're level ${level}.)`);
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
      const chance = successFor(recipe, p.mastery, p.belt);
      const tool = toolForSkill(recipe.skill)!;
      const verb = { smelting: "smelting", smithing: "making", cooking: "cooking" }[recipe.skill];
      this.say(client, `You start ${verb} ${msg.all ? ITEMS[recipe.output].name.toLowerCase() : aOr(ITEMS[recipe.output].single)}. ` +
        (this.forcedCraft(p, recipe) === "success" ? `${GUIDE_NAME} is guiding your hand, so this one will work.`
          : `${percent(chance)} chance each.` + (p.belt[tool] || !recipe.needsTool ? "" : ` (No ${TOOL_TYPES[tool].name.toLowerCase()} on your belt: half the chance.)`)));
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
      this.sendInventory(client, p);
      this.sendDisciplines(client, p);
      this.sendMastery(client, p);
      this.sendStamina(client, p);
      this.sendVitals(client, p);
      client.send("combatmastery", p.combatMastery);
      if (msg?.reconnected) return;
      const step = this.step(p);
      if (!step) this.say(client, "Welcome back!");
      else if (p.quest.step === 0) this.say(client, `Welcome! Go and talk to ${GUIDE_NAME} (the ❗ just south of the furnace). She'll show you how to get started.`);
      else this.say(client, `Welcome back! Your task: ${step.task}.`);
    });

    this.onMessage("drop", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot) || !p.inventory[msg.slot]) return;
      const item = p.inventory[msg.slot]!;
      if (p.locked[msg.slot]) return this.say(client, `That ${ITEMS[item].single} is locked. Unlock it to drop it.`);
      if (isProtected(p.quest, item)) return this.say(client, this.keepIt(item, "drop"));
      p.inventory[msg.slot] = null;
      this.sendInventory(client, p);
      this.saveSoon(p);
    });

    // Click a monster to attack it.
    this.onMessage("attack", (client, msg: { id: string }) => {
      const p = this.state.players.get(client.sessionId);
      const m = this.state.monsters.get(String(msg?.id));
      if (!p || !m || !m.alive) return;
      if (isDanger(m.x, m.y) && !isDanger(p.x, p.y) && !gateOpen(p.quest)) return this.say(client, this.notReady());
      const blocked = this.fightBlock(p);
      if (blocked) return this.say(client, blocked);
      this.stopActions(p);
      p.fighting = String(msg.id);
      p.attackTimer = 99; // the first swing comes as soon as you're in range
      const a = attackFor(p.gear, p.spell);
      p.path = this.inRange(p, m, a) ? [] : findPath({ x: p.x, y: p.y }, { x: m.x, y: m.y });
    });

    // Click a weapon or armor in your bag to hold or wear it (swapping out what was there).
    this.onMessage("wear", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      const item = p.inventory[msg.slot];
      if (!isGear(item)) return;
      const why = this.cantWear(p, item);
      if (why) return this.say(client, why);
      const slot = gearSlot(item);
      // Two-handed weapons and shields don't go together: the other one goes in your bag.
      const clash: GearSlot | null = slot === "weapon" && this.twoHanded(item) && p.gear.offhand ? "offhand"
        : slot === "offhand" && this.twoHanded(p.gear.weapon?.item) ? "weapon" : null;
      const old = p.gear[slot];
      if (clash && old && !p.inventory.some((it, i) => !it && i !== msg.slot)) return this.say(client, "Your bag is too full to swap those. Make room for one more item.");
      p.gear[slot] = { item, durability: p.durability[msg.slot] ?? gearDurability(item) };
      p.inventory[msg.slot] = null;
      p.durability[msg.slot] = null;
      if (old) this.place(p, msg.slot, old.item, old.durability);
      let moved = "";
      if (clash) {
        const c = p.gear[clash]!;
        p.gear[clash] = null;
        this.place(p, p.inventory.indexOf(null), c.item, c.durability);
        moved = ` Your ${ITEMS[c.item].single} goes in your bag (${slot === "weapon" ? "that weapon takes both hands" : "you need a free hand for a shield"}).`;
      }
      const verb = slot === "weapon" ? "hold" : "put on";
      this.say(client, `You ${verb} the ${ITEMS[item].single}. ${gearEffect(item)}.` + (old ? ` Your ${ITEMS[old.item].single} goes in your bag.` : "") + moved);
      this.sendInventory(client, p);
      this.saveSoon(p);
    });

    // Click a piece in your gear strip to take it off.
    this.onMessage("remove", (client, msg: { slot: string }) => {
      const p = this.state.players.get(client.sessionId);
      const slot = msg?.slot as GearSlot;
      if (!p || !GEAR_SLOTS.includes(slot) || !p.gear[slot]) return;
      const free = p.inventory.indexOf(null);
      if (free === -1) return this.say(client, "Your inventory is full.");
      const g = p.gear[slot]!;
      p.gear[slot] = null;
      this.place(p, free, g.item, g.durability);
      this.say(client, `You take off the ${ITEMS[g.item].single}.`);
      const blocked = this.fightBlock(p);
      if (blocked && slot === "weapon") this.say(client, blocked);
      this.sendInventory(client, p);
      this.saveSoon(p);
    });

    // Pick which spell to cast with a staff.
    this.onMessage("spell", (client, msg: { id: string }) => {
      const p = this.state.players.get(client.sessionId);
      const id = msg?.id as SpellId;
      if (!p || !SPELL_IDS.includes(id)) return;
      const level = levelForXp(p.skillXp.magic);
      if (level < SPELLS[id].level) return this.say(client, `You need Magic level ${SPELLS[id].level} to cast ${SPELLS[id].name}. (You're level ${level}.)`);
      p.spell = id;
      this.say(client, `Your staff will cast ${SPELLS[id].icon} ${SPELLS[id].name} (${SPELLS[id].mana} mana).`);
      this.sendGear(client, p);
      p.dirty = true;
    });

    // Drink a health potion.
    this.onMessage("drink", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot) || p.inventory[msg.slot] !== POTION_ID) return;
      const questDrink = this.step(p)?.goal.kind === "drink"; // Maren asked you to, so you can even at full health
      if (p.hp >= p.maxHp && !questDrink) return this.say(client, `You're already at full health (${p.maxHp}).`);
      p.inventory[msg.slot] = null;
      p.locked[msg.slot] = false;
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + POTION_HEAL);
      this.say(client, `You drink the health potion. +${p.hp - before} health (${p.hp}/${p.maxHp}).`);
      this.sendInventory(client, p);
      this.sendVitals(client, p);
      this.questEvent(p, client, { kind: "drink" });
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
      // Stamina comes back on its own, 1 every 30 seconds.
      if (p.stamina < MAX_STAMINA && ++p.regenTicks >= REGEN_TICKS) {
        p.regenTicks = 0;
        p.stamina++;
        p.dirty = true;
        const client = this.clients.getById(sessionId);
        if (client) this.sendStamina(client, p);
      }
      // Health comes back very slowly (1 a minute), mana faster (1 every 6 seconds).
      const client = this.clients.getById(sessionId);
      let vitals = false;
      if (p.hp < p.maxHp && ++p.healthTicks >= HEALTH_REGEN_TICKS) { p.healthTicks = 0; p.hp++; vitals = true; }
      const mMax = maxMana(levelForXp(p.skillXp.magic));
      if (p.mana < mMax && ++p.manaTicks >= MANA_REGEN_TICKS) { p.manaTicks = 0; p.mana++; vitals = true; }
      if (vitals && client) this.sendVitals(client, p);
      if (p.fighting) return this.combatTick(p, sessionId);
      if (p.path.length || !p.target) return;
      if (p.crafting) this.craftTick(p, sessionId); else this.gatherTick(p, sessionId);
    });
    this.monsterTick(tick);
  }

  /** Walking speed: one tile per 600ms, timed per player. */
  private stepPlayers() {
    const now = Date.now();
    this.state.players.forEach((p) => {
      if (!p.path.length || now < p.nextStepAt) return;
      // The Dark Forest's gate stays shut until Old Maren says you're ready.
      if (isDanger(p.path[0].x, p.path[0].y) && !isDanger(p.x, p.y) && !gateOpen(p.quest)) {
        p.path = [];
        this.stopActions(p);
        const client = this.clients.find((c) => this.state.players.get(c.sessionId) === p);
        if (client) this.say(client, this.notReady());
        return;
      }
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
    const blocked = this.toolBlock(p, skill);
    if (blocked) return this.say(client, blocked);
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
    const blocked = this.toolBlock(p, skill);
    if (blocked) {
      if (client) this.say(client, blocked);
      return this.stopActions(p);
    }
    if (p.action !== action) {
      p.action = action;
      p.faceX = t.x;
      p.faceY = t.y;
      if (client) {
        this.say(client, START[gather] + (belt ? "" : ` You have no ${TOOL_TYPES[tool].name.toLowerCase()} on your belt, so it's 3 times slower. The Merchant sells them.`));
      }
      return;
    }

    if (p.stamina < STAMINA_COST[skill]) {
      if (client) this.hasStamina(client, p, skill);
      return this.stopActions(p);
    }
    const mastery = masteryIn(p.mastery, resource);
    if (!FAST_GATHER_FOR_TESTS && Math.random() >= gatherChancePerTick(resource, mastery, belt ? toolBonus(belt.item) : null)) return;
    if (Math.random() >= gatherSuccessChance(resource, mastery)) {
      // Never happens yet (success is always 100%); here for harder types later.
      if (client) this.say(client, skill === "fishing" ? "Something bites, but it gets away." : "You don't manage to get anything.");
      return;
    }

    this.place(p, free, res.item);
    this.useStamina(p, skill);
    this.questEvent(p, client, { kind: "gather", skill: gather, resource, withTool: !!belt });
    this.wearTool(p, client, tool, wearFor(res.level));
    if (client) {
      this.sendInventory(client, p);
      this.sendStamina(client, p);
      const GOT = {
        woodcutting: `You get some ${item.name.toLowerCase()}.`,
        mining: `You mine some ${item.name.toLowerCase()}.`,
        fishing: `You catch ${aOr(item.single)}!`,
      };
      this.say(client, GOT[gather]);
    }
    this.addXp(p, client, "foraging", forageXp(resource));
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
    if (p.stamina < STAMINA_COST[recipe.skill]) {
      if (client) this.hasStamina(client, p, recipe.skill);
      return this.stopActions(p);
    }
    this.useStamina(p, recipe.skill);
    // Use the inputs (never locked ones).
    let freed = -1;
    for (const input of recipe.inputs) {
      const slot = p.inventory.findIndex((it, i) => it === input && !p.locked[i]);
      p.inventory[slot] = null;
      if (freed === -1) freed = slot;
    }
    const output = ITEMS[recipe.output];
    const chance = successFor(recipe, p.mastery, p.belt);
    const forced = this.forcedCraft(p, recipe); // the tutorial's first stew always burns; some tries always work
    const worked = forced ? forced === "success" : Math.random() < chance;
    const xp = worked ? recipe.xp : failXp(recipe.xp);
    if (worked) this.place(p, freed, recipe.output);
    const tool = toolForSkill(recipe.skill)!;
    this.wearTool(p, client, tool, recipeWear(recipe));
    if (client) {
      this.sendInventory(client, p);
      this.sendStamina(client, p);
      const WORKED = {
        smelting: `You smelt ${aOr(output.single)}.`,
        smithing: `You make ${aOr(output.single)}!`,
        cooking: `You cook ${aOr(output.single)}! Eat it for ${foodStamina(recipe.output, p.mastery)} stamina.`,
      };
      const FAILED = {
        smelting: `The ore burns away. You fail to smelt ${aOr(output.single)}.`,
        smithing: `You ruin the metal. You fail to make ${aOr(output.single)}.`,
        cooking: `You burn the stew. The fish and the log are gone.`,
      };
      this.say(client, (worked ? WORKED : FAILED)[recipe.skill]);
    }
    this.addXp(p, client, "crafting", xp);
    this.addMasteryXp(p, client, recipe.mastery, xp);
    this.addSkillXp(p, client, recipe.skill, xp);
    this.questEvent(p, client, { kind: "craft", item: recipe.output, worked });
    this.saveSoon(p);

    if (--job.remaining <= 0) return this.stopActions(p);
    const next = this.missingInputs(p, recipe);
    if (next) {
      if (client) this.say(client, `You've run out: you need ${next}.`);
      this.stopActions(p);
    }
  }

  /** Enough stamina for one more of this? If not, say so (and how to get more). */
  private hasStamina(client: Client | undefined, p: Player, skill: SkillId): boolean {
    const cost = STAMINA_COST[skill];
    if (p.stamina >= cost) return true;
    if (client) {
      const eat = p.inventory.some((it) => isFood(it)) ? "Eat something from your bag" : "Eat a fish or a stew (the Merchant sells stew)";
      this.say(client, `You're too tired: ${findSkill(skill).def.name} needs ${cost} stamina and you have ${p.stamina}. ${eat}, or rest (1 stamina every 30 seconds).`);
    }
    return false;
  }

  private useStamina(p: Player, skill: SkillId) {
    p.stamina = Math.max(0, p.stamina - STAMINA_COST[skill]);
  }

  private sendStamina(client: Client, p: Player) {
    client.send("stamina", { stamina: p.stamina, max: MAX_STAMINA });
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
    p.durability[slot] = isTool(item) ? durability ?? maxDurability(item) : isGear(item) ? durability ?? gearDurability(item) : null;
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
      this.questEvent(p, client, { kind: "toolBreak", tool: type });
    } else if (before > max * TOOL_WARN_AT && t.durability <= max * TOOL_WARN_AT) {
      if (client) this.say(client, `Your ${ITEMS[t.item].single} is about to break (${t.durability} uses left).`);
    }
    if (client) {
      client.send("belt", p.belt);
      this.sendQuest(client, p); // "5 uses left" on the tracker
    }
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
    if (npc.id === "maren") return this.talkToGuide(client, p);
    this.say(client, `${npc.name}: ${npc.greeting}`);
    client.send(npc.kind === "station" ? "station" : "shop", { npc: npc.id });
  }


  // ---- Combat (numbers in shared/combat.ts) ----

  private notReady() {
    return `⚠ You're not ready to go in there yet. ${GUIDE_NAME} will tell you when you are.`;
  }

  private twoHanded(item: string | undefined) {
    return isWeapon(item) && !!WEAPONS[parseWeapon(item).type].twoHanded;
  }

  /** Can you attack the monster from where you stand? */
  private inRange(p: Player, m: Monster, a: Attack) {
    return tileDistance(p, m) <= a.range;
  }

  /** Is fighting refused right now? (Maren's step wants a weapon, or a staff.) Returns what to say. */
  private fightBlock(p: Player): string | null {
    const want = this.step(p)?.fightWith;
    if (!want) return null;
    const w = p.gear.weapon?.item;
    if (want === "weapon" && !w) return `${GUIDE_NAME} wants you to fight with a weapon. Click one in your bag and press "Hold" first.`;
    if (want !== "weapon" && (!isWeapon(w) || WEAPONS[parseWeapon(w).type].style !== want)) {
      return want === "magic" ? `${GUIDE_NAME} wants you to use Magic for this. Hold your staff first.` : `${GUIDE_NAME} wants you to use ${want} for this.`;
    }
    return null;
  }

  /** Why you can't wear or hold this yet (too low a level), or null. */
  private cantWear(p: Player, item: ItemId): string | null {
    if (isWeapon(item)) {
      const def = WEAPONS[parseWeapon(item).type];
      const { def: skill } = skillInfo(def.style);
      const combat = levelForXp(p.disciplines.combat);
      if (combat < skill.unlockLevel) return `You need Combat level ${skill.unlockLevel} to use ${skill.name}. (You're level ${combat}.)`;
      const level = levelForXp(p.skillXp[def.style]);
      if (level < def.level) return `You need ${skill.name} level ${def.level} to hold ${aOr(def.name.toLowerCase())}. (You're level ${level}.)`;
    } else if (isArmor(item)) {
      const metal = METALS[parseArmor(item).metal];
      const level = levelForXp(p.skillXp.defense);
      if (level < metal.level) return `You need Defense level ${metal.level} to wear ${metal.name.toLowerCase()} armor. (You're level ${level}.)`;
    }
    return null;
  }

  /** Each game tick while you're fighting: walk into range, then attack whenever your weapon is ready. */
  private combatTick(p: Player, sessionId: string) {
    const client = this.clients.getById(sessionId);
    const m = this.state.monsters.get(p.fighting!);
    if (!m || !m.alive) return this.stopActions(p);
    const a = attackFor(p.gear, p.spell);
    p.attackTimer++;
    if (!this.inRange(p, m, a)) {
      // Chase it: head for its tile (it may have moved).
      const end = p.path[p.path.length - 1];
      if (!end || tileDistance(end, m) > a.range) p.path = findPath({ x: p.x, y: p.y }, { x: m.x, y: m.y });
      if (!p.path.length) {
        if (client) this.say(client, "You can't reach it.");
        this.stopActions(p);
      }
      return;
    }
    p.path = [];
    p.action = "fighting";
    p.faceX = m.x;
    p.faceY = m.y;
    if (p.attackTimer < a.speed) return;
    const blocked = this.fightBlock(p);
    if (blocked) {
      if (client) this.say(client, blocked);
      return this.stopActions(p);
    }
    const def = MONSTERS[m.kind];
    // Pay for the attack: mana for spells, stamina for weapons.
    if (a.spell) {
      const spell = SPELLS[a.spell];
      if (levelForXp(p.skillXp.magic) < spell.level) p.spell = "fire_blast";
      if (p.mana < spell.mana) {
        if (client) this.say(client, `You're out of mana: ${spell.name} needs ${spell.mana} and you have ${p.mana}. It comes back 1 every 6 seconds.`);
        return this.stopActions(p);
      }
      p.mana -= spell.mana;
    } else {
      if (p.stamina < ATTACK_STAMINA) {
        if (client) this.say(client, "You're too tired to fight. Eat something, or rest (1 stamina every 30 seconds).");
        return this.stopActions(p);
      }
      p.stamina -= ATTACK_STAMINA;
    }
    p.attackTimer = 0;
    const style = a.style;
    const weaponM = combatMasteryIn(p.combatMastery, a.mastery);
    const monsterM = combatMasteryIn(p.combatMastery, m.kind);
    const chance = hitChance(levelForXp(p.skillXp[style]), m.kind, a, weaponM, monsterM);
    const hit = Math.random() < chance;
    const max = maxHitWith(a, weaponM);
    const damage = hit && max ? 1 + Math.floor(Math.random() * max) : 0;
    const spell = a.spell ? SPELLS[a.spell] : null;
    if (damage) m.hp = Math.max(0, m.hp - damage);
    if (hit && spell?.freeze) m.frozenUntil = this.state.tick + spell.freeze;
    if (hit && spell?.sleep) { m.sleepUntil = this.state.tick + spell.sleep; m.attackTimer = 0; }
    this.broadcast("hit", { on: "monster", id: p.fighting, damage, miss: !hit, spell: a.spell ?? null, from: sessionId });
    // It fights back now (if it ever does).
    if (def.maxHit > 0 && !m.target) m.target = sessionId;
    if (a.mastery !== "fists") this.wearGear(p, client, "weapon", wearFor(def.level));
    const killed = m.hp <= 0;
    // XP: 1 per damage (a landed sleep counts as a few), plus a bonus for the kill.
    const xp = (damage || (hit && spell?.sleep ? Math.ceil(spell.mana / 2) : 0)) + (killed ? def.xp : 0);
    if (client) {
      this.sendVitals(client, p);
      this.sendStamina(client, p);
      if (!hit) this.say(client, spell ? `Your ${spell.name.toLowerCase()} misses the ${def.name.toLowerCase()}.` : `You miss the ${def.name.toLowerCase()}.`);
      else if (spell?.sleep) this.say(client, `The ${def.name.toLowerCase()} falls asleep! 💤`);
      else if (spell?.freeze && !killed) this.say(client, `You hit the ${def.name.toLowerCase()} for ${damage}. It's frozen in place! ❄️`);
    }
    if (xp) {
      this.addXp(p, client, "combat", xp);
      this.addSkillXp(p, client, style, xp);
      this.addCombatMastery(p, client, a.mastery, xp);
      this.addCombatMastery(p, client, m.kind, xp);
    }
    if (killed) this.killMonster(m, p, client, style);
    this.saveSoon(p);
  }

  /** You defeated it: drops go straight in your bag, and it comes back after a while. */
  private killMonster(m: Monster, p: Player, client: Client | undefined, style: CombatStyle) {
    const def = MONSTERS[m.kind];
    m.alive = false;
    m.target = null;
    m.status = "";
    m.respawnAt = this.state.tick + def.respawnTicks;
    const dropBoost = masteryDrops(combatMasteryIn(p.combatMastery, m.kind));
    const got: string[] = [];
    let lost = 0;
    for (const d of def.drops) {
      if (Math.random() >= Math.min(1, d.chance * dropBoost)) continue;
      const free = p.inventory.indexOf(null);
      if (free === -1) { lost++; continue; }
      this.place(p, free, d.item);
      got.push(aOr(ITEMS[d.item].single));
    }
    const [lo, hi] = def.coins;
    const coins = hi ? lo + Math.floor(Math.random() * (hi - lo + 1)) : 0;
    if (coins) { p.coins += coins; got.push(formatMoney(coins)); }
    this.state.players.forEach((other) => { if (other.fighting && this.state.monsters.get(other.fighting) === m) this.stopActions(other); });
    if (client) {
      this.say(client, `You defeat the ${def.name.toLowerCase()}!` + (got.length ? ` It drops ${got.join(" and ")}.` : "") +
        (lost ? " Your bag is full, so you leave something behind." : ""));
      this.sendInventory(client, p);
    }
    this.questEvent(p, client, { kind: "kill", monster: m.kind, style });
  }

  /** Monsters: come back after being defeated, wander near home, chase and attack. */
  private monsterTick(tick: number) {
    this.state.monsters.forEach((m, id) => {
      const def = MONSTERS[m.kind];
      if (!m.alive) {
        if (tick < m.respawnAt) return;
        m.alive = true;
        m.hp = m.maxHp;
        m.x = m.homeX;
        m.y = m.homeY;
        m.sleepUntil = m.frozenUntil = 0;
        m.attackTimer = 0;
        return;
      }
      if (m.sleepUntil > tick) { m.status = "asleep"; return; }
      const frozen = m.frozenUntil > tick;
      const home = { x: m.homeX, y: m.homeY };
      const danger = isDanger(home.x, home.y);
      // Give up on someone who left, ran out of its patch, or is lying on the ground.
      let target = m.target ? this.state.players.get(m.target) : undefined;
      if (m.target && (!target || isDanger(target.x, target.y) !== danger || tileDistance(target, home) > LEASH_RADIUS + 1)) {
        m.target = null;
        target = undefined;
      }
      // Danger zone monsters attack anyone who comes close.
      if (!target && def.aggressive) {
        let best = AGGRO_RADIUS + 1;
        this.state.players.forEach((pl, sid) => {
          const d = tileDistance(pl, m);
          if (d < best && isDanger(pl.x, pl.y) && tileDistance(pl, home) <= LEASH_RADIUS) { best = d; m.target = sid; target = pl; }
        });
      }
      m.status = frozen ? "frozen" : target ? "fighting" : "";
      if (target) {
        if (tileDistance(target, m) <= 1 && def.maxHit > 0) {
          if (++m.attackTimer >= def.speed) {
            m.attackTimer = 0;
            this.monsterAttack(m, id, target, m.target!);
          }
        } else if (!frozen) {
          m.attackTimer = Math.min(m.attackTimer, def.speed - 1); // ready to bite as soon as it catches you
          this.monsterStep(m, target);
        }
        return;
      }
      if (frozen) return;
      // Wander: now and then take a step somewhere near home (or head home if it chased too far).
      if (tileDistance(m, home) > WANDER_RADIUS) return this.monsterStep(m, home);
      if (Math.random() < 0.15) {
        const goal = { x: m.x + Math.floor(Math.random() * 3) - 1, y: m.y + Math.floor(Math.random() * 3) - 1 };
        if (tileDistance(goal, home) <= WANDER_RADIUS) this.monsterStep(m, goal);
      }
    });
  }

  /** One step toward a goal, staying in its own patch (never out of the Dark Forest, or into it). */
  private monsterStep(m: Monster, goal: Point) {
    const danger = isDanger(m.homeX, m.homeY);
    const home = { x: m.homeX, y: m.homeY };
    let best: Point | null = null;
    let bestD = tileDistance(m, goal);
    for (const d of [...CARDINAL, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }]) {
      const n = { x: m.x + d.x, y: m.y + d.y };
      if (!isWalkable(n.x, n.y) || isDanger(n.x, n.y) !== danger || tileDistance(n, home) > LEASH_RADIUS) continue;
      if (d.x && d.y && (!isWalkable(m.x + d.x, m.y) || !isWalkable(m.x, m.y + d.y))) continue;
      let taken = false;
      this.state.monsters.forEach((o) => { if (o !== m && o.alive && o.x === n.x && o.y === n.y) taken = true; });
      this.state.players.forEach((o) => { if (o.x === n.x && o.y === n.y) taken = true; });
      if (taken) continue;
      const dist = tileDistance(n, goal) + (d.x && d.y ? 0.1 : 0); // prefer straight steps on a tie
      if (dist < bestD) { bestD = dist; best = n; }
    }
    if (best) { m.x = best.x; m.y = best.y; }
  }

  /** A monster swings at you. Armor and Defense make it miss more; every attack trains Defense. */
  private monsterAttack(m: Monster, monsterId: string, p: Player, sessionId: string) {
    const def = MONSTERS[m.kind];
    const client = this.clients.getById(sessionId);
    const chance = monsterHitChance(m.kind, levelForXp(p.skillXp.defense), armorPoints(p.gear));
    const hit = Math.random() < chance;
    const damage = hit ? 1 + Math.floor(Math.random() * def.maxHit) : 0;
    p.hp = Math.max(0, p.hp - damage);
    p.dirty = true;
    this.broadcast("hit", { on: "player", id: sessionId, damage, miss: !hit, from: monsterId });
    // Armor wears down: one piece you're wearing takes the blow.
    const worn = GEAR_SLOTS.filter((s) => s !== "weapon" && p.gear[s]);
    if (worn.length) this.wearGear(p, client, worn[Math.floor(Math.random() * worn.length)], wearFor(def.level));
    const xp = defenseXp(m.kind);
    this.addXp(p, client, "combat", xp);
    this.addSkillXp(p, client, "defense", xp);
    if (p.hp <= 0) return this.die(p, sessionId, def.name);
    // Fight back automatically if you were just standing there.
    if (!p.fighting && !p.path.length && !p.target && !p.crafting && !this.fightBlock(p)) {
      p.fighting = monsterId;
      p.attackTimer = 99;
    }
    if (client) {
      this.sendVitals(client, p);
      if (p.hp <= p.maxHp / 4 && p.hp + damage > p.maxHp / 4) {
        this.say(client, `⚠ Your health is low (${p.hp}/${p.maxHp})! ${p.inventory.includes(POTION_ID) ? "Drink a health potion" : "Run away"}!`);
      }
    }
  }

  /** Out of health: you wake up next to Old Maren with half your health, and keep everything. */
  private die(p: Player, sessionId: string, killer: string) {
    const client = this.clients.getById(sessionId);
    this.stopActions(p);
    p.path = [];
    p.hp = Math.ceil(p.maxHp / 2);
    this.state.monsters.forEach((m) => { if (m.target === sessionId) m.target = null; });
    const maren = npcById("maren")!;
    const spot = [...CARDINAL, { x: 1, y: 1 }, { x: -1, y: 1 }].map((d) => ({ x: maren.x + d.x, y: maren.y + d.y })).find((t) => isWalkable(t.x, t.y)) ?? randomSpawn();
    p.x = spot.x;
    p.y = spot.y;
    p.dirty = true;
    if (client) {
      this.say(client, `☠ The ${killer.toLowerCase()} knocked you out! You wake up next to ${GUIDE_NAME} with half your health. You kept all your things.`);
      client.send("died", {});
      this.sendVitals(client, p);
    }
    this.saveSoon(p);
  }

  /** Weapons wear with each attack, armor with each attack on you. At 0 they break. */
  private wearGear(p: Player, client: Client | undefined, slot: GearSlot, amount: number) {
    const g = p.gear[slot];
    if (!g) return;
    const max = gearDurability(g.item);
    const before = g.durability;
    g.durability = Math.max(0, g.durability - amount);
    if (g.durability <= 0) {
      p.gear[slot] = null;
      if (client) this.say(client, `Your ${ITEMS[g.item].single} breaks!`);
    } else if (before > max * TOOL_WARN_AT && g.durability <= max * TOOL_WARN_AT) {
      if (client) this.say(client, `Your ${ITEMS[g.item].single} is about to break (${g.durability} uses left).`);
    }
    if (client) this.sendGear(client, p);
  }

  /** Mastery of a weapon type, spell or monster (no cap). */
  private addCombatMastery(p: Player, client: Client | undefined, id: CombatMasteryId, xp: number) {
    const before = combatMasteryIn(p.combatMastery, id);
    p.combatMastery[id] = (p.combatMastery[id] ?? 0) + xp;
    const after = combatMasteryIn(p.combatMastery, id);
    if (!client) return;
    client.send("combatmastery", p.combatMastery);
    if (after <= before) return;
    this.say(client, `${combatMasteryName(id)} Mastery ${after}! ` + (id in MONSTERS ? "You hit it more often, and it drops things more often." : "You hit more often, and a little harder."));
    client.send("combatmasteryup", { id, level: after });
  }

  /** Health, mana and their maximums (only you see your mana). */
  private sendVitals(client: Client, p: Player) {
    client.send("vitals", { hp: p.hp, maxHp: p.maxHp, mana: p.mana, maxMana: maxMana(levelForXp(p.skillXp.magic)) });
  }

  private sendGear(client: Client, p: Player) {
    client.send("gear", { gear: p.gear, spell: p.spell });
  }

  // ---- Old Maren's tutorial (steps in shared/quests.ts) ----

  /** The tutorial step this player is on, or null once it's finished. */
  private step(p: Player): QuestStep | null {
    return STEPS[p.quest.step] ?? null;
  }

  /** Something happened that might finish (or count toward) the current step. */
  private questEvent(p: Player, client: Client | undefined, ev: QuestEvent) {
    const step = this.step(p);
    if (!step) return;
    const g = step.goal;
    let counts = 0;
    if (g.kind === "gather" && ev.kind === "gather") {
      if (ev.skill === g.skill && (!g.resource || ev.resource === g.resource) && (!g.withTool || ev.withTool) && (!g.byHand || !ev.withTool)) counts = 1;
    } else if (g.kind === "toolBreaks" && ev.kind === "toolBreak") {
      if (ev.tool === g.tool) counts = 1;
    } else if (g.kind === "craft" && ev.kind === "craft") {
      if (ev.item.startsWith(g.prefix) && (ev.worked || g.tries)) counts = 1;
    } else if (g.kind === "eat" && ev.kind === "eat") {
      if (isStew(ev.item)) counts = 1;
    } else if (g.kind === "sell" && ev.kind === "sell") {
      const r = RESOURCE_FOR_ITEM[ev.item];
      if (r && RESOURCES[r].skill === g.what) counts = 1;
    } else if (g.kind === "kill" && ev.kind === "kill") {
      if ((!g.monster || ev.monster === g.monster) && (!g.style || ev.style === g.style)) counts = 1;
    } else if (g.kind === "drink" && ev.kind === "drink") {
      counts = 1;
    }
    if (!counts) return;
    p.quest.count += counts;
    p.dirty = true;
    if (p.quest.count >= ("count" in g ? g.count : 1)) this.advance(p, client);
    else if (client) this.sendQuest(client, p);
  }

  /** Steps that finish on their own: reaching a level, or having some items. */
  private checkQuest(p: Player, client: Client) {
    const step = this.step(p);
    if (step && this.goalMet(p, step)) this.advance(p, client);
    else this.sendQuest(client, p);
  }

  private goalMet(p: Player, step: QuestStep): boolean {
    const g = step.goal;
    if (g.kind === "level") return levelForXp(p.disciplines[g.discipline]) >= g.level;
    if (g.kind === "equip") return g.tools.every((prefix) => TOOL_TYPE_IDS.some((t) => p.belt[t]?.item.startsWith(prefix)));
    if (g.kind === "have") return Object.entries(g.items).every(([item, n]) => this.countOf(p, item as ItemId) >= n!);
    if (g.kind === "gear") return g.items.every((prefix) => GEAR_SLOTS.some((slot) => p.gear[slot]?.item.startsWith(prefix)));
    return false;
  }

  private countOf(p: Player, item: ItemId) {
    return p.inventory.filter((it) => it === item).length;
  }

  /** On to the next step (and past any that are already done, like a level you already have). */
  private advance(p: Player, client: Client | undefined) {
    p.quest.step++;
    p.quest.count = 0;
    p.dirty = true;
    let step = this.step(p);
    while (step && this.goalMet(p, step)) {
      p.quest.step++;
      step = this.step(p);
    }
    this.saveSoon(p);
    if (!client) return;
    if (step) this.say(client, `📜 Next: ${step.task}.`);
    this.sendQuest(client, p);
  }

  /** The tutorial makes some crafting turn out a set way: every stew burns until Maren explains it, and some tries always work. */
  private forcedCraft(p: Player, recipe: Recipe): "fail" | "success" | null {
    if (tutorialDone(p.quest)) return null;
    if (recipe.skill === "cooking" && p.quest.step <= BURN_UNTIL) return "fail";
    const step = this.step(p)!;
    if (step.guaranteed && step.goal.kind === "craft" && recipe.output.startsWith(step.goal.prefix)) return "success";
    return null;
  }

  /** Is this step's work refused right now? (Needs a tool you've taken off, or must be done by hand.) Returns what to say. */
  private toolBlock(p: Player, skill: SkillId): string | null {
    const step = this.step(p);
    if (!step) return null;
    const tool = toolForSkill(skill);
    if (!tool) return null;
    const name = TOOL_TYPES[tool].name.toLowerCase();
    if (step.needsTool === tool && !p.belt[tool]) {
      return `${GUIDE_NAME} wants you to use your ${name} for this. Click it in your bag and press "Put on belt" first.`;
    }
    const g = step.goal;
    if (g.kind === "gather" && g.byHand && g.skill === skill && p.belt[tool]) {
      return `${GUIDE_NAME} asked you to do this by hand. Take the ${name} off your belt first (click it on the belt).`;
    }
    return null;
  }

  /** Why you can't sell, drop or eat something Maren's current task needs. */
  private keepIt(item: ItemId, what: "sell" | "drop" | "eat"): string {
    const name = ITEMS[item].single;
    if (what === "sell") return `Merchant: Hold on to that ${name}, ${GUIDE_NAME} needs you to use it. Come back once you've done what she asked.`;
    if (what === "eat") return `Not yet! ${GUIDE_NAME} wants to see that ${name} first. Go and show her.`;
    return `Better keep that ${name}. ${GUIDE_NAME} needs you to use it.`;
  }

  /** Click Old Maren: she explains the next thing (and hands things over), or reminds you what to do. */
  private talkToGuide(client: Client, p: Player) {
    const step = this.step(p);
    if (!step) {
      return this.dialog(client, ["You've learned all I can teach you. Go and make your fortune!",
        "Keep an eye out for the bounty board. It's coming soon."]);
    }
    // Worn out with nothing to eat? She won't let you get stuck.
    if (p.stamina < 20 && !p.inventory.some((it) => isFood(it)) && p.inventory.includes(null)) {
      this.place(p, p.inventory.indexOf(null), "stew_minnow_3_pine");
      this.say(client, `${GUIDE_NAME}: You look worn out! Here, eat this stew. Next time, cook some of your own.`);
      this.sendInventory(client, p);
    }
    // Badly hurt during the combat lesson with no potion? She hands you one.
    if (step.quest === 3 && p.hp < p.maxHp / 3 && !p.inventory.includes(POTION_ID) && p.inventory.includes(null)) {
      this.place(p, p.inventory.indexOf(null), POTION_ID);
      this.say(client, `${GUIDE_NAME}: You're hurt! Here, drink this health potion.`);
      this.sendInventory(client, p);
    }
    if (step.goal.kind !== "talk") {
      const given = this.giveMissing(p, step.ensure);
      if (given) this.sendInventory(client, p);
      const t = step.needsTool && !p.belt[step.needsTool] ? ` And put your ${TOOL_TYPES[step.needsTool].name.toLowerCase()} back on your belt!`
        : this.fightBlock(p) ? ` And ${step.fightWith === "magic" ? "hold your staff" : "hold a weapon"}!` : "";
      return this.dialog(client, [`${step.hint ?? step.task}` + (given ? ` Here, take ${given}.` : "") + t]);
    }
    if (step.need && !p.inventory.some((it) => it?.startsWith(step.need!.prefix))) return this.dialog(client, [step.need.line]);
    const gifts = giftItems(step.give);
    const free = p.inventory.filter((it) => !it).length;
    if (free < gifts.length) {
      return this.dialog(client, [`I've got ${gifts.length} things for you, but your bag is too full. Make room for ${gifts.length - free} more and come back.`]);
    }
    for (const g of gifts) this.place(p, p.inventory.indexOf(null), g.item, g.durability);
    if (step.coins) p.coins += step.coins;
    const finished = STEPS[p.quest.step + 1]?.quest !== step.quest;
    this.dialog(client, step.lines ?? []);
    if (gifts.length || step.coins) {
      const names = [...new Set(gifts.map((g) => g.item))].map((item) => {
        const n = gifts.filter((g) => g.item === item).length;
        if (n === 1) return aOr(ITEMS[item].single);
        return `${n} ${plural(ITEMS[item].name)}`;
      });
      if (step.coins) names.push(formatMoney(step.coins));
      this.say(client, `${GUIDE_NAME} gives you ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]}.`);
    }
    if (step.opensGate) this.say(client, "🚪 The gate to the Dark Forest is open to you now. It's south of the meadow, past the ⚠ sign.");
    if (finished) {
      this.say(client, `🎉 Quest complete: ${QUESTS[step.quest]}!`);
      client.send("questDone", { quest: QUESTS[step.quest] });
    }
    this.advance(p, client);
    // Hand over anything the next step needs that you don't have (e.g. a minnow to cook).
    const extra = this.giveMissing(p, this.step(p)?.ensure);
    if (extra) this.say(client, `${GUIDE_NAME} also gives you ${extra}.`);
    this.sendInventory(client, p);
    this.saveSoon(p);
  }

  /** Give whatever of these you don't have. Returns what was given ("a pine log and a minnow"), or "". */
  private giveMissing(p: Player, gifts?: Gift[]): string {
    const given: string[] = [];
    for (const g of gifts ?? []) {
      // A tool counts if you have any of that kind (in your bag or on your belt); a stew counts if you have any stew.
      let have: number;
      if (isTool(g.item)) {
        const type = parseTool(g.item).type;
        have = (p.belt[type] ? 1 : 0) + p.inventory.filter((it) => isTool(it) && parseTool(it).type === type).length;
      } else if (isGear(g.item)) {
        const kind = g.item.split("_")[0];
        have = (GEAR_SLOTS.some((s) => p.gear[s]?.item.startsWith(`${kind}_`)) ? 1 : 0) + p.inventory.filter((it) => it?.startsWith(`${kind}_`)).length;
      } else if (isStew(g.item)) {
        have = p.inventory.filter((it) => isStew(it)).length;
      } else {
        have = this.countOf(p, g.item);
      }
      for (let n = have; n < (g.count ?? 1); n++) {
        const free = p.inventory.indexOf(null);
        if (free === -1) break;
        this.place(p, free, g.item, g.durability);
        given.push(aOr(ITEMS[g.item].single));
      }
    }
    if (given.length) p.dirty = true;
    return given.length > 1 ? `${given.slice(0, -1).join(", ")} and ${given[given.length - 1]}` : given[0] ?? "";
  }

  private dialog(client: Client, lines: string[]) {
    client.send("dialog", { name: GUIDE_NAME, lines });
  }

  /** What the quest tracker shows. */
  private questView(p: Player): QuestView {
    const step = this.step(p);
    if (!step) return { done: true, quest: "Tutorial complete", number: QUESTS.length, of: QUESTS.length, task: "The bounty board is coming soon.", talk: false };
    const g = step.goal;
    let progress: string | undefined;
    let fraction: number | undefined;
    if (g.kind === "level") {
      const xp = p.disciplines[g.discipline];
      const need = xpForLevel(g.level);
      progress = `${DISCIPLINES[g.discipline].name} XP ${Math.min(xp, need)} / ${need}`;
      fraction = Math.min(1, xp / need);
    } else if (g.kind === "have") {
      const want = Object.entries(g.items) as [ItemId, number][];
      progress = want.map(([item, n]) => `${Math.min(n, this.countOf(p, item))}/${n} ${ITEMS[item].name.toLowerCase()}`).join(", ");
      fraction = want.reduce((sum, [item, n]) => sum + Math.min(n, this.countOf(p, item)), 0) / want.reduce((sum, [, n]) => sum + n, 0);
    } else if (g.kind === "toolBreaks") {
      const t = p.belt[g.tool];
      progress = t ? `${t.durability} use${t.durability === 1 ? "" : "s"} left` : `Not on your belt yet`;
    } else if ("count" in g && g.count > 1) {
      progress = `${p.quest.count} / ${g.count}`;
      fraction = p.quest.count / g.count;
    }
    const warning = step.needsTool && !p.belt[step.needsTool] ? `Put your ${TOOL_TYPES[step.needsTool].name.toLowerCase()} back on your belt first!`
      : this.fightBlock(p) ? (step.fightWith === "magic" ? "Hold your staff first!" : "Hold a weapon first!") : undefined;
    return { done: false, quest: QUESTS[step.quest], number: step.quest + 1, of: QUESTS.length, task: step.task, progress, fraction, talk: g.kind === "talk", warning };
  }

  private sendQuest(client: Client, p: Player) {
    client.send("quest", this.questView(p));
  }

  /** Standing on one of the 8 tiles around the Merchant, furnace or anvil. */
  private nearNpc(p: Player, id: string) {
    const npc = NPCS.find((n) => n.id === id)!;
    return Math.max(Math.abs(p.x - npc.x), Math.abs(p.y - npc.y)) <= 1;
  }

  private stopActions(p: Player) {
    p.fighting = null;
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
    this.checkQuest(p, client); // "Reach Foraging level 3" steps
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
      if (skill === "cooking") {
        for (const fish of FISH_IDS) {
          const lv = RESOURCES[fish].level;
          if (lv > before && lv <= after) this.say(client, `You can now cook ${ITEMS[fish].name.toLowerCase()} stew!`);
        }
      } else if (skill === "defense") {
        p.maxHp = maxHealth(after);
        p.hp = Math.min(p.maxHp, p.hp + 2 * (after - before)); // the new health comes filled
        this.say(client, `Your health goes up to ${p.maxHp}.`);
        for (const m of Object.values(METALS)) if (m.level > before && m.level <= after) this.say(client, `You can now wear ${m.name.toLowerCase()} armor!`);
        this.sendVitals(client, p);
      } else if (skill === "melee" || skill === "ranged" || skill === "magic") {
        for (const w of Object.values(WEAPONS)) if (w.style === skill && w.level > before && w.level <= after) this.say(client, `You can now use ${aOr(w.name.toLowerCase())}!`);
        if (skill === "magic") {
          for (const sp of Object.values(SPELLS)) if (sp.level > before && sp.level <= after) this.say(client, `You can now cast ${sp.icon} ${sp.name}! Pick it under your gear.`);
          this.sendVitals(client, p);
        }
      } else if (isCraftSkill(skill)) {
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
    this.sendGear(client, p);
    client.send("inventory", p.inventory);
    client.send("coins", p.coins);
    this.checkQuest(p, client); // "Have 2 copper ore" steps
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
    // Saves from before the tutorial (or an older save version) start over from
    // scratch, so everyone plays Old Maren's tutorial. The account itself is kept.
    if (save.saveVersion !== SAVE_VERSION) {
      if (Object.keys(save).length) console.log(`${p.name}: old save (version ${save.saveVersion ?? "none"}), starting over`);
      save = {};
      // New characters start on the road near Old Maren.
      const spawn = { x: 16 + Math.floor(Math.random() * 4), y: 11 };
      if (isWalkable(spawn.x, spawn.y)) { p.x = spawn.x; p.y = spawn.y; return; }
    }
    if (save.quest && Number.isInteger(save.quest.step) && save.quest.step >= 0) {
      p.quest = { step: Math.min(save.quest.step, STEPS.length), count: Number.isInteger(save.quest.count) && save.quest.count >= 0 ? save.quest.count : 0 };
    }
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
        if (isTool(it) || isGear(it)) {
          const max = isTool(it) ? maxDurability(it) : gearDurability(it);
          const d = save.durability?.[i];
          p.durability[i] = typeof d === "number" && d > 0 ? Math.min(Math.floor(d), max) : max;
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
    // Stamina also came back while you were logged out (1 every 30 seconds). Old saves start full.
    if (typeof save.stamina === "number" && Number.isFinite(save.stamina)) {
      const away = typeof save.staminaAt === "number" ? Math.max(0, Date.now() - save.staminaAt) : 0;
      p.stamina = Math.max(0, Math.min(MAX_STAMINA, Math.floor(save.stamina) + Math.floor(away / STAMINA_REGEN_MS)));
    }
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
    // Combat: gear, Mastery, health (it came back 1 a minute while you were away) and mana (full).
    for (const slot of GEAR_SLOTS) {
      const g = save.gear?.[slot];
      if (g && isGear(g.item) && gearSlot(g.item) === slot && typeof g.durability === "number" && g.durability > 0) {
        p.gear[slot] = { item: g.item, durability: Math.min(Math.floor(g.durability), gearDurability(g.item)) };
      }
    }
    for (const id of ALL_COMBAT_MASTERY_IDS) if (ok(save.combatMastery?.[id])) p.combatMastery[id] = Math.floor(save.combatMastery![id]);
    if (SPELL_IDS.includes(save.spell as SpellId) && levelForXp(p.skillXp.magic) >= SPELLS[save.spell as SpellId].level) p.spell = save.spell as SpellId;
    p.maxHp = maxHealth(levelForXp(p.skillXp.defense));
    p.hp = p.maxHp;
    if (typeof save.hp === "number" && Number.isFinite(save.hp)) {
      const away = typeof save.hpAt === "number" ? Math.max(0, Date.now() - save.hpAt) : 0;
      p.hp = Math.max(1, Math.min(p.maxHp, Math.floor(save.hp) + Math.floor(away / HEALTH_REGEN_MS)));
    }
    p.mana = maxMana(levelForXp(p.skillXp.magic));
  }

  private snapshot(p: Player): SaveData {
    // Save where the player is heading, so walking off mid-path doesn't lose the move.
    const dest = p.path.length ? p.path[p.path.length - 1] : p;
    return { saveVersion: SAVE_VERSION, quest: { ...p.quest }, x: dest.x, y: dest.y, inventory: [...p.inventory], coins: p.coins, skills: { ...p.disciplines }, skillXp: { ...p.skillXp }, mastery: { ...p.mastery }, durability: [...p.durability], belt: { ...p.belt }, stamina: p.stamina, staminaAt: Date.now(), hp: p.hp, hpAt: Date.now(), gear: { ...p.gear }, spell: p.spell, combatMastery: { ...p.combatMastery }, lockedSlots: p.locked.flatMap((on, i) => (on && p.inventory[i] ? [i] : [])) };
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
