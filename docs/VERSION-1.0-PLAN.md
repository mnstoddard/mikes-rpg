# Mike's RPG: the Version 1.0 plan (3D)

This is the plan for **Version 1.0**: the same game, rebuilt in 3D with much
better graphics, sold on Steam for PC first and on phones later.

**Decided: build it with three.js**, a 3D library for web pages. The game stays
a web game, written in the same language (TypeScript) as today. We keep the
server, the rules and the saves, and only replace the part that draws the
screen.

For now we keep working on the mechanics and the story in today's 2D web game.
The first 3D piece is a small **character creator** test app (section 8), so we
can try out the art style. Change anything you like.

Quick words used in this doc:

- **three.js**: a free code library that draws 3D graphics in a web browser.
  It's what the "Island in 3D" test page uses.
- **Engine**: a full program for building games, like Godot or Unity. We're
  not using one for now (section 2 says why).
- **Client**: the part of the game that runs on the player's computer or phone
  and draws everything. Today it's Phaser (2D, in a web browser).
- **Server**: the part that runs on Render and decides what really happens
  (who walks where, what you catch, who wins a fight). Today it's Colyseus.
- **Vertical slice**: a tiny piece of the game finished all the way to the
  final quality, to prove the whole plan works before building everything.

---

## 1. What Version 1.0 is

- **3D world** with a camera you can rotate and zoom, instead of the flat
  top-down map.
- **Low-poly art made to look rich with lighting** (see section 4).
- **Same game underneath**: the five disciplines, every skill, Mastery,
  quests, parties and the economy all carry over (section 6).
- **Online multiplayer**, like today.
- **Steam on PC first**, then **iPhone and Android** from the same project.
- **A story** that ties the world together (section 7).
- **Still a web game**: players open a link and play, with nothing to install.
  The Steam and phone versions are the same game, wrapped as an app.

---

## 2. The technology: three.js

