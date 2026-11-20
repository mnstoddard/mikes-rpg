// The tutorial: Old Maren's three starting quests.
//
// Every new character starts here, and there's no skipping. It's one long list
// of steps (STEPS), split into three quests. A character remembers which step
// it's on and how far along that step is (e.g. 2 of 3 logs).
//
// Each step has a goal: talk to Maren, put a tool on your belt, catch/chop/mine
// something, cook or make something, sell, eat, reach a level, or have some
// items. Talk steps are where Maren explains things and hands over items and
// rewards. Shared so the client's quest tracker shows the same text the server uses.
//
// Guards, so a player can't get stuck or skip ahead by accident:
// - `protect`: while on this step, those items can't be sold, dropped or eaten
//   (the Merchant says to finish Maren's task first).
// - `needsTool`: the step's work is refused unless that tool is on your belt
//   (and the tracker says to put it back if you take it off).
// - `byHand` gather steps are refused while the tool is on your belt.
// - `need` on a talk step: Maren wants to see that item first.
// - `ensure`: talk to Maren and she hands you anything the step needs that you've lost.
// - Talk to her while tired with no food, and she gives you a stew.
import { SKILL_IDS } from "./disciplines";
import type { CraftSkill, DisciplineId, GatherSkill, SkillId } from "./disciplines";
import type { ItemId } from "./items";
import type { ResourceId } from "./foraging";
import type { ToolType } from "./tools";
import type { MonsterId } from "./combat";
import { FIRST_STEW, SHOP_STEW } from "./cooking";
import type { CombatStyle } from "./gear";

export const GUIDE_NAME = "Old Maren";

/** Something Maren hands you. Tools can come worn (fewer uses left). */
export interface Gift { item: ItemId; count?: number; durability?: number }

export type Goal =
  /** Talk to Maren. */
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
  /** Sell a fish or a log to the Merchant. */
  | { kind: "sell"; what: GatherSkill; count: number }
  /** Reach a Discipline level (the average of its unlocked skills). */
  | { kind: "level"; discipline: DisciplineId; level: number }
  /** Reach a skill level. */
  | { kind: "skillLevel"; skill: SkillId; level: number }
  /** Have these items in your bag (mined or bought, either way). */
  | { kind: "have"; items: Partial<Record<ItemId, number>> }
  /** Wear gear whose item ids start with these ("dagger_", "helmet_"). */
  | { kind: "gear"; items: string[]; names: string }
  /** Defeat monsters (of one type, if set; with one style, if set). */
  | { kind: "kill"; monster?: MonsterId; count: number; style?: CombatStyle }
  /** Drink a health potion. */
  | { kind: "drink" }
  /** Track a bounty (tap it in the 📜 Quests tab or on the board). */
  | { kind: "track" }
  /** Hand in bounties at the board. */
  | { kind: "bounty"; count: number }
  /** Spend a Mastery point in any skill's tree (done once any upgrade has a rank). */
  | { kind: "spendPoint" };

