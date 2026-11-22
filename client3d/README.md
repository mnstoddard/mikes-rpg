# client3d: the 3D game (Version 1.0)

This folder will become the three.js 3D game (see `docs/VERSION-1.0-PLAN.md`).
For now it holds the **game elements we build and approve first**, so they're
ready when the 3D world is built.

## Trees (`src/trees/`)

One file per tree type. Each tree is made from code (no model files), in the
low-poly look, and every one can:

- come in **variants** (e.g. Pine: Classic, Tall, Snowy),
- look a little different every time, from a **seed** number (the same seed
  always gives the same tree, so the world looks the same for every player),
- **sway** in the wind (birches bend the most, ironwood hardly moves),
- **shake** when chopped, **fall** over, leave a **stump**, and **grow back**.

| Tree | Woodcutting | Variants |
|---|---|---|
| Pine | 1 | Classic, Tall, Snowy |
| Oak | 5 | Round, Spreading, Autumn |
| Birch | 10 | Single, Twin, Golden |
| Maple | 20 | Red, Orange, Summer |
| Yew | 35 | Old, Ancient, Young |
| Ironwood | 50 | Steel, Rusted |
| Elderwood | 70 | Violet, Moonlit |
| Crownwood | planned (Sundered Crown) | Gilded, Sunset |

All of these were approved by Mike. Any tree can also be made **dead**
(`createTree("oak", { dead: true })`): grey bark and a few dry leaves, for
places like the shrines in Forester Holt's quest.

Levels and logs come straight from `shared/foraging.ts`, so the 2D and 3D games
always agree.

Using a tree in the game:

```ts
import { createTree } from "./trees";
const tree = createTree("oak", { seed: 42, variant: 0 });
scene.add(tree.object);
tree.update(dt, time, wind); // every frame
tree.hit();                  // a chop
tree.fell();                 // it comes down, leaving a stump
tree.regrow();               // it grows back
```

## Rocks and ores (`src/rocks/`)

Every rock you can mine, made from code the same way: a lumpy boulder with ore
in it (nuggets, coal chunks or crystals). `rock.ts` builds them; `index.ts`
has a small look recipe for each ore.

- Three **shapes** for every ore: Boulder, Cluster and Outcrop.
- **Mining**: each hit shakes the rock and pops off a piece of ore. When the
  rock runs out (`deplete()`), the rest crumbles away and the rock goes
  darker. `refill()` grows the ore back.
- Shiny ores **glint**, and mithril, iridium, ruby, soul stone, Aurelite and
  Wellglass **glow**, which shows best at night.

| Group | Rocks |
|---|---|
| Ores and stone | Stone, Copper, Tin, Iron, Coal, Silver, Gold, Mithril, Platinum, Iridium |
| Gems | Amethyst, Topaz, Soul stone vein, Emerald, Sapphire, Ruby |
| Planned (Sundered Crown) | Aurelite, Wellglass |

```ts
import { createRock } from "./rocks";
const rock = createRock("copper", { seed: 42, variant: 0 });
scene.add(rock.object);
rock.update(dt, time); // every frame
rock.hit();            // one ore mined
rock.deplete();        // it runs out
rock.refill();         // it comes back
```

## The galleries

Pages for looking at every element, trying its variants, using it (chop,
mine), switching day, sunset and night, and **approving** it (or asking for
changes, with a note). Only approved elements go into the game; each one's
`status` in its `index.ts` records Mike's review.

`src/gallery/app.ts` is the shared gallery; `trees.ts` and `ores.ts` describe
what each one shows. Build them with `npm run gallery` (from the top folder).
It makes `client3d/dist/tree-gallery.html` and `client3d/dist/ore-gallery.html`,
which open in any browser.

## The character (`src/character/`)

The smooth character from the Character Workshop, ready for the 3D game. A
"recipe" holds every Workshop setting (body, face, hair, clothes, colours); the
Workshop's character code loads with `recipeFromCode`.

```ts
import { createCharacter } from "./character";
const hero = createCharacter({ hairStyle: "long", frame: 1 });
scene.add(hero.object);           // faces +Z, feet on y = 0
hero.setAnim("walk");             // idle, walk, wave, cheer, pose (or null to pose it yourself)
hero.update(dt, time);            // every frame
hero.joints.handR.add(sword);     // things held go in the hands
hero.joints.skull.add(helmet);    // and on the head
```

`hero.fit` has the body's measurements, so armor can be shaped to fit any body.

## Weapons (`src/weapons/`)

Every weapon, made from code in the low-poly look: the game's nine weapon
types (dagger, sword, mace, spear, two-handed sword, sling, darts, bow, staff),
arrows, and four planned story weapons (Warden's weapon, Goblin-forged dagger,
Severing Blade, Lightforged weapon). Each has two or three **designs** to pick
from, and is built from any **metal** (stone to mithril, plus planned
Aurelite) and **handle wood** (pine to elderwood, plus planned Crownwood).
Staffs can hold an enchantment **gem**, which also colours their bolt.

