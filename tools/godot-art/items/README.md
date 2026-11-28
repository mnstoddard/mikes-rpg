# Godot item models

Every item, tool and weapon for the Godot version of Emberfall, made from code
and exported as glTF (`.glb`) files Godot can import directly.

- Source: this folder (`kit.ts` has the colours, painted textures and rounded
  shapes; one file per group of items; `catalog.ts` lists them all).
- Output: `godot/assets/items/<category>/<id>.glb`, plus thumbnails and the
  gallery page in `godot/assets/items/_gallery/` (Godot ignores that folder).
- Style: follows the shared art style guide (`/mnt/project-files/godot-art/style-guide.json`):
  bright, soft, rounded, smooth shading, no outlines, metres, Y-up. Held items
  have the grip at the origin, pointing up +Y.

Build everything: `node tools/godot-art/items/build.mjs` (or list item ids to
rebuild only those), then `node tools/godot-art/items/gallery/build.mjs` for
the gallery page.

## One model, every metal and wood

A sword is one model, not 35. Its materials are named so Godot can swap them:

| Material name | Swapped for |
|---|---|
| `metal`, `metal_dark` | stone, bronze, iron, steel, mithril |
| `wood`, `bark` | pine, oak, birch, maple, yew, ironwood, elderwood |
| `jewel_metal` | silver, gold, platinum, iridium |
| `gem` | amethyst, topaz, emerald, sapphire, ruby, emberstone |

The painted textures inside each `.glb` are light preview versions; in Godot
the shared 512 px material library replaces them by material name.
