## The game world: builds the area you're in, shows every player, monster and
## townsperson the server knows about, and sends your clicks and keys to the
## server. The server decides where everyone really is (exactly as for the web
## game); this only draws it smoothly.
extends Node3D

signal area_changed(area_name: String)
signal npc_clicked(npc: Dictionary)

var map: WorldMap
var me_id := ""
var players := {} # sessionId -> Dictionary (last state from the server)
var monsters := {}
var avatars := {} # "p:<id>" / "m:<id>" / "n:<npc id>" -> Avatar
var area: Dictionary = {}
var area_node: Node3D
var camera: Camera3D
var cam_yaw := 0.6
var cam_pitch := 0.95
var cam_dist := 16.0
var _drag := false
var _drag_moved := 0.0
var _keys := Vector2.ZERO
var _running := false
var _lighting: Node3D


func _ready() -> void:
	map = WorldMap.load_default()
	var light_scene: PackedScene = load("res://assets/environment/emberfall_lighting.tscn")
	if light_scene:
		_lighting = light_scene.instantiate()
		add_child(_lighting)
	camera = Camera3D.new()
	camera.fov = 50
	camera.far = 400
	add_child(camera)
	camera.make_current()
	Net.state_changed.connect(_on_state)


func start(session_id: String) -> void:
	me_id = session_id


# ---------------------------------------------------------------- state from the server

func _on_state(msg: Dictionary) -> void:
	if msg.get("full", false):
		players.clear()
		monsters.clear()
	for id in msg.get("players", {}):
		players[id] = msg.players[id]
	for id in msg.get("monsters", {}):
		monsters[id] = msg.monsters[id]
	var removed: Dictionary = msg.get("removed", {})
	for id in removed.get("players", []):
		players.erase(id)
		_drop("p:" + id)
	for id in removed.get("monsters", []):
		monsters.erase(id)
		_drop("m:" + id)
	if not players.has(me_id):
		return
	var me: Dictionary = players[me_id]
	var here := map.area_at(int(me.x), int(me.y))
	if here.get("id", "") != area.get("id", ""):
		_enter_area(here)
	for id in players:
		_update_player(id, players[id])
	for id in monsters:
		_update_monster(id, monsters[id])


## Where someone stands, in tiles with fractions. fx/fy are exact once they've
## moved; before that the server only knows their tile.
static func spot(p: Dictionary) -> Vector2:
	var x := float(p.get("x", 0))
	var y := float(p.get("y", 0))
	var fx := float(p.get("fx", x + 0.5))
	var fy := float(p.get("fy", y + 0.5))
	if absf(fx - x - 0.5) > 1.5 or absf(fy - y - 0.5) > 1.5:
		return Vector2(x + 0.5, y + 0.5)
	return Vector2(fx, fy)


func _in_area(x: int, y: int) -> bool:
	return not area.is_empty() and x >= int(area.x) and y >= int(area.y) and x < int(area.x) + int(area.w) and y < int(area.y) + int(area.h)


func _update_player(id: String, p: Dictionary) -> void:
	var key := "p:" + id
	if p.get("invisible", false) or not _in_area(int(p.x), int(p.y)):
		_drop(key)
		return
	var s := spot(p)
	var at := WorldMap.to_world(s.x, s.y, map.ground_at(s.x, s.y))
	var a: Avatar = avatars.get(key)
	if a == null:
		a = Avatar.new()
		var look := "hero_woman" if hash(str(p.get("name", ""))) % 2 == 1 else "hero_man"
		a.setup("player", look, str(p.get("name", "")), Color.hex((int(p.get("color", 0xffffff)) << 8) | 0xff))
		add_child(a)
		a.place(at)
		avatars[key] = a
	a.target = at
	a.running = bool(p.get("running", false))
	a.speed = WorldMap.TILE / maxf(0.15, float(p.get("stepMs", 600)) / 1000.0)
	a.set_health(float(p.get("hp", 1)), float(p.get("maxHp", 1)))


func _update_monster(id: String, m: Dictionary) -> void:
	var key := "m:" + id
	if not m.get("alive", true) or not _in_area(int(m.x), int(m.y)):
		_drop(key)
		return
	var at := WorldMap.to_world(float(m.x) + 0.5, float(m.y) + 0.5, map.ground(int(m.x), int(m.y)))
	var a: Avatar = avatars.get(key)
	if a == null:
		a = Avatar.new()
		a.setup("monster", str(m.get("kind", "slime")), str(m.get("kind", "")).capitalize(), Color(0.8, 0.5, 0.4))
		add_child(a)
		a.place(at)
		avatars[key] = a
	a.target = at
	a.speed = 2.4
	a.set_health(float(m.get("hp", 1)), float(m.get("maxHp", 1)))


func _drop(key: String) -> void:
	if avatars.has(key):
		avatars[key].queue_free()
		avatars.erase(key)


