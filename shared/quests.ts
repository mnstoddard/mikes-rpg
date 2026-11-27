// The main quest line: Old Maren's first lessons, then a chapter from each trainer.
//
// Every new character starts with Maren's chapter, and there's no skipping.
// Once it's done she sends you to the trainers, and you can do their chapters
// in any order: talk to a trainer with a ❗ to start theirs. One chapter is
// "active" at a time (the one you last talked about); the others keep their
// place until you go back. A character remembers, per chapter, which step it's
// on and how far along that step is (e.g. 2 of 3 logs).
//
// Each step has a goal: talk to the trainer, put a tool on your belt,
// catch/chop/mine something, cook or make something, buy or sell, eat, reach a
// level, or have some items. Talk steps are where the trainer explains things
// and hands over items and rewards. Skills unlock when a talk step teaches them
// (`unlocks`), not by level. Shared so the client's quest tracker shows the
// same text the server uses.
//
// Guards, so a player can't get stuck or skip ahead by accident:
// - `protect`: while on this step, those items can't be sold, dropped or eaten.
// - `needsTool`: the step's work is refused unless that tool is on your belt
//   (and the tracker says to put it back if you take it off).
// - `byHand` gather steps are refused while the tool is on your belt.
// - `need` on a talk step: the trainer wants to see that item first.
// - `ensure`: talk to the trainer and they hand you anything the step needs that you've lost.
// - Talk to Maren while tired with no food, and she gives you a stew.
import { SKILL_IDS } from "./disciplines";
import type { CraftSkill, DisciplineId, GatherSkill, SkillId } from "./disciplines";
import type { ItemId } from "./items";
import type { ResourceId } from "./foraging";
import { findSkill } from "./disciplines";
import type { ToolType } from "./tools";
import type { MonsterId } from "./combat";
import { FIRST_STEW, SHOP_STEW } from "./cooking";
import type { CombatStyle } from "./gear";
import type { NpcId } from "./npcs";
import { ACT_ONE, PROLOGUE_END, PROLOGUE_START, TRAINER_LINES } from "./story";

export const GUIDE_NAME = "Old Maren";

/** Something a trainer hands you. Tools can come worn (fewer uses left). */
export interface Gift { item: ItemId; count?: number; durability?: number }

export type Goal =
  /** Talk to the chapter's trainer. */
  | { kind: "talk" }
  /** Have tools on your belt whose item ids start with these ("rod_", "pot_bronze"). */
  | { kind: "equip"; tools: string[]; names: string }
  /** Gather this many (with one skill and of one type, if set). withTool: only counts with the right tool on your belt. byHand: only without it. */
  | { kind: "gather"; skill?: GatherSkill; resource?: ResourceId; count: number; withTool?: boolean; byHand?: boolean }
  /** Wear a tool on your belt down until it breaks. */
  | { kind: "toolBreaks"; tool: ToolType }
  /** Make something whose item id starts with `prefix` ("meal_stew_", "axe_bronze_"). tries: any attempt counts, even a failure. */
  | { kind: "craft"; skill: CraftSkill; prefix: string; count: number; tries?: boolean }
  /** Eat a meal. */
  | { kind: "eat" }
  /** Sell things to a shop: fish or logs (`what`), or anything at all. */
  | { kind: "sell"; what?: GatherSkill; count: number }
  /** Buy anything from a shop. */
  | { kind: "buy"; count: number }
  /** Reach a Discipline level (the average of its learned skills). */
  | { kind: "level"; discipline: DisciplineId; level: number }
  /** Reach a skill level. */
  | { kind: "skillLevel"; skill: SkillId; level: number }
  /** Have these items in your bag (gathered or bought, either way). */
  | { kind: "have"; items: Partial<Record<ItemId, number>> }
  /** Wear gear whose item ids start with these ("dagger_", "helmet_"). */
  | { kind: "gear"; items: string[]; names: string }
  /** Defeat monsters (of one type, if set; with one style, if set). */
  | { kind: "kill"; monster?: MonsterId; count: number; style?: CombatStyle }
  /** Drink a health potion. */
  | { kind: "drink" }
  /** Enchant something at the altar. */
  | { kind: "enchant" }
  /** Track a bounty (tap it in the 📜 Quests tab or on the board). */
  | { kind: "track" }
  /** Hand in bounties at the board. */
  | { kind: "bounty"; count: number }
  /** Get something fixed by the Repairer. */
  | { kind: "repair" }
  /** Farming: get a plot from Farmer Odo. */
  | { kind: "plot" }
  /** Farming: plant seeds. */
  | { kind: "plant"; count: number }
  /** Farming: harvest ripe crops (one tile counts as one). */
  | { kind: "harvest"; count: number; unblessed?: boolean }
  /** Talk to (or use) each of these people or things, in any order. */
  | { kind: "visit"; npcs: NpcId[]; names: string }
  /** Walk to each of these places (shared/world.ts PLACES keys), in any order. */
  | { kind: "reach"; spots: string[]; names: string }
  /** Spend a Mastery point in any skill's tree (done once any upgrade has a rank). */
  | { kind: "spendPoint" };

export interface QuestStep {
  /** What the tracker says to do. */
  task: string;
  goal: Goal;
  /** Talk steps: what the trainer says. */
  lines?: string[];
  /** Talk steps: what they give you (items, then coins). */
  give?: Gift[];
  coins?: number;
  /** Talk steps: an item (id prefix) they want to see before they'll go on, and what they say if you don't have it. */
  need?: { prefix: string; line: string };
  /** Other steps: what they say if you talk to them before it's done. */
  hint?: string;
  /** Other steps: things they hand you again if you've lost them (so you can't get stuck). */
  ensure?: Gift[];
  /** Crafting this step asks for always works (their guiding hand). */
  guaranteed?: boolean;
  /** Item id prefixes that can't be sold, dropped or eaten during this step. */
  protect?: string[];
  /** This step's work needs this tool on your belt. */
  needsTool?: ToolType;
  /** Fighting during this step needs a weapon in your hand ("weapon"), or one of this style (a staff for "magic"). */
  fightWith?: "weapon" | CombatStyle;
  /** Finishing this talk step opens the gate to the Dark Forest. */
  opensGate?: boolean;
  /** From this talk step on, the bounty board is open. */
  opensBoard?: boolean;
  /** Finishing this talk step teaches you these skills (skills unlock through quests, not by level). */
  unlocks?: SkillId[];
  /** Talk steps: with someone (or something) other than the chapter's giver. */
  who?: NpcId;
  /** Talk steps: items they take from you (and won't go on without). */
  take?: Partial<Record<ItemId, number>>;
  /** Talk steps: skill XP they give you. */
  xp?: Partial<Record<SkillId, number>>;
  /** Talk steps: they bless you (shared/story.ts). */
  bless?: boolean;
  /** Talk steps: this makes you a new Emberguard rank (shared/story.ts RANKS). */
  rank?: 1 | 2;
  /** Talk steps: Kael's old Warden weapon, picked for how you fight. */
  warden?: boolean;
  /** Visit steps: who's talking in visitLines, if it's always the same person (Brother Oren's tour). */
  speaker?: string;
  /** Visit steps: what each person says (or what you see) when you visit them. */
  visitLines?: Partial<Record<NpcId, string[]>>;
  /** Reach steps: what you see at each place. */
  spotLines?: Record<string, string>;
  /** Steps that finish by themselves (putting on the robe): what someone says when it's done, and who. */
  doneLines?: string[];
  doneSpeaker?: string;
}

export type ChapterId = "maren" | "tam" | "holt" | "greta" | "brann" | "rook" | "kael" | "wren" | "ysolde" | "moss" | "bryn" | "odo" | "bryn_bandits" | "kael_hunt"
  // The story (shared/story.ts): the Prologue, then Act 1.
  | "awakening" | "hall" | "lanterns" | "sweeper" | "blessing" | "oath"
  | "rounds" | "first_tithe" | "bless_fields" | "tonics" | "totem" | "ash_road" | "rebuild" | "holt_saw" | "odo_field" | "hollow_wolves" | "marens_question" | "thorn_light";

export interface Chapter {
  id: ChapterId;
  title: string;
  /** Who gives it: talk steps are with them. */
  giver: NpcId;
  /** Their name, for "Talk to Forester Holt". */
  name: string;
  /** Where to find them, for the 📜 tab. */
  where: string;
  steps: QuestStep[];
  /** A side quest: not one of the lessons (so "all lessons done" doesn't wait for it). */
  side?: boolean;
  /** Only offered once you reach this level in a skill (stage 12: some side quests need Renown). */
  requires?: { skill: SkillId; level: number };
  /** A story chapter (shared/story.ts), not a lesson. */
  act?: "prologue" | "act1";
  /** These chapters must be done first (story chapters, and lessons that build on another skill). */
  after?: ChapterId[];
  /** Story chapters: and this many trainers' lessons. */
  lessons?: number;
}

/** A skill's level, for chapters that need one (the server and client each pass their own). */
export type LevelOf = (skill: SkillId) => number;
/** Is this chapter's level gate met (or has it none)? */
export const gateMet = (c: Chapter, levelOf?: LevelOf) => !c.requires || (!!levelOf && levelOf(c.requires.skill) >= c.requires.level);