export interface QuestStep {
  /** Which quest (0, 1, 2). */
  quest: number;
  /** What the tracker says to do. */
  task: string;
  goal: Goal;
  /** Talk steps: what Maren says. */
  lines?: string[];
  /** Talk steps: what she gives you (items, then coins). */
  give?: Gift[];
  coins?: number;
  /** Talk steps: an item (id prefix) she wants to see before she'll go on, and what she says if you don't have it. */
  need?: { prefix: string; line: string };
  /** Other steps: what she says if you talk to her before it's done. */
  hint?: string;
  /** Other steps: things she hands you again if you've lost them (so you can't get stuck). */
  ensure?: Gift[];
  /** Crafting this step asks for always works (her guiding hand). */
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

export const QUESTS = ["Living off the land", "The woodcutter's start", "Into the rocks", "Standing your ground", "Odd jobs"];

const WORN_ROD: Gift = { item: "rod_pine", durability: 8 };
const WORN_PICK: Gift = { item: "pickaxe_stone_pine", durability: 10 };
const LOG: Gift = { item: "pine_logs" };
const MINNOW: Gift = { item: "minnow" };
const POT: Gift = { item: "pot_stone" };
const DAGGER: Gift = { item: "dagger_bronze_pine" };
const STAFF: Gift = { item: "staff_bronze_pine" };
const POTION: Gift = { item: "health_potion" };

export const STEPS: QuestStep[] = [
  // ---------------- Quest 1: Living off the land ----------------
  {
    quest: 0, task: `Talk to ${GUIDE_NAME} (look for the ❗, south of the furnace)`, goal: { kind: "talk" }, unlocks: ["fishing"],
    lines: [
      "Well now, a fresh face! I'm Maren. I fished these waters for forty years before my knees gave out.",
      "Everyone starts with empty hands, so let's begin with the oldest skill there is: fishing.",
      "Walk to the lake just west of the stove and click the water's edge. You've no rod, so it'll be slow. Bring me back one minnow.",
    ],
  },
  {
    quest: 0, task: "Catch a minnow by hand at the lake (west of the stove)",
    goal: { kind: "gather", skill: "fishing", resource: "minnow", count: 1, byHand: true },
    hint: "Click the water at the edge of the lake, just west of the stove. By hand it takes a while, so be patient.",
  },
  {
    quest: 0, task: `Bring your minnow back to ${GUIDE_NAME}`, goal: { kind: "talk" },
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
    quest: 0, task: "Put the rod on your belt (click it in your bag)", goal: { kind: "equip", tools: ["rod_"], names: "rod" },
    hint: "Click the rod in your bag, then press \"Put on belt\". It'll show up in the tool belt above your bag.",
    ensure: [WORN_ROD], protect: ["rod_"],
  },
  {
    quest: 0, task: "Fish until the rod breaks (watch the bar under it)", goal: { kind: "toolBreaks", tool: "rod" },
    hint: "Keep fishing with the rod on your belt until it snaps. The little bar under it shows how much it has left.",
    ensure: [WORN_ROD], protect: ["rod_"], needsTool: "rod",
  },
  {
    quest: 0, task: `Tell ${GUIDE_NAME} your rod broke`, goal: { kind: "talk" },
    lines: [
      "Snapped, did it? Every tool wears down a little each time you use it, and when it runs out, it breaks.",
      "Better tools last longer. Stone wears out fastest, bronze lasts more than twice as long, and the finer metals longer still. A better wooden handle helps too. Fishing rods are all wood, so for those, the better the wood, the better the rod.",
      "Look at you, though: all that fishing raised your Minnow Mastery. Every kind of fish, log and ore has its own Mastery, and every time one goes up a level, you earn a Mastery point.",
      "Spend your points on upgrades, like faster fishing or a bigger cooking pot. Open the 📊 panel (bottom right), tap the 🌳 next to any skill, and pick an upgrade. Go on, spend your first point now.",
    ],
  },
  {
    quest: 0, task: "Spend a Mastery point (tap 📊, then a 🌳)", goal: { kind: "spendPoint" },
    hint: "Open the 📊 panel at the bottom right, tap the 🌳 next to a skill, and pick an upgrade. No points yet? Catch a few more minnows: each Mastery level gives you one.",
  },
  {
    quest: 0, task: `Tell ${GUIDE_NAME} what you picked`, goal: { kind: "talk" }, unlocks: ["cooking"],
    lines: [
      "Good choice! And don't fret about picking wrong: resetting a tree is free, and all your points come back. Here's a few coins for learning that.",
      "Now, raw minnows won't keep you going for long. Take this pine log to the stove and cook your fish into a stew. Pick Stew, tap your minnow to put it in the pot, and pick the Pine log to burn.",
    ],
    give: [LOG],
    coins: 25,
  },
  {
    // The first stew always burns (see BURN_UNTIL).
    quest: 0, task: "Cook a stew at the stove (Stew, put in your minnow, Pine log)", goal: { kind: "craft", skill: "cooking", prefix: "meal_stew_", count: 1, tries: true },
    hint: "Click the stove (the black one with the pot, west of the furnace). Pick Stew, tap your minnow to put it in the pot, pick the Pine log, then press Make 1.",
    ensure: [LOG, MINNOW], protect: ["minnow", "pine_logs"],
  },
  {
    quest: 0, task: `Tell ${GUIDE_NAME} what happened`, goal: { kind: "talk" },
    lines: [
      "Burned it to a crisp, eh? Don't feel bad: everyone burns their first stew. When you fail, the fish and the log are gone, but you still learn a little.",
      "Here's the secret. Some tools make you faster, others make you succeed more often. Rods, axes and pickaxes are about speed. A pot, a hammer and tongs are about success.",
      "Cooking without a pot halves your chance. Take my stone pot and put it on your belt, just like the rod. Here's another log.",
    ],
    give: [POT, LOG],
  },
  {
    quest: 0, task: "Put the pot on your belt (click it in your bag)", goal: { kind: "equip", tools: ["pot_"], names: "pot" },
    hint: "Click the pot in your bag, then press \"Put on belt\".",
    ensure: [POT, LOG, MINNOW], protect: ["pot_", "minnow", "pine_logs"],
  },
  {
    quest: 0, task: "Cook a stew with the pot on your belt", goal: { kind: "craft", skill: "cooking", prefix: "meal_stew_", count: 1 },
    hint: "Cook a stew at the stove with the pot on your belt. I'll keep an eye on it this time.",
    ensure: [POT, LOG, MINNOW], guaranteed: true, protect: ["pot_", "minnow", "pine_logs"], needsTool: "pot",
  },
  {
    quest: 0, task: `Show ${GUIDE_NAME} your stew (don't eat it yet!)`, goal: { kind: "talk" }, unlocks: ["trading"],
    need: { prefix: "meal_", line: "Where's your stew? Cook one at the stove and bring it to me." },
    protect: ["meal_"],
    lines: [
      "Now that's a stew! Smells like my mother's kitchen.",
      "See the ⚡ bar at the top left? That's your stamina. Everything you do costs some: a fish costs 1, cooking 2, and chopping or mining 10.",
      "It comes back on its own, 1 every 30 seconds, but food is much faster. A raw minnow gives 2. A stew gives three times what its fish would, plus a bit from the fire. Go on, eat your stew.",
      "Then sell a fish to the Merchant. Selling trains your Trading skill, part of Charisma, and the better your Charisma, the better prices you get.",
    ],
  },
  {
    quest: 0, task: "Eat your stew (click it in your bag, then Eat)", goal: { kind: "eat" },
    hint: "Click the stew in your bag and press Eat.",
    ensure: [{ item: FIRST_STEW }],
  },
  {
    quest: 0, task: "Sell a fish to the Merchant (catch one if you have none)", goal: { kind: "sell", what: "fishing", count: 1 },
    hint: "The Merchant is the one in purple, between the furnace and the anvil. Click him, then click a fish in your bag to sell it.",
  },
  {
    quest: 0, task: `Go back to ${GUIDE_NAME} for your reward`, goal: { kind: "talk" },
    lines: [
      "You've got the hang of living off the land: fish, cook, eat, and sell what you don't need.",
      "Here's your reward: an oak fishing rod and a bronze pot. Faster fishing, fewer burned stews, and they last much longer. And some coins and a couple of stews for the road.",
      "Put them both on your belt. Your old stone pot goes back in your bag when you do.",
    ],
    give: [{ item: "rod_oak" }, { item: "pot_bronze" }, { item: SHOP_STEW, count: 2 }],
    coins: 50,
  },

  // ---------------- Quest 2: The woodcutter's start ----------------
  {
    quest: 1, task: "Put the oak rod and bronze pot on your belt", goal: { kind: "equip", tools: ["rod_", "pot_bronze"], names: "oak rod and bronze pot" },
    hint: "Click the oak fishing rod in your bag and press \"Put on belt\", then the same for the bronze pot.",
    protect: ["rod_", "pot_bronze"],
  },
  {
    quest: 1, task: "Reach Fishing level 3 (keep fishing)", goal: { kind: "skillLevel", skill: "fishing", level: 3 },
    hint: "Keep fishing. Every fish gives Fishing XP, and at Fishing 3 I'll teach you to chop trees.",
    needsTool: "rod", protect: ["rod_"],
  },
  {
    quest: 1, task: `Talk to ${GUIDE_NAME} about Woodcutting`, goal: { kind: "talk" }, unlocks: ["woodcutting"],
    lines: [
      "Fishing 3! Now I'll teach you Woodcutting. Every skill belongs to a Discipline: Fishing, Woodcutting and Mining are Endurance, and Endurance raises your max stamina. A Discipline's level is the average of its skills' levels.",
      "While we're at it, open the 📊 panel (bottom right), then Endurance, then Fishing. See the Minnow row and its Mastery level? Every kind of fish, log and ore has its own Mastery, and so does everything you make.",
      "Mastery goes up each time you catch or make that thing. The higher it is, the faster you gather it, the more often your crafting works, and the more the Merchant pays for it. It never stops growing.",
      "And remember: every Mastery level earns you another Mastery point to spend in a skill's tree (the 🌳 buttons in the 📊 panel).",
      "Now, you've no axe yet, so chop 3 logs by hand. Slow going, like your first fish. Pine trees are the pointy ones.",
    ],
  },
  {
    quest: 1, task: "Chop 3 logs by hand (no axe on your belt)", goal: { kind: "gather", skill: "woodcutting", count: 3, byHand: true },
    hint: "Click a tree to chop it. Pine trees are the pointy ones, and there are some just north of the road.",
  },
  {
    quest: 1, task: `Go back to ${GUIDE_NAME}`, goal: { kind: "talk" },
    lines: [
      "Sore hands? Good. Now you know why folks make their own tools.",
      "Tools are made at the anvil, with Smithing. But I won't teach you Smithing until you're a better cook.",
      "Cook stews at the stove until you reach Cooking 3. You can put up to 3 ingredients in the pot, and more ingredients give more XP. Here's some firewood to get you going.",
    ],
    give: [{ item: "pine_logs", count: 5 }],
  },
  {
    quest: 1, task: "Reach Cooking level 3 (cook stews)", goal: { kind: "skillLevel", skill: "cooking", level: 3 },
    hint: "Cook stews at the stove with your pot on your belt. More ingredients in the pot give more XP. If you run low on stamina, eat one!",
    needsTool: "pot", protect: ["pot_bronze"],
  },
  {
    quest: 1, task: `Talk to ${GUIDE_NAME} about Smithing`, goal: { kind: "talk" }, unlocks: ["smithing", "handicraft"],
    lines: [
      "Cooking 3! Now I'll teach you Smithing. The anvil is just right of the Merchant. Cooking and Smithing are both Dexterity, which lets you carry more and walk faster.",
      "And the workbench right of the anvil is for Handicraft: fishing bait from worms, food scraps and feathers. Handicraft is Dexterity too.",
      "A tool is a head and a handle: 1 stone or 1 metal bar for the head, and 1 log for the handle. A hammer on your belt helps you smith, the way the pot helps you cook.",
      "Here's a stone. Make yourself a stone axe at the anvil.",
    ],
    give: [{ item: "stone" }],
  },
  {
    quest: 1, task: "Make a stone axe at the anvil (1 stone + 1 log)", goal: { kind: "craft", skill: "smithing", prefix: "axe_stone_", count: 1 },
    hint: "Click the anvil, pick Axe, Stone and Pine, then press Make 1. I'll guide your hand this first time.",
    ensure: [{ item: "stone" }, LOG], guaranteed: true, protect: ["stone", "pine_logs"],
  },
  {
    quest: 1, task: "Put the stone axe on your belt", goal: { kind: "equip", tools: ["axe_"], names: "axe" },
    hint: "Click your new axe in your bag and press \"Put on belt\".",
    protect: ["axe_"],
  },
  {
    quest: 1, task: "Chop 10 logs with your axe", goal: { kind: "gather", skill: "woodcutting", count: 10, withTool: true },
    hint: "Chop trees with the axe on your belt. Remember to eat if you get tired: chopping costs 10 stamina a log. Logs are heavy (2 kg each): the ⚖️ bar under your bag shows how much you can still carry.",
    needsTool: "axe", protect: ["axe_"],
  },
  {
    quest: 1, task: "Sell some logs to the Merchant", goal: { kind: "sell", what: "woodcutting", count: 1 },
    hint: "Click the Merchant, then click logs in your bag to sell them. You can only carry so much, so sell what you don't need.",
  },
  {
    quest: 1, task: `Go back to ${GUIDE_NAME} for your reward`, goal: { kind: "talk" },
    lines: [
      "Look at you, a proper woodcutter!",
      "Your reward: a bronze axe and a bronze hammer. The axe chops faster and lasts longer, and the hammer means fewer failures at the anvil. And some coins.",
      "My last lesson is mining. I'll teach it at Endurance level 3. Put your new tools on your belt, then train Woodcutting and Fishing: Endurance is the average of the two. Chopping gives the most XP, but fishing is easiest on your stamina.",
    ],
    give: [{ item: "axe_bronze_pine" }, { item: "hammer_bronze_pine" }],
    coins: 100,
  },

  // ---------------- Quest 3: Into the rocks ----------------
  {
    quest: 2, task: "Put the bronze axe and bronze hammer on your belt", goal: { kind: "equip", tools: ["axe_bronze", "hammer_bronze"], names: "bronze axe and bronze hammer" },
    hint: "Click the bronze axe in your bag and press \"Put on belt\", then the same for the bronze hammer.",
    protect: ["axe_bronze", "hammer_bronze"],
  },
  {
    quest: 2, task: "Reach Endurance level 3 (chop and fish)", goal: { kind: "level", discipline: "endurance", level: 3 },
    hint: "Endurance is the average of your Fishing and Woodcutting levels, so train both. Chopping gives more XP per log, fishing costs much less stamina. At Endurance 3 I'll teach you Mining. When your bag gets too heavy, sell logs and fish to the Merchant.",
  },
  {
    quest: 2, task: `Talk to ${GUIDE_NAME} about Mining`, goal: { kind: "talk" }, unlocks: ["mining"],
    lines: [
      "Endurance 3. Time to learn Mining! The rocks are north of the road, up past the Merchant.",
      "Here's a worn stone pickaxe. Put it on your belt, then mine 5 stone from the plain grey rocks. Mining is hard work, so eat when you get tired.",
    ],
    give: [WORN_PICK],
  },
  {
    quest: 2, task: "Put the pickaxe on your belt", goal: { kind: "equip", tools: ["pickaxe_"], names: "pickaxe" },
    hint: "Click the pickaxe in your bag and press \"Put on belt\".",
    ensure: [WORN_PICK], protect: ["pickaxe_"],
  },
  {
    quest: 2, task: "Mine 5 stone (plain grey rocks)", goal: { kind: "gather", skill: "mining", resource: "stone", count: 5 },
    hint: "Click a plain grey rock, north of the road past the Merchant, with the pickaxe on your belt.",
    ensure: [WORN_PICK], needsTool: "pickaxe", protect: ["pickaxe_"],
  },
  {
    quest: 2, task: "Make a stone pickaxe at the anvil (1 stone + 1 log)", goal: { kind: "craft", skill: "smithing", prefix: "pickaxe_stone_", count: 1 },
    hint: "At the anvil, pick Pickaxe, Stone and Pine. If it fails, try again with another stone.",
    protect: ["stone", "pine_logs"],
  },
  {
    quest: 2, task: `Show ${GUIDE_NAME} your pickaxe`, goal: { kind: "talk" },
    need: { prefix: "pickaxe_stone", line: "Where's the pickaxe you made? Make one at the anvil from 1 stone and 1 log." },
    protect: ["pickaxe_stone"],
    lines: [
      "Your own pickaxe! Fine work.",
      "Now, bronze is made from copper and tin. You'll mine those yourself at Mining level 5, but that takes a good while.",
      "For now, buy 2 copper ore and 2 tin ore from the Merchant. Open his Buy tab. Spending coins wisely is a skill too!",
    ],
  },
  {
    quest: 2, task: "Get 2 copper ore and 2 tin ore (the Merchant's Buy tab)", goal: { kind: "have", items: { copper_ore: 2, tin_ore: 2 } },
    hint: "Click the Merchant, open the Buy tab, and buy 2 copper ore and 2 tin ore.",
    protect: ["copper_ore", "tin_ore"],
  },
  {
    quest: 2, task: "Reach Dexterity level 3 (cook, smith or make bait)", goal: { kind: "level", discipline: "dexterity", level: 3 },
    hint: "Dexterity is the average of your Cooking, Smithing and Handicraft levels. Cook stews, make stone tools at the anvil, or make bait at the workbench. At Dexterity 3 I'll teach you Smelting. Keep your copper and tin for later!",
    protect: ["copper_ore", "tin_ore"],
  },
  {
    quest: 2, task: `Talk to ${GUIDE_NAME} about Smelting`, goal: { kind: "talk" }, unlocks: ["smelting"],
    protect: ["copper_ore", "tin_ore"],
    lines: [
      "Dexterity 3! Now I'll teach you Smelting. The furnace is just left of the Merchant.",
      "Every bar takes 2 ores: a bronze bar is 1 copper and 1 tin. Tongs on your belt help you smelt, the way the hammer helps you smith.",
      "You've no tongs yet, so I'll guide your hand this time. Smelt 2 bronze bars, then make a bronze pickaxe at the anvil.",
    ],
  },
  {
    quest: 2, task: "Smelt 2 bronze bars at the furnace", goal: { kind: "craft", skill: "smelting", prefix: "bronze_bar", count: 2 },
    hint: "Click the furnace, pick Bronze, and press Make all.",
    ensure: [{ item: "copper_ore", count: 2 }, { item: "tin_ore", count: 2 }], guaranteed: true, protect: ["copper_ore", "tin_ore", "bronze_bar"],
  },
  {
    quest: 2, task: "Make a bronze pickaxe at the anvil (1 bar + 1 log)", goal: { kind: "craft", skill: "smithing", prefix: "pickaxe_bronze_", count: 1 },
    hint: "At the anvil, pick Pickaxe, Bronze and Pine, then press Make 1.",
    ensure: [{ item: "bronze_bar" }, LOG], guaranteed: true, protect: ["bronze_bar", "pine_logs"],
  },
  {
    quest: 2, task: `Show ${GUIDE_NAME} your bronze pickaxe`, goal: { kind: "talk" },
    need: { prefix: "pickaxe_bronze", line: "Where's your bronze pickaxe? Make one at the anvil from a bronze bar and a log." },
    protect: ["pickaxe_bronze"],
    lines: [
      "A bronze pickaxe, made with your own hands! You're ready.",
      "Take these bronze tongs, and some coins. Now you have a whole set of good tools: an oak rod, and a bronze pot, axe, hammer, pickaxe and tongs. When you want a better rod, carve one at the anvil from 2 logs of finer wood.",
      "There's one more thing every adventurer needs to know: how to look after yourself. Come and talk to me again when you're ready.",
    ],
    give: [{ item: "tongs_bronze" }],
    coins: 200,
  },

  // ---------------- Quest 4: Standing your ground ----------------
  {
    quest: 3, task: `Talk to ${GUIDE_NAME} about fighting`, goal: { kind: "talk" }, unlocks: ["melee", "defense"],
    lines: [
      "South of here, past the gate with the warning sign, is the Dark Forest. Wolves, goblins, giant spiders and worse. They'll attack anyone who wanders in.",
      "See the ❤ bar at the top left? That's your health. Fighting skills are Strength, and Strength raises your max health. If it runs out, you'll wake up here with me, a bit shaken but with all your things. Still, best not to make a habit of it.",
      "Let's start small. Here's a bronze dagger. Weapons and armor go in your gear strip, under the tool belt, not on the belt itself. Click the dagger in your bag and press \"Hold\".",
    ],
    give: [DAGGER],
  },
  {
    quest: 3, task: "Hold the dagger (click it in your bag, then Hold)", goal: { kind: "gear", items: ["dagger_"], names: "dagger" },
    hint: "Click the dagger in your bag and press \"Hold\". It goes in the Weapon slot of your gear strip.",
    ensure: [DAGGER], protect: ["dagger_"],
  },
  {
    quest: 3, task: "Defeat 3 chickens (in the field north-west of town)", goal: { kind: "kill", monster: "chicken", count: 3 },
    hint: "The chickens peck about in the field north-west of town, past the big path. Click one to attack it. They never fight back.",
    ensure: [DAGGER], protect: ["dagger_"], fightWith: "weapon",
  },
  {
    quest: 3, task: `Go back to ${GUIDE_NAME}`, goal: { kind: "talk" },
    lines: [
      "Well done. Open the 📊 panel and look at Strength. Every hit with a blade trains Melee, and Strength is the average of your fighting skills.",
      "Your dagger has its own Mastery, and so does every kind of monster. Dagger Mastery makes you hit more often and a little harder. Chicken Mastery helps you hit chickens and makes them drop things more often.",
      "Rats are next, and they bite back! Being attacked trains your Defense, and armor makes monsters miss. Here's a bronze helmet and a bronze shield. Wear them both.",
    ],
    give: [{ item: "helmet_bronze" }, { item: "shield_bronze" }],
  },
  {
    quest: 3, task: "Wear the helmet and the shield", goal: { kind: "gear", items: ["helmet_", "shield_"], names: "helmet and shield" },
    hint: "Click the helmet in your bag and press \"Wear\", then the same for the shield.",
    ensure: [{ item: "helmet_bronze" }, { item: "shield_bronze" }], protect: ["helmet_", "shield_"],
  },
  {
    quest: 3, task: "Defeat 2 rats (around the rocks north of the road)", goal: { kind: "kill", monster: "rat", count: 2 },
    hint: "The rats scurry around the rocks north of the road, up past the Merchant. They bite back, so watch your ❤ health.",
    ensure: [DAGGER], protect: ["dagger_", "helmet_", "shield_"], fightWith: "weapon",
  },
  {
    quest: 3, task: `Go back to ${GUIDE_NAME}`, goal: { kind: "talk" },
    lines: [
      "A few bites, eh? Health comes back on its own, but very slowly. Food is for stamina, not health. For health you want a potion.",
      "Here are two health potions. Drink one now so you know how. The Merchant sells more, and some monsters drop them.",
    ],
    give: [POTION, POTION],
  },
  {
    quest: 3, task: "Drink a health potion (click it in your bag, then Drink)", goal: { kind: "drink" },
    hint: "Click a health potion in your bag and press Drink.",
    ensure: [POTION],
  },
  {
    quest: 3, task: "Reach Strength level 3 (fight chickens, rats or cows)", goal: { kind: "level", discipline: "strength", level: 3 },
    hint: "Strength is the average of your Melee and Defense levels. Fight the chickens, rats, or the cows in the meadow south of the road, and let the rats bite you to train Defense. At Strength 3 I'll teach you Spellcasting.",
    fightWith: "weapon",
  },
  {
    quest: 3, task: `Talk to ${GUIDE_NAME} about Spellcasting`, goal: { kind: "talk" }, unlocks: ["magic"],
    lines: [
      "Strength 3! Now I'll teach you Spellcasting. It's part of Wisdom, which raises your max mana. Spells need a staff in your hand, and they use mana, the blue 🔮 bar under your stamina. Mana comes back on its own, 1 every 6 seconds.",
      "Here's a bronze staff. Hold it, and your dagger goes back in your bag. When you hold a staff, your spells show under your gear. Fire blast is the first.",
      "Each spell has its own Mastery too, and the staff's metal makes your spells hit harder. Go and defeat 2 chickens with Fire blast.",
    ],
    give: [STAFF],
  },
  {
    quest: 3, task: "Hold the staff", goal: { kind: "gear", items: ["staff_"], names: "staff" },
    hint: "Click the staff in your bag and press \"Hold\".",
    ensure: [STAFF], protect: ["staff_"],
  },
  {
    quest: 3, task: "Defeat 2 chickens with Fire blast (hold the staff)", goal: { kind: "kill", monster: "chicken", count: 2, style: "magic" },
    hint: "With the staff in your hand and Fire blast picked, click a chicken. If you run out of mana, wait a little and it comes back.",
    ensure: [STAFF], protect: ["staff_"], fightWith: "magic",
  },
  {
    quest: 3, task: `Go back to ${GUIDE_NAME}`, goal: { kind: "talk" }, unlocks: ["ranged"],
    lines: [
      "You're a natural! I'll teach you Ranged too: slings, darts and bows, to hit from a distance. It's part of Strength.",
      "Weapons and armor are made at the anvil, just like tools: a weapon is a head and a handle, armor is all metal. And they wear out like tools, so keep a spare.",
      "Here are 2 bronze bars. Make yourself some bronze platelegs at the anvil, and put them on.",
    ],
    give: [{ item: "bronze_bar", count: 2 }],
  },
  {
    quest: 3, task: "Make bronze platelegs at the anvil (2 bars)", goal: { kind: "craft", skill: "smithing", prefix: "platelegs_bronze", count: 1 },
    hint: "Click the anvil, pick Armor, then Platelegs and Bronze, and press Make 1. I'll guide your hand.",
    ensure: [{ item: "bronze_bar", count: 2 }], guaranteed: true, protect: ["bronze_bar"],
  },
  {
    quest: 3, task: "Wear your platelegs", goal: { kind: "gear", items: ["platelegs_"], names: "platelegs" },
    hint: "Click the platelegs in your bag and press \"Wear\".",
    protect: ["platelegs_"],
  },
  {
    quest: 3, task: `Talk to ${GUIDE_NAME}`, goal: { kind: "talk" }, opensGate: true,
    lines: [
      "Look at you, dressed for trouble! I think you're ready.",
      "I'll have the gate to the Dark Forest opened for you. It's south of the meadow, past the warning sign. The wolves near the gate are the easiest. Goblins live to the west, giant spiders to the east, and bandits deep in the south. Don't go near those yet!",
      "Take 3 more health potions. Hold the weapon you like best, defeat a wolf, and come back to me. If it goes badly, walk back out through the gate: they won't follow you past the fence.",
    ],
    give: [POTION, POTION, POTION],
  },
  {
    quest: 3, task: "Defeat a wolf in the Dark Forest (through the gate)", goal: { kind: "kill", monster: "wolf", count: 1 },
    hint: "The gate is south of the meadow, past the warning sign. The wolves are just inside. Drink a potion if your health gets low!",
    fightWith: "weapon",
  },
  {
    quest: 3, task: `Go back to ${GUIDE_NAME} for your reward`, goal: { kind: "talk" },
    lines: [
      "You came back! And in one piece, too.",
      "Here's a bronze platebody and bronze boots. With those you've a full bronze set: helmet, platebody, platelegs, boots and shield. And some coins.",
      "The forest gets harder the deeper you go, so train up, make better gear, and keep potions handy.",
      "Come and talk to me once more when you're ready. I've one last tip, about earning a living.",
    ],
    give: [{ item: "platebody_bronze" }, { item: "boots_bronze" }],
    coins: 300,
  },

  // ---------------- Quest 5: Odd jobs ----------------
  {
    quest: 4, task: `Talk to ${GUIDE_NAME} about the bounty board`, goal: { kind: "talk" }, opensBoard: true, unlocks: ["renown"],
    lines: [
      "See the notice board next to the Merchant? That's the bounty board. Folk pin up jobs there: bring the full amount and they pay double what the Merchant would, plus XP. Every bounty you finish trains Renown, part of Charisma.",
      "Now, open the 📜 Quests tab, bottom right. It shows my lessons and every bounty on the board. Tap one to track it, and it shows up next to your health, so you always know how many more you need.",
      "Go on: open the 📜 tab and tap a bounty to track it. Pick one that looks easy!",
    ],
  },
  {
    quest: 4, task: "Track a bounty (tap 📜 Quests, then tap a bounty)", goal: { kind: "track" },
    hint: "Tap the 📜 Quests tab at the bottom right, then tap one of the bounties in it. It'll show up next to your health.",
  },
  {
    quest: 4, task: "Finish a bounty and hand it in at the board", goal: { kind: "bounty", count: 1 },
    hint: "Gather or make what your bounty asks for, then click the bounty board next to the Merchant and press Hand in. Too hard? Press Refresh on the board for new ones.",
  },
  {
    quest: 4, task: `Go back to ${GUIDE_NAME} for your reward`, goal: { kind: "talk" },
    lines: [
      "Your first bounty! See? Honest work, and good pay.",
      "Any time you like, tap a quest or a bounty in the 📜 tab to switch what you're tracking. The board always has 5 jobs, and a new one goes up for every one you finish.",
      "That's all I can teach you. Go and make your fortune!",
    ],
    coins: 100,
  },
];

/** The Dark Forest's gate opens once you're past this step. */
export const GATE_STEP = STEPS.findIndex((s) => s.opensGate);
export const gateOpen = (q: { step: number }) => q.step > GATE_STEP;

/** The bounty board opens once you reach this step (Maren telling you about it). */
export const BOARD_STEP = STEPS.findIndex((s) => s.opensBoard);
export const boardOpen = (q: { step: number }) => q.step >= BOARD_STEP;

/** Every stew burns until you've reached this step (the first "Tell Maren what happened"). */
export const BURN_UNTIL = STEPS.findIndex((s) => s.goal.kind === "craft" && s.goal.tries);

/** Where a character is in the tutorial: which step, and how far along it (e.g. 2 of 3 logs). */
export interface QuestProgress { step: number; count: number }
export const newQuestProgress = (): QuestProgress => ({ step: 0, count: 0 });
export const tutorialDone = (q: QuestProgress) => q.step >= STEPS.length;

/** Can't be sold, dropped or eaten right now (Maren's current task needs it)? */
export const isProtected = (q: QuestProgress, item: string) => !!STEPS[q.step]?.protect?.some((p) => item.startsWith(p));

/** What the client's tracker shows. */
export interface QuestView {
  done: boolean;
  /** Quest name and number, e.g. "Living off the land", 1 of 3. */
  quest: string;
  number: number;
  of: number;
  task: string;
  /** "2 / 3 logs", "Fishing level 2 / 3", "5 uses left"... */
  progress?: string;
  /** 0 to 1, for a progress bar. */
  fraction?: number;
  /** Maren has something to say: show a ❗ over her. */
  talk: boolean;
  /** Something's wrong to fix first (e.g. "Put your rod back on your belt"). */
  warning?: string;
}

/** Pieces of a stack of gifts: { item: "pine_logs", count: 5 } -> five pine logs. */
export const giftItems = (gifts: Gift[] = []) => gifts.flatMap((g) => Array<Gift>(g.count ?? 1).fill({ item: g.item, durability: g.durability }));

/**
 * Saves from before Maren's Mastery point lesson (added after "Tell Maren your
 * rod broke") have step numbers 2 lower from there on. Bump QUEST_REV whenever
 * steps are added, and teach `migrateStep` how to move old saves along.
 */
export const QUEST_REV = 2;
export const MASTERY_LESSON_STEP = STEPS.findIndex((s) => s.goal.kind === "spendPoint");
export function migrateStep(step: number, rev: number | undefined): number {
  // Rev 1 had the talk step just before the lesson, then went straight to cooking.
  if ((rev ?? 1) < 2 && step >= MASTERY_LESSON_STEP) step += 2;
  return step;
}

/** Skills taught so far: every talk step you've finished teaches its `unlocks`. Finishing Maren's lessons opens everything. */
export function unlockedSkills(q: QuestProgress): SkillId[] {
  if (tutorialDone(q)) return [...SKILL_IDS];
  const out = new Set<SkillId>();
  STEPS.forEach((s, i) => { if (i < q.step) for (const id of s.unlocks ?? []) out.add(id); });
  return SKILL_IDS.filter((id) => out.has(id));
}

/** The step that teaches a skill (for "Old Maren will teach you this" notes). */
export const teachStep = (skill: SkillId) => STEPS.findIndex((s) => s.unlocks?.includes(skill));
