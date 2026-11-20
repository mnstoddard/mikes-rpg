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
  DISCIPLINES, DISCIPLINE_IDS, DisciplineId, DisciplineLevels, GatherSkill, SkillId, SkillXp, disciplineLevels,
  emptySkills, findSkill, isCraftSkill, isUnlocked, levelForXp, xpForLevel,
} from "../../shared/disciplines";
import {
  ALL_MASTERY_IDS, Recipe, buyPriceFor, failXp, gearDurability, masteryName, recipeFor, recipeWear, sellPriceFor,
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
  Belt, METALS, TOOL_TYPES, TOOL_TYPE_IDS, TOOL_WARN_AT, ToolType, emptyBelt, isTool, legacyTool, maxDurability, parseTool,
  toolBonus, toolForSkill, wearFor,
} from "../../shared/tools";
import { INVENTORY_SIZE, ITEMS, ItemId, LEGACY_ITEMS } from "../../shared/items";
import { NPCS, NpcDef, isChest, npcById } from "../../shared/npcs";
import {
  Bag, addItem, groupOf, newEntry, stackLimit, wearsOut, clearEntry, cloneBag, compact, countIn, countItem, emptyBag, entriesIn, entriesInOrder, mergeStacks, putBack, reorderSlots, roomFor, roomForAll,
  stackName, takeFromEntry, takeItem, usedSlots,
} from "../../shared/bag";
import { carriedWeight, carryCapacity, kg, weightOf } from "../../shared/weight";
import { buyWithCharisma, maxStamina, sellWithCharisma, tradingXp, walkBonus } from "../../shared/stats";
import {
  CHEST_MAX, CHEST_RENT, CHEST_START, CHEST_STEP, GUILD_BOUNTY_COUNT, GuildBounty, GuildView, RANKS, REAGENTS, expandCost, guildBountyName,
  guildRenown, guildReward, newGuildBoard, newGuildBounty, rankFor, validGuildBounty,
} from "../../shared/guild";
import { findSkill as skillInfo } from "../../shared/disciplines";
import { formatMoney } from "../../shared/money";
import {
  BASE_INGREDIENTS, DISHES, DISH_IDS, MAX_STAMINA, SHOP_STEW, STAMINA_COST, STAMINA_REGEN_MS, foodStamina, isFood, isMeal, legacyStew, parseMeal,
} from "../../shared/cooking";
import { BAITS, BaitId, MUSHROOM_CHANCE, SCRAPS_CHANCE, WORM_CHANCE, isBait } from "../../shared/handicraft";
import { TREES, TreeEffect, TreeRanks, cleanRanks, earnedPoints, rankCost, spentPoints, treeBonus, treeNode, treeRoll } from "../../shared/skilltree";
import {
  GUIDE_NAME, Gift, QUEST_REV, boardOpen, migrateQuest, teacherOf, unlockedSkills, isProtected, QuestProgress, QuestStep, QuestView,
  gateOpen, giftItems, newQuestProgress, tutorialDone, currentStep, chapterById, chapterOf, chapterDone, chapterOpen, chapterViews,
  questMarks, marenDone, stewsBurn, ChapterProgress, Chapter,
} from "../../shared/quests";
import { SHOPS, SHOP_IDS, ShopId, isShop } from "../../shared/shops";
import { RepairJob, isBroken, isRepairable, maxUses, repairCost } from "../../shared/repair";
import { BOUNTY_COUNT, Bounty, bountyChoices, bountyName, bountyReward, newBoard, newBounty, slotCounts, validBounty } from "../../shared/bounties";
import { Account, SAVE_VERSION, SaveData, checkPassword, hashPassword, store, usernameKey } from "./storage";
import { PLAYER_COLORS, isPlayerColor } from "../../shared/colors";

const STEP_LOOP_MS = 50; // how often the server checks whether someone should take a step
const AUTOSAVE_TICKS = 100; // 100 x 0.6s = once a minute
const MIN_SAVE_GAP_MS = 10_000; // "important" saves happen right away, but at most every 10s per player
const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,11}$/;
const MIN_PASSWORD = 6;
/** How many of a stack to sell or move: a whole number from 1 up, or everything if left out. */
const wantCount = (count: unknown) => (Number.isInteger(count) && (count as number) >= 1 ? (count as number) : Infinity);
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
  @type("number") stepMs = TICK_MS; // how long each step takes (Dexterity makes you walk faster), so others see you slide at the right speed

  // Server-only (not synced to everyone):
  path: Point[] = [];
  target: Point | null = null; // tree or water the player is heading to / working on
  activity: SkillId | null = null; // what they'll do when they get there
  resource: ResourceId | null = null; // which type of tree / rock / fish
  // The bag (shared/bag.ts): one place in each list per entry (an axe, 12 pine logs...).
  inventory: (ItemId | null)[] = [];
  counts: number[] = []; // per entry: how many
  durability: (number | null)[] = []; // per entry: uses left, for tools, gear and bait
  slotOf: number[] = []; // per entry: which bag slot it's in
  slotCount = INVENTORY_SIZE; // bag slots
  belt: Belt = emptyBelt(); // equipped tools (don't use bag space)
  crafting: { recipe: Recipe; remaining: number; station: NpcDef } | null = null; // smelting / smithing in progress
  craftTimer = 0;
  skillXp: SkillXp = emptySkills(); // XP per skill (Woodcutting level etc.)
  unlocked: SkillId[] = []; // skills Old Maren has taught (shared/quests.ts unlockedSkills); kept up to date by refreshStats
  levels: DisciplineLevels = { strength: 1, endurance: 1, wisdom: 1, dexterity: 1, charisma: 1 }; // each Discipline's level (average of its unlocked skills)
  mastery: ItemMasteryXp = {}; // Mastery XP per type (Pine, Copper, Trout...)
  coins = 0; // total money, in bronze coins
  stamina = MAX_STAMINA; // each action costs some; food and time bring it back (max from Endurance)
  maxStamina = MAX_STAMINA;
  regenTicks = 0; // ticks since the last stamina came back on its own
  locked: boolean[] = []; // per entry: locked items can't be sold or dropped by accident
  talkTo: NpcDef | null = null; // person the player is walking over to talk to
  quest: QuestProgress = newQuestProgress(); // where they are in the main quest (Maren's chapter, then the trainers')
  nextStepAt = 0; // time (ms) this player may take their next step
  gear: Gear = emptyGear(); // weapon and armor being worn (don't use bag space)
  mana = 50;
  spell: SpellId = "fire_blast"; // the spell cast when holding a staff
  combatMastery: CombatMasteryXp = {}; // Mastery XP per weapon type, spell and monster
  fighting: string | null = null; // id of the monster being attacked
  attackTimer = 0; // ticks since the last attack
  healthTicks = 0; // ticks since health last came back on its own
  manaTicks = 0;
  bounties: Bounty[] = []; // the 5 jobs on this player's bounty board (filled the first time they look)
  tree: TreeRanks = {}; // Mastery skill tree ranks bought, e.g. { "cooking.slots": 2 } (shared/skilltree.ts)
  tracked: ItemId | null = null; // the bounty shown on the quest tracker (by its item), or null for Maren's quest
  // The Mages' Guild (shared/guild.ts):
  guildPoints = 0; // from the guild's bounties; decides your rank
  guildBounties: GuildBounty[] = []; // the guild board's 3 magic jobs (filled the first time they look)
  chest: Bag = emptyBag(0); // the enchanted chest; 0 spaces until you rent it
  loginNotes: string[] = []; // things to tell the player when they arrive (e.g. what happened to an old, bigger bag)
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

const CARDINAL = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

/** Things that can count toward a tutorial step. */
type QuestEvent =
  | { kind: "gather"; skill: GatherSkill; resource: ResourceId; withTool: boolean }
  | { kind: "toolBreak"; tool: ToolType }
  | { kind: "craft"; item: ItemId; worked: boolean }
  | { kind: "eat"; item: ItemId }
  | { kind: "sell"; item: ItemId }
  | { kind: "buy"; item: ItemId }
  | { kind: "repair" }
  | { kind: "kill"; monster: MonsterId; style: CombatStyle }
  | { kind: "drink" }
  | { kind: "track" }
  | { kind: "bounty" };

/** Where each crafting skill is done. */
const STATION_FOR = { smelting: "furnace", smithing: "anvil", cooking: "stove", handicraft: "workbench" } as const;

const isRock = (x: number, y: number) =>
  y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH && MAP[y][x] === "rock";
const isTree = (x: number, y: number) =>
  y >= 0 && y < MAP_HEIGHT && x >= 0 && x < MAP_WIDTH && MAP[y][x] === "tree";

