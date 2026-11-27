// The synced game state: players, monsters, farm plots.
// Part of the game room (server/src/WorldRoom.ts), split out to keep each file to one job.
import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { TICK_MS } from "../../../shared/map";
import { Point } from "../../../shared/pathfinding";
import { ResourceId } from "../../../shared/foraging";
import { ItemMasteryXp } from "../../../shared/mastery";
import { DisciplineLevels, SkillId, SkillXp, emptySkills } from "../../../shared/disciplines";
import { Recipe } from "../../../shared/crafting";
import { CombatMasteryId, CombatMasteryXp, MonsterId, SpellId, BoltSpellId } from "../../../shared/combat";
import { CombatStyle, Gear, emptyGear } from "../../../shared/gear";
import { Belt, emptyBelt } from "../../../shared/tools";
import { INVENTORY_SIZE, ItemId } from "../../../shared/items";
import { NpcDef } from "../../../shared/npcs";
import { Bag, emptyBag } from "../../../shared/bag";
import { loadLevel, maxStamina } from "../../../shared/stats";
import { GuildBounty } from "../../../shared/guild";
import { Jewels, emptyJewels } from "../../../shared/jewelry";
import { Buffs, PotionType } from "../../../shared/alchemy";
import { MAX_STAMINA } from "../../../shared/cooking";
import { TreeRanks } from "../../../shared/skilltree";
import { QuestProgress, newQuestProgress } from "../../../shared/quests";
import { Bounty, boardDay } from "../../../shared/bounties";
import { LOT_SIZE } from "../../../shared/farming";

export class Player extends Schema {
  @type("string") name = "";
  @type("number") x = 0; // tile coordinates
  @type("number") y = 0;
  @type("number") fx = 0.5; // where exactly you stand, in tiles with fractions (you can stand anywhere, not just mid-tile); x/y is the tile under you
  @type("number") fy = 0.5;
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
  @type("string") worn = ""; // the armor you have on, comma separated item ids (helmet_bronze,platebody_cloth), so others see it on you
  @type("string") look = ""; // how your 3D character looks: the Character Workshop's recipe as JSON (shared/look.ts), "" until you make one

  // Server-only (not synced to everyone):
  path: Point[] = [];
  walkDir: Point | null = null; // the way they're holding the keyboard (WASD) to walk, any angle (length 1); null when not
  smoothed: Point[] | null = null; // the path we last straightened (a new path from anywhere gets straightened too)
  goalF: Point | null = null; // the exact spot clicked, inside the path's last tile
  movedAt = 0; // when we last moved them (ms), to know how far to go this time
  gateToldAt = 0; // when we last told them the Dark Forest gate is shut (ms)
  runDist = 0; // how far they've run since breath was last taken for it (tiles)
  gatherFill = 0; // chopping and mining: how far toward the next log or ore (it comes at gatherNeed)
  gatherNeed = 1;
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
  winded = 0;
  loadLevel = 0; // 0 = fine, 1-3 = overloaded (shared/stats.ts loadLevel) // stamina used up for now by running (it all comes back once you stop: shared/stats.ts RUN_COST)
  lastRunAt = 0; // when they last ran a tile (ms)
  outOfBreath = false; // told them they're out of breath (once per run)
  locked: boolean[] = []; // per entry: locked items can't be sold or dropped by accident
  talkTo: NpcDef | null = null; // person the player is walking over to talk to
  quest: QuestProgress = newQuestProgress(); // where they are in the main quest (Maren's chapter, then the trainers')
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
  /** Standing at the restricted section's grille, when Keeper Lisette last stopped you, and how often (version 0.21). */
  atGrille = false;
  grilleAt = 0;
  grilleTries = 0;
  grilleStreak = 0;
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
