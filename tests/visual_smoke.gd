extends SceneTree

# Validate the real atlas and rig independently of graphical screenshot tests.
# Run after the normal Godot asset import:
# godot --headless --path . --script tests/visual_smoke.gd
const ATLAS_PATH := "res://assets/fighters/tiger/tiger-atlas.png"
const VISUAL_PATH := "res://scripts/tiger_visual.gd"
const REQUIRED_JOINTS := [
	"head", "torso", "pelvis",
	"front_shoulder", "front_elbow", "front_wrist", "front_hip", "front_knee", "front_ankle",
	"back_shoulder", "back_elbow", "back_wrist", "back_hip", "back_knee", "back_ankle",
]

var checks := 0
var failures: Array[String] = []
var game: Node2D
var visual: Node2D

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, description: String) -> void:
	checks += 1
	if condition:
		print("PASS: ", description)
	else:
		failures.append(description)
		push_error("FAIL: " + description)

func find_visual(node: Node) -> Node2D:
	var script: Script = node.get_script()
	if script != null and script.resource_path == VISUAL_PATH:
		return node as Node2D
	for child in node.get_children():
		var found := find_visual(child)
		if found != null:
			return found
	return null

func pose(state: String, time := 0.0, combo := 1, animation_time := 0.0, kind := "light") -> Dictionary:
	game.player.state = state
	game.player.state_time = time
	game.player.combo = combo
	game.player.animation_time = animation_time
	game.player.attack_kind = kind
	game.player.guard = state == "guard"
	game.player.move_axis = 1.0 if state == "run" else 0.0
	game.player.position.y = ZooFighter.FLOOR_Y
	game.player.vertical_speed = 0.0
	visual.sync_from_fighter(true)
	return visual.joint_positions.duplicate(true)

func finite_joints(joints: Dictionary) -> bool:
	for key in REQUIRED_JOINTS:
		if not joints.has(key) or not joints[key] is Vector2 or not joints[key].is_finite():
			return false
	for side in ["front", "back"]:
		for pair in [["shoulder", "elbow"], ["elbow", "wrist"], ["hip", "knee"], ["knee", "ankle"]]:
			var first: Vector2 = joints[side + "_" + pair[0]]
			var second: Vector2 = joints[side + "_" + pair[1]]
			if first.distance_to(second) <= 0.01:
				return false
	return true

func pose_distance(first: Dictionary, second: Dictionary) -> float:
	var result := 0.0
	for key in REQUIRED_JOINTS:
		if first.has(key) and second.has(key):
			result += first[key].distance_to(second[key])
	return result