**Decided: three.js** (free, https://threejs.org), replacing Phaser as the
client. Godot was the first plan; it's now the backup (see below).

Why three.js:

- **The game is already a web game in TypeScript.** Only the drawing part
  changes. The server, quests, skills, saves and everything in `shared/` stay
  exactly as they are.
- **It keeps deploying to Render like today**, and stays live the whole time.
  Every new mechanic we build in the 2D game carries straight over.
- **Players just open a link.** Nothing to install, and it works on PCs and
  phones in the browser.
- **It's all code.** Claude edits it the same way it edits the game today.
- **Good lighting is possible**: soft shadows, fog, glow (bloom), tone mapping,
  ambient occlusion and reflections. The Island in 3D test page already shows
  most of these.

The trade-offs, compared with a full engine like Godot:

- **A lower ceiling on graphics and speed.** Browsers can't push a computer
  as hard as a real engine can. For a low-poly game this is fine.
- **No visual editor.** Things like animation blending, physics and level
  layout are built in code. That suits how Claude works, but levels are
  placed by code or simple map files rather than dragged around in an editor.
- **Big worlds with many players need care**: loading areas in pieces,
  keeping the number of objects down, and a "graphics quality" setting.

**Godot stays the backup.** If the game takes off and needs top-end graphics,
we can move the client to Godot later. The server and game rules carry over
either way, because they don't depend on what draws the screen.

### Models and animations

- **Models**: low-poly packs (section 4), loaded as **glTF/GLB** files, the
  standard 3D format three.js reads best.
- **Animations**: walk, run, idle, chop, mine, fish, attack, cast and so on
  come from **Mixamo** (free from Adobe, with an account; its animations can be
  used in games you sell) or from the animations included with Quaternius and
  KayKit characters. three.js plays and blends them.

---

## 3. Platforms and what they cost

### Steam (PC) first

- **Steam Direct fee: $100 per game**, one time. Valve gives it back once the
  game earns $1,000.
- The web game is **wrapped as a desktop app** with **Electron** or **Tauri**
  (free tools that put a web page in its own window, like many indie games on
  Steam). It builds for Windows, Mac and Linux.
- **Steamworks** (Steam sign-in, achievements, friends, cloud saves) is added
  with the free **steamworks.js** library for Electron.
- **Early Access** is an option: sell the game while it's still growing, which
  suits an RPG that keeps getting new skills and areas.
- A Steam store page should go up a few months before launch, so people can
  wishlist it.

### Phones later (same game)

- The web game is wrapped as a phone app with **Capacitor** (free).
- **Android**: Google Play account, **$25 one time**. Can be built on any
  computer.
- **iPhone**: needs **a Mac** to build the app, an **Apple Developer account
  ($99 a year)**, and **TestFlight** (Apple's free tool for letting testers
  play before release).
- On phones we turn some lighting effects down (section 4) and use touch
  controls. The UI already works on phones today, so the layout ideas carry
  over.

### The web version

Today's 2D web game **stays live** while Version 1.0 is built, so friends can
keep playing and we can keep testing new mechanics there first. Once the 3D
client can do everything, it becomes the web version, at the same address.

---

## 4. The look: PC low-poly with great lighting

**Decided: "PC low-poly"**, the first option in the
[Island in 3D](https://claude.ai/artifact/6zgCZ7M5eZQdh6FovhRbpV) test page.

The idea: use **cheap ready-made low-poly models** and spend the effort on
**lighting**, not on making new art.

### Where the models come from

| Pack | Cost | Notes |
|---|---|---|
| **Kenney** (kenney.nl) | Free, even for a paid game | Huge range, simple and clean |
| **Quaternius** (quaternius.com) | Free, even for a paid game | Characters, animals, nature, buildings |
| **KayKit** (kaylousberg.itch.io) | Free and cheap paid packs | Dungeons, adventurers, towns |
| **Synty** (syntystore.com) | Paid, usually tens of dollars a pack, often on sale | The classic polished low-poly look; maybe later |

Rule of thumb: **stick to one or two pack families** so everything matches.
Keep a list of every pack used and its licence in the repo (`assets/CREDITS.md`).

### Where the polish comes from (all possible in three.js)

- **Soft shadows** from the sun, lanterns and fires.
- **Fog** in the distance and in the Dark Forest.
- **Glow** on windows, lanterns, the Mages' Guild orb, spells and gems.
- **Shiny, moving water** around the island and at the fishing spots.
- **Day, sunset and night**, tied to today's 40-minute day cycle, with stars,
  fireflies and lit windows at night.
- **Ambient occlusion** (soft dark corners where things touch).
- **Antialiasing** (smooth edges instead of jagged ones).
- Lots of **small props**: flowers, crates, barrels, fences, signposts, smoke
  from chimneys.

If we want it friendlier later, three.js has **toon materials**, and outlines
can be added over the same models.

For phones, we turn down shadows, glow and ambient occlusion with one
"graphics quality" setting.

---

## 5. How the code fits together

### Keep the server, replace the client

Today the game is split in three folders:

- `server/`: the Colyseus server on Render that decides everything.
- `shared/`: all the game rules and numbers (skills, items, monsters, quests,
  prices, Mastery...). Both the server and the client use these files.
- `client/`: the Phaser 2D client that draws it all.

**The plan: keep `server/` and `shared/`, and make a new three.js 3D client**
in a new folder, `client3d/`. It talks to the **same server** the 2D game uses,
with the same Colyseus library the 2D client already uses. So:

- Every rule built in stages 1 to 13 (and everything we add before 1.0) keeps
  working with no rewrite.
- New mechanics only need to be written once, on the server.
- The 2D web game and the 3D game can even share one world while we test.
- The 3D client can reuse a lot of the 2D client's code: the network code, the
  login screen, and the panels (bag, skills, quests), which are web pages
  laid over the game and work the same over a 3D view.

The server stays on **Render** with saves in the **Neon** database, as today.
Note: Render's free plan goes to sleep when nobody is playing, so the first
player waits a bit. Before selling on Steam we move to a paid plan (around
$7 a month to start).

### Tiles in a 3D world

The world is still a **grid of tiles underneath**, with the server moving
players one tile per 600 ms tick, as today. The 3D client simply **slides**
characters smoothly between tiles and plays walking animations, so it looks
free and natural. Clicking the ground still means "walk to this tile". Hills,
bridges and stairs are just tiles with a height.

### Accounts and Steam

- On Steam, players **sign in with their Steam account** automatically (no
  password). The server checks Steam's sign-in ticket and links it to a
  game account.
- On the web and phones, today's username and password stay.

### The repo after the change

```
server/    the Colyseus server (kept)
shared/    the game rules and numbers (kept)
client/    the 2D Phaser web game (kept while it's useful)
client3d/  the new three.js 3D game (new; starts with the tree library, see client3d/README.md)
docs/      this plan and the design doc
```

---

## 6. Mechanics that carry over

Everything built so far comes along. A 3D version needs a look for each of
these, but the rules stay the same:

- **Five disciplines**: Strength, Endurance, Wisdom, Dexterity and Charisma,
  each raising health, stamina, mana, weight limit and speed, or prices and
  party size.
- **Skills**: Fishing, Woodcutting, Mining, Foraging, Farming, Hunting, Melee,
  Ranged, Defense, Spellcasting, Enchanting, Alchemy, Cooking, Handicraft,
  Smithing, Smelting, Trading, Renown and Leadership.
- **Mastery** for every type of tree, rock, fish, weapon, spell and monster,
  with skill trees.
- **Tools and gear** with metal tiers (bronze, iron, steel, mithril),
  wood handles, wear, Broken gear and the Repairer. *Decided with Mike
  (Nov 22): there is no stone tier. Bronze is the level 1 starting tier for
  tools, weapons and arrows, so everything starts there. Old saves turn any
  stone tools, weapons and arrows into bronze ones. (Wooden bows and staffs
  are unchanged.)*
- **No stone at all** *(decided with Mike, Nov 22)*: stone rocks and the stone
  item are gone. Mining starts on **copper and tin at level 1**, the same level
  as bronze, so a new miner can make their own bronze straight away. The quarry's
  old stone rocks are copper and tin rocks now. Miner Greta's lesson has you mine
  copper and tin, and the Rebuild the Shrine quest takes 6 oak logs (for the
  frame) instead of 6 stone. Old saves holding stone get 2 bronze coins for each
  one (what it sold for), with a note when they log in.
- **Combat** with melee, ranged and the spell bar, monsters with day and night
  spawns, drops and soul trapping.
- **Crafting**: cooking, smelting, smithing, handicraft, jewellery and gems,
  alchemy and enchanting.
- **Farming plots** with real-time growth.
- **Old Maren and the trainers**, the quest chapters, the bounty board and
  Renown.
- **Parties**, shared quests and Kael's Wolf Hunt.
- **The bag** (weight and slots, locks, sorting), the tool belt and the gear
  strip.
- **Day and night** (40 minutes: 30 day, 10 night).

New things 3D makes possible: animated characters you can customise (the
character creator, section 8), a rotating camera, weather (rain, mist), and
sound and music.

---

## 7. Story

**Chosen direction: The Wellspring.** The full outline is in
[STORY.md](STORY.md).

The land of **Elderra** (not an island: valleys, forests, mountains, coast,
badlands and tundra joined together) is dying because its **Wellspring** is
failing. The land grows heroes, the **Kindled**, who wake at shrines with no
past and no family, and come back at a shrine when they fall. That explains
why there are so many heroes, why you respawn and why you have no backstory.

STORY.md has the regions, factions, where every trainer fits and how the
mechanics tie in. **The twist (decided):** the kind order that runs the shrines,
**the Lightkeepers**, are really **the Undying**, who grow heroes strong so they
can harvest them. The shrine-smashing **Ashbound** are the real good guys. Every
death leaves **Soul Debt**. You start in the Lightkeepers' temple, and at the
end of Act 3 you choose a side. The endgame is the **Sundered Crown**, a PvPvE
zone (with NPC armies, so it works with few players) where both sides hunt for
ancient magic and special materials, and climb faction ranks with buffs.

The full main quest line, act by act, is in [QUESTLINE.md](QUESTLINE.md).

Story work can happen now, in the 2D game, and carries straight into 1.0.

---

## 8. Build order

Small steps, each one playable, like stages 1 to 13.

| Step | What gets built | Done when |
|---|---|---|
| **0. Character creator** (first test) | A small separate test app: a 3D character on a turntable with sliders and pickers for body shape, male or female, face shape, hair style, skin, hair and eye colour, and outfit colours. Uses a low-poly base model with shape sliders (morph targets), swappable hair and clothing pieces, and Mixamo-style idle and walk animations | Mike can play with characters and settle on the art style |
| **1. Vertical slice** | Add `client3d/`. The starting town (Heartvale) in 3D, walking by clicking tiles, **one skill (Fishing)**, two players seeing each other, day/sunset/night lighting, characters from the creator | You and a friend can walk around and fish together in 3D, and it looks good |
| **2. The UI** | Bars, bag, tool belt, gear strip, skills panel, quest tracker, messages, moved over from the 2D client | Every panel the 2D game has works in 3D |
| **3. Town and gathering** | Trainer Row, all gathering skills, trainers and shops | The Prologue can be finished in 3D |
| **4. Combat** | Monsters with animations, weapons, spells, the Dark Forest | The combat chapter works in 3D |
| **5. Everything else** | Crafting stations, farming, alchemy, enchanting, parties | Every mechanic from section 6 works |
| **6. Story** | The story's areas, characters and cut-scenes | The main quest can be played start to finish |
| **7. Steam** | Electron or Tauri wrapper, steamworks.js, Steam sign-in, store page, Early Access build | The game is on Steam |
| **8. Phones** | Capacitor wrapper, touch controls, lower graphics setting, Android then iPhone builds | Testers play on phones |

**The character creator does double duty.** Later, the same system makes
**every NPC**: trainers, Lightkeepers, Ashbound and townsfolk are saved
character "recipes" (body, face, hair, colours, outfit), and random recipes can
fill a town with varied people. So the art choices made in step 0 carry
through the whole game.

**Step 1 is still the big test.** If the vertical slice looks and plays well,
the rest is just more of the same. If something is wrong (the look, the
network, speed), we find out early and cheaply.

---

## 9. Costs at a glance

| What | Cost |
|---|---|
| three.js, Electron or Tauri, Capacitor, steamworks.js | Free |
| Mixamo animations | Free (needs a free Adobe account) |
| Kenney, Quaternius, KayKit models | Free (some paid KayKit packs are a few dollars) |
| Synty packs (optional) | Tens of dollars each |
| Steam listing | $100 per game, one time (returned after $1,000 in sales) |
| Render paid server | About $7 a month, more as players grow |
| Android (later) | $25 one time |
| iPhone (later) | $99 a year, plus a Mac |

---

## 10. Open questions

1. **Story**: names and the open story questions in [STORY.md](STORY.md).
2. **Camera**: fixed angle like today (easier, good on phones) or free rotation?
3. ~~Characters~~ **Decided: build-your-own** in the character creator, which
   also makes the NPCs.
4. **Web version**: keep the 2D game live after Version 1.0 launches, or retire it?
5. **Price on Steam**: free to play, or a one-time price? Early Access or full
   launch?
6. **Music and sound**: free packs to start, or hire a composer later?
7. **Electron or Tauri** for the Steam app: Electron is the more common choice
   for Steam games (steamworks.js is made for it); Tauri makes smaller downloads.