const WORN_ROD: Gift = { item: "rod_pine", durability: 8 };
const WORN_PICK: Gift = { item: "pickaxe_bronze_pine", durability: 15 };
const LOG: Gift = { item: "pine_logs" };
const BAR: Gift = { item: "bronze_bar" };
const MINNOW: Gift = { item: "minnow" };
const POT: Gift = { item: "pot_bronze", durability: 40 }; // Maren's old, well-used pot
const DAGGER: Gift = { item: "dagger_bronze_pine" };
const SLING: Gift = { item: "sling_bronze_pine" };
const STAFF: Gift = { item: "staff_bronze_pine" };
const POTION: Gift = { item: "health_potion" };
const AXE: Gift = { item: "axe_bronze_pine", durability: 60 }; // Holt's old, well-used axe
const WORM: Gift = { item: "worm" };
const SHOVEL: Gift = { item: "shovel_bronze_pine" };

const MAREN = "Old Maren";
const TAM = "Shopkeeper Tam";
const HOLT = "Forester Holt";
const GRETA = "Miner Greta";
const BRANN = "Smith Brann";
const ROOK = "Woodworker Rook";
const KAEL = "Huntmaster Kael";
const WREN = "Herbalist Wren";
const MOSS = "Alchemist Moss";
const VIAL_GIFT: Gift = { item: "vial" };
const YSOLDE = "Archmage Rowan";
const BRYN = "Captain Bryn";
const ODO = "Farmer Odo";

