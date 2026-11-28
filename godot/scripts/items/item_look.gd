## Gives an item model its look: which metal, wood, jewel metal and gem.
##
## Every item .glb in res://assets/items/ is built once (iron and oak), with its
## materials named by role: "metal", "metal_dark", "wood", "bark",
## "jewel_metal", "gem", "leather"... This swaps those for the shared material
## library in res://assets/materials/ (the 512 px textures), so one sword model
## makes every sword in the game.
##
##   var sword = preload("res://assets/items/weapons/sword.glb").instantiate()
##   ItemLook.apply(sword, {"metal": "steel", "wood": "yew"})
##   ItemLook.apply_game_item(sword, "sword_steel_yew")   # same, from a game item id
class_name ItemLook
extends RefCounted

const MATERIALS := "res://assets/materials/"
const METALS := ["stone", "bronze", "iron", "steel", "mithril"]
const WOODS := ["pine", "oak", "birch", "maple", "yew", "ironwood", "elderwood"]
const JEWELS := ["silver", "gold", "platinum", "iridium"]
const GEM_COLORS := {
	"amethyst": Color("#b070ff"), "topaz": Color("#ffb030"), "emerald": Color("#30e090"),
	"sapphire": Color("#3a80ff"), "ruby": Color("#ff3050"), "emberstone": Color("#ff7a20"),
}
## Woods whose bark has its own library material (the others tint the oak bark).
const BARKS := ["pine", "oak", "birch"]
const WOOD_BARK := {
	"pine": Color("#7a5434"), "oak": Color("#5e4630"), "birch": Color("#e8e2d4"), "maple": Color("#6e4a36"),
	"yew": Color("#6a3a2a"), "ironwood": Color("#50585e"), "elderwood": Color("#3b2a4f"),
}

static var _cache := {}

## How big a texture tile is on an item, in metres (the style guide's 512 px per metre).
const TILE_M := 1.0


static func apply(root: Node, look: Dictionary = {}) -> void:
	for mesh in _meshes(root):
		for i in mesh.mesh.get_surface_count():
			var src := mesh.mesh.surface_get_material(i)
			if src == null:
				continue
			var m := _material_for(src.resource_name, look)
			mesh.set_surface_override_material(i, m)


## "sword_steel_yew", "bow_stone_maple", "rod_oak", "helmet_mithril", "ring_gold_ruby_3"...
static func apply_game_item(root: Node, item_id: String) -> void:
	var look := {}
	for part in item_id.split("_"):
		if part in METALS: look["metal"] = part
		elif part in WOODS: look["wood"] = part
		elif part in JEWELS: look["jewel"] = part
		elif part in GEM_COLORS: look["gem"] = part
	apply(root, look)


static func _material_for(role: String, look: Dictionary) -> Material:
	var key := role + "|" + str(look.get("metal", "")) + str(look.get("wood", "")) + str(look.get("jewel", "")) + str(look.get("gem", ""))
	if _cache.has(key):
		return _cache[key]
	var m: Material = null
	match role:
		"metal", "metal_dark":
			if look.has("metal"):
				m = _lib("rock" if look.metal == "stone" else "metal_" + look.metal, Color(0.72, 0.72, 0.72) if role == "metal_dark" else Color.WHITE)
		"wood":
			if look.has("wood"):
				m = _lib("wood_" + look.wood)
		"bark":
			if look.has("wood"):
				m = _lib("bark_" + look.wood) if look.wood in BARKS else _lib("bark_oak", WOOD_BARK[look.wood] * 1.6)
		"jewel_metal":
			if look.has("jewel"):
				m = _lib("metal_" + look.jewel)
		"gem":
			if look.has("gem"):
				var c: Color = GEM_COLORS[look.gem]
				var g := _lib("crystal", c)
				if g:
					g.emission_enabled = true
					g.emission = c
					g.emission_energy_multiplier = 0.6
				m = g
		"leather", "grip", "cover", "tie", "leather_dark", "sole":
			m = _lib("leather", Color(0.65, 0.6, 0.55) if role in ["leather_dark", "sole"] else Color.WHITE)
	_cache[key] = m
	return m


static func _lib(name: String, tint: Color = Color.WHITE) -> StandardMaterial3D:
	var path := MATERIALS + name + ".tres"
	if not ResourceLoader.exists(path):
		return null
	var m: StandardMaterial3D = (load(path) as StandardMaterial3D).duplicate()
	m.albedo_color = tint
	# Item models are small and their UVs aren't laid out in metres,
	# so the textures are projected in the item's own space instead.
	m.uv1_triplanar = true
	m.uv1_world_triplanar = false
	m.uv1_scale = Vector3.ONE / TILE_M
	return m


static func _meshes(root: Node) -> Array[MeshInstance3D]:
	var out: Array[MeshInstance3D] = []
	if root is MeshInstance3D:
		out.append(root)
	for c in root.get_children():
		out.append_array(_meshes(c))
	return out
