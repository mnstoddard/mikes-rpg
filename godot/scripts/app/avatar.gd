## One person or creature in the world: a model, a name over its head, and
## smooth movement toward where the server says it is.
class_name Avatar
extends Node3D

const PEOPLE := {
	"hero_man": "res://assets/characters/people/hero_man.glb",
	"hero_woman": "res://assets/characters/people/hero_woman.glb",
	"maren": "res://assets/characters/people/npc_maren.glb",
	"brann": "res://assets/characters/people/npc_brann.glb",
	"oswin": "res://assets/characters/people/npc_oswin.glb",
}
const CREATURES := {
	"chicken": "res://assets/characters/creatures/creature_chicken.glb",
	"wolf": "res://assets/characters/creatures/creature_wolf.glb",
	"alpha_wolf": "res://assets/characters/creatures/creature_wolf.glb",
	"hollow_wolf": "res://assets/characters/creatures/creature_hollow_wolf.glb",
	"boar": "res://assets/characters/creatures/creature_boar.glb",
	"slime": "res://assets/characters/creatures/creature_slime.glb",
}
## Creatures without a model yet: [stand-in model, size].
const STAND_INS := {
	"rat": ["slime", 0.6], "cow": ["boar", 1.8], "giant_bat": ["chicken", 1.3], "cave_spider": ["slime", 1.2],
	"spider": ["slime", 1.6], "goblin": ["hero_man", 0.65], "bandit": ["hero_man", 1.0], "ashbound_scout": ["hero_man", 1.0],
}

var target := Vector3.ZERO
var speed := 3.4 # metres per second; set from the server's step time
var is_moving := false
var _anim: AnimationPlayer
var _idle := ""
var _walk := ""
var _run := ""
var _label: Label3D
var _hp_label: Label3D
var _model: Node3D
var running := false


## kind: "player", "npc" or "monster". look: which model ("hero_man", "maren", "wolf"...).
func setup(kind: String, look: String, display_name: String, color: Color) -> void:
	var path := ""
	var scale_by := 1.0
	if kind == "monster":
		if CREATURES.has(look):
			path = CREATURES[look]
		elif STAND_INS.has(look):
			var s: Array = STAND_INS[look]
			path = CREATURES.get(s[0], PEOPLE.get(s[0], ""))
			scale_by = s[1]
	else:
		path = PEOPLE.get(look, PEOPLE.hero_man)
	if path != "" and ResourceLoader.exists(path):
		_model = (load(path) as PackedScene).instantiate() as Node3D
	else:
		_model = _capsule(color)
	_model.scale = Vector3.ONE * scale_by
	add_child(_model)
	_anim = _find_anim(_model)
	if _anim:
		for a in _anim.get_animation_list():
			var n := String(a).to_lower()
			if _idle == "" and n.begins_with("idle"):
				_idle = a
			if _walk == "" and n.begins_with("walk"):
				_walk = a
			if _run == "" and n.begins_with("run"):
				_run = a
		for a in [_idle, _walk, _run]:
			if a != "":
				_anim.get_animation(a).loop_mode = Animation.LOOP_LINEAR
		if _idle != "":
			_anim.play(_idle)
	_label = Label3D.new()
	_label.text = display_name
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.no_depth_test = true
	_label.fixed_size = true
	_label.pixel_size = 0.0012
	_label.font_size = 28
	_label.outline_size = 8
	_label.modulate = Color(1, 0.97, 0.88) if kind != "monster" else Color(1, 0.8, 0.7)
	_label.position = Vector3(0, 2.15 * scale_by if kind != "monster" else 1.2 * scale_by, 0)
	add_child(_label)
	_hp_label = Label3D.new()
	_hp_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_hp_label.no_depth_test = true
	_hp_label.fixed_size = true
	_hp_label.pixel_size = 0.0011
	_hp_label.font_size = 22
	_hp_label.outline_size = 6
	_hp_label.modulate = Color(0.55, 1, 0.55)
	_hp_label.position = _label.position + Vector3(0, -0.18, 0)
	_hp_label.visible = false
	add_child(_hp_label)


func set_health(hp: float, max_hp: float) -> void:
	if max_hp <= 0 or hp >= max_hp:
		_hp_label.visible = false
		return
	_hp_label.visible = true
	var blocks := int(round(10.0 * clampf(hp / max_hp, 0, 1)))
	_hp_label.text = "█".repeat(blocks) + "░".repeat(10 - blocks)
	_hp_label.modulate = Color(0.55, 1, 0.55) if hp / max_hp > 0.35 else Color(1, 0.45, 0.4)


## Jumps straight to a spot (first sighting, or going through a door).
func place(at: Vector3) -> void:
	position = at
	target = at


func _process(delta: float) -> void:
	var to := target - position
	var flat := Vector3(to.x, 0, to.z)
	var dist := flat.length()
	if dist > 12.0:
		position = target # too far behind (a door, or lag): jump
		dist = 0.0
	var moving := dist > 0.03
	if moving:
		var step := minf(dist, speed * delta * (1.0 + maxf(0.0, dist - 1.5))) # catch up if falling behind
		position += flat / dist * step
		var face := atan2(flat.x, flat.z)
		rotation.y = lerp_angle(rotation.y, face, minf(1.0, delta * 12.0))
	position.y = lerpf(position.y, target.y, minf(1.0, delta * 10.0))
	if moving != is_moving or (moving and _anim and _anim.current_animation != _move_anim()):
		is_moving = moving
		if _anim:
			var a := _move_anim() if moving else _idle
			if a != "":
				_anim.play(a, 0.2)


func _move_anim() -> String:
	return _run if running and _run != "" else _walk


func _find_anim(n: Node) -> AnimationPlayer:
	if n is AnimationPlayer:
		return n
	for c in n.get_children():
		var a := _find_anim(c)
		if a:
			return a
	return null


func _capsule(color: Color) -> Node3D:
	var mi := MeshInstance3D.new()
	var c := CapsuleMesh.new()
	c.radius = 0.35
	c.height = 1.7
	mi.mesh = c
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.7
	mi.material_override = m
	mi.position.y = 0.85
	var n := Node3D.new()
	n.add_child(mi)
	return n