const LESSONS: Chapter[] = [
  // ---------------- Old Maren: Living off the land ----------------
  {
    id: "maren", title: "Living off the land", giver: "maren", name: MAREN, where: "by the pond in the Emberhall Training Ground, just east of the Emberhall",
    steps: [
      {
        task: `Talk to ${MAREN} by the pond in the Emberhall Training Ground (east of the Emberhall)`, goal: { kind: "talk" }, unlocks: ["fishing"],
        lines: [
          "Well now, a fresh face! I'm Maren. I fished the Glass River for forty years before my knees gave out. Now I teach here, with the other trainers.",
          "Everyone starts with empty hands, so let's begin with the oldest skill there is: fishing.",
          "This pond is stocked for practice. Click the water's edge. You've no rod, so it'll be slow. Bring me back one minnow.",
        ],
      },
      {
        task: "Catch a minnow by hand at the training ground's pond",
        goal: { kind: "gather", skill: "fishing", resource: "minnow", count: 1, byHand: true },
        hint: "The pond is right here beside me: click the water at its edge. By hand it takes a while, so be patient.",
      },
      {
        task: `Bring your minnow back to ${MAREN}`, goal: { kind: "talk" },
        need: { prefix: "minnow", line: "Where's my minnow? Catch one at the pond, then bring it here." },
        protect: ["minnow"],
        lines: [
          "Ha! Took you a while, didn't it? That's fishing by hand.",
          "Here, take my old rod. It's nearly worn out, but any tool on your belt makes you much faster at its job: rods for fishing, axes for chopping, pickaxes for mining.",
          "Click the rod in your bag and press \"Equip\". A tool only works when it's on your belt.",
        ],
        give: [WORN_ROD],
      },
      {
        task: "Equip the rod (click it in your bag, then Equip)", goal: { kind: "equip", tools: ["rod_"], names: "rod" },
        hint: "Click the rod in your bag, then press \"Equip\". It'll show up in the tool belt above your bag.",
        ensure: [WORN_ROD], protect: ["rod_"],
      },
      {
        task: "Fish until the rod breaks (watch the bar under it)", goal: { kind: "toolBreaks", tool: "rod" },
        hint: "Keep fishing with the rod on your belt until it snaps. The little bar under it shows how much it has left.",
        ensure: [WORN_ROD], protect: ["rod_"], needsTool: "rod",
      },
      {
        task: `Tell ${MAREN} your rod broke`, goal: { kind: "talk" },
        protect: ["rod_"],
        lines: [
          "Snapped, did it? Every tool wears down a little each time you use it: tools when you use them, weapons when you hit, armor when you get hit. It works just as well right up until it breaks.",
          "A broken tool isn't gone, though. It's in your bag, and Oswin the Repairer can fix it. He works at the Mages' Guild, the purple hall in Lower Town, in the south-west of the city. Walk onto its door to go in. It's a good walk, so you'll see a bit of Emberhold on the way.",
          "Take my rod to him. He's an old friend, so this first one's free. After that he charges a few coins, more for finer things.",
        ],
      },
      {
        task: "Get your rod repaired at the Mages' Guild (Lower Town, south-west of the city)", goal: { kind: "repair" },
        hint: "Oswin the Repairer is inside the Mages' Guild, the purple hall in Lower Town: go down the hill road to Market Square, take the south street, then turn west along Lower Town's long street. Click him, then Repair. The first one's free.",
        ensure: [{ item: "rod_pine", durability: 0 }], protect: ["rod_"],
      },
      {
        task: `Bring your mended rod back to ${MAREN}`, goal: { kind: "talk" },
        lines: [
          "Good as new! Better tools last longer: bronze is where everyone starts, iron lasts twice as long, and the finer metals longer still. A better wooden handle helps too. Fishing rods are all wood, so for those, the better the wood, the better the rod.",
          "Look at you, though: all that fishing raised your Minnow Mastery. Every kind of fish, log and ore has its own Mastery, and every time one goes up a level, you earn a Mastery point.",
          "Spend your points on upgrades, like faster fishing or a bigger cooking pot. Open the 📊 panel (bottom right), tap the 🌳 next to any skill, and pick an upgrade. Go on, spend your first point now.",
        ],
      },
      {
        task: "Spend a Mastery point (tap 📊, then a 🌳)", goal: { kind: "spendPoint" },
        hint: "Open the 📊 panel at the bottom right, tap the 🌳 next to a skill, and pick an upgrade. No points yet? Catch a few more minnows: each Mastery level gives you one.",
      },
      {
        task: `Tell ${MAREN} what you picked`, goal: { kind: "talk" }, unlocks: ["cooking"],
        lines: [
          "Good choice! And don't fret about picking wrong: resetting a tree is free, and all your points come back. Here's a few coins for learning that.",
          "Now, raw minnows won't keep you going for long. Take this pine log to the stove, right here beside me, and cook your fish into a stew. Pick Stew, tap your minnow to put it in the pot, and pick the Pine log to burn.",
        ],
        give: [LOG],
        coins: 25,
      },
      {
        // The first stew always burns (see BURN_UNTIL).
        task: "Cook a stew at the stove (Stew, put in your minnow, Pine log)", goal: { kind: "craft", skill: "cooking", prefix: "meal_stew_", count: 1, tries: true },
        hint: "Click the stove (the black one with the pot, right next to me). Pick Stew, tap your minnow to put it in the pot, pick the Pine log, then press Make 1.",
        ensure: [LOG, MINNOW], protect: ["minnow", "pine_logs"],
      },
      {
        task: `Tell ${MAREN} what happened`, goal: { kind: "talk" },
        lines: [
          "Burned it to a crisp, eh? Don't feel bad: everyone burns their first stew. When you fail, the fish and the log are gone, but you still learn a little.",
          "Here's the secret. Some tools make you faster, others make you succeed more often. Rods, axes and pickaxes are about speed. A pot, a hammer and tongs are about success.",
          "Cooking without a pot halves your chance. Take my old bronze pot and equip it, just like the rod. It's seen better days, but it'll do. Here's another log.",
        ],
        give: [POT, LOG],
      },
      {
        task: "Equip the pot (click it in your bag, then Equip)", goal: { kind: "equip", tools: ["pot_"], names: "pot" },
        hint: "Click the pot in your bag, then press \"Equip\".",
        ensure: [POT, LOG, MINNOW], protect: ["pot_", "minnow", "pine_logs"],
      },
      {
        task: "Cook a stew with the pot equipped", goal: { kind: "craft", skill: "cooking", prefix: "meal_stew_", count: 1 },
        hint: "Cook a stew at the stove with the pot on your belt. I'll keep an eye on it this time.",
        ensure: [POT, LOG, MINNOW], guaranteed: true, protect: ["pot_", "minnow", "pine_logs"], needsTool: "pot",
      },
      {
        task: `Show ${MAREN} your stew (don't eat it yet!)`, goal: { kind: "talk" },
        need: { prefix: "meal_", line: "Where's your stew? Cook one at the stove and bring it to me." },
        protect: ["meal_"],
        lines: [
          "Now that's a stew! Smells like my mother's kitchen.",
          "See the ⚡ bar at the top left? That's your stamina. Everything you do costs some: a fish costs 1, cooking 2, and chopping or mining 10.",
          "It comes back on its own, 1 every 30 seconds, but food is much faster. A raw minnow gives 2. A stew gives three times what its fish would, plus a bit from the fire. Go on, eat your stew, then come back to me.",
        ],
      },
      {
        task: "Eat your stew (click it in your bag, then Eat)", goal: { kind: "eat" },
        hint: "Click the stew in your bag and press Eat.",
        ensure: [{ item: FIRST_STEW }],
      },
      {
        task: `Go back to ${MAREN} for your reward`, goal: { kind: "talk" },
        lines: [
          "You've got the hang of living off the land: fish, cook, eat, and sell what you don't need.",
          "Here's your reward: an oak fishing rod and a brand new bronze pot. Faster fishing, and they'll last you a good long while. And some coins and a couple of stews for the road.",
          "Equip them both. My old pot goes back in your bag when you do.",
        ],
        give: [{ item: "rod_oak" }, { item: "pot_bronze" }, { item: SHOP_STEW, count: 2 }],
        coins: 50,
      },
      {
        task: "Equip the oak rod and the bronze pot", goal: { kind: "equip", tools: ["rod_oak", "pot_bronze"], names: "oak rod and bronze pot" },
        hint: "Click the oak fishing rod in your bag and press \"Equip\", then the same for the bronze pot.",
        protect: ["rod_", "pot_bronze"],
      },
      {
        task: `Talk to ${MAREN}`, goal: { kind: "talk" },
        lines: [
          "There, you've got the hang of living off the land: fish, cook, eat. Every skill belongs to a Discipline. Fishing is part of Endurance, which raises your max stamina, and Cooking is Dexterity, which lets you carry more and walk faster.",
          "Now meet the others. Every trainer in Emberhold teaches right here in the training ground: Forester Holt by the trees, Miner Greta by the rocks, Smith Brann at the furnace, Woodworker Rook at the workbench, Herbalist Wren by the dig patches, Alchemist Moss and Archmage Rowan by the alchemy table and the altar, Huntmaster Kael by the pens and Farmer Odo by his plots.",
          "Shopkeeper Tam keeps the General Store, at the top of Market Square, just down the hill road. Captain Bryn stands by the bounty board in the square.",
          "Anyone with a ❗ over their head has a lesson for you, and each one ends with a reward. Learn them all, and Keeper Aldric will want a word. Your 📜 Quests tab keeps track.",
        ],
        coins: 50,
      },
    ],
  },

  // ---------------- Shopkeeper Tam: Buying and selling ----------------
  {
    id: "tam", title: "Buying and selling", giver: "tam", name: TAM, where: "in the General Store, at the top of Market Square",
    steps: [
      {
        task: `Talk to ${TAM} at the General Store`, goal: { kind: "talk" }, unlocks: ["trading"],
        lines: [
          "Ah, a customer! I'm Tam. I'll buy anything you bring me, but the trainers only buy what their own trade makes: logs for Holt, ore for Greta, and so on. They all pay the same price.",
          "Every coin you earn selling trains your Trading skill. Trading is part of Charisma, and the higher your Charisma, the more shops pay you and the less they charge.",
          "Let's see you haggle. Buy something from me first: open my Buy tab. A potato will do.",
        ],
      },
      {
        task: "Buy something from any shop (open its Buy tab)", goal: { kind: "buy", count: 1 },
        hint: "Click me, open the Buy tab, and buy something cheap, like a potato.",
      },
      {
        task: "Sell 3 things to any shop", goal: { kind: "sell", count: 3 },
        hint: "Click me (or a trainer), then tap things in your bag to sell them. A stack asks how many: try the slider to sell just part of it.",
      },
      {
        task: `Go back to ${TAM} for your reward`, goal: { kind: "talk" },
        lines: [
          "A natural trader! Remember: tap 🔒 on your bag to keep things safe from Sell all.",
          "Here's a little something for your trouble. Come back any time.",
        ],
        coins: 50,
      },
    ],
  },

  // ---------------- Forester Holt: The woodcutter's start ----------------
  {
    id: "holt", title: "The woodcutter's start", giver: "holt", name: HOLT, where: "by the practice trees in the Emberhall Training Ground",
    steps: [
      {
        task: `Talk to ${HOLT} in the training ground`, goal: { kind: "talk" }, unlocks: ["woodcutting"],
        lines: [
          "Come in, come in! Holt's the name, and trees are the game. I'll teach you Woodcutting.",
          "Woodcutting is part of Endurance, like Fishing and Mining. Every kind of log has its own Mastery, so the more of one you chop, the faster it goes.",
          "Let's start the hard way: chop 3 logs by hand. The pointy pine trees are the practice grove, right behind me.",
        ],
      },
      {
        task: "Chop 3 logs by hand (no axe on your belt)", goal: { kind: "gather", skill: "woodcutting", count: 3, byHand: true },
        hint: "Click a tree to chop it. Pine trees are the pointy ones, in the practice grove behind me.",
      },
      {
        task: `Go back to ${HOLT}`, goal: { kind: "talk" },
        lines: [
          "Sore hands? Good. Now you know why folks use tools.",
          "Here's my old bronze axe. Equip it and chop 5 logs. Chopping costs 10 stamina a log, so keep some food handy. Logs are heavy too (2 kg each): the ⚖️ bar under your bag shows how much more you can carry.",
        ],
        give: [AXE],
      },
      {
        task: "Equip the bronze axe", goal: { kind: "equip", tools: ["axe_"], names: "axe" },
        hint: "Click the axe in your bag and press \"Equip\".",
        ensure: [AXE], protect: ["axe_"],
      },
      {
        task: "Chop 5 logs with your axe", goal: { kind: "gather", skill: "woodcutting", count: 5, withTool: true },
        hint: "Chop trees with the axe on your belt. Remember to eat if you get tired.",
        ensure: [AXE], needsTool: "axe", protect: ["axe_"],
      },
      {
        task: `Sell some logs to ${HOLT}`, goal: { kind: "sell", what: "woodcutting", count: 1 },
        hint: "Click me, then click logs in your bag to sell them. I buy logs and axes.",
      },
      {
        task: `Go back to ${HOLT} for your reward`, goal: { kind: "talk" },
        lines: [
          "Look at you, a proper woodcutter!",
          "Here's a new bronze axe with a good oak handle: it chops faster and lasts longer than my old one. Better trees need a higher Woodcutting level: oaks at 5, and finer woods after that.",
        ],
        give: [{ item: "axe_bronze_oak" }],
        coins: 100,
      },
    ],
  },

  // ---------------- Miner Greta: Into the rocks ----------------
  {
    id: "greta", title: "Into the rocks", giver: "greta", name: GRETA, where: "by the practice rocks in the Emberhall Training Ground",
    steps: [
      {
        task: `Talk to ${GRETA} in the training ground`, goal: { kind: "talk" }, unlocks: ["mining"],
        lines: [
          "You want to learn Mining? Good. It's hard work, but rocks don't run away. Mining is part of Endurance.",
          "These practice rocks were hauled in from the quarry, just for Hopefuls like you. Here's a worn bronze pickaxe. Equip it, then mine 2 copper ore from the orange-flecked rocks. Eat when you get tired.",
        ],
        give: [WORN_PICK],
      },
      {
        task: "Equip the pickaxe", goal: { kind: "equip", tools: ["pickaxe_"], names: "pickaxe" },
        hint: "Click the pickaxe in your bag and press \"Equip\".",
        ensure: [WORN_PICK], protect: ["pickaxe_"],
      },
      {
        task: "Mine 2 copper ore (the orange-flecked practice rocks)", goal: { kind: "gather", skill: "mining", resource: "copper", count: 2 },
        hint: "Click a copper rock (grey with orange flecks) by Greta in the training ground, with the pickaxe on your belt.",
        ensure: [WORN_PICK], needsTool: "pickaxe", protect: ["pickaxe_"],
      },
      {
        task: `Show ${GRETA} your copper ore`, goal: { kind: "talk" },
        need: { prefix: "copper_ore", line: "Where's your copper? Mine some from the practice rocks and bring it here." },
        lines: [
          "Good copper! Tools are made of metal, and the first metal is bronze: 1 copper ore and 1 tin ore make a bronze bar.",
          "Now get 2 tin ore to go with it. Tin rocks are the pale, silvery ones right next to the copper. Or if you're in a hurry, buy them from my Buy tab.",
        ],
      },
      {
        task: "Get 2 tin ore to go with your copper (mine it, or buy it from Greta)", goal: { kind: "have", items: { copper_ore: 2, tin_ore: 2 } },
        hint: "Mine the pale, silvery tin rocks by Greta, or click her, open the Buy tab, and buy tin ore. You need 2 copper ore too.",
        protect: ["copper_ore", "tin_ore"],
      },
      {
        task: `Go back to ${GRETA} for your reward`, goal: { kind: "talk" },
        lines: [
          "That's the makings of two bronze bars. Take them to Smith Brann if you haven't learned Smelting yet.",
          "And here's a new bronze pickaxe of my own making, with an oak handle. Faster mining, and it lasts.",
        ],
        give: [{ item: "pickaxe_bronze_oak" }],
        coins: 100,
      },
    ],
  },

  // ---------------- Smith Brann: Hammer and fire ----------------
  {
    id: "brann", title: "Hammer and fire", giver: "brann", name: BRANN, where: "at the furnace and anvil in the Emberhall Training Ground", after: ["greta"],
    steps: [
      {
        task: `Talk to ${BRANN} by the furnace in the training ground`, goal: { kind: "talk" }, unlocks: ["smithing", "smelting"],
        lines: [
          "Mind the sparks! I'm Brann. I'll teach you Smithing at the anvil and Smelting at the furnace. Both are part of Dexterity.",
          "A tool is a head and a handle: 1 metal bar for the head, and 1 log for the handle. A hammer on your belt helps you smith, the way a pot helps you cook.",
          "Here's a bronze bar and a log. Make yourself a bronze hammer at the anvil.",
        ],
        give: [BAR, LOG],
      },
      {
        task: "Make a bronze hammer at the anvil (1 bronze bar + 1 log)", goal: { kind: "craft", skill: "smithing", prefix: "hammer_bronze_", count: 1 },
        hint: "Click the anvil, pick Hammer, Bronze and Pine, then press Make 1. I'll guide your hand this first time.",
        ensure: [BAR, LOG], guaranteed: true, protect: ["bronze_bar", "pine_logs"],
      },
      {
        task: "Equip the hammer", goal: { kind: "equip", tools: ["hammer_"], names: "hammer" },
        hint: "Click the hammer in your bag and press \"Equip\".",
        protect: ["hammer_"],
      },
      {
        task: `Go back to ${BRANN}`, goal: { kind: "talk" },
        lines: [
          "Now for the fire. Every bar takes 2 ores: a bronze bar is 1 copper and 1 tin. Tongs on your belt help you smelt.",
          "Here's 2 copper and 2 tin. Smelt 2 bronze bars at the furnace, then make bronze platelegs at the anvil from both bars. I'll guide your hand.",
        ],
        give: [{ item: "copper_ore", count: 2 }, { item: "tin_ore", count: 2 }],
      },
      {
        task: "Smelt 2 bronze bars at the furnace", goal: { kind: "craft", skill: "smelting", prefix: "bronze_bar", count: 2 },
        hint: "Click the furnace, pick Bronze, and press Make all.",
        ensure: [{ item: "copper_ore", count: 2 }, { item: "tin_ore", count: 2 }], guaranteed: true, protect: ["copper_ore", "tin_ore", "bronze_bar"],
      },
      {
        task: "Make bronze platelegs at the anvil (2 bars)", goal: { kind: "craft", skill: "smithing", prefix: "platelegs_bronze", count: 1 },
        hint: "Click the anvil, pick Armor, then Platelegs and Bronze, and press Make 1.",
        ensure: [{ item: "bronze_bar", count: 2 }], guaranteed: true, protect: ["bronze_bar"],
      },
      {
        task: `Show ${BRANN} your platelegs`, goal: { kind: "talk" },
        need: { prefix: "platelegs_bronze", line: "Where are your platelegs? Make them at the anvil from 2 bronze bars." },
        protect: ["platelegs_bronze"],
        lines: [
          "Fine work! Weapons and armor are made just like tools, and they wear out like tools too, so keep a spare.",
          "Take these bronze tongs and a bronze hammer with a good oak handle. With those on your belt, you'll fail much less at the furnace and the anvil.",
        ],
        give: [{ item: "tongs_bronze" }, { item: "hammer_bronze_oak" }],
        coins: 150,
      },
    ],
  },

  // ---------------- Woodworker Rook: Handy work ----------------
  {
    id: "rook", title: "Handy work", giver: "rook", name: ROOK, where: "at the workbench in the Emberhall Training Ground", after: ["holt"],
    steps: [
      {
        task: `Talk to ${ROOK} at the workbench in the training ground`, goal: { kind: "talk" }, unlocks: ["handicraft"],
        lines: [
          "Hello there! I'm Rook. I make the little things that make life easier. Handicraft is part of Dexterity.",
          "For now that's fishing bait: worms, food scraps and feathers turn into bait that makes fish bite sooner. Worms turn up while you chop and mine, and cooking leaves scraps.",
          "Here are 2 worms. Make some worm bait at my workbench.",
        ],
        give: [WORM, WORM],
      },
      {
        task: "Make worm bait at the workbench", goal: { kind: "craft", skill: "handicraft", prefix: "bait_worm", count: 1 },
        hint: "Click the workbench, pick Worm bait, and press Make 1.",
        ensure: [{ item: "worm", count: 2 }], guaranteed: true, protect: ["worm"],
      },
      {
        task: `Go back to ${ROOK} for your reward`, goal: { kind: "talk" },
        lines: [
          "Lovely! Bait goes in your bag, and it's used up as you fish. Better bait comes with a higher Handicraft level.",
          "Here are a few more worms and some coins. Come and sell me your feathers and hides any time.",
        ],
        give: [{ item: "worm", count: 4 }],
        coins: 50,
      },
    ],
  },

  // ---------------- Huntmaster Kael: Standing your ground ----------------
  {
    id: "kael", title: "Standing your ground", giver: "kael", name: KAEL, where: "by the pens in the Emberhall Training Ground",
    steps: [
      {
        task: `Talk to ${KAEL} by the pens in the training ground`, goal: { kind: "talk" }, unlocks: ["melee", "defense"],
        lines: [
          "So you want to fight? I'm Kael. Out past the city walls is the Dark Forest. Wolves, goblins, giant spiders and worse, and they attack anyone who wanders in. The gates are shut for now, so we'll train right here in the pens.",
          "See the ❤ bar at the top left? That's your health. Fighting skills are Strength, and Strength raises your max health. If it runs out, you'll wake up at the Heart Shrine in the Emberhall, a bit shaken but with all your things.",
          "Let's start small. With nothing in your hand you fight with your fists: it works, but only just. So here's a bronze dagger. Weapons and armor go in your gear strip, under the tool belt. Click the dagger in your bag and press \"Equip\".",
        ],
        give: [DAGGER],
      },
      {
        task: "Equip the dagger (click it in your bag, then Equip)", goal: { kind: "gear", items: ["dagger_"], names: "dagger" },
        hint: "Click the dagger in your bag and press \"Equip\". It goes in the Weapon slot of your gear strip.",
        ensure: [DAGGER], protect: ["dagger_"],
      },
      {
        task: "Defeat 3 chickens (in the coop beside Kael)", goal: { kind: "kill", monster: "chicken", count: 3 },
        hint: "The chickens peck about in the fenced coop right next to me. Click one to attack it. They never fight back.",
        ensure: [DAGGER], protect: ["dagger_"], fightWith: "weapon",
      },
      {
        task: `Go back to ${KAEL}`, goal: { kind: "talk" },
        lines: [
          "Well done. Every hit with a blade trains Melee. Your dagger has its own Mastery, and so does every kind of monster: the more you fight one, the more often you hit it and the more it drops.",
          "Rats are next, and they bite back! Being attacked trains your Defense, and armor makes monsters miss. Here's a bronze helmet and a bronze shield. Wear them both.",
        ],
        give: [{ item: "helmet_bronze" }, { item: "shield_bronze" }],
      },
      {
        task: "Equip the helmet and the shield", goal: { kind: "gear", items: ["helmet_", "shield_"], names: "helmet and shield" },
        hint: "Click the helmet in your bag and press \"Equip\", then the same for the shield.",
        ensure: [{ item: "helmet_bronze" }, { item: "shield_bronze" }], protect: ["helmet_", "shield_"],
      },
      {
        task: "Defeat 2 rats (in the rat pit, below the coop)", goal: { kind: "kill", monster: "rat", count: 2 },
        hint: "The rats scurry about in the rat pit, just below the chicken coop. They bite back, so watch your ❤ health.",
        ensure: [DAGGER], protect: ["dagger_", "helmet_", "shield_"], fightWith: "weapon",
      },
      {
        task: `Go back to ${KAEL}`, goal: { kind: "talk" },
        lines: [
          "A few bites, eh? Health comes back on its own, but very slowly. Food is for stamina, not health. For health you want a potion.",
          "Here are two health potions. Drink one now so you know how. I sell more, and some monsters drop them.",
        ],
        give: [POTION, POTION],
      },
      {
        task: "Drink a health potion (click it in your bag, then Drink)", goal: { kind: "drink" },
        hint: "Click a health potion in your bag and press Drink.",
        ensure: [POTION],
      },
      {
        task: `Talk to ${KAEL} about Ranged`, goal: { kind: "talk" }, unlocks: ["ranged"],
        lines: [
          "Now let's hit things from a distance. That's Ranged: slings, darts and bows. It's part of Strength too.",
          "Here's a bronze sling. Hold it and defeat 2 chickens without getting close.",
        ],
        give: [SLING],
      },
      {
        task: "Equip the sling", goal: { kind: "gear", items: ["sling_"], names: "sling" },
        hint: "Click the sling in your bag and press \"Equip\".",
        ensure: [SLING], protect: ["sling_"],
      },
      {
        task: "Defeat 2 chickens with the sling", goal: { kind: "kill", monster: "chicken", count: 2, style: "ranged" },
        hint: "With the sling in your hand, click a chicken.",
        ensure: [SLING], protect: ["sling_"], fightWith: "ranged",
      },
      {
        task: `Go back to ${KAEL}`, goal: { kind: "talk" }, opensGate: true,
        lines: [
          "Good shooting! One last test before you're ready for the forest.",
          "Take these bronze platelegs and 3 more potions. Hold the weapon you like best and clear 3 rats out of the pit. Fight them like they're wolves, and drink a potion if it goes badly.",
          "When the city gates open, I'll let you through the Dark Forest's gate too.",
        ],
        give: [{ item: "platelegs_bronze" }, POTION, POTION, POTION],
      },
      {
        task: "Defeat 3 rats in the rat pit with your best weapon", goal: { kind: "kill", monster: "rat", count: 3 },
        hint: "The rat pit is just below the chicken coop. Hold the weapon you like best, and drink a potion if your health gets low!",
        fightWith: "weapon",
      },
      {
        task: `Go back to ${KAEL} for your reward`, goal: { kind: "talk" }, unlocks: ["hunting"],
        lines: [
          "Not a rat left standing! You've the makings of a hunter, so I'll teach you Hunting. It's part of Endurance.",
          "Every monster you defeat now trains Hunting, even if a friend helped: you each get a share, by how much of its health you took. The better a hunter you are, the more often monsters drop things.",
          "Here's a bronze platebody and bronze boots. With those you've a full bronze set: helmet, platebody, platelegs, boots and shield. And some coins.",
          "The forest gets harder the deeper you go, so train up, make better gear, and keep potions handy.",
        ],
        give: [{ item: "platebody_bronze" }, { item: "boots_bronze" }],
        coins: 300,
      },
    ],
  },

  // ---------------- Herbalist Wren: What the ground gives ----------------
  {
    id: "wren", title: "What the ground gives", giver: "wren", name: WREN, where: "by the dig patches in the Emberhall Training Ground",
    steps: [
      {
        task: `Talk to ${WREN} in the training ground`, goal: { kind: "talk" }, unlocks: ["foraging"],
        lines: [
          "Oh! Mind the drying herbs. I'm Wren. Everyone else round here chops and mines and fishes, but the best things grow under your feet.",
          "See the little patches of turned earth that glint in the grass? Those are dig patches. Dig one with a shovel and you'll turn up roots, worms and mushrooms, and herbs once you know what to look for. That's Foraging, part of Endurance.",
          "Here's a bronze shovel. Equip it like any other tool.",
        ],
        give: [SHOVEL],
      },
      {
        task: "Equip the shovel (click it in your bag, then Equip)", goal: { kind: "equip", tools: ["shovel_"], names: "shovel" },
        hint: "Click the shovel in your bag, then press \"Equip\".",
        ensure: [SHOVEL], protect: ["shovel_"],
      },
      {
        task: "Dig up 3 things from glinting dig patches", goal: { kind: "gather", skill: "foraging", count: 3, withTool: true },
        hint: "The dig patches are all round me in the training ground. Click one that glints. Once it's dug out, it glints again after a while.",
        ensure: [SHOVEL], protect: ["shovel_"], needsTool: "shovel",
      },
      {
        task: `Show ${WREN} what you found`, goal: { kind: "talk" },
        lines: [
          "Not bad for a first dig! Worms make good bait, and roots and mushrooms go in the pot.",
          "The better you get, the better the finds: sage, ginseng, wild honeycomb, blue lotus, even truffles. And moonpetal only opens at night, so dig after dark.",
          "I'll buy anything you dig up, and I sell shovels. Smith Brann can make you a better one, just like an axe.",
        ],
        coins: 100,
      },
    ],
  },

  // ---------------- Archmage Rowan: Sparks and spells ----------------
  {
    id: "ysolde", title: "Sparks and spells", giver: "archmage", name: YSOLDE, where: "by the enchanting altar in the Emberhall Training Ground", after: ["kael"],
    steps: [
      {
        task: `Talk to ${YSOLDE} in the training ground`, goal: { kind: "talk" }, unlocks: ["magic"],
        lines: [
          "Welcome, young spark. The Mages' Guild sends me up here to teach the Emberborn. I'll teach you Spellcasting. It's part of Wisdom, which raises your max mana.",
          "Spells need a staff in your hand, and they use mana, the blue 🔮 bar under your stamina. Mana comes back on its own, 1 every 6 seconds.",
          "Here's a bronze staff. Your spells sit on the spell bar under your gear. Firebolt flies from a staff: hold this one and go defeat 2 chickens with it.",
        ],
        give: [STAFF],
      },
      {
        task: "Equip the staff", goal: { kind: "gear", items: ["staff_"], names: "staff" },
        hint: "Click the staff in your bag and press \"Equip\".",
        ensure: [STAFF], protect: ["staff_"],
      },
      {
        task: "Defeat 2 chickens with Firebolt (hold the staff)", goal: { kind: "kill", monster: "chicken", count: 2, style: "magic" },
        hint: "With the staff in your hand and Firebolt picked on your spell bar, click a chicken. If you run out of mana, wait a little and it comes back.",
        ensure: [STAFF], protect: ["staff_"], fightWith: "magic",
      },
      {
        task: `Go back to ${YSOLDE} for your reward`, goal: { kind: "talk" },
        lines: [
          "A natural! Each spell has its own Mastery, and a staff's metal makes your spells hit harder.",
          "You're welcome in the guild now: rent space in our enchanted chest, or take magic jobs from the guild board to rise in rank. Talk to me again any time.",
        ],
        coins: 150,
      },
      // Enchanting (shared/enchanting.ts) came later: these steps follow on.
      {
        task: `Ask ${YSOLDE} about the altar`, goal: { kind: "talk" }, unlocks: ["enchanting"],
        lines: [
          "You've seen the altar by the door? That's for Enchanting. Ember trap a monster, defeat it, and its ember fills a refined emberstone. The altar pours that ember into a staff, armor or a tool.",
          "A staff also takes a cut gem: ruby burns, sapphire chills, emerald poisons, topaz throws lightning and amethyst drinks life. Armor and tools pick their own magic.",
          "Here's a small refined emberstone, already full. Enchant something with it: a tool on your belt is a fine start (take it off your belt first, so it's in your bag).",
        ],
        give: [{ item: "soulgem_5_25" }],
      },
      {
        task: "Enchant something at the altar (beside Rowan in the training ground)", goal: { kind: "enchant" },
        hint: "Put the item in your bag, click the altar, pick it and the refined emberstone, then Enchant.",
        ensure: [{ item: "soulgem_5_25" }],
      },
      {
        task: `Show ${YSOLDE} your enchantment`, goal: { kind: "talk" },
        lines: [
          "Beautiful. Bigger, fuller refined emberstones make stronger magic. Brann cuts emberstone into gems, and the Crystal Cave has plenty.",
          "One more thing: once your Spellcasting reaches 18 you'll know Mend, to fix your own gear with a little of what it's made of.",
        ],
        coins: 200,
      },
    ],
  },

  // ---------------- Alchemist Moss: A drop of something ----------------
  {
    id: "moss", title: "A drop of something", giver: "moss", name: MOSS, where: "by the alchemy table in the Emberhall Training Ground", after: ["wren"],
    steps: [
      {
        task: `Talk to ${MOSS} in the training ground`, goal: { kind: "talk" }, unlocks: ["alchemy"],
        lines: [
          "Careful, that one bubbles. I'm Moss. Rowan lets me keep my table in the corner of the guild, as long as nothing explodes.",
          "Alchemy is part of Wisdom. Two ingredients make a potion: a red cap mushroom and some slime goo make a health potion. A third, like sage, adds something extra. Every potion needs an empty vial, and I sell those.",
          "Here's a red cap, some slime goo and a vial. Use the alchemy table next to me: tap the two ingredients to put them in, then brew.",
        ],
        give: [{ item: "red_cap" }, { item: "slime_goo" }, VIAL_GIFT],
      },
      {
        task: "Brew a health potion at the alchemy table", goal: { kind: "craft", skill: "alchemy", prefix: "potion_health", count: 1 },
        hint: "Click the alchemy table next to me. Tap the red cap and the slime goo, then press Make 1. If it spoils, I'll give you more.",
        ensure: [{ item: "red_cap" }, { item: "slime_goo" }, VIAL_GIFT], protect: ["red_cap", "slime_goo", "vial"], guaranteed: true,
      },
      {
        task: "Drink a potion (click it in your bag, then Drink)", goal: { kind: "drink" },
        hint: "Click your potion in your bag and press Drink. Potions stack 10 to a slot, and you need a moment between them.",
        ensure: [{ item: "potion_health" }],
      },
      {
        task: `Go back to ${MOSS} for your reward`, goal: { kind: "talk" },
        lines: [
          "Not bad! The better you get at Alchemy, the stronger your potions are when you drink them.",
          "Stamina, mana, strength, swiftness, night sight... the recipes are all at the table, as you learn them. And between you and me, a few aren't written down anywhere. Try mixing things and see what happens.",
          "Herbalist Wren digs up most of what you need, and the rest comes off monsters. Here are some vials to get you going.",
        ],
        give: [{ item: "vial", count: 5 }],
        coins: 120,
      },
    ],
  },

  // ---------------- Captain Bryn: Odd jobs ----------------
  {
    id: "bryn", title: "Odd jobs", giver: "bryn", name: BRYN, where: "by the bounty board in Market Square", after: ["tam"],
    steps: [
      {
        task: `Talk to ${BRYN} by the bounty board`, goal: { kind: "talk" }, opensBoard: true, unlocks: ["renown"],
        lines: [
          "Captain Bryn, at your service. I keep the bounty board. Folk pin up jobs there: bring the full amount and they pay double what a shop would, plus XP.",
          "Every bounty you finish trains Renown, part of Charisma. The more folk know your name, the better.",
          "Open the 📜 Quests tab, bottom right. It shows your lessons and every bounty on the board. Tap a bounty to track it, and it shows up next to your health.",
        ],
      },
      {
        task: "Track a bounty (tap 📜 Quests, then tap a bounty)", goal: { kind: "track" },
        hint: "Tap the 📜 Quests tab at the bottom right, then tap one of the bounties in it. It'll show up next to your health.",
      },
      {
        task: "Finish a bounty and hand it in at the board", goal: { kind: "bounty", count: 1 },
        hint: "Gather or make what your bounty asks for, then click the bounty board and press Hand in. Too hard? Press Refresh on the board for new ones.",
      },
      {
        task: `Go back to ${BRYN} for your reward`, goal: { kind: "talk" },
        lines: [
          "Your first bounty! See? Honest work, and good pay.",
          "The board always has 5 jobs, and a new one goes up for every one you finish. Tap a quest or a bounty in the 📜 tab any time to switch what you're tracking.",
        ],
        coins: 100,
      },
    ],
  },

  // ---------------- Farmer Odo: Something to grow (shared/farming.ts) ----------------
  {
    id: "odo", title: "Something to grow", giver: "odo", name: ODO, where: "by his plots in the Emberhall Training Ground",
    steps: [
      {
        task: `Talk to ${ODO} in the training ground`, goal: { kind: "talk" }, unlocks: ["farming"],
        lines: [
          "Hello there! I'm Odo, down from the allotments to teach. I grow things, and I'll teach you to grow them too. That's Farming, part of Endurance.",
          "See those fallow lots? Each one can be somebody's plot. A plot starts small, 2 by 2, and I'll let it grow to 6 by 6 if you pay me for the land.",
          "Here are 4 seed potatoes. I'll give you your first plot for free: open my shop and press Get a plot.",
        ],
        give: [{ item: "seed_potato", count: 4 }],
      },
      {
        task: `Get a plot from ${ODO} (talk to him, then press Get a plot)`, goal: { kind: "plot" },
        hint: "Open my shop's Buy tab and press Get a plot. Your first one's on me.",
      },
      {
        task: "Plant 4 seed potatoes in your plot", goal: { kind: "plant", count: 4 },
        hint: "Click your plot (the brown soil with your name on it). You'll plant a seed on each empty patch, one after another.",
        ensure: [{ item: "seed_potato" }],
      },
      {
        task: "Harvest your potatoes when they're ripe (about 10 minutes)", goal: { kind: "harvest", count: 1 },
        hint: "Potatoes take about 10 minutes, even if you go off and do something else, or log out. When they're ripe, click your plot to dig them up.",
      },
      {
        task: `Go back to ${ODO}`, goal: { kind: "talk" },
        lines: [
          "Look at those! Now you're a farmer.",
          "Sometimes a harvest gives you a seed back. Better seeds unlock as your Farming goes up: carrots, onions, wheat, and even ginseng and blue lotus for the alchemists.",
          "Your crops grow while you're away, and so does your health. When you want more room, come and pay me to make your plot bigger. And for a few gold I can link the chest outside to your enchanted chest at the Mages' Guild.",
        ],
        coins: 200,
      },
    ],
  },

  // ---------------- Group quest: Kael's Wolf Hunt (needs Hunting 5; best with a party) ----------------
  {
    id: "kael_hunt", title: "The Wolf Hunt", giver: "kael", name: KAEL, where: "in his lodge in the Lower Town",
    side: true, requires: { skill: "hunting", level: 5 },
    steps: [
      {
        task: `Talk to ${KAEL} about the wolf den`, goal: { kind: "talk" }, unlocks: ["leadership"],
        lines: [
          "You've got the hang of hunting. Now I need help with something bigger.",
          "A pack has dug a den in the Dark Forest, south-west of the gate path, and its alpha is the biggest wolf I've ever seen. It's too much for one hunter.",
          "Get some friends together: click another player to invite them to a party. Whoever leads learns Leadership, part of Charisma. Kills count for everyone in the party who's close by.",
          "Clear 4 wolves from the den, then bring down the alpha. You can try it alone, but take every potion you have.",
        ],
      },
      {
        task: "Defeat 4 wolves at the den (south-west of the gate path)", goal: { kind: "kill", monster: "wolf", count: 4 },
        hint: "The den is south-west of the path through the Dark Forest. Bring friends: party kills count for everyone close by.",
        fightWith: "weapon",
      },
      {
        task: "Defeat the alpha wolf", goal: { kind: "kill", monster: "alpha_wolf", count: 1 },
        hint: "The alpha's in the middle of the den. It hits hard and takes a lot of beating, so go with a party if you can, and keep potions handy.",
        fightWith: "weapon",
      },
      {
        task: `Go back to ${KAEL}`, goal: { kind: "talk" },
        lines: [
          "The alpha's down? The farm and the road will be safer for it. Well hunted!",
          "Everyone who hunted it with you gets the same from me: here's a leather jerkin and your pay. The pack will find a new alpha in time, so keep your bow strung.",
        ],
        give: [{ item: "platebody_leather" }],
        coins: 1500,
      },
    ],
  },

  // ---------------- Side quest: Captain Bryn's Ashbound raider trouble (needs Renown 10) ----------------
  {
    id: "bryn_bandits", title: "Highway robbery", giver: "bryn", name: BRYN, where: "by the bounty board in Market Square",
    side: true, requires: { skill: "renown", level: 10 },
    steps: [
      {
        task: `Talk to ${BRYN} about the Ashbound raiders`, goal: { kind: "talk" },
        lines: [
          "You've made a name for yourself, so I've a job I wouldn't give just anyone.",
          "Ashbound raiders deep in the Dark Forest, far south, have been robbing the carts on their way to town. The Emberhall wants them gone. They hit hard, so go well armed and take potions.",
          "Defeat 4 of them, and bring me 2 of the rings they've stolen.",
        ],
      },
      {
        task: "Defeat 4 Ashbound raiders (deep in the Dark Forest, far south)", goal: { kind: "kill", monster: "bandit", count: 4 },
        hint: "The Ashbound raiders are deep in the south of the Dark Forest. They hit hard: wear your best armor and keep potions handy.",
        fightWith: "weapon",
      },
      {
        task: "Get 2 stolen rings from Ashbound raiders", goal: { kind: "have", items: { stolen_ring: 2 } },
        hint: "The raiders sometimes drop the rings they've stolen. Keep at it!",
      },
      {
        task: `Go back to ${BRYN}`, goal: { kind: "talk" },
        lines: [
          "Two rings! The merchants will sleep easier tonight. Keep the rings: they've been paid out by the guild already.",
          "Here's a steel helmet from the watch's own stores, and your pay.",
        ],
        give: [{ item: "helmet_steel" }],
        coins: 3000,
      },
    ],
  },
];