Every weapon is built the same way round: the middle of the grip at (0,0,0),
the blade pointing up +Y. Stats come from `shared/gear.ts`, so the 2D and 3D
games always agree.

```ts
import { createWeapon, optionsForItem } from "./weapons";
const sword = createWeapon("sword", { variant: 0, metal: "iron", wood: "oak" });
hero.joints.handR.add(sword.held ?? sword.object);
const { kind, opts } = optionsForItem("bow_stone_yew"); // from a game item id
```

## The Weapon Gallery

Like the Tree Gallery, for weapons: try each design, metal, wood and gem, see
it next to a person, watch the character swing, stab, shoot or cast at a
training dummy (with slow motion), see it at night, and **approve** it or ask
for changes. Build it with `node build-gallery.mjs weapon` (in `client3d/`).

## Tools and items (`src/items/`)

Everything you carry or use that isn't a tree, rock, weapon, armor piece or
food: 64 items in 8 groups, all made from code in the low-poly look.

| Group | Items | Options |
|---|---|---|
| Tools | axe, pickaxe, shovel, fishing rod, hammer, tongs, cooking pot | head (stone, bronze, iron, steel, mithril), handle wood |
| Materials | logs, metal bars, leather, thread, cloth | wood or metal (all 8 bars), one or a stack |
| Foraging finds | worm, wild root, red cap, mushroom, sage, ginseng, honeycomb, old bone, blue lotus, moonpetal (glows), truffle, seeds | seeds: 6 crops |
| Monster loot | feather, rat tail, cowhide, wolf/alpha pelt, boar hide, tusk, fang, bat wing, slime goo, venom sac, spider silk, goblin charm, stolen ring, food scraps, bait | wolf kind, 3 baits |
| Potions | every potion (glowing, bubbling) and the empty vial | 10 potions |
| Gems & jewelry | rough gems, cut gems, soul stones/gems, rings, amulets | gem, size, metal |
| Quest items | lantern (lights up), blessing scroll, shrine totem, Rook's note, scrawled note, Maren's charm, Holt's notes, spell books | 3 spell books |
| Workshop props | storage chest, furnace, anvil, workbench, spinning wheel, tanning rack, cooking stove, alchemy table, enchanting altar, guild board | |

Each one has an action: tools swing, dig or cast, the chest opens, the
furnace roars, the anvil throws sparks, potions shake, and small things drop
and bounce like loot. `kit.ts` has the shared colours for every metal and
wood (`METAL_LOOK`, `WOOD_LOOK`) and the small building blocks.

```ts
import { createItem } from "./items";
const axe = createItem("axe", { choice: [2, 1] }); // Iron axe (Oak)
scene.add(axe.object);
axe.update(dt, time); // every frame
axe.act();            // swing it (or open, light, drop...)
hero.joints.handR.add(axe.object); // tools can be held
```

## The Items Gallery

Pick a group, then an item; try its options, press its action button, hold
tools in the character's hand, see every item in a group side by side on a
table, and **approve** it or ask for changes. Build it with
`node build-gallery.mjs items` (in `client3d/`), which makes
`dist/items-gallery.html`.

## Building a gallery page

`node build-gallery.mjs <name>` (in `client3d/`) builds
`src/<name>-gallery/main.ts` with `gallery/<name>-template.html` into one file,
`dist/<name>-gallery.html`. The names `tree` and `ore` build the review
galleries above, and with no name it builds both of those.

## Armor (`src/armor/`)

Every armor piece in the game (bronze, iron, steel and mithril plate; leather;
cloth robes) plus the planned ones from the story docs (Aurelite, Primeval
hide, and the rank cloaks, robes and gauntlets), 46 in all. Each piece is made
in code, shaped to fit the body it is worn on, and hung on the character's
joints so it moves with them. Every piece has 2 or 3 styles (e.g. helmets:
Open helm, Full helm, Crested; shields: Round, Kite, Tower).

```ts
import { wearArmor } from "./armor";
const helm = wearArmor(hero, "helmet_steel", { variant: 1 }); // game item ids
helm.remove();
```

Numbers (armor points, levels, bars) come from `shared/gear.ts`, `shared/tools.ts`
and `shared/handicraft.ts`, so the 2D and 3D games always agree.

## The Armor Gallery

`npm run gallery:armor` builds `client3d/dist/armor-gallery.html`. It shows each
piece worn by the smooth character, the full set, the piece on an armor stand,
or every set side by side, at day, sunset or night, on any of the Workshop's
characters. Mike approves each piece (with the style he picked) or asks for
changes with a note.