/** "a bronze bar" / "an iron bar". */
const aOr = (word: string) => /(tongs|platelegs|boots)\b/.test(word) ? `a pair of ${word}` : `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
/** "2 bronze bars", "3 health potions" (names already plural, like "Pine logs", stay as they are). */
const plural = (name: string) => /[a-rt-z]$/i.test(name) ? `${name.toLowerCase()}s` : name.toLowerCase();

/** Where an item goes when the bag is sorted (lower first). */
function sortGroup(item: ItemId): number {
  if (isTool(item)) return 0;
  if (isWeapon(item)) return 1;
  if (isArmor(item)) return 2;
  if (isFood(item)) return 3;
  if (item === POTION_ID) return 4;
  if (item.endsWith("_bar")) return 5;
  const r = RESOURCE_FOR_ITEM[item];
  if (r) return { woodcutting: 6, mining: 7, fishing: 8 }[RESOURCES[r].skill as "woodcutting" | "mining" | "fishing"] ?? 9;
  return 10;
}

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

    // While a shop is open, clicking an inventory item sells it (if that shop buys it).
    this.onMessage("sell", (client, msg: { slot: number; count?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      const item = p.inventory[msg.slot];
      if (!item) return;
      if (p.locked[msg.slot]) return this.say(client, `That ${ITEMS[item].single} is locked. Unlock it to sell it.`);
      if (isProtected(p.quest, item)) return this.say(client, this.keepIt(p, item, "sell"));
      const shop = this.nearShop(p);
      if (!shop) return this.say(client, "You need to be next to a shopkeeper to sell.");
      if (!SHOPS[shop].buys(item)) return this.say(client, `${npcById(shop)!.name} only buys ${SHOPS[shop].buysText}. Shopkeeper Tam at the General Store buys anything.`);
      // Sell `count` of the stack (all of it if left out).
      const n = Math.min(countIn(p, msg.slot), wantCount(msg.count));
      const price = sellWithCharisma(sellPriceFor(item, p.mastery, p.durability[msg.slot]), p.levels.charisma) * n;
      takeFromEntry(p, msg.slot, n);
      p.coins += price;
      this.say(client, `You sell ${stackName(item, n)} for ${formatMoney(price)}.`);
      for (let k = 0; k < n; k++) this.questEvent(p, client, { kind: "sell", item });
      this.addSkillXp(p, client, "trading", tradingXp(price));
      this.sendInventory(client, p);
      this.saveSoon(p);
    });

    // Sell everything that isn't locked, in one go.
    this.onMessage("sellAll", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const shop = this.nearShop(p);
      if (!shop) return this.say(client, "You need to be next to a shopkeeper to sell.");
      const name = npcById(shop)!.name;
      let count = 0;
      let total = 0;
      const sold: ItemId[] = [];
      const kept = new Set<ItemId>();
      for (let i = 0; i < p.inventory.length; i++) {
        const item = p.inventory[i];
        if (!item || p.locked[i]) continue;
        if (isProtected(p.quest, item)) { kept.add(item); continue; }
        if (!SHOPS[shop].buys(item)) continue;
        const n = countIn(p, i);
        total += sellWithCharisma(sellPriceFor(item, p.mastery, p.durability[i]), p.levels.charisma) * n;
        clearEntry(p, i);
        for (let k = 0; k < n; k++) sold.push(item);
        count += n;
      }
      if (kept.size) this.say(client, `${name}: I'll leave your ${[...kept].map((i) => ITEMS[i].name.toLowerCase()).join(" and ")} alone. ${this.giverName(p)} needs you to use those first.`);
      if (!count) return this.say(client, kept.size ? "You have nothing else to sell here." : `You have nothing ${name} buys that isn't locked. (${name} buys ${SHOPS[shop].buysText}.)`);
      p.coins += total;
      this.say(client, `You sell ${count} item${count === 1 ? "" : "s"} for ${formatMoney(total)}.`);
      for (const item of sold) this.questEvent(p, client, { kind: "sell", item });
      this.addSkillXp(p, client, "trading", tradingXp(total));
      this.sendInventory(client, p);
      this.saveSoon(p);
    });

    // Buy from a shop (endless stock). Prices don't use your Mastery.
    this.onMessage("buy", (client, msg: { item: string; count?: number }) => {
      const p = this.state.players.get(client.sessionId);
      const item = msg?.item as ItemId;
      if (!p || !ITEMS[item]) return;
      const shop = this.nearShop(p);
      if (!shop) return this.say(client, "You need to be next to a shopkeeper to buy.");
      if (!SHOPS[shop].stock.includes(item)) return;
      const want = Math.max(1, Math.min(28, Math.floor(Number(msg.count) || 1)));
      const price = buyWithCharisma(buyPriceFor(item), p.levels.charisma);
      let bought = 0;
      while (bought < want) {
        if (!this.fits(p, item) || p.coins < price) break;
        p.coins -= price;
        this.give(p, item);
        bought++;
      }
      if (!bought) {
        return this.say(client, this.fits(p, item)
          ? `You need ${formatMoney(price)} for ${aOr(ITEMS[item].single)}.` : this.fullReason(p, item));
      }
      this.sendInventory(client, p);
      this.say(client, `You buy ${bought} ${bought === 1 ? ITEMS[item].single : ITEMS[item].name.toLowerCase()} for ${formatMoney(price * bought)}.`);
      this.questEvent(p, client, { kind: "buy", item });
      this.saveSoon(p);
    });

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
      this.say(client, `You put the ${ITEMS[item].single} on your belt: ${this.toolEffect(item)}.` +
        (old ? ` Your ${ITEMS[old.item].single} goes in your bag.` : ""));
      this.saveSoon(p);
    });

    // The Repairer: fix one thing (on your belt, in your gear, or in your bag), or everything at once.
    this.onMessage("repair", (client, msg: { where: string; key: string | number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const job = this.repairJobs(p).find((j) => j.where === msg?.where && j.key === msg?.key);
      if (job) this.doRepairs(client, p, [job]);
    });
    this.onMessage("repairAll", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p) this.doRepairs(client, p, this.repairJobs(p));
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
      if (isProtected(p.quest, item)) return this.say(client, this.keepIt(p, item, "eat"));
      const questEat = this.step(p)?.goal.kind === "eat" && isMeal(item); // Maren asked you to eat it, so you can even when full
      if (p.stamina >= p.maxStamina && !questEat) return this.say(client, `You're not hungry. Your stamina is full (${p.maxStamina}).`);
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

    // At the furnace, anvil or stove: make one, or keep going until you run out.
    this.onMessage("craft", (client, msg: { item: string; all?: boolean }) => {
      const p = this.state.players.get(client.sessionId);
      const recipe = p && recipeFor(msg?.item as ItemId);
      if (!p || !recipe) return;
      const station = NPCS.find((n) => n.id === STATION_FOR[recipe.skill])!;
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
      const verb = { smelting: "smelting", smithing: "making", cooking: "cooking", handicraft: "making" }[recipe.skill];
      this.say(client, `You start ${verb} ${msg.all ? ITEMS[recipe.output].name.toLowerCase() : aOr(ITEMS[recipe.output].single)}. ` +
        (this.forcedCraft(p, recipe) === "success" ? `${this.giverName(p)} is guiding your hand, so this one will work.`
          : `${percent(chance)} chance each.` + (!tool || p.belt[tool] || !recipe.needsTool ? "" : ` (No ${TOOL_TYPES[tool].name.toLowerCase()} on your belt: half the chance.)`)));
    });

    // Bounty board: hand in the full amount for one bounty (never locked or worn items).
    this.onMessage("handIn", (client, msg: { index: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.index)) return;
      const b = p.bounties[msg.index];
      if (!b || !this.boardReady(client, p)) return;
      const ok = (i: number) => slotCounts(b.item, p.inventory[i], p.locked[i], p.durability[i]) && !isProtected(p.quest, b.item);
      const have = countItem(p, b.item, ok);
      if (have < b.count) {
        const unused = isTool(b.item) || isGear(b.item) ? " unused" : "";
        return this.say(client, `You need ${b.count}${unused} ${b.count === 1 ? ITEMS[b.item].single : ITEMS[b.item].name.toLowerCase()} for that bounty (you have ${have}). Locked items don't count.`);
      }
      const reward = bountyReward(b, p.mastery);
      takeItem(p, b.item, b.count, ok);
      p.coins += reward.coins;
      this.say(client, `📋 Bounty done: ${bountyName(b).toLowerCase()}! You get ${formatMoney(reward.coins)}, ${reward.xp} ${reward.label} XP and ${reward.renown} Renown XP.`);
      if (reward.skill) this.addSkillXp(p, client, reward.skill, reward.xp);
      this.addSkillXp(p, client, "renown", reward.renown);
      if (reward.monster) this.addCombatMastery(p, client, reward.monster, reward.xp);
      // A new job goes up in its place.
      const others = p.bounties.filter((_, i) => i !== msg.index).map((x) => x.item);
      const next = newBounty(p, [...others, b.item]);
      if (next) p.bounties[msg.index] = next; else p.bounties.splice(msg.index, 1);
      if (p.tracked === b.item && !p.bounties.some((x) => x.item === b.item)) p.tracked = null; // done: the tracker goes back to Maren's quest
      this.questEvent(p, client, { kind: "bounty" });
      this.sendInventory(client, p);
      this.sendBounties(client, p);
      this.saveSoon(p);
    });

    // Bounty board: swap all 5 for new ones (free for now).
    this.onMessage("refreshBounties", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !this.boardReady(client, p)) return;
      p.bounties = newBoard(p);
      if (p.tracked && !p.bounties.some((x) => x.item === p.tracked)) p.tracked = null;
      this.say(client, "📋 You take down the old notices. New ones are pinned up.");
      this.sendBounties(client, p);
      p.dirty = true;
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

    // Pick what the quest tracker shows: a bounty (by its place on the board), or Maren's quest.
    this.onMessage("track", (client, msg: { bounty?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const b = Number.isInteger(msg?.bounty) ? p.bounties[msg.bounty!] : undefined;
      p.tracked = b && boardOpen(p.quest) ? b.item : null;
      p.dirty = true;
      this.sendTracked(client, p);
      if (p.tracked) this.questEvent(p, client, { kind: "track" });
    });

    // ⚙️ Settings: change your character's colour.
    this.onMessage("setColor", (client, msg: { color: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !isPlayerColor(msg?.color)) return;
      p.color = msg.color;
      this.saveSoon(p);
      this.say(client, `You're ${PLAYER_COLORS.find((c) => c.color === msg.color)!.name.toLowerCase()} now.`);
    });

    // ⚙️ Settings: change your name (it's also what you log in with).
    this.onMessage("rename", async (client, msg: { name: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const name = String(msg?.name ?? "").trim();
      const reply = (ok: boolean, text: string) => client.send("account", { ok, text, name: p.name });
      if (!USERNAME_RE.test(name)) return reply(false, "Names are 1-12 letters, numbers, spaces, _ or -, starting with a letter or number.");
      if (name === p.name) return reply(false, "That's already your name.");
      const oldKey = usernameKey(p.name), newKey = usernameKey(name);
      if (newKey !== oldKey && (online.has(newKey) || waitingToReconnect.has(newKey))) return reply(false, "That name is taken. Try another one.");
      try {
        await this.save(p); // so nothing is lost under the old name
        if (!(await store.rename(p.name, name))) return reply(false, "That name is taken. Try another one.");
      } catch (err: any) {
        console.error(`Renaming ${p.name} failed:`, err.message);
        return reply(false, "Couldn't change your name right now. Try again in a bit.");
      }
      console.log(`${p.name} is now called ${name}`);
      online.delete(oldKey);
      online.add(newKey);
      p.name = name;
      reply(true, `Your name is now ${name}. Use it to log in from now on.`);
    });

    // ⚙️ Settings: change your password (needs the old one).
    this.onMessage("setPassword", async (client, msg: { current: string; next: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const reply = (ok: boolean, text: string) => client.send("account", { ok, text, name: p.name });
      const current = String(msg?.current ?? ""), next = String(msg?.next ?? "");
      if (next.length < MIN_PASSWORD) return reply(false, `Passwords need at least ${MIN_PASSWORD} characters.`);
      if (next.length > 100) return reply(false, "That password is too long.");
      try {
        const account = await store.get(p.name);
        if (!account || !(await checkPassword(current, account.passwordHash))) return reply(false, "Your current password isn't right.");
        await store.setPassword(p.name, await hashPassword(next));
      } catch (err: any) {
        console.error(`Changing ${p.name}'s password failed:`, err.message);
        return reply(false, "Couldn't change your password right now. Try again in a bit.");
      }
      reply(true, "Password changed. Use the new one next time you log in.");
    });

    // Lock or unlock one item (the one in this inventory slot).
    this.onMessage("lock", (client, msg: { slot: number; locked: boolean }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot) || !p.inventory[msg.slot]) return;
      p.locked[msg.slot] = !!msg.locked;
      this.sendBag(client, p);
      this.saveSoon(p);
    });

    // Mastery skill trees: buy the next rank of an upgrade with Mastery points.
    this.onMessage("treeBuy", (client, msg: { node: string }) => {
      const p = this.state.players.get(client.sessionId);
      const node = treeNode(String(msg?.node));
      if (!p || !node) return;
      const rank = p.tree[node.id] ?? 0;
      if (rank >= node.maxRank) return this.say(client, `${node.name} is already at its top rank.`);
      const free = this.freePoints(p);
      const cost = rankCost(rank + 1);
      if (free < cost) return this.say(client, `Rank ${rank + 1} of ${node.name} costs ${cost} Mastery point${cost === 1 ? "" : "s"}, and you have ${free}. Every Mastery level you gain earns one.`);
      p.tree[node.id] = rank + 1;
      this.say(client, `🌳 ${findSkill(node.skill).def.name}: ${node.name} rank ${rank + 1}!`);
      this.treeChanged(client, p);
      this.checkQuest(p, client); // Maren's "spend a Mastery point" step
    });

    // Reset one skill's tree (or every tree): free for now, all the points come back.
    this.onMessage("treeReset", (client, msg: { skill?: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const skill = msg?.skill && msg.skill in TREES ? (msg.skill as SkillId) : null;
      const before = spentPoints(p.tree);
      for (const id of Object.keys(p.tree)) if (!skill || treeNode(id)?.skill === skill) delete p.tree[id];
      const back = before - spentPoints(p.tree);
      if (!back) return;
      this.say(client, `🌳 You reset ${skill ? `your ${findSkill(skill).def.name} tree` : "all your skill trees"}. ${back} Mastery point${back === 1 ? "" : "s"} back to spend.`);
      this.treeChanged(client, p);
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
      client.send("tree", p.tree);
      this.fillBoard(p);
      this.sendBounties(client, p);
      client.send("clock", { now: Date.now() }); // day and night (shared/daynight.ts)
      if (msg?.reconnected) return;
      const step = this.step(p);
      if (!step) this.say(client, tutorialDone(p.quest) ? "Welcome back!" : "Welcome back! Talk to anyone with a ❗ for your next lesson.");
      else if (p.quest.active === "maren" && p.quest.ch.maren?.step === 0) this.say(client, `Welcome! Go and talk to ${GUIDE_NAME} (the ❗ in the town square, by the stove). She'll show you how to get started.`);
      else this.say(client, `Welcome back! Your task: ${step.task}.`);
      for (const note of p.loginNotes.splice(0)) this.say(client, note);
    });

    this.onMessage("drop", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot) || !p.inventory[msg.slot]) return;
      const item = p.inventory[msg.slot]!;
      if (p.locked[msg.slot]) return this.say(client, `That ${ITEMS[item].single} is locked. Unlock it to drop it.`);
      if (isProtected(p.quest, item)) return this.say(client, this.keepIt(p, item, "drop"));
      clearEntry(p, msg.slot); // the whole stack
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

    // ---- Mages' Guild ----

    // Rent the enchanted chest (first 4 spaces), or pay to add 4 more.
    this.onMessage("buyChestSpace", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !this.nearGuild(client, p)) return;
      const size = p.chest.slotCount;
      const cost = size ? expandCost(size) : CHEST_RENT;
      if (cost == null) return this.say(client, "Your chest is as big as the guild makes them.");
      const rank = rankFor(p.guildPoints);
      const next = size ? size + CHEST_STEP : CHEST_START;
      if (next > RANKS[rank].maxChest) {
        const need = RANKS.find((r) => r.maxChest >= next)!;
        return this.say(client, `${/^[AEIOU]/.test(RANKS[rank].name) ? "An" : "A"} ${RANKS[rank].name} may only rent ${RANKS[rank].maxChest} spaces. Reach ${need.name} (${need.points} guild points) for more: do the guild's magic bounties.`);
      }
      if (p.coins < cost) return this.say(client, `That costs ${formatMoney(cost)}. You have ${formatMoney(p.coins)}.`);
      p.coins -= cost;
      p.chest.slotCount = next;
      this.say(client, size
        ? `🔮 Archmage Ysolde widens your chest's enchantment: ${next} spaces now, for ${formatMoney(cost)}.`
        : `🔮 You rent space in the enchanted chest for ${formatMoney(cost)}: ${next} spaces. Open it here, on the east island or in the Dark Forest.`);
      client.send("coins", p.coins);
      this.sendGuild(client, p);
      this.saveSoon(p);
    });

    // Put a whole stack from your bag into the chest.
    this.onMessage("deposit", (client, msg: { slot: number; count?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      const item = p.inventory[msg.slot];
      if (!item) return;
      if (!this.nearChest(p)) return this.say(client, "You need to be next to an enchanted chest.");
      if (isProtected(p.quest, item)) return this.say(client, this.keepIt(p, item, "store"));
      const n = Math.min(countIn(p, msg.slot), wantCount(msg.count));
      const put = addItem(p.chest, item, n, p.durability[msg.slot]);
      if (!put) return this.say(client, "Your chest is full. Buy more space from Archmage Ysolde at the Mages' Guild.");
      takeFromEntry(p, msg.slot, put);
      if (put < n) this.say(client, `Only ${put} fit in your chest.`);
      this.sendInventory(client, p);
      this.sendChest(client, p);
      this.saveSoon(p);
    });

    // Take a whole stack out of the chest into your bag.
    this.onMessage("withdraw", (client, msg: { slot: number; count?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      const item = p.chest.inventory[msg.slot];
      if (!item) return;
      if (!this.nearChest(p)) return this.say(client, "You need to be next to an enchanted chest.");
      const n = Math.min(countIn(p.chest, msg.slot), wantCount(msg.count));
      const got = this.give(p, item, n, p.chest.durability[msg.slot]);
      if (!got) return this.say(client, this.fullReason(p, item));
      takeFromEntry(p.chest, msg.slot, got);
      if (got < n) this.say(client, `You can only take ${got} (bag space or weight).`);
      this.sendInventory(client, p);
      this.sendChest(client, p);
      this.saveSoon(p);
    });

    // Guild board: hand in reagents for a "bring" bounty.
    this.onMessage("guildHandIn", (client, msg: { index: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.index) || !this.nearGuild(client, p)) return;
      const b = p.guildBounties[msg.index];
      if (!b || b.kind !== "reagent") return;
      const ok = (i: number) => !p.locked[i];
      const have = countItem(p, b.item, ok);
      if (have < b.count) return this.say(client, `You need ${stackName(b.item, b.count)} for that (you have ${have}). Locked items don't count.`);
      takeItem(p, b.item, b.count, ok);
      this.finishGuildBounty(client, p, msg.index);
      this.sendInventory(client, p);
      this.saveSoon(p);
    });

    // Guild board: swap all 3 for new ones (free). Progress on spell bounties is lost.
    this.onMessage("refreshGuild", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !this.nearGuild(client, p)) return;
      p.guildBounties = newGuildBoard(this.guildPlayer(p));
      this.say(client, "🔮 The guild board shimmers, and new jobs appear.");
      this.sendGuild(client, p);
      p.dirty = true;
    });

    // Drink a health potion.
    this.onMessage("drink", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot) || p.inventory[msg.slot] !== POTION_ID) return;
      const questDrink = this.step(p)?.goal.kind === "drink"; // Maren asked you to, so you can even at full health
      if (p.hp >= p.maxHp && !questDrink) return this.say(client, `You're already at full health (${p.maxHp}).`);
      takeFromEntry(p, msg.slot, 1);
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
      if (p.stamina < p.maxStamina && ++p.regenTicks >= REGEN_TICKS) {
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
      const mMax = this.maxManaOf(p);
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
      p.nextStepAt = Math.max(p.nextStepAt + p.stepMs, now + p.stepMs - STEP_LOOP_MS);
    });
  }

  /** Walk next to a tree, rock or the water, then start working it on the next tick. */
  private startGathering(client: Client, p: Player, resource: ResourceId, target: Point) {
    const res = RESOURCES[resource];
    const skill = res.skill;
    const { def } = findSkill(skill);
    if (!isUnlocked(p.unlocked, skill)) return this.say(client, this.notTaught(skill));
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

    const res = RESOURCES[resource];
    if (!this.fits(p, res.item)) {
      if (client) this.say(client, this.fullReason(p, res.item));
      return this.stopActions(p);
    }

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
        this.say(client, START[gather] + (belt ? "" : ` You have no ${TOOL_TYPES[tool].name.toLowerCase()} on your belt, so it's 3 times slower. The trainers sell them.`));
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
    if (!FAST_GATHER_FOR_TESTS && Math.random() >= gatherChancePerTick(resource, mastery, belt ? toolBonus(belt.item) : null) * boost) return;
    if (Math.random() >= gatherSuccessChance(resource, mastery)) {
      // Never happens yet (success is always 100%); here for harder types later.
      if (client) this.say(client, skill === "fishing" ? "Something bites, but it gets away." : "You don't manage to get anything.");
      return;
    }

    this.give(p, res.item);
    if (!treeRoll(p.tree, skill, "staminaSave")) this.useStamina(p, skill);
    this.questEvent(p, client, { kind: "gather", skill: gather, resource, withTool: !!belt });
    this.wearTool(p, client, tool, wearFor(res.level));
    const extras: string[] = [];
    // A second one: the skill tree's "Lucky find", or glow bait.
    const luck = this.tree(p, skill, "double") + (bait?.effect === "double" ? bait.amount : 0);
    if (Math.random() < luck && this.give(p, res.item)) extras.push(`a second ${item.single}`);
    // Now and then you dig up a worm (for bait) or find a mushroom (for cooking).
    if (skill !== "fishing" && Math.random() < WORM_CHANCE && this.give(p, "worm")) extras.push("a worm");
    if (skill === "woodcutting" && Math.random() < MUSHROOM_CHANCE && this.give(p, "mushroom")) extras.push("a mushroom");
    if (bait) this.useBait(p, client, baitSlot);
    if (client) {
      this.sendInventory(client, p);
      this.sendStamina(client, p);
      const GOT = {
        woodcutting: `You get some ${item.name.toLowerCase()}.`,
        mining: `You mine some ${item.name.toLowerCase()}.`,
        fishing: `You catch ${aOr(item.single)}!`,
      };
      this.say(client, GOT[gather] + (extras.length ? ` You also get ${extras.join(" and ")}!` : ""));
    }
    // Chum bait: more Fishing XP (the skill only, like the tree's "Quick learner").
    const skillXp = bait?.effect === "xp" ? Math.round(res.xp * (1 + bait.amount)) : res.xp;
    this.addMasteryXp(p, client, resource, res.xp);
    this.addSkillXp(p, client, skill, skillXp); // sends both skill levels and Mastery
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
    // Will what you make fit, once the inputs are used up?
    const after = cloneBag(p);
    for (const input of recipe.inputs) takeItem(after, input, 1, (i) => !after.locked[i]);
    const inputsWeight = recipe.inputs.reduce((sum, i) => sum + weightOf(i), 0);
    if (roomFor(after, recipe.output) < 1 || this.carried(p) - inputsWeight + weightOf(recipe.output) > this.capacity(p)) {
      if (client) this.say(client, roomFor(after, recipe.output) < 1 ? "Your bag is full. Make room first." : this.fullReason(p, recipe.output));
      return this.stopActions(p);
    }
    if (!treeRoll(p.tree, recipe.skill, "staminaSave")) this.useStamina(p, recipe.skill);
    // Use the inputs (never locked ones).
    for (const input of recipe.inputs) takeItem(p, input, 1, (i) => !p.locked[i]);
    const output = ITEMS[recipe.output];
    const chance = this.craftChance(p, recipe);
    const forced = this.forcedCraft(p, recipe); // the tutorial's first stew always burns; some tries always work
    const worked = forced ? forced === "success" : Math.random() < chance;
    const xp = worked ? recipe.xp : failXp(recipe.xp);
    if (worked) this.give(p, recipe.output);
    const tool = toolForSkill(recipe.skill);
    if (tool) this.wearTool(p, client, tool, recipeWear(recipe));
    const extras: string[] = [];
    // The skill tree's "Extra bar" / "Bait bundle": sometimes you make two.
    if (worked && treeRoll(p.tree, recipe.skill, "extra") && this.give(p, recipe.output)) extras.push(`a second ${output.single}`);
    // Cooking leaves food scraps behind now and then (for chum bait).
    if (worked && recipe.skill === "cooking" && Math.random() < SCRAPS_CHANCE && this.give(p, "food_scraps")) extras.push("some food scraps");
    if (client) {
      this.sendInventory(client, p);
      this.sendStamina(client, p);
      const WORKED = {
        smelting: `You smelt ${aOr(output.single)}.`,
        smithing: `You make ${aOr(output.single)}!`,
        cooking: `You cook ${aOr(output.single)}! Eat it for ${foodStamina(recipe.output, p.mastery, this.tree(p, "cooking", "mealStamina"))} stamina.`,
        handicraft: `You make ${aOr(output.single)}.`,
      };
      const FAILED = {
        smelting: `The ore burns away. You fail to smelt ${aOr(output.single)}.`,
        smithing: `You ruin the metal. You fail to make ${aOr(output.single)}.`,
        cooking: `You burn the ${output.single}. The ingredients and the log are gone.`,
        handicraft: `It falls apart in your hands. You fail to make ${aOr(output.single)}.`,
      };
      this.say(client, (worked ? WORKED : FAILED)[recipe.skill] + (extras.length ? ` You also get ${extras.join(" and ")}!` : ""));
    }
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
      const eat = p.inventory.some((it) => isFood(it)) ? "Eat something from your bag" : "Eat a fish or a meal (the General Store sells stew)";
      this.say(client, `You're too tired: ${findSkill(skill).def.name} needs ${cost} stamina and you have ${p.stamina}. ${eat}, or rest (1 stamina every 30 seconds).`);
    }
    return false;
  }

  private useStamina(p: Player, skill: SkillId) {
    p.stamina = Math.max(0, p.stamina - STAMINA_COST[skill]);
  }

  private sendStamina(client: Client, p: Player) {
    client.send("stamina", { stamina: p.stamina, max: p.maxStamina });
  }

  /** "1 tin ore" if you're short of something for this recipe (locked items don't count), else null. */
  private missingInputs(p: Player, recipe: Recipe): string | null {
    const need = new Map<ItemId, number>();
    for (const i of recipe.inputs) need.set(i, (need.get(i) ?? 0) + 1);
    const short: string[] = [];
    for (const [item, n] of need) {
      const have = countItem(p, item, (i) => !p.locked[i]);
      if (have < n) short.push(`${n - have} ${n - have === 1 ? ITEMS[item].single : ITEMS[item].name.toLowerCase()}`);
    }
    return short.length ? short.join(" and ") : null;
  }

  /** Uses left on a tool, weapon or armor (new ones are full); null for everything else. */
  private usesFor(item: ItemId, durability?: number | null): number | null {
    return isTool(item) ? durability ?? maxDurability(item) : isGear(item) ? durability ?? gearDurability(item)
      : isBait(item) ? durability ?? BAITS[item].uses : null;
  }

  /** Put one item back in this bag slot (or wherever it fits). Tools keep the uses they have left. */
  private place(p: Player, slot: number, item: ItemId, durability?: number) {
    putBack(p, slot, item, this.usesFor(item, durability));
  }

  /**
   * Put items in the bag, on top of a stack if there's room (shared/bag.ts),
   * and only as many as you can carry (shared/weight.ts). Returns how many went in.
   * `force`: ignore weight (Old Maren's gifts, so the tutorial can never get stuck).
   */
  private give(p: Player, item: ItemId, n = 1, durability?: number | null, force = false): number {
    const want = force ? n : Math.min(n, this.canLift(p, item));
    return want > 0 ? addItem(p, item, want, this.usesFor(item, durability)) : 0;
  }

  /** Total weight carried (bag, tool belt and worn gear), in tenths of a kg. */
  private carried(p: Player) {
    return carriedWeight(p, p.belt, p.gear);
  }

  /** How many more of this item you could carry, by weight. */
  private canLift(p: Player, item: ItemId): number {
    const w = weightOf(item);
    const spare = this.capacity(p) - this.carried(p);
    return w <= 0 ? Infinity : Math.max(0, Math.floor(spare / w));
  }

  /** Room in the bag (a slot or stack) and strength to carry one more? */
  private fits(p: Player, item: ItemId) {
    return roomFor(p, item) >= 1 && this.canLift(p, item) >= 1;
  }

  /** Why you can't take one more of this: bag full, or too heavy. */
  private fullReason(p: Player, item: ItemId) {
    if (roomFor(p, item) < 1) return "Your bag is full. Sell or drop something first, or put things in your enchanted chest.";
    return `That's too heavy: you're carrying ${kg(this.carried(p))} of ${kg(this.capacity(p))}. Sell, drop or eat something, or put things in your enchanted chest.`;
  }

  /** One catch uses up a little of the bait. When it runs out, it's gone. */
  private useBait(p: Player, client: Client | undefined, slot: number) {
    const left = (p.durability[slot] ?? 1) - 1;
    if (left > 0) { p.durability[slot] = left; return; }
    const name = ITEMS[p.inventory[slot]!].single;
    clearEntry(p, slot);
    if (client) this.say(client, `You've used up your ${name}.`);
  }

  // ---- Mastery skill trees (shared/skilltree.ts) ----

  /** What a skill's tree gives this player for one effect (0.1 = 10%). */
  private tree(p: Player, skill: SkillId, effect: TreeEffect) {
    return treeBonus(p.tree, skill, effect);
  }

  /** Mastery points earned (1 per Mastery level, everywhere) minus those spent. */
  private freePoints(p: Player) {
    return earnedPoints(p.mastery, p.combatMastery) - spentPoints(p.tree);
  }

  /** How many ingredients fit in your pot: 3, plus the Cooking tree's "Bigger pot". */
  private potSize(p: Player) {
    return BASE_INGREDIENTS + this.tree(p, "cooking", "slots");
  }

  /** Max health: from your Strength level, plus the Defense tree's "Toughness". */
  private maxHpOf(p: Player) {
    return maxHealth(p.levels.strength) + this.tree(p, "defense", "health");
  }

  /** Max mana: from your Wisdom level. */
  private maxManaOf(p: Player) {
    return maxMana(p.levels.wisdom);
  }

  /** What you can carry: from your Dexterity level. */
  private capacity(p: Player) {
    return carryCapacity(p.levels.dexterity);
  }

  /** "Old Maren hasn't taught you Mining yet." */
  private notTaught(skill: SkillId) {
    const name = findSkill(skill).def.name;
    const c = teacherOf(skill);
    if (!c) return `You haven't learned ${name} yet.`;
    return c.id === "maren" ? `${GUIDE_NAME} hasn't taught you ${name} yet. Keep following her lessons in the 📜 Quests tab.`
      : `You haven't learned ${name} yet. ${c.name} teaches it (${c.where}).`;
  }

  /**
   * Work out everything that comes from your skills and quests: which skills
   * you've been taught, each Discipline's level, and the stats they give
   * (health, stamina, mana, carry weight, walking speed). Call after any skill
   * level-up or quest step. Says what went up, and sends the client the new numbers.
   */
  private refreshStats(p: Player, client: Client | undefined) {
    const taught = new Set(p.unlocked);
    const before = { ...p.levels };
    p.unlocked = unlockedSkills(p.quest);
    p.levels = disciplineLevels(p.skillXp, p.unlocked);
    const oldHp = p.maxHp, oldStamina = p.maxStamina;
    p.maxHp = this.maxHpOf(p);
    if (p.maxHp > oldHp) p.hp += p.maxHp - oldHp; // the new health comes filled
    p.hp = Math.min(p.hp, p.maxHp);
    p.maxStamina = maxStamina(p.levels.endurance);
    if (p.maxStamina > oldStamina) p.stamina += p.maxStamina - oldStamina;
    p.stamina = Math.min(p.stamina, p.maxStamina);
    p.mana = Math.min(p.mana, this.maxManaOf(p));
    p.stepMs = Math.round(TICK_MS / (1 + walkBonus(p.levels.dexterity)));
    if (!client) return;
    for (const id of p.unlocked) {
      if (!taught.has(id) && p.levels) {
        const { def } = findSkill(id);
        this.say(client, `📖 You've learned ${def.name}! ${def.description}`);
      }
    }
    for (const d of DISCIPLINE_IDS) {
      if (p.levels[d] > before[d]) {
        this.say(client, `Congratulations, your ${DISCIPLINES[d].name} is now level ${p.levels[d]}! ${this.statNote(p, d)}`);
        client.send("levelup", { discipline: d, level: p.levels[d] });
      }
    }
    this.sendDisciplines(client, p);
    this.sendVitals(client, p);
    this.sendStamina(client, p);
  }

  /** What a Discipline level-up did for you: "Max health 60." */
  private statNote(p: Player, d: DisciplineId) {
    switch (d) {
      case "strength": return `Max health ${p.maxHp}.`;
      case "endurance": return `Max stamina ${p.maxStamina}.`;
      case "wisdom": return `Max mana ${this.maxManaOf(p)}.`;
      case "dexterity": return `You can carry ${kg(this.capacity(p))}, and walk ${Math.round(walkBonus(p.levels.dexterity) * 100)}% faster.`;
      case "charisma": return "Shops pay you a little more and charge you a little less.";
    }
  }

  /** Your chance at one crafting try: Mastery, belt tool, and the skill tree's "Steady hands". */
  private craftChance(p: Player, recipe: Recipe) {
    return successFor(recipe, p.mastery, p.belt, this.tree(p, recipe.skill, "success"));
  }

  /** After buying or resetting: max health may change, and the client redraws the trees. */
  private treeChanged(client: Client, p: Player) {
    const max = this.maxHpOf(p);
    if (max !== p.maxHp) {
      p.hp = Math.max(1, Math.min(max, p.hp + Math.max(0, max - p.maxHp)));
      p.maxHp = max;
      this.sendVitals(client, p);
    }
    client.send("tree", p.tree);
    this.saveSoon(p);
  }

  /** Each use wears the belt tool down. Warn at 10%; at 0 it breaks: it goes back in your bag, Broken, until it's repaired. */
  private wearTool(p: Player, client: Client | undefined, type: ToolType, amount: number) {
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
    if (this.talkQuest(client, p, npc)) return;
    if (npc.id === "maren") return;
    if (npc.id === "board") return this.openBoard(client, p);
    if (npc.id === "repairer") {
      this.say(client, `${npc.name}: ${npc.greeting}`);
      return this.sendRepairs(client, p, true);
    }
    if (npc.id === "archmage" || npc.id === "guildboard") return this.openGuild(client, p, npc);
    if (isChest(npc.id)) return this.openChest(client, p);
    this.say(client, `${npc.name}: ${npc.greeting}`);
    if (npc.kind === "station") return client.send("station", { npc: npc.id });
    if (isShop(npc.id)) client.send("shop", { npc: npc.id });
  }


  // ---- Bounty board (rules in shared/bounties.ts) ----

  /** Click the board: shut until Maren tells you about it, then show your 5 bounties. */
  private openBoard(client: Client, p: Player) {
    if (!boardOpen(p.quest)) {
      return this.say(client, `📋 The bounty board isn't open to you yet. Finish ${GUIDE_NAME}'s lessons first.`);
    }
    this.fillBoard(p);
    this.sendBounties(client, p, true);
  }

  /** Pin up a full board of bounties if it's open to you and not full. */
  private fillBoard(p: Player) {
    if (!boardOpen(p.quest) || p.bounties.length >= BOUNTY_COUNT) return;
    p.bounties = newBoard(p);
    if (p.tracked && !p.bounties.some((x) => x.item === p.tracked)) p.tracked = null;
    p.dirty = true;
  }

  /** What the quest tracker shows: a bounty's item, or null for Maren's quest. */
  private sendTracked(client: Client, p: Player) {
    client.send("tracked", { item: p.tracked });
  }

  /** Can this player use the board right now? Says why not. */
  private boardReady(client: Client, p: Player): boolean {
    if (!boardOpen(p.quest)) {
      this.say(client, `📋 The bounty board isn't open to you yet. Finish ${GUIDE_NAME}'s lessons first.`);
      return false;
    }
    if (!this.nearNpc(p, "board")) {
      this.say(client, "You need to be next to the bounty board.");
      return false;
    }
    return true;
  }

  /** The board's bounties (the client works out rewards and what you have with the same shared code). */
  private sendBounties(client: Client, p: Player, open = false) {
    client.send("bounties", { bounties: p.bounties, open });
    this.sendTracked(client, p);
  }

  // ---- The Mages' Guild (rules in shared/guild.ts) ----

  private guildPlayer(p: Player) {
    // Reagents: the ones the normal bounty board could ask you for (things you can gather, or have seen drop).
    const reachable = new Set(bountyChoices(p).flat());
    return { magicLevel: levelForXp(p.skillXp.magic), reagents: REAGENTS.filter((r) => reachable.has(r)) };
  }

  private guildView(p: Player): GuildView {
    return { points: p.guildPoints, rank: rankFor(p.guildPoints), chestSize: p.chest.slotCount, bounties: p.guildBounties };
  }

  /** Not until Old Maren's lessons are done. Says why not. */
  private guildOpen(client: Client, p: Player): boolean {
    if (chapterDone(p.quest, "ysolde")) return true;
    this.say(client, "🔮 The Mages' Guild only takes members who have finished Archmage Ysolde's lesson.");
    return false;
  }

  /** Click the Archmage or the guild board: the guild window (rank, chest, magic bounties). */
  private openGuild(client: Client, p: Player, npc: NpcDef) {
    if (!this.guildOpen(client, p)) return;
    if (p.guildBounties.length < GUILD_BOUNTY_COUNT) {
      p.guildBounties = newGuildBoard(this.guildPlayer(p));
      p.dirty = true;
    }
    if (npc.id === "archmage") this.say(client, `${npc.name}: ${npc.greeting}`);
    this.sendGuild(client, p, true);
  }

  private sendGuild(client: Client, p: Player, open = false) {
    client.send("guild", { ...this.guildView(p), open });
  }

  private nearGuild(client: Client, p: Player): boolean {
    if (!this.guildOpen(client, p)) return false;
    if (this.nearNpc(p, "archmage") || this.nearNpc(p, "guildboard")) return true;
    this.say(client, "You need to be at the Mages' Guild.");
    return false;
  }

  /** Next to any enchanted chest? */
  private nearChest(p: Player) {
    return NPCS.some((n) => isChest(n.id) && this.nearNpc(p, n.id));
  }

  /** Click an enchanted chest: your storage, if you've rented it. */
  private openChest(client: Client, p: Player) {
    if (!this.guildOpen(client, p)) return;
    if (!p.chest.slotCount) {
      return this.say(client, `🔮 The chest is sealed. Rent space in it from Archmage Ysolde at the Mages' Guild (south-west of town) for ${formatMoney(CHEST_RENT)}.`);
    }
    this.sendChest(client, p, true);
  }

  private sendChest(client: Client, p: Player, open = false) {
    client.send("chest", { ...this.bagView(p.chest), open });
  }

  /** A guild bounty is done: pay out, and put a new one up in its place. */
  private finishGuildBounty(client: Client | undefined, p: Player, index: number) {
    const b = p.guildBounties[index];
    const reward = guildReward(b);
    const rankBefore = rankFor(p.guildPoints);
    p.guildPoints += reward.points;
    p.coins += reward.coins;
    p.guildBounties[index] = newGuildBounty(this.guildPlayer(p), p.guildBounties.filter((_, i) => i !== index).concat(b));
    if (client) {
      this.say(client, `🔮 Guild bounty done: ${guildBountyName(b).toLowerCase()}! +${reward.points} guild point${reward.points === 1 ? "" : "s"}, ${formatMoney(reward.coins)}, ${reward.magicXp} Spellcasting XP and ${guildRenown(reward.points)} Renown XP.`);
      this.addSkillXp(p, client, "magic", reward.magicXp);
      this.addSkillXp(p, client, "renown", guildRenown(reward.points));
      const rank = rankFor(p.guildPoints);
      if (rank > rankBefore) {
        this.say(client, `🎉 You are now a guild ${RANKS[rank].name}! Your enchanted chest can grow to ${RANKS[rank].maxChest} spaces.`);
        client.send("guildRank", { rank: RANKS[rank].name });
      }
      client.send("coins", p.coins);
      this.sendGuild(client, p);
    }
    p.dirty = true;
  }

  /** A monster fell: count it toward "defeat with spells" guild bounties. */
  private guildKill(p: Player, client: Client | undefined, monster: MonsterId, style: CombatStyle) {
    if (style !== "magic" || !chapterDone(p.quest, "ysolde")) return;
    p.guildBounties.forEach((b, i) => {
      if (b.kind !== "slay" || b.monster !== monster) return;
      b.progress++;
      p.dirty = true;
      if (b.progress >= b.count) this.finishGuildBounty(client, p, i);
      else if (client) {
        this.say(client, `🔮 Guild bounty: ${b.progress}/${b.count} ${MONSTERS[monster].name.toLowerCase()}s defeated with spells.`);
        this.sendGuild(client, p);
      }
    });
  }

  /**
   * Move a saved bag into this player's bag. Similar things are joined first
   * (older saves gave every tool its own slot, and before that every item). If
   * it still doesn't fit (bags used to have 28 slots, now 12), the rest goes
   * into the enchanted chest if there's space, and the General Store buys whatever
   * is left, so nobody loses anything.
   */
  private fitOldBag(p: Player, old: Bag) {
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
  }

  private restoreGuild(p: Player, g: SaveData["guild"]) {
    if (!g) return;
    if (typeof g.points === "number" && Number.isFinite(g.points) && g.points >= 0) p.guildPoints = Math.floor(g.points);
    if (Array.isArray(g.bounties)) p.guildBounties = g.bounties.filter(validGuildBounty).slice(0, GUILD_BOUNTY_COUNT);
    if (Array.isArray(g.chest)) {
      // Older saves had one chest entry per space; newer ones say which space each entry is in.
      const newer = Number.isInteger(g.chestSize);
      const size = Math.min(CHEST_MAX, newer ? Math.max(0, g.chestSize!) : g.chest.length);
      const old = emptyBag(size);
      g.chest.slice(0, 1000).forEach((c, i) => {
        if (!c || typeof c.item !== "string" || !(c.item in ITEMS)) return;
        const slot = newer ? c.slot : i;
        if (!Number.isInteger(slot) || slot! < 0 || slot! >= size) return;
        const item = c.item as ItemId;
        const max = isTool(item) ? maxDurability(item) : isGear(item) ? gearDurability(item) : isBait(item) ? BAITS[item].uses : null;
        const d = typeof c.durability === "number" && (c.durability > 0 || (c.durability === 0 && !isBait(item))) ? Math.min(Math.floor(c.durability), max ?? 0) : max;
        const n = Number.isInteger(c.count) && c.count >= 1 ? Math.min(c.count, stackLimit(item)) : 1;
        if (wearsOut(item)) for (let k = 0; k < n; k++) newEntry(old, slot!, item, 1, d);
        else newEntry(old, slot!, item, n, null);
      });
      mergeStacks(old); // join similar things (older chests had every tool in its own space)
      compact(old);
      p.chest = old;
    }
  }

  private guildSave(p: Player): NonNullable<SaveData["guild"]> {
    return {
      points: p.guildPoints,
      bounties: p.guildBounties.map((b) => ({ ...b })),
      chestSize: p.chest.slotCount,
      chest: p.chest.inventory.flatMap((item, e) => (item ? [{ item, count: countIn(p.chest, e), durability: p.chest.durability[e], slot: p.chest.slotOf[e] }] : [])),
    };
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

  /** Is fighting refused right now? (the lesson wants a weapon, a sling or a staff.) Returns what to say. */
  private fightBlock(p: Player): string | null {
    const want = this.step(p)?.fightWith;
    if (!want) return null;
    const w = p.gear.weapon?.item;
    const who = this.giverName(p);
    if (want === "weapon" && !w) return `${who} wants you to fight with a weapon. Click one in your bag and press "Hold" first.`;
    if (want !== "weapon" && (!isWeapon(w) || WEAPONS[parseWeapon(w).type].style !== want)) {
      return want === "magic" ? `${who} wants you to use Spellcasting for this. Hold your staff first.` : `${who} wants you to use Ranged for this. Hold your sling first.`;
    }
    return null;
  }

  /** Why you can't wear or hold this yet (too low a level), or null. */
  private cantWear(p: Player, item: ItemId): string | null {
    if (isWeapon(item)) {
      const def = WEAPONS[parseWeapon(item).type];
      const { def: skill } = skillInfo(def.style);
      if (!isUnlocked(p.unlocked, def.style)) return this.notTaught(def.style);
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
      if (!treeRoll(p.tree, "magic", "manaSave")) p.mana -= spell.mana;
    } else {
      if (p.stamina < ATTACK_STAMINA) {
        if (client) this.say(client, "You're too tired to fight. Eat something, or rest (1 stamina every 30 seconds).");
        return this.stopActions(p);
      }
      if (!treeRoll(p.tree, a.style, "staminaSave")) p.stamina -= ATTACK_STAMINA;
    }
    p.attackTimer = 0;
    const style = a.style;
    const weaponM = combatMasteryIn(p.combatMastery, a.mastery);
    const monsterM = combatMasteryIn(p.combatMastery, m.kind);
    const chance = hitChance(levelForXp(p.skillXp[style]), m.kind, a, weaponM, monsterM, this.tree(p, style, "accuracy"));
    const hit = Math.random() < chance;
    const max = maxHitWith(a, weaponM);
    // The skill tree's damage bonus: +5% is a 5% chance of +1 on a hit of 1, and so on.
    const roll = hit && max ? (1 + Math.floor(Math.random() * max)) * (1 + this.tree(p, style, "damage")) : 0;
    const damage = Math.floor(roll) + (Math.random() < roll % 1 ? 1 : 0);
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
      if (!this.give(p, d.item)) { lost++; continue; }
      got.push(aOr(ITEMS[d.item].single));
    }
    const [lo, hi] = def.coins;
    const coins = hi ? lo + Math.floor(Math.random() * (hi - lo + 1)) : 0;
    if (coins) { p.coins += coins; got.push(formatMoney(coins)); }
    this.state.players.forEach((other) => { if (other.fighting && this.state.monsters.get(other.fighting) === m) this.stopActions(other); });
    if (client) {
      this.say(client, `You defeat the ${def.name.toLowerCase()}!` + (got.length ? ` It drops ${got.join(" and ")}.` : "") +
        (lost ? " Your bag is full or too heavy, so you leave something behind." : ""));
      this.sendInventory(client, p);
    }
    this.questEvent(p, client, { kind: "kill", monster: m.kind, style });
    this.guildKill(p, client, m.kind, style);
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
    const chance = monsterHitChance(m.kind, levelForXp(p.skillXp.defense), armorPoints(p.gear), this.tree(p, "defense", "dodge"));
    const hit = Math.random() < chance;
    const damage = hit ? 1 + Math.floor(Math.random() * def.maxHit) : 0;
    p.hp = Math.max(0, p.hp - damage);
    p.dirty = true;
    this.broadcast("hit", { on: "player", id: sessionId, damage, miss: !hit, from: monsterId });
    // Armor wears down: one piece you're wearing takes the blow.
    const worn = GEAR_SLOTS.filter((s) => s !== "weapon" && p.gear[s]);
    if (worn.length) this.wearGear(p, client, worn[Math.floor(Math.random() * worn.length)], wearFor(def.level));
    const xp = defenseXp(m.kind);
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

  /** Weapons wear with each attack, armor with each attack on you. At 0 they break (Broken, back in your bag, until repaired). */
  private wearGear(p: Player, client: Client | undefined, slot: GearSlot, amount: number) {
    const g = p.gear[slot];
    if (!g || treeRoll(p.tree, "smithing", "toolCare")) return;
    const max = gearDurability(g.item);
    const before = g.durability;
    g.durability = Math.max(0, g.durability - amount);
    if (g.durability <= 0) {
      p.gear[slot] = null;
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
  }

  // ---- The Repairer (shared/repair.ts), at the Mages' Guild ----

  /** Everything worn or broken: belt tools, gear you're wearing, and tools and gear in your bag. */
  private repairJobs(p: Player): RepairJob[] {
    const jobs: RepairJob[] = [];
    const add = (where: RepairJob["where"], key: string | number, item: ItemId, durability: number) => {
      const cost = repairCost(item, durability);
      if (cost > 0) jobs.push({ where, key, item, durability, max: maxUses(item), cost });
    };
    for (const type of TOOL_TYPE_IDS) { const t = p.belt[type]; if (t) add("belt", type, t.item, t.durability); }
    for (const slot of GEAR_SLOTS) { const g = p.gear[slot]; if (g) add("gear", slot, g.item, g.durability); }
    p.inventory.forEach((item, e) => { if (isRepairable(item)) add("bag", e, item, p.durability[e] ?? maxUses(item)); });
    return jobs;
  }

  /** Old Maren's lesson: your first repair (her broken rod) is free. */
  private freeRepair(p: Player) {
    return this.step(p)?.goal.kind === "repair";
  }

  private sendRepairs(client: Client, p: Player, open = false) {
    client.send("repair", { jobs: this.repairJobs(p), free: this.freeRepair(p), open });
  }

  /** Fix these, as many as you can pay for (cheapest first when you can't afford them all). */
  private doRepairs(client: Client, p: Player, jobs: RepairJob[]) {
    if (!this.nearNpc(p, "repairer")) return this.say(client, "You need to be next to the Repairer at the Mages' Guild.");
    if (!jobs.length) return this.say(client, "Repairer Oswin: Nothing here needs fixing!");
    const free = this.freeRepair(p);
    const order = jobs.length > 1 ? [...jobs].sort((a, b) => a.cost - b.cost) : jobs;
    let paid = 0;
    const fixed: string[] = [];
    let short = 0;
    for (const j of order) {
      const cost = free ? 0 : j.cost;
      if (p.coins < cost) { short++; continue; }
      p.coins -= cost;
      paid += cost;
      if (j.where === "belt") p.belt[j.key as ToolType]!.durability = j.max;
      else if (j.where === "gear") p.gear[j.key as GearSlot]!.durability = j.max;
      else p.durability[j.key as number] = j.max;
      fixed.push(ITEMS[j.item].single);
    }
    if (fixed.length) {
      const list = fixed.length > 3 ? `${fixed.length} things` : fixed.length > 1 ? `${fixed.slice(0, -1).join(", ")} and ${fixed[fixed.length - 1]}` : `your ${fixed[0]}`;
      this.say(client, free ? `Repairer Oswin fixes ${list} for free. "Maren's an old friend. The next one costs, mind!"`
        : `Repairer Oswin fixes ${list} for ${formatMoney(paid)}. Good as new!`);
      p.dirty = true;
      this.questEvent(p, client, { kind: "repair" });
    }
    if (short) this.say(client, `You don't have enough coins to fix ${fixed.length ? `the other ${short}` : short === 1 ? "that" : "those"}.`);
    this.sendInventory(client, p);
    this.sendRepairs(client, p);
    this.saveSoon(p);
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
    client.send("vitals", { hp: p.hp, maxHp: p.maxHp, mana: p.mana, maxMana: this.maxManaOf(p) });
  }

  private sendGear(client: Client, p: Player) {
    client.send("gear", { gear: p.gear, spell: p.spell });
  }

  // ---- Old Maren's tutorial (steps in shared/quests.ts) ----

  /** The tutorial step this player is on, or null once it's finished. */
  private step(p: Player): QuestStep | null {
    return currentStep(p.quest);
  }

  /** The active chapter's progress (which step, how far along), or null between chapters. */
  private prog(p: Player): ChapterProgress | null {
    return p.quest.active ? p.quest.ch[p.quest.active] ?? null : null;
  }

  /** Who gives the active chapter ("Forester Holt"), for messages. */
  private giverName(p: Player): string {
    return p.quest.active ? chapterById(p.quest.active).name : GUIDE_NAME;
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
      if (isMeal(ev.item)) counts = 1;
    } else if (g.kind === "sell" && ev.kind === "sell") {
      const r = RESOURCE_FOR_ITEM[ev.item];
      if (!g.what || (r && RESOURCES[r].skill === g.what)) counts = 1;
    } else if (g.kind === "buy" && ev.kind === "buy") {
      counts = 1;
    } else if (g.kind === "repair" && ev.kind === "repair") {
      counts = 1;
    } else if (g.kind === "kill" && ev.kind === "kill") {
      if ((!g.monster || ev.monster === g.monster) && (!g.style || ev.style === g.style)) counts = 1;
    } else if (g.kind === "drink" && ev.kind === "drink") {
      counts = 1;
    } else if (g.kind === "track" && ev.kind === "track") {
      counts = 1;
    } else if (g.kind === "bounty" && ev.kind === "bounty") {
      counts = 1;
    }
    if (!counts) return;
    const prog = this.prog(p)!;
    prog.count += counts;
    p.dirty = true;
    if (prog.count >= ("count" in g ? g.count : 1)) this.advance(p, client);
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
    if (g.kind === "level") return p.levels[g.discipline] >= g.level;
    if (g.kind === "skillLevel") return levelForXp(p.skillXp[g.skill]) >= g.level;
    if (g.kind === "equip") return g.tools.every((prefix) => TOOL_TYPE_IDS.some((t) => p.belt[t]?.item.startsWith(prefix)));
    if (g.kind === "have") return Object.entries(g.items).every(([item, n]) => this.countOf(p, item as ItemId) >= n!);
    if (g.kind === "gear") return g.items.every((prefix) => GEAR_SLOTS.some((slot) => p.gear[slot]?.item.startsWith(prefix)));
    if (g.kind === "track") return !!p.tracked;
    if (g.kind === "spendPoint") return Object.values(p.tree).some((rank) => (rank ?? 0) > 0);
    return false;
  }

  private countOf(p: Player, item: ItemId) {
    return countItem(p, item);
  }

  /** On to the next step (and past any that are already done, like a level you already have). */
  private advance(p: Player, client: Client | undefined) {
    const prog = this.prog(p);
    if (!prog) return;
    const chapter = chapterById(p.quest.active!);
    prog.step++;
    prog.count = 0;
    p.dirty = true;
    let step = this.step(p);
    while (step && this.goalMet(p, step)) {
      prog.step++;
      step = this.step(p);
    }
    if (!step) {
      // Chapter finished: back to picking the next trainer.
      p.quest.active = null;
      if (client) {
        this.say(client, `🎉 Quest complete: ${chapter.title}!`);
        client.send("questDone", { quest: chapter.title });
      }
    }
    this.saveSoon(p);
    this.refreshStats(p, client); // a lesson may have taught you a skill
    if (!client) return;
    if (step) this.say(client, `📜 Next: ${step.task}.`);
    else if (!tutorialDone(p.quest)) this.say(client, "📜 Next: talk to anyone with a ❗ for your next lesson (the 📜 Quests tab lists them all).");
    this.sendQuest(client, p);
  }

  /** The tutorial makes some crafting turn out a set way: every stew burns until Maren explains it, and some tries always work. */
  private forcedCraft(p: Player, recipe: Recipe): "fail" | "success" | null {
    if (recipe.skill === "cooking" && stewsBurn(p.quest)) return "fail";
    const step = this.step(p);
    if (!step) return null;
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
      return `${this.giverName(p)} wants you to use your ${name} for this. Click it in your bag and press "Put on belt" first.`;
    }
    const g = step.goal;
    if (g.kind === "gather" && g.byHand && g.skill === skill && p.belt[tool]) {
      return `${this.giverName(p)} asked you to do this by hand. Take the ${name} off your belt first (click it on the belt).`;
    }
    return null;
  }

  /** Why you can't sell, drop or eat something Maren's current task needs. */
  private keepIt(p: Player, item: ItemId, what: "sell" | "drop" | "eat" | "store"): string {
    const name = ITEMS[item].single;
    const who = this.giverName(p);
    if (what === "sell") return `Hold on to that ${name}: ${who} needs you to use it. Come back once you've done what they asked.`;
    if (what === "eat") return `Not yet! ${who} wants to see that ${name} first. Go and show them.`;
    return `Better keep that ${name}. ${who} needs you to use it.`;
  }

  /**
   * Click someone who gives a chapter of the main quest: start their chapter,
   * do its next talk step, or remind you what to do. Returns true if that's
   * all the click does; false lets their usual window open too (a trainer's
   * shop, the guild), e.g. when the step is "buy something from me".
   */
  private talkQuest(client: Client, p: Player, npc: NpcDef): boolean {
    const chapter = chapterOf(npc.id);
    const q = p.quest;
    if (npc.id === "maren") this.marenHelps(client, p);
    if (!chapter || chapterDone(q, chapter.id)) {
      if (npc.id !== "maren") return false;
      this.dialog(client, tutorialDone(q) ? ["You've learned all anyone in town can teach you. Go and make your fortune!",
        "If you're after work, Captain Bryn's bounty board is right here. Folk pay double for the things they need."]
        : ["You've learned all I can teach you. Go and see the trainers: anyone with a ❗ over their head has a lesson for you.",
          "Your 📜 Quests tab says where each one is."]);
      return true;
    }
    if (!chapterOpen(q, chapter.id)) {
      this.say(client, `${chapter.name}: Come and see me for a lesson once ${GUIDE_NAME} has shown you the basics. She's in the town square, by the stove.`);
      return false;
    }
    if (q.active !== chapter.id) {
      const was = q.active && !chapterDone(q, q.active) ? chapterById(q.active) : null;
      if (!q.ch[chapter.id]) q.ch[chapter.id] = { step: 0, count: 0 };
      q.active = chapter.id;
      p.dirty = true;
      if (was) this.say(client, `📜 You switch to ${chapter.name}'s lesson. ${was.name}'s will wait for you: talk to them to pick it up again.`);
      this.sendQuest(client, p);
    }
    const step = this.step(p);
    if (!step) return false;
    if (step.goal.kind !== "talk") {
      const given = this.giveMissing(p, step.ensure);
      if (given) this.sendInventory(client, p);
      const t = step.needsTool && !p.belt[step.needsTool] ? ` And put your ${TOOL_TYPES[step.needsTool].name.toLowerCase()} back on your belt!`
        : this.fightBlock(p) ? ` And ${step.fightWith === "magic" ? "hold your staff" : step.fightWith === "ranged" ? "hold your sling" : "hold a weapon"}!` : "";
      const text = `${step.hint ?? step.task}` + (given ? ` Here, take ${given}.` : "") + t;
      // Trainers with a shop open it too (the step may be to buy or sell something there).
      if (isShop(npc.id)) { this.say(client, `${chapter.name}: ${text}`); return false; }
      this.dialog(client, [text], chapter.name);
      return true;
    }
    if (step.need && !p.inventory.some((it) => it?.startsWith(step.need!.prefix))) {
      this.dialog(client, [step.need.line], chapter.name);
      return true;
    }
    const gifts = giftItems(step.give);
    if (!roomForAll(p, gifts.map((g) => g.item))) {
      this.dialog(client, [`I've got ${gifts.length} things for you, but your bag is too full. Make some room and come back.`], chapter.name);
      return true;
    }
    for (const g of gifts) this.give(p, g.item, 1, g.durability, true); // gifts never count against weight, so the lessons can't get stuck
    if (step.coins) p.coins += step.coins;
    this.dialog(client, step.lines ?? [], chapter.name);
    if (gifts.length || step.coins) {
      const names = [...new Set(gifts.map((g) => g.item))].map((item) => {
        const n = gifts.filter((g) => g.item === item).length;
        if (n === 1) return aOr(ITEMS[item].single);
        return `${n} ${plural(ITEMS[item].name)}`;
      });
      if (step.coins) names.push(formatMoney(step.coins));
      this.say(client, `${chapter.name} gives you ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]}.`);
    }
    if (step.opensGate) this.say(client, "🚪 The gate to the Dark Forest is open to you now. It's just south of Kael's lodge, past the ⚠ sign.");
    if (step.opensBoard) this.say(client, "📋 The bounty board is open to you now. Its jobs are in the 📜 Quests tab too.");
    this.advance(p, client);
    if (step.opensBoard) { this.fillBoard(p); this.sendBounties(client, p); }
    // Hand over anything the next step needs that you don't have (e.g. a minnow to cook).
    const extra = this.giveMissing(p, this.step(p)?.ensure);
    if (extra) this.say(client, `${chapter.name} also gives you ${extra}.`);
    this.sendInventory(client, p);
    this.saveSoon(p);
    return true;
  }

  /** Old Maren won't let you get stuck: a stew if you're worn out with no food, a potion if you're badly hurt during Kael's lessons. */
  private marenHelps(client: Client, p: Player) {
    if (p.stamina < 20 && !p.inventory.some((it) => isFood(it)) && roomFor(p, SHOP_STEW) > 0) {
      this.give(p, SHOP_STEW, 1, null, true);
      this.say(client, `${GUIDE_NAME}: You look worn out! Here, eat this stew. Next time, cook some of your own.`);
      this.sendInventory(client, p);
    }
    if (p.quest.active === "kael" && p.hp < p.maxHp / 3 && !p.inventory.includes(POTION_ID) && roomFor(p, POTION_ID) > 0) {
      this.give(p, POTION_ID, 1, null, true);
      this.say(client, `${GUIDE_NAME}: You're hurt! Here, drink this health potion.`);
      this.sendInventory(client, p);
    }
  }

  /** Give whatever of these you don't have. Returns what was given ("a pine log and a minnow"), or "". */
  private giveMissing(p: Player, gifts?: Gift[]): string {
    const given: string[] = [];
    for (const g of gifts ?? []) {
      // A tool counts if you have any of that kind (in your bag or on your belt); a meal counts if you have any meal.
      let have: number;
      if (isTool(g.item)) {
        const type = parseTool(g.item).type;
        have = (p.belt[type] ? 1 : 0) + p.inventory.filter((it) => isTool(it) && parseTool(it).type === type).length;
      } else if (isGear(g.item)) {
        const kind = g.item.split("_")[0];
        have = (GEAR_SLOTS.some((s) => p.gear[s]?.item.startsWith(`${kind}_`)) ? 1 : 0) + p.inventory.filter((it) => it?.startsWith(`${kind}_`)).length;
      } else if (isMeal(g.item)) {
        have = p.inventory.reduce((n, it, i) => n + (isMeal(it) ? countIn(p, i) : 0), 0);
      } else {
        have = this.countOf(p, g.item);
      }
      for (let n = have; n < (g.count ?? 1); n++) {
        if (!this.give(p, g.item, 1, g.durability, true)) break;
        given.push(aOr(ITEMS[g.item].single));
      }
    }
    if (given.length) p.dirty = true;
    return given.length > 1 ? `${given.slice(0, -1).join(", ")} and ${given[given.length - 1]}` : given[0] ?? "";
  }

  private dialog(client: Client, lines: string[], name = GUIDE_NAME) {
    client.send("dialog", { name, lines });
  }

  /** What the quest tracker shows. */
  private questView(p: Player): QuestView {
    const step = this.step(p);
    const chapters = chapterViews(p.quest);
    const finished = chapters.filter((c) => c.state === "done").length;
    const base = { number: finished, of: chapters.length, marks: questMarks(p.quest), chapters };
    if (!step) {
      return tutorialDone(p.quest)
        ? { ...base, done: true, quest: "All lessons done", giver: "", task: "Tap 📜 Quests to track a bounty from the board.", talk: false }
        : { ...base, done: false, quest: "Pick your next lesson", giver: "", task: "Talk to anyone with a ❗ (the 📜 Quests tab says where they are)", talk: true };
    }
    const chapter = chapterById(p.quest.active!);
    const prog = this.prog(p)!;
    const g = step.goal;
    let progress: string | undefined;
    let fraction: number | undefined;
    if (g.kind === "level") {
      const have = p.levels[g.discipline];
      const skills = DISCIPLINES[g.discipline].skills.filter((sk) => p.unlocked.includes(sk.id))
        .map((sk) => `${sk.name} ${levelForXp(p.skillXp[sk.id])}`).join(", ");
      progress = `${DISCIPLINES[g.discipline].name} ${Math.min(have, g.level)} / ${g.level} (${skills})`;
      fraction = Math.min(1, have / g.level);
    } else if (g.kind === "skillLevel") {
      const xp = p.skillXp[g.skill];
      const need = xpForLevel(g.level);
      progress = `${findSkill(g.skill).def.name} XP ${Math.min(xp, need)} / ${need}`;
      fraction = Math.min(1, xp / need);
    } else if (g.kind === "have") {
      const want = Object.entries(g.items) as [ItemId, number][];
      progress = want.map(([item, n]) => `${Math.min(n, this.countOf(p, item))}/${n} ${ITEMS[item].name.toLowerCase()}`).join(", ");
      fraction = want.reduce((sum, [item, n]) => sum + Math.min(n, this.countOf(p, item)), 0) / want.reduce((sum, [, n]) => sum + n, 0);
    } else if (g.kind === "toolBreaks") {
      const t = p.belt[g.tool];
      progress = t ? `${t.durability} use${t.durability === 1 ? "" : "s"} left` : `Not on your belt yet`;
    } else if (g.kind === "spendPoint") {
      const free = this.freePoints(p);
      progress = free ? `You have ${free} Mastery point${free === 1 ? "" : "s"} to spend` : "No points yet: catch more minnows";
    } else if ("count" in g && g.count > 1) {
      progress = `${prog.count} / ${g.count}`;
      fraction = prog.count / g.count;
    }
    const warning = step.needsTool && !p.belt[step.needsTool] ? `Put your ${TOOL_TYPES[step.needsTool].name.toLowerCase()} back on your belt first!`
      : this.fightBlock(p) ? (step.fightWith === "magic" ? "Hold your staff first!" : step.fightWith === "ranged" ? "Hold your sling first!" : "Hold a weapon first!") : undefined;
    return { ...base, done: false, quest: chapter.title, giver: chapter.name, task: step.task, progress, fraction, talk: g.kind === "talk", warning };
  }

  private sendQuest(client: Client, p: Player) {
    client.send("quest", this.questView(p));
  }

  /** The shop you're standing next to (a trainer or the General Store), if any. */
  private nearShop(p: Player): ShopId | null {
    return SHOP_IDS.find((id) => this.nearNpc(p, id)) ?? null;
  }

  /** Standing on one of the 8 tiles around someone or something (a shopkeeper, the furnace, the anvil...). */
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

  /** Skill level (up to 99): unlocks better types. */
  private addSkillXp(p: Player, client: Client | undefined, skill: SkillId, xp: number) {
    if (!isUnlocked(p.unlocked, skill)) return; // no XP in a skill nobody has taught you yet
    const before = levelForXp(p.skillXp[skill]);
    // The skill tree's "Quick learner": more skill XP (rounded at random, so small amounts still count).
    const boosted = xp * (1 + this.tree(p, skill, "xp"));
    p.skillXp[skill] += Math.floor(boosted) + (Math.random() < boosted % 1 ? 1 : 0);
    const after = levelForXp(p.skillXp[skill]);
    if (!client) {
      if (after > before) this.refreshStats(p, undefined);
      return;
    }
    this.sendMastery(client, p);
    this.sendDisciplines(client, p); // the floating "+5 Fishing XP" comes from this
    if (after > before) {
      const { def } = findSkill(skill);
      this.say(client, `Your ${def.name} level is now ${after}!`);
      if (skill === "cooking") {
        for (const dish of DISH_IDS) {
          const lv = DISHES[dish].level;
          if (lv > before && lv <= after) this.say(client, `You can now cook ${DISHES[dish].icon} ${DISHES[dish].name.toLowerCase()}! ${DISHES[dish].note}.`);
        }
        for (const fish of resourcesFor("fishing")) {
          const lv = RESOURCES[fish].level;
          if (lv > 1 && lv > before && lv <= after) this.say(client, `You can now cook ${ITEMS[RESOURCES[fish].item].name.toLowerCase()}!`);
        }
      } else if (skill === "handicraft") {
        for (const b of Object.values(BAITS)) if (b.level > before && b.level <= after) this.say(client, `You can now make ${b.name.toLowerCase()} at the workbench!`);
      } else if (skill === "defense") {
        for (const m of Object.values(METALS)) if (m.level > before && m.level <= after) this.say(client, `You can now wear ${m.name.toLowerCase()} armor!`);
        this.sendVitals(client, p);
      } else if (skill === "melee" || skill === "ranged" || skill === "magic") {
        for (const w of Object.values(WEAPONS)) if (w.style === skill && w.level > before && w.level <= after) this.say(client, `You can now use ${aOr(w.name.toLowerCase())}!`);
        if (skill === "magic") {
          for (const sp of Object.values(SPELLS)) if (sp.level > before && sp.level <= after) this.say(client, `You can now cast ${sp.icon} ${sp.name}! Pick it under your gear.`);
        }
      } else if (skill === "trading" || skill === "renown") {
        // Nothing new to unlock yet; the Charisma level-up message says what it does.
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
      this.refreshStats(p, client); // Discipline levels, health, stamina, mana, speed...
      this.checkQuest(p, client); // "Reach Fishing level 3" steps
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
    if (this.step(p)?.goal.kind === "spendPoint") this.sendQuest(client, p); // "you have a point to spend"
  }

  /** Discipline levels and the skills you've been taught. (The client works out the stats from these too.) */
  private sendDisciplines(client: Client, p: Player) {
    client.send("disciplines", { levels: p.levels, unlocked: p.unlocked });
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
    client.send("belt", p.belt);
    this.sendGear(client, p);
    this.sendBag(client, p);
    client.send("coins", p.coins);
    this.checkQuest(p, client); // "Have 2 copper ore" steps
  }

  /** The bag as the client sees it (shared/bag.ts), sent in one go so the lists always line up. */
  private bagView(bag: Bag) {
    return { inventory: bag.inventory, counts: bag.counts, locked: bag.locked, durability: bag.durability, slotOf: bag.slotOf, slotCount: bag.slotCount };
  }

  private sendBag(client: Client, p: Player) {
    client.send("bag", this.bagView(p));
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
    p.color = isPlayerColor(account.save.color) ? account.save.color : PLAYER_COLORS[this.state.players.size % PLAYER_COLORS.length].color;
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
      const spawn = { x: 27 + Math.floor(Math.random() * 4), y: 11 };
      if (isWalkable(spawn.x, spawn.y)) { p.x = spawn.x; p.y = spawn.y; return; }
    }
    if (save.quest) p.quest = migrateQuest(save.quest, save.questRev);
    if (Number.isInteger(save.x) && Number.isInteger(save.y) && isWalkable(save.x!, save.y!)) {
      p.x = save.x!;
      p.y = save.y!;
    } else {
      const spawn = randomSpawn();
      p.x = spawn.x;
      p.y = spawn.y;
    }
    // Load the saved bag as it was (older saves had 28 slots, one entry each), then fit it into today's bag below.
    const grouped = Array.isArray(save.slots);
    const entries = Array.isArray(save.inventory) ? Math.min(save.inventory.length, grouped ? 1000 : 28) : 0;
    const old = emptyBag(grouped ? INVENTORY_SIZE : entries);
    if (Array.isArray(save.inventory)) {
      for (let i = 0; i < entries; i++) {
        clearEntry(old, i); // start empty, so the lists have no gaps
        const slot = grouped ? save.slots![i] : i;
        if (!Number.isInteger(slot) || slot < 0 || slot >= old.slotCount) continue;
        old.slotOf[i] = slot;
        let item = save.inventory[i];
        if (typeof item === "string" && item in LEGACY_ITEMS) item = LEGACY_ITEMS[item]; // logs -> pine logs, etc.
        if (typeof item === "string") item = legacyTool(item) ?? item; // metal-headed rods -> wooden rods
        if (typeof item === "string") item = legacyStew(item) ?? item; // old fish stews -> stews
        old.inventory[i] = typeof item === "string" && item in ITEMS ? (item as ItemId) : null;
        const it = old.inventory[i];
        if (!it) { old.slotOf[i] = -1; continue; }
        // How many in the stack (saves from before stacks had one per slot).
        const n = save.counts?.[i];
        old.counts[i] = wearsOut(it) ? 1 : Number.isInteger(n) && n! >= 1 ? Math.min(n!, stackLimit(it)) : 1;
        if (isTool(it) || isGear(it) || isBait(it)) {
          const max = isTool(it) ? maxDurability(it) : isGear(it) ? gearDurability(it) : BAITS[it].uses;
          const d = save.durability?.[i];
          // Broken tools and gear (0 uses left) stay broken; bait at 0 would have been used up.
          old.durability[i] = typeof d === "number" && (d > 0 || (d === 0 && !isBait(it))) ? Math.min(Math.floor(d), max) : max;
        }
      }
    }
    for (const type of TOOL_TYPE_IDS) {
      const t = save.belt?.[type];
      if (t && typeof t.item === "string") t.item = legacyTool(t.item) ?? t.item;
      if (t && isTool(t.item) && parseTool(t.item).type === type && typeof t.durability === "number" && t.durability > 0) {
        p.belt[type] = { item: t.item, durability: Math.min(Math.floor(t.durability), maxDurability(t.item)) };
      }
    }
    if (typeof save.coins === "number" && Number.isFinite(save.coins) && save.coins >= 0) p.coins = Math.floor(save.coins);
    // Stamina also came back while you were logged out (1 every 30 seconds). Old saves start full.
    if (typeof save.stamina === "number" && Number.isFinite(save.stamina)) {
      const away = typeof save.staminaAt === "number" ? Math.max(0, Date.now() - save.staminaAt) : 0;
      p.stamina = Math.max(0, Math.floor(save.stamina) + Math.floor(away / STAMINA_REGEN_MS)); // capped below, once Endurance is known
    }
    if (Array.isArray(save.lockedSlots)) {
      for (const i of save.lockedSlots) if (Number.isInteger(i) && i >= 0 && i < old.inventory.length && old.inventory[i]) old.locked[i] = true;
    } else if (Array.isArray(save.locked)) {
      // Briefly, locks were per item type: lock every item of those types that's in the bag.
      old.inventory.forEach((item, i) => { if (item && save.locked!.includes(item)) old.locked[i] = true; });
    }
    this.restoreGuild(p, save.guild);
    this.fitOldBag(p, old);
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
      // Before dishes there was one "Fish stew" Mastery: it's now your Stew Mastery.
      if (ok(save.mastery?.fish_stew)) p.mastery.stew = (p.mastery.stew ?? 0) + Math.floor(save.mastery!.fish_stew);
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
    p.tree = cleanRanks(save.tree);
    // Skills taught, Discipline levels, and the stats they give.
    p.unlocked = unlockedSkills(p.quest);
    p.levels = disciplineLevels(p.skillXp, p.unlocked);
    p.maxStamina = maxStamina(p.levels.endurance);
    p.stamina = Math.min(p.stamina, p.maxStamina);
    p.stepMs = Math.round(TICK_MS / (1 + walkBonus(p.levels.dexterity)));
    p.maxHp = this.maxHpOf(p);
    p.hp = p.maxHp;
    if (typeof save.hp === "number" && Number.isFinite(save.hp)) {
      const away = typeof save.hpAt === "number" ? Math.max(0, Date.now() - save.hpAt) : 0;
      p.hp = Math.max(1, Math.min(p.maxHp, Math.floor(save.hp) + Math.floor(away / HEALTH_REGEN_MS)));
    }
    p.mana = this.maxManaOf(p);
    if (Array.isArray(save.bounties)) p.bounties = save.bounties.filter(validBounty).slice(0, BOUNTY_COUNT);
    if (typeof save.tracked === "string" && p.bounties.some((b) => b.item === save.tracked)) p.tracked = save.tracked as ItemId;
  }

  private snapshot(p: Player): SaveData {
    // Save where the player is heading, so walking off mid-path doesn't lose the move.
    const dest = p.path.length ? p.path[p.path.length - 1] : p;
    const bag = cloneBag(p);
    compact(bag); // leave out unused entries
    return { saveVersion: SAVE_VERSION, questRev: QUEST_REV, quest: structuredClone(p.quest), x: dest.x, y: dest.y, inventory: bag.inventory, slots: bag.slotOf, coins: p.coins, skillXp: { ...p.skillXp }, mastery: { ...p.mastery }, durability: bag.durability, belt: { ...p.belt }, stamina: p.stamina, staminaAt: Date.now(), hp: p.hp, hpAt: Date.now(), gear: { ...p.gear }, spell: p.spell, combatMastery: { ...p.combatMastery }, tree: { ...p.tree }, lockedSlots: bag.locked.flatMap((on, i) => (on ? [i] : [])), bounties: p.bounties.map((b) => ({ ...b })), tracked: p.tracked ?? undefined, color: p.color, counts: bag.counts, guild: this.guildSave(p) };
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
