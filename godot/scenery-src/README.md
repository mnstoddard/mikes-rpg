# Emberfall scenery for Godot

Every tree, rock, ore node and plant (and soon buildings, crafting stations,
fences, bridges and props) for the Godot version of Emberfall. Each one is
made from code here, then exported as a `.glb` file that Godot opens directly.

The look follows the shared style guide (`godot/art/style-guide.json`):
bright, soft and stylized but lifelike, smooth shading, no outlines, 1 unit = 1 metre,
Y up, origin at the base of each object.

## The files Godot uses

`godot/assets/scenery/<group>/<id>.glb` (one file per object and variant), plus
`catalog.json`, which lists every file with its name, variant and triangle count.
Drag the `assets` folder into a Godot project and every model is ready to place.

In Godot:

- Foliage (leaves, needles, grass) uses alpha scissor and is two-sided, as the style guide asks.
- Colours are partly in the vertex colours (soft tint and shade). Godot turns on
  "vertex colour as albedo" for these when it imports the file.
- Glowing ores (mithril, iridium, emberstone, ruby, Wellglass, Embersteel) have emission, so Godot's glow picks them up.
- For lots of grass and flowers, use a `MultiMeshInstance3D` (one draw call for thousands).
- Godot makes the LOD levels for each mesh by itself when it imports them (Mesh LOD is on by default).

## Making changes

You need Node.js. In this folder:

```
npm install three@0.186.0 esbuild@0.25.0 playwright
node build.mjs     # the gallery page -> dist/scenery-gallery.html
node export.mjs    # every .glb -> ../assets/scenery/
```

| File | What's in it |
|---|---|
| `lib.js` | Shared pieces: seeded randomness, noise, painted textures (leaves, grass, bark, stone, planks, roof tiles), materials, and the shape makers (blobs, limbs, leaf cards) |
| `trees.js` | Oak, pine (classic, tall, snowy), birch, maple, yew, ironwood, elderwood, crownwood, dead tree |
| `rocks.js` | Boulders, clusters, pebbles, cliffs, standing stones, sandstone, and all 18 ore nodes (Boulder and Cluster shapes) |
| `plants.js` | Grass, wildflowers, bushes, ferns, mushrooms, reeds, lily pads |
| `scene.js` | The gallery's sample scene (a Heartvale meadow) |
| `gallery.js`, `gallery.html` | The Scenery Gallery page |
| `export.mjs`, `export-entry.js` | Turns every object into `.glb` files |

The same seed always makes the same object, so the exported files never change unless the code does.
