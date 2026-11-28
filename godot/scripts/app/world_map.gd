## The world map from godot/data/world.json (made from the shared/ files the
## server uses, by tools/export-godot-data.ts), and the 3D ground for one area.
## One map tile is 2 m, like the web game. Tile (x, y) covers
## x*2..x*2+2 along X and y*2..y*2+2 along Z.
class_name WorldMap
extends RefCounted

const TILE := 2.0
const MAT := "res://assets/materials/%s.tres"

var w := 0
var h := 0
var legend: Array = []
var rows: PackedStringArray = []
var walk: PackedStringArray = []
var heights := {} # y * w + x -> metres
var areas: Array = []
var doors: Array = []
var npcs: Array = []
var labels: Array = []
var version := ""

## How each kind of tile looks: [material, how tall the block is (m), what to put on top].
## Ground tiles are thin slabs; walls, cliffs and buildings are tall blocks.
const LOOK := {
	"grass": ["grass", 0.0, ""], "field": ["farmland", 0.0, ""], "withered": ["forest_floor", 0.0, ""],
	"path": ["path", 0.0, ""], "gravel": ["path", 0.0, ""], "dig": ["dirt", 0.0, ""], "sand": ["sand", 0.0, ""],
	"citystreet": ["cobblestone", 0.0, ""], "cobble": ["cobblestone", 0.0, ""], "terrace": ["flagstone", 0.0, ""],
	"water": ["water", -0.45, ""], "bridge": ["planks", 0.0, ""],
	"tree": ["grass", 0.0, "tree"], "hedge": ["leaves_broad", 1.3, ""], "rock": ["grass", 0.0, "rock"],
	"cliff": ["rock", 4.0, ""], "cavewall": ["slate", 4.0, ""], "cave": ["dirt", 0.0, ""], "crystal": ["dirt", 0.0, "crystal"],
	"wall": ["stone_brick", 4.0, ""], "marblewall": ["plaster", 4.0, ""], "rampart": ["stone_brick", 6.0, ""], "tower": ["stone_brick", 9.0, ""],
	"gateway": ["cobblestone", 0.0, ""], "gate": ["path", 0.0, ""], "door": ["planks", 0.0, ""], "innerdoor": ["planks", 0.0, ""],
	"house": ["plaster", 5.0, ""], "cityblock": ["plaster", 6.0, ""], "roof": ["roof_tiles", 7.0, ""], "goldroof": ["metal_gold", 9.0, ""],
	"floor": ["planks", 0.0, ""], "boards": ["planks", 0.0, ""], "marble": ["flagstone", 0.0, ""], "carpet": ["wool_red", 0.0, ""],
	"fence": ["grass", 0.0, "fence"], "barricade": ["path", 0.0, "crate"], "crates": ["cobblestone", 0.0, "crate"],
	"sign": ["grass", 0.0, "sign"], "grave": ["grass", 0.0, "grave"], "statue": ["flagstone", 0.0, "statue"],
	"shelf": ["planks", 0.0, "shelf"], "bed": ["planks", 0.0, "bed"], "table": ["planks", 0.0, "table"],
	"brazier": ["flagstone", 0.0, "brazier"], "glow": ["flagstone", 0.0, "glow"], "lamp": ["cobblestone", 0.0, "lamp"],
	"grille": ["flagstone", 0.0, "grille"], "stall": ["cobblestone", 0.0, "stall"], "well": ["cobblestone", 0.0, "well"],
	"void": ["", 0.0, ""],
}

## Scenery models from the scenery thread, used for the things that stand on tiles.
const PROPS := {
	"tree": ["res://assets/scenery/trees/tree_oak.glb", "res://assets/scenery/trees/tree_pine_classic.glb", "res://assets/scenery/trees/tree_birch.glb", "res://assets/scenery/trees/tree_maple.glb", "res://assets/scenery/trees/tree_pine_tall.glb"],
	"rock": ["res://assets/scenery/rocks/rock_boulder.glb", "res://assets/scenery/rocks/rock_cluster.glb"],
	"crate": ["res://assets/scenery/props/prop_crate_stack.glb", "res://assets/scenery/props/prop_crate_single.glb", "res://assets/scenery/props/prop_barrel_closed.glb"],
	"sign": ["res://assets/scenery/props/prop_signpost.glb"],
	"lamp": ["res://assets/scenery/props/prop_lamp_post.glb"],
	"stall": ["res://assets/scenery/props/prop_market_stall_red.glb", "res://assets/scenery/props/prop_market_stall_blue.glb", "res://assets/scenery/props/prop_market_stall_green.glb"],
	"well": ["res://assets/scenery/props/prop_well.glb"],
	"brazier": ["res://assets/scenery/props/prop_campfire.glb"],
}


