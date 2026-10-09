extends SceneTree

# Verify the imported, skinned 3D asset and the scene users enter from the menu.
# Run after Godot imports the GLB: godot --headless --path . --script tests/model_smoke.gd
const MODEL_PATH := "res://assets/fighters/tiger3d/tiger-study.glb"
const MOTION_PATH := "res://assets/fighters/tiger3d/tiger-study.motion.json"
const STUDY_SCRIPT := "res://scripts/model_study.gd"
const REQUIRED_CLIPS := ["idle_guard", "step_forward", "step_back", "jab", "cross", "hook", "guard_block", "dodge", "hit_react"]
const REQUIRED_BONES := ["root", "pelvis", "spine", "chest", "neck", "head", "upper_arm.L", "upper_arm.R", "forearm.L", "forearm.R", "hand.L", "hand.R", "thigh.L", "thigh.R", "shin.L", "shin.R", "foot.L", "foot.R", "tail.01", "tail.06"]

var checks := 0
var failures: Array[String] = []
var game: Node2D
var study: Node3D
var skeleton: Skeleton3D
var motion_metadata: Dictionary = {}

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, description: String) -> void:
	checks += 1
	if condition:
		print("PASS: ", description)
	else:
		failures.append(description)
		push_error("FAIL: " + description)

func tap_button(button: Button) -> void:
	var touch := InputEventScreenTouch.new()
	touch.index = 13
	touch.position = button.get_global_rect().get_center()
	touch.pressed = true
	study._input(touch)
	touch.pressed = false
	study._input(touch)

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

func bone_rotation(name: String) -> Quaternion:
	return skeleton.get_bone_global_pose(skeleton.find_bone(name)).basis.orthonormalized().get_rotation_quaternion()

func rotation_snapshot() -> Dictionary:
	var rotations := {}
	for name in REQUIRED_BONES:
		rotations[name] = bone_rotation(name)
	return rotations

func maximum_rotation_change(first: Dictionary, second: Dictionary) -> float:
	var angle := 0.0
	for name in first:
		angle = maxf(angle, first[name].angle_to(second[name]))
	return angle

func limb_reach(pose: Dictionary, side: String) -> float:
	var shoulder: Vector3 = pose["upper_arm." + side]
	var elbow: Vector3 = pose["forearm." + side]
	var wrist: Vector3 = pose["hand." + side]
	return shoulder.distance_to(wrist) / (shoulder.distance_to(elbow) + elbow.distance_to(wrist))

func contact_time(clip: String, fallback: float) -> float:
	var data: Dictionary = motion_metadata.get("clips", {}).get(clip, {})
	return float(data.get("strike_contact", data.get("contact_time", fallback)))

func peak_time(clip: String, fallback: float) -> float:
	var data: Dictionary = motion_metadata.get("clips", {}).get(clip, {})
	return float(data.get("pose_peak", fallback))