/** Every chapter: the Prologue's start, the lessons, the Prologue's end, then Act 1. */
export const CHAPTERS: Chapter[] = [...PROLOGUE_START, ...LESSONS, ...PROLOGUE_END, ...ACT_ONE];
// The trainers' story lines: the last thing they say in their lesson.
for (const c of LESSONS) {
  const line = TRAINER_LINES[c.id];
  const last = [...c.steps].reverse().find((st) => st.goal.kind === "talk" && st.lines);
  if (line && last) last.lines = [...last.lines!, line];
}
export const CHAPTER_IDS = CHAPTERS.map((c) => c.id);
export const chapterById = (id: ChapterId) => CHAPTERS.find((c) => c.id === id)!;
/** The chapter a person gives, if any: one you've started, else one you can start (story first), else the first you haven't done, else their first. */
export const chapterOf = (npc: string, q?: QuestProgress, levelOf?: LevelOf) => {
  const mine = CHAPTERS.filter((c) => c.giver === npc);
  if (!q) return mine[0] ?? null;
  const todo = mine.filter((c) => !chapterDone(q, c.id));
  const startable = (c: Chapter) => chapterOpen(q, c.id) && gateMet(c, levelOf);
  return todo.find((c) => c.id === q.active) ?? todo.find((c) => q.ch[c.id]) ?? todo.find((c) => c.act && startable(c))
    ?? todo.find(startable) ?? todo[0] ?? mine[0] ?? null;
};