static func load_default() -> WorldMap:
	var m := WorldMap.new()
	var f := FileAccess.open("res://data/world.json", FileAccess.READ)
	if f == null:
		push_error("Missing res://data/world.json: run tools/export-godot-data.ts")
		return m
	var d: Dictionary = JSON.parse_string(f.get_as_text())
	m.w = int(d.w)
	m.h = int(d.h)
	m.legend = d.legend
	m.rows = PackedStringArray(d.rows)
	m.walk = PackedStringArray(d.walkable)
	for e in d.heights:
		m.heights[int(e[1]) * m.w + int(e[0])] = float(e[2])
	m.areas = d.areas
	m.doors = d.doors
	m.npcs = d.npcs
	m.labels = d.labels
	m.version = str(d.version)
	return m


func tile(x: int, y: int) -> String:
	if x < 0 or y < 0 or x >= w or y >= h:
		return "void"
	return legend[rows[y].unicode_at(x) - 48]


func walkable(x: int, y: int) -> bool:
	return x >= 0 and y >= 0 and x < w and y < h and walk[y].unicode_at(x) == 49


func ground(x: int, y: int) -> float:
	return heights.get(y * w + x, 0.0)


## Height of the ground under a point given in tiles (with fractions).
func ground_at(fx: float, fy: float) -> float:
	return ground(int(floor(fx)), int(floor(fy)))


func area_at(x: int, y: int) -> Dictionary:
	for a in areas:
		if x >= int(a.x) and y >= int(a.y) and x < int(a.x) + int(a.w) and y < int(a.y) + int(a.h):
			return a
	return {}


static func to_world(fx: float, fy: float, up: float) -> Vector3:
	return Vector3(fx * TILE, up, fy * TILE)


## Builds the ground, walls and scenery of one area. Every tile kind becomes one
## MultiMesh (one draw call), so even the big outdoor map stays quick.
func build_area(area: Dictionary) -> Node3D:
	var root := Node3D.new()
	root.name = "Area_%s" % area.get("id", "?")
	var x0 := int(area.x)
	var y0 := int(area.y)
	var aw := int(area.w)
	var ah := int(area.h)
	var blocks := {} # material -> Array[Transform3D]
	var props := {} # prop kind -> Array[Transform3D]
	var rng := RandomNumberGenerator.new()
	for y in range(y0, y0 + ah):
		for x in range(x0, x0 + aw):
			var t := tile(x, y)
			var look: Array = LOOK.get(t, ["grass", 0.0, ""])
			var mat: String = look[0]
			if mat == "":
				continue
			var g := ground(x, y)
			var tall: float = look[1]
			var top := g + tall
			var bottom := minf(g, top) - 0.4
			if tall < 0.0:
				bottom = top - 0.2
			var height := maxf(top - bottom, 0.05)
			var xf := Transform3D(Basis.from_scale(Vector3(TILE, height, TILE)), Vector3((x + 0.5) * TILE, bottom + height * 0.5, (y + 0.5) * TILE))
			if not blocks.has(mat):
				blocks[mat] = []
			blocks[mat].append(xf)
			var prop: String = look[2]
			if prop != "":
				rng.seed = y * 100003 + x
				var turn := Basis(Vector3.UP, rng.randf() * TAU)
				var s := 1.0
				if prop == "tree":
					s = rng.randf_range(0.85, 1.25)
				if not props.has(prop):
					props[prop] = []
				props[prop].append([Transform3D(turn.scaled(Vector3(s, s, s)), Vector3((x + 0.5) * TILE, g, (y + 0.5) * TILE)), rng.randi()])
	var box := BoxMesh.new()
	for mat in blocks:
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = box
		var list: Array = blocks[mat]
		mm.instance_count = list.size()
		for i in list.size():
			mm.set_instance_transform(i, list[i])
		var mi := MultiMeshInstance3D.new()
		mi.name = "Tiles_%s" % mat
		mi.multimesh = mm
		var m := _material(mat)
		if m:
			mi.material_override = m
		root.add_child(mi)
	for prop in props:
		_place_props(root, prop, props[prop])
	return root