## Fish and food (`src/food/`)

Every fish, ingredient, crop, cooked dish and fishing spot, made from code in
the same low-poly look. Sizes are real, in metres (a tuna is 1.8 m, a potato
9 cm), so food is scaled up for icons.

| Group | What's in it | Variants |
|---|---|---|
| Fish (`fish.ts`) | Minnow, Trout, Perch, Salmon, Pike, Tuna, Swordfish, Eel | Swimming (the whole body waves), Caught (lies on its side and flops) |
| Cooked fish | The same 8 fish, cooked | Grilled (grill marks), Fried (golden crumb). Both steam |
| Dishes (`dishes.ts`) | Stew, Stir fry, Curry, Steak, Roast | Their main ingredient (Fish, Chicken, Beef, Boar, Vegetable) |
| Ingredients and crops (`ingredients.ts`) | Raw chicken, beef and boar, potato, carrot, onion, wheat, ginseng, blue lotus, mushroom, wild root, truffle | e.g. Drumstick or Breast; crops also have Growing (the plant in the ground, swaying) |
| Fishing spots (`spots.ts`) | Shallow water and the 7 fish spots | Calm or Busy (ripples in the spot's game colour, bubbles, a fish that jumps out) |

Names, levels and numbers come from `shared/` (cooking, foraging, farming,
items), so the game and the 3D models always agree.

```ts
import { createFood, createFish } from "./food";
const curry = createFood("dish-curry", { seed: 3, variant: 0 });
scene.add(curry.object);
curry.update(dt, time);   // every frame (steam, flopping, ripples...)
curry.poke?.();           // a fish darts or flops, a spot makes a fish jump
const pike = createFish("pike", { state: "caught" });
```

## The Food Gallery

Like the Tree Gallery, for all 41 fish, food and fishing spot models: try each
variant, watch it move, and Approve it or ask for changes with a note.

Build it with `npm run gallery:food -w client3d` (or `node build-gallery.mjs food` in `client3d/`). It makes
`client3d/dist/food-gallery.html`.

## Monsters (`src/monsters/`)

Every monster in the game, plus the planned ones from the story docs: 26 in
all, made in code. The world is low-poly, but monsters are **smooth and cute**,
with **painted eyes** (a big shine so they look friendly; a slanted lid on the
ones that attack, so you can still tell). Each has 2 or 3 variants and five
animations: **idle, walk, attack, get hit** (a quick red flash and squeezed
eyes) and **defeat** (it falls, then shrinks away and pops back, like a respawn).

| Group | Monsters |
|---|---|
| Near town (in the game) | Chicken, Rat, Cow, Slime, Boar, Giant bat |
| Danger zones (in the game) | Wolf, Hollow wolf, Alpha wolf, Cave spider, Giant spider, Goblin, Ashbound scout, Ashbound raider |
| Planned creatures | Fire beetle, Will-o'-wisp, Grave ghoul, Graveyard ghost, Dire wolf, Primeval beast |
| Planned bosses | The Thornmother, Frost Wyrm, The Deep One, The Dust Titan, Sable, Vael |

Blighted monsters (Hollow wolves, the Blighted alpha, the bosses) are grey with
the same mint glow as the 2D game. Goblins, the Ashbound, ghouls, Sable and Vael
are the smooth character, dressed from the armor library and holding weapons
from the weapon library. Numbers (level, health, drops) come from
`shared/combat.ts`, so the 2D and 3D games always agree.

| File | What's in it |
|---|---|
| `kit.ts` | Materials, rounded shapes, painted eyes, the joint rig and the animation player |
| `beasts.ts` | Four-legged animals (rat, cow, boar, wolves, Primeval beast, Frost Wyrm) |
| `critters.ts` | Chicken, slime, giant bat, will-o'-wisp, Graveyard ghost |
| `bugs.ts` | Spiders and beetles (cave and giant spiders, Thornmother, fire beetle, Dust Titan) |
| `folk.ts` | Goblins, the Ashbound, grave ghouls, Sable and Vael |
| `serpent.ts` | The Deep One |

```ts
import { createMonster } from "./monsters";
const wolf = createMonster("wolf", { variant: 0, seed: 7 }); // game monster ids
scene.add(wolf.object); // faces +Z, feet on y = 0, real size in metres
wolf.play("attack");    // idle, walk, attack, hit, death
wolf.update(dt, time);  // every frame
```

## The Monster Gallery

Like the other galleries: every monster at real size next to a person, its
variants, buttons for each animation (plus Slow motion and Play all), day,
sunset and night, the whole group side by side, and **Approve** or **Needs
changes** with a note. Build it with `npm run gallery:monster -w client3d`
(or `node build-gallery.mjs monster` in `client3d/`). It makes
`client3d/dist/monster-gallery.html`.
