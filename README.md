# RPG prototype: multiplayer map walking

Players click a tile to walk there, and everyone connected sees each other move.
The server is authoritative: clients only say "I want to walk to this tile",
and the server finds the path (A*) and moves players one tile per 600ms tick.

## Run it on your computer

1. Install **Node.js 22 LTS** from https://nodejs.org (the big green button).
2. Open a terminal in this folder (on Windows: right-click the folder → "Open in Terminal").
3. Run once:  `npm install`
4. Run:       `npm run dev`
5. Open http://localhost:5173 in two browser tabs, click **Create account** in each
   (pick any username and a password of 6+ characters), and click around.

Other people on your home Wi-Fi can join too: the terminal prints a "Network" address
like `http://192.168.1.20:5173`; open that on their device.

## Controls

- **Walk / chop:** click or tap a tile or a tree.
- **Zoom:** pinch with two fingers, scroll the mouse wheel, or use the + / − buttons (top right). Your zoom is remembered.
- **Skills / Inventory:** the 📊 and 🎒 buttons (bottom right) open each panel; tap again to close. On phones both start closed so they don't cover the map.

## The tutorial: Old Maren

Every new character starts with empty hands next to **Old Maren**, a retired
fisher standing just south of the furnace. A ❗ floats over her when she has
something to say: click her to talk (tap **Next** to read on). The **quest
tracker** under the stamina bar always shows your current task and progress
(tap it to fold it up). There's no skipping.

1. **Living off the land:** catch a minnow by hand, get her worn rod and fish
   until it breaks (tools wear out), cook a stew (the first one always burns),
   get her stone pot (pots raise success, rods/axes/picks raise speed), cook a
   stew that can't fail, learn about stamina and eat it, then sell a fish.
   Reward: Bronze rod, Bronze pot, 2 stews, 50 bronze.