/** How far along one chapter is: which step, and how far along it (e.g. 2 of 3 logs). */
export interface ChapterProgress { step: number; count: number; /** Visit and reach steps: who or where you've been so far. */ got?: string[] }

/** Where a character is in the main quest. */
export interface QuestProgress {
  /** The chapter the tracker shows and events count toward (null between chapters). */
  active: ChapterId | null;
  /** Chapters you've started. Missing = not started yet. */
  ch: Partial<Record<ChapterId, ChapterProgress>>;
  /** Skills learned before chapters existed (moved over from older saves). */
  taught?: SkillId[];
  /** The gate was opened before chapters existed (older saves). */
  gate?: boolean;
}

export const newQuestProgress = (): QuestProgress => ({ active: "awakening", ch: { awakening: { step: 0, count: 0 } } });

export const chapterStarted = (q: QuestProgress, id: ChapterId) => !!q.ch[id];
export const chapterDone = (q: QuestProgress, id: ChapterId) => (q.ch[id]?.step ?? -1) >= chapterById(id).steps.length;
export const marenDone = (q: QuestProgress) => chapterDone(q, "maren");
/** Every lesson finished (the story goes on separately). */
export const tutorialDone = (q: QuestProgress) => CHAPTERS.every((c) => c.side || c.act || chapterDone(q, c.id));
/** How many trainers' lessons you've finished (not Maren's, not side quests). */
export const lessonsDone = (q: QuestProgress) => CHAPTERS.filter((c) => !c.act && !c.side && c.id !== "maren" && chapterDone(q, c.id)).length;
/**
 * Can you start this chapter now? The Prologue's start comes first, then
 * Maren's lessons, then the trainers'. Story chapters wait for the ones
 * they come `after` (and for some lessons).
 */