func validate_fighting_shapes() -> void:
	# Test readable anatomical relationships in the rendered skeleton. These
	# tolerances describe a guard and distinct combat actions, not baked keys.
	var guard := sample("idle_guard", 0.0)
	var guard_rotations := rotation_snapshot()
	var chest_rotation := bone_rotation("chest")
	var head: Vector3 = guard["head"]
	var chest: Vector3 = guard["chest"]
	var guard_wrist_left: Vector3 = guard["hand.L"]
	var guard_wrist_right: Vector3 = guard["hand.R"]
	check(guard_wrist_left.y > chest.y + 0.03 and guard_wrist_right.y > chest.y + 0.03 and head.y - minf(guard_wrist_left.y, guard_wrist_right.y) < 0.25, "fighting guard holds both fists above the chest close to chin height")
	check(guard_wrist_left.z > head.z + 0.02 and guard_wrist_right.z > head.z + 0.02 and guard_wrist_left.distance_to(head) < 0.5 and guard_wrist_right.distance_to(head) < 0.5, "both guarded wrists protect the front of the head instead of hanging by the sides")
	check(absf(guard["forearm.L"].x - chest.x) < 0.45 and absf(guard["forearm.R"].x - chest.x) < 0.45 and limb_reach(guard, "L") < 0.85 and limb_reach(guard, "R") < 0.85, "guard keeps bent elbows tucked beside the torso")
	var left_hand_up := skeleton.get_bone_global_pose(skeleton.find_bone("hand.L")).basis.y.normalized()
	var right_hand_up := skeleton.get_bone_global_pose(skeleton.find_bone("hand.R")).basis.y.normalized()
	check(left_hand_up.dot(Vector3.UP) > 0.5 and right_hand_up.dot(Vector3.UP) > 0.5, "guard turns both actual paw bones upward toward the cheeks")
	var guard_foot_left: Vector3 = guard["foot.L"]
	var guard_foot_right: Vector3 = guard["foot.R"]
	check(absf(guard_foot_left.z - guard_foot_right.z) > 0.2 and absf(guard_foot_left.x - guard_foot_right.x) > 0.25, "guard uses a staggered, separated fighting base")
	var alive := sample("idle_guard", 0.8)
	check(alive["head"].distance_to(head) > 0.001 and alive["tail.06"].distance_to(guard["tail.06"]) > 0.003, "idle guard includes actual head and tail movement while its feet remain planted")
	var idle_animation: Animation = study.animation_player.get_animation(study.animation_ids["idle_guard"])
	var idle_end := sample("idle_guard", idle_animation.length - 0.0001)
	check(pose_distance(guard, idle_end) < 0.01 and maximum_rotation_change(guard_rotations, rotation_snapshot()) < 0.01, "living guard closes its loop in both bone positions and rotations without a pose pop")
	var attack_poses := {}
	for clip in ["jab", "cross", "hook"]:
		var impact := sample(clip, contact_time(clip, 0.25))
		var striking_side := "R" if clip == "cross" else "L"
		var guarding_side := "L" if striking_side == "R" else "R"
		var striking_wrist: Vector3 = impact["hand." + striking_side]
		var defending_wrist: Vector3 = impact["hand." + guarding_side]
		# A bent hook attacks around a shorter lateral arc; straight punches
		# must instead gain substantial reach beyond their guarded wrist.
		var forward_reach := 0.08 if clip == "hook" else 0.2
		check(striking_wrist.z > guard["hand." + striking_side].z + forward_reach and striking_wrist.y > impact["chest"].y, "%s sends its striking fist forward at upper-body height" % clip)
		check(defending_wrist.distance_to(impact["head"]) < 0.5 and defending_wrist.y > impact["chest"].y, "%s keeps the other hand guarding the head" % clip)
		check(chest_rotation.angle_to(bone_rotation("chest")) > 0.10, "%s turns the actual torso as well as extending the arm" % clip)
		if clip == "hook":
			check(limb_reach(impact, striking_side) < 0.94, "hook remains visibly bent at the elbow instead of becoming a third straight punch")
			var windup := sample(clip, contact_time(clip, 0.34) * 0.45)
			check(absf(windup["hand.L"].x - striking_wrist.x) > 0.12, "hook sweeps the striking hand across a lateral arc")
		else:
			check(limb_reach(impact, striking_side) > 0.85, "%s visibly extends its correct arm at contact" % clip)
		attack_poses[clip] = impact
	check(pose_distance(attack_poses.jab, attack_poses.cross) > 0.5 and pose_distance(attack_poses.cross, attack_poses.hook) > 0.5, "jab, rear cross and hook have distinct full-body contact poses")
	var block := sample("guard_block", peak_time("guard_block", 0.38))
	# The cover crouches with the body. Measure raised wrists relative to the
	# moving head so a valid brace is not mistaken for a lower world-space arm.
	var left_cover_gain: float = (block["hand.L"].y - block["head"].y) - (guard_wrist_left.y - head.y)
	var right_cover_gain: float = (block["hand.R"].y - block["head"].y) - (guard_wrist_right.y - head.y)
	check(left_cover_gain > 0.02 and right_cover_gain > 0.02 and block["hand.L"].distance_to(block["head"]) < 0.5 and block["hand.R"].distance_to(block["head"]) < 0.5, "block raises both forearms relative to its crouching head into a protective cover")
	print("COVER: wrist_height_gain_relative_to_head_m=", Vector2(left_cover_gain, right_cover_gain), " head_height_change_m=", float(block["head"].y - head.y))
	var dodge := sample("dodge", peak_time("dodge", 0.42))
	check(dodge["head"].y < head.y - 0.05 and horizontal_distance(dodge["head"], head) > 0.06, "dodge moves and lowers the actual head out of the standing attack line")
	check(dodge["hand.L"].distance_to(dodge["head"]) < 0.55 and dodge["hand.R"].distance_to(dodge["head"]) < 0.55, "dodge retains a protective guard while the upper body slips")
	var recoil := sample("hit_react", peak_time("hit_react", 0.22))
	check(recoil["head"].z < head.z - 0.04 and chest_rotation.angle_to(bone_rotation("chest")) > 0.08, "hit reaction recoils the head and torso away from the incoming strike")
	for clip in ["jab", "cross", "hook", "guard_block", "dodge", "hit_react"]:
		var animation: Animation = study.animation_player.get_animation(study.animation_ids[clip])
		var recovered := sample(clip, animation.length - 0.0001)
		check(pose_distance(guard, recovered) < 0.08 and maximum_rotation_change(guard_rotations, rotation_snapshot()) < 0.08, "%s recovers its whole skeleton position and rotation to the guard pose" % clip)

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
	var parsed: Variant = motion_metadata
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
	var parsed_metadata: Variant = JSON.parse_string(FileAccess.get_file_as_string(MOTION_PATH))
	if parsed_metadata is Dictionary:
		motion_metadata = parsed_metadata
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
		var authored_duration: float = float(motion_metadata.get("clips", {}).get(clip, {}).get("duration", 0.0))
		check(absf(animation.length - authored_duration) < 0.00001, "%s imported duration preserves the authored final key rather than truncating the last frame" % clip)
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
	validate_fighting_shapes()
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
	var native_controls: Dictionary = study.get("_pose_buttons")
	check(native_controls.size() >= REQUIRED_CLIPS.size(), "native study exposes every authored fighting motion as a control")
	for clip in REQUIRED_CLIPS:
		var button: Button = native_controls.get(clip)
		if button == null:
			check(false, "%s has a native touch motion control" % clip)
			continue
		var button_rect := button.get_global_rect()
		check(button_rect.size.x >= 100 and button_rect.size.y >= 44 and Rect2(Vector2.ZERO, Vector2(1280, 720)).encloses(button_rect), "%s has a visible tablet-sized motion control" % clip)
		touch.position = button_rect.get_center()
		touch.pressed = true
		study._input(touch)
		touch.pressed = false
		study._input(touch)
		check(study.selected_pose == clip, "native tablet touch selects the authored %s motion" % clip)
	tap_button(study.get("_demo_button"))
	check(study.demo_active and study.selected_pose == "jab", "fight demo starts the real authored lead-hand attack")
	var jab_animation: Animation = study.animation_player.get_animation(study.animation_ids["jab"])
	await create_timer(jab_animation.length + 0.15).timeout
	check(study.demo_active and study.selected_pose == "cross" and study.demo_index == 1, "fight demo advances into the rear-hand cross in real playback")
	tap_button(study.get("_pause_button"))
	var paused_time: float = study.preview_time
	var paused_pose := snapshot()
	await create_timer(0.12).timeout
	check(study.demo_active and study.preview_paused and is_equal_approx(study.preview_time, paused_time) and pose_distance(paused_pose, snapshot()) < 0.0001, "tablet PAUSE freezes the real demo skeleton and its playback clock")
	tap_button(study.get("_slow_button"))
	check(study.playback_speed < 0.5 and is_equal_approx(study.animation_player.speed_scale, study.playback_speed), "tablet SPEED applies slow motion to the actual animation player")
	tap_button(study.get("_pause_button"))
	await create_timer(0.18).timeout
	check(study.demo_active and not study.preview_paused and study.preview_time > paused_time + 0.025 and study.preview_time < paused_time + 0.13, "resumed demo advances its real motion clock at the selected slower speed")
	tap_button(study.get("_slow_button"))
	tap_button(native_controls["guard_block"])
	check(not study.demo_active and study.selected_pose == "guard_block", "manual motion selection cancels the automatic demo")
	study.start_combo_demo()
	study.seek_pose(0.1, true)
	check(not study.demo_active and study.preview_paused, "exact pose inspection cancels the demo and pauses the chosen frame")
	study.start_combo_demo()
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
