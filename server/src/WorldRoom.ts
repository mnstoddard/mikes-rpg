import { Room, Client, ServerError } from "colyseus";
import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { Door, MAP, MAP_HEIGHT, MAP_WIDTH, TICK_MS, TOWN_SPOT, WAKE_SPOT, areaAt, doorAt, isDanger, isWalkable, randomSpawn, spotNear } from "../../shared/map";
import { findPath, Point } from "../../shared/pathfinding";
import {
  RESOURCES, RESOURCE_FOR_ITEM, ROCK_EMPTY_CHANCE, ResourceId, TREE_FALL_CHANCE,
  FORAGE_FINDS, PATCH_EMPTY_CHANCE, isDigPatch, rollForageFind,
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
  parseWeapon, METAL_DAMAGE,
} from "../../shared/gear";
import {
  Belt, METALS, TOOL_TYPES, TOOL_TYPE_IDS, TOOL_WARN_AT, ToolType, emptyBelt, isTool, legacyTool, maxDurability, parseTool,
  toolBonus, toolForSkill, wearFor,
} from "../../shared/tools";
import { INVENTORY_SIZE, ITEMS, ItemId, LEGACY_ITEMS, STONE_TO_BRONZE_USES, legacyStone } from "../../shared/items";
import { NPCS, NpcDef, isChest, npcById } from "../../shared/npcs";
import {
  Bag, addItem, groupOf, newEntry, stackLimit, wearsOut, clearEntry, cloneBag, compact, countIn, countItem, emptyBag, entriesIn, entriesInOrder, mergeStacks, putBack, reorderSlots, roomFor, roomForAll,
  stackName, takeFromEntry, takeItem, usedSlots,
} from "../../shared/bag";
import { carriedWeight, carryCapacity, kg, weightOf } from "../../shared/weight";
import { RUN_COST, RUN_REFILL, RUN_REST_MS, RUN_SPEED, buyWithCharisma, maxStamina, sellWithCharisma, tradingXp, walkBonus } from "../../shared/stats";
import {
  CHEST_MAX, CHEST_RENT, CHEST_START, CHEST_STEP, GUILD_BOUNTY_COUNT, GuildBounty, GuildView, RANKS, REAGENTS, expandCost, guildBountyName,
  guildRenown, guildReward, newGuildBoard, newGuildBounty, rankFor, validGuildBounty,
} from "../../shared/guild";
import { findSkill as skillInfo } from "../../shared/disciplines";
import { INVITE_MS, LEAD_KILL_XP, LEAD_STEP_XP, PARTY_CHAT_MAX, PARTY_MAX, PARTY_NEAR, groupBonus } from "../../shared/party";
import { formatMoney } from "../../shared/money";
import { isNight } from "../../shared/daynight";
import {
  NOVA_RADIUS, SPELL_BOOKS, TARGET_RANGE, barSlots, isSpellBook, knownSpells, novaMaxHit, soulsOf, spellMana, spellPower, spellSeconds,
} from "../../shared/spells";
import { ARMOR_LEVEL, BoltSpellId, clothMana, isBoltSpell, metalSlow } from "../../shared/combat";
import {
  ENCHANTS, EnchantId, GUARD_CAP, Inlay, INLAYS, addEnchant, cappedGem, chainPercent, describeEnchant, enchantForGem, enchantKind, enchantTotal, enchantsOf,
  fireDamage, fits, frostTicks, guardPercent, isEnchantId, isSpent, lifeStealPercent, manaFlowPercent, poisonDamage, soulPower, staffHit, stripEnchants,
  thornsDamage, vitalityHp, swiftPercent, bountyPercent, tirelessPercent, wisdomPercent,
} from "../../shared/enchanting";
import { Material, Metal, barId, baseItem, isWoodTool } from "../../shared/tools";
import { ARROW_RECOVER, ARROW_LEVEL, ArrowId, CLOTH_LEVEL, SOFT_LEVEL, TANNING, THREAD_LEVEL, WOOD_LEVEL, arrowId } from "../../shared/handicraft";
import { ArmorType, SOFT_NAMES } from "../../shared/gear";

/** Arrows a bow shoots, best tip first. */
const ARROW_ORDER: ArrowId[] = (["mithril", "steel", "iron", "bronze"] as Metal[]).map(arrowId);
/** What a stone sold for, before stone was taken out of the game. Old saves get this many coins for each one. */
const STONE_PRICE = 2;
import {
  GemId, CUT_KEEPS, CUT_LEVEL, GEMS, isSoulGem, soulCapacity, JEWEL_BARS, JEWEL_METALS, JEWEL_SLOTS, JewelSlot, Jewels, carats, cutId, cutXp, describeBonus, emptyJewels, isJewelry, jewelBonus, jewelTotals,
  parseGem, rollCut, rollGemSize, roughId, soulGemId, soulStoneId,
} from "../../shared/jewelry";
import {
  BUFFS, BUFF_IDS, Buffs, POTIONS, POTION_COOLDOWN_MS, POTION_TYPES, PotionId, PotionType, buffPower, describeEffect, isPotion, parsePotion, potionEffect,
} from "../../shared/alchemy";
import { huntingDrops, huntingXp } from "../../shared/combat";
import {
  BASE_INGREDIENTS, DISHES, DISH_IDS, MAX_STAMINA, SHOP_STEW, STAMINA_COST, STAMINA_REGEN_MS, foodStamina, isFood, isMeal, legacyStew, parseMeal,
} from "../../shared/cooking";
import { BAITS, BaitId, MUSHROOM_CHANCE, SCRAPS_CHANCE, WORM_CHANCE, isBait } from "../../shared/handicraft";
import { TREES, TreeEffect, TreeRanks, cleanRanks, earnedPoints, rankCost, spentPoints, treeBonus, treeNode, treeRoll } from "../../shared/skilltree";
import {
  GUIDE_NAME, Gift, QUEST_REV, YSOLDE_GUILD_STEP, boardOpen, migrateQuest, teacherOf, unlockedSkills, isProtected, QuestProgress, QuestStep, QuestView,
  gateOpen, giftItems, newQuestProgress, tutorialDone, currentStep, chapterById, chapterOf, chapterDone, chapterOpen, chapterViews,
  questMarks, marenDone, stewsBurn, ChapterProgress, Chapter, ChapterId,
} from "../../shared/quests";
import { SHOPS, SHOP_IDS, ShopId, isShop } from "../../shared/shops";
import { RepairJob, isBroken, isRepairable, maxUses, repairCost } from "../../shared/repair";
import { BOUNTY_COUNT, Bounty, bountyChoices, bountyName, bountyReward, newBoard, newBounty, slotCounts, validBounty } from "../../shared/bounties";
import { Account, MAP_REV, SAVE_VERSION, SaveData, checkPassword, hashPassword, store, usernameKey } from "./storage";
import { PLAYER_COLORS, isPlayerColor } from "../../shared/colors";
import { RENOWN_RANKS, RenownView, earnedTitles, rankForRenown } from "../../shared/renown";
import { REROLL_FEE, boardDay } from "../../shared/bounties";
import { MagicJob, isJob } from "../../shared/guild";
import { canBuyHere } from "../../shared/shops";
import { CHAPTERS, gateMet, litLanterns, oathSworn, opensAfter, rankOf, talkWith } from "../../shared/quests";
import { BLESS_MINUTES, BLESS_POWER, RANKS as LIGHT_RANKS, STORY_ITEMS, SPOT_NAMES, TITHE_MAX, TITHE_SHARE, isStoryItem, titheCost } from "../../shared/story";
import { AREAS, DOORS, PLACES } from "../../shared/map";
import { cleanLook } from "../../shared/look";
import {
  CROPS, CROP_IDS, CropId, FARM_CHEST_PRICE, FarmView, LOTS, LOT_SIZE, MASTERY_EXTRA, PLANT_XP, PLOT_SIZES, SEED_BACK, SEED_BACK_PER_LEVEL, SeedId,
  cropOfSeed, decodeCrop, encodeCrop, inPlot, isSeed, lotAt, plotPrice, seedId, tileOf, timeLeft,
} from "../../shared/farming";

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
/** For testing day and night: shift the world's clock by this many milliseconds. */
const CLOCK_SHIFT_MS = Number(process.env.RPG_CLOCK_SHIFT_MS) || 0;
/** The world's clock (day and night are worked out from it, shared/daynight.ts). */
/** The story's stations: lanterns and shrines (shared/story.ts). */
const STORY_STATIONS = new Set<string>(["west_shrine", "thorn_shrine", ...[1, 2, 3, 4, 5, 6].flatMap((n) => [`lantern_${n}`, `round_${n}`])]);
const worldNow = () => Date.now() + CLOCK_SHIFT_MS;

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
  @type("boolean") invisible = false;
  @type("string") title = ""; // an earned title everyone sees over your head (shared/renown.ts)
  @type("string") party = ""; // the party you're in ("" = none, shared/party.ts); party members see each other's health
  @type("boolean") partyLead = false;
  @type("number") rank = 0; // Emberguard rank (shared/story.ts RANKS): others see your cloak
  @type("number") tithe = 0; // Tithe marks (Ember Debt): others see the gold links by your health bar
  @type("string") held = ""; // the weapon in your hand (item id, "" for bare fists), so others see what you fight with
  @type("boolean") running = false; // running (shared/stats.ts RUN_SPEED): others see you run
  @type("string") look = ""; // how your 3D character looks: the Character Workshop's recipe as JSON (shared/look.ts), "" until you make one

  // Server-only (not synced to everyone):
  path: Point[] = [];
  walkDir: Point | null = null; // the way they're holding the keyboard (WASD) to walk, one tile at a time; null when not
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
  winded = 0; // stamina used up for now by running (it all comes back once you stop: shared/stats.ts RUN_COST)
  lastRunAt = 0; // when they last ran a tile (ms)
  outOfBreath = false; // told them they're out of breath (once per run)
  locked: boolean[] = []; // per entry: locked items can't be sold or dropped by accident
  talkTo: NpcDef | null = null; // person the player is walking over to talk to
  quest: QuestProgress = newQuestProgress(); // where they are in the main quest (Maren's chapter, then the trainers')
  nextStepAt = 0; // time (ms) this player may take their next step
  gear: Gear = emptyGear(); // weapon and armor being worn (don't use bag space)
  mana = 50;
  spell: BoltSpellId = "fire_blast"; // the spell cast when holding a staff
  books: SpellId[] = []; // spells learned from spell books (shared/spells.ts)
  spellBar: (SpellId | null)[] = []; // the spell bar's slots
  castReadyAt = 0; // can't cast another bar spell until then (ms)
  barFresh = false; // an old save with no spell bar: fill it with what you know
  combatMastery: CombatMasteryXp = {}; // Mastery XP per weapon type, spell and monster
  fighting: string | null = null; // id of the monster being attacked
  attackTimer = 0; // ticks since the last attack
  healthTicks = 0; // ticks since health last came back on its own
  manaTicks = 0;
  bounties: Bounty[] = []; // the 5 jobs on this player's bounty board (filled the first time they look)
  jewels: Jewels = emptyJewels(); // 2 rings and an amulet (shared/jewelry.ts)
  discovered: PotionType[] = []; // hidden potion recipes found by brewing them
  buffs: Buffs = {}; // potion buffs, with when each runs out (world clock)
  potionReadyAt = 0; // can't drink another potion until then (ms)
  tree: TreeRanks = {}; // Mastery skill tree ranks bought, e.g. { "cooking.slots": 2 } (shared/skilltree.ts)
  titheXp = 0; // XP the shrine has taken toward clearing your next Tithe mark
  tracked: ItemId | null = null; // the bounty shown on the quest tracker (by its item), or null for Maren's quest
  // The Mages' Guild (shared/guild.ts):
  guildPoints = 0; // from the guild's bounties; decides your rank
  guildBounties: GuildBounty[] = []; // the guild board's 3 magic jobs (filled the first time they look)
  chest: Bag = emptyBag(0); // the enchanted chest; 0 spaces until you rent it
  farmChest = false; // paid Farmer Odo to link the farm chest (shared/farming.ts)
  renownRank = 0; // Captain Bryn's Renown rank (shared/renown.ts)
  boardDay = 0; // the day the bounty board was filled; a new day, a new board
  guildDay = 0;
  seedPick: ItemId | null = null; // the seed to plant first (picked on a seed's card)
  farmTimer = 0; // ticks since the last thing done on the farm
  invite: { from: string; until: number } | null = null; // a party invite waiting for an answer (from = their session id)
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
  @type("number") trappedUntil = 0; // Ember trap: the tick its glow ends (0 = not trapped)

  // Server-only:
  homeX = 0;
  homeY = 0;
  target: string | null = null; // session id of the player it's after
  attackTimer = 0;
  respawnAt = 0; // tick it comes back, while defeated
  sleepUntil = 0;
  frozenUntil = 0;
  poison: { left: number; damage: number; by: string } | null = null; // an emerald staff's poison: hits left, damage each, who did it
  trappedBy: string | null = null; // Ember trap: session id of whoever cast it (only their refined emberstone fills)
  /** Hunting: damage each player has done to it since it last came back (session id -> damage). */
  hurtBy = new Map<string, number>();
  /** What each player last hit it with (session id -> style and weapon/spell), for their share of the kill XP. */
  hitWith = new Map<string, { style: CombatStyle; mastery: CombatMasteryId | null }>();
}

/** A farm plot (shared/farming.ts): everyone sees it, only its owner can plant and harvest. */
export class Plot extends Schema {
  @type("string") owner = ""; // their name, for the lot's sign
  @type("number") w = 2;
  @type("number") h = 2;
  /** One per tile of the 6 × 6 lot: "crop:plantedAt:ripeAt", or "" when empty. */
  @type(["string"]) crops = new ArraySchema<string>(...Array<string>(LOT_SIZE * LOT_SIZE).fill(""));
  ownerKey = ""; // server only: whose it is (usernameKey)
}

export class WorldState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  /** Farm plots, by lot number ("0" to "6"). */
  @type({ map: Plot }) plots = new MapSchema<Plot>();
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
  | { kind: "kill"; monster: MonsterId; style?: CombatStyle }
  | { kind: "drink" }
  | { kind: "enchant" }
  | { kind: "track" }
  | { kind: "bounty" }
  | { kind: "plot" }
  | { kind: "plant" }
  | { kind: "harvest" };

/** Where each crafting skill is done. */
const STATION_FOR = { smelting: "furnace", smithing: "anvil", cooking: "stove", handicraft: "workbench", alchemy: "alchemy_table" } as const;

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
  if (r.skill === "foraging") return "dig";
  return id === "minnow" ? "catch Minnows" : `fish at ${r.node}s`;
}

// Every world room running on this server, so a bug report can say who sent it.
const rooms = new Set<WorldRoom>();

/**
 * For bug reports: the logged-in player behind a connection (the client sends
 * its room session id), as the server sees them. Null if nobody matches.
 */
export function playerForReport(sessionId: string) {
  for (const room of rooms) {
    const info = room.reportInfo(sessionId);
    if (info) return info;
  }
  return null;
}

export class WorldRoom extends Room<WorldState> {
  maxClients = 100;
  state = new WorldState();

  /** Who a bug report came from: name, where they are, and a copy of their save. */
  reportInfo(sessionId: string) {
    const p = this.state.players.get(sessionId);
    if (!p) return null;
    const area = areaAt(p.x, p.y);
    return { username: p.name, x: p.x, y: p.y, area: area?.name ?? null, action: p.action, hp: p.hp, maxHp: p.maxHp, save: this.snapshot(p) };
  }

