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

The painted textures inside each `.glb` are light preview versions. In Godot,
`godot/scripts/items/item_look.gd` swaps them for the shared 512 px material
library (`res://assets/materials/`, from the style guide thread):

```gdscript
var sword = preload("res://assets/items/weapons/sword.glb").instantiate()
ItemLook.apply_game_item(sword, "sword_steel_yew")   # or ItemLook.apply(sword, {"metal": "steel", "wood": "yew"})
```

Item UVs aren't laid out in metres, so the script projects the library
textures in the item's own space (triplanar, 1 tile per metre, matching the
style guide's 512 px per metre).

## What's here

125 models in 15 groups: tools (7), weapons (10), armor (14: plate, leather
and cloth sets), resources (logs, bars, 9 ores and coal), materials (leather,
thread, cloth, hides and pelts, silk), fish (8), ingredients, foraging finds,
food (5 dishes), potions (10 and the empty vial), monster loot, bait, gems and
jewelry, spell books and quest items. `_gallery/catalog.json` lists every
model with the game item ids it is used for, its triangle count and size.
