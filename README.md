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

## Disciplines and skills

A **Discipline** is a broad area you level up; the **skills** inside it unlock
as its level rises, and all their XP goes into the Discipline. Open the 📊 panel
to see them. Defined in `shared/disciplines.ts` (level curve: level 2 at 10 XP,
3 at 34, 10 at 521, 99 at 38,389). XP is saved with your character.

**Foraging**
- 🪓 **Woodcutting** (level 1): click a tree to walk next to it and chop. After
  each log the tree may fall and becomes a stump for a while.
- 🎣 **Fishing** (level 3): click water next to the shore. Plain shoreline gives
  Minnows; the rippling marked spots give better fish.
- ⛏️ **Mining** (level 5): click a rock. After each ore there's a 1 in 3 chance
  the rock empties for a while.

Click an item to drop it. Moving stops what you're doing.

## Mastery

Each skill (Woodcutting, Fishing, Mining) also has its own **Mastery** level,
raised by doing that skill (the same XP also goes to Foraging). Mastery has no
cap: each level needs 10% more XP than the one before (Mastery 10 = 135 XP,
20 = 511, 50 = 10,571, 100 = 1.25 million). Higher Mastery:

- **Unlocks better types**, which are slower but give more XP and sell for more:
  - Woodcutting: Pine 1, Oak 5, Birch 10, Maple 20, Yew 35, Ironwood 50, Elderwood 70
  - Mining: Stone 1, Copper 5, Tin 10, Iron 20, Coal 30, Silver 40, Gold 55, Mithril 70
  - Fishing: Minnow 1, Trout 5, Perch 10, Salmon 20, Pike 30, Tuna 45, Swordfish 60, Eel 75
- **Makes you faster** at everything in that skill, with shrinking gains that never
  reach instant: Mastery 10 = 8% faster, 50 = 33%, 100 = 50%, 200 = 67%.

The best trees, rocks and fish are on the east island, over the bridge at the end
of the main road. Open 📊 and click a skill to see every type and what it needs.
All the numbers (time, XP, unlock level) live in `shared/foraging.ts`, the XP curve
and speed in `shared/mastery.ts`, prices in `shared/items.ts`, and where things are
in `shared/map.ts`. There's a ready hook (`gatherSuccessChance`) for giving hard
types a chance to fail later. Old saves turn logs into Pine logs, ore into Stone and
fish into Minnows (same prices), and start every Mastery at 1.

## Merchant and money

The Merchant (purple, on the road near the middle of the map) buys
everything you gather, from Pine logs (1 bronze) up to Mithril ore and Eels
(120 bronze): click him to open his shop, then click
items in your inventory to sell them one at a time.
100 bronze = 1 silver, 100 silver = 1 gold. Money shows at the bottom of the
inventory and doesn't use a slot. It's stored as one number (total bronze) and
saved with your character. Prices live in `shared/items.ts`, people in `shared/npcs.ts`.

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
| `shared/items.ts` | Item list (just Logs for now) and inventory size |

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
