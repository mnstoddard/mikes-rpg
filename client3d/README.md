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
