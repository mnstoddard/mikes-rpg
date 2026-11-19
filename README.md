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
   Reward: Bronze tongs, 2 silver. That's a full Bronze set.

If you lose something a step needs (her rod, the log for your stew), talk to her
and she hands you another. Steps live in `shared/quests.ts`; Maren is in `shared/npcs.ts`.

**Starting over:** `SAVE_VERSION` in `server/src/storage.ts` is the save format.
A save with a different version is wiped on login (skills, items, coins, tools,
position) and the character starts the tutorial again; the account and password
stay. Version 1 is the tutorial, so every character from before it started over.

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

Every item you gather gives its XP to all three. The best trees, rocks and fish
are on the east island, over the bridge at the end of the main road. Open 📊 to
see everything; click a skill to fold its list away.
Numbers live in `shared/foraging.ts` (types), `shared/mastery.ts` (Mastery curve,
speed, value), `shared/items.ts` (base prices) and `shared/map.ts` (placement).
There's a ready hook (`gatherSuccessChance`) for giving hard types a chance to fail later.
Old saves: the old per-skill Mastery level becomes that skill's level, and per-type
Mastery starts at 1.

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
- The Merchant sells basic tools (Stone + Pine, Stone tongs), all four bars,
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

To change the map, edit the text grid in `shared/map.ts`
(`.` grass, `,` path, `~` water, `T` tree, `#` rock, `=` bridge) and restart.

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
