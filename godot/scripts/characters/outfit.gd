## Hides the skin under clothes on an Emberfall person (.glb from assets/characters/people).
## Add this script to the imported person's root node. Call refresh() after showing
## or hiding a piece of clothing or armor.
extends Node3D

## Which body regions each piece of clothing covers.
const COVERS := {
	"Tunic": ["Body_Torso", "Body_UpperArms", "Body_Forearms"],
	"Blouse": ["Body_Torso", "Body_UpperArms", "Body_Forearms"],
	"Shirt": ["Body_Torso"],
	"Trousers": ["Body_Thighs", "Body_Shins"],
	"Skirt": ["Body_Thighs", "Body_Shins"],
	"Boots": ["Body_Feet"],
}

func _ready() -> void:
	refresh()

func refresh() -> void:
	var hidden := {}
	for piece in COVERS:
		var node := find_child(piece, true, false) as Node3D
		if node and node.visible:
			for region in COVERS[piece]:
				hidden[region] = true
	for region in ["Body_Torso", "Body_UpperArms", "Body_Forearms", "Body_Thighs", "Body_Shins", "Body_Feet"]:
		var mesh := find_child(region, true, false) as Node3D
		if mesh:
			mesh.visible = not hidden.has(region)