var _mats := {}
func _material(name: String) -> Material:
	if _mats.has(name):
		return _mats[name]
	var path := MAT % name
	var m: Material = load(path) if ResourceLoader.exists(path) else null
	if m and m is StandardMaterial3D:
		# Blocks are 2 m wide: walls and cliffs use world-space triplanar too, so textures don't stretch.
		var sm := (m as StandardMaterial3D).duplicate() as StandardMaterial3D
		if not sm.uv1_triplanar:
			sm.uv1_triplanar = true
			sm.uv1_world_triplanar = true
			sm.uv1_scale = Vector3(0.5, 0.5, 0.5)
		m = sm
	_mats[name] = m
	return m


var _scenes := {}
func _scene(path: String) -> PackedScene:
	if not _scenes.has(path):
		_scenes[path] = load(path) if ResourceLoader.exists(path) else null
	return _scenes[path]


## Things standing on tiles: the scenery thread's models where there is one,
## otherwise a simple stand-in shape. Each model's meshes are drawn with
## MultiMesh, so a forest of thousands of trees is a handful of draw calls.
func _place_props(root: Node3D, prop: String, list: Array) -> void:
	var paths: Array = PROPS.get(prop, [])
	var variants: Array = []
	for p in paths:
		var parts := _scene_meshes(p)
		if not parts.is_empty():
			variants.append(parts)
	if variants.is_empty():
		_placeholders(root, prop, list)
		return
	for vi in variants.size():
		var mine: Array[Transform3D] = []
		for e in list:
			if int(e[1]) % variants.size() == vi:
				mine.append(e[0])
		if mine.is_empty():
			continue
		for part in variants[vi]:
			var mesh: Mesh = part[0]
			var local: Transform3D = part[1]
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.mesh = mesh
			mm.instance_count = mine.size()
			for i in mine.size():
				mm.set_instance_transform(i, mine[i] * local)
			var mi := MultiMeshInstance3D.new()
			mi.name = "Props_%s_%d" % [prop, vi]
			mi.multimesh = mm
			root.add_child(mi)


## Every mesh inside a model file, with where it sits inside the model.
var _parts := {}
func _scene_meshes(path: String) -> Array:
	if _parts.has(path):
		return _parts[path]
	var out: Array = []
	var scene: PackedScene = load(path) if ResourceLoader.exists(path) else null
	if scene:
		var n := scene.instantiate()
		_collect(n, Transform3D.IDENTITY, out, true)
		n.free()
	_parts[path] = out
	return out


func _collect(n: Node, parent: Transform3D, out: Array, is_root: bool) -> void:
	var xf := parent
	if n is Node3D and not is_root:
		xf = parent * (n as Node3D).transform
	if n is MeshInstance3D and (n as MeshInstance3D).mesh:
		out.append([(n as MeshInstance3D).mesh, xf])
	for c in n.get_children():
		_collect(c, xf, out, false)


func _placeholders(root: Node3D, prop: String, list: Array) -> void:
	var mesh: Mesh
	var mat := "planks"
	var lift := 0.0
	match prop:
		"crystal":
			var c := PrismMesh.new()
			c.size = Vector3(0.8, 1.6, 0.8)
			mesh = c
			mat = "crystal"
			lift = 0.8
		"fence":
			var f := BoxMesh.new()
			f.size = Vector3(1.9, 0.9, 0.15)
			mesh = f
			lift = 0.45
		"grave":
			var gr := BoxMesh.new()
			gr.size = Vector3(0.8, 1.0, 0.2)
			mesh = gr
			mat = "rock"
			lift = 0.5
		"statue":
			var st := CylinderMesh.new()
			st.top_radius = 0.4
			st.bottom_radius = 0.6
			st.height = 2.6
			mesh = st
			mat = "flagstone"
			lift = 1.3
		"glow":
			var gl := CylinderMesh.new()
			gl.top_radius = 0.7
			gl.bottom_radius = 0.7
			gl.height = 0.15
			mesh = gl
			mat = "embers"
			lift = 0.08
		_:
			var b := BoxMesh.new()
			b.size = Vector3(1.4, 0.9, 1.0)
			mesh = b
			lift = 0.45
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = list.size()
	for i in list.size():
		var xf: Transform3D = list[i][0]
		if prop == "fence":
			xf.basis = Basis.IDENTITY
		mm.set_instance_transform(i, xf.translated(Vector3(0, lift, 0)))
	var mi := MultiMeshInstance3D.new()
	mi.name = "Props_%s" % prop
	mi.multimesh = mm
	var m := _material(mat)
	if m:
		mi.material_override = m
	root.add_child(mi)