func run() -> void:
	var texture: Texture2D = load(ATLAS_PATH)
	check(texture != null and texture.get_width() > 0 and texture.get_height() > 0, "generated tiger atlas loads as a nonempty texture")
	if texture == null:
		await finish()
		return
	var atlas: Image = texture.get_image()
	if atlas.is_compressed():
		atlas.decompress()
	check(atlas.get_used_rect().has_area(), "atlas contains visible alpha pixels")
	check(atlas.detect_alpha() != Image.ALPHA_NONE, "atlas has a transparent background suitable for compositing")
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await process_frame
	game.bot_enabled = false
	game.start_match(true)
	game.set_physics_process(false)
	game.player.set_physics_process(false)
	game.bot.set_physics_process(false)
	# Let just-started scene audio register before teardown stops its players.
	await create_timer(0.08).timeout
	visual = find_visual(game.player)
	check(visual != null, "tiger fighter owns the detailed animated visual")
	check(find_visual(game.bot) == null, "wolf keeps its existing renderer")
	if visual == null:
		await finish()
		return
	check(visual.has_art(), "tiger visual successfully binds the generated atlas")
	check(visual.bounds_source == "metadata", "current atlas uses its validated precomputed region metadata")
	check(game.player.uses_detailed_art() and not game.bot.uses_detailed_art(), "fighter render selection uses atlas art only for the tiger")
	var parts: Dictionary = visual.parts
	check(not parts.is_empty(), "rig defines textured body parts")
	for key in parts:
		var part: Dictionary = parts[key]
		var region: Rect2 = part.get("region", Rect2())
		var bounded := region.has_area() and Rect2(Vector2.ZERO, Vector2(atlas.get_width(), atlas.get_height())).encloses(region)
		check(bounded, "%s atlas region stays inside the source texture" % key)
		if bounded:
			var part_image: Image = atlas.get_region(Rect2i(region))
			check(part_image.get_used_rect().has_area(), "%s atlas region has visible pixels" % key)
	var standing := pose("idle")
	check(finite_joints(standing), "standing pose has all required finite, nondegenerate limb joints")
	if finite_joints(standing):
		var ordered: bool = standing.head.y < standing.front_shoulder.y
		for side in ["front", "back"]:
			ordered = ordered and standing[side + "_shoulder"].y < standing[side + "_hip"].y
			ordered = ordered and standing[side + "_hip"].y < standing[side + "_knee"].y
			ordered = ordered and standing[side + "_knee"].y < standing[side + "_ankle"].y
		check(ordered, "rest topology orders head, shoulders, hips, knees and ankles correctly")
	var walk_a := pose("run", 0.0, 1, 0.05)
	var walk_b := pose("run", 0.0, 1, 0.25)
	check(finite_joints(walk_a) and finite_joints(walk_b), "walk cycle keeps both leg chains finite")
	if finite_joints(walk_a) and finite_joints(walk_b):
		check(walk_a.front_ankle.distance_to(walk_b.front_ankle) > 1.0 and walk_a.back_ankle.distance_to(walk_b.back_ankle) > 1.0, "both feet move through the walk cycle")
	var combo_a := pose("attack", 0.105, 1)
	var combo_b := pose("attack", 0.105, 2)
	var combo_c := pose("attack", 0.105, 3)
	check(finite_joints(combo_a) and finite_joints(combo_b) and finite_joints(combo_c), "all three light combo poses have finite, nondegenerate limbs")
	check(pose_distance(combo_a, combo_b) > 5.0 and pose_distance(combo_b, combo_c) > 5.0 and pose_distance(combo_a, combo_c) > 5.0, "three combo stages produce distinct poses at the same strike time")
	for state in ["guard", "hurt", "dash", "ko"]:
		var sample := pose(state, 0.18)
		check(finite_joints(sample), "%s state remains finite and nondegenerate" % state)
	pose("idle")
	game.player.position.y = ZooFighter.FLOOR_Y - 90.0
	game.player.vertical_speed = -250.0
	visual.sync_from_fighter(true)
	check(finite_joints(visual.joint_positions), "airborne pose remains finite and nondegenerate")
	var kick := pose("attack", 0.29, 1, 0.0, "heavy")
	check(finite_joints(kick), "heavy kick remains finite and nondegenerate")
	if game.has_method("enter_study") and game.has_method("leave_study"):
		game.enter_study()
		check(game.mode == "study" and not game.bot.visible and game.player.scale.x > 1.0, "character preview isolates and enlarges the real tiger rig")
		pose("idle")
		game.leave_study()
		check(game.mode != "study" and game.bot.visible and game.player.scale.is_equal_approx(Vector2.ONE), "leaving character preview restores fighter visibility and scale")
		game.enter_study()
		game._notification(Node.NOTIFICATION_WM_GO_BACK_REQUEST)
		check(game.mode == "menu" and game.bot.visible and game.player.scale.is_equal_approx(Vector2.ONE), "Android system Back leaves preview and restores the menu and fighter scale")
	await finish()

func finish() -> void:
	print("VISUAL RESULT: %d checks, %d failures" % [checks, failures.size()])
	if is_instance_valid(game):
		game.audio.stop_all()
		# Give the Dummy audio mixer time to release bell/ambience playback.
		await create_timer(0.12).timeout
		game.queue_free()
		await process_frame
	# Exit after run() has returned so atlas/parts locals release their resources.
	call_deferred("quit_after_cleanup")

func quit_after_cleanup() -> void:
	quit(0 if failures.is_empty() else 1)
