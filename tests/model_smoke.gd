extends SceneTree

# Verify the imported, skinned 3D asset and the scene users enter from the menu.
# Run after Godot imports the GLB: godot --headless --path . --script tests/model_smoke.gd
const MODEL_PATH := "res://assets/fighters/tiger3d/tiger-study.glb"
const MOTION_PATH := "res://assets/fighters/tiger3d/tiger-study.motion.json"
const STUDY_SCRIPT := "res://scripts/model_study.gd"
const REQUIRED_CLIPS := ["idle_guard", "step_forward", "step_back", "jab"]
const REQUIRED_BONES := ["pelvis", "chest", "head", "upper_arm.L", "upper_arm.R", "forearm.L", "forearm.R", "thigh.L", "thigh.R", "shin.L", "shin.R", "foot.L", "foot.R"]

var checks := 0
var failures: Array[String] = []
var game: Node2D
var study: Node3D
var skeleton: Skeleton3D

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, description: String) -> void:
	checks += 1
	if condition:
		print("PASS: ", description)
	else:
		failures.append(description)
		push_error("FAIL: " + description)

func nodes_of_type(node: Node, type_name: String) -> Array[Node]:
	var result: Array[Node] = []
	if node.is_class(type_name):
		result.append(node)
	for child in node.get_children():
		result.append_array(nodes_of_type(child, type_name))
	return result

func snapshot() -> Dictionary:
	skeleton.force_update_all_bone_transforms()
	var positions := {}
	for index in range(skeleton.get_bone_count()):
		positions[skeleton.get_bone_name(index)] = skeleton.global_transform * skeleton.get_bone_global_pose(index).origin
	return positions

func sample(clip: String, seconds: float) -> Dictionary:
	study.set_pose(clip)
	study.seek_pose(seconds, true)
	skeleton.force_update_all_bone_transforms()
	return snapshot()

func finite_pose() -> bool:
	for index in range(skeleton.get_bone_count()):
		var transform := skeleton.get_bone_global_pose(index)
		var rotation := skeleton.get_bone_pose_rotation(index)
		var scale := skeleton.get_bone_pose_scale(index)
		if not transform.origin.is_finite() or not transform.basis.is_finite():
			return false
		if transform.basis.determinant() <= 0.01 or absf(rotation.length_squared() - 1.0) > 0.01 or scale.distance_to(Vector3.ONE) > 0.001:
			return false
	return true

func horizontal_distance(first: Vector3, second: Vector3) -> float:
	return Vector2(first.x, first.z).distance_to(Vector2(second.x, second.z))

func pose_distance(first: Dictionary, second: Dictionary) -> float:
	var distance := 0.0
	for name in REQUIRED_BONES:
		if first.has(name) and second.has(name):
			distance += first[name].distance_to(second[name])
	return distance

func validate_skin(meshes: Array[Node]) -> void:
	var skinned_meshes := 0
	var vertex_count := 0
	var blended_count := 0
	var invalid_weights := 0
	var invalid_bones := 0
	var detached_skins := 0
	for node in meshes:
		var instance := node as MeshInstance3D
		if instance.skin == null or instance.mesh == null:
			continue
		skinned_meshes += 1
		var bound_skeleton := instance.get_node_or_null(instance.skeleton)
		if not bound_skeleton is Skeleton3D or instance.skin.get_bind_count() == 0:
			detached_skins += 1
		for surface in range(instance.mesh.get_surface_count()):
			var arrays := instance.mesh.surface_get_arrays(surface)
			if arrays[Mesh.ARRAY_VERTEX] == null or arrays[Mesh.ARRAY_WEIGHTS] == null or arrays[Mesh.ARRAY_BONES] == null:
				invalid_weights += 1
				continue
			var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
			var weights: PackedFloat32Array = arrays[Mesh.ARRAY_WEIGHTS]
			var bones: Variant = arrays[Mesh.ARRAY_BONES]
			var slots := 8 if weights.size() == vertices.size() * 8 else 4
			if vertices.is_empty() or weights.size() != vertices.size() * slots or bones.size() != weights.size():
				invalid_weights += 1
				continue
			vertex_count += vertices.size()
			for index in range(vertices.size()):
				var total := 0.0
				var influences := 0
				for slot in range(slots):
					var weight := weights[index * slots + slot]
					var bone := int(bones[index * slots + slot])
					if not is_finite(weight) or weight < 0.0 or weight > 1.0001:
						invalid_weights += 1
					if weight > 0.001:
						influences += 1
						if bone < 0 or bone >= instance.skin.get_bind_count():
							invalid_bones += 1
						total += weight
				if absf(total - 1.0) > 0.005:
					invalid_weights += 1
				if influences > 1:
					blended_count += 1
	check(skinned_meshes > 0 and detached_skins == 0, "3D mesh has a nonempty Skin bound to an actual Skeleton3D")
	check(vertex_count > 1000, "skinned character contains a substantial three-dimensional vertex mesh")
	check(invalid_weights == 0, "every skinned vertex has finite normalized deformation weights")
	check(invalid_bones == 0, "all nonzero skin influences address valid bind bones")
	check(blended_count > vertex_count * 0.05, "skin blends multiple bone influences across joints instead of only moving rigid body pieces")
	print("SKIN: ", skinned_meshes, " meshes, ", vertex_count, " vertices, ", blended_count, " blended vertices")

