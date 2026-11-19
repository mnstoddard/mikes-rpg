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
import type { CraftSkill, DisciplineId, GatherSkill } from "./disciplines";
import type { ItemId } from "./items";
import type { ResourceId } from "./foraging";
import type { ToolType } from "./tools";
import type { MonsterId } from "./combat";
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
  /** Make something whose item id starts with `prefix` ("stew_", "axe_stone_"). tries: any attempt counts, even a failure. */
  | { kind: "craft"; skill: CraftSkill; prefix: string; count: number; tries?: boolean }
  /** Eat a stew. */
  | { kind: "eat" }
  /** Sell a fish or a log to the Merchant. */
  | { kind: "sell"; what: GatherSkill; count: number }
  /** Reach a Discipline level. */
  | { kind: "level"; discipline: DisciplineId; level: number }
  /** Have these items in your bag (mined or bought, either way). */
  | { kind: "have"; items: Partial<Record<ItemId, number>> }
  /** Wear gear whose item ids start with these ("dagger_", "helmet_"). */
  | { kind: "gear"; items: string[]; names: string }
  /** Defeat monsters (of one type, if set; with one style, if set). */
  | { kind: "kill"; monster?: MonsterId; count: number; style?: CombatStyle }
  /** Drink a health potion. */
  | { kind: "drink" };

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
}

export const QUESTS = ["Living off the land", "The woodcutter's start", "Into the rocks", "Standing your ground"];

