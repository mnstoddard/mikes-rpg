# Emberfall chicken (Godot sample)

A quick, standalone sample creature for the planned Godot version of Emberfall:
a round, bright hen in the "sunlit storybook" style, with three animations.

| File | What it is |
| --- | --- |
| `chicken.glb` | The model (glTF binary, ~13.8k triangles, metres, Y-up, faces -Z) with animations **Idle**, **Peck** and **Walk**. |
| `chicken_demo.tscn` | A small scene: sky, sun, ground, camera and the chicken. |
| `chicken_demo.gd` | Plays the animations. Keys 1-4 = Idle / Peck / Walk / Wander. Left alone, it picks its own routine. |
| `project.godot` | Lets you open this folder as its own Godot project. |
| `tools/` | The script that builds `chicken.glb` (three.js). Run `npm i three@0.160.0` then `node tools/build_chicken.mjs`. |

## Try it in Godot (on a computer)

1. Install Godot 4.3 or newer from godotengine.org.
2. In Godot's Project Manager choose **Import**, pick `godot-samples/chicken/project.godot`.
3. Press **F5** (Run). Press 1, 2, 3 or 4 to switch animations.

To use the chicken in another Godot project, copy `chicken.glb` into it and drag it into a scene.
Its `AnimationPlayer` child holds the three animations.