  onCreate() {
    rooms.add(this);
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

    void this.loadFarms();

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

    // Walking with the keyboard (WASD): the client says which way the keys point
    // (dx and dy are each -1, 0 or 1) whenever that changes, and 0,0 when they're let go.
    // You keep stepping that way, one tile at a time, until then.
    this.onMessage("walk", (client, msg: { dx: number; dy: number }) => {
      const p = this.state.players.get(client.sessionId);
      const dx = msg?.dx, dy = msg?.dy;
      if (!p || ![-1, 0, 1].includes(dx) || ![-1, 0, 1].includes(dy)) return;
      if (!dx && !dy) {
        if (p.walkDir) { p.walkDir = null; p.path = []; }
        return;
      }
      this.stopActions(p);
      p.walkDir = { x: dx, y: dy };
      const next = this.keyStep(p);
      p.path = next ? [next] : [];
    });

    // Run (Shift, or the 🏃 button): faster, using stamina for the moment (it comes back once you stop).
    this.onMessage("run", (client, msg: { on: boolean }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.running = !!msg?.on;
      p.outOfBreath = false;
      p.stepMs = this.stepMsOf(p);
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

    // ---- Farming (shared/farming.ts) ----
    this.onMessage("farm", (client, msg: { x: number; y: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.x) || !Number.isInteger(msg?.y)) return;
      this.startFarming(client, p, { x: msg.x, y: msg.y });
    });
    this.onMessage("farmBuy", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p) this.buyPlot(client, p);
    });
    this.onMessage("farmChest", (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p) this.buyFarmChest(client, p);
    });
    this.onMessage("seed", (client, msg: { item: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !isSeed(msg?.item)) return;
      p.seedPick = msg.item as ItemId;
      this.say(client, `🌱 You'll plant ${ITEMS[p.seedPick].name.toLowerCase()} first. Click your plot to plant.`);
    });

    // Pick one of your earned titles to show over your head ("" for none).
    // ---- Parties (stage 13, shared/party.ts) ----
    this.onMessage("partyInvite", (client, msg: { id: string }) => this.partyInvite(client, String(msg?.id ?? "")));
    this.onMessage("partyAnswer", (client, msg: { yes: boolean }) => this.partyAnswer(client, !!msg?.yes));
    this.onMessage("partyLeave", (client) => this.leaveParty(client.sessionId, "left"));
    this.onMessage("partyKick", (client, msg: { id: string }) => {
      const p = this.state.players.get(client.sessionId);
      const o = this.state.players.get(String(msg?.id ?? ""));
      if (!p || !o || !p.partyLead || o.party !== p.party || o === p) return;
      this.leaveParty(String(msg.id), "kicked");
    });
    this.onMessage("partyChat", (client, msg: { text: string }) => {
      const p = this.state.players.get(client.sessionId);
      const party = p && this.parties.get(p.party);
      if (!p || !party) return;
      const text = String(msg?.text ?? "").replace(/\s+/g, " ").trim().slice(0, PARTY_CHAT_MAX);
      if (!text) return;
      for (const sid of party.members) this.clients.getById(sid)?.send("partyChat", { from: p.name, text });
    });

    this.onMessage("title", (client, msg: { title: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const title = String(msg?.title ?? "");
      if (title && !this.titlesOf(p).includes(title)) return;
      p.title = title;
      p.dirty = true;
      this.say(client, title ? `🏅 Your title is now "${title}". Everyone can see it over your head.` : "🏅 You put your title away.");
      this.sendRenown(client, p);
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
      if (isStoryItem(item)) return this.say(client, `No one would buy your ${ITEMS[item].single}. It's worth more to you.`);
      const shop = this.nearShop(p);
      if (!shop) return this.say(client, "You need to be next to a shopkeeper to sell.");
      if (!SHOPS[shop].buys(item)) return this.say(client, `${npcById(shop)!.name} only buys ${SHOPS[shop].buysText}. Shopkeeper Tam at the General Store buys anything.`);
      // Sell `count` of the stack (all of it if left out).
      const n = Math.min(countIn(p, msg.slot), wantCount(msg.count));
      const price = sellWithCharisma(sellPriceFor(item, p.mastery, p.durability[msg.slot]), p.levels.charisma, this.tradingLevel(p)) * n;
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
        total += sellWithCharisma(sellPriceFor(item, p.mastery, p.durability[i]), p.levels.charisma, this.tradingLevel(p)) * n;
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
      if (!canBuyHere(SHOPS[shop], item, this.tradingLevel(p), p.renownRank)) {
        const rare = SHOPS[shop].rare?.find((r) => r.item === item);
        const special = SHOPS[shop].renown?.find((r) => r.item === item);
        if (rare) return this.say(client, `You need Trading level ${rare.trading} to buy that here. Trading goes up as you sell things.`);
        if (special) return this.say(client, `Captain Bryn only sells that to those he's named ${RENOWN_RANKS[special.rank].title}.`);
        return;
      }
      const want = Math.max(1, Math.min(28, Math.floor(Number(msg.count) || 1)));
      const price = buyWithCharisma(buyPriceFor(item), p.levels.charisma, this.tradingLevel(p));
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
      const reward = bountyReward(b, p.mastery, this.renownLevel(p));
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
      if (p.coins < REROLL_FEE) return this.say(client, `📋 New notices cost ${formatMoney(REROLL_FEE)} (for the notice writer). The board changes by itself every day.`);
      p.coins -= REROLL_FEE;
      client.send("coins", p.coins);
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

    // The 3D game's character creator: how your character looks (shared/look.ts).
    this.onMessage("setLook", (client, msg: { look: unknown }) => {
      const p = this.state.players.get(client.sessionId);
      const look = cleanLook(msg?.look);
      if (!p || look === null) return;
      p.look = look;
      this.saveSoon(p);
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
      const mine = this.plotOf(p);
      if (mine) { mine.plot.ownerKey = newKey; mine.plot.owner = name; this.saveFarmsSoon(); }
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
      client.send("discovered", p.discovered);
      client.send("jewels", p.jewels);
      this.sendSpellbook(client, p);
      this.sendBuffs(client, p);
      this.fillBoard(p);
      this.sendBounties(client, p);
      client.send("clock", { now: worldNow() }); // day and night (shared/daynight.ts)
      if (msg?.reconnected) return;
      const step = this.step(p);
      if (!step) this.say(client, tutorialDone(p.quest) ? "Welcome back!" : "Welcome back! Talk to anyone with a ❗ for your next lesson.");
      else if (p.quest.active === "awakening" && p.quest.ch.awakening?.step === 0) this.say(client, "✨ You open your eyes on the steps of the Heart Shrine. Light pours over you. Someone is kneeling beside you: talk to Sister Celene (the ❗, just below the shrine).");
      else if (p.quest.active === "maren" && p.quest.ch.maren?.step === 0) this.say(client, `Welcome! Go and talk to ${GUIDE_NAME} in her cottage by the lake (${areaAt(p.x, p.y)?.id === "lighthall" ? "walk out of the big doors at the bottom of this hall, then " : ""}west along the road: your 🗺️ map shows her ❗). She'll show you how to get started.`);
      else this.say(client, `Welcome back! Your task: ${step.task}.`);
      for (const note of p.loginNotes.splice(0)) this.say(client, note);
    });

    this.onMessage("drop", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot) || !p.inventory[msg.slot]) return;
      const item = p.inventory[msg.slot]!;
      if (p.locked[msg.slot]) return this.say(client, `That ${ITEMS[item].single} is locked. Unlock it to drop it.`);
      if (isProtected(p.quest, item)) return this.say(client, this.keepIt(p, item, "drop"));
      if (isStoryItem(item) && !STORY_ITEMS[item].droppable) return this.say(client, `Better keep your ${ITEMS[item].single}. It's part of your story.`);
      clearEntry(p, msg.slot); // the whole stack
      this.sendInventory(client, p);
      this.saveSoon(p);
    });

    // Click a monster to attack it.
    this.onMessage("attack", (client, msg: { id: string }) => {
      const p = this.state.players.get(client.sessionId);
      const m = this.state.monsters.get(String(msg?.id));
      if (!p || !m || !m.alive || areaAt(m.x, m.y) !== areaAt(p.x, p.y)) return;
      if (isDanger(m.x, m.y) && !isDanger(p.x, p.y) && !gateOpen(p.quest)) return this.say(client, this.notReady());
      // No fighting until Huntmaster Kael has taught you how (the tutorial comes first).
      if (!isUnlocked(p.unlocked, "melee")) return this.say(client, `⚔️ ${this.notTaught("melee")} Until then, leave the monsters be.`);
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

    // Pick which spell to cast with a staff.
    this.onMessage("spell", (client, msg: { id: string }) => {
      const p = this.state.players.get(client.sessionId);
      const id = msg?.id;
      if (!p || !id || !isBoltSpell(id)) return;
      this.pickBolt(client, p, id);
    });

    // Cast a spell from the spell bar (bolts just pick what your staff fires).
    this.onMessage("cast", (client, msg: { id: string }) => {
      const p = this.state.players.get(client.sessionId);
      const id = msg?.id as SpellId;
      if (!p || !SPELL_IDS.includes(id)) return;
      this.castSpell(client, p, id, client.sessionId);
    });

    // The enchanting altar (shared/enchanting.ts).
    this.onMessage("enchant", (client, msg: { slot: number; soul: number; effect?: string; gem?: number; inlay?: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot) || !Number.isInteger(msg?.soul) || (msg.gem != null && !Number.isInteger(msg.gem))) return;
      this.enchant(client, p, msg);
    });
    this.onMessage("disenchant", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      this.disenchant(client, p, msg.slot);
    });

    // Rearrange the spell bar: a list of spell ids (or null for an empty slot).
    this.onMessage("spellBar", (client, msg: { bar: (string | null)[] }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Array.isArray(msg?.bar)) return;
      const known = this.known(p);
      const slots = barSlots(p.combatMastery);
      const bar: (SpellId | null)[] = [];
      for (let i = 0; i < slots; i++) {
        const id = msg.bar[i] as SpellId;
        bar.push(known.includes(id) && !bar.includes(id) ? id : null);
      }
      p.spellBar = bar;
      p.dirty = true;
      this.sendSpellbook(client, p);
    });

    // Read a spell book from your bag: learn its spell (the book is used up).
    this.onMessage("read", (client, msg: { slot: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isInteger(msg?.slot)) return;
      const item = p.inventory[msg.slot];
      if (isStoryItem(item)) return this.readStory(client, p, msg.slot, item);
      if (!isSpellBook(item)) return;
      const spell = SPELL_BOOKS[item];
      const d = SPELLS[spell];
      if (!isUnlocked(p.unlocked, "magic")) return this.say(client, this.notTaught("magic"));
      if (p.books.includes(spell)) return this.say(client, `You already know ${d.name}. You could sell the book.`);
      const level = levelForXp(p.skillXp.magic);
      if (level < d.level) return this.say(client, `The words swim on the page. You need Spellcasting level ${d.level} to learn ${d.name}. (You're level ${level}.)`);
      takeFromEntry(p, msg.slot, 1);
      p.books.push(spell);
      const placed = this.addToBar(p, spell);
      this.say(client, `📖 You learn ${d.icon} ${d.name}! ${placed ? "It's on your spell bar." : "Your spell bar is full: press ✎ on it to swap a spell in."}`);
      this.sendInventory(client, p);
      this.sendSpellbook(client, p);
      this.saveSoon(p);
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
        ? `🔮 Archmage Rowan widens your chest's enchantment: ${next} spaces now, for ${formatMoney(cost)}.`
        : `🔮 You rent space in the enchanted chest for ${formatMoney(cost)}: ${next} spaces. Open it here, at the Hearthstone Inn, on the coast or in the Dark Forest.`);
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
      if (!put) return this.say(client, "Your chest is full. Buy more space from Archmage Rowan at the Mages' Guild.");
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
      if (p.coins < REROLL_FEE) return this.say(client, `🔮 New guild bounties cost ${formatMoney(REROLL_FEE)}. The board changes by itself every day.`);
      p.coins -= REROLL_FEE;
      client.send("coins", p.coins);
      p.guildBounties = newGuildBoard(this.guildPlayer(p));
      this.say(client, "🔮 The guild board shimmers, and new jobs appear.");
      this.sendGuild(client, p);
      p.dirty = true;
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
      // Catching your breath after running: it all comes back a few seconds after you stop.
      if (p.winded > 0 && Date.now() - p.lastRunAt > RUN_REST_MS) {
        const could = this.canRun(p);
        p.winded = Math.max(0, p.winded - RUN_REFILL);
        if (this.canRun(p) !== could) p.stepMs = this.stepMsOf(p);
        if (!p.winded) p.outOfBreath = false;
        if (client) this.sendStamina(client, p);
      }
      if (tick % 5 === 0) this.expireBuffs(p, client);
      let vitals = false;
      if (p.hp < p.maxHp && ++p.healthTicks >= HEALTH_REGEN_TICKS) { p.healthTicks = 0; p.hp++; vitals = true; }
      const mMax = this.maxManaOf(p);
      const manaEvery = MANA_REGEN_TICKS / (1 + manaFlowPercent(enchantTotal(this.armorItems(p), "manaflow")) / 100);
      if (p.mana < mMax && ++p.manaTicks >= manaEvery) { p.manaTicks = 0; p.mana++; vitals = true; }
      if (vitals && client) this.sendVitals(client, p);
      if (p.fighting) return this.combatTick(p, sessionId);
      if (p.path.length || !p.target) return;
      if (p.crafting) this.craftTick(p, sessionId);
      else if (p.activity === "farming") this.farmTick(p, sessionId);
      else this.gatherTick(p, sessionId);
    });
    this.monsterTick(tick);
  }

  /** Walking speed: one tile per 600ms, timed per player. */
  private stepPlayers() {
    const now = Date.now();
    this.state.players.forEach((p) => {
      // Holding a direction key: line up the next tile that way.
      if (p.walkDir && !p.path.length && !p.fighting && !p.target && !p.talkTo && !p.crafting) {
        const next = this.keyStep(p);
        if (next) p.path = [next];
      }
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
      if (this.canRun(p)) this.runStep(p, now);
      // Walked onto a door: through it you go.
      const door = !p.path.length ? doorAt(p.x, p.y) : null;
      if (door) {
        this.goThrough(p, door);
        p.nextStepAt = now + p.stepMs;
        return;
      }
      this.checkReach(p);
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

  /**
   * The next tile when walking with the keys. Same rules as clicking (no cutting
   * the corner of a wall); if a diagonal is blocked you slide along the wall instead.
   */
  private keyStep(p: Player): Point | null {
    const d = p.walkDir;
    if (!d) return null;
    const tries = d.x && d.y ? [d, { x: d.x, y: 0 }, { x: 0, y: d.y }] : [d];
    for (const t of tries) {
      if (!isWalkable(p.x + t.x, p.y + t.y)) continue;
      if (t.x && t.y && (!isWalkable(p.x + t.x, p.y) || !isWalkable(p.x, p.y + t.y))) continue;
      return { x: p.x + t.x, y: p.y + t.y };
    }
    return null;
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
  }

  /** How long each step takes: Dexterity, and a swiftness potion. */
  private stepMsOf(p: Player) {
    const now = worldNow();
    const speed = 1 + walkBonus(p.levels.dexterity) + (buffPower(p.buffs, "swift", now) + buffPower(p.buffs, "haste", now)) / 100;
    return Math.round(TICK_MS / Math.max(0.5, speed - metalSlow(p.gear)) / (this.canRun(p) ? RUN_SPEED : 1));
  }

  /** Running, with breath left for another tile. */
  private canRun(p: Player) {
    return p.running && p.stamina - p.winded >= RUN_COST;
  }

  /** A tile run: a little breath used up for now. Out of breath, you're back to walking. */
  private runStep(p: Player, now: number) {
    p.winded += RUN_COST;
    p.lastRunAt = now;
    const client = this.clients.find((c) => this.state.players.get(c.sessionId) === p);
    if (!this.canRun(p)) {
      p.stepMs = this.stepMsOf(p);
      if (client && !p.outOfBreath) this.say(client, "😮‍💨 You're out of breath, so you slow to a walk. Stop running for a few seconds and your stamina comes back.");
      p.outOfBreath = true;
    }
    if (client) this.sendStamina(client, p);
  }

  /** Potion buffs that are running, for the bar under your health. */
  private sendBuffs(client: Client, p: Player) {
    client.send("buffs", p.buffs);
  }

  /** Buffs that ran out: say so, and walk at normal speed again. */
  private expireBuffs(p: Player, client: Client | undefined) {
    const now = worldNow();
    let changed = false;
    for (const id of BUFF_IDS) {
      const b = p.buffs[id];
      if (b && b.until <= now) {
        delete p.buffs[id];
        changed = true;
        if (client) {
          const spell = id === "ward" ? "ward fades" : id === "haste" ? "haste wears off" : id === "invisible" ? "invisibility wears off: monsters can see you again" : id === "blessed" ? "blessing fades" : null;
          this.say(client, spell ? `${BUFFS[id].icon} Your ${spell}.` : `${BUFFS[id].icon} Your ${BUFFS[id].name.toLowerCase()} potion wears off.`);
        }
      }
    }
    p.invisible = buffPower(p.buffs, "invisible", now) > 0;
    if (!changed) return;
    p.stepMs = this.stepMsOf(p);
    p.dirty = true;
    if (client) this.sendBuffs(client, p);
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
    client.send("stamina", { stamina: p.stamina, max: p.maxStamina, winded: Math.min(p.winded, p.stamina) });
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
    return treeBonus(p.tree, skill, effect) + this.toolEnchant(p, skill, effect);
  }

  /** A chance from the skill tree plus the tool's enchantment (e.g. "does this cost no stamina?"). */
  private roll(p: Player, skill: SkillId, effect: TreeEffect) {
    return Math.random() < this.tree(p, skill, effect);
  }

  /** What the enchantment on this skill's belt tool adds (Swiftness, Bounty, Tireless, Wisdom), as a fraction. */
  private toolEnchant(p: Player, skill: SkillId, effect: TreeEffect): number {
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
  }

  /** Armor you're wearing (not your weapon), for armor enchantments. */
  private armorItems(p: Player) {
    return GEAR_SLOTS.filter((sl) => sl !== "weapon").map((sl) => p.gear[sl]?.item ?? null);
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
    return maxHealth(p.levels.strength) + this.tree(p, "defense", "health") + jewelTotals(p.jewels).health + vitalityHp(enchantTotal(this.armorItems(p), "vitality"));
  }

  /** Max mana: from your Wisdom level. */
  private maxManaOf(p: Player) {
    return maxMana(p.levels.wisdom) + jewelTotals(p.jewels).mana + clothMana(p.gear);
  }

  /** Max stamina: from your Endurance level, plus emeralds. */
  private maxStaminaOf(p: Player) {
    return maxStamina(p.levels.endurance) + jewelTotals(p.jewels).stamina;
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
    p.maxStamina = this.maxStaminaOf(p);
    if (p.maxStamina > oldStamina) p.stamina += p.maxStamina - oldStamina;
    p.stamina = Math.min(p.stamina, p.maxStamina);
    p.mana = Math.min(p.mana, this.maxManaOf(p));
    p.stepMs = this.stepMsOf(p);
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
    if (!taught.has("magic") && p.unlocked.includes("magic")) this.sendSpellbook(client, p); // Rowan just taught you: Firebolt goes on the bar
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
    if (npc.id === "bryn") this.renownTalk(client, p); // a new rank, if you've earned one
    if (this.storyClick(client, p, npc)) return;
    if (this.talkQuest(client, p, npc)) return;
    if (STORY_STATIONS.has(npc.id)) return this.say(client, `${npc.name}: ${this.stationLook(p, npc)}`);
    if (npc.id === "maren") return;
    if (npc.id === "board") return this.openBoard(client, p);
    if (npc.id === "repairer") {
      this.say(client, `${npc.name}: ${npc.greeting}`);
      return this.sendRepairs(client, p, true);
    }
    if (npc.id === "archmage" || npc.id === "guildboard") return this.openGuild(client, p, npc);
    if (isChest(npc.id)) return this.openChest(client, p, npc.id);
    this.say(client, `${npc.name}: ${npc.greeting}`);
    if (npc.kind === "station") return client.send("station", { npc: npc.id });
    if (npc.id === "odo") this.sendFarm(client, p);

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
    if (!boardOpen(p.quest)) return;
    // A new day: a whole new board.
    const today = boardDay();
    if (p.boardDay !== today) { p.boardDay = today; p.bounties = []; }
    if (p.bounties.length >= BOUNTY_COUNT) return;
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
    const jobs: MagicJob[] = [];
    if (this.known(p).includes("soul_trap")) jobs.push("trap");
    if (isUnlocked(p.unlocked, "alchemy")) jobs.push("brew");
    if (isUnlocked(p.unlocked, "enchanting")) jobs.push("enchant");
    return { magicLevel: levelForXp(p.skillXp.magic), reagents: REAGENTS.filter((r) => reachable.has(r)), jobs };
  }

  private guildView(p: Player): GuildView {
    return { points: p.guildPoints, rank: rankFor(p.guildPoints), chestSize: p.chest.slotCount, bounties: p.guildBounties };
  }

  /** Not until Old Maren's lessons are done. Says why not. */
  private guildOpen(client: Client, p: Player): boolean {
    if ((p.quest.ch.ysolde?.step ?? -1) >= YSOLDE_GUILD_STEP) return true;
    this.say(client, "🔮 The Mages' Guild only takes members who have finished Archmage Rowan's lesson.");
    return false;
  }

  /** Click the Archmage or the guild board: the guild window (rank, chest, magic bounties). */
  private openGuild(client: Client, p: Player, npc: NpcDef) {
    if (!this.guildOpen(client, p)) return;
    const today = boardDay();
    if (p.guildDay !== today || p.guildBounties.length < GUILD_BOUNTY_COUNT) {
      p.guildDay = today;
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
    return NPCS.some((n) => isChest(n.id) && (n.id !== "chest_farm" || p.farmChest) && this.nearNpc(p, n.id));
  }

  /** Click an enchanted chest: your storage, if you've rented it. */
  private openChest(client: Client, p: Player, id = "chest") {
    if (id === "chest_farm" && !p.farmChest) {
      return this.say(client, `📦 This chest isn't linked to yours. Farmer Odo can link it to your enchanted chest for ${formatMoney(FARM_CHEST_PRICE)}.`);
    }
    if (!this.guildOpen(client, p)) return;
    if (!p.chest.slotCount) {
      return this.say(client, `🔮 The chest is sealed. Rent space in it from Archmage Rowan at the Mages' Guild (south-west of town) for ${formatMoney(CHEST_RENT)}.`);
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
        if (rankBefore < 2 && rank >= 2) {
          const got = this.give(p, "book_invisibility", 1, null, true) > 0;
          if (got) this.say(client, "Archmage Rowan: \"Well done, Adept. Take this: a spell book of Invisibility. Read it when your Spellcasting is ready.\"");
          this.sendInventory(client, p);
        }
        client.send("guildRank", { rank: RANKS[rank].name });
      }
      client.send("coins", p.coins);
      this.sendGuild(client, p);
    }
    p.dirty = true;
  }

  /** Ember trapping, brewing and enchanting count toward guild bounties that ask for them. */
  private guildJob(p: Player, client: Client | undefined, kind: MagicJob) {
    if ((p.quest.ch.ysolde?.step ?? -1) < YSOLDE_GUILD_STEP) return;
    const i = p.guildBounties.findIndex((b) => b.kind === kind);
    const b = p.guildBounties[i];
    if (!b || !isJob(b)) return;
    b.progress++;
    p.dirty = true;
    if (b.progress >= b.count) this.finishGuildBounty(client, p, i);
    else if (client) {
      this.say(client, `🔮 Guild bounty: ${b.progress}/${b.count}.`);
      this.sendGuild(client, p);
    }
  }

  /** A monster fell: count it toward "defeat with spells" guild bounties. */
  private guildKill(p: Player, client: Client | undefined, monster: MonsterId, style: CombatStyle) {
    if (style !== "magic" || (p.quest.ch.ysolde?.step ?? -1) < YSOLDE_GUILD_STEP) return;
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
        if (c && c.item === "stone") {
          // Stone isn't in the game any more: it's paid out at what it sold for.
          const n = Number.isInteger(c.count) && c.count >= 1 ? Math.min(c.count, 1000) : 1;
          p.coins += n * STONE_PRICE;
          p.loginNotes.push(`🪨 Stone isn't mined any more, so the stone in your enchanted chest was sold for you: +${n * STONE_PRICE} bronze coins.`);
          return;
        }
        if (c && typeof c.item === "string" && legacyStone(c.item)) {
          c.item = legacyStone(c.item)!; // stone tools, weapons and arrows -> bronze
          if (typeof c.durability === "number" && c.durability > 0) c.durability *= STONE_TO_BRONZE_USES;
        }
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

  /** Step through a door into another area (a shop, a cave...). Dangerous places stay shut until Kael's lesson. */
  private goThrough(p: Player, door: Door) {
    const sid = this.sidOf(p);
    const client = sid ? this.clients.getById(sid) : undefined;
    if (isDanger(door.to.x, door.to.y) && !isDanger(p.x, p.y) && !gateOpen(p.quest)) {
      if (client) this.say(client, this.notReady());
      return;
    }
    this.stopActions(p);
    p.path = [];
    p.x = door.to.x;
    p.y = door.to.y;
    p.dirty = true;
    // Monsters chasing you lose track of you.
    this.state.monsters.forEach((m) => { if (m.target === sid) m.target = null; });
  }

  private notReady() {
    return `⚠ You're not ready to go in there yet. Monsters there attack on sight: finish Huntmaster Kael's lesson first (he'll open the gate for you).`;
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
      const m = parseArmor(item).metal;
      const need = ARMOR_LEVEL[m];
      const level = levelForXp(p.skillXp.defense);
      if (level < need) return `You need Defense level ${need} to wear ${m} armor. (You're level ${level}.)`;
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
      const staffMagic = this.staffEnchant(p);
      const mana = staffMagic ? 1 : spellMana(a.spell, combatMasteryIn(p.combatMastery, a.spell));
      if (p.mana < mana) {
        if (client) this.say(client, `You're out of mana: ${spell.name} needs ${mana} and you have ${p.mana}. It comes back 1 every 6 seconds.`);
        return this.stopActions(p);
      }
      if (!treeRoll(p.tree, "magic", "manaSave")) p.mana -= mana;
    } else {
      if (p.stamina < ATTACK_STAMINA) {
        if (client) this.say(client, "You're too tired to fight. Eat something, or rest (1 stamina every 30 seconds).");
        return this.stopActions(p);
      }
      if (!treeRoll(p.tree, a.style, "staminaSave")) p.stamina -= ATTACK_STAMINA;
    }
    // A bow shoots arrows from your bag: the best tip first. About 1 in 3 can be picked up again.
    let arrow: ArrowId | null = null;
    const held = p.gear.weapon?.item;
    if (isWeapon(held) && parseWeapon(held).type === "bow") {
      arrow = ARROW_ORDER.find((id) => p.inventory.some((it, i) => it === id && !p.locked[i])) ?? null;
      if (!arrow) {
        if (client) this.say(client, "You're out of arrows. Make them at Rook's workbench (Handicraft), or buy bronze arrows from Huntmaster Kael.");
        return this.stopActions(p);
      }
      if (Math.random() >= ARROW_RECOVER) {
        takeItem(p, arrow, 1, (i) => !p.locked[i]);
        if (client) this.sendInventory(client, p);
      }
    }
    p.attackTimer = 0;
    this.breakInvisible(p, client, "attack");
    const style = a.style;
    const weaponM = combatMasteryIn(p.combatMastery, a.mastery);
    const monsterM = combatMasteryIn(p.combatMastery, m.kind);
    const chance = hitChance(levelForXp(p.skillXp[style]), m.kind, a, weaponM, monsterM, this.tree(p, style, "accuracy") + jewelTotals(p.jewels).accuracy / 100);
    const hit = Math.random() < chance;
    const staffMagic = a.spell ? this.staffEnchant(p) : null;
    const max = maxHitWith(a, weaponM) + (staffMagic && a.maxHit ? staffHit(staffMagic.power) : 0) + (arrow ? METAL_DAMAGE[arrow.slice(7) as Material] : 0);
    // The skill tree's damage bonus: +5% is a 5% chance of +1 on a hit of 1, and so on.
    // Weapons (not spells) hit harder with a strength potion.
    const strength = a.spell ? 0 : buffPower(p.buffs, "strength", worldNow()) / 100;
    const roll = hit && max ? (1 + Math.floor(Math.random() * max)) * (1 + this.tree(p, style, "damage") + strength) : 0;
    let damage = Math.floor(roll) + (Math.random() < roll % 1 ? 1 : 0);
    if (staffMagic?.id === "fire" && damage) damage += fireDamage(staffMagic.gem / 10);
    const spell = a.spell ? SPELLS[a.spell] : null;
    if (damage) {
      m.hurtBy.set(sessionId, (m.hurtBy.get(sessionId) ?? 0) + Math.min(damage, m.hp));
      m.hp = Math.max(0, m.hp - damage);
    }
    m.hitWith.set(sessionId, { style, mastery: a.mastery });
    if (hit && spell?.freeze) m.frozenUntil = this.state.tick + spell.freeze;
    if (hit && staffMagic) this.staffEffect(p, client, sessionId, m, staffMagic, damage);
    if (hit && spell?.sleep) { m.sleepUntil = this.state.tick + spell.sleep; m.attackTimer = 0; }
    this.broadcast("hit", { on: "monster", id: p.fighting, damage, miss: !hit, spell: a.spell ?? null, from: sessionId });
    // It fights back now (if it ever does).
    if (def.maxHit > 0 && !m.target) m.target = sessionId;
    if (a.mastery !== "fists") this.wearGear(p, client, "weapon", wearFor(def.level));
    const killed = m.hp <= 0;
    // XP: 1 per damage (a landed sleep counts as a few). The kill's bonus is shared out in killMonster.
    const xp = damage || (hit && spell?.sleep ? Math.ceil(spell.mana / 2) : 0);
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

  /**
   * You defeated it. Stage 13: its kill XP is split by how much damage each person did,
   * its drops go to whoever did the most, and the kill counts for quests for everyone
   * who hurt it and their party members close by. It comes back after a while.
   */
  private killMonster(m: Monster, p: Player, client: Client | undefined, style: CombatStyle) {
    const def = MONSTERS[m.kind];
    m.alive = false;
    m.target = null;
    m.status = "";
    m.respawnAt = this.state.tick + def.respawnTicks;
    if (m.trappedBy && m.trappedUntil > this.state.tick) this.fillSoulGem(m);
    m.trappedUntil = 0;
    m.trappedBy = null;
    m.poison = null;
    const killer = this.sidOf(p);
    const shares = [...m.hurtBy.entries()].filter(([sid, dmg]) => dmg > 0 && this.state.players.has(sid));
    if (!shares.length) shares.push([killer, 1]);
    const total = shares.reduce((sum, [, dmg]) => sum + dmg, 0);
    const topSid = shares.reduce((best, x) => (x[1] > best[1] ? x : best))[0];
    const top = this.state.players.get(topSid) ?? p;
    const topClient = top === p ? client : this.clients.getById(topSid);
    // Drops: to whoever did the most damage. Hunting: a better hunter gets more drops.
    const hunter = isUnlocked(top.unlocked, "hunting") ? huntingDrops(levelForXp(top.skillXp.hunting)) : 1;
    const dropBoost = masteryDrops(combatMasteryIn(top.combatMastery, m.kind)) * hunter;
    const got: string[] = [];
    let lost = 0;
    for (const d of def.drops) {
      if (Math.random() >= Math.min(1, d.chance * dropBoost)) continue;
      if (!this.give(top, d.item)) { lost++; continue; }
      got.push(aOr(ITEMS[d.item].single));
    }
    const [lo, hi] = def.coins;
    const coins = hi ? lo + Math.floor(Math.random() * (hi - lo + 1)) : 0;
    if (coins) { top.coins += coins; got.push(formatMoney(coins)); }
    this.state.players.forEach((other) => { if (other.fighting && this.state.monsters.get(other.fighting) === m) this.stopActions(other); });
    const drops = (got.length ? ` It drops ${got.join(" and ")}.` : "") + (lost ? " Your bag is full or too heavy, so you leave something behind." : "");
    if (topClient) {
      this.say(topClient, top === p ? `You defeat the ${def.name.toLowerCase()}!${drops}` : `The ${def.name.toLowerCase()} is defeated! You did the most damage, so its drops are yours.${drops}`);
      this.sendInventory(topClient, top);
    }
    // Everyone else who helped hears who got the drops.
    for (const [sid] of shares) {
      const pl = this.state.players.get(sid);
      const cl = pl === p ? client : this.clients.getById(sid);
      if (!pl || pl === top || !cl) continue;
      this.say(cl, `${pl === p ? "You defeat" : "Together you defeat"} the ${def.name.toLowerCase()}! ${top.name} did the most damage, so the drops go to them.`);
    }
    if (top !== p) this.saveSoon(top);
    // Kill XP, shared by damage (a bit more for party members near their leader).
    if (def.xp) for (const [sid, dmg] of shares) {
      const pl = this.state.players.get(sid);
      if (!pl) continue;
      const cl = pl === p ? client : this.clients.getById(sid);
      const how = m.hitWith.get(sid) ?? { style, mastery: null };
      const xp = Math.max(1, Math.round(def.xp * dmg / total * (1 + this.groupBonusFor(pl))));
      this.addSkillXp(pl, cl, how.style, xp);
      if (how.mastery) this.addCombatMastery(pl, cl, how.mastery, xp);
      this.addCombatMastery(pl, cl, m.kind, xp);
      if (pl !== p) this.saveSoon(pl);
    }
    // Leadership: each party that fought it, for every member near their leader.
    const led = new Set<string>();
    for (const [sid] of shares) {
      const party = this.parties.get(this.state.players.get(sid)?.party ?? "");
      if (!party || led.has(party.leader)) continue;
      led.add(party.leader);
      const near = this.nearLeader(party).length;
      const lead = this.state.players.get(party.leader);
      if (lead && near) this.addSkillXp(lead, this.clients.getById(party.leader), "leadership", LEAD_KILL_XP * near);
    }
    // Quests: everyone who hurt it, and their party members close by.
    const counted = new Map<string, CombatStyle | undefined>([[killer, style]]);
    for (const [sid] of shares) if (!counted.has(sid)) counted.set(sid, m.hitWith.get(sid)?.style);
    for (const [sid] of shares) {
      const pl = this.state.players.get(sid);
      if (!pl) continue;
      for (const mate of this.partyMates(pl)) if (!counted.has(mate) && tileDistance(this.state.players.get(mate)!, pl) <= PARTY_NEAR) counted.set(mate, undefined);
    }
    counted.forEach((st, sid) => {
      const pl = this.state.players.get(sid);
      if (pl) this.questEvent(pl, pl === p ? client : this.clients.getById(sid), { kind: "kill", monster: m.kind, style: st });
    });
    m.hitWith.clear();
    this.guildKill(p, client, m.kind, style);
    this.shareHunting(m);
  }

  private sidOf(p: Player) {
    for (const [sid, o] of this.state.players) if (o === p) return sid;
    return "";
  }

  // ---------------- Parties (stage 13, shared/party.ts) ----------------

  private parties = new Map<string, { leader: string; members: string[] }>();
  private partySeq = 0;

  /** Your party members' session ids, not counting you. */
  private partyMates(p: Player): string[] {
    const party = this.parties.get(p.party);
    return party ? party.members.filter((sid) => this.state.players.get(sid) !== p) : [];
  }

  /** Members (not the leader) close enough to their leader to follow them. */
  private nearLeader(party: { leader: string; members: string[] }): string[] {
    const lead = this.state.players.get(party.leader);
    if (!lead) return [];
    return party.members.filter((sid) => sid !== party.leader && tileDistance(this.state.players.get(sid)!, lead) <= PARTY_NEAR);
  }

  /** The leader's group bonus to kill XP, for someone near them (with at least one other member near too). */
  private groupBonusFor(p: Player): number {
    const party = this.parties.get(p.party);
    if (!party || party.members.length < 2) return 0;
    const near = this.nearLeader(party);
    const sid = this.sidOf(p);
    if (!near.length || (sid !== party.leader && !near.includes(sid))) return 0;
    const lead = this.state.players.get(party.leader)!;
    return groupBonus(isUnlocked(lead.unlocked, "leadership") ? levelForXp(lead.skillXp.leadership) : 1);
  }

  /** A quest step finished in a party, with the leader (or another member, if you lead) close by: Leadership for the leader. */
  private leadStep(p: Player) {
    const party = this.parties.get(p.party);
    if (!party || party.members.length < 2) return;
    const lead = this.state.players.get(party.leader);
    if (!lead) return;
    const near = this.nearLeader(party);
    if (lead === p ? !near.length : !near.includes(this.sidOf(p))) return;
    this.addSkillXp(lead, this.clients.getById(party.leader), "leadership", LEAD_STEP_XP);
    this.saveSoon(lead);
  }

  /** Tell everyone in the party something. */
  private partySay(party: { members: string[] }, text: string, skip?: string) {
    for (const sid of party.members) if (sid !== skip) { const c = this.clients.getById(sid); if (c) this.say(c, text); }
  }

  private partyInvite(client: Client, id: string) {
    const p = this.state.players.get(client.sessionId);
    const o = this.state.players.get(id);
    if (!p || !o || o === p) return;
    const party = this.parties.get(p.party);
    if (party && party.leader !== client.sessionId) return this.say(client, "Only your party's leader (★) can invite people.");
    if (o.party && o.party === p.party) return this.say(client, `${o.name} is already in your party.`);
    if (o.party) return this.say(client, `${o.name} is already in a party.`);
    if (party && party.members.length >= PARTY_MAX) return this.say(client, `Your party is full (${PARTY_MAX} people at most).`);
    if (o.invite && o.invite.until > Date.now() && o.invite.from !== client.sessionId) return this.say(client, `${o.name} is thinking about another invite. Try again in a minute.`);
    o.invite = { from: client.sessionId, until: Date.now() + INVITE_MS };
    this.clients.getById(id)?.send("partyInvite", { from: p.name });
    this.say(client, `🚩 You invite ${o.name} to your party. Waiting for them to answer…`);
  }

  private partyAnswer(client: Client, yes: boolean) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const inv = p.invite;
    p.invite = null;
    const from = inv && inv.until > Date.now() ? this.state.players.get(inv.from) : undefined;
    const fromClient = inv ? this.clients.getById(inv.from) : undefined;
    if (!inv || !from) return this.say(client, "That invite has run out.");
    if (!yes) {
      if (fromClient) this.say(fromClient, `${p.name} said no thanks to your party invite.`);
      return;
    }
    if (p.party) return this.say(client, "You're already in a party. Leave it first.");
    let party = this.parties.get(from.party);
    if (party && party.leader !== inv.from) return this.say(client, `${from.name} isn't leading their party any more.`);
    if (!party) {
      const pid = `party${++this.partySeq}`;
      party = { leader: inv.from, members: [inv.from] };
      this.parties.set(pid, party);
      from.party = pid;
      from.partyLead = true;
    }
    if (party.members.length >= PARTY_MAX) return this.say(client, `${from.name}'s party is full.`);
    party.members.push(client.sessionId);
    p.party = from.party;
    p.partyLead = false;
    this.partySay(party, `🚩 ${p.name} joins the party.`, client.sessionId);
    this.say(client, `🚩 You join ${from.name}'s party. Kills count for everyone close by, and the 🚩 panel has party chat.`);
  }

  /** Leave (or be kicked from) your party. The next member leads if the leader goes; a party of one ends. */
  private leaveParty(sid: string, why: "left" | "kicked") {
    const p = this.state.players.get(sid);
    if (!p || !p.party) return;
    const pid = p.party;
    const party = this.parties.get(pid);
    p.party = "";
    p.partyLead = false;
    const c = this.clients.getById(sid);
    if (c) this.say(c, why === "kicked" ? "🚩 The leader took you out of the party." : "🚩 You leave the party.");
    if (!party) return;
    party.members = party.members.filter((m) => m !== sid);
    this.partySay(party, why === "kicked" ? `🚩 ${p.name} was taken out of the party.` : `🚩 ${p.name} left the party.`);
    if (party.members.length < 2) {
      for (const m of party.members) {
        const o = this.state.players.get(m);
        if (o) { o.party = ""; o.partyLead = false; }
        const oc = this.clients.getById(m);
        if (oc) this.say(oc, "🚩 The party has ended: you're the only one left.");
      }
      this.parties.delete(pid);
      return;
    }
    if (party.leader === sid) {
      party.leader = party.members[0];
      const lead = this.state.players.get(party.leader)!;
      lead.partyLead = true;
      this.partySay(party, `🚩 ${lead.name} leads the party now.`);
    }
  }

  /** Hunting XP for everyone who hurt it, by their share of the damage (at least 1 each). */
  private shareHunting(m: Monster) {
    const total = [...m.hurtBy.values()].reduce((a, b) => a + b, 0);
    if (total > 0) {
      const xp = huntingXp(m.kind);
      m.hurtBy.forEach((dmg, sid) => {
        const hunter = this.state.players.get(sid);
        if (!hunter) return;
        this.addSkillXp(hunter, this.clients.getById(sid), "hunting", Math.max(1, Math.round(xp * dmg / total)));
        this.saveSoon(hunter);
      });
    }
    m.hurtBy.clear();
  }

  /** A night-only monster at sunrise: it flies off (no drops), and comes back after dark. */
  private sendAway(m: Monster) {
    m.alive = false;
    m.target = null;
    m.status = "";
    m.hp = m.maxHp;
    m.hurtBy.clear();
    m.trappedUntil = 0;
    m.trappedBy = null;
    m.respawnAt = this.state.tick;
    this.state.players.forEach((other) => { if (other.fighting && this.state.monsters.get(other.fighting) === m) this.stopActions(other); });
  }

  /** Monsters: come back after being defeated, wander near home, chase and attack. */
  private monsterTick(tick: number) {
    const night = isNight(worldNow());
    this.state.monsters.forEach((m, id) => {
      const def = MONSTERS[m.kind];
      if (def.night && !night) {
        if (m.alive) this.sendAway(m);
        return;
      }
      if (!m.alive) {
        if (tick < m.respawnAt) return;
        m.hurtBy.clear();
        m.hitWith.clear();
        m.alive = true;
        m.hp = m.maxHp;
        m.x = m.homeX;
        m.y = m.homeY;
        m.sleepUntil = m.frozenUntil = 0;
        m.attackTimer = 0;
        m.poison = null;
        return;
      }
      if (m.trappedUntil && m.trappedUntil <= tick) { m.trappedUntil = 0; m.trappedBy = null; }
      if (m.poison && tick % 3 === 0) {
        const { damage, by } = m.poison;
        if (--m.poison.left <= 0) m.poison = null;
        const pl = this.state.players.get(by);
        m.hurtBy.set(by, (m.hurtBy.get(by) ?? 0) + Math.min(damage, m.hp));
        m.hp = Math.max(0, m.hp - damage);
        this.broadcast("hit", { on: "monster", id, damage, miss: false, spell: "poison", from: by });
        if (m.hp <= 0) {
          m.poison = null;
          if (pl) this.killMonster(m, pl, this.clients.getById(by), "magic");
          else { m.alive = false; m.target = null; m.respawnAt = tick + def.respawnTicks; }
          return;
        }
      }
      if (m.sleepUntil > tick) { m.status = "asleep"; return; }
      const frozen = m.frozenUntil > tick;
      const home = { x: m.homeX, y: m.homeY };
      const danger = isDanger(home.x, home.y);
      // Give up on someone who left, ran out of its patch, or is lying on the ground.
      let target = m.target ? this.state.players.get(m.target) : undefined;
      if (m.target && (!target || target.invisible || isDanger(target.x, target.y) !== danger || tileDistance(target, home) > LEASH_RADIUS + 1)) {
        m.target = null;
        target = undefined;
      }
      // Danger zone monsters attack anyone who comes close.
      if (!target && def.aggressive) {
        let best = AGGRO_RADIUS + 1;
        this.state.players.forEach((pl, sid) => {
          const d = tileDistance(pl, m);
          if (d < best && !pl.invisible && isDanger(pl.x, pl.y) && tileDistance(pl, home) <= LEASH_RADIUS && areaAt(pl.x, pl.y) === areaAt(home.x, home.y)) { best = d; m.target = sid; target = pl; }
        });
      }
      // Packs: when one goes for you, the rest of the pack nearby joins in.
      if (target && def.pack) {
        this.state.monsters.forEach((o) => {
          if (o !== m && o.alive && o.kind === m.kind && !o.target && tileDistance(o, m) <= 4) o.target = m.target;
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
      if (!isWalkable(n.x, n.y) || doorAt(n.x, n.y) || isDanger(n.x, n.y) !== danger || tileDistance(n, home) > LEASH_RADIUS) continue;
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
    const chance = monsterHitChance(m.kind, levelForXp(p.skillXp.defense), armorPoints(p.gear) + jewelTotals(p.jewels).armor, this.tree(p, "defense", "dodge"));
    const hit = Math.random() < chance;
    let damage = hit ? 1 + Math.floor(Math.random() * def.maxHit) : 0;
    const ward = p.buffs.ward;
    if (damage && ward && ward.until > worldNow()) {
      const soaked = Math.min(ward.power, damage);
      damage -= soaked;
      ward.power -= soaked;
      if (ward.power <= 0) {
        delete p.buffs.ward;
        if (client) this.say(client, "🛡️ Your ward breaks!");
      }
      if (client) this.sendBuffs(client, p);
    }
    const armor = this.armorItems(p);
    if (damage) {
      const guard = Math.min(GUARD_CAP, guardPercent(enchantTotal(armor, "guard")));
      if (guard) damage = Math.max(1, Math.round(damage * (1 - guard / 100)));
    }
    p.hp = Math.max(0, p.hp - damage);
    p.dirty = true;
    this.broadcast("hit", { on: "player", id: sessionId, damage, miss: !hit, from: monsterId });
    const thorns = hit ? thornsDamage(enchantTotal(armor, "thorns")) : 0;
    if (thorns && enchantTotal(armor, "thorns") > 0) {
      m.hurtBy.set(sessionId, (m.hurtBy.get(sessionId) ?? 0) + Math.min(thorns, m.hp));
      m.hp = Math.max(0, m.hp - thorns);
      this.broadcast("hit", { on: "monster", id: monsterId, damage: thorns, miss: false, spell: null, from: sessionId });
      if (m.hp <= 0) { this.killMonster(m, p, client, "melee"); return; }
    }
    // Armor wears down: one piece you're wearing takes the blow.
    const worn = GEAR_SLOTS.filter((s) => s !== "weapon" && p.gear[s]);
    if (worn.length) this.wearGear(p, client, worn[Math.floor(Math.random() * worn.length)], wearFor(def.level));
    const xp = defenseXp(m.kind);
    this.addSkillXp(p, client, "defense", xp);
    if (p.hp <= 0) return this.die(p, sessionId, def.name);
    // Fight back automatically if you were just standing there.
    if (!p.fighting && !p.path.length && !p.walkDir && !p.target && !p.crafting && !this.fightBlock(p)) {
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

  /** Out of health: you wake up at the Heart Shrine (in the Emberhall) with half your health, and keep everything. */
  private die(p: Player, sessionId: string, killer: string) {
    const client = this.clients.getById(sessionId);
    this.stopActions(p);
    p.path = [];
    p.hp = Math.ceil(p.maxHp / 2);
    this.state.monsters.forEach((m) => { if (m.target === sessionId) m.target = null; });
    const shrine = this.respawnShrine(p);
    const spot = spotNear(shrine.at);
    p.x = spot.x;
    p.y = spot.y;
    p.dirty = true;
    // Ember Debt: after the Oath, the shrine takes a tithe for raising you.
    const marked = oathSworn(p.quest) && p.tithe < TITHE_MAX;
    if (marked) p.tithe++;
    if (client) {
      this.say(client, `☠ The ${killer.toLowerCase()} knocked you out! You wake up at ${shrine.name} with half your health. You kept all your things.`);
      if (marked) this.say(client, `⛓️ A gold Tithe mark appears by your health bar (${p.tithe} of ${TITHE_MAX}). While you carry it, a fifth of your XP goes to the shrine, until the mark fades.`);
      else if (oathSworn(p.quest)) this.say(client, `⛓️ You already carry ${TITHE_MAX} Tithe marks: the most there can be.`);
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
  /** Spells this player knows right now. */
  private known(p: Player): SpellId[] {
    return isUnlocked(p.unlocked, "magic") ? knownSpells(levelForXp(p.skillXp.magic), p.books) : [];
  }

  /** The spell bar, the spells you know, and how many slots you have. */
  private sendSpellbook(client: Client, p: Player) {
    const slots = barSlots(p.combatMastery);
    // A new or old save with no bar yet: fill it once you know a spell (Rowan teaches Firebolt).
    if (p.barFresh && this.known(p).length) {
      p.barFresh = false;
      p.spellBar = [];
      for (const id of this.known(p)) this.addToBar(p, id);
    }
    while (p.spellBar.length < slots) p.spellBar.push(null);
    client.send("spellbook", { bar: p.spellBar.slice(0, slots), known: this.known(p), books: p.books, bolt: p.spell });
  }

  /** Put a newly learned spell in the first empty slot. False if the bar is full. */
  private addToBar(p: Player, id: SpellId): boolean {
    if (p.spellBar.includes(id)) return true;
    const slots = barSlots(p.combatMastery);
    while (p.spellBar.length < slots) p.spellBar.push(null);
    const i = p.spellBar.findIndex((s, n) => s === null && n < slots);
    if (i < 0) return false;
    p.spellBar[i] = id;
    p.dirty = true;
    return true;
  }

  /** Pick which bolt your staff fires. */
  private pickBolt(client: Client, p: Player, id: BoltSpellId) {
    const level = levelForXp(p.skillXp.magic);
    if (level < SPELLS[id].level) return this.say(client, `You need Spellcasting level ${SPELLS[id].level} to cast ${SPELLS[id].name}. (You're level ${level}.)`);
    p.spell = id;
    const mana = spellMana(id, combatMasteryIn(p.combatMastery, id));
    const staff = attackFor(p.gear, id).style === "magic";
    this.say(client, staff ? `Your staff will cast ${SPELLS[id].icon} ${SPELLS[id].name} (${mana} mana). Click a monster to fire it.`
      : `${SPELLS[id].icon} ${SPELLS[id].name} flies from a staff. Hold one (Huntmaster Kael sells them), then click a monster.`);
    this.sendGear(client, p);
    this.sendSpellbook(client, p);
    p.dirty = true;
  }

  /** Invisibility breaks when you attack or gather. */
  private breakInvisible(p: Player, client: Client | undefined, why: "attack" | "gather") {
    if (!p.buffs.invisible) return;
    delete p.buffs.invisible;
    p.invisible = false;
    p.dirty = true;
    if (client) {
      this.say(client, `🫥 You ${why === "attack" ? "attack" : "get to work"}, and your invisibility breaks.`);
      this.sendBuffs(client, p);
    }
  }

  /** Cast a spell from the spell bar. */
  private castSpell(client: Client, p: Player, id: SpellId, sessionId: string) {
    const d = SPELLS[id];
    if (!isUnlocked(p.unlocked, "magic")) return this.say(client, this.notTaught("magic"));
    if (!this.known(p).includes(id)) {
      return this.say(client, d.book ? `You haven't learned ${d.name}. It comes from a spell book.` : `You need Spellcasting level ${d.level} to cast ${d.name}.`);
    }
    if (isBoltSpell(id)) return this.pickBolt(client, p, id);
    const now = Date.now();
    if (now < p.castReadyAt) return;
    const level = levelForXp(p.skillXp.magic);
    const mastery = combatMasteryIn(p.combatMastery, id);
    const mana = spellMana(id, mastery);
    if (p.mana < mana) return this.say(client, `You need ${mana} mana for ${d.name}, and you have ${p.mana}. It comes back 1 every 6 seconds.`);
    const world = worldNow();
    let xp = Math.ceil(mana / 2);
    let msg: string;
    if (id === "ward") {
      const power = spellPower(id, level, mastery);
      p.buffs.ward = { until: world + spellSeconds(id, mastery) * 1000, power };
      msg = `🛡️ A ward shimmers around you. It soaks up ${power} damage.`;
    } else if (id === "heal") {
      if (p.hp >= p.maxHp) return this.say(client, `You're already at full health (${p.maxHp}).`);
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + spellPower(id, level, mastery));
      msg = `💚 You heal ${p.hp - before} (${p.hp}/${p.maxHp}).`;
    } else if (id === "mend") {
      const problem = this.mend(client, p);
      if (problem) return this.say(client, problem);
      msg = "🪡 Threads of light knit your gear back together: good as new.";
    } else if (id === "haste") {
      const power = spellPower(id, level, mastery);
      p.buffs.haste = { until: world + spellSeconds(id, mastery) * 1000, power };
      msg = `💨 You feel light on your feet: ${power}% faster for ${spellSeconds(id, mastery)} seconds.`;
    } else if (id === "invisibility") {
      p.buffs.invisible = { until: world + spellSeconds(id, mastery) * 1000, power: 1 };
      p.invisible = true;
      this.stopActions(p);
      this.state.monsters.forEach((m) => { if (m.target === sessionId) m.target = null; });
      msg = `🫥 You fade from sight for ${spellSeconds(id, mastery)} seconds. Attacking or gathering breaks it.`;
    } else if (id === "soul_trap") {
      const m = this.trapTarget(p);
      if (!m) return this.say(client, `No monster close enough for ${d.name}. Stand within ${TARGET_RANGE} tiles of one (or attack it first).`);
      this.breakInvisible(p, client, "attack");
      const secs = spellSeconds(id, mastery, buffPower(p.buffs, "soultrap", world));
      m.trappedUntil = this.state.tick + Math.round(secs * 1000 / TICK_MS);
      m.trappedBy = sessionId;
      const gem = p.inventory.some((it) => isSoulGem(it) && (parseGem(it) as { souls: number; size: number }).souls < soulCapacity((parseGem(it) as { size: number }).size));
      msg = `👻 The ${MONSTERS[m.kind].name.toLowerCase()} glows purple: its ember is trapped for ${secs} seconds. Defeat it in time!` +
        (gem ? "" : " (You have no refined emberstone with room, so its ember would be lost. Brann cuts emberstone into refined emberstones.)");
    } else {
      // Frost nova: every monster next to you.
      const max = novaMaxHit(level, mastery);
      const hitList: Monster[] = [];
      this.state.monsters.forEach((m) => { if (m.alive && tileDistance(m, p) <= NOVA_RADIUS) hitList.push(m); });
      if (!hitList.length) return this.say(client, `No monsters within ${NOVA_RADIUS} tiles for ${d.name}.`);
      this.breakInvisible(p, client, "attack");
      let total = 0;
      for (const m of hitList) {
        const id2 = [...this.state.monsters.entries()].find(([, o]) => o === m)![0];
        const damage = 1 + Math.floor(Math.random() * max);
        m.hurtBy.set(sessionId, (m.hurtBy.get(sessionId) ?? 0) + Math.min(damage, m.hp));
        m.hp = Math.max(0, m.hp - damage);
        m.frozenUntil = this.state.tick + (d.freeze ?? 0);
        total += damage;
        this.broadcast("hit", { on: "monster", id: id2, damage, miss: false, spell: "frost_nova", from: sessionId });
        if (MONSTERS[m.kind].maxHit > 0 && !m.target) m.target = sessionId;
        if (m.hp <= 0) this.killMonster(m, p, client, "magic");
      }
      xp += total;
      msg = `🌨️ Ice bursts around you, hitting ${hitList.length} monster${hitList.length === 1 ? "" : "s"} for ${total} in all. They're frozen!`;
    }
    if (!treeRoll(p.tree, "magic", "manaSave")) p.mana -= mana;
    p.castReadyAt = now + 1500;
    p.stepMs = this.stepMsOf(p);
    p.dirty = true;
    this.say(client, msg);
    this.addSkillXp(p, client, "magic", xp);
    this.addCombatMastery(p, client, id, xp);
    this.sendVitals(client, p);
    this.sendBuffs(client, p);
    this.saveSoon(p);
  }

  /** The staff enchantment on the staff in your hand, if any. */
  private staffEnchant(p: Player) {
    const item = p.gear.weapon?.item;
    return enchantsOf(item).find((e) => ENCHANTS[e.id].on === "staff") ?? null;
  }

  /** What an enchanted staff's bolt does when it lands. */
  private staffEffect(p: Player, client: Client | undefined, sessionId: string, m: Monster, e: { id: EnchantId; gem: number }, damage: number) {
    const ct = e.gem / 10;
    if (e.id === "frost") m.frozenUntil = Math.max(m.frozenUntil, this.state.tick + frostTicks(ct));
    if (e.id === "poison") m.poison = { left: 4, damage: poisonDamage(ct), by: sessionId };
    if (e.id === "lifesteal" && damage) {
      const heal = Math.round(damage * lifeStealPercent(ct) / 100);
      if (heal && p.hp < p.maxHp) { p.hp = Math.min(p.maxHp, p.hp + heal); if (client) this.sendVitals(client, p); }
    }
    if (e.id === "lightning" && damage) {
      let other: Monster | null = null;
      let otherId = "";
      this.state.monsters.forEach((o, oid) => { if (!other && o !== m && o.alive && tileDistance(o, m) <= 3) { other = o; otherId = oid; } });
      const o = other as Monster | null;
      if (o) {
        const jump = Math.max(1, Math.round(damage * chainPercent(ct) / 100));
        o.hurtBy.set(sessionId, (o.hurtBy.get(sessionId) ?? 0) + Math.min(jump, o.hp));
        o.hp = Math.max(0, o.hp - jump);
        this.broadcast("hit", { on: "monster", id: otherId, damage: jump, miss: false, spell: "lightning", from: sessionId });
        if (MONSTERS[o.kind].maxHit > 0 && !o.target) o.target = sessionId;
        if (o.hp <= 0) this.killMonster(o, p, client, "magic");
      }
    }
  }

  /** How many enchantments an item may hold: 1, or 2 with the tree's Second slot. */
  private enchantSlots(p: Player) {
    return 1 + this.tree(p, "enchanting", "enchantSlot");
  }

  /** At the altar: put an enchantment on a bag item, using up a refined emberstone (and a cut gem and inlay for a staff). */
  private enchant(client: Client, p: Player, msg: { slot: number; soul: number; effect?: string; gem?: number; inlay?: string }) {
    if (!this.nearNpc(p, "altar")) return this.say(client, "You need to be at the enchanting altar in the Mages' Guild.");
    if (!isUnlocked(p.unlocked, "enchanting")) return this.say(client, this.notTaught("enchanting"));
    const item = p.inventory[msg.slot];
    const kind = enchantKind(item);
    if (!item || !kind) return this.say(client, "Only a staff, a piece of armor or a tool can be enchanted.");
    if (p.locked[msg.slot]) return this.say(client, "That's locked. Unlock it first.");
    const soulItem = p.inventory[msg.soul];
    const soul = parseGem(soulItem);
    if (!soulItem || soul?.kind !== "soulgem" || soul.souls <= 0) return this.say(client, "Pick a refined emberstone with ember in it. Cast 👻 Ember trap on a monster, then defeat it, to fill one.");
    // Which enchantment: a staff's comes from its gem; armor and tools pick one.
    let effect: EnchantId;
    let gemSize = 0;
    let inlay: Inlay = "none";
    if (kind === "staff") {
      const gemItem = msg.gem != null ? p.inventory[msg.gem] : null;
      const g = parseGem(gemItem);
      if (!gemItem || g?.kind !== "cut") return this.say(client, "A staff needs a cut gem too: ruby (fire), sapphire (frost), emerald (poison), topaz (lightning) or amethyst (life steal).");
      effect = enchantForGem(g.gem);
      if (msg.inlay === "silver_bar" || msg.inlay === "gold_bar") {
        if (!p.inventory.some((it, i) => it === msg.inlay && !p.locked[i])) return this.say(client, `You don't have a ${ITEMS[msg.inlay as ItemId].single} for the inlay.`);
        inlay = msg.inlay;
      }
      gemSize = cappedGem(g.size, inlay);
    } else {
      if (!msg.effect || !isEnchantId(msg.effect) || !fits(item, msg.effect)) return this.say(client, "That enchantment doesn't fit that item.");
      effect = msg.effect;
    }
    const current = enchantsOf(item);
    if (current.some((e) => e.id === effect)) return this.say(client, `It already has ${ENCHANTS[effect].name}. Take it off first.`);
    if (current.length >= this.enchantSlots(p)) {
      return this.say(client, current.length === 1 && this.enchantSlots(p) === 1
        ? "It already holds an enchantment. Take it off first (the old one is lost), or learn Second slot in the Enchanting tree."
        : "It can't hold any more enchantments.");
    }
    if (isSpent(item) && !current.length && !this.tree(p, "enchanting", "reenchant")) {
      return this.say(client, "This one had an enchantment taken off, and the magic won't take again. Re-enchant in the Enchanting tree lets you.");
    }
    const level = levelForXp(p.skillXp.enchanting);
    const power = soulPower(soul.souls, level, this.tree(p, "enchanting", "potency"));
    const out = addEnchant(item, { id: effect, power, gem: gemSize });
    // Use up the refined emberstone, the cut gem and the inlay (highest entries first, so slots don't shift under us).
    const gemSlot = kind === "staff" ? msg.gem! : -1;
    p.inventory[msg.slot] = out as ItemId;
    for (const e of [msg.soul, gemSlot].filter((x) => x >= 0).sort((a, b) => b - a)) takeFromEntry(p, e, 1);
    if (inlay !== "none") takeItem(p, inlay as ItemId, 1, (e) => !p.locked[e]);
    const desc = describeEnchant({ id: effect, power, gem: gemSize });
    this.say(client, `✨ The altar flares. Your ${ITEMS[baseItem(item) as ItemId].single} is enchanted with ${desc}.`);
    this.addSkillXp(p, client, "enchanting", 10 + Math.ceil(soul.souls / 2));
    this.sendInventory(client, p);
    this.questEvent(p, client, { kind: "enchant" });
    this.guildJob(p, client, "enchant");
    this.saveSoon(p);
  }

  /** Take every enchantment off a bag item. The magic is lost. */
  private disenchant(client: Client, p: Player, slot: number) {
    if (!this.nearNpc(p, "altar")) return this.say(client, "You need to be at the enchanting altar in the Mages' Guild.");
    const item = p.inventory[slot];
    if (!item || !enchantsOf(item).length) return;
    p.inventory[slot] = stripEnchants(item) as ItemId;
    this.say(client, `The enchantment on your ${ITEMS[baseItem(item) as ItemId].single} fades away. Its magic (and its refined emberstone) are gone.`);
    this.sendInventory(client, p);
    this.saveSoon(p);
  }

  /** Mend: fix your most worn tool, weapon or armor piece, using 1 of what it's made of. */
  private mend(client: Client, p: Player): string | null {
    type Worn = { where: "belt" | "gear"; key: string; item: ItemId; left: number; max: number };
    const worn: Worn[] = [];
    for (const t of TOOL_TYPE_IDS) { const b = p.belt[t]; if (b) worn.push({ where: "belt", key: t, item: b.item, left: b.durability, max: maxDurability(b.item) }); }
    for (const sl of GEAR_SLOTS) { const g = p.gear[sl]; if (g) worn.push({ where: "gear", key: sl, item: g.item, left: g.durability, max: gearDurability(g.item) }); }
    const target = worn.filter((w) => w.left < w.max).sort((a, b) => a.left / a.max - b.left / b.max)[0];
    if (!target) return "Nothing you're using is worn. (Mend fixes tools on your belt and gear you're wearing.)";
    // What it's made of: its metal's bar, or (for a fishing rod, or a wooden bow or staff) a log of its wood.
    let material: ItemId;
    if (isTool(target.item)) {
      const t = parseTool(target.item);
      material = isWoodTool(t.type) ? `${t.wood!}_logs` as ItemId : barId(t.metal as Metal);
    } else if (isWeapon(target.item)) {
      const w = parseWeapon(target.item);
      material = w.metal === "stone" ? `${w.wood}_logs` as ItemId : barId(w.metal as Metal);
    } else {
      const m = parseArmor(target.item as never).metal;
      material = m === "leather" || m === "cloth" ? m : barId(m);
    }
    if (!p.inventory.some((it, i) => it === material && !p.locked[i])) {
      return `Mend needs 1 ${ITEMS[material].single} to fix your ${ITEMS[baseItem(target.item) as ItemId].single}.`;
    }
    takeItem(p, material, 1, (e) => !p.locked[e]);
    if (target.where === "belt") p.belt[target.key as ToolType]!.durability = target.max;
    else p.gear[target.key as GearSlot]!.durability = target.max;
    this.sendInventory(client, p);
    if (target.where === "belt") client.send("belt", p.belt); else this.sendGear(client, p);
    return null;
  }

  /** Ember trap's target: the monster you're fighting, or the closest one in reach. */
  private trapTarget(p: Player): Monster | null {
    const fighting = p.fighting ? this.state.monsters.get(p.fighting) : undefined;
    if (fighting?.alive && tileDistance(fighting, p) <= TARGET_RANGE) return fighting;
    let best: Monster | null = null;
    let bestD = TARGET_RANGE + 1;
    this.state.monsters.forEach((m) => {
      const dist = tileDistance(m, p);
      if (m.alive && dist < bestD) { best = m; bestD = dist; }
    });
    return best;
  }

  /**
   * A trapped monster died: its ember goes into the caster's best refined emberstone with
   * room. That's the smallest gem it fits in whole; if none can take it all,
   * the gem with the most room (which fills up, and the rest is lost).
   */
  private fillSoulGem(m: Monster) {
    const sid = m.trappedBy!;
    const p = this.state.players.get(sid);
    if (!p) return;
    const client = this.clients.getById(sid);
    const souls = soulsOf(m.kind);
    let best = -1, bestRoom = 0, fitsWhole = false;
    p.inventory.forEach((it, i) => {
      if (!isSoulGem(it)) return;
      const g = parseGem(it) as { size: number; souls: number };
      const room = soulCapacity(g.size) - g.souls;
      if (room <= 0) return;
      const whole = room >= souls;
      if (best < 0 || (whole && (!fitsWhole || room < bestRoom)) || (!whole && !fitsWhole && room > bestRoom)) {
        best = i; bestRoom = room; fitsWhole = whole;
      }
    });
    const name = MONSTERS[m.kind].name.toLowerCase();
    if (best < 0) {
      if (client) this.say(client, `👻 The ${name}'s ember drifts away: you have no refined emberstone with room for it.`);
      return;
    }
    const g = parseGem(p.inventory[best]) as { size: number; souls: number };
    const filled = soulGemId(g.size, Math.min(soulCapacity(g.size), g.souls + souls));
    takeFromEntry(p, best, 1);
    this.give(p, filled, 1, null, true);
    const pct = Math.floor((Math.min(soulCapacity(g.size), g.souls + souls) / soulCapacity(g.size)) * 100);
    if (client) {
      this.say(client, `👻 The ${name}'s ember flows into your refined emberstone (${carats(g.size)}): ${pct >= 100 ? "it's full! ✨" : `${pct}% full.`}`);
      this.sendInventory(client, p);
    }
    this.guildJob(p, client ?? undefined, "trap");
    p.dirty = true;
  }

  private addCombatMastery(p: Player, client: Client | undefined, id: CombatMasteryId, xp: number) {
    const before = combatMasteryIn(p.combatMastery, id);
    p.combatMastery[id] = (p.combatMastery[id] ?? 0) + xp;
    const after = combatMasteryIn(p.combatMastery, id);
    if (!client) return;
    client.send("combatmastery", p.combatMastery);
    if (after <= before) return;
    const spell = id in SPELLS && !isBoltSpell(id);
    this.say(client, `${combatMasteryName(id)} Mastery ${after}! ` + (id in MONSTERS ? "You hit it more often, and it drops things more often."
      : spell ? "It costs a little less mana, and it's a little stronger." : "You hit more often, and a little harder."));
    client.send("combatmasteryup", { id, level: after });
    if (id in SPELLS) {
      if (before < 10 && after >= 10 && barSlots(p.combatMastery) > p.spellBar.length) this.say(client, `✨ Your spell bar grows to ${barSlots(p.combatMastery)} slots!`);
      this.sendSpellbook(client, p);
    }
  }

  /** Health, mana and their maximums (only you see your mana). */
  private sendVitals(client: Client, p: Player) {
    client.send("vitals", { hp: p.hp, maxHp: p.maxHp, mana: p.mana, maxMana: this.maxManaOf(p) });
  }

  /** Rings or amulet changed: new stats, and tell the client. */
  /** Armor went on or off: max health may change (Vitality). New health starts empty, like a ring's. */
  private gearStatsChanged(client: Client, p: Player) {
    // Vitality armor changes max health; cloth changes max mana.
    p.maxHp = this.maxHpOf(p);
    p.hp = Math.min(p.hp, p.maxHp);
    p.mana = Math.min(p.mana, this.maxManaOf(p));
    this.sendVitals(client, p);
  }

  private jewelsChanged(client: Client, p: Player) {
    // Extra max health or stamina from a jewel starts empty and fills up over
    // time, so taking a ring off and on again can't heal you.
    const hp = p.hp, stamina = p.stamina;
    this.refreshStats(p, client);
    p.hp = Math.min(hp, p.maxHp);
    p.stamina = Math.min(stamina, p.maxStamina);
    client.send("jewels", p.jewels);
    this.sendInventory(client, p);
    this.sendVitals(client, p);
    this.sendStamina(client, p);
    this.saveSoon(p);
  }

  private sendGear(client: Client, p: Player) {
    p.held = p.gear.weapon?.item ?? "";
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
      if ((!g.skill || ev.skill === g.skill) && (!g.resource || ev.resource === g.resource) && (!g.withTool || ev.withTool) && (!g.byHand || !ev.withTool)) counts = 1;
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
    } else if (g.kind === "enchant" && ev.kind === "enchant") {
      counts = 1;
    } else if (g.kind === "track" && ev.kind === "track") {
      counts = 1;
    } else if (g.kind === "bounty" && ev.kind === "bounty") {
      counts = 1;
    } else if (g.kind === "harvest" && ev.kind === "harvest") {
      if (g.unblessed && buffPower(p.buffs, "blessed", worldNow()) > 0) {
        if (client) this.say(client, `${this.giverName(p)} said no blessings! That one doesn't count. Wait for your ✨ blessing to run out.`);
      } else counts = 1;
    } else if ((g.kind === "plot" || g.kind === "plant") && ev.kind === g.kind) {
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
    if (g.kind === "plot") return !!this.plotOf(p);
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
    prog.got = []; // a fresh list for the next step (the last step's people don't count twice)
    p.dirty = true;
    this.leadStep(p);
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
    else {
      // A story chapter that's just opened: say who to see next.
      const next = CHAPTERS.find((c) => (c.act || c.id === "maren") && !p.quest.ch[c.id] && chapterOpen(p.quest, c.id) && gateMet(c, this.levelOf(p)));
      if (next) this.say(client, `📜 Next: ${next.title}. Talk to ${next.name}, ${next.where}.`);
      else if (!tutorialDone(p.quest)) this.say(client, "📜 Next: talk to anyone with a ❗ for your next lesson (the 📜 Quests tab lists them all).");
    }
    this.sendQuest(client, p);
  }

  /** The tutorial makes some crafting turn out a set way: every stew burns until Maren explains it, and some tries always work. */
  private forcedCraft(p: Player, recipe: Recipe): "fail" | "success" | null {
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
    const q = p.quest;
    let chapter: Chapter | null = chapterOf(npc.id, q, this.levelOf(p));
    // A side quest that needs a level you don't have yet (e.g. Renown 10): not offered yet.
    if (chapter && !q.ch[chapter.id] && !gateMet(chapter, this.levelOf(p))) {
      if (chapter.side && chapter.requires) this.say(client, `${chapter.name}: Come back when you're better known (${skillInfo(chapter.requires.skill).def.name} ${chapter.requires.level}). I might have a job for you then.`);
      chapter = null;
    }
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
      if (chapter.act) {
        if (npc.id === "maren") return false;
        this.say(client, `${chapter.name}: ${npc.kind === "person" ? "I'll have something more for you later." : ""} (📜 ${chapter.title}: ${opensAfter(q, chapter.id).toLowerCase()}.)`);
        return false;
      }
      this.say(client, `${chapter.name}: Come and see me for a lesson once ${GUIDE_NAME} has shown you the basics. She lives in the cottage on the lake shore, west along the road.`);
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
    // A talk step with someone else (deliver the totem to Aldric...): point the way.
    if (step.goal.kind === "talk" && talkWith(chapter, step) !== npc.id) {
      this.dialog(client, [step.task + "."], chapter.name);
      return true;
    }
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
    return this.doTalk(client, p, chapter, step, npc);
  }

  /** Do a talk step: they say their piece, take what they need, and hand over the rewards. */
  private doTalk(client: Client, p: Player, chapter: Chapter, step: QuestStep, npc: NpcDef): boolean {
    const speaker = npc.kind === "person" ? npc.name : chapter.name;
    if (step.need && !p.inventory.some((it) => it?.startsWith(step.need!.prefix))) {
      this.dialog(client, [step.need.line], speaker);
      return true;
    }
    const take = Object.entries(step.take ?? {}) as [ItemId, number][];
    const short = take.filter(([item, n]) => this.countOf(p, item) < n);
    if (short.length) {
      this.dialog(client, [`You still need ${short.map(([item, n]) => `${n - this.countOf(p, item)} more ${n - this.countOf(p, item) === 1 ? ITEMS[item].single : plural(ITEMS[item].name)}`).join(" and ")}.`], speaker);
      return true;
    }
    const gifts = giftItems(step.give);
    if (!roomForAll(p, gifts.map((g) => g.item))) {
      this.dialog(client, [`I've got ${gifts.length === 1 ? "something" : `${gifts.length} things`} for you, but your bag is too full. Make some room and come back.`], chapter.name);
      return true;
    }
    for (const [item, n] of take) takeItem(p, item, n);
    for (const g of gifts) this.give(p, g.item, 1, g.durability, true); // gifts never count against weight, so the lessons can't get stuck
    if (step.coins) p.coins += step.coins;
    // What they hand over goes at the end of what they say, so it's clear what you got and where it went.
    const lines = [...(step.lines ?? [])];
    if (gifts.length || step.coins) {
      const names = [...new Set(gifts.map((g) => g.item))].map((item) => {
        const n = gifts.filter((g) => g.item === item).length;
        if (n === 1) return aOr(ITEMS[item].single);
        return `${n} ${plural(ITEMS[item].name)}`;
      });
      if (step.coins) names.push(`${formatMoney(step.coins)} coins`);
      const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
      const where = gifts.length && step.coins ? "They're in your 🎒 bag (coins at the bottom)." : gifts.length ? "Look in your 🎒 bag." : "Coins show at the bottom of your 🎒 bag.";
      lines.push(`🎁 ${speaker} gives you ${list}. ${where}`);
      this.say(client, `🎁 ${speaker} gives you ${list}.`);
      if (step.coins) client.send("reward", { text: `+${formatMoney(step.coins)}` });
    }
    this.dialog(client, lines, speaker);
    if (take.length) this.say(client, `You hand over ${take.map(([item, n]) => (n === 1 ? aOr(ITEMS[item].single) : `${n} ${plural(ITEMS[item].name)}`)).join(" and ")}.`);
    for (const [skill, xp] of Object.entries(step.xp ?? {}) as [SkillId, number][]) this.addSkillXp(p, client, skill, xp);
    // Alchemist Moss tells you the Tithe tonic's secret recipe.
    if (chapter.id === "tonics" && !p.discovered.includes("tithe")) {
      p.discovered.push("tithe");
      this.say(client, "⚗️ You learn a secret recipe: Tithe tonic (red cap + wild root). It's in your list at the alchemy table.");
      client.send("discovered", p.discovered);
    }
    if (step.bless) this.bless(client, p);
    if (step.warden) this.giveWarden(client, p);
    if (step.opensGate) this.say(client, "🚪 The gate to the Dark Forest is open to you now. It's just south of Kael's lodge on the south road, past the ⚠ signs.");
    if (step.opensBoard) this.say(client, "📋 The bounty board is open to you now. Its jobs are in the 📜 Quests tab too.");
    this.advance(p, client);
    if (step.rank) this.updateRank(client, p);
    if (step.opensBoard) { this.fillBoard(p); this.sendBounties(client, p); }
    // Hand over anything the next step needs that you don't have (e.g. a minnow to cook).
    const extra = this.giveMissing(p, this.step(p)?.ensure);
    if (extra) this.say(client, `${chapter.name} also gives you ${extra}.`);
    this.sendInventory(client, p);
    this.saveSoon(p);
    return true;
  }

  // ---- The story (shared/story.ts) ----

  /** Read or use a story item: a blessing scroll, a note, Maren's charm. */
  private readStory(client: Client, p: Player, slot: number, item: ItemId) {
    const name = STORY_ITEMS[item as keyof typeof STORY_ITEMS].name;
    if (item === "blessing_scroll") {
      takeFromEntry(p, slot, 1);
      this.say(client, "📜 You read the blessing aloud, and warm light settles on you.");
      this.bless(client, p);
      this.sendInventory(client, p);
      return this.saveSoon(p);
    }
    const flame = rankOf(p.quest) >= 2;
    const text: Partial<Record<string, string[]>> = {
      rooks_note: flame ? ["You break the wax. Inside, in Rook's careful carving-hand:", "\"Ask Maren about the first one.\""]
        : ["You promised Rook you wouldn't read it. Maybe later, once you're a proper Flame of the Emberhall."],
      ashbound_note: ["Charcoal on rough paper, in a hurried hand:", "\"They aren't what they seem.\""],
      marens_charm: ["A little wooden flame, worn smooth. On the back, scratched very small: a single letter, M.", "It's warm, as if someone had only just let go of it."],
      holts_notes: ["Near shrines: 28 dead trees out of 35.", "Far from shrines: 2 dead trees out of 34.", "Underneath, Holt has written: \"Ashbound poison? Then why only near the shrines they DIDN'T smash?\""],
      lantern: ["Keeper Aldric's lantern. Nights are less dark while you carry it."],
      shrine_totem: ["Rook's oak totem, carved with the Emberhall's flame."],
    };
    this.dialog(client, text[item] ?? [STORY_ITEMS[item as keyof typeof STORY_ITEMS].description], name);
  }

  /**
   * Clicking someone (or something) the story needs: a visit step (light this
   * lantern, meet that Emberguard), or a talk step with someone who isn't the
   * chapter's giver (bring the totem to Aldric). Returns true if that's all the click does.
   */
  private storyClick(client: Client, p: Player, npc: NpcDef): boolean {
    const q = p.quest;
    const step = this.step(p);
    const prog = this.prog(p);
    if (step && prog && step.goal.kind === "visit" && step.goal.npcs.includes(npc.id)) {
      if (prog.got?.includes(npc.id)) return false;
      prog.got = [...(prog.got ?? []), npc.id];
      prog.count = prog.got.filter((id) => (step.goal as { npcs: string[] }).npcs.includes(id)).length;
      p.dirty = true;
      const lines = step.visitLines?.[npc.id];
      if (lines) this.dialog(client, lines, step.speaker ?? npc.name);
      if (prog.count >= step.goal.npcs.length) this.advance(p, client);
      else { this.say(client, `📜 ${prog.count} of ${step.goal.npcs.length} ${step.goal.names}.`); this.sendQuest(client, p); }
      this.saveSoon(p);
      return true;
    }
    // A talk step with this person in a chapter you've started (the active one first).
    const ids = [q.active, ...(Object.keys(q.ch) as ChapterId[])].filter((id): id is ChapterId => !!id && !chapterDone(q, id));
    for (const id of ids) {
      const c = chapterById(id);
      const st = c.steps[q.ch[id]!.step];
      if (!st || st.goal.kind !== "talk" || !st.who || st.who !== npc.id) continue;
      if (q.active !== id) {
        q.active = id;
        p.dirty = true;
        this.sendQuest(client, p);
      }
      return this.doTalk(client, p, c, st, npc);
    }
    return false;
  }

  /** What a story station looks like to you (lit or not). */
  private stationLook(p: Player, npc: NpcDef): string {
    const lit = litLanterns(p.quest).includes(npc.id);
    if (npc.id === "west_shrine") return lit ? "The rebuilt shrine glows gold. The grass round it is brown and dry." : npc.greeting;
    if (npc.id === "thorn_shrine") return lit ? "The Thornwood's first shrine burns gold. The trees nearest it look grey." : npc.greeting;
    return lit ? "The lantern burns bright and steady." : npc.greeting;
  }

  /** Walked somewhere a reach step wants you to go? */
  private checkReach(p: Player) {
    const step = this.step(p);
    const prog = this.prog(p);
    if (!step || !prog || step.goal.kind !== "reach") return;
    const spot = step.goal.spots.find((k) => !prog.got?.includes(k) && Math.max(Math.abs(PLACES[k].x - p.x), Math.abs(PLACES[k].y - p.y)) <= 2);
    if (!spot) return;
    prog.got = [...(prog.got ?? []), spot];
    prog.count = prog.got.length;
    p.dirty = true;
    const client = this.clientOf(p);
    if (client) this.say(client, `📍 ${step.spotLines?.[spot] ?? `You reach ${SPOT_NAMES[spot] ?? "the place"}.`}`);
    if (prog.count >= step.goal.spots.length) this.advance(p, client);
    else if (client) { this.say(client, `📜 ${prog.count} of ${step.goal.spots.length} ${step.goal.names}.`); this.sendQuest(client, p); }
  }

  private clientOf(p: Player): Client | undefined {
    return this.clients.find((c) => this.state.players.get(c.sessionId) === p);
  }

  /** An Emberguard blessing: more XP for a while. */
  private bless(client: Client, p: Player) {
    p.buffs.blessed = { until: worldNow() + BLESS_MINUTES * 60_000, power: BLESS_POWER };
    this.say(client, `✨ You're blessed: +${BLESS_POWER}% XP for ${BLESS_MINUTES} minutes.`);
    this.sendBuffs(client, p);
    p.dirty = true;
  }

  /** Kael's old Warden weapon: a sword, a bow or a staff, for however you fight best. */
  private giveWarden(client: Client, p: Player) {
    const lv = (sk: SkillId) => (isUnlocked(p.unlocked, sk) ? p.skillXp[sk] : -1);
    const best = (["melee", "ranged", "magic"] as SkillId[]).reduce((a, b) => (lv(b) > lv(a) ? b : a));
    const item = (best === "ranged" ? "bow_stone_maple" : best === "magic" ? "staff_iron_oak" : "sword_iron_oak") as ItemId;
    this.give(p, item, 1, null, true);
    this.say(client, `Huntmaster Kael gives you his old Warden's ${best === "ranged" ? "bow (a maple bow)" : best === "magic" ? "staff (iron and oak)" : "blade (an iron sword)"}.`);
  }

  /** Your Emberguard rank went up: a new cloak, and everyone sees it. */
  private updateRank(client: Client | undefined, p: Player) {
    const r = rankOf(p.quest);
    if (r === p.rank) return;
    p.rank = r;
    if (client) {
      this.say(client, `🔥 You are now ${r === 1 ? "an" : "a"} ${LIGHT_RANKS[r]} of the Emberhall!${r === 1 ? " (Your Ember cloak shows it.)" : " (Your cloak burns gold.)"}`);
      client.send("questDone", { quest: `Rank: ${LIGHT_RANKS[r]}` });
    }
  }

  /** The nearest shrine that can raise you: the Heart Shrine, or ones you've relit. */
  private respawnShrine(p: Player): { name: string; at: Point } {
    const lit = litLanterns(p.quest);
    // Where you fell, outdoors: inside somewhere counts as its front door.
    const area = areaAt(p.x, p.y);
    const door = area && area.kind !== "outdoor" ? DOORS.find((d) => d.area === area.id && areaAt(d.x, d.y)?.kind === "outdoor") : null;
    const from = door ?? p;
    const heart = DOORS.find((d) => d.area === "lighthall" && areaAt(d.x, d.y)?.kind === "outdoor")!;
    const choices: { name: string; at: Point; from: Point }[] = [{ name: "the Heart Shrine in the Emberhall", at: WAKE_SPOT, from: heart }];
    if (lit.includes("west_shrine")) choices.push({ name: "the Westroad shrine", at: PLACES.westShrine, from: PLACES.westShrine });
    if (lit.includes("thorn_shrine")) choices.push({ name: "the Thornwood shrine", at: PLACES.thornShrine, from: PLACES.thornShrine });
    const dist = (a: Point) => Math.hypot(a.x - from.x, a.y - from.y);
    const best = area && area.kind !== "outdoor" && !door ? choices[0] : choices.reduce((a, b) => (dist(b.from) < dist(a.from) ? b : a));
    return { name: best.name, at: best.at };
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
    const chapters = chapterViews(p.quest, this.levelOf(p));
    const prog = this.prog(p);
    const spots = step?.goal.kind === "reach"
      ? step.goal.spots.filter((k) => !prog?.got?.includes(k)).map((k) => ({ ...PLACES[k], label: SPOT_NAMES[k] ?? "" }))
      : undefined;
    const lessons = chapters.filter((c) => !c.act);
    const base = { number: lessons.filter((c) => c.state === "done").length, of: lessons.length, marks: questMarks(p.quest, this.levelOf(p)), chapters,
      spots, lit: litLanterns(p.quest), rank: rankOf(p.quest) };
    if (!step) {
      return tutorialDone(p.quest)
        ? { ...base, done: true, quest: "All lessons done", giver: "", task: "Tap 📜 Quests to track a bounty from the board.", talk: false }
        : { ...base, done: false, quest: "Pick your next lesson", giver: "", task: "Talk to anyone with a ❗ (the 📜 Quests tab says where they are)", talk: true };
    }
    const chapter = chapterById(p.quest.active!);
    const progNow = this.prog(p)!;
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
      progress = `${progNow.count} / ${g.count}`;
      fraction = progNow.count / g.count;
    }
    const need = this.questNeeds(p, g, progNow);
    const warning = step.needsTool && !p.belt[step.needsTool] ? `Put your ${TOOL_TYPES[step.needsTool].name.toLowerCase()} back on your belt first!`
      : this.fightBlock(p) ? (step.fightWith === "magic" ? "Hold your staff first!" : step.fightWith === "ranged" ? "Hold your sling first!" : "Hold a weapon first!") : undefined;
    return { ...base, done: false, quest: chapter.title, giver: chapter.name, task: step.task, progress, fraction, talk: g.kind === "talk", warning, need };
  }

  /** The quest tracker's picture checklist: one picture per thing the step needs, with how many you have. */
  private questNeeds(p: Player, g: QuestStep["goal"], prog: { count: number; got?: string[] }): QuestView["need"] {
    const item = (id: ItemId) => ({ icon: ITEMS[id].icon, tint: ITEMS[id].tint });
    const counted = (pic: { icon: string; tint?: string } | undefined) => pic && "count" in g ? [{ ...pic, have: Math.min(prog.count, g.count), want: g.count }] : undefined;
    switch (g.kind) {
      case "have":
        return (Object.entries(g.items) as [ItemId, number][]).map(([id, n]) => ({ ...item(id), have: Math.min(n, this.countOf(p, id)), want: n }));
      case "gather":
        if (g.resource) return counted(item(RESOURCES[g.resource].item));
        return counted(g.skill ? { icon: findSkill(g.skill).def.icon } : undefined);
      case "kill":
        return counted({ icon: g.monster ? MONSTERS[g.monster].icon : "⚔️" });
      case "craft": {
        const made = (Object.keys(ITEMS) as ItemId[]).find((id) => id.startsWith(g.prefix));
        return counted(made ? item(made) : { icon: findSkill(g.skill).def.icon });
      }
      case "sell": case "buy": return counted({ icon: "🪙" });
      case "plant": return counted({ icon: "🌱" });
      case "harvest": return counted({ icon: "🧺" });
      case "bounty": return counted({ icon: "📋" });
      case "visit": return [{ icon: "🏮", have: g.npcs.filter((n) => prog.got?.includes(n)).length, want: g.npcs.length }];
      case "reach": return [{ icon: "📍", have: g.spots.filter((k) => prog.got?.includes(k)).length, want: g.spots.length }];
      default: return undefined;
    }
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

  // ---- Trading and Renown (stage 12: shared/renown.ts, shared/shops.ts) ----

  private tradingLevel = (p: Player) => (isUnlocked(p.unlocked, "trading") ? levelForXp(p.skillXp.trading) : 1);
  private renownLevel = (p: Player) => (isUnlocked(p.unlocked, "renown") ? levelForXp(p.skillXp.renown) : 1);
  /** A skill's level (0 if you haven't been taught it), for quests that need one. */
  private levelOf = (p: Player) => (skill: SkillId) => (isUnlocked(p.unlocked, skill) ? levelForXp(p.skillXp[skill]) : 0);
  private titlesOf = (p: Player) => earnedTitles(p.renownRank, rankFor(p.guildPoints));

  private renownView(p: Player): RenownView {
    return { level: this.renownLevel(p), rank: p.renownRank, title: p.title, titles: this.titlesOf(p) };
  }

  private sendRenown(client: Client, p: Player) {
    client.send("renown", this.renownView(p));
  }

  /** Talking to Captain Bryn: he names you a new rank if your Renown is high enough. */
  private renownTalk(client: Client, p: Player) {
    if (!boardOpen(p.quest)) return this.sendRenown(client, p);
    const earned = rankForRenown(this.renownLevel(p));
    if (earned > p.renownRank) {
      p.renownRank = earned;
      const title = RENOWN_RANKS[earned].title;
      if (!p.title) p.title = title;
      p.dirty = true;
      this.say(client, `🏅 Captain Bryn: Folk all over town know your name now. From today, you're ${title}! Wear it with pride: everyone sees it over your head (pick another in my shop window). And I've some special things for sale to those I've named.`);
    }
    this.sendRenown(client, p);
  }

  // ---- Farming (shared/farming.ts) ----

  private farmSaveTimer: ReturnType<typeof setTimeout> | null = null;

  /** Everyone's plots come from the world store when the room starts. */
  private async loadFarms() {
    try {
      const data = (await store.getWorld("farms")) as { lots?: Record<string, { owner?: string; name?: string; w?: number; h?: number; crops?: string[] }> } | null;
      for (const [k, v] of Object.entries(data?.lots ?? {})) {
        const lot = Number(k);
        if (!LOTS[lot] || !v?.owner) continue;
        const plot = new Plot();
        plot.ownerKey = v.owner;
        plot.owner = v.name ?? v.owner;
        const step = Math.max(0, PLOT_SIZES.findIndex(([w, h]) => w === v.w && h === v.h));
        [plot.w, plot.h] = PLOT_SIZES[step];
        (v.crops ?? []).slice(0, LOT_SIZE * LOT_SIZE).forEach((c, i) => { if (decodeCrop(c)) plot.crops[i] = c; });
        this.state.plots.set(String(lot), plot);
      }
    } catch (err: any) {
      console.error("Loading the farms failed:", err.message);
    }
  }

  private async saveFarms() {
    this.farmSaveTimer = null;
    const lots: Record<string, unknown> = {};
    this.state.plots.forEach((plot, k) => { lots[k] = { owner: plot.ownerKey, name: plot.owner, w: plot.w, h: plot.h, crops: [...plot.crops] }; });
    try {
      await store.setWorld("farms", { lots });
    } catch (err: any) {
      console.error("Saving the farms failed:", err.message);
    }
  }

  /** Save the farms a moment from now (planting a whole plot is one save). */
  private saveFarmsSoon() {
    if (!this.farmSaveTimer) this.farmSaveTimer = setTimeout(() => void this.saveFarms(), 3000);
  }

  private plotOf(p: Player): { lot: number; plot: Plot } | null {
    const key = usernameKey(p.name);
    for (const [k, plot] of this.state.plots) if (plot.ownerKey === key) return { lot: Number(k), plot };
    return null;
  }

  private plotStep = (plot: Plot) => Math.max(0, PLOT_SIZES.findIndex(([w, h]) => w === plot.w && h === plot.h));

  private farmView(p: Player): FarmView {
    const mine = this.plotOf(p);
    return {
      lot: mine?.lot ?? null, w: mine?.plot.w ?? 0, h: mine?.plot.h ?? 0, step: mine ? this.plotStep(mine.plot) : -1,
      free: LOTS.length - this.state.plots.size, firstFree: this.step(p)?.goal.kind === "plot", chest: p.farmChest,
    };
  }

  private sendFarm(client: Client, p: Player) {
    client.send("farm", this.farmView(p));
  }

  /** Get a plot from Farmer Odo, or make yours bigger. */
  private buyPlot(client: Client, p: Player) {
    if (!this.nearNpc(p, "odo")) return this.say(client, "You need to be next to Farmer Odo.");
    if (!isUnlocked(p.unlocked, "farming")) return this.say(client, this.notTaught("farming"));
    const mine = this.plotOf(p);
    const step = mine ? this.plotStep(mine.plot) + 1 : 0;
    if (step >= PLOT_SIZES.length) return this.say(client, "Farmer Odo: Your plot's as big as a lot gets!");
    const lot = mine ? mine.lot : LOTS.findIndex((_, i) => !this.state.plots.has(String(i)));
    if (lot < 0) return this.say(client, "Farmer Odo: Sorry, every lot is taken right now.");
    const price = step === 0 && this.step(p)?.goal.kind === "plot" ? 0 : plotPrice(step);
    if (p.coins < price) return this.say(client, `You need ${formatMoney(price)} for that. You have ${formatMoney(p.coins)}.`);
    p.coins -= price;
    const plot = mine?.plot ?? new Plot();
    [plot.w, plot.h] = PLOT_SIZES[step];
    if (!mine) {
      plot.ownerKey = usernameKey(p.name);
      plot.owner = p.name;
      this.state.plots.set(String(lot), plot);
    }
    p.dirty = true;
    void this.saveFarms();
    const where = LOTS[lot].y < 73 ? "north of the road" : "south of the road";
    this.say(client, mine ? `🌾 Your plot is now ${plot.w} × ${plot.h}.`
      : `🌾 You have a plot! It's ${plot.w} × ${plot.h}, ${where}: look for your name on its sign. Click it to plant${price ? "" : " (Odo paid for this one)"}.`);
    client.send("coins", p.coins);
    this.sendFarm(client, p);
    if (!mine) this.questEvent(p, client, { kind: "plot" });
  }

  /** Pay Odo to link the farm chest to your enchanted chest. */
  private buyFarmChest(client: Client, p: Player) {
    if (!this.nearNpc(p, "odo")) return this.say(client, "You need to be next to Farmer Odo.");
    if (p.farmChest) return this.say(client, "The farm chest is already linked to yours.");
    if (!p.chest.slotCount) return this.say(client, "Farmer Odo: You'll need space in the enchanted chest first. Archmage Rowan rents it out at the Mages' Guild.");
    if (p.coins < FARM_CHEST_PRICE) return this.say(client, `You need ${formatMoney(FARM_CHEST_PRICE)} for that. You have ${formatMoney(p.coins)}.`);
    p.coins -= FARM_CHEST_PRICE;
    p.farmChest = true;
    p.dirty = true;
    this.say(client, "📦 Done! The chest outside the farmhouse now opens your enchanted chest.");
    client.send("coins", p.coins);
    this.sendFarm(client, p);
  }

  /** Within reach of a farm tile: on it, or next to it (diagonals too). */
  private nearTile = (p: Point, t: Point) => Math.max(Math.abs(p.x - t.x), Math.abs(p.y - t.y)) <= 1;

  /** Walk until the tile is within reach. */
  private pathNear(p: Point, t: Point): Point[] {
    if (this.nearTile(p, t)) return [];
    const full = findPath({ x: p.x, y: p.y }, t);
    const stop = full.findIndex((pt) => this.nearTile(pt, t));
    return stop < 0 ? full : full.slice(0, stop + 1);
  }

  /** Click your plot: walk over, then plant and harvest tile after tile. */
  private startFarming(client: Client, p: Player, t: Point) {
    const at = lotAt(t.x, t.y);
    if (!at) return;
    const plot = this.state.plots.get(String(at.lot));
    if (!plot) return this.say(client, "Nobody farms this lot yet. Farmer Odo, in the farmhouse, sells plots.");
    if (plot.ownerKey !== usernameKey(p.name)) return this.say(client, `That's ${plot.owner}'s farm. Only they can plant and harvest it.`);
    if (!isUnlocked(p.unlocked, "farming")) return this.say(client, this.notTaught("farming"));
    if (!inPlot(at.index, plot.w, plot.h)) return this.say(client, "That part of the lot isn't yours yet. Farmer Odo can make your plot bigger.");
    this.breakInvisible(p, client, "gather");
    this.stopActions(p);
    // Start on the tile you clicked if there's something to do there, or the nearest one that has.
    const level = levelForXp(p.skillXp.farming);
    const now = Date.now();
    const start = this.farmWork(p, plot, at.index, level, now) ? t : this.nextFarmTile(p, at.lot, plot, level, now);
    if (!start) return this.say(client, this.farmDone(p, plot, level, now));
    p.target = start;
    p.activity = "farming";
    p.farmTimer = 0;
    p.path = this.pathNear(p, start);
    if (!p.path.length && !this.nearTile(p, start)) {
      this.stopActions(p);
      this.say(client, "You can't reach that.");
    }
  }

  /** The seed you'd plant next: the one you picked, or the first in your bag you can grow. */
  private seedFor(p: Player, level: number): SeedId | null {
    const ok = (it: ItemId | null): it is SeedId => isSeed(it) && CROPS[cropOfSeed(it)].level <= level;
    if (ok(p.seedPick) && countItem(p, p.seedPick) > 0) return p.seedPick;
    for (const e of entriesInOrder(p)) { const it = p.inventory[e]; if (ok(it)) return it; }
    return null;
  }

  /** Is there something to do on this tile: plant it (with a seed you have), or harvest it? */
  private farmWork(p: Player, plot: Plot, index: number, level: number, now: number): "plant" | "harvest" | null {
    if (!inPlot(index, plot.w, plot.h)) return null;
    const c = decodeCrop(plot.crops[index]);
    if (!c) return this.seedFor(p, level) ? "plant" : null;
    return now >= c.ripeAt ? "harvest" : null;
  }

  /** The nearest tile in your plot with something to do. */
  private nextFarmTile(p: Player, lot: number, plot: Plot, level: number, now: number): Point | null {
    let best: Point | null = null, bestD = Infinity;
    for (let i = 0; i < LOT_SIZE * LOT_SIZE; i++) {
      if (!this.farmWork(p, plot, i, level, now)) continue;
      const t = tileOf(lot, i);
      const d = Math.max(Math.abs(p.x - t.x), Math.abs(p.y - t.y)) * 10 + Math.abs(p.x - t.x) + Math.abs(p.y - t.y);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  /** Nothing left to do: say why, and when the next crop is ready. */
  private farmDone(p: Player, plot: Plot, level: number, now: number): string {
    let soonest = Infinity, empty = 0;
    for (let i = 0; i < LOT_SIZE * LOT_SIZE; i++) {
      if (!inPlot(i, plot.w, plot.h)) continue;
      const c = decodeCrop(plot.crops[i]);
      if (!c) empty++;
      else soonest = Math.min(soonest, c.ripeAt);
    }
    const next = soonest < Infinity ? ` The next crop is ripe in ${timeLeft(soonest - now)}.` : "";
    if (!empty) return `🌱 Everything's planted.${next}`;
    const seeds = p.inventory.filter((it): it is SeedId => isSeed(it));
    if (!seeds.length) return `🌱 You're out of seeds. Farmer Odo sells them.${next}`;
    const need = Math.min(...seeds.map((s) => CROPS[cropOfSeed(s)].level));
    return `🌱 You need Farming level ${need} to plant the seeds you have.${next}`;
  }

  private farmTick(p: Player, sessionId: string) {
    const client = this.clients.getById(sessionId);
    const t = p.target!;
    const at = lotAt(t.x, t.y);
    const plot = at && this.state.plots.get(String(at.lot));
    if (!at || !plot || plot.ownerKey !== usernameKey(p.name) || !this.nearTile(p, t)) return this.stopActions(p);
    p.faceX = t.x;
    p.faceY = t.y;
    if (p.action !== "farming") {
      p.action = "farming";
      p.farmTimer = 0;
      return;
    }
    // One tile every 2 ticks.
    if (++p.farmTimer < 2) return;
    p.farmTimer = 0;
    const level = levelForXp(p.skillXp.farming);
    const now = Date.now();
    const work = this.farmWork(p, plot, at.index, level, now);
    if (work) {
      if (!this.hasStamina(client!, p, "farming")) return this.stopActions(p);
      if (work === "plant") this.plant(p, client, plot, at.index, level, now);
      else if (!this.harvest(p, client, plot, at.index, level)) return this.stopActions(p);
      if (!this.roll(p, "farming", "staminaSave")) this.useStamina(p, "farming");
      this.saveFarmsSoon();
    }
    const next = this.nextFarmTile(p, at.lot, plot, level, now);
    if (!next) {
      if (client) this.say(client, this.farmDone(p, plot, level, now));
      return this.stopActions(p);
    }
    p.target = next;
    p.path = this.pathNear(p, next);
  }

  private plant(p: Player, client: Client | undefined, plot: Plot, index: number, level: number, now: number) {
    const seed = this.seedFor(p, level)!;
    const crop = cropOfSeed(seed);
    takeItem(p, seed, 1);
    const minutes = CROPS[crop].minutes * (1 - this.tree(p, "farming", "growth"));
    const ms = FAST_GATHER_FOR_TESTS ? minutes * 1000 : minutes * 60_000; // tests: a minute is a second
    plot.crops[index] = encodeCrop({ crop, plantedAt: now, ripeAt: now + Math.round(ms) });
    if (client) {
      this.sendInventory(client, p);
      this.say(client, `🌱 You plant ${aOr(ITEMS[seed].single)}. Ripe in ${timeLeft(ms)}.`);
    }
    this.addSkillXp(p, client, "farming", PLANT_XP);
    this.questEvent(p, client, { kind: "plant" });
  }

  /** Dig up a ripe crop. False if your bag or back can't take it. */
  private harvest(p: Player, client: Client | undefined, plot: Plot, index: number, level: number): boolean {
    const c = decodeCrop(plot.crops[index])!;
    const def = CROPS[c.crop];
    const mastery = masteryLevelIn(p.mastery, `crop_${c.crop}`);
    let n = def.yield[0] + Math.floor(Math.random() * (def.yield[1] - def.yield[0] + 1));
    if (Math.random() < this.tree(p, "farming", "double") + (mastery - 1) * MASTERY_EXTRA) n++;
    const got = this.give(p, def.produce, n);
    if (!got) {
      if (client) this.say(client, this.fullReason(p, def.produce));
      return false;
    }
    plot.crops[index] = "";
    const back = Math.random() < SEED_BACK + level * SEED_BACK_PER_LEVEL && this.give(p, seedId(c.crop)) > 0;
    const item = ITEMS[def.produce];
    if (client) {
      this.sendInventory(client, p);
      this.say(client, `🌾 You harvest ${got} ${got === 1 ? item.single : item.name.toLowerCase()}${back ? `, and get ${aOr(ITEMS[seedId(c.crop)].single)} back` : ""}.`);
    }
    this.addSkillXp(p, client, "farming", def.xp);
    this.addMasteryXp(p, client, `crop_${c.crop}`, def.xp);
    this.questEvent(p, client, { kind: "harvest" });
    return true;
  }

  private stopActions(p: Player) {
    p.walkDir = null;
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
    let boosted = xp * (1 + this.tree(p, skill, "xp")) * (1 + buffPower(p.buffs, "blessed", worldNow()) / 100);
    // Ember Debt: while you carry Tithe marks, the shrine takes a fifth.
    if (p.tithe > 0) {
      const tithe = boosted * TITHE_SHARE;
      boosted -= tithe;
      p.titheXp += tithe;
      const cost = titheCost(Math.max(...Object.values(p.levels)));
      if (p.titheXp >= cost) {
        p.titheXp -= cost;
        p.tithe--;
        if (!p.tithe) p.titheXp = 0;
        if (client) this.say(client, p.tithe ? `⛓️ A Tithe mark fades. ${p.tithe} left.` : "⛓️ Your last Tithe mark fades. All your XP is yours again.");
      }
    }
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
      } else if (skill === "farming") {
        for (const c of CROP_IDS) {
          const lv = CROPS[c].level;
          if (lv > 1 && lv > before && lv <= after) this.say(client, `🌱 You can now grow ${ITEMS[CROPS[c].produce].name.toLowerCase()}! Farmer Odo sells the seeds.`);
        }
      } else if (skill === "handicraft") {
        for (const b of Object.values(BAITS)) if (b.level > before && b.level <= after) this.say(client, `You can now make ${b.name.toLowerCase()} at the workbench!`);
        const now = (lv: number) => lv > before && lv <= after;
        for (const [w, lv] of Object.entries(WOOD_LEVEL)) {
          if (now(lv)) this.say(client, `🪵 You can now carve ${w} staffs at the workbench!`);
          if (now(lv + 2)) this.say(client, `🏹 You can now carve ${w} bows at the workbench!`);
        }
        for (const [m, lv] of Object.entries(ARROW_LEVEL)) if (now(lv)) this.say(client, `🏹 You can now make ${m} arrows at the workbench!`);
        for (const t of TANNING) if (now(t.level)) this.say(client, `🟫 You can now tan ${ITEMS[t.hide].name.toLowerCase()} into leather at the tanning rack!`);
        if (now(THREAD_LEVEL)) this.say(client, "🧵 You can now spin spider silk into thread at the spinning wheel!");
        if (now(CLOTH_LEVEL)) this.say(client, "🧶 You can now weave cloth at the spinning wheel!");
        for (const soft of ["leather", "cloth"] as const) {
          for (const [type, lv] of Object.entries(SOFT_LEVEL[soft])) if (now(lv!)) this.say(client, `You can now make ${SOFT_NAMES[soft][type as ArmorType]!.toLowerCase()} at the workbench!`);
        }
      } else if (skill === "defense") {
        for (const m of Object.values(METALS)) if (m.level > before && m.level <= after) this.say(client, `You can now wear ${m.name.toLowerCase()} armor!`);
        this.sendVitals(client, p);
      } else if (skill === "melee" || skill === "ranged" || skill === "magic") {
        for (const w of Object.values(WEAPONS)) if (w.style === skill && w.level > before && w.level <= after) this.say(client, `You can now use ${aOr(w.name.toLowerCase())}!`);
        if (skill === "magic") {
          for (const id of SPELL_IDS) {
            const sp = SPELLS[id];
            if (sp.level <= before || sp.level > after) continue;
            if (sp.book) {
              if (p.books.includes(id)) this.say(client, `You can now cast ${sp.icon} ${sp.name}!`);
              continue;
            }
            const placed = this.addToBar(p, id);
            this.say(client, `You can now cast ${sp.icon} ${sp.name}! ${placed ? "It's on your spell bar." : "Your spell bar is full: press ✎ on it to swap it in."}`);
          }
          this.sendSpellbook(client, p);
        }
      } else if (skill === "alchemy") {
        for (const t of POTION_TYPES) {
          const d = POTIONS[t];
          if (d.level > before && d.level <= after) this.say(client, d.hidden ? "⚗️ Your Alchemy is good enough for a hidden recipe now. Keep experimenting!" : `⚗️ You can now brew ${d.name.toLowerCase()}s!`);
        }
      } else if (skill === "foraging") {
        for (const f of FORAGE_FINDS) if (f.level > before && f.level <= after) this.say(client, `🌱 You can now dig up ${ITEMS[f.item].name.toLowerCase()}${f.night ? " (at night)" : ""}!`);
      } else if (skill === "renown") {
        for (let r = 1; r < RENOWN_RANKS.length; r++) {
          if (RENOWN_RANKS[r].level > before && RENOWN_RANKS[r].level <= after) this.say(client, `🏅 Your Renown is ${after}: Captain Bryn has a new rank for you (${RENOWN_RANKS[r].title}). Go and see him!`);
        }
        this.say(client, "📋 Bounties ask for a little more now, and pay more too.");
      } else if (skill === "trading") {
        const now = (lv: number) => lv > before && lv <= after;
        for (const id of SHOP_IDS) for (const r of SHOPS[id].rare ?? []) if (now(r.trading)) this.say(client, `💰 ${SHOPS[id].title.replace(/^\S+ /, "")} will sell you ${ITEMS[r.item].name.toLowerCase()} now.`);
        this.say(client, "💰 Shops pay you a little more and charge a little less.");
      } else if (isCraftSkill(skill)) {
        for (const m of Object.values(METALS)) {
          if (m.level > before && m.level <= after) {
            this.say(client, skill === "smelting" ? `You can now smelt ${m.name.toLowerCase()} bars!` : `You can now make ${m.name.toLowerCase()} tools!`);
          }
        }
        if (skill === "smelting") {
          for (const b of Object.values(JEWEL_BARS)) if (b.level > before && b.level <= after) this.say(client, `You can now smelt ${b.name.toLowerCase()}s!`);
        } else if (skill === "smithing") {
          for (const m of Object.values(JEWEL_METALS)) if (m.level > before && m.level <= after) this.say(client, `💍 You can now make ${m.name.toLowerCase()} rings and amulets!`);
          for (const [g, lv] of Object.entries(CUT_LEVEL)) {
            if (lv > before && lv <= after) this.say(client, g === "soul" ? "💎 You can now cut emberstone into refined emberstones!" : `💎 You can now cut ${GEMS[g as GemId].name.toLowerCase()}s!`);
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
    this.say(client, `${masteryName(id)} Mastery ${after}! ` + (id.startsWith("crop_")
      ? `${Math.round((after - 1) * MASTERY_EXTRA * 100)}% chance of an extra one each harvest.`
      : crafted
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
    p.look = cleanLook(account.save.look) ?? "";
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
    this.leaveParty(client.sessionId, "left");
    p.invite = null;
    this.state.players.delete(client.sessionId);
    console.log(`${p.name} logged out (${this.state.players.size} online)`);
    const saving = this.save(p).finally(() => { pendingSaves.delete(k); });
    pendingSaves.set(k, saving);
    online.delete(k);
    await saving;
  }

  async onDispose() {
    rooms.delete(this);
    // Normally onLeave already saved everyone; this is a safety net.
    await Promise.all([...this.state.players.values()].map((p) => this.save(p)));
    if (this.farmSaveTimer) { clearTimeout(this.farmSaveTimer); await this.saveFarms(); }
  }

  // ---- Saving and loading ----

  private restore(p: Player, save: SaveData) {
    // Saves from before the tutorial (or an older save version) start over from
    // scratch, so everyone plays Old Maren's tutorial. The account itself is kept.
    if (save.saveVersion !== SAVE_VERSION) {
      if (Object.keys(save).length) console.log(`${p.name}: old save (version ${save.saveVersion ?? "none"}), starting over`);
      save = {};
      // New characters wake up on the steps of the Heart Shrine, inside the Emberhall.
      const spawn = spotNear(WAKE_SPOT);
      p.x = spawn.x;
      p.y = spawn.y;
      return;
    }
    if (save.quest) p.quest = migrateQuest(save.quest, save.questRev);
    p.rank = rankOf(p.quest);
    if (typeof save.tithe === "number" && Number.isInteger(save.tithe)) p.tithe = Math.max(0, Math.min(TITHE_MAX, save.tithe));
    if (p.tithe && typeof save.titheXp === "number" && Number.isFinite(save.titheXp)) p.titheXp = Math.max(0, save.titheXp);
    if (save.mapRev === MAP_REV && Number.isInteger(save.x) && Number.isInteger(save.y) && isWalkable(save.x!, save.y!) && !doorAt(save.x!, save.y!)) {
      p.x = save.x!;
      p.y = save.y!;
    } else {
      // From before the world grew (or somewhere that isn't there any more): the town square.
      const spawn = randomSpawn();
      p.x = spawn.x;
      p.y = spawn.y;
      if (save.mapRev !== MAP_REV) {
        p.loginNotes.push("🗺️ The world has grown! You're in the town square, by the steps of the Emberhall, the Emberguard's great white temple. Shops and trainers work indoors now: walk onto a door to go in. Tap 🗺️ (top right) for a map.");
      }
    }
    // Load the saved bag as it was (older saves had 28 slots, one entry each), then fit it into today's bag below.
    let stoneRefund = 0;
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
        if (item === "stone") {
          // Stone isn't in the game any more: it's paid out at what it sold for.
          const n = save.counts?.[i];
          stoneRefund += (Number.isInteger(n) && n! >= 1 ? Math.min(n!, 1000) : 1) * STONE_PRICE;
          old.slotOf[i] = -1;
          continue;
        }
        if (typeof item === "string" && item in LEGACY_ITEMS) item = LEGACY_ITEMS[item]; // logs -> pine logs, etc.
        if (typeof item === "string") item = legacyTool(item) ?? item; // metal-headed rods -> wooden rods
        if (typeof item === "string") item = legacyStew(item) ?? item; // old fish stews -> stews
        const wasStone = typeof item === "string" && legacyStone(item) != null;
        if (typeof item === "string") item = legacyStone(item) ?? item; // stone tools, weapons and arrows -> bronze
        old.inventory[i] = typeof item === "string" && item in ITEMS ? (item as ItemId) : null;
        const it = old.inventory[i];
        if (!it) { old.slotOf[i] = -1; continue; }
        // How many in the stack (saves from before stacks had one per slot).
        const n = save.counts?.[i];
        old.counts[i] = wearsOut(it) ? 1 : Number.isInteger(n) && n! >= 1 ? Math.min(n!, stackLimit(it)) : 1;
        if (isTool(it) || isGear(it) || isBait(it)) {
          const max = isTool(it) ? maxDurability(it) : isGear(it) ? gearDurability(it) : BAITS[it].uses;
          let d = save.durability?.[i];
          if (wasStone && typeof d === "number" && d > 0) d *= STONE_TO_BRONZE_USES; // bronze lasts longer than stone did
          // Broken tools and gear (0 uses left) stay broken; bait at 0 would have been used up.
          old.durability[i] = typeof d === "number" && (d > 0 || (d === 0 && !isBait(it))) ? Math.min(Math.floor(d), max) : max;
        }
      }
    }
    for (const type of TOOL_TYPE_IDS) {
      const t = save.belt?.[type];
      if (t && typeof t.item === "string") t.item = legacyTool(t.item) ?? t.item;
      if (t && typeof t.item === "string" && legacyStone(t.item) && typeof t.durability === "number") {
        t.item = legacyStone(t.item)!; // a stone tool on the belt -> bronze
        t.durability *= STONE_TO_BRONZE_USES;
      }
      if (t && isTool(t.item) && parseTool(t.item).type === type && typeof t.durability === "number" && t.durability > 0) {
        p.belt[type] = { item: t.item, durability: Math.min(Math.floor(t.durability), maxDurability(t.item)) };
      }
    }
    if (typeof save.coins === "number" && Number.isFinite(save.coins) && save.coins >= 0) p.coins = Math.floor(save.coins);
    if (stoneRefund) {
      p.coins += stoneRefund;
      p.loginNotes.push(`🪨 Stone isn't mined any more, so the stone in your bag was sold for you: +${stoneRefund} bronze coins.`);
    }
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
    p.farmChest = save.farmChest === true;
    if (Number.isInteger(save.renownRank)) p.renownRank = Math.max(0, Math.min(RENOWN_RANKS.length - 1, save.renownRank!));
    if (Number.isInteger(save.boardDay)) p.boardDay = save.boardDay!;
    if (Number.isInteger(save.guildDay)) p.guildDay = save.guildDay!;
    if (typeof save.title === "string") p.title = save.title;
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
      if (g && typeof g.item === "string" && legacyStone(g.item) && typeof g.durability === "number") {
        g.item = legacyStone(g.item)!; // a stone weapon -> bronze
        g.durability *= STONE_TO_BRONZE_USES;
      }
      if (g && isGear(g.item) && gearSlot(g.item) === slot && typeof g.durability === "number" && g.durability > 0) {
        p.gear[slot] = { item: g.item, durability: Math.min(Math.floor(g.durability), gearDurability(g.item)) };
      }
    }
    for (const id of ALL_COMBAT_MASTERY_IDS) if (ok(save.combatMastery?.[id])) p.combatMastery[id] = Math.floor(save.combatMastery![id]);
    if (isBoltSpell(save.spell ?? "") && levelForXp(p.skillXp.magic) >= SPELLS[save.spell as BoltSpellId].level) p.spell = save.spell as BoltSpellId;
    p.books = SPELL_IDS.filter((id) => SPELLS[id].book && save.books?.includes(id));
    // No bar saved yet (an old save): it fills with the spells you know the first time it's sent.
    p.spellBar = Array.isArray(save.spellBar) ? save.spellBar.slice(0, 8).map((id) => (SPELL_IDS.includes(id as SpellId) ? id as SpellId : null)) : [];
    p.barFresh = !Array.isArray(save.spellBar);
    p.tree = cleanRanks(save.tree);
    p.jewels = emptyJewels();
    for (const s of JEWEL_SLOTS) {
      const j = save.jewels?.[s];
      if (isJewelry(j) && (s === "amulet") === ((parseGem(j) as { type: string }).type === "amulet")) p.jewels[s] = j;
    }
    p.discovered = POTION_TYPES.filter((t) => POTIONS[t].hidden && save.discovered?.includes(t));
    p.buffs = {};
    for (const id of BUFF_IDS) {
      const b = save.buffs?.[id];
      if (b && Number.isFinite(b.until) && Number.isFinite(b.power) && b.until > worldNow()) p.buffs[id] = { until: b.until, power: b.power };
    }
    p.invisible = !!p.buffs.invisible;
    // Skills taught, Discipline levels, and the stats they give.
    p.unlocked = unlockedSkills(p.quest);
    p.levels = disciplineLevels(p.skillXp, p.unlocked);
    p.maxStamina = this.maxStaminaOf(p);
    p.stamina = Math.min(p.stamina, p.maxStamina);
    p.stepMs = this.stepMsOf(p);
    p.maxHp = this.maxHpOf(p);
    p.hp = p.maxHp;
    if (typeof save.hp === "number" && Number.isFinite(save.hp)) {
      const away = typeof save.hpAt === "number" ? Math.max(0, Date.now() - save.hpAt) : 0;
      p.hp = Math.max(1, Math.min(p.maxHp, Math.floor(save.hp) + Math.floor(away / HEALTH_REGEN_MS)));
    }
    p.mana = this.maxManaOf(p);
    if (Array.isArray(save.bounties)) for (const b of save.bounties) if (b && typeof b.item === "string") b.item = legacyStone(b.item) ?? b.item; // stone -> bronze
    if (Array.isArray(save.bounties)) p.bounties = save.bounties.filter(validBounty).slice(0, BOUNTY_COUNT);
    if (typeof save.tracked === "string") save.tracked = legacyStone(save.tracked) ?? save.tracked;
    if (typeof save.tracked === "string" && p.bounties.some((b) => b.item === save.tracked)) p.tracked = save.tracked as ItemId;
  }

  private snapshot(p: Player): SaveData {
    // Save where the player is heading, so walking off mid-path doesn't lose the move.
    const dest = p.path.length ? p.path[p.path.length - 1] : p;
    const bag = cloneBag(p);
    compact(bag); // leave out unused entries
    return { saveVersion: SAVE_VERSION, mapRev: MAP_REV, questRev: QUEST_REV, quest: structuredClone(p.quest), x: dest.x, y: dest.y, inventory: bag.inventory, slots: bag.slotOf, coins: p.coins, skillXp: { ...p.skillXp }, mastery: { ...p.mastery }, durability: bag.durability, belt: { ...p.belt }, stamina: p.stamina, staminaAt: Date.now(), hp: p.hp, hpAt: Date.now(), gear: { ...p.gear }, spell: p.spell, combatMastery: { ...p.combatMastery }, tree: { ...p.tree }, lockedSlots: bag.locked.flatMap((on, i) => (on ? [i] : [])), bounties: p.bounties.map((b) => ({ ...b })), tracked: p.tracked ?? undefined, color: p.color, look: p.look || undefined, counts: bag.counts, jewels: { ...p.jewels }, discovered: [...p.discovered], books: [...p.books], spellBar: p.barFresh ? undefined : [...p.spellBar], buffs: structuredClone(p.buffs), guild: this.guildSave(p), farmChest: p.farmChest || undefined, renownRank: p.renownRank || undefined, title: p.title || undefined, tithe: p.tithe || undefined, titheXp: p.tithe ? Math.floor(p.titheXp) : undefined, boardDay: p.boardDay || undefined, guildDay: p.guildDay || undefined };
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
