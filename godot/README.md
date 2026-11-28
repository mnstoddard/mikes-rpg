# Emberfall: the Godot version (art first)

This folder is the start of the Godot app version of Emberfall (Windows, Mac,
iPhone/iPad and Android). The live web game is not affected by anything here:
Render ignores this folder.

## What's here so far

- `art/style-guide.json`: the shared art rules (colours, lighting, materials,
  polygon budgets). Readable version: the "Emberfall Art Style" page.
- `assets/textures/<material>/`: tileable textures. Each material has
  `_albedo.png` (colour), `_normal.png` (bumps, OpenGL style) and `_orm.png`
  (red = ambient occlusion, green = roughness, blue = metal), plus
  `_emission.png` when it glows.
- `assets/materials/<material>.tres`: ready-to-use Godot materials made from
  those textures. Ground materials use world-space triplanar mapping, so they
  can go straight onto terrain without UVs.
- `assets/environment/emberfall_day.tres` and `emberfall_lighting.tscn`: the
  sky, sun, fog and colour settings from the style guide. Drop the scene into
  any test scene to see things lit the Emberfall way.
- `assets/characters/`: the people (hero, NPCs) and creatures as `.glb`
  models with skeletons and motions. See `assets/characters/README.md`.
- `tools/`: the Python scripts that make all of the above. Every texture is
  generated from code, so it can be tweaked and remade at any time.

## Remaking the textures

Needs Python 3 with `numpy` and `Pillow` (`pip install numpy pillow`). From the
repository's top folder:

```
python3 godot/tools/gen.py godot/assets/textures            # all materials (about 5 minutes)
python3 godot/tools/gen.py godot/assets/textures grass rock  # just some
python3 godot/tools/godot_materials.py godot/assets/textures godot/assets/materials godot/assets/environment godot/art/style-guide.json
```

## Galleries

- `tools/gallery/build_style.py art/style-guide.json OUT.html` makes the
  "Emberfall Art Style" page from the style guide.
- `tools/gallery/build_materials.py assets/textures art/style-guide.json OUT_DIR`
  makes the "Emberfall Materials" 3D gallery (smaller preview copies of the
  textures plus `index.html`).

Nothing here has been opened in the Godot editor yet: the `.tres` files follow
Godot 4.4's text format and will be checked the first time the project is
opened.
