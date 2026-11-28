extends Node3D
# Emberfall chicken demo.
# Keys: 1 = Idle, 2 = Peck, 3 = Walk, 4 = Wander (walks in a circle).
# When nobody presses anything, the chicken picks its own little routine.

@onready var chicken: Node3D = $Chicken
@onready var anim: AnimationPlayer = $Chicken/AnimationPlayer

var wander := false
var wander_angle := 0.0
var auto_timer := 0.0
const RADIUS := 1.2
const WALK_SPEED := 0.45 # metres per second

func _ready() -> void:
	for clip in ["Idle", "Walk"]:
		anim.get_animation(clip).loop_mode = Animation.LOOP_LINEAR
	play("Idle")

func play(clip: String) -> void:
	wander = clip == "Wander"
	var clip_name := "Walk" if wander else clip
	if anim.current_animation != clip_name:
		anim.play(clip_name, 0.25)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed:
		match event.keycode:
			KEY_1: play("Idle")
			KEY_2: play("Peck")
			KEY_3: play("Walk")
			KEY_4: play("Wander")
		auto_timer = 10.0 # pause the automatic routine after a key press

func _process(delta: float) -> void:
	if wander:
		wander_angle += delta * WALK_SPEED / RADIUS
		var pos := Vector3(cos(wander_angle), 0, sin(wander_angle)) * RADIUS
		var ahead := Vector3(cos(wander_angle + 0.1), 0, sin(wander_angle + 0.1)) * RADIUS
		chicken.position = pos
		chicken.look_at(ahead, Vector3.UP) # the model faces -Z, like Godot's forward
	# Simple automatic routine: idle, peck now and then, wander a bit.
	auto_timer -= delta
	if auto_timer <= 0.0:
		var pick := randf()
		if pick < 0.45:
			play("Idle")
			auto_timer = randf_range(2.0, 4.0)
		elif pick < 0.75:
			play("Peck")
			auto_timer = 1.6
		else:
			play("Wander")
			auto_timer = randf_range(3.0, 6.0)
