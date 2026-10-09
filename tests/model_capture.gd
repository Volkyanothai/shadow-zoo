extends SceneTree

# Native 3D proof from the same study scene included in the APK.
# DISPLAY=:93 godot --path . --audio-driver Dummy --script tests/model_capture.gd
# Add --fixed-fps 60 --write-movie /workspace/artifacts/shadow-zoo-model-demo.avi -- --demo
# The scripted movie timeline is not a measurement of device performance.
const OUTPUT_DIR := "/workspace/artifacts"
const MOTION_PATH := "res://assets/fighters/tiger3d/tiger-study.motion.json"
const DEMO_FPS := 60.0
const DEMO_FRAMES := 900

var study: Node3D
var motion_metadata: Dictionary = {}

func _initialize() -> void:
	call_deferred("run")

func rendered_frame() -> void:
	await process_frame
	await RenderingServer.frame_post_draw

func orbit_drag(relative: Vector2) -> void:
	var touch := InputEventScreenTouch.new()
	touch.index = 11
	touch.position = Vector2(640, 350)
	touch.pressed = true
	study._input(touch)
	var drag := InputEventScreenDrag.new()
	drag.index = 11
	drag.position = touch.position + relative
	drag.relative = relative
	study._input(drag)
	touch.pressed = false
	study._input(touch)

func capture(name: String, pose: String, seconds: float, view: String, drag_x := 0.0) -> void:
	study.set_pose(pose)
	study.seek_pose(seconds, true)
	study.set_camera_mode(view)
	if not is_zero_approx(drag_x):
		orbit_drag(Vector2(drag_x, 0.0))
	await rendered_frame()
	var screenshot: Image = root.get_texture().get_image()
	if screenshot == null or screenshot.is_empty():
		push_error("No native rendered image available.")
		quit(1)
		return
	var filename := OUTPUT_DIR.path_join("shadow-zoo-model-" + name + ".png")
	var error := screenshot.save_png(filename)
	if error != OK:
		push_error("Screenshot failed: " + filename)
		quit(1)
		return
	print("CAPTURED: ", filename, " ", screenshot.get_size())

func pose_peak(clip: String, fallback: float) -> float:
	var data: Dictionary = motion_metadata.get("clips", {}).get(clip, {})
	return float(data.get("pose_peak", data.get("strike_contact", fallback)))

func clip_duration(clip: String) -> float:
	var animation: Animation = study.animation_player.get_animation(study.animation_ids[clip])
	return animation.length

func run() -> void:
	if DisplayServer.get_name() == "headless":
		push_error("3D capture requires a native graphical display; headless rendering is not visual proof.")
		quit(1)
		return
	DirAccess.make_dir_recursive_absolute(OUTPUT_DIR)
	var parsed_metadata: Variant = JSON.parse_string(FileAccess.get_file_as_string(MOTION_PATH))
	if parsed_metadata is Dictionary:
		motion_metadata = parsed_metadata
	study = load("res://scenes/model_study.tscn").instantiate()
	root.add_child(study)
	await process_frame
	if study.modelroot == null or study.animation_player == null:
		push_error("Actual imported 3D tiger or animation player is missing.")
		quit(1)
		return
	if "--demo" in OS.get_cmdline_user_args():
		await record_demo()
	else:
		await capture("side-guard", "idle_guard", 0.0, "side")
		await capture("orbit-guard", "idle_guard", 0.0, "orbit")
		await capture("orbit-back", "idle_guard", 0.0, "orbit", 225.0)
		await capture("step-forward", "step_forward", pose_peak("step_forward", 0.31), "side")
		await capture("step-back", "step_back", pose_peak("step_back", 0.31), "side")
		await capture("jab-contact", "jab", pose_peak("jab", 0.20), "side")
		await capture("jab-orbit", "jab", pose_peak("jab", 0.20), "orbit")
		await capture("cross-contact", "cross", pose_peak("cross", 0.29), "side")
		await capture("cross-orbit", "cross", pose_peak("cross", 0.29), "orbit")
		await capture("hook-contact", "hook", pose_peak("hook", 0.34), "side")
		await capture("hook-orbit", "hook", pose_peak("hook", 0.34), "orbit")
		await capture("block-side", "guard_block", pose_peak("guard_block", 0.38), "side")
		await capture("block-orbit", "guard_block", pose_peak("guard_block", 0.38), "orbit")
		await capture("dodge-side", "dodge", pose_peak("dodge", 0.42), "side")
		await capture("dodge-orbit", "dodge", pose_peak("dodge", 0.42), "orbit")
		await capture("hit-react", "hit_react", pose_peak("hit_react", 0.22), "side")
	study.queue_free()
	await process_frame
	print("Native 3D tiger capture complete.")
	quit()

