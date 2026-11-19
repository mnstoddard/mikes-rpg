// The tutorial: Old Maren's three starting quests.
//
// Every new character starts here, and there's no skipping. It's one long list
// of steps (STEPS), split into three quests. A character remembers which step
// it's on and how far along that step is (e.g. 2 of 3 logs).
//
// Each step has a goal: talk to Maren, catch/chop/mine something, cook or make
// something, sell, eat, reach a level, or have some items. Talk steps are where
// Maren explains things and hands over items and rewards. Shared so the client's
// quest tracker shows the same text the server uses.
import type { CraftSkill, DisciplineId, GatherSkill } from "./disciplines";
import type { ItemId } from "./items";
import type { ResourceId } from "./foraging";
import type { ToolType } from "./tools";

export const GUIDE_NAME = "Old Maren";

/** Something Maren hands you. Tools can come worn (fewer uses left). */
export interface Gift { item: ItemId; count?: number; durability?: number }

export type Goal =
  /** Talk to Maren. */
  | { kind: "talk" }
  /** Gather this many (of one type, if set). withTool: only counts with the right tool on your belt. */
  | { kind: "gather"; skill: GatherSkill; resource?: ResourceId; count: number; withTool?: boolean }
  /** Wear a tool on your belt down until it breaks. */
  | { kind: "toolBreaks"; tool: ToolType }
  /** Make something whose item id starts with `prefix` ("stew_", "axe_stone_"). tries: any attempt counts, even a failure. */
  | { kind: "craft"; skill: CraftSkill; prefix: string; count: number; tries?: boolean }
  /** Eat a stew. */
  | { kind: "eat" }
  /** Sell a fish or a log to the Merchant. */
  | { kind: "sell"; what: GatherSkill; count: number }
  /** Reach a Discipline level. */
  | { kind: "level"; discipline: DisciplineId; level: number }
  /** Have these items in your bag (mined or bought, either way). */
  | { kind: "have"; items: Partial<Record<ItemId, number>> };

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
  /** Other steps: what she says if you talk to her before it's done. */
  hint?: string;
  /** Other steps: things she hands you again if you've lost them (so you can't get stuck). */
  ensure?: Gift[];
  /** Crafting this step asks for always works (her guiding hand). */
  guaranteed?: boolean;
}

export const QUESTS = ["Living off the land", "The woodcutter's start", "Into the rocks"];

const WORN_ROD: Gift = { item: "rod_stone_pine", durability: 8 };
const WORN_PICK: Gift = { item: "pickaxe_stone_pine", durability: 10 };
const LOG: Gift = { item: "pine_logs" };
const MINNOW: Gift = { item: "minnow" };

