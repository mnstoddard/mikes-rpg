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
- **Quests / Skills / Inventory:** the 📜, 📊 and 🎒 buttons (bottom right) open each panel; tap again to close. On phones they start closed so they don't cover the map.
- **Messages:** tap the message box (bottom left) to see every message since you logged in, with times.
- **Settings:** the ⚙️ button (top right, under the zoom buttons) lets you change your name (it's your login too), your password (needs the old one) and your character's colour, or **Sign out**.
- **Moving and sorting your bag:** drag an item onto another slot to swap them (a slot of several axes moves together) (mouse or finger; a short tap still opens the item). The ⇅ button at the top left of the inventory sorts it: tools, weapons, armor, food, potions, bars, logs, ore, fish, then everything else. Locks and uses left move with the item.

## The tutorial: Old Maren

Every new character starts with empty hands next to **Old Maren**, a retired
fisher standing just south of the furnace. A ❗ floats over her when she has
something to say: click her to talk (tap **Next** to read on). The **quest
tracker**, right of the health, stamina and mana bars, always shows your current
task and progress. Tap it (or the 📜 button) to open the **Quests tab**, which
lists her current lesson and every bounty on the board: tap one to track it
instead. There's no skipping.

1. **Living off the land:** catch a minnow by hand, get her worn rod and fish
   until it breaks (tools wear out), cook a stew (the first one always burns),
   get her old bronze pot (pots raise success, rods/axes/picks raise speed), cook a
   stew that can't fail, learn about stamina and eat it, then sell a fish.
   Reward: Oak fishing rod, Bronze pot, 2 stews, 50 bronze.
2. **The woodcutter's start:** reach Foraging 3, chop 3 logs by hand, cook up to
   Crafting 3, get Holt's old bronze axe, chop 10 logs with it,
   sell some logs. Reward: Bronze axe with an oak handle, 1 silver.
3. **Into the rocks:** reach Foraging 5, mine 2 copper ore with her worn bronze pickaxe, get 2 tin ore (mine it or buy it from Greta), reach
   Crafting 5, smelt 2 bronze bars and make a bronze pickaxe (both can't fail).
   Reward: Bronze tongs, 2 silver. That's a full Bronze set of tools.
4. **Standing your ground:** hold a bronze dagger and defeat 3 chickens, learn
   about weapon and monster Mastery, wear a bronze helmet and shield and defeat
   2 rats (they bite back), drink a health potion, reach Combat 3, hold a bronze
   staff and defeat 2 chickens with Fire blast, smith bronze platelegs at the anvil
   (can't fail) and wear them. Then she opens the gate to the Dark Forest:
   defeat a wolf and come back. Reward: bronze platebody and boots (a full
   bronze armor set), 3 silver.
5. **Odd jobs:** she opens the bounty board and shows you the 📜 Quests tab. Track
   a bounty there, finish it and hand it in at the board. Reward: 1 silver.

Characters who had already finished the tutorial start Quest 5 the next time they log in.

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
   **Crafting level** unlocks Cooking 1, Handicraft 2, Smithing 3, Smelting 5.
2. **Skill level** (Woodcutting, Fishing, Mining; up to 99, same curve as Foraging)
   unlocks better types, which are slower but give more XP and sell for more:
   - Woodcutting: Pine 1, Oak 5, Birch 10, Maple 20, Yew 35, Ironwood 50, Elderwood 70
   - Mining: Copper 1, Tin 1, Iron 20, Coal 30, Silver 40, Gold 55, Mithril 70
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
- **Weapons** (skill level to hold one, biggest hit before its metal adds more, seconds between hits):
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

## The bounty board

A notice board stands just above the Merchant (between him and the anvil). It
opens when Old Maren tells you about it (Quest 5); before that, clicking it says it isn't
open to you yet. Click it to see **5 bounties**, each asking for an amount of one item.
The same 5 show in the 📜 Quests tab: tap one to **track** it, and the tracker shows how
many you have (the tracker goes back to Maren's quest once it's handed in):

- **Only things you could get yourself right now:** types you can chop, mine or
  catch; bars you can smelt, tools, weapons and armor you can smith, and dishes of one fish you
  can cook, all from materials you can gather; and drops from monsters you've
  defeated before (not health potions). The board picks a kind at random (Oak logs,
  Bronze bars, Iron tools, Trout stew, Wolf pelts...), then one exact item of that kind.
- **Amounts:** 3-8 logs, ore or fish, 2-6 monster drops, 2-5 bars, 1-3 meals, 1-2 tools, weapons or armor.
- **Hand in** the full amount from your bag (no part hand-ins). Locked items don't
  count, and tools, weapons and armor must be unused.
- **Reward:** double what the Merchant would pay you for them, with your Mastery,
  plus the XP of gathering or making them once more, in that item's skill and its
  Discipline (8 Pine logs = 8 Woodcutting XP). Monster drops give the monster's kill
  bonus XP each, to Combat and that monster's Mastery.
- A finished bounty is replaced by a new one. **Refresh** rerolls all 5 (free for now).
- Your 5 bounties are saved with your character.

Rules live in `shared/bounties.ts`; the board is in `shared/npcs.ts`.

## Bag space, stacks and weight

Your bag has 12 slots. Most things stack in one slot: up to 50 logs, ore,
or fish, 100 feathers, 10 health potions, and 25 of everything else.
**Similar things share a slot too:** every axe goes together (a bronze axe and an
bronze axe), every pickaxe, every sword, every helmet and so on (up to 10 in a
slot), every bait of one kind (up to 10), and every meal of one dish (all your
stews, whatever went into them, up to 25). A slot holding different kinds looks
like a little pile. Tap it and the item card shows one at a time: use ◀ ▶ to flip
through them and see each one's numbers, then eat, equip, lock, drop or (at the
Merchant) sell the one showing. Weight still counts every single item.

A small number in the corner of a slot shows how many are in it. At the
Merchant, tapping a slot with just one kind sells the whole stack; a slot with
several kinds opens the card so you pick which. Drop drops the stack you're
looking at. In 🔒 mode, tapping a slot locks (or unlocks) everything in it; the
card's Lock button locks just the one showing (a faded 🔒 means some of the slot
is locked). Sorting the bag also joins split stacks.

You can also only carry so much **weight**: 45 kg to start. The ⚖️ bar under
your bag shows it. Your bag counts, and so do the tools on your belt and the
weapon and armor you wear. Logs, ore and bars weigh 2 kg, most fish
1 kg, feathers 0.1 kg, a cowhide 3 kg, tools 1 to 2 kg, armor 1.5 kg per bar
(mithril is lighter). With a starting axe, pickaxe, rod and pot you can carry
about 19 ore or logs. When you're full, gathering stops and the Merchant won't
sell you more until you sell, drop, eat or store something. Old Maren's gifts
always fit, so the tutorial can't get stuck.

Characters from when bags had 28 slots, or when every tool took its own slot,
keep everything: on login, similar things are joined, and whatever doesn't fit in 12 slots goes into their enchanted chest
(if they have space) or is sold to the Merchant for its full price.

The numbers live in `shared/bag.ts` (stack sizes), `shared/weight.ts`
(weights and the 45 kg limit) and `shared/items.ts` (`INVENTORY_SIZE`).

## The Mages' Guild

A purple stone hall south-west of town, by the coast, with its door facing the
road. It opens once Old Maren's lessons are done.

- **Archmage Ysolde** rents you space in the **enchanted chest**: 1 gold for 4
  spaces. Each space holds a whole stack. More space comes 4 at a time and each
  step costs more: 2, 4, 7, 12, 20, then 30 gold (up to 28 spaces).
- **Enchanted chests** stand in the guild hall, on the east island and just
  inside the Dark Forest gate. They all open the same storage. With a chest
  open, tap a stack in your bag to put it in, or tap one in the chest to take it out.
- **Guild rank** caps how big your chest can be: Initiate 4 spaces, Apprentice 8
  (5 points), Adept 12 (15), Conjurer 16 (30), Enchanter 20 (50), Magus 24 (80),
  Archmage 28 (120).
- The **guild board** has 3 magic jobs: defeat monsters with spells (hold a
  staff; it counts up by itself), or bring things the guild enchants with
  (feathers, pelts, charms, silk, rare logs and ore). Each one pays guild points,
  Magic XP and a little money. "New bounties" swaps them for free.

All the numbers are in `shared/guild.ts`.

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
Tools are just called "Axe", "Pickaxe" and so on in your bag, and drawn to show
what they're made of: the head is the colour of its metal and the
handle the colour of its wood. The item card lists the head and handle.

- **Gathering tools** (axe, pickaxe, rod) make you faster. Without one, gathering
  takes **3 times longer**. For axes and pickaxes, the head's metal and the handle's wood each add a bonus:
  Bronze 5%, Iron 10%, Steel 15%, Mithril 25%; Pine 5%, Oak 7%, Birch 9%,
  Maple 12%, Yew 15%, Ironwood 20%, Elderwood 25%. So a Bronze + Pine axe is
  10% faster, a Mithril + Elderwood one 50% faster. Anyone can use any tool.
- **Fishing rods are all wood** (no metal): 2 logs of one kind, and the wood counts twice.
  A Pine rod is 10% faster with 120 uses, up to Elderwood: 50% faster, 300 uses. Rods
  from older saves (like a Bronze + Pine rod) turned into a rod of their handle's wood.
- **Crafting tools**: the hammer helps Smithing, the tongs help Smelting. They
  remove that share of your failures (a 10% hammer turns a 75% fail chance into
  67.5%). Without one, your success chance is **cut in half**. Tongs have no
  handle, so their metal counts twice.
- **Wear:** every use costs a tool some of its uses: 1 for level 1-9 trees,
  rocks, fish and recipes, up to 8 for level 70+. Uses: Bronze 150, Iron 300,
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

- 🔨 **Smithing** at the **anvil** (right of the Merchant): axe, pickaxe and
  hammer = 1 bar + 1 log; tongs = 3 bars; a fishing rod = 2 logs
  (needs the Smithing level of chopping that wood, 80% success to start, no hammer needed). There is no stone:
  **bronze** is the starter tier, so a new smith can make a Bronze + Pine axe
  right away. Metals unlock at Smithing 1 / 15 / 30 / 60.
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
- The Merchant sells basic tools (Bronze + Pine, Bronze tongs), a bronze dagger,
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
| `shared/bounties.ts` | The bounty board: which bounties you can get, amounts, rewards |

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
also while logged out, and from **eating** (click a fish or a meal, then Eat).

- **Raw fish:** Minnow 2, Trout 3, Perch 4, Salmon 5, Pike 7, Tuna 10, Swordfish 14, Eel 20.
- **Cooking** (🍲, a Crafting skill open from the start): at the stove next
  to the furnace, pick a **dish**, tap ingredients from your bag to put them
  in the pot (up to 3; more with the skill tree), and pick a log to burn.
  Things a dish can't use (rat tails, or fish in a stir fry) are grayed out.
  Rules live in `shared/cooking.ts`.
  - Dishes (Cooking level, stamina multiplier per ingredient, fire multiplier):
    **Stew** 1 (everything ×3, fire ×1.5), **Stir fry** 3 (chicken and beef ×4,
    vegetables ×3.5, no fish), **Curry** 5 (fish ×4.5, chicken ×3.5, beef and
    vegetables ×3), **Roast** 7 (beef ×5, chicken ×4.5, vegetables ×2.5, no fish).
  - Ingredients (stamina before the multiplier): fish as eaten raw; **raw
    chicken** 4 (chickens drop it), **raw beef** 6 (cows, Cooking 5),
    **potato** 2 and **carrot** 2 (the Merchant sells them), **mushroom** 3
    (found now and then while chopping, Cooking 3). You can cook a fish once your
    Cooking level reaches its Fishing level.
  - Meal stamina = each ingredient × the dish's multiplier + the fire (Pine 12,
    Oak 15, Birch 18, Maple 22, Yew 28, Ironwood 35, Elderwood 45, times the
    dish's fire multiplier), then +2% per Mastery level in that dish. Each dish
    has its own Mastery. Success starts at 50% for stew (lower for the fancier
    dishes) and climbs with Mastery; a **pot** on the tool belt removes failures,
    no pot halves the chance. A cooked meal sometimes leaves **food scraps**.
  - A meal's item id lists what's in it (`meal_curry_oak_potato-trout-trout`),
    so every mix is its own item. Old fish stews became the same stew.
- **Pot and tongs** take 3 bars and no wood.
- The Merchant sells a bronze pot, a stew of 3 minnows (pine), potatoes, carrots and worms at his usual 3× price.

## Handicraft and fishing bait

🧵 **Handicraft** is a Crafting skill (opens at Crafting 2), done at the
**workbench** just east of the anvil. No tool needed. For now it makes bait
(`shared/handicraft.ts`):

- **Worm bait** (Handicraft 1, 2 worms): 30% faster fishing.
- **Chum bait** (Handicraft 3, 2 food scraps + 1 worm): +50% Fishing XP per catch.
- **Glow bait** (Handicraft 6, 2 worms + 1 feather): 15% chance to catch two fish.

Each bait lasts 25 catches; up to 10 of one kind share a bag slot. Fishing uses the
first **unlocked** bait in your bag, so lock one to save it for later. Worms
turn up 12% of the time while chopping or mining (the Merchant sells them too),
and cooking leaves food scraps 35% of the time.

## Mastery skill trees

Every time any Mastery goes up a level (Oak, Trout, Axe, Stew, Dagger,
Chicken...), you earn a **Mastery point**. Spend points in any skill's tree:
the 🌳 button at the top of the 📊 panel (it shows points to spend), or the
"Skill tree" button under any skill. Each skill has 3 upgrades with 3 ranks;
rank 1 costs 1 point, rank 2 costs 2, rank 3 costs 3. Resetting a tree (or all
of them) is free for now. Points aren't saved, only ranks: what you've earned is
worked out from your Mastery levels. Trees live in `shared/skilltree.ts`.

- Woodcutting, Mining: faster, chance of an extra log or ore, chance of no stamina cost.
- Fishing: faster, chance of an extra fish, more Fishing XP.
- Cooking: **Bigger pot** (+1 ingredient per rank, up to 6), fewer burns, meals give more stamina.
- Smelting: fewer failures, chance of an extra bar, chance of no stamina cost.
- Smithing: fewer failures, chance tools, weapons and armor don't wear, more XP.
- Handicraft: fewer failures, chance of an extra bait, more XP.
- Melee, Ranged: hit more often, hit harder, chance an attack costs no stamina.
- Magic: hit more often, hit harder, chance a spell costs no mana.
- Defense: +5 max health per rank, monsters hit you less, more Defense XP.
