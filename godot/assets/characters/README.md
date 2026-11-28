# Characters and creatures

Godot-ready 3D models (`.glb`) for the people and creatures of Emberfall. Drag
any of them into a Godot scene and it arrives with its skeleton, its materials
and all its motions in an `AnimationPlayer`. Each one is shown in the
"Emberfall Cast" gallery.

All of them follow `godot/art/style-guide.json`: 1 unit = 1 metre, Y up, feet on
the ground at the origin, facing +Z (Godot's "model front").

## People (`people/`)

| File | Who | Where / role |
|---|---|---|
| `hero_man.glb` | Hero | You (body 1) |
| `hero_woman.glb` | Hero | You (body 2) |
| `npc_rhys.glb` | Rhys | Your friendly rival |
| `npc_aldric.glb` | High Keeper Aldric | Welcomes new Emberborn |
| `npc_celene.glb` | Keeper Celene | Shrine healer |
| `npc_lisette.glb` | Keeper Lisette | The library |
| `npc_oren.glb` | Keeper Oren | Ember Circle tours |
| `npc_tomas.glb` | Keeper Tomas | Keys and skills |
| `npc_wynne.glb` | Keeper Wynne | The beds |
| `npc_maren.glb` | Old Maren | Fishing and cooking |
| `npc_brann.glb` | Smith Brann | Smelting and smithing |
| `npc_oswin.glb` | Repairer Oswin | Mends tools |
| `npc_greta.glb` | Miner Greta | Mining |
| `npc_holt.glb` | Forester Holt | Woodcutting |
| `npc_kael.glb` | Huntmaster Kael | Combat, the Wardens |
| `npc_bryn.glb` | Captain Bryn | Bounty board and Renown |
| `npc_rook.glb` | Woodworker Rook | Handicraft |
| `npc_odo.glb` | Farmer Odo | Farming |
| `npc_wren.glb` | Herbalist Wren | Foraging |
| `npc_moss.glb` | Alchemist Moss | Alchemy |
| `npc_corwen.glb` | Enchanter Corwen | Enchanting |
| `npc_rowan.glb` | Archmage Rowan | Head of the Mages’ Guild |
| `npc_tam.glb` | Shopkeeper Tam | General Store |
| `npc_tamsin.glb` | Tamsin | Ashbound scout |

Foes and the human bosses live in the same folder and use the same skeleton:

| File | Who | Where / role |
|---|---|---|
| `foe_goblin.glb` | Goblin | Danger zones |
| `foe_ashbound_scout.glb` | Ashbound scout | Danger zones |
| `foe_ashbound_raider.glb` | Ashbound raider | Deep Thornwood |
| `foe_grave_ghoul.glb` | Grave ghoul | Planned: the Graveyard at night |
| `boss_sable.glb` | Sable | Act 4, Emberguard path |
| `boss_vale.glb` | Vale | Act 4, Ashbound path |

- **Skeleton**: the same 19 bones for everyone (root, spine, neck, head,
  shoulders, arms, wrists, legs, feet), so one set of motions fits every person.
- **Motions**: the heroes have all 42 motions from the Lifelike Heroes page (idle, walk, run,
  combat swings, chop, mine, fish, smith, cook, sit, defeat and more).
  Townsfolk have the town set (idle, walk, run, talk, wave, bow, look, sit, drink, eat, pick up, hit, fall, defeat) plus their own job motions; foes and bosses have the combat set. Looping ones end in `_loop`, which Godot reads as "repeat".
- **Hands**: closed fists are a shape key (blend shape) on `Body`, driven by the
  motions, so tools and weapons can be held. Attach held things to `wrist_R` /
  `wrist_L` with a `BoneAttachment3D`.
- **Clothes** are separate meshes (`Tunic`, `Trousers`, `Belt`, `Boots`, ...)
  using the shared cloth and leather textures. The skin is split into regions
  (`Body_Torso`, `Body_UpperArms`, `Body_Forearms`, `Body_Thighs`, `Body_Shins`,
  `Body_Feet`) so skin under clothes can be hidden: no poking through, and
  fewer triangles to draw. `godot/scripts/characters/outfit.gd` does this.
  For the NPCs, foes and bosses the covered regions are already removed; the heroes keep them
  all, because their armor and clothes will change.
- **Triangles**: about 30-60k each with everything shown (the hair is the
  biggest part). Godot makes lower-detail versions (LODs) automatically on
  import, so people far away cost much less.

## Creatures (`creatures/`)

| File | Creature | Where / role |
|---|---|---|
| `creature_chicken.glb` | Chicken | Near town |
| `creature_rat.glb` | Rat | Near town |
| `creature_cow.glb` | Cow | Near town |
| `creature_slime.glb` | Slime | Near town |
| `creature_boar.glb` | Boar | Near town |
| `creature_giant_bat.glb` | Giant bat | Near town, at night |
| `creature_wolf.glb` | Wolf | Danger zones |
| `creature_hollow_wolf.glb` | Hollow wolf | Blighted |
| `creature_alpha_wolf.glb` | Alpha wolf | Danger zones |
| `creature_cave_spider.glb` | Cave spider | The cave |
| `creature_giant_spider.glb` | Giant spider | Danger zones |
| `creature_fire_beetle.glb` | Fire beetle | Planned: the quarry |
| `creature_wisp.glb` | Will-o’-wisp | Planned: Dark Forest at night |
| `creature_graveyard_ghost.glb` | Graveyard ghost | Planned: the Graveyard at night |
| `creature_dire_wolf.glb` | Dire wolf | Planned: Wolf Hollow |
| `creature_primeval_beast.glb` | Primeval beast | Planned: the Sundered Crown |
| `creature_thornmother.glb` | The Thornmother | Thornwood, Act 2A |
| `creature_frost_wyrm.glb` | Frost Wyrm | Greyspine Peaks, Act 2B |
| `creature_deep_one.glb` | The Deep One | Saltmere Coast, Act 2C |
| `creature_dust_titan.glb` | The Dust Titan | Ashen Barrens, Act 2D |

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