2. **The woodcutter's start:** reach Foraging 3, chop 3 logs by hand, cook up to
   Crafting 3, make a stone axe at the anvil (can't fail), chop 10 logs with it,
   sell some logs. Reward: Bronze axe, Bronze hammer, 1 silver.
3. **Into the rocks:** reach Foraging 5, mine 5 stone with her worn pickaxe, make
   your own stone pickaxe, buy 2 copper and 2 tin ore from the Merchant, reach
   Crafting 5, smelt 2 bronze bars and make a bronze pickaxe (both can't fail).
   Reward: Bronze tongs, 2 silver. That's a full Bronze set of tools.
4. **Standing your ground:** hold a bronze dagger and defeat 3 chickens, learn
   about weapon and monster Mastery, wear a bronze helmet and shield and defeat
   2 rats (they bite back), drink a health potion, reach Combat 3, hold a bronze
   staff and defeat 2 chickens with Fire blast, smith bronze platelegs at the anvil
   (can't fail) and wear them. Then she opens the gate to the Dark Forest:
   defeat a wolf and come back. Reward: bronze platebody and boots (a full
   bronze armor set), 3 silver.

Characters who had already finished Quest 3 go straight on to Quest 4 (no reset).

There are explicit "put it on your belt" steps for every tool she gives you, and
guards so you can't get stuck: while a step needs an item, the Merchant won't buy
it and you can't drop or eat it; a step that needs a tool refuses to start without
it on your belt (and the tracker tells you to put it back); "by hand" steps refuse
while the tool is on your belt. If you lose something a step needs (her rod, the
log for your stew), talk to her and she hands you another, and if you're out of
stamina with no food she gives you a stew. In Quest 4, fighting steps refuse to
start without a weapon in your hand (or a staff, for the magic step), and if
you're badly hurt with no potion she gives you one. She explains Mastery in Quest 2. Steps live in `shared/quests.ts`; Maren is in `shared/npcs.ts`.

**Starting over:** `SAVE_VERSION` in `server/src/storage.ts` is the save format.
A save with a different version is wiped on login (skills, items, coins, tools,
position) and the character starts the tutorial again; the account and password
stay. Version 1 was the tutorial and version 2 its reworked steps; each time, every character started over.

## Disciplines and skills

A **Discipline** is a broad area you level up; the **skills** inside it unlock
as its level rises, and all their XP goes into the Discipline. Open the 📊 panel
to see them. Defined in `shared/disciplines.ts` (level curve: level 2 at 10 XP,
3 at 34, 10 at 521, 99 at 38,389). XP is saved with your character.

**Foraging**
- 🎣 **Fishing** (level 1): click water next to the shore. Plain shoreline gives
  Minnows; the rippling marked spots give better fish.
- 🪓 **Woodcutting** (level 3): click a tree to walk next to it and chop. After
  each log the tree may fall and becomes a stump for a while.
- ⛏️ **Mining** (level 5): click a rock. After each ore there's a 1 in 3 chance
  the rock empties for a while.

Click an item to drop it. Moving stops what you're doing.

## Skill levels and Mastery

There are three layers:

1. **Foraging level** (up to 99) unlocks skills: Fishing 1, Woodcutting 3, Mining 5.
   **Crafting level** unlocks Cooking 1, Smithing 3, Smelting 5.
2. **Skill level** (Woodcutting, Fishing, Mining; up to 99, same curve as Foraging)
   unlocks better types, which are slower but give more XP and sell for more:
   - Woodcutting: Pine 1, Oak 5, Birch 10, Maple 20, Yew 35, Ironwood 50, Elderwood 70
   - Mining: Stone 1, Copper 5, Tin 5, Iron 20, Coal 30, Silver 40, Gold 55, Mithril 70
   - Fishing: Minnow 1, Trout 5, Perch 10, Salmon 20, Pike 30, Tuna 45, Swordfish 60, Eel 75
3. **Mastery** belongs to each type (Pine, Oak, Copper, Trout...) and has no cap.
   Each Mastery level needs 10% more XP than the last (Mastery 10 = 135 XP,
   50 = 10,571, 100 = 1.25 million). It makes you **faster** at that type
   (Mastery 10 = 8% faster, 50 = 33%, 100 = 50%, never instant) and makes it
   **sell for more**: +2% per level (Mastery 51 = double), always rounded down to
   whole bronze, so cheap items need a few levels before the price ticks up.

Every item you gather gives its XP to all three, except that fishing gives only
half to Foraging (at least 1), because it costs so little stamina. The best trees, rocks and fish
are on the east island, over the bridge at the end of the main road. Open 📊 to
see everything; click a skill to fold its list away.
Numbers live in `shared/foraging.ts` (types), `shared/mastery.ts` (Mastery curve,
speed, value), `shared/items.ts` (base prices) and `shared/map.ts` (placement).
There's a ready hook (`gatherSuccessChance`) for giving hard types a chance to fail later.
Old saves: the old per-skill Mastery level becomes that skill's level, and per-type
Mastery starts at 1.

## Combat

**Combat** is the third Discipline. Its skills: 🗡️ **Melee** and 🛡️ **Defense**
(open from the start), 🪄 **Magic** (Combat 3) and 🏹 **Ranged** (Combat 5).
Numbers live in `shared/combat.ts` (monsters, spells, hit chances) and
`shared/gear.ts` (weapons and armor).

- **Health ❤, stamina ⚡ and mana 🔮** are the three bars top left. Health is
  50 + 2 per Defense level above 1, mana 50 + 2 per Magic level above 1.
  Health comes back 1 a minute on its own (also while logged out); a **health
  potion** gives 30 (the Merchant sells them for 30 bronze, and goblins, spiders
  and bandits drop them). Food is for stamina only. Mana comes back 1 every 6 seconds.
- **Fighting:** click a monster. You walk into range and attack whenever your
  weapon is ready. Each weapon attack costs 1 stamina, spells cost mana. If a
  monster hits you while you're standing still, you fight back on your own.
- **Gear strip** (under the tool belt): Weapon, Shield, Head, Body, Legs, Feet.
  Click a weapon or armor in your bag, then **Hold** or **Wear**. With nothing
  in your hand you punch (hits up to 1).
- **Weapons** (skill level to hold one, biggest hit with stone, seconds between hits):
  Melee: Dagger 1 (2, 1.8s), Sword 5 (3, 2.4s), Mace 10 (5, 3s), Spear 15 (5, 2.4s, reach 2),
  Two-handed sword 20 (8, 3.6s, no shield). Ranged: Sling 1 (2, 2.4s, 4 tiles),
  Darts 5 (2, 1.2s, 3 tiles), Bow 10 (4, 3s, 6 tiles, no shield). Magic: Staff 1.
  Better metal adds to the biggest hit: Bronze +1, Iron +2, Steel +3, Mithril +5.
  The handle's wood adds to your hit chance (Pine +5% ... Elderwood +25%).
- **Spells** (need a staff; pick one under your gear): 🔥 Fire blast (Magic 1, 4 mana,
  hits up to 4), ❄️ Frost bolt (Magic 5, 7 mana, up to 5, freezes it ~5s),
  💤 Sleep (Magic 10, 12 mana, no damage, it can't move or attack for 6s).
  The staff's metal adds to the spell's damage.
- **Armor** is all metal: Helmet 1 bar, Platebody 3, Platelegs 2, Boots 1, Shield 2.
  Armor points per piece: Helmet 1, Platebody 3, Platelegs 2, Boots 1, Shield 2,
  times Bronze 2 / Iron 3 / Steel 4 / Mithril 6 (a full bronze set is 18).
  Each armor point takes 1% off monsters' hit chance. Wearing a metal needs
  Defense at that metal's level (Bronze 1, Iron 15, Steel 30, Mithril 60).
- **Your hit chance:** 55%, +2% per level your skill is above the monster's
  (−2% below), + the handle's wood, + weapon/spell Mastery, + monster Mastery,
  between 5% and 95%. **Theirs:** 50%, +2% per level they're above your Defense,
  −1% per armor point, between 5% and 90%.
- **XP:** every point of damage gives 1 XP to Combat, your skill (Melee, Ranged or
  Magic), the weapon's (or spell's) Mastery and the monster's Mastery, plus a bonus
  for the kill. Every attack on you gives Defense XP (a quarter of its level, at least 1).
- **Mastery:** every weapon type, spell and monster has its own. Weapon and spell
  Mastery: up to +25% to hit (about +7% at 10, +20% at 50) and +1% damage per
  level. Monster Mastery: the same hit bonus against it, and each drop is +2% per
  level more likely.
- **Wear:** weapons lose uses with each attack, armor with each attack on you (one
  random piece). Same uses as tools (Bronze 150 × the handle's wood; armor ×1.5).
  Weapons and armor are smithed at the anvil (**Make: Weapons / Armor**).
- **Dying:** at 0 health you wake up next to Old Maren with half your health and
  keep everything.

**Monsters** (level, health, biggest hit, comes back after):

| Where | Monster | Lv | HP | Hits | Drops |
|---|---|---|---|---|---|
| Field NW of town | 🐔 Chicken | 1 | 4 | never | feathers |
| Rocks N of the road | 🐀 Rat | 2 | 6 | 1 (if you attack) | rat tails, coins |
| Meadow S of the road | 🐄 Cow | 3 | 12 | never | cowhides |
| Dark Forest, by the gate | 🐺 Wolf | 8 | 20 | 3 | wolf pelts, coins |
| Dark Forest, west | 👺 Goblin | 12 | 30 | 4 | goblin charms, potions, coins |
| Dark Forest, east | 🕷️ Giant spider | 18 | 42 | 6 | spider silk, potions, coins |
| Dark Forest, deep south | 🦹 Bandit | 25 | 60 | 8 | stolen rings, potions, coins |

Town monsters come back after 30-40 seconds, forest ones after 1-1.5 minutes.
**The Dark Forest** is south of the meadow, through the gate by the ⚠ sign.
Its monsters attack anyone within 4 tiles, but never leave the forest, so walking
back out through the gate is always safe. Until Old Maren opens the gate (Quest 4),
walking in says "You're not ready to go in there yet." No fighting other players.

## Merchant and money

The Merchant (purple, on the road near the middle of the map) buys
everything you gather, from Pine logs (1 bronze) up to Mithril ore and Eels
(120 bronze): click him to open his shop, then click
items in your inventory to sell them one at a time, or press **Sell all**
(tap it twice to confirm) to sell everything that isn't locked.

**Locking items:** tap the 🔒 button at the top of your inventory, then tap an
item to lock or unlock just that one item (tap 🔒 again when done). Locked items
show a small 🔒 and can't be sold or dropped, so Sell all skips them. Locks are
saved with your character.
100 bronze = 1 silver, 100 silver = 1 gold. Money shows at the bottom of the
inventory and doesn't use a slot. It's stored as one number (total bronze) and
saved with your character. Prices live in `shared/items.ts`, people in `shared/npcs.ts`.

## Tools and the tool belt

The **tool belt** sits above your bag (it doesn't use bag slots) and has one slot
each for an 🪓 axe, ⛏️ pickaxe, 🎣 fishing rod, 🔨 hammer and 🗜️ tongs. Click a
tool in your bag to put it on the belt (the one already there goes back in your
bag); click a belt slot to take it off. Only the tool on the belt counts.

- **Gathering tools** (axe, pickaxe, rod) make you faster. Without one, gathering
  takes **3 times longer**. The head (stone or metal) and the handle's wood each add a bonus:
  Stone 2%, Bronze 5%, Iron 10%, Steel 15%, Mithril 25%; Pine 5%, Oak 7%, Birch 9%,
  Maple 12%, Yew 15%, Ironwood 20%, Elderwood 25%. So a Bronze + Pine axe is
  10% faster, a Mithril + Elderwood one 50% faster. Anyone can use any tool.
- **Crafting tools**: the hammer helps Smithing, the tongs help Smelting. They
  remove that share of your failures (a 10% hammer turns a 75% fail chance into
  67.5%). Without one, your success chance is **cut in half**. Tongs have no
  handle, so their metal counts twice.
- **Wear:** every use costs a tool some of its uses: 1 for level 1-9 trees,
  rocks, fish and recipes, up to 8 for level 70+. Uses: Stone 60, Bronze 150, Iron 300,
  Steel 500, Mithril 900, times the wood (Pine x1 up to Elderwood x2.5; tongs
  x1.5). You get a warning at 10% and the tool breaks at 0. No repairs yet.
  A worn tool sells for its share of uses left.

## Crafting: Smelting and Smithing

**Crafting** is a second Discipline. Cooking is open from the start, Smithing
opens at Crafting level 3 and Smelting at Crafting level 5.
They're about **success, not speed**: each try takes 1.8 seconds and either
works or fails. A failed try **loses the materials** and gives half the XP (at
least 1). The window shows your chance before you start. Crafting never uses
locked items.

- 🔨 **Smithing** at the **anvil** (right of the Merchant): axe, pickaxe, rod and
  hammer = 1 stone or bar + 1 log; tongs = 1 stone or bar. **Stone tools** are the
  starter tier: 80% success at Mastery 1 and no hammer needed, so a new smith
  can make a Stone + Pine axe right away. Metals unlock at Smithing 1 / 15 / 30 / 60.
- 🔥 **Smelting** at the **furnace** (left of the Merchant). Every bar takes 2 ores:
  Bronze bar = 1 copper ore + 1 tin ore (level 1), Iron bar = 2 iron ore (15),
  Steel bar = 1 iron ore + 1 coal (30), Mithril bar = 1 mithril ore + 1 coal (60).

**Mastery** for crafting is per bar (Bronze bar...) and per kind of tool (all
axes share one). Better materials give more XP. Success from Mastery: 25% at
Mastery 1, about 50% at 10, 91% at 50, 99% at 100, and never 100%. Mastery
also raises the selling price by 2% per level, like gathering.

## Item info

Click any item in your bag (or a tool on your belt) for its info card: base value,
your Mastery multiplier, what the Merchant pays and charges, what it's made from,
and for tools their bonus and uses left. The card has the buttons to put a tool
on your belt, lock, or drop. (While the Merchant's Sell tab is open, a click sells.)

## Switching apps

If the connection drops (a phone switching apps, a Wi-Fi blip), the game
reconnects you as the same character for up to 2 minutes; your character waits
in the world meanwhile. After that you just log in again.

## Prices

- A crafted item is worth what goes into it **plus 25%** (rounded down). When you
  sell, your Mastery counts on every layer: your ore Mastery, your bar Mastery and
  your tool Mastery all raise the price.
- The Merchant sells basic tools (Stone + Pine, Stone tongs), a stone dagger,
  sling and staff, health potions, all four bars,
  and every log and ore, with endless stock. He charges **3 times** the base
  price, and Mastery doesn't lower it, so buying to resell always loses.
  Open the **Buy** tab in his window; tap an item to buy one, or **x5**.

Rules live in `shared/tools.ts` (metals, woods, bonuses, uses), `shared/crafting.ts`
(recipes, prices, success with your tool) and `shared/mastery.ts` (success curve).

## How it's laid out

| Folder | What it is |
|---|---|
| `shared/map.ts` | The map (drawn as text for now), tile rules, tick length |
| `shared/pathfinding.ts` | A* pathfinding used by the server |
| `server/src/WorldRoom.ts` | The game room: players joining/leaving, the tick loop, move requests |
| `server/src/index.ts` | Starts the Colyseus game server on port 2567 |
| `server/src/storage.ts` | Accounts, password hashing, and saving to Postgres or a local file |
| `client/src/login.ts` | The login / create account box |
| `client/src/WorldScene.ts` | Phaser scene: draws the map and players, handles clicks |
| `client/src/network.ts` | Connects to the game server |
| `client/src/ui.ts` | Inventory panel, message box, hover text |
| `shared/foraging.ts` | Chop chance, tree fall chance, regrow time |
| `shared/items.ts` | Every item (gathered, bars, tools) and inventory size |
| `shared/tools.ts` | Metals, woods, tool bonuses and how long tools last |
| `shared/crafting.ts` | Recipes, success chances and prices |
| `shared/npcs.ts` | Old Maren, the Merchant, furnace, anvil and stove |
| `shared/quests.ts` | Old Maren's tutorial: every step, what she says and gives |
| `shared/combat.ts` | Monsters, spells, health/mana, hit chances, combat Mastery |
| `shared/gear.ts` | Weapons and armor: types, damage, armor points, gear slots |

To change the map, edit the text grid in `shared/map.ts`
(`.` grass, `,` path, `~` water, `T` tree, `#` rock, `=` bridge, `:` dark forest
floor, `|` fence, `+` gate, `!` warning sign) and restart. Everything from the
fence row down is the Dark Forest. Monster homes are in `shared/combat.ts`.

## Production-style run (one port)

`npm run build -w client` then `npm start -w server`, and open http://localhost:2567.
This is how it'll run on your domain later.

## Tech

TypeScript, Phaser 3 (client), Colyseus 0.16 (multiplayer server), Vite (dev server).

## Online on Render

`render.yaml` sets the game up as one free Render web service. Render runs
`npm ci --include=dev && npm run build` (builds the client), then `npm start`
(the game server, which also serves the client and WebSockets on the same address).
Every push to `main` redeploys it automatically. The free plan sleeps after about
15 minutes with no visitors, so the first visit after that takes ~30-60 seconds to wake.

## Stamina and cooking

Every action costs **stamina** (the ⚡ bar, top left). You start with 100.
Costs (in `shared/cooking.ts`): Woodcutting 10 and Mining 10 per log or ore,
Smelting 5 and Smithing 5 per try, Cooking 2 per try, Fishing 1 per fish. At too
little stamina you can't do that action. Stamina comes back 1 every 30 seconds,
also while logged out, and from **eating** (click a fish or stew, then Eat).

- **Raw fish:** Minnow 2, Trout 3, Perch 4, Salmon 5, Pike 7, Tuna 10, Swordfish 14, Eel 20.
- **Fish stew** (🍲 **Cooking**, a Crafting skill open from the start): at the
  stove next to the furnace, cook 1 to 5 of one kind of fish plus 1 log as fuel.
  Stew stamina = 3 × the fish eaten raw + the fire (Pine 12, Oak 15, Birch 18,
  Maple 22, Yew 28, Ironwood 35, Elderwood 45), then +2% per Fish stew Mastery level.
  You can cook a fish once your Cooking level reaches its Fishing level.
  Success starts at 50% (a failed try burns the fish and the log) and climbs
  with Mastery; a **pot** on the tool belt removes failures, no pot halves the chance.
- **Pot and tongs** take 3 bars (or 3 stone) and no wood.
- The Merchant sells a stone pot and a Minnow stew ×3 (pine) at his usual 3× price.
