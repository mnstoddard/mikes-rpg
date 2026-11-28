"""Write Godot 4 StandardMaterial3D .tres files for every texture in a manifest, plus the day environment.
Usage: python3 godot_materials.py TEXTURE_DIR MATERIAL_DIR ENV_DIR STYLE_GUIDE_JSON
Paths inside .tres files assume the Godot project root is the repo's godot/ folder."""
import sys, os, json
tex_dir, mat_dir, env_dir, guide = sys.argv[1:5]
os.makedirs(mat_dir, exist_ok=True); os.makedirs(env_dir, exist_ok=True)
man = json.load(open(os.path.join(tex_dir, "manifest.json")))
g = json.load(open(guide))
def col(h, a=1.0):
    h = h.lstrip('#'); r, gg, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return f"Color({r:.4f}, {gg:.4f}, {b:.4f}, {a})"
ROUGH = {"Metal": 1.0}
NORMAL = {"Ground": 0.8, "Stone": 0.9, "Wood": 0.7, "Metal": 0.5, "Water": 1.0, "Foliage": 0.6, "Cloth": 0.7, "Building": 0.9, "Special": 0.8}
for name, m in man.items():
    base = f"res://assets/textures/{name}/{name}"
    exts = [("albedo", f"{base}_albedo.png"), ("normal", f"{base}_normal.png"), ("orm", f"{base}_orm.png")]
    if m.get("emission_texture"): exts.append(("emission", f"{base}_emission.png"))
    ids = {k: str(i + 1) for i, (k, _) in enumerate(exts)}
    L = [f'[gd_resource type="StandardMaterial3D" load_steps={len(exts) + 1} format=3]', ""]
    for k, p in exts: L.append(f'[ext_resource type="Texture2D" path="{p}" id="{ids[k]}"]')
    L += ["", "[resource]", f'resource_name = "{name}"',
          f'albedo_texture = ExtResource("{ids["albedo"]}")',
          "normal_enabled = true", f'normal_texture = ExtResource("{ids["normal"]}")', f"normal_scale = {NORMAL[m['category']]}",
          "ao_enabled = true", f'ao_texture = ExtResource("{ids["orm"]}")', "ao_texture_channel = 0", "ao_light_affect = 0.3",
          "roughness = 1.0", f'roughness_texture = ExtResource("{ids["orm"]}")', "roughness_texture_channel = 1"]
    if m["category"] == "Metal" or name in ("wood_ironwood", "ore_veins", "metal_rusty_iron"):
        L += ["metallic = 1.0", f'metallic_texture = ExtResource("{ids["orm"]}")', "metallic_texture_channel = 2", "metallic_specular = 0.5"]
    if m.get("alpha"):
        if m["category"] == "Foliage":
            L += ["transparency = 2", "alpha_scissor_threshold = 0.5", "alpha_antialiasing_mode = 1", "cull_mode = 2",
                  "backlight_enabled = true", f"backlight = {col('#A8D86A')}".replace("Color(0.6588", "Color(0.6588"), "texture_filter = 5"]
            L[-2] = f"backlight = {col('#A8D86A', 1.0)}"
        else:
            L += ["transparency = 1", "cull_mode = 2"]
    if m.get("emission"):
        L += ["emission_enabled = true", f"emission = {col(m['emission'])}", f"emission_energy_multiplier = {m.get('emission_energy', 1.0)}"]
        if m.get("emission_texture"): L += ["emission_operator = 1", f'emission_texture = ExtResource("{ids["emission"]}")']
    if m["category"] == "Ground":
        s = 1.0 / m["repeat_m"]
        L += ["uv1_triplanar = true", "uv1_world_triplanar = true", f"uv1_scale = Vector3({s}, {s}, {s})", "uv1_triplanar_sharpness = 4.0"]
    if name == "water":
        L += ["transparency = 1", f"albedo_color = {col('#2F9FCF', 0.85)}", "metallic_specular = 0.8"]
    L.append("")
    open(os.path.join(mat_dir, f"{name}.tres"), "w").write("\n".join(L))
# Environment from the style guide (noon).
li = g["lighting"]; s = li["sky"]
env = f'''[gd_resource type="Environment" load_steps=3 format=3]

[sub_resource type="ProceduralSkyMaterial" id="sky_mat"]
sky_top_color = {col(s["top"])}
sky_horizon_color = {col(s["horizon"])}
ground_bottom_color = {col(s["ground_bottom"])}
ground_horizon_color = {col(s["ground_horizon"])}
sun_angle_max = 30.0
energy_multiplier = 1.0

[sub_resource type="Sky" id="sky"]
sky_material = SubResource("sky_mat")

[resource]
resource_name = "emberfall_day"
background_mode = 2
sky = SubResource("sky")
ambient_light_source = 3
ambient_light_energy = {li["ambient"]["energy"]}
reflected_light_source = 2
tonemap_mode = 2
tonemap_exposure = {li["tonemap"]["exposure"]}
tonemap_white = {li["tonemap"]["white"]}
ssao_enabled = true
ssao_radius = {li["ssao"]["radius"]}
ssao_intensity = {li["ssao"]["intensity"]}
glow_enabled = true
glow_intensity = {li["glow"]["intensity"]}
glow_bloom = {li["glow"]["bloom"]}
glow_hdr_threshold = {li["glow"]["hdr_threshold"]}
fog_enabled = true
fog_light_color = {col(li["fog"]["depth_fog_color"])}
fog_density = {li["fog"]["density"]}
fog_aerial_perspective = {li["fog"]["aerial_perspective"]}
adjustment_enabled = true
adjustment_contrast = {li["adjustments"]["contrast"]}
adjustment_saturation = {li["adjustments"]["saturation"]}
'''
open(os.path.join(env_dir, "emberfall_day.tres"), "w").write(env)
sun = li["sun"]
scene = f'''[gd_scene load_steps=2 format=3]

[ext_resource type="Environment" path="res://assets/environment/emberfall_day.tres" id="1"]

[node name="EmberfallLighting" type="Node3D"]

[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
environment = ExtResource("1")

[node name="Sun" type="DirectionalLight3D" parent="."]
transform = Transform3D(0.866025, -0.383022, 0.321394, 0, 0.642788, 0.766044, -0.5, -0.663414, 0.556670, 0, 10, 0)
light_color = {col(sun["color"])}
light_energy = {sun["energy"]}
light_angular_distance = 1.0
shadow_enabled = true
shadow_blur = 1.5
directional_shadow_max_distance = 120.0
'''
open(os.path.join(env_dir, "emberfall_lighting.tscn"), "w").write(scene)
print("wrote", len(man), "materials")
