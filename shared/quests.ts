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

export const GUIDE_NAME = "Old Maren";

/** Something a trainer hands you. Tools can come worn (fewer uses left). */
export interface Gift { item: ItemId; count?: number; durability?: number }

export type Goal =
  /** Talk to the chapter's trainer. */
  | { kind: "talk" }
  /** Have tools on your belt whose item ids start with these ("rod_", "pot_bronze"). */
  | { kind: "equip"; tools: string[]; names: string }
  /** Gather this many (of one type, if set). withTool: only counts with the right tool on your belt. byHand: only without it. */
  | { kind: "gather"; skill: GatherSkill; resource?: ResourceId; count: number; withTool?: boolean; byHand?: boolean }
  /** Wear a tool on your belt down until it breaks. */
  | { kind: "toolBreaks"; tool: ToolType }
  /** Make something whose item id starts with `prefix` ("meal_stew_", "axe_stone_"). tries: any attempt counts, even a failure. */
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
  | { kind: "harvest"; count: number }
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
}

export type ChapterId = "maren" | "tam" | "holt" | "greta" | "brann" | "rook" | "kael" | "wren" | "ysolde" | "moss" | "bryn" | "odo" | "bryn_bandits";

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
}

/** A skill's level, for chapters that need one (the server and client each pass their own). */
export type LevelOf = (skill: SkillId) => number;
/** Is this chapter's level gate met (or has it none)? */
export const gateMet = (c: Chapter, levelOf?: LevelOf) => !c.requires || (!!levelOf && levelOf(c.requires.skill) >= c.requires.level);

const WORN_ROD: Gift = { item: "rod_pine", durability: 8 };
const WORN_PICK: Gift = { item: "pickaxe_stone_pine", durability: 10 };
const LOG: Gift = { item: "pine_logs" };
const STONE: Gift = { item: "stone" };
const MINNOW: Gift = { item: "minnow" };
const POT: Gift = { item: "pot_stone" };
const DAGGER: Gift = { item: "dagger_bronze_pine" };
const SLING: Gift = { item: "sling_bronze_pine" };
const STAFF: Gift = { item: "staff_bronze_pine" };
const POTION: Gift = { item: "health_potion" };
const AXE: Gift = { item: "axe_stone_pine" };
const WORM: Gift = { item: "worm" };
const SHOVEL: Gift = { item: "shovel_stone_pine" };

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
const YSOLDE = "Archmage Ysolde";
const BRYN = "Captain Bryn";
const ODO = "Farmer Odo";

