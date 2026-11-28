## Starts the app: the login screen, then the world with a simple HUD
## (messages, your current task, conversations, and the robe button for brand-new characters).
extends Node

const DEFAULT_SERVER := "wss://mikes-rpg.onrender.com/json"
const SETTINGS := "user://login.cfg"

var world: Node3D
var ui: CanvasLayer
var login_center: CenterContainer
var login_box: PanelContainer
var server_edit: LineEdit
var name_edit: LineEdit
var pass_edit: LineEdit
var status_label: Label
var hud: Control
var log_label: RichTextLabel
var task_label: Label
var area_label: Label
var robe_button: Button
var dialog_panel: PanelContainer
var dialog_name: Label
var dialog_text: Label
var dialog_lines: Array = []
var bag: Dictionary = {}
var quest_task := ""
var lines: Array[String] = []


func _ready() -> void:
	world = preload("res://scripts/app/world.gd").new()
	world.name = "World"
	add_child(world)
	ui = CanvasLayer.new()
	add_child(ui)
	_build_login()
	_build_hud()
	Net.joined.connect(_on_joined)
	Net.failed.connect(_on_failed)
	Net.closed.connect(_on_closed)
	Net.server_message.connect(_on_message)
	world.area_changed.connect(func(n: String): area_label.text = n)


# ---------------------------------------------------------------- login

func _build_login() -> void:
	login_center = CenterContainer.new()
	login_center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui.add_child(login_center)
	login_box = PanelContainer.new()
	login_box.custom_minimum_size = Vector2(380, 0)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.1, 0.13, 0.1, 0.92)
	style.set_corner_radius_all(14)
	style.set_content_margin_all(22)
	login_box.add_theme_stylebox_override("panel", style)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	login_box.add_child(v)
	var title := Label.new()
	title.text = "Emberfall"
	title.add_theme_font_size_override("font_size", 34)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(title)
	var sub := Label.new()
	sub.text = "Same world, same account as the web game."
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.modulate = Color(1, 1, 1, 0.7)
	v.add_child(sub)
	var cfg := ConfigFile.new()
	cfg.load(SETTINGS)
	server_edit = _field(v, "Server", cfg.get_value("login", "server", DEFAULT_SERVER), false)
	name_edit = _field(v, "Username", cfg.get_value("login", "username", ""), false)
	pass_edit = _field(v, "Password", "", true)
	pass_edit.text_submitted.connect(func(_t: String): _login(false))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	v.add_child(row)
	var log_in := Button.new()
	log_in.text = "Log in"
	log_in.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	log_in.pressed.connect(func(): _login(false))
	row.add_child(log_in)
	var create := Button.new()
	create.text = "Create account"
	create.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	create.pressed.connect(func(): _login(true))
	row.add_child(create)
	status_label = Label.new()
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_label.modulate = Color(1, 0.85, 0.6)
	v.add_child(status_label)
	login_center.add_child(login_box)


func _field(parent: Control, label: String, value: String, secret: bool) -> LineEdit:
	var l := Label.new()
	l.text = label
	parent.add_child(l)
	var e := LineEdit.new()
	e.text = value
	e.secret = secret
	parent.add_child(e)
	return e


func _login(create: bool) -> void:
	var url := server_edit.text.strip_edges()
	if not (url.begins_with("ws://") or url.begins_with("wss://")):
		status_label.text = "The server address starts with wss:// (or ws:// for a server on your own computer)."
		return
	var cfg := ConfigFile.new()
	cfg.set_value("login", "server", url)
	cfg.set_value("login", "username", name_edit.text.strip_edges())
	cfg.save(SETTINGS)
	status_label.text = "Connecting…"
	Net.open(url)
	Net.join(name_edit.text.strip_edges(), pass_edit.text, create)


func _on_joined(session_id: String) -> void:
	status_label.text = ""
	login_center.visible = false
	hud.visible = true
	world.start(session_id)
	# The web game says "ready" once it's listening; the server then sends your bag, quest and so on.
	Net.send_game("ready", {})
	_say("Welcome to Emberfall. Click the ground to walk (WASD works too, Shift to run). Click a person to talk.")


func _on_failed(_code: int, message: String) -> void:
	if login_center.visible:
		status_label.text = message
	else:
		_say("⚠️ " + message)


func _on_closed(reason: String) -> void:
	hud.visible = false
	login_center.visible = true
	status_label.text = reason + " Log in again to carry on."


# ---------------------------------------------------------------- HUD

