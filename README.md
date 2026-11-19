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

## Foraging (gathering skill)

Click a tree to walk next to it and start chopping. Every tick (0.6s) you have
a chance to get logs, which go into your 28-slot inventory (bottom right).
After each log there's a chance the tree falls and becomes a stump, which grows
back after 30 seconds. Each log gives 1 Foraging XP; the level curve is in
`shared/skills.ts` (level 2 at 10 XP, level 10 at 521, level 99 at 38,389).
XP is saved with your character. Click a log in your inventory to drop it. Moving stops
chopping. The numbers live in `shared/foraging.ts` so they're easy to tune.

## Accounts and saving

Players log in with a username and password. Passwords are never stored, only a
salted scrypt hash. Your position and inventory are saved when you log out, about
once a minute while you play, and within 10 seconds of gaining or losing an item.
They come back when you log in again. One login per account at a time.

Where saves go:
- **On your computer:** if `DATABASE_URL` isn't set, accounts are kept in
  `server/data/accounts.json` (not committed to git). Delete that file to start fresh.
- **On Render:** set the `DATABASE_URL` environment variable to your Neon Postgres
  connection string. The `accounts` table is created automatically on first start.

## Merchant and money

The Merchant (purple, on the road near the middle of the map) buys logs for
1 bronze coin each: click him to open his shop, then Sell 1 or Sell all.
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