export function chapterOpen(q: QuestProgress, id: ChapterId): boolean {
  const c = chapterById(id);
  if (c.act) return (c.after ?? []).every((a) => chapterDone(q, a)) && lessonsDone(q) >= (c.lessons ?? 0);
  if (id === "maren") return !!q.ch.maren || chapterDone(q, "sweeper");
  // Lessons come in a sensible order: one skill feeds the next (mine ore before you smith it).
  return !!q.ch[id] || (marenDone(q) && (c.after ?? []).every((a) => chapterDone(q, a)));
}
/** Why a chapter isn't open yet: "Opens after The Oath of the Flame". */
export function opensAfter(q: QuestProgress, id: ChapterId): string {
  const c = chapterById(id);
  if (!c.act) {
    if (id === "maren") return "Opens after The Training Ground";
    if (!marenDone(q)) return `Opens after ${GUIDE_NAME}'s lessons`;
    const first = (c.after ?? []).filter((a) => !chapterDone(q, a)).map((a) => `${chapterById(a).name}'s lesson`);
    return first.length ? `Opens after ${first.join(" and ")}` : "";
  }
  const left = (c.after ?? []).filter((a) => !chapterDone(q, a));
  const story = left.filter((a) => chapterById(a).act), lessons = left.length - story.length;
  const missing = story.map((a) => chapterById(a).title);
  // A long list of trainer lessons (the Oath needs every one) reads better as a count.
  if (lessons > 2) missing.push(`${lessons} more trainer lessons in the Training Ground`);
  else missing.push(...left.filter((a) => !chapterById(a).act).map((a) => `${chapterById(a).name}'s lesson`));
  const need = (c.lessons ?? 0) - lessonsDone(q);
  if (need > 0) missing.push(`${need} more trainer lesson${need === 1 ? "" : "s"}`);
  return missing.length ? `Opens after ${missing.join(", ")}` : "";
}
/** Your Emberguard rank: 0 Hopeful, 1 Ember (sworn the Oath), 2 Flame (end of Act 1). */
export const rankOf = (q: QuestProgress): 0 | 1 | 2 => (chapterDone(q, "thorn_light") ? 2 : chapterDone(q, "oath") ? 1 : 0);
/** Ember Debt is on once you've sworn the Oath. */
export const oathSworn = (q: QuestProgress) => chapterDone(q, "oath");
/** Who you talk to for a talk step. */
export const talkWith = (c: Chapter, step: QuestStep): NpcId => step.who ?? c.giver;