func validate_contact_phases() -> void:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(MOTION_PATH))
	check(parsed is Dictionary and parsed.has("clips"), "authored motion metadata identifies intended grounded foot phases")
	if not parsed is Dictionary or not parsed.has("clips"):
		return
	var ankle_height: float = parsed.get("ankle_rest_height", 0.14)
	for clip in REQUIRED_CLIPS:
		var clip_data: Dictionary = parsed.clips.get(clip, {})
		var contact_data: Dictionary = clip_data.get("foot_contacts", {})
		var checked_intervals := 0
		var worst_slide := 0.0
		var worst_height := 0.0
		for bone_name in contact_data:
			if skeleton.find_bone(bone_name) < 0:
				continue
			for interval in contact_data[bone_name]:
				if interval.size() != 2 or interval[1] <= interval[0]:
					continue
				checked_intervals += 1
				var begin: float = float(interval[0]) + 0.005
				var end: float = float(interval[1]) - 0.005
				var initial: Vector3 = sample(clip, begin)[bone_name]
				for fraction in [0.0, 0.25, 0.5, 0.75, 1.0]:
					var position: Vector3 = sample(clip, lerpf(begin, end, fraction))[bone_name]
					worst_slide = maxf(worst_slide, horizontal_distance(initial, position))
					worst_height = maxf(worst_height, absf(position.y - ankle_height))
		check(checked_intervals > 0 and worst_slide < 0.025 and worst_height < 0.025, "%s planted foot phases stay within 2.5 cm horizontally and vertically" % clip)
		print("CONTACT: ", clip, " intervals=", checked_intervals, " max_slide_m=", worst_slide, " max_height_error_m=", worst_height)

