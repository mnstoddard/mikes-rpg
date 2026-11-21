# Mike's RPG: the Version 1.0 plan (3D)

This is the plan for **Version 1.0**: the same game, rebuilt in 3D with much
better graphics, sold on Steam for PC first and on phones later.

**Nothing here is being built yet.** For now we keep working on the mechanics
and the story in today's 2D web game. This document is where we keep the 3D
plan so it's ready when you say go. Change anything you like.

Quick words used in this doc:

- **Engine**: the program you build a game in. It draws the 3D world, plays
  sounds, reads the mouse and keyboard, and exports the finished game.
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
- **A story** that ties the world together (section 7, still being chosen).

---

## 2. The engine: Godot

**Decided: Godot 4** (free, from https://godotengine.org).

Why Godot:

- **Free forever**, with no share of your sales and no revenue limit. (Unity and
  Unreal can take fees or a cut once a game earns enough.)
- **Its files are plain text.** Scenes (`.tscn`) and scripts (`.gd`) are text
  files, so Claude can read and edit them in the repo the same way it edits the
  game today. That matters a lot, since Claude is writing most of the code.
- **Good 3D lighting built in**: glow, fog, soft shadows, ambient occlusion and
  tone mapping are checkboxes on one node (WorldEnvironment).
- **Exports to Windows, Mac, Linux, iPhone and Android** from one project.
- Real 3D games ship with it, including an online RPG for phones
  (*Forbidden Realm*) and *Cassette Beasts* on Steam.

Its scripting language, **GDScript**, looks a lot like Python and is easy to
read.

---

## 3. Platforms and what they cost

### Steam (PC) first

- **Steam Direct fee: $100 per game**, one time. Valve gives it back once the
  game earns $1,000.
- **Steamworks** (Steam's login, achievements, friends list, cloud saves) is
  added to Godot with the free **GodotSteam** plugin.
- **Early Access** is an option: sell the game while it's still growing, which
  suits an RPG that keeps getting new skills and areas.
- The Windows version can be built on any computer.
- A Steam store page should go up a few months before launch, so people can
  wishlist it.

### Phones later (same project)

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
keep playing and we can keep testing new mechanics there first.

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

### Where the polish comes from (all built into Godot)

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

If we want it friendlier later, Godot's **toon lighting** and outlines can be
switched on over the same models.

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

**The plan: keep `server/` and `shared/`, and make a new Godot 3D client** in a
new folder, `godot/`. The 3D game talks to the **same server** the 2D game
uses. So:

- Every rule built in stages 1 to 13 (and everything we add before 1.0) keeps
  working with no rewrite.
- New mechanics only need to be written once, on the server.
- The 2D web game and the 3D game can even share one world while we test.

How Godot talks to Colyseus:

1. **First try**: a community Colyseus add-on for Godot. We check it still works
   with our Colyseus version before relying on it.
2. **If it doesn't**: a small, plain message layer over WebSockets (Godot has
   WebSockets built in). The server sends simple JSON messages and the Godot
   client reads them. This is a few hundred lines and fully under our control.

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
godot/     the new 3D game (new)
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
- **Tools and gear** with metal tiers (stone, bronze, iron, steel, mithril),
  wood handles, wear, Broken gear and the Repairer.
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

New things 3D makes possible, to decide later: rotating camera, animated
characters you can customise, weather (rain, mist), and sound and music.

---

## 7. Story

**Chosen direction: The Wellspring.** The full outline is in
[STORY.md](STORY.md).

The land of **Elderra** (not an island: valleys, forests, mountains, coast,
badlands and tundra joined together) is dying because its **Wellspring** is
failing. The land grows heroes, the **Kindled**, who wake at shrines with no
past and no family, and come back at a shrine when they fall. That explains
why there are so many heroes, why you respawn and why you have no backstory.

STORY.md has the regions, factions, where every trainer fits, the main quest
acts, and how the mechanics tie in. **The twist (decided):** the heroes are
what's draining the land, and a hidden group of Kindled, **the Undying**, opened
the shrines wide to steal extra life. The goal is to **restore the balance** so
every hero gives back what they take.

Story work can happen now, in the 2D game, and carries straight into 1.0.

---

## 8. Build order

Small steps, each one playable, like stages 1 to 13.

| Step | What gets built | Done when |
|---|---|---|
| **0. Setup** | Install Godot, add the `godot/` folder, pick the first model pack | An empty 3D scene opens and runs |
| **1. Vertical slice** | The starting town (Heartvale) in 3D, walking by clicking tiles, **one skill (Fishing)**, two players seeing each other, day/sunset/night lighting | You and a friend can walk around and fish together in 3D, and it looks good |
| **2. The UI** | Bars, bag, tool belt, gear strip, skills panel, quest tracker, messages, in Godot | Every panel the 2D game has works in 3D |
| **3. Town and gathering** | Trainer Row, all gathering skills, trainers and shops | Old Maren's lessons can be finished in 3D |
| **4. Combat** | Monsters with animations, weapons, spells, the Dark Forest | The combat chapter works in 3D |
| **5. Everything else** | Crafting stations, farming, alchemy, enchanting, parties | Every mechanic from section 6 works |
| **6. Story** | The chosen main story's areas, characters and cut-scenes | The main quest can be played start to finish |
| **7. Steam** | GodotSteam, Steam sign-in, store page, Early Access build | The game is on Steam |
| **8. Phones** | Touch controls, lower graphics setting, Android then iPhone builds | Testers play on phones |

**Step 1 is the important one.** If the vertical slice looks and plays well,
the rest is just more of the same. If something is wrong (the look, the
network, speed), we find out early and cheaply.

---

## 9. Costs at a glance

| What | Cost |
|---|---|
| Godot | Free |
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
3. **Characters**: pick-a-look from a pack, or build-your-own with hair, colours
   and outfits?
4. **Web version**: keep the 2D game live after Version 1.0 launches, or retire it?
5. **Price on Steam**: free to play, or a one-time price? Early Access or full
   launch?
6. **Music and sound**: free packs to start, or hire a composer later?
