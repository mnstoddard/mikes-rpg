# Characters and creatures

Godot-ready 3D models (`.glb`) for the people and creatures of Emberfall. Drag
any of them into a Godot scene and it arrives with its skeleton, its materials
and all its motions in an `AnimationPlayer`. Each one is shown in the
"Emberfall Cast" gallery.

All of them follow `godot/art/style-guide.json`: 1 unit = 1 metre, Y up, feet on
the ground at the origin, facing +Z (Godot's "model front").

## People (`people/`)

| File | Who | Notes |
|---|---|---|
| `hero_man.glb` | The player hero, body 1 | From the approved lifelike hero, starter outfit |
| `hero_woman.glb` | The player hero, body 2 | Same outfit |
| `npc_maren.glb` | Old Maren | Blouse, green bodice, long blue skirt |
| `npc_brann.glb` | Smith Brann | Red work shirt, leather apron, full beard |
| `npc_oswin.glb` | Repairer Oswin | Blue shirt, leather waistcoat, moustache |

- **Skeleton**: the same 19 bones for everyone (root, spine, neck, head,
  shoulders, arms, wrists, legs, feet), so one set of motions fits every person.
- **Motions**: all 42 motions from the Lifelike Heroes page (idle, walk, run,
  combat swings, chop, mine, fish, smith, cook, sit, defeat and more).
  Looping ones end in `_loop`, which Godot reads as "repeat".
- **Hands**: closed fists are a shape key (blend shape) on `Body`, driven by the
  motions, so tools and weapons can be held. Attach held things to `wrist_R` /
  `wrist_L` with a `BoneAttachment3D`.
- **Clothes** are separate meshes (`Tunic`, `Trousers`, `Belt`, `Boots`, ...)
  using the shared cloth and leather textures. The skin is split into regions
  (`Body_Torso`, `Body_UpperArms`, `Body_Forearms`, `Body_Thighs`, `Body_Shins`,
  `Body_Feet`) so skin under clothes can be hidden: no poking through, and
  fewer triangles to draw. `godot/scripts/characters/outfit.gd` does this.
  For the NPCs the covered regions are already removed; the heroes keep them
  all, because their armor and clothes will change.
- **Triangles**: about 30-60k each with everything shown (the hair is the
  biggest part). Godot makes lower-detail versions (LODs) automatically on
  import, so people far away cost much less.

## Creatures (`creatures/`)

| File | Creature | Size |
|---|---|---|
| `creature_wolf.glb` | Wolf | 1.0 m tall to the ear tips |
| `creature_hollow_wolf.glb` | Hollow wolf (blighted) | Same, with glowing seams and eyes |
| `creature_boar.glb` | Boar | 0.7 m |
| `creature_chicken.glb` | Chicken | 0.55 m |
| `creature_slime.glb` | Slime | 0.4 m |

- One smooth skin each (8-14k triangles) with painted textures: colour,
  ORM (ambient occlusion, roughness, metal) and glow where they glow.
- Separate glossy eyes, fixed to the head bone.
- Motions: `idle_loop`, `walk_loop`, `run_loop`, `attack`, `hit`, `defeat`,
  `happy`.

## Remaking them

The scripts are in `godot/tools/characters/`.

- **Creatures** are made entirely from code (soft shapes that melt together,
  then painted, rigged and animated):
  `pip install numpy scikit-image fast-simplification xatlas pillow`, then
  `python3 godot/tools/characters/creatures.py godot/assets/characters/creatures [wolf boar ...]`.
  Each creature is one function in `creatures.py`.
- **People** are exported from the Lifelike Heroes page (the approved hero
  creator) with `run-people.cjs`, which opens the page in a headless browser,
  builds each person from their recipe in `people.json` (body sliders, hair,
  beard, colours and outfit), bakes every motion and saves the `.glb`.