/** The active chapter's current step, or null. */
export function currentStep(q: QuestProgress): QuestStep | null {
  if (!q.active) return null;
  const prog = q.ch[q.active];
  return (prog && chapterById(q.active).steps[prog.step]) ?? null;
}

/** People with something for you: the active chapter's giver if it's a talk step, plus everyone whose chapter you can start or go back to. */
export function questMarks(q: QuestProgress, levelOf?: LevelOf): NpcId[] {
  const out = new Set<NpcId>();
  const step = currentStep(q);
  if (step?.goal.kind === "talk") out.add(talkWith(chapterById(q.active!), step));
  if (step?.goal.kind === "visit") for (const id of step.goal.npcs) if (!q.ch[q.active!]?.got?.includes(id)) out.add(id);
  for (const c of CHAPTERS) {
    if (c.id === q.active || chapterDone(q, c.id) || !chapterOpen(q, c.id) || (!q.ch[c.id] && !gateMet(c, levelOf))) continue;
    // A side quest waits until the same person's lesson is done.
    if (c.side && CHAPTERS.some((o) => o.giver === c.giver && !o.side && !chapterDone(q, o.id))) continue;
    const prog = q.ch[c.id];
    // Not started yet, or waiting on a talk while another chapter is active.
    if (!prog) out.add(c.giver);
    else if (c.steps[prog.step]?.goal.kind === "talk") out.add(talkWith(c, c.steps[prog.step]));
  }
  return [...out];
}

const KAEL_CH = chapterById("kael");
const BRYN_CH = chapterById("bryn");
/** The Dark Forest's gate opens once you're past this step of Kael's chapter. */
/** Rowan's first lesson ends here; the guild opens after it (her Enchanting lessons follow). */
export const YSOLDE_GUILD_STEP = 4;
export const GATE_STEP = KAEL_CH.steps.findIndex((s) => s.opensGate);
export const gateOpen = (q: QuestProgress) => !!q.gate || chapterDone(q, "kael") || (q.ch.kael?.step ?? -1) > GATE_STEP;

/** The bounty board opens once you reach this step of Bryn's chapter. */
export const BOARD_STEP = BRYN_CH.steps.findIndex((s) => s.opensBoard);
export const boardOpen = (q: QuestProgress) => (q.ch.bryn?.step ?? -1) > BOARD_STEP;

/** Every stew burns until you've reached this step of Maren's chapter (the first "Tell Maren what happened"). */
export const BURN_UNTIL = chapterById("maren").steps.findIndex((s) => s.goal.kind === "craft" && s.goal.tries);
export const stewsBurn = (q: QuestProgress) => q.active === "maren" && (q.ch.maren?.step ?? 0) <= BURN_UNTIL;

/** Can't be sold, dropped or eaten right now (the current task needs it)? */
export const isProtected = (q: QuestProgress, item: string) => !!currentStep(q)?.protect?.some((p) => item.startsWith(p));

/** One chapter in the 📜 tab. */
export interface ChapterView {
  id: ChapterId;
  title: string;
  name: string;
  where: string;
  state: "done" | "active" | "started" | "open" | "locked";
  /** A side quest. */
  side?: boolean;
  /** Locked by a level: "Renown 10". */
  needs?: string;
  /** Locked: what opens it ("Opens after Oath of the Flame"). */
  opens?: string;
  /** A story chapter: which part. */
  act?: "prologue" | "act1";
  /** Started chapters: what to do next. */
  task?: string;
  /** Step number and how many steps. */
  step: number;
  of: number;
  /** Skills this chapter teaches (for the 🎓 Training list). */
  skills?: SkillId[];
}

/** What the client's tracker shows. */
export interface QuestView {
  done: boolean;
  /** Chapter name and who gives it, e.g. "Living off the land" from Old Maren. */
  quest: string;
  giver: string;
  /** Chapters finished so far, of how many. */
  number: number;
  of: number;
  task: string;
  /** "2 / 3 logs", "Fishing level 2 / 3", "5 uses left"... */
  progress?: string;
  /** 0 to 1, for a progress bar. */
  fraction?: number;
  /** The current step is a talk: show ❗ in the task. */
  talk: boolean;
  /** People to show a ❗ over. */
  marks: NpcId[];
  /** Something's wrong to fix first (e.g. "Put your rod back on your belt"). */
  warning?: string;
  /** A picture checklist of what the step needs (🐟 1 / 3 ✓), so you can follow it without reading. */
  need?: { icon: string; tint?: string; have: number; want: number }[];
  /** Every chapter, for the 📜 tab. */
  chapters: ChapterView[];
  /** Places the current step sends you (for the map): where, and what. */
  spots?: { x: number; y: number; label: string }[];
  /** True when the step is "go to these places": the game marks each one on the ground. */
  reach?: boolean;
  /** Lanterns you've lit (story stations drawn lit). */
  lit?: NpcId[];
  /** Your Emberguard rank (shared/story.ts RANKS). */
  rank?: number;
}