func _enter_area(a: Dictionary) -> void:
	area = a
	for key in avatars.keys():
		_drop(key)
	if area_node:
		area_node.queue_free()
	area_node = map.build_area(a) if not a.is_empty() else Node3D.new()
	add_child(area_node)
	# Indoors and caves: no sky, warm lamps; outdoors: the sun and sky.
	var outdoor := str(a.get("kind", "outdoor")) == "outdoor"
	if _lighting:
		var env := _lighting.get_node_or_null("WorldEnvironment") as WorldEnvironment
		if env and env.environment:
			env.environment.background_mode = Environment.BG_SKY if outdoor else Environment.BG_COLOR
			env.environment.background_color = Color(0.03, 0.03, 0.04)
			env.environment.fog_enabled = outdoor
	for n in map.npcs:
		if str(n.get("kind", "")) != "person" or not _in_area(int(n.x), int(n.y)):
			continue
		var av := Avatar.new()
		var look := str(n.id) if Avatar.PEOPLE.has(str(n.id)) else ("hero_woman" if hash(str(n.id)) % 2 == 1 else "hero_man")
		av.setup("npc", look, str(n.name), Color.hex((int(n.get("color", 0xcccccc)) << 8) | 0xff))
		add_child(av)
		av.place(WorldMap.to_world(float(n.x) + 0.5, float(n.y) + 0.5, map.ground(int(n.x), int(n.y))))
		avatars["n:" + str(n.id)] = av
	area_changed.emit(str(a.get("name", "")))


# ---------------------------------------------------------------- camera and input

func _process(delta: float) -> void:
	var me: Avatar = avatars.get("p:" + me_id)
	var focus := me.position + Vector3(0, 1.4, 0) if me else Vector3.ZERO
	var off := Vector3(sin(cam_yaw) * cos(cam_pitch), sin(cam_pitch), cos(cam_yaw) * cos(cam_pitch)) * cam_dist
	camera.position = camera.position.lerp(focus + off, minf(1.0, delta * 8.0)) if me else focus + off
	camera.look_at(focus, Vector3.UP)
	if _lighting:
		var sun := _lighting.get_node_or_null("Sun") as DirectionalLight3D
		if sun:
			sun.visible = str(area.get("kind", "outdoor")) == "outdoor"
	_poll_keys()


func _poll_keys() -> void:
	var k := Vector2(
		float(Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT)) - float(Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT)),
		float(Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN)) - float(Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP)))
	if get_viewport().gui_get_focus_owner() != null:
		k = Vector2.ZERO # typing in a box
	if k != _keys:
		_keys = k
		# Keys point relative to the camera, like the web game.
		var d := k.rotated(-cam_yaw) if k != Vector2.ZERO else Vector2.ZERO
		Net.send_game("walk", {"dx": d.x, "dy": d.y})
	var run := Input.is_physical_key_pressed(KEY_SHIFT)
	if run != _running:
		_running = run
		Net.send_game("run", {"on": run})


## Phones and tablets: a tap arrives as a mouse click and a one-finger drag as
## mouse motion (Godot's touch-to-mouse setting), so one set of code covers both.
func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			cam_dist = maxf(5.0, cam_dist * 0.9)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			cam_dist = minf(45.0, cam_dist * 1.1)
		elif mb.button_index == MOUSE_BUTTON_RIGHT:
			_drag = mb.pressed
		elif mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed:
				_drag_moved = 0.0
			elif _drag_moved < 8.0:
				_click(mb.position)
	elif event is InputEventMouseMotion:
		var mm := event as InputEventMouseMotion
		if _drag or (mm.button_mask & MOUSE_BUTTON_MASK_LEFT):
			_drag_moved += mm.relative.length()
			cam_yaw -= mm.relative.x * 0.006
			cam_pitch = clampf(cam_pitch + mm.relative.y * 0.004, 0.35, 1.35)
	elif event is InputEventMagnifyGesture:
		cam_dist = clampf(cam_dist / (event as InputEventMagnifyGesture).factor, 5.0, 45.0)


## A click or tap: talk to the townsperson there, or walk to that spot.
func _click(screen: Vector2) -> void:
	var from := camera.project_ray_origin(screen)
	var dir := camera.project_ray_normal(screen)
	# Someone under the pointer? (people are about 1.8 m tall)
	var best := ""
	var best_d := 1.1
	for key in avatars:
		if not str(key).begins_with("n:"):
			continue
		var a: Avatar = avatars[key]
		var c := a.position + Vector3(0, 0.9, 0)
		var d := (c - from).cross(dir).length()
		if d < best_d:
			best_d = d
			best = str(key).substr(2)
	if best != "":
		for n in map.npcs:
			if str(n.id) == best:
				npc_clicked.emit(n)
		Net.send_game("talk", {"id": best})
		return
	# Otherwise the ground: step along the ray until it goes under the ground.
	var me: Avatar = avatars.get("p:" + me_id)
	var y0 := me.position.y if me else 0.0
	if absf(dir.y) < 0.001:
		return
	var t := (y0 - from.y) / dir.y
	if t < 0:
		return
	var hit := from + dir * t
	var fx := hit.x / WorldMap.TILE
	var fy := hit.z / WorldMap.TILE
	var x := int(floor(fx))
	var y := int(floor(fy))
	if not map.walkable(x, y):
		return
	Net.send_game("move", {"x": x, "y": y, "fx": fx, "fy": fy})