export const STEPS: QuestStep[] = [
  // ---------------- Quest 1: Living off the land ----------------
  {
    quest: 0, task: `Talk to ${GUIDE_NAME} (look for the ❗, south of the furnace)`, goal: { kind: "talk" },
    lines: [
      "Well now, a fresh face! I'm Maren. I fished these waters for forty years before my knees gave out.",
      "Everyone starts with empty hands, so let's begin with the oldest skill there is: fishing.",
      "Walk to the lake just west of the stove and click the water's edge. You've no rod, so it'll be slow. Bring me back one minnow.",
    ],
  },
  {
    quest: 0, task: "Catch a minnow by hand at the lake (west of the stove)",
    goal: { kind: "gather", skill: "fishing", resource: "minnow", count: 1 },
    hint: "Click the water at the edge of the lake, just west of the stove. By hand it takes a while, so be patient.",
  },
  {
    quest: 0, task: `Bring your minnow back to ${GUIDE_NAME}`, goal: { kind: "talk" },
    lines: [
      "Ha! Took you a while, didn't it? That's fishing by hand.",
      "Here, take my old rod. It's nearly worn out, but any tool on your belt makes you much faster at its job: rods for fishing, axes for chopping, pickaxes for mining.",
      "Click the rod in your bag and put it on your belt. Then fish until it breaks, and watch the little bar under it go down.",
    ],
    give: [WORN_ROD],
  },
  {
    quest: 0, task: "Put the rod on your belt and fish until it breaks", goal: { kind: "toolBreaks", tool: "rod" },
    hint: "Click the rod in your bag, put it on your belt, and keep fishing until it snaps.",
    ensure: [WORN_ROD],
  },
  {
    quest: 0, task: `Tell ${GUIDE_NAME} your rod broke`, goal: { kind: "talk" },
    lines: [
      "Snapped, did it? Every tool wears down a little each time you use it, and when it runs out, it breaks.",
      "Better tools last longer. Stone wears out fastest, bronze lasts more than twice as long, and the finer metals longer still. A better wooden handle helps too.",
      "Now, raw minnows won't keep you going for long. Take this pine log to the stove and cook your fish into a stew.",
    ],
    give: [LOG],
  },
  {
    // The first stew always burns (see BURN_UNTIL).
    quest: 0, task: "Cook a stew at the stove (pick Minnow, 1 fish, Pine)", goal: { kind: "craft", skill: "cooking", prefix: "stew_", count: 1, tries: true },
    hint: "Click the stove (the black one with the pot, west of the furnace). Pick Minnow, how many fish, and the Pine log, then press Make 1.",
    ensure: [LOG, MINNOW],
  },
  {
    quest: 0, task: `Tell ${GUIDE_NAME} what happened`, goal: { kind: "talk" },
    lines: [
      "Burned it to a crisp, eh? Don't feel bad: everyone burns their first stew. When you fail, the fish and the log are gone, but you still learn a little.",
      "Here's the secret. Some tools make you faster, others make you succeed more often. Rods, axes and pickaxes are about speed. A pot, a hammer and tongs are about success.",
      "Cooking without a pot halves your chance. Take my stone pot, put it on your belt, and try again. Here's another log.",
    ],
    give: [{ item: "pot_stone" }, LOG],
  },
  {
    quest: 0, task: "Put the pot on your belt and cook a stew", goal: { kind: "craft", skill: "cooking", prefix: "stew_", count: 1 },
    hint: "Click the pot in your bag to put it on your belt, then cook at the stove. I'll keep an eye on it this time.",
    ensure: [{ item: "pot_stone" }, LOG, MINNOW], guaranteed: true,
  },
  {
    quest: 0, task: `Show ${GUIDE_NAME} your stew`, goal: { kind: "talk" },
    lines: [
      "Now that's a stew! Smells like my mother's kitchen.",
      "See the ⚡ bar at the top left? That's your stamina. Everything you do costs some: a fish costs 1, cooking 2, and chopping or mining 10.",
      "It comes back on its own, 1 every 30 seconds, but food is much faster. A raw minnow gives 2. A stew gives three times what its fish would, plus a bit from the fire. Go on, eat your stew.",
    ],
  },
  {
    quest: 0, task: "Eat your stew (click it in your bag, then Eat)", goal: { kind: "eat" },
    hint: "Click the stew in your bag and press Eat.",
    ensure: [{ item: "stew_minnow_1_pine" }],
  },
  {
    quest: 0, task: "Sell a fish to the Merchant (catch one if you have none)", goal: { kind: "sell", what: "fishing", count: 1 },
    hint: "The Merchant is the one in purple, between the furnace and the anvil. Click him, then click a fish in your bag to sell it.",
  },
  {
    quest: 0, task: `Go back to ${GUIDE_NAME} for your reward`, goal: { kind: "talk" },
    lines: [
      "You've got the hang of living off the land: fish, cook, eat, and sell what you don't need.",
      "Here's your reward: a bronze rod and a bronze pot. Faster fishing, fewer burned stews, and they last much longer. And some coins and a couple of stews for the road.",
      "Next I'll teach you to chop wood. You need Foraging level 3 for that, so keep fishing and come back when you get there.",
    ],
    give: [{ item: "rod_bronze_pine" }, { item: "pot_bronze" }, { item: "stew_minnow_3_pine", count: 2 }],
    coins: 50,
  },

  // ---------------- Quest 2: The woodcutter's start ----------------
  {
    quest: 1, task: "Reach Foraging level 3 (keep fishing)", goal: { kind: "level", discipline: "foraging", level: 3 },
    hint: "Keep fishing. Every fish gives Foraging XP, and at level 3 you can chop trees.",
  },
  {
    quest: 1, task: `Talk to ${GUIDE_NAME} about Woodcutting`, goal: { kind: "talk" },
    lines: [
      "Foraging 3! Each Discipline opens new skills as it levels up. Foraging gives you Woodcutting at 3 and Mining at 5. Crafting gives you Smithing at 3 and Smelting at 5.",
      "You've no axe yet, so chop 3 logs by hand. Slow going, like your first fish. Pine trees are the pointy ones.",
    ],
  },
  {
    quest: 1, task: "Chop 3 logs by hand", goal: { kind: "gather", skill: "woodcutting", count: 3 },
    hint: "Click a tree to chop it. Pine trees are the pointy ones, and there are some just north of the road.",
  },
  {
    quest: 1, task: `Go back to ${GUIDE_NAME}`, goal: { kind: "talk" },
    lines: [
      "Sore hands? Good. Now you know why folks make their own tools.",
      "Tools are made at the anvil, with Smithing. But Smithing needs Crafting level 3, so you've more cooking to do.",
      "Cook stews at the stove until you reach Crafting 3. A stew with more fish in it gives more XP. Here's some firewood to get you going.",
    ],
    give: [{ item: "pine_logs", count: 5 }],
  },
  {
    quest: 1, task: "Reach Crafting level 3 (cook stews)", goal: { kind: "level", discipline: "crafting", level: 3 },
    hint: "Cook stews at the stove. More fish in a stew gives more XP. If you run low on stamina, eat one!",
  },
  {
    quest: 1, task: `Talk to ${GUIDE_NAME} about Smithing`, goal: { kind: "talk" },
    lines: [
      "Crafting 3, and Smithing with it! The anvil is just right of the Merchant.",
      "A tool is a head and a handle: 1 stone or 1 metal bar for the head, and 1 log for the handle. A hammer on your belt helps you smith, the way the pot helps you cook.",
      "Here's a stone. Make yourself a stone axe at the anvil.",
    ],
    give: [{ item: "stone" }],
  },
  {
    quest: 1, task: "Make a stone axe at the anvil (1 stone + 1 log)", goal: { kind: "craft", skill: "smithing", prefix: "axe_stone_", count: 1 },
    hint: "Click the anvil, pick Axe, Stone and Pine, then press Make 1. I'll guide your hand this first time.",
    ensure: [{ item: "stone" }, LOG], guaranteed: true,
  },
  {
    quest: 1, task: "Put the axe on your belt and chop 10 logs", goal: { kind: "gather", skill: "woodcutting", count: 10, withTool: true },
    hint: "Click the axe in your bag to put it on your belt, then chop. It only counts with an axe on your belt.",
  },
  {
    quest: 1, task: "Sell some logs to the Merchant", goal: { kind: "sell", what: "woodcutting", count: 1 },
    hint: "Click the Merchant, then click logs in your bag to sell them.",
  },
  {
    quest: 1, task: `Go back to ${GUIDE_NAME} for your reward`, goal: { kind: "talk" },
    lines: [
      "Look at you, a proper woodcutter!",
      "Your reward: a bronze axe and a bronze hammer. The axe chops faster and lasts longer, and the hammer means fewer failures at the anvil. And some coins.",
      "My last lesson is mining. That opens at Foraging level 5. Fishing is the easiest way there: it hardly tires you. Come and see me when you get there.",
    ],
    give: [{ item: "axe_bronze_pine" }, { item: "hammer_bronze_pine" }],
    coins: 100,
  },

  // ---------------- Quest 3: Into the rocks ----------------
  {
    quest: 2, task: "Reach Foraging level 5 (fishing is easiest on stamina)", goal: { kind: "level", discipline: "foraging", level: 5 },
    hint: "Keep fishing (or chopping, but that's tiring). A fish costs 1 stamina and gives 2 XP; a log costs 10 and gives 1. At Foraging 5 you can mine.",
  },
  {
    quest: 2, task: `Talk to ${GUIDE_NAME} about Mining`, goal: { kind: "talk" },
    lines: [
      "Foraging 5. Time to mine! The rocks are north of the road, up past the Merchant.",
      "Here's a worn stone pickaxe. Put it on your belt and mine 5 stone from the plain grey rocks. Mining is hard work, so eat when you get tired.",
    ],
    give: [WORN_PICK],
  },
  {
    quest: 2, task: "Mine 5 stone", goal: { kind: "gather", skill: "mining", resource: "stone", count: 5 },
    hint: "Put the pickaxe on your belt and click a plain grey rock, north of the road past the Merchant.",
    ensure: [WORN_PICK],
  },
  {
    quest: 2, task: "Make a stone pickaxe at the anvil (1 stone + 1 log)", goal: { kind: "craft", skill: "smithing", prefix: "pickaxe_stone_", count: 1 },
    hint: "At the anvil, pick Pickaxe, Stone and Pine. If it fails, try again with another stone.",
  },
  {
    quest: 2, task: `Show ${GUIDE_NAME} your pickaxe`, goal: { kind: "talk" },
    lines: [
      "Your own pickaxe! Fine work.",
      "Now, bronze is made from copper and tin. You'll mine those yourself at Mining level 5, but that takes a good while.",
      "For now, buy 2 copper ore and 2 tin ore from the Merchant. Open his Buy tab. Spending coins wisely is a skill too!",
    ],
  },
  {
    quest: 2, task: "Get 2 copper ore and 2 tin ore (the Merchant's Buy tab)", goal: { kind: "have", items: { copper_ore: 2, tin_ore: 2 } },
    hint: "Click the Merchant, open the Buy tab, and buy 2 copper ore and 2 tin ore.",
  },
  {
    quest: 2, task: "Reach Crafting level 5 (cook stews or make stone tools)", goal: { kind: "level", discipline: "crafting", level: 5 },
    hint: "Keep cooking stews, or make stone tools at the anvil. At Crafting 5 you can smelt.",
  },
  {
    quest: 2, task: `Talk to ${GUIDE_NAME} about Smelting`, goal: { kind: "talk" },
    lines: [
      "Crafting 5 opens Smelting. The furnace is just left of the Merchant.",
      "Every bar takes 2 ores: a bronze bar is 1 copper and 1 tin. Tongs on your belt help you smelt, the way the hammer helps you smith.",
      "You've no tongs yet, so I'll guide your hand this time. Smelt 2 bronze bars, then make a bronze pickaxe at the anvil.",
    ],
  },
  {
    quest: 2, task: "Smelt 2 bronze bars at the furnace", goal: { kind: "craft", skill: "smelting", prefix: "bronze_bar", count: 2 },
    hint: "Click the furnace, pick Bronze, and press Make all.",
    ensure: [{ item: "copper_ore", count: 2 }, { item: "tin_ore", count: 2 }], guaranteed: true,
  },
  {
    quest: 2, task: "Make a bronze pickaxe at the anvil (1 bar + 1 log)", goal: { kind: "craft", skill: "smithing", prefix: "pickaxe_bronze_", count: 1 },
    hint: "At the anvil, pick Pickaxe, Bronze and Pine, then press Make 1.",
    ensure: [{ item: "bronze_bar" }, LOG], guaranteed: true,
  },
  {
    quest: 2, task: `Go back to ${GUIDE_NAME} for your reward`, goal: { kind: "talk" },
    lines: [
      "A bronze pickaxe, made with your own hands! You're ready.",
      "Take these bronze tongs, and some coins. Now you have a whole set of bronze tools: rod, pot, axe, hammer, pickaxe and tongs.",
      "Soon there'll be a bounty board in town, where folk pay double for the things they need. Until then, go and make your fortune!",
    ],
    give: [{ item: "tongs_bronze" }],
    coins: 200,
  },
];

/** Every stew burns until you've reached this step (the first "Tell Maren what happened"). */
export const BURN_UNTIL = STEPS.findIndex((s) => s.goal.kind === "craft" && s.goal.tries);

/** Where a character is in the tutorial: which step, and how far along it (e.g. 2 of 3 logs). */
export interface QuestProgress { step: number; count: number }
export const newQuestProgress = (): QuestProgress => ({ step: 0, count: 0 });
export const tutorialDone = (q: QuestProgress) => q.step >= STEPS.length;

/** What the client's tracker shows. */
export interface QuestView {
  done: boolean;
  /** Quest name and number, e.g. "Living off the land", 1 of 3. */
  quest: string;
  number: number;
  of: number;
  task: string;
  /** "2 / 3 logs", "Foraging XP 20 / 34", "5 uses left"... */
  progress?: string;
  /** 0 to 1, for a progress bar. */
  fraction?: number;
  /** Maren has something to say: show a ❗ over her. */
  talk: boolean;
}

/** Pieces of a stack of gifts: { item: "pine_logs", count: 5 } -> five pine logs. */
export const giftItems = (gifts: Gift[] = []) => gifts.flatMap((g) => Array<Gift>(g.count ?? 1).fill({ item: g.item, durability: g.durability }));