/** Lanterns lit for you: every one in a chapter you've finished, plus the ones you've lit so far in the current step. */
export function litLanterns(q: QuestProgress): NpcId[] {
  const out: NpcId[] = [];
  for (const id of ["lanterns", "rounds"] as ChapterId[]) {
    const c = chapterById(id);
    const visit = c.steps.find((st) => st.goal.kind === "visit")!;
    const all = (visit.goal as { npcs: NpcId[] }).npcs;
    const prog = q.ch[id];
    if (!prog) continue;
    const at = c.steps.indexOf(visit);
    if (prog.step > at) out.push(...all);
    else if (prog.step === at) out.push(...all.filter((n) => prog.got?.includes(n)));
  }
  // The shrines you've lit.
  if (chapterDone(q, "thorn_light") || (q.ch.thorn_light?.step ?? 0) > 3) out.push("thorn_shrine");
  if ((q.ch.rebuild?.step ?? 0) > 3) out.push("west_shrine");
  return out;
}

export function chapterViews(q: QuestProgress, levelOf?: LevelOf): ChapterView[] {
  return CHAPTERS.map((c) => {
    const prog = q.ch[c.id];
    const done = chapterDone(q, c.id);
    const gated = !prog && !gateMet(c, levelOf);
    const state = done ? "done" : q.active === c.id ? "active" : prog ? "started" : chapterOpen(q, c.id) && !gated ? "open" : "locked";
    return {
      id: c.id, title: c.title, name: c.name, where: c.where, state, side: c.side, act: c.act,
      opens: state === "locked" && !gated ? opensAfter(q, c.id) : undefined,
      needs: gated && c.requires ? `${findSkill(c.requires.skill).def.name} ${c.requires.level}` : undefined,
      task: prog && !done ? c.steps[prog.step]?.task : undefined,
      step: Math.min(prog?.step ?? 0, c.steps.length), of: c.steps.length,
      skills: [...new Set(c.steps.flatMap((s) => s.unlocks ?? []))],
    };
  });
}

/** Pieces of a stack of gifts: { item: "pine_logs", count: 5 } -> five pine logs. */
export const giftItems = (gifts: Gift[] = []) => gifts.flatMap((g) => Array<Gift>(g.count ?? 1).fill({ item: g.item, durability: g.durability }));

/** Skills taught so far: every talk step you've finished teaches its `unlocks`. Finishing every chapter opens everything. */
export function unlockedSkills(q: QuestProgress): SkillId[] {
  const out = new Set<SkillId>(q.taught ?? []);
  // All lessons done teaches every skill, except ones only a side quest teaches.
  if (tutorialDone(q)) for (const id of SKILL_IDS) if (!CHAPTERS.some((c) => c.side && c.steps.some((s) => s.unlocks?.includes(id)))) out.add(id);
  for (const c of CHAPTERS) {
    const at = q.ch[c.id]?.step ?? 0;
    c.steps.forEach((s, i) => { if (i < at) for (const id of s.unlocks ?? []) out.add(id); });
  }
  return SKILL_IDS.filter((id) => out.has(id));
}

/** Who teaches a skill (for "Forester Holt teaches this" notes). */
export function teacherOf(skill: SkillId): Chapter | null {
  return CHAPTERS.find((c) => c.steps.some((s) => s.unlocks?.includes(skill))) ?? null;
}

/**
 * Bump QUEST_REV whenever the steps change in a way old saves need moving
 * along, and teach `migrateQuest` how.
 *
 * Rev 1 and 2: one long list of Maren's steps ({ step, count }). Rev 1 lacked
 * the Mastery point lesson (2 steps, added after "Tell Maren your rod broke").
 * Rev 4: two steps added to Maren's chapter (the Repairer), from step 6 on.
 * Rev 3: chapters. Old saves keep Maren's place if they were still in her
 * first quest (the first 16 steps are the same); anyone past it has her
 * chapter done, keeps every skill they'd learned and the gate if it was open,
 * and can do the trainers' chapters for their rewards.
 * Rev 5: the story. Older saves skip the Prologue's start (Awakening to The
 * Old Sweeper): they've already met Maren. A Blessing, the Oath and Act 1 are
 * open to them like anyone.
 * Rev 6 (version 0.14): a step added to Awakening after Celene's first talk
 * (putting on the robe). Anyone past her first talk moves one step along.
 * Rev 7 (version 0.18, Emberhold): Maren's chapter is shorter (23 steps to 19):
 * the "sell a fish to Tam" step and the Fishing 3 / Cooking 3 tail are gone,
 * and one last talk sends you round the Training Ground's trainers.
 * Rev 8 (version 0.18): Awakening gained Celene's walking lesson after the robe. Anyone
 * past the robe step moves one step along.
 */
export const QUEST_REV = 8;
/** Maren's old step (rev 6 and before) to her new step (rev 7). */
const MAREN_REV7 = (old: number) => (old <= 16 ? old : old === 17 ? 16 : old === 18 ? 17 : old <= 22 ? 18 : 19);
const OLD_MAREN_STEPS = 23;
const PROLOGUE_SKIP: ChapterId[] = ["awakening", "hall", "lanterns", "sweeper"];
export function migrateQuest(saved: unknown, rev: number | undefined): QuestProgress {
  const q = migrateOld(saved, rev);
  if ((rev ?? 1) < 5) {
    for (const id of PROLOGUE_SKIP) q.ch[id] = { step: chapterById(id).steps.length, count: 0 };
    if (q.active && PROLOGUE_SKIP.includes(q.active)) {
      q.active = "maren";
      if (!q.ch.maren) q.ch.maren = { step: 0, count: 0 };
    }
  }
  if ((rev ?? 1) < 6 && q.ch.awakening && q.ch.awakening.step >= 1) q.ch.awakening.step = Math.min(q.ch.awakening.step + 1, chapterById("awakening").steps.length);
  if ((rev ?? 1) < 8 && q.ch.awakening && q.ch.awakening.step >= 2) q.ch.awakening.step = Math.min(q.ch.awakening.step + 1, chapterById("awakening").steps.length);
  if ((rev ?? 1) < 7 && q.ch.maren) {
    const old = q.ch.maren.step, now = Math.min(MAREN_REV7(old), chapterById("maren").steps.length);
    if (now !== old) q.ch.maren = { ...q.ch.maren, step: now, count: 0 };
  }
  return q;
}
/** Rev 4 added two steps to Maren's chapter after "Tell Maren your rod broke" (the trip to the Repairer). */
const REPAIR_LESSON_AT = 6;
const OLD_UNLOCKS: [number, SkillId[]][] = [
  [0, ["fishing"]], [7, ["cooking"]], [12, ["trading"]], [18, ["woodcutting"]], [22, ["smithing", "handicraft"]],
  [30, ["mining"]], [37, ["smelting"]], [41, ["melee", "defense"]], [50, ["magic"]], [53, ["ranged"]], [59, ["renown"]],
];
const OLD_FIRST_QUEST = 16; // steps 0-15 were "Living off the land", the same as Maren's chapter (before rev 4's 2 repair steps)
const OLD_GATE_STEP = 56;
const OLD_STEPS = 63;
function migrateOld(saved: unknown, rev: number | undefined): QuestProgress {
  const s = saved as Partial<QuestProgress & { step: number; count: number }> | undefined;
  if (!s || typeof s !== "object") return newQuestProgress();
  if ((rev ?? 1) >= 3) {
    const q: QuestProgress = { active: null, ch: {} };
    if (s.active && CHAPTER_IDS.includes(s.active)) q.active = s.active;
    for (const id of CHAPTER_IDS) {
      const c = s.ch?.[id];
      if (c && Number.isInteger(c.step) && c.step >= 0) {
        const len = id === "maren" && (rev ?? 1) < 7 ? OLD_MAREN_STEPS : chapterById(id).steps.length;
        q.ch[id] = { step: Math.min(c.step, len), count: Number.isInteger(c.count) && c.count >= 0 ? c.count : 0 };
        if (Array.isArray(c.got)) q.ch[id]!.got = c.got.filter((g) => typeof g === "string").slice(0, 20);
      }
    }
    if (q.active && !q.ch[q.active]) q.active = null;
    if (Array.isArray(s.taught)) q.taught = SKILL_IDS.filter((id) => s.taught!.includes(id));
    if (s.gate) q.gate = true;
    if ((rev ?? 1) >= 5 ? !Object.keys(q.ch).length : !q.ch.maren) return newQuestProgress();
    if ((rev ?? 1) < 4 && q.ch.maren && q.ch.maren.step >= REPAIR_LESSON_AT) q.ch.maren.step = Math.min(q.ch.maren.step + 2, OLD_MAREN_STEPS);
    return q;
  }
  let step = Number.isInteger(s.step) && s.step! >= 0 ? s.step! : 0;
  const count = Number.isInteger(s.count) && s.count! >= 0 ? s.count! : 0;
  if ((rev ?? 1) < 2 && step >= 6) step += 2; // rev 1 had no Mastery point lesson
  const done = step >= OLD_STEPS;
  const taught = done ? [...SKILL_IDS] : SKILL_IDS.filter((id) => OLD_UNLOCKS.some(([at, ids]) => at < step && ids.includes(id)));
  if (step < OLD_FIRST_QUEST) return { active: "maren", ch: { maren: { step: step >= REPAIR_LESSON_AT ? step + 2 : step, count } }, taught };
  return {
    active: null, ch: { maren: { step: OLD_MAREN_STEPS, count: 0 } },
    taught, ...(done || step > OLD_GATE_STEP ? { gate: true } : {}),
  };
}