func record_demo() -> void:
	# Every motion is shown at its authored speed once, followed by a three-
	# quarter inspection of the guard and attacks. The reel carries completed
	# root travel into the next clip so the advance and retreat join continuously.
	var segments := [
		{"begin": 0.0, "end": 1.7, "clip": "idle_guard", "view": "side"},
		{"begin": 1.7, "end": 3.0, "clip": "step_forward", "view": "side"},
		{"begin": 3.0, "end": 4.3, "clip": "step_back", "view": "side"},
		{"begin": 4.3, "end": 5.1, "clip": "jab", "view": "side"},
		{"begin": 5.1, "end": 6.05, "clip": "cross", "view": "side"},
		{"begin": 6.05, "end": 7.1, "clip": "hook", "view": "side"},
		{"begin": 7.1, "end": 8.15, "clip": "guard_block", "view": "side"},
		{"begin": 8.15, "end": 9.25, "clip": "dodge", "view": "side"},
		{"begin": 9.25, "end": 10.25, "clip": "hit_react", "view": "side"},
		{"begin": 10.25, "end": 12.0, "clip": "idle_guard", "view": "orbit", "rotate": true},
		{"begin": 12.0, "end": 12.8, "clip": "jab", "view": "orbit"},
		{"begin": 12.8, "end": 13.75, "clip": "cross", "view": "orbit"},
		{"begin": 13.75, "end": 14.8, "clip": "hook", "view": "orbit"},
		{"begin": 14.8, "end": 15.0, "clip": "idle_guard", "view": "orbit"},
	]
	var current_clip := ""
	var current_view := ""
	var accumulated_travel := Vector3.ZERO
	for frame in range(DEMO_FRAMES):
		var timeline := float(frame) / DEMO_FPS
		var selected: Dictionary = segments[0]
		for segment: Dictionary in segments:
			if timeline >= segment.begin and timeline < segment.end:
				selected = segment
				break
		var clip: String = selected.clip
		var view: String = selected.view
		var clip_time := minf(timeline - float(selected.begin), clip_duration(clip) - 0.0001)
		if clip != current_clip:
			if current_clip != "":
				var completed: Dictionary = motion_metadata.get("clips", {}).get(current_clip, {})
				var travel: Array = completed.get("root_translation_blender", [0, 0, 0])
				# Map Blender (x, y, z) to Godot (x, z, -y); -Y is forward +Z.
				accumulated_travel += Vector3(float(travel[0]), float(travel[2]), -float(travel[1]))
			study.set_pose(clip)
			current_clip = clip
		if view != current_view:
			study.set_camera_mode(view)
			current_view = view
		study.seek_pose(clip_time, false)
		study.modelroot.position = accumulated_travel
		if selected.get("rotate", false):
			# A full turn follows the studio's real tablet orbit gesture path.
			orbit_drag(Vector2(TAU / (0.008 * (float(selected.end) - float(selected.begin)) * DEMO_FPS), 0.0))
		# Exactly one draw per timeline sample avoids doubling movie duration.
		await RenderingServer.frame_post_draw
	print("Rendered ", DEMO_FRAMES, " 3D demo samples on a fifteen-second scripted timeline; this is not a device FPS benchmark.")
