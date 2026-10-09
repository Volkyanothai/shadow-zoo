extends SceneTree

# Native 3D proof from the same study scene included in the APK.
# DISPLAY=:93 godot --path . --audio-driver Dummy --script tests/model_capture.gd
# Add --fixed-fps 60 --write-movie /workspace/artifacts/shadow-zoo-model-demo.avi -- --demo
# The scripted movie timeline is not a measurement of device performance.
const OUTPUT_DIR := "/workspace/artifacts"
const DEMO_FPS := 60.0
const DEMO_FRAMES := 480

var study: Node3D

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

func run() -> void:
	if DisplayServer.get_name() == "headless":
		push_error("3D capture requires a native graphical display; headless rendering is not visual proof.")
		quit(1)
		return
	DirAccess.make_dir_recursive_absolute(OUTPUT_DIR)
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
		await capture("side-guard", "idle_guard", 0.1, "side")
		await capture("orbit-guard", "idle_guard", 0.1, "orbit")
		await capture("orbit-back", "idle_guard", 0.1, "orbit", 225.0)
		await capture("step-forward", "step_forward", 0.55, "side")
		await capture("step-back", "step_back", 0.55, "side")
		await capture("jab-contact", "jab", 0.23, "side")
		await capture("jab-orbit", "jab", 0.23, "orbit")
	study.queue_free()
	await process_frame
	print("Native 3D tiger capture complete.")
	quit()

func record_demo() -> void:
	var current_clip := ""
	var current_view := ""
	for frame in range(DEMO_FRAMES):
		var timeline := float(frame) / DEMO_FPS
		var clip := "idle_guard"
		var view := "side"
		var clip_time := timeline
		if timeline >= 1.2 and timeline < 2.5:
			clip = "step_forward"
			clip_time = minf(timeline - 1.2, 1.19)
		elif timeline >= 2.5 and timeline < 3.8:
			clip = "step_back"
			clip_time = minf(timeline - 2.5, 1.19)
		elif timeline >= 3.8 and timeline < 4.8:
			clip = "jab"
			clip_time = minf(timeline - 3.8, 0.64)
		elif timeline >= 4.8 and timeline < 6.4:
			view = "orbit"
			clip_time = timeline - 4.8
		elif timeline >= 6.4:
			view = "orbit"
			clip = "jab"
			clip_time = fposmod(timeline - 6.4, 0.8)
			clip_time = minf(clip_time, 0.64)
		if clip != current_clip:
			study.set_pose(clip)
			current_clip = clip
		if view != current_view:
			study.set_camera_mode(view)
			current_view = view
		study.seek_pose(clip_time, true)
		if timeline >= 4.8 and timeline < 6.4:
			# A full turn follows the studio's real tablet orbit gesture path.
			orbit_drag(Vector2(TAU / (0.008 * 1.6 * DEMO_FPS), 0.0))
		# Exactly one draw per timeline sample avoids doubling movie duration.
		await RenderingServer.frame_post_draw
	print("Rendered ", DEMO_FRAMES, " 3D demo samples on an eight-second scripted timeline; this is not a device FPS benchmark.")