const WORN_ROD: Gift = { item: "rod_stone_pine", durability: 8 };
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
    quest: 0, task: `Talk to ${GUIDE_NAME} (look for the ❗, south of the furnace)`, goal: { kind: "talk" },
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
      "Better tools last longer. Stone wears out fastest, bronze lasts more than twice as long, and the finer metals longer still. A better wooden handle helps too.",
      "Now, raw minnows won't keep you going for long. Take this pine log to the stove and cook your fish into a stew.",
    ],
    give: [LOG],
  },
  {
    // The first stew always burns (see BURN_UNTIL).
    quest: 0, task: "Cook a stew at the stove (pick Minnow, 1 fish, Pine)", goal: { kind: "craft", skill: "cooking", prefix: "stew_", count: 1, tries: true },
    hint: "Click the stove (the black one with the pot, west of the furnace). Pick Minnow, how many fish, and the Pine log, then press Make 1.",
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
    quest: 0, task: "Cook a stew with the pot on your belt", goal: { kind: "craft", skill: "cooking", prefix: "stew_", count: 1 },
    hint: "Cook a stew at the stove with the pot on your belt. I'll keep an eye on it this time.",
    ensure: [POT, LOG, MINNOW], guaranteed: true, protect: ["pot_", "minnow", "pine_logs"], needsTool: "pot",
  },
  {
    quest: 0, task: `Show ${GUIDE_NAME} your stew (don't eat it yet!)`, goal: { kind: "talk" },
    need: { prefix: "stew_", line: "Where's your stew? Cook one at the stove and bring it to me." },
    protect: ["stew_"],
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
      "Put them both on your belt. Your old stone pot goes back in your bag when you do.",
    ],
    give: [{ item: "rod_bronze_pine" }, { item: "pot_bronze" }, { item: "stew_minnow_3_pine", count: 2 }],
    coins: 50,
  },

  // ---------------- Quest 2: The woodcutter's start ----------------
  {
    quest: 1, task: "Put the bronze rod and bronze pot on your belt", goal: { kind: "equip", tools: ["rod_bronze", "pot_bronze"], names: "bronze rod and bronze pot" },
    hint: "Click the bronze rod in your bag and press \"Put on belt\", then the same for the bronze pot.",
    protect: ["rod_bronze", "pot_bronze"],
  },
  {
    quest: 1, task: "Reach Foraging level 3 (keep fishing)", goal: { kind: "level", discipline: "foraging", level: 3 },
    hint: "Keep fishing. Every fish gives Foraging XP, and at level 3 you can chop trees.",
    needsTool: "rod", protect: ["rod_bronze"],
  },
  {
    quest: 1, task: `Talk to ${GUIDE_NAME} about Woodcutting`, goal: { kind: "talk" },
    lines: [
      "Foraging 3! Each Discipline opens new skills as it levels up. Foraging gives you Woodcutting at 3 and Mining at 5. Crafting gives you Smithing at 3 and Smelting at 5.",
      "While we're at it, open the 📊 panel (bottom right), then Foraging, then Fishing. See the Minnow row and its Mastery level? Every kind of fish, log and ore has its own Mastery, and so does everything you make.",
      "Mastery goes up each time you catch or make that thing. The higher it is, the faster you gather it, the more often your crafting works, and the more the Merchant pays for it. It never stops growing.",
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
      "Tools are made at the anvil, with Smithing. But Smithing needs Crafting level 3, so you've more cooking to do.",
      "Cook stews at the stove until you reach Crafting 3. A stew with more fish in it gives more XP. Here's some firewood to get you going.",
    ],
    give: [{ item: "pine_logs", count: 5 }],
  },
  {
    quest: 1, task: "Reach Crafting level 3 (cook stews)", goal: { kind: "level", discipline: "crafting", level: 3 },
    hint: "Cook stews at the stove with your pot on your belt. More fish in a stew gives more XP. If you run low on stamina, eat one!",
    needsTool: "pot", protect: ["pot_bronze"],
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
    ensure: [{ item: "stone" }, LOG], guaranteed: true, protect: ["stone", "pine_logs"],
  },
  {
    quest: 1, task: "Put the stone axe on your belt", goal: { kind: "equip", tools: ["axe_"], names: "axe" },
    hint: "Click your new axe in your bag and press \"Put on belt\".",
    protect: ["axe_"],
  },
  {
    quest: 1, task: "Chop 10 logs with your axe", goal: { kind: "gather", skill: "woodcutting", count: 10, withTool: true },
    hint: "Chop trees with the axe on your belt. Remember to eat if you get tired: chopping costs 10 stamina a log.",
    needsTool: "axe", protect: ["axe_"],
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
      "My last lesson is mining. That opens at Foraging level 5. Put your new tools on your belt, then get some more Foraging XP. Chopping gives the most XP, but fishing is easiest on your stamina.",
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
    quest: 2, task: "Reach Foraging level 5 (chop or fish)", goal: { kind: "level", discipline: "foraging", level: 5 },
    hint: "Keep chopping or fishing. Chopping gives more Foraging XP per log, fishing costs much less stamina. At Foraging 5 you can mine.",
  },
  {
    quest: 2, task: `Talk to ${GUIDE_NAME} about Mining`, goal: { kind: "talk" },
    lines: [
      "Foraging 5. Time to mine! The rocks are north of the road, up past the Merchant.",
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
    quest: 2, task: "Reach Crafting level 5 (cook stews or make stone tools)", goal: { kind: "level", discipline: "crafting", level: 5 },
    hint: "Keep cooking stews, or make stone tools at the anvil. At Crafting 5 you can smelt. Keep your copper and tin for later!",
    protect: ["copper_ore", "tin_ore"],
  },
  {
    quest: 2, task: `Talk to ${GUIDE_NAME} about Smelting`, goal: { kind: "talk" },
    protect: ["copper_ore", "tin_ore"],
    lines: [
      "Crafting 5 opens Smelting. The furnace is just left of the Merchant.",
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
      "Take these bronze tongs, and some coins. Now you have a whole set of bronze tools: rod, pot, axe, hammer, pickaxe and tongs.",
      "There's one more thing every adventurer needs to know: how to look after yourself. Come and talk to me again when you're ready.",
    ],
    give: [{ item: "tongs_bronze" }],
    coins: 200,
  },

  // ---------------- Quest 4: Standing your ground ----------------
  {
    quest: 3, task: `Talk to ${GUIDE_NAME} about fighting`, goal: { kind: "talk" },
    lines: [
      "South of here, past the gate with the warning sign, is the Dark Forest. Wolves, goblins, giant spiders and worse. They'll attack anyone who wanders in.",
      "See the ❤ bar at the top left? That's your health. If it runs out, you'll wake up here with me, a bit shaken but with all your things. Still, best not to make a habit of it.",
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
      "Well done. Open the 📊 panel and look at the new Combat discipline. Every hit trains Combat, and Melee too, since you used a blade.",
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
    quest: 3, task: "Reach Combat level 3 (fight chickens, rats or cows)", goal: { kind: "level", discipline: "combat", level: 3 },
    hint: "Keep fighting the chickens, rats, or the cows in the meadow south of the road. At Combat 3 you can use Magic.",
    fightWith: "weapon",
  },
  {
    quest: 3, task: `Talk to ${GUIDE_NAME} about Magic`, goal: { kind: "talk" },
    lines: [
      "Combat 3! Now you can learn Magic. Spells need a staff in your hand, and they use mana, the blue 🔮 bar under your stamina. Mana comes back on its own, 1 every 6 seconds.",
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
    quest: 3, task: `Go back to ${GUIDE_NAME}`, goal: { kind: "talk" },
    lines: [
      "You're a natural! At Combat 5 you can also use Ranged: slings, darts and bows, to hit from a distance.",
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
      "That's all I can teach you. The forest gets harder the deeper you go, so train up, make better gear, and keep potions handy. Go and make your fortune!",
      "One more thing: the bounty board next to the Merchant is open to you now. Folk pin up jobs there, and they pay double what the Merchant would.",
    ],
    give: [{ item: "platebody_bronze" }, { item: "boots_bronze" }],
    coins: 300,
  },
];

/** The Dark Forest's gate opens once you're past this step. */
export const GATE_STEP = STEPS.findIndex((s) => s.opensGate);
export const gateOpen = (q: { step: number }) => q.step > GATE_STEP;

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
  /** "2 / 3 logs", "Foraging XP 20 / 34", "5 uses left"... */
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
