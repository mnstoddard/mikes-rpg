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
| Dead tree | scenery | Bare, Mossy |
| Crownwood | planned (Sundered Crown) | Gilded, Sunset |

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

## The Tree Gallery

A page for looking at every tree, trying its variants, chopping it down, and
**approving** it (or asking for changes, with a note). Only approved trees go
into the game; each tree's `status` in `src/trees/index.ts` records Mike's review.

Build it with `npm run gallery` (from the top folder). It makes one file,
`client3d/dist/tree-gallery.html`, that opens in any browser.