func _build_hud() -> void:
	hud = Control.new()
	hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.visible = false
	ui.add_child(hud)
	area_label = Label.new()
	area_label.position = Vector2(16, 12)
	area_label.add_theme_font_size_override("font_size", 22)
	area_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.7))
	area_label.add_theme_constant_override("outline_size", 6)
	hud.add_child(area_label)
	task_label = Label.new()
	task_label.position = Vector2(16, 44)
	task_label.custom_minimum_size = Vector2(520, 0)
	task_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	task_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.7))
	task_label.add_theme_constant_override("outline_size", 6)
	hud.add_child(task_label)
	robe_button = Button.new()
	robe_button.text = "Put on your robe"
	robe_button.position = Vector2(16, 100)
	robe_button.visible = false
	robe_button.pressed.connect(_wear_robe)
	hud.add_child(robe_button)
	log_label = RichTextLabel.new()
	log_label.anchor_top = 1.0
	log_label.anchor_bottom = 1.0
	log_label.offset_top = -190
	log_label.offset_bottom = -16
	log_label.offset_left = 16
	log_label.offset_right = 576
	log_label.scroll_following = true
	log_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	log_label.add_theme_color_override("default_color", Color(1, 1, 1))
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0, 0, 0, 0.35)
	bg.set_corner_radius_all(8)
	bg.set_content_margin_all(8)
	log_label.add_theme_stylebox_override("normal", bg)
	hud.add_child(log_label)
	dialog_panel = PanelContainer.new()
	dialog_panel.anchor_left = 0.5
	dialog_panel.anchor_right = 0.5
	dialog_panel.anchor_top = 1.0
	dialog_panel.anchor_bottom = 1.0
	dialog_panel.offset_left = -300
	dialog_panel.offset_right = 300
	dialog_panel.offset_top = -230
	dialog_panel.offset_bottom = -30
	var ds := StyleBoxFlat.new()
	ds.bg_color = Color(0.98, 0.95, 0.88, 0.97)
	ds.set_corner_radius_all(12)
	ds.set_content_margin_all(16)
	dialog_panel.add_theme_stylebox_override("panel", ds)
	var dv := VBoxContainer.new()
	dialog_panel.add_child(dv)
	dialog_name = Label.new()
	dialog_name.add_theme_color_override("font_color", Color(0.55, 0.25, 0.1))
	dialog_name.add_theme_font_size_override("font_size", 20)
	dv.add_child(dialog_name)
	dialog_text = Label.new()
	dialog_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	dialog_text.size_flags_vertical = Control.SIZE_EXPAND_FILL
	dialog_text.add_theme_color_override("font_color", Color(0.15, 0.15, 0.12))
	dv.add_child(dialog_text)
	var next := Button.new()
	next.text = "Next"
	next.size_flags_horizontal = Control.SIZE_SHRINK_END
	next.pressed.connect(_next_line)
	dv.add_child(next)
	dialog_panel.visible = false
	hud.add_child(dialog_panel)


func _say(text: String) -> void:
	lines.append(text)
	if lines.size() > 60:
		lines.pop_front()
	log_label.text = "\n".join(lines)


func _on_message(type: String, data: Variant) -> void:
	match type:
		"message":
			_say(str(data))
		"dialog", "intro":
			if typeof(data) == TYPE_DICTIONARY:
				dialog_lines = (data as Dictionary).get("lines", []).duplicate()
				dialog_name.text = str((data as Dictionary).get("name", ""))
				_next_line()
		"bag":
			if typeof(data) == TYPE_DICTIONARY:
				bag = data
				_update_robe()
		"quest":
			if typeof(data) == TYPE_DICTIONARY:
				for c in (data as Dictionary).get("chapters", []):
					if str(c.get("state", "")) == "active":
						quest_task = str(c.get("task", ""))
						task_label.text = "📜 " + str(c.get("title", "")) + ": " + quest_task
						break
				_update_robe()
		"levelup", "skillup":
			_say("⭐ " + JSON.stringify(data))


func _next_line() -> void:
	if dialog_lines.is_empty():
		dialog_panel.visible = false
		return
	dialog_panel.visible = true
	dialog_text.text = str(dialog_lines.pop_front())


## Brand-new characters start in their shirt and must put the robe on first
## (the web game does this from the bag). Until the bag screen exists here, one button does it.
func _update_robe() -> void:
	robe_button.visible = quest_task.to_lower().contains("robe") and _robe_slots().size() > 0


func _robe_slots() -> Array[int]:
	var out: Array[int] = []
	var inv: Array = bag.get("inventory", [])
	for i in inv.size():
		if inv[i] != null and str(inv[i]).ends_with("_cloth"):
			out.append(i)
	return out


func _wear_robe() -> void:
	for slot in _robe_slots():
		Net.send_game("wear", {"slot": slot})
	robe_button.visible = false
