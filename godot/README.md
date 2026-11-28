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

## The app (first playable step)

The Godot project now runs as a real game client:

- **Login screen**: same usernames and passwords as the web game. "Create account" works too.
- **The world**: the area you're in is built from `data/world.json`, using the shared textures and the
  scenery thread's trees, rocks and props. That includes Heartvale, Emberhold, the Emberhall, houses and caves.
  `data/world.json` is made from the game's own `shared/` files by `tools/export-godot-data.ts`
  (`cd server && npx tsx ../tools/export-godot-data.ts`). Run it again whenever the map changes.
- **People and creatures**: you, other players (web or app), townsfolk and monsters, with the characters
  thread's models and walk animations. Each one has a name and a health bar when hurt.
- **Moving**: click or tap the ground to walk there, or use W A S D or the arrow keys (Shift runs). Drag to turn the camera,
  and use the scroll wheel or a pinch to zoom.
- **Talking**: click a person to walk over and talk. Conversations, messages and your current task
  show on screen. Brand-new characters get a "Put on your robe" button for the first step of the story.

### How it talks to the server

The app connects to the game server's **JSON door** at `/json` (see `server/src/jsonGateway.ts`).
For each app player, the server opens an ordinary game connection to itself, so the game rules can't
tell an app player from a browser player. That's what makes cross-play work.

The live server only has the door once that server change is merged into `main`. Until then, run
the game on your own computer (`npm run dev` in the repo) and type `ws://localhost:2567/json` as the
server on the app's login screen.

### Trying it

1. Install **Godot 4.4** (or newer) from https://godotengine.org/download.
2. In Godot's Project Manager, click **Import** and pick `godot/project.godot`.
3. The first time, Godot imports all the textures and models (this takes a minute or two).
4. Press **Play** (the ▶ button at the top right).