func run() -> void:
	check(ResourceLoader.exists(MODEL_PATH), "exported tiger GLB is available through Godot's resource loader")
	if not ResourceLoader.exists(MODEL_PATH):
		await finish()
		return
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await create_timer(0.1).timeout
	check(not quit_on_go_back, "main scene disables engine auto-quit so native Android Back reaches in-game navigation")
	var sound_count: int = game.audio.streams.size()
	var ambience: AudioStream = game.audio.music.stream if game.audio.music != null else null
	var muted_before: bool = game.audio.muted
	game.enter_model_study()
	await process_frame
	study = game.model_study
	check(is_instance_valid(study) and game.mode == "model_study", "menu entry creates the actual 3D study scene")
	check(not game.world.visible and not game.get_meta("hud_node").visible and not game.pad.enabled, "3D study isolates the model from the 2D arena, HUD and combat controls")
	check(sound_count > 0 and game.audio.streams.size() == sound_count and game.audio.music.stream == ambience and game.audio.music.stream_paused, "entering the studio pauses ambience while preserving loaded game audio")
	if not is_instance_valid(study):
		await finish()
		return
	var skeletons := nodes_of_type(study.modelroot, "Skeleton3D")
	check(not skeletons.is_empty(), "imported GLB contains an actual Skeleton3D")
	if skeletons.is_empty():
		await finish()
		return
	skeleton = skeletons[0] as Skeleton3D
	check(skeleton.get_bone_count() >= REQUIRED_BONES.size(), "skeleton includes complete torso, arm and leg chains")
	var missing: Array[String] = []
	for name in REQUIRED_BONES:
		if skeleton.find_bone(name) < 0:
			missing.append(name)
	check(missing.is_empty(), "expected anatomical bones are present: " + str(missing))
	validate_skin(nodes_of_type(study.modelroot, "MeshInstance3D"))
	check(study.animation_player != null, "imported model exposes its authored animation player")
	if study.animation_player == null:
		await finish()
		return
	var guard := {}
	for clip in REQUIRED_CLIPS:
		study.set_pose(clip)
		var animation_id: StringName = study.animation_player.current_animation
		var animation: Animation = study.animation_player.get_animation(animation_id)
		check(animation != null and animation.length > 0.1, "%s resolves to a real nonempty animation clip" % clip)
		if animation == null:
			continue
		var starts_at_zero := animation.get_track_count() > 0
		for track in range(animation.get_track_count()):
			if animation.track_get_key_count(track) == 0 or animation.track_get_key_time(track, 0) > 0.000001:
				starts_at_zero = false
		check(starts_at_zero, "%s keys its complete pose at time zero, avoiding stale bones when a motion starts" % clip)
		var first := sample(clip, 0.01)
		var all_finite := finite_pose()
		var middle := sample(clip, animation.length * 0.5)
		all_finite = all_finite and finite_pose()
		var last := sample(clip, animation.length * 0.94)
		all_finite = all_finite and finite_pose()
		check(all_finite, "%s maintains finite transforms, normalized rotations and unit bone scales at all sampled poses" % clip)
		check(pose_distance(first, middle) > 0.001, "%s changes the actual skeleton pose over time" % clip)
		if clip == "idle_guard":
			guard = first
			if first.has("foot.L") and first.has("foot.R"):
				check(first["foot.L"].distance_to(last["foot.L"]) < 0.015 and first["foot.R"].distance_to(last["foot.R"]) < 0.015, "idle guard keeps both foot anchors planted")
		elif clip in ["step_forward", "step_back"]:
			if first.has("root") and last.has("root"):
				check(horizontal_distance(first["root"], last["root"]) > 0.1, "%s contains actual body travel instead of feet walking in place" % clip)
				if first.has("foot.L") and first.has("foot.R"):
					var travel: Vector3 = last["root"] - first["root"]
					travel.y = 0.0
					travel = travel.normalized()
					var leading := "foot.L" if first["foot.L"].dot(travel) > first["foot.R"].dot(travel) else "foot.R"
					var trailing := "foot.R" if leading == "foot.L" else "foot.L"
					var early := sample(clip, animation.length * 0.3)
					var leading_travel: float = (early[leading] - first[leading]).dot(travel)
					var trailing_travel: float = (early[trailing] - first[trailing]).dot(travel)
					check(leading_travel > trailing_travel + 0.04, "%s moves the foot nearest its travel direction first, preserving fighting stance" % clip)
		elif clip == "jab" and not guard.is_empty():
			check(pose_distance(guard, middle) > 0.1, "jab changes the torso and arm pose from the guard stance")
	validate_contact_phases()
	study.set_camera_mode("side")
	var side_transform: Transform3D = study.camera.global_transform
	study.set_camera_mode("orbit")
	check(study.camera_mode == "orbit" and study.camera.global_transform.origin.distance_to(side_transform.origin) > 0.1, "orbit view moves the real 3D camera away from the side view")
	var orbit_before: Vector3 = study.camera.global_transform.origin
	var touch := InputEventScreenTouch.new()
	touch.index = 7
	touch.position = Vector2(640, 350)
	touch.pressed = true
	study._input(touch)
	var drag := InputEventScreenDrag.new()
	drag.index = 7
	drag.position = touch.position + Vector2(100, 0)
	drag.relative = Vector2(100, 0)
	study._input(drag)
	touch.pressed = false
	study._input(touch)
	check(study.camera.global_transform.origin.distance_to(orbit_before) > 0.1, "native tablet touch dragging rotates the orbit camera")
	study.set_camera_mode("side")
	check(study.camera_mode == "side" and study.camera.global_transform.origin.distance_to(side_transform.origin) < 0.001, "side view restores its original camera position")
	var punch_button: Button
	for node in nodes_of_type(study, "Button"):
		if node.text == "PUNCH":
			punch_button = node as Button
	check(punch_button != null, "native study exposes its punch control")
	if punch_button != null:
		touch.position = punch_button.get_global_rect().get_center()
		touch.pressed = true
		study._input(touch)
		touch.pressed = false
		study._input(touch)
		check(study.selected_pose == "jab", "native tablet touch on PUNCH selects the authored jab")
	study.leave_study()
	await process_frame
	check(game.mode == "menu" and game.world.visible and game.get_meta("hud_node").visible, "leaving the 3D study restores the main menu and arena")
	check(game.bot.visible and game.player.scale.is_equal_approx(Vector2.ONE) and not game.pad.enabled, "leaving the 3D study restores fighter scale and menu control state")
	check(game.audio.streams.size() == sound_count and game.audio.music.stream == ambience and not game.audio.music.stream_paused and game.audio.muted == muted_before, "leaving the studio restores ambience and preserves the sound preference")
	game.enter_model_study()
	await process_frame
	game._notification(Node.NOTIFICATION_WM_GO_BACK_REQUEST)
	# Native Window dispatches the notification and then this signal. Both stages
	# are needed to catch SceneTree's default auto-quit, which manual notification
	# alone would hide even if returning to the menu appeared to work.
	root.emit_signal("go_back_requested")
	await process_frame
	check(game.mode == "menu" and game.world.visible, "Android system Back exits the 3D study and survives the engine go-back signal")
	await finish()

func finish() -> void:
	print("MODEL RESULT: %d checks, %d failures" % [checks, failures.size()])
	if is_instance_valid(game):
		game.audio.stop_all()
		await create_timer(0.12).timeout
		game.queue_free()
		await process_frame
	call_deferred("quit_after_cleanup")

func quit_after_cleanup() -> void:
	quit(0 if failures.is_empty() else 1)