export const CHAPTERS: Chapter[] = [
  // ---------------- Old Maren: Living off the land ----------------
  {
    id: "maren", title: "Living off the land", giver: "maren", name: MAREN, where: "in the town square, by the stove",
    steps: [
      {
        task: `Talk to ${MAREN} (look for the ❗ in the town square, by the stove)`, goal: { kind: "talk" }, unlocks: ["fishing"],
        lines: [
          "Well now, a fresh face! I'm Maren. I fished these waters for forty years before my knees gave out.",
          "Everyone starts with empty hands, so let's begin with the oldest skill there is: fishing.",
          "Walk west along the road to the lake and click the water's edge. You've no rod, so it'll be slow. Bring me back one minnow.",
        ],
      },
      {
        task: "Catch a minnow by hand at the lake (west along the road)",
        goal: { kind: "gather", skill: "fishing", resource: "minnow", count: 1, byHand: true },
        hint: "Follow the road west to the lake and click the water at its edge. By hand it takes a while, so be patient.",
      },
      {
        task: `Bring your minnow back to ${MAREN}`, goal: { kind: "talk" },
        need: { prefix: "minnow", line: "Where's my minnow? Go and catch one at the lake, then bring it here." },
        protect: ["minnow"],
        lines: [
          "Ha! Took you a while, didn't it? That's fishing by hand.",
          "Here, take my old rod. It's nearly worn out, but any tool on your belt makes you much faster at its job: rods for fishing, axes for chopping, pickaxes for mining.",
          "Click the rod in your bag and press \"Put on belt\". A tool only works when it's on your belt.",
        ],
        give: [WORN_ROD],
      },
      {
        task: "Put the rod on your belt (click it in your bag)", goal: { kind: "equip", tools: ["rod_"], names: "rod" },
        hint: "Click the rod in your bag, then press \"Put on belt\". It'll show up in the tool belt above your bag.",
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
          "A broken tool isn't gone, though. It's in your bag, and Oswin the Repairer can fix it. He works at the Mages' Guild, the purple hall south-west of town, by the coast.",
          "Take my rod to him. He's an old friend, so this first one's free. After that he charges a few coins, more for finer things.",
        ],
      },
      {
        task: "Get your rod repaired at the Mages' Guild (south-west of town)", goal: { kind: "repair" },
        hint: "Oswin the Repairer is in the Mages' Guild, the purple hall south-west of town. Click him, then Repair. The first one's free.",
        ensure: [{ item: "rod_pine", durability: 0 }], protect: ["rod_"],
      },
      {
        task: `Bring your mended rod back to ${MAREN}`, goal: { kind: "talk" },
        lines: [
          "Good as new! Better tools last longer: stone wears out fastest, bronze lasts more than twice as long, and the finer metals longer still. A better wooden handle helps too. Fishing rods are all wood, so for those, the better the wood, the better the rod.",
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
          "Now, raw minnows won't keep you going for long. Take this pine log to the stove right here and cook your fish into a stew. Pick Stew, tap your minnow to put it in the pot, and pick the Pine log to burn.",
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
          "Cooking without a pot halves your chance. Take my stone pot and put it on your belt, just like the rod. Here's another log.",
        ],
        give: [POT, LOG],
      },
      {
        task: "Put the pot on your belt (click it in your bag)", goal: { kind: "equip", tools: ["pot_"], names: "pot" },
        hint: "Click the pot in your bag, then press \"Put on belt\".",
        ensure: [POT, LOG, MINNOW], protect: ["pot_", "minnow", "pine_logs"],
      },
      {
        task: "Cook a stew with the pot on your belt", goal: { kind: "craft", skill: "cooking", prefix: "meal_stew_", count: 1 },
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
          "It comes back on its own, 1 every 30 seconds, but food is much faster. A raw minnow gives 2. A stew gives three times what its fish would, plus a bit from the fire. Go on, eat your stew.",
          "Then sell a fish to Shopkeeper Tam at the General Store, the wooden building at the west end of the square. Tam buys anything.",
        ],
      },
      {
        task: "Eat your stew (click it in your bag, then Eat)", goal: { kind: "eat" },
        hint: "Click the stew in your bag and press Eat.",
        ensure: [{ item: FIRST_STEW }],
      },
      {
        task: "Sell a fish to Tam at the General Store (catch one if you have none)", goal: { kind: "sell", what: "fishing", count: 1 },
        hint: "The General Store is the wooden building at the west end of the square; its door faces the road. Click Tam, then click a fish in your bag to sell it.",
      },
      {
        task: `Go back to ${MAREN} for your reward`, goal: { kind: "talk" },
        lines: [
          "You've got the hang of living off the land: fish, cook, eat, and sell what you don't need.",
          "Here's your reward: an oak fishing rod and a bronze pot. Faster fishing, fewer burned stews, and they last much longer. And some coins and a couple of stews for the road.",
          "Put them both on your belt. Your old stone pot goes back in your bag when you do.",
        ],
        give: [{ item: "rod_oak" }, { item: "pot_bronze" }, { item: SHOP_STEW, count: 2 }],
        coins: 50,
      },
      {
        task: "Put the oak rod and bronze pot on your belt", goal: { kind: "equip", tools: ["rod_", "pot_bronze"], names: "oak rod and bronze pot" },
        hint: "Click the oak fishing rod in your bag and press \"Put on belt\", then the same for the bronze pot.",
        protect: ["rod_", "pot_bronze"],
      },
      {
        task: "Reach Fishing level 3 (keep fishing)", goal: { kind: "skillLevel", skill: "fishing", level: 3 },
        hint: "Keep fishing. Every fish gives Fishing XP. Come back at Fishing 3.",
        needsTool: "rod", protect: ["rod_"],
      },
      {
        task: `Talk to ${MAREN}`, goal: { kind: "talk" },
        lines: [
          "Fishing 3! Every skill belongs to a Discipline. Fishing is part of Endurance, which raises your max stamina. A Discipline's level is the average of the skills you've learned in it.",
          "Open the 📊 panel and look: every kind of fish has its own Mastery too. The higher it is, the faster you catch it and the more shops pay for it.",
          "One last thing from me: cook stews at the stove until you reach Cooking 3. More ingredients in the pot give more XP. Here's some firewood to get you going.",
        ],
        give: [{ item: "pine_logs", count: 5 }],
      },
      {
        task: "Reach Cooking level 3 (cook stews)", goal: { kind: "skillLevel", skill: "cooking", level: 3 },
        hint: "Cook stews at the stove with your pot on your belt. More ingredients in the pot give more XP. If you run low on stamina, eat one!",
        needsTool: "pot", protect: ["pot_bronze"],
      },
      {
        task: `Go back to ${MAREN}`, goal: { kind: "talk" },
        lines: [
          "Cooking 3! Cooking is Dexterity, which lets you carry more and walk faster. You've learned all I have to teach.",
          "Now it's time you met the trainers. Forester Holt, Miner Greta and Smith Brann have their workshops on Trainer Row, just north of the road. Shopkeeper Tam and Woodworker Rook are here in the square.",
          "Huntmaster Kael's lodge is south of the road, by the gate to the Dark Forest. Archmage Ysolde runs the Mages' Guild to the south-west, and Captain Bryn here by the bounty board always has work.",
          "Visit them in any order you like. Anyone with a ❗ over their head has a lesson for you, and each one ends with a reward. Your 📜 Quests tab keeps track.",
        ],
        coins: 50,
      },
    ],
  },

  // ---------------- Shopkeeper Tam: Buying and selling ----------------
  {
    id: "tam", title: "Buying and selling", giver: "tam", name: TAM, where: "in the General Store, west end of the square",
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
    id: "holt", title: "The woodcutter's start", giver: "holt", name: HOLT, where: "on Trainer Row, north of the road",
    steps: [
      {
        task: `Talk to ${HOLT} on Trainer Row`, goal: { kind: "talk" }, unlocks: ["woodcutting"],
        lines: [
          "Come in, come in! Holt's the name, and trees are the game. I'll teach you Woodcutting.",
          "Woodcutting is part of Endurance, like Fishing and Mining. Every kind of log has its own Mastery, so the more of one you chop, the faster it goes.",
          "Let's start the hard way: chop 3 logs by hand. The pointy pine trees are just north of Trainer Row.",
        ],
      },
      {
        task: "Chop 3 logs by hand (no axe on your belt)", goal: { kind: "gather", skill: "woodcutting", count: 3, byHand: true },
        hint: "Click a tree to chop it. Pine trees are the pointy ones, just north of Trainer Row.",
      },
      {
        task: `Go back to ${HOLT}`, goal: { kind: "talk" },
        lines: [
          "Sore hands? Good. Now you know why folks use tools.",
          "Here's a stone axe. Put it on your belt and chop 10 logs. Chopping costs 10 stamina a log, so keep some food handy. Logs are heavy too (2 kg each): the ⚖️ bar under your bag shows how much more you can carry.",
        ],
        give: [AXE],
      },
      {
        task: "Put the stone axe on your belt", goal: { kind: "equip", tools: ["axe_"], names: "axe" },
        hint: "Click the axe in your bag and press \"Put on belt\".",
        ensure: [AXE], protect: ["axe_"],
      },
      {
        task: "Chop 10 logs with your axe", goal: { kind: "gather", skill: "woodcutting", count: 10, withTool: true },
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
          "Here's a bronze axe: it chops faster and lasts much longer. Better trees need a higher Woodcutting level: oaks at 5, and finer woods after that.",
        ],
        give: [{ item: "axe_bronze_pine" }],
        coins: 100,
      },
    ],
  },

  // ---------------- Miner Greta: Into the rocks ----------------
  {
    id: "greta", title: "Into the rocks", giver: "greta", name: GRETA, where: "on Trainer Row, north of the road",
    steps: [
      {
        task: `Talk to ${GRETA} on Trainer Row`, goal: { kind: "talk" }, unlocks: ["mining"],
        lines: [
          "You want to learn Mining? Good. It's hard work, but rocks don't run away. Mining is part of Endurance.",
          "The quarry is just north of Trainer Row, past the lane. Here's a worn stone pickaxe. Put it on your belt, then mine 5 stone from the plain grey rocks. Eat when you get tired.",
        ],
        give: [WORN_PICK],
      },
      {
        task: "Put the pickaxe on your belt", goal: { kind: "equip", tools: ["pickaxe_"], names: "pickaxe" },
        hint: "Click the pickaxe in your bag and press \"Put on belt\".",
        ensure: [WORN_PICK], protect: ["pickaxe_"],
      },
      {
        task: "Mine 5 stone (plain grey rocks in the quarry)", goal: { kind: "gather", skill: "mining", resource: "stone", count: 5 },
        hint: "Click a plain grey rock in the quarry, north of Trainer Row, with the pickaxe on your belt.",
        ensure: [WORN_PICK], needsTool: "pickaxe", protect: ["pickaxe_"],
      },
      {
        task: `Show ${GRETA} your stone`, goal: { kind: "talk" },
        need: { prefix: "stone", line: "Where's your stone? Mine some in the quarry and bring it here." },
        lines: [
          "Good, solid stone. Smith Brann can turn stone and a log into a tool head.",
          "Bronze is made from copper and tin. You'll mine those yourself at Mining level 5, but that takes a while.",
          "For now, buy 2 copper ore and 2 tin ore from me. Open my Buy tab.",
        ],
      },
      {
        task: `Get 2 copper ore and 2 tin ore (${GRETA}'s Buy tab)`, goal: { kind: "have", items: { copper_ore: 2, tin_ore: 2 } },
        hint: "Click me, open the Buy tab, and buy 2 copper ore and 2 tin ore.",
        protect: ["copper_ore", "tin_ore"],
      },
      {
        task: `Go back to ${GRETA} for your reward`, goal: { kind: "talk" },
        lines: [
          "That's the makings of two bronze bars. Take them to Smith Brann if you haven't learned Smelting yet.",
          "And here's a bronze pickaxe of my own making. Faster mining, and it lasts.",
        ],
        give: [{ item: "pickaxe_bronze_pine" }],
        coins: 100,
      },
    ],
  },

  // ---------------- Smith Brann: Hammer and fire ----------------
  {
    id: "brann", title: "Hammer and fire", giver: "brann", name: BRANN, where: "in the smithy on Trainer Row",
    steps: [
      {
        task: `Talk to ${BRANN} at the smithy`, goal: { kind: "talk" }, unlocks: ["smithing", "smelting"],
        lines: [
          "Mind the sparks! I'm Brann. I'll teach you Smithing at the anvil and Smelting at the furnace. Both are part of Dexterity.",
          "A tool is a head and a handle: 1 stone or 1 metal bar for the head, and 1 log for the handle. A hammer on your belt helps you smith, the way a pot helps you cook.",
          "Here's a stone and a log. Make yourself a stone hammer at the anvil.",
        ],
        give: [STONE, LOG],
      },
      {
        task: "Make a stone hammer at the anvil (1 stone + 1 log)", goal: { kind: "craft", skill: "smithing", prefix: "hammer_stone_", count: 1 },
        hint: "Click the anvil, pick Hammer, Stone and Pine, then press Make 1. I'll guide your hand this first time.",
        ensure: [STONE, LOG], guaranteed: true, protect: ["stone", "pine_logs"],
      },
      {
        task: "Put the hammer on your belt", goal: { kind: "equip", tools: ["hammer_"], names: "hammer" },
        hint: "Click the hammer in your bag and press \"Put on belt\".",
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
        lines: [
          "Fine work! Weapons and armor are made just like tools, and they wear out like tools too, so keep a spare.",
          "Take these bronze tongs and a bronze hammer. With those on your belt, you'll fail much less at the furnace and the anvil.",
        ],
        give: [{ item: "tongs_bronze" }, { item: "hammer_bronze_pine" }],
        coins: 150,
      },
    ],
  },

  // ---------------- Woodworker Rook: Handy work ----------------
  {
    id: "rook", title: "Handy work", giver: "rook", name: ROOK, where: "in the workshop in the square",
    steps: [
      {
        task: `Talk to ${ROOK} at the workshop`, goal: { kind: "talk" }, unlocks: ["handicraft"],
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
    id: "kael", title: "Standing your ground", giver: "kael", name: KAEL, where: "in the lodge by the gate, south of the road",
    steps: [
      {
        task: `Talk to ${KAEL} at the lodge by the gate`, goal: { kind: "talk" }, unlocks: ["melee", "defense"],
        lines: [
          "So you want to fight? I'm Kael. South of here, past the gate, is the Dark Forest. Wolves, goblins, giant spiders and worse, and they attack anyone who wanders in.",
          "See the ❤ bar at the top left? That's your health. Fighting skills are Strength, and Strength raises your max health. If it runs out, you'll wake up with Old Maren, a bit shaken but with all your things.",
          "Let's start small. Here's a bronze dagger. Weapons and armor go in your gear strip, under the tool belt. Click the dagger in your bag and press \"Hold\".",
        ],
        give: [DAGGER],
      },
      {
        task: "Hold the dagger (click it in your bag, then Hold)", goal: { kind: "gear", items: ["dagger_"], names: "dagger" },
        hint: "Click the dagger in your bag and press \"Hold\". It goes in the Weapon slot of your gear strip.",
        ensure: [DAGGER], protect: ["dagger_"],
      },
      {
        task: "Defeat 3 chickens (in the field north-west of town)", goal: { kind: "kill", monster: "chicken", count: 3 },
        hint: "The chickens peck about in the field north-west of town. Click one to attack it. They never fight back.",
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
        task: "Wear the helmet and the shield", goal: { kind: "gear", items: ["helmet_", "shield_"], names: "helmet and shield" },
        hint: "Click the helmet in your bag and press \"Wear\", then the same for the shield.",
        ensure: [{ item: "helmet_bronze" }, { item: "shield_bronze" }], protect: ["helmet_", "shield_"],
      },
      {
        task: "Defeat 2 rats (around the quarry, north of Trainer Row)", goal: { kind: "kill", monster: "rat", count: 2 },
        hint: "The rats scurry around the quarry rocks north of Trainer Row. They bite back, so watch your ❤ health.",
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
        task: "Hold the sling", goal: { kind: "gear", items: ["sling_"], names: "sling" },
        hint: "Click the sling in your bag and press \"Hold\".",
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
          "Good shooting! I think you're ready for the forest.",
          "I've opened the gate for you. It's just south of my lodge, past the warning sign. The wolves near the gate are the easiest. Goblins live to the west, giant spiders to the east, and bandits deep in the south. Don't go near those yet!",
          "Take these bronze platelegs and 3 more potions. Hold the weapon you like best, defeat a wolf, and come back to me. If it goes badly, walk back out through the gate: they won't follow you past the fence.",
        ],
        give: [{ item: "platelegs_bronze" }, POTION, POTION, POTION],
      },
      {
        task: "Defeat a wolf in the Dark Forest (through the gate)", goal: { kind: "kill", monster: "wolf", count: 1 },
        hint: "The gate is just south of my lodge, past the warning sign. The wolves are just inside. Drink a potion if your health gets low!",
        fightWith: "weapon",
      },
      {
        task: `Go back to ${KAEL} for your reward`, goal: { kind: "talk" }, unlocks: ["hunting"],
        lines: [
          "You came back! And in one piece, too. You've the makings of a hunter, so I'll teach you Hunting. It's part of Endurance.",
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
    id: "wren", title: "What the ground gives", giver: "wren", name: WREN, where: "in the little hut by the lake, east of the Mages' Guild",
    steps: [
      {
        task: `Talk to ${WREN} in the hut by the lake`, goal: { kind: "talk" }, unlocks: ["foraging"],
        lines: [
          "Oh! Mind the drying herbs. I'm Wren. Everyone else round here chops and mines and fishes, but the best things grow under your feet.",
          "See the little patches of turned earth that glint in the grass? Those are dig patches. Dig one with a shovel and you'll turn up roots, worms and mushrooms, and herbs once you know what to look for. That's Foraging, part of Endurance.",
          "Here's a stone shovel. Put it on your belt like any other tool.",
        ],
        give: [SHOVEL],
      },
      {
        task: "Put the shovel on your belt (click it in your bag)", goal: { kind: "equip", tools: ["shovel_"], names: "shovel" },
        hint: "Click the shovel in your bag, then press \"Put on belt\".",
        ensure: [SHOVEL], protect: ["shovel_"],
      },
      {
        task: "Dig up 3 things from glinting dig patches", goal: { kind: "gather", skill: "foraging", count: 3, withTool: true },
        hint: "There's a dig patch just outside my door, and more in the meadows round the lake and the square. Click one that glints. Once it's dug out, it glints again after a while.",
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

  // ---------------- Archmage Ysolde: Sparks and spells ----------------
  {
    id: "ysolde", title: "Sparks and spells", giver: "archmage", name: YSOLDE, where: "at the Mages' Guild, south-west of town",
    steps: [
      {
        task: `Talk to ${YSOLDE} at the Mages' Guild`, goal: { kind: "talk" }, unlocks: ["magic"],
        lines: [
          "Welcome to the Mages' Guild. I'll teach you Spellcasting. It's part of Wisdom, which raises your max mana.",
          "Spells need a staff in your hand, and they use mana, the blue 🔮 bar under your stamina. Mana comes back on its own, 1 every 6 seconds.",
          "Here's a bronze staff. Your spells sit on the spell bar under your gear. Firebolt flies from a staff: hold this one and go defeat 2 chickens with it.",
        ],
        give: [STAFF],
      },
      {
        task: "Hold the staff", goal: { kind: "gear", items: ["staff_"], names: "staff" },
        hint: "Click the staff in your bag and press \"Hold\".",
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
          "You've seen the altar by the door? That's for Enchanting. Soul trap a monster, defeat it, and its soul fills a soul gem. The altar pours that soul into a staff, armor or a tool.",
          "A staff also takes a cut gem: ruby burns, sapphire chills, emerald poisons, topaz throws lightning and amethyst drinks life. Armor and tools pick their own magic.",
          "Here's a small soul gem, already full. Enchant something with it: a tool on your belt is a fine start (take it off your belt first, so it's in your bag).",
        ],
        give: [{ item: "soulgem_5_25" }],
      },
      {
        task: "Enchant something at the altar (click the altar in the guild)", goal: { kind: "enchant" },
        hint: "Put the item in your bag, click the altar, pick it and the soul gem, then Enchant.",
        ensure: [{ item: "soulgem_5_25" }],
      },
      {
        task: `Show ${YSOLDE} your enchantment`, goal: { kind: "talk" },
        lines: [
          "Beautiful. Bigger, fuller soul gems make stronger magic. Brann cuts soul stone into gems, and the Crystal Cave has plenty.",
          "One more thing: once your Spellcasting reaches 18 you'll know Mend, to fix your own gear with a little of what it's made of.",
        ],
        coins: 200,
      },
    ],
  },

  // ---------------- Alchemist Moss: A drop of something ----------------
  {
    id: "moss", title: "A drop of something", giver: "moss", name: MOSS, where: "at the Mages' Guild, south-west of town",
    steps: [
      {
        task: `Talk to ${MOSS} at the Mages' Guild`, goal: { kind: "talk" }, unlocks: ["alchemy"],
        lines: [
          "Careful, that one bubbles. I'm Moss. Ysolde lets me keep my table in the corner of the guild, as long as nothing explodes.",
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
    id: "bryn", title: "Odd jobs", giver: "bryn", name: BRYN, where: "by the bounty board in the square",
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
    id: "odo", title: "Something to grow", giver: "odo", name: ODO, where: "at the farm: cross the bridge to the east island, then the next bridge east",
    steps: [
      {
        task: `Talk to ${ODO} at the farm`, goal: { kind: "talk" }, unlocks: ["farming"],
        lines: [
          "Visitors! Not many make it out this far. I'm Odo. I grow things, and I'll teach you to grow them too. That's Farming, part of Endurance.",
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

  // ---------------- Side quest: Captain Bryn's bandit trouble (needs Renown 10) ----------------
  {
    id: "bryn_bandits", title: "Highway robbery", giver: "bryn", name: BRYN, where: "by the bounty board in the square",
    side: true, requires: { skill: "renown", level: 10 },
    steps: [
      {
        task: `Talk to ${BRYN} about the bandits`, goal: { kind: "talk" },
        lines: [
          "You've made a name for yourself, so I've a job I wouldn't give just anyone.",
          "Bandits deep in the Dark Forest, far south, have been robbing the carts on their way to town. They hit hard, so go well armed and take potions.",
          "Defeat 4 of them, and bring me 2 of the rings they've stolen.",
        ],
      },
      {
        task: "Defeat 4 bandits (deep in the Dark Forest, far south)", goal: { kind: "kill", monster: "bandit", count: 4 },
        hint: "The bandits are deep in the south of the Dark Forest. They hit hard: wear your best armor and keep potions handy.",
        fightWith: "weapon",
      },
      {
        task: "Get 2 stolen rings from bandits", goal: { kind: "have", items: { stolen_ring: 2 } },
        hint: "Bandits sometimes drop the rings they've stolen. Keep at it!",
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

export const CHAPTER_IDS = CHAPTERS.map((c) => c.id);
export const chapterById = (id: ChapterId) => CHAPTERS.find((c) => c.id === id)!;
/** The chapter a person gives, if any. */
export const chapterOf = (npc: string, q?: QuestProgress) => {
  const mine = CHAPTERS.filter((c) => c.giver === npc);
  // The first one you haven't finished (a giver can have a side quest after their lesson), else their lesson.
  return (q && mine.find((c) => !chapterDone(q, c.id))) ?? mine[0] ?? null;
};

/** How far along one chapter is: which step, and how far along it (e.g. 2 of 3 logs). */
export interface ChapterProgress { step: number; count: number }

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

export const newQuestProgress = (): QuestProgress => ({ active: "maren", ch: { maren: { step: 0, count: 0 } } });

export const chapterStarted = (q: QuestProgress, id: ChapterId) => !!q.ch[id];
export const chapterDone = (q: QuestProgress, id: ChapterId) => (q.ch[id]?.step ?? -1) >= chapterById(id).steps.length;
export const marenDone = (q: QuestProgress) => chapterDone(q, "maren");
/** Every chapter finished. */
export const tutorialDone = (q: QuestProgress) => CHAPTERS.every((c) => c.side || chapterDone(q, c.id));
/** Can you start this chapter now? (Maren's is first; the rest open once hers is done.) */
export const chapterOpen = (q: QuestProgress, id: ChapterId) => id === "maren" || marenDone(q);

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
  if (step?.goal.kind === "talk") out.add(chapterById(q.active!).giver);
  for (const c of CHAPTERS) {
    if (c.id === q.active || chapterDone(q, c.id) || !chapterOpen(q, c.id) || (!q.ch[c.id] && !gateMet(c, levelOf))) continue;
    // A side quest waits until the same person's lesson is done.
    if (c.side && CHAPTERS.some((o) => o.giver === c.giver && !o.side && !chapterDone(q, o.id))) continue;
    const prog = q.ch[c.id];
    // Not started yet, or waiting on a talk while another chapter is active.
    if (!prog || c.steps[prog.step]?.goal.kind === "talk") out.add(c.giver);
  }
  return [...out];
}

const KAEL_CH = chapterById("kael");
const BRYN_CH = chapterById("bryn");
/** The Dark Forest's gate opens once you're past this step of Kael's chapter. */
/** Ysolde's first lesson ends here; the guild opens after it (her Enchanting lessons follow). */
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
  /** Started chapters: what to do next. */
  task?: string;
  /** Step number and how many steps. */
  step: number;
  of: number;
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
  /** Every chapter, for the 📜 tab. */
  chapters: ChapterView[];
}

export function chapterViews(q: QuestProgress, levelOf?: LevelOf): ChapterView[] {
  return CHAPTERS.map((c) => {
    const prog = q.ch[c.id];
    const done = chapterDone(q, c.id);
    const gated = !prog && !gateMet(c, levelOf);
    const state = done ? "done" : q.active === c.id ? "active" : prog ? "started" : chapterOpen(q, c.id) && !gated ? "open" : "locked";
    return {
      id: c.id, title: c.title, name: c.name, where: c.where, state, side: c.side,
      needs: gated && c.requires ? `${findSkill(c.requires.skill).def.name} ${c.requires.level}` : undefined,
      task: prog && !done ? c.steps[prog.step]?.task : undefined,
      step: Math.min(prog?.step ?? 0, c.steps.length), of: c.steps.length,
    };
  });
}

/** Pieces of a stack of gifts: { item: "pine_logs", count: 5 } -> five pine logs. */
export const giftItems = (gifts: Gift[] = []) => gifts.flatMap((g) => Array<Gift>(g.count ?? 1).fill({ item: g.item, durability: g.durability }));

/** Skills taught so far: every talk step you've finished teaches its `unlocks`. Finishing every chapter opens everything. */
export function unlockedSkills(q: QuestProgress): SkillId[] {
  if (tutorialDone(q)) return [...SKILL_IDS];
  const out = new Set<SkillId>(q.taught ?? []);
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
 */
export const QUEST_REV = 4;
/** Rev 4 added two steps to Maren's chapter after "Tell Maren your rod broke" (the trip to the Repairer). */
const REPAIR_LESSON_AT = 6;
const OLD_UNLOCKS: [number, SkillId[]][] = [
  [0, ["fishing"]], [7, ["cooking"]], [12, ["trading"]], [18, ["woodcutting"]], [22, ["smithing", "handicraft"]],
  [30, ["mining"]], [37, ["smelting"]], [41, ["melee", "defense"]], [50, ["magic"]], [53, ["ranged"]], [59, ["renown"]],
];
const OLD_FIRST_QUEST = 16; // steps 0-15 were "Living off the land", the same as Maren's chapter (before rev 4's 2 repair steps)
const OLD_GATE_STEP = 56;
const OLD_STEPS = 63;
export function migrateQuest(saved: unknown, rev: number | undefined): QuestProgress {
  const s = saved as Partial<QuestProgress & { step: number; count: number }> | undefined;
  if (!s || typeof s !== "object") return newQuestProgress();
  if ((rev ?? 1) >= 3) {
    const q: QuestProgress = { active: null, ch: {} };
    if (s.active && CHAPTER_IDS.includes(s.active)) q.active = s.active;
    for (const id of CHAPTER_IDS) {
      const c = s.ch?.[id];
      if (c && Number.isInteger(c.step) && c.step >= 0) {
        q.ch[id] = { step: Math.min(c.step, chapterById(id).steps.length), count: Number.isInteger(c.count) && c.count >= 0 ? c.count : 0 };
      }
    }
    if (q.active && !q.ch[q.active]) q.active = null;
    if (Array.isArray(s.taught)) q.taught = SKILL_IDS.filter((id) => s.taught!.includes(id));
    if (s.gate) q.gate = true;
    if (!q.ch.maren) return newQuestProgress();
    if ((rev ?? 1) < 4 && q.ch.maren.step >= REPAIR_LESSON_AT) q.ch.maren.step = Math.min(q.ch.maren.step + 2, chapterById("maren").steps.length);
    return q;
  }
  let step = Number.isInteger(s.step) && s.step! >= 0 ? s.step! : 0;
  const count = Number.isInteger(s.count) && s.count! >= 0 ? s.count! : 0;
  if ((rev ?? 1) < 2 && step >= 6) step += 2; // rev 1 had no Mastery point lesson
  const done = step >= OLD_STEPS;
  const taught = done ? [...SKILL_IDS] : SKILL_IDS.filter((id) => OLD_UNLOCKS.some(([at, ids]) => at < step && ids.includes(id)));
  if (step < OLD_FIRST_QUEST) return { active: "maren", ch: { maren: { step: step >= REPAIR_LESSON_AT ? step + 2 : step, count } }, taught };
  return {
    active: null, ch: { maren: { step: chapterById("maren").steps.length, count: 0 } },
    taught, ...(done || step > OLD_GATE_STEP ? { gate: true } : {}),
  };
}
