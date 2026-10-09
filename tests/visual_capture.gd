extends SceneTree

# Native rendered proof, using the real arena, fighter and atlas. Requires a
# graphical display (e.g. Xvfb), not --headless. With --demo, record the loop
# using Godot's --write-movie and --fixed-fps 60 command-line options.
const VISUAL_PATH := "res://scripts/tiger_visual.gd"
const OUTPUT_DIR := "/workspace/artifacts"
const DEMO_FPS := 60.0

var game: Node2D
var visual: Node2D
var preview_x := 420.0

func _initialize() -> void:
	call_deferred("run")

func find_visual(node: Node) -> Node2D:
	var script: Script = node.get_script()
	if script != null and script.resource_path == VISUAL_PATH:
		return node as Node2D
	for child in node.get_children():
		var found := find_visual(child)
		if found != null:
			return found
	return null

func pose(state: String, time := 0.0, combo := 1, animation_time := 0.0, kind := "light") -> void:
	game.player.state = state
	game.player.state_time = time
	game.player.combo = combo
	game.player.animation_time = animation_time
	game.player.attack_kind = kind
	game.player.guard = state == "guard"
	game.player.move_axis = 1.0 if state == "run" else 0.0
	game.player.position.y = ZooFighter.FLOOR_Y
	game.player.vertical_speed = 0.0
	if game.mode == "study":
		game.study_pose = "walk" if state == "run" else ("combo" if state == "attack" else state)
	visual.sync_from_fighter(true)
	game.player.queue_redraw()
	game.get_meta("hud_node").queue_redraw()

func rendered_frame() -> void:
	await process_frame
	await RenderingServer.frame_post_draw

func save_frame(name: String) -> void:
	await rendered_frame()
	var screenshot: Image = root.get_texture().get_image()
	if screenshot == null or screenshot.is_empty():
		push_error("No rendered image available; run on a native graphical display.")
		quit(1)
		return
	var filename := OUTPUT_DIR.path_join("shadow-zoo-visual-" + name + ".png")
	var error := screenshot.save_png(filename)
	if error != OK:
		push_error("Screenshot failed: " + filename + " (%d)" % error)
		quit(1)
		return
	print("CAPTURED: ", filename, " ", screenshot.get_size())

func run() -> void:
	if DisplayServer.get_name() == "headless":
		push_error("Visual capture needs a native graphical renderer; --headless cannot provide visual proof.")
		quit(1)
		return
	DirAccess.make_dir_recursive_absolute(OUTPUT_DIR)
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await create_timer(0.15).timeout
	game.bot_enabled = false
	game.start_match(true)
	game.player.position.x = 420.0
	game.bot.position.x = 850.0
	game.player.facing = 1.0
	game.bot.facing = -1.0
	game.set_physics_process(false)
	game.player.set_physics_process(false)
	game.bot.set_physics_process(false)
	game.pad.enabled = true
	visual = find_visual(game.player)
	if visual == null or not visual.has_art():
		push_error("Detailed tiger rig or atlas is missing; no visual proof captured.")
		quit(1)
		return
	game.audio.stop_all()
	pose("idle")
	await save_frame("gameplay")
	if game.has_method("enter_study"):
		game.enter_study()
		game.set_physics_process(false)
		game.player.set_physics_process(false)
		game.bot.set_physics_process(false)
		preview_x = 640.0
		game.player.position.x = preview_x
	if "--demo" in OS.get_cmdline_user_args():
		await record_demo()
	else:
		pose("idle")
		await save_frame("standing")
		pose("run", 0.0, 1, 0.15)
		await save_frame("walking")
		for combo in [1, 2, 3]:
			pose("attack", 0.105, combo)
			await save_frame("combo-%d" % combo)
		pose("guard")
		await save_frame("guard")
		pose("attack", 0.29, 1, 0.0, "heavy")
		await save_frame("kick")
	game.queue_free()
	await process_frame
	print("Native tiger visual capture complete.")
	quit()

func record_demo() -> void:
	# Four-second deterministic loop: breathe, walk, three punches, recover.
	for frame in range(240):
		var time := float(frame) / DEMO_FPS
		game.player.position.x = preview_x
		if time < 0.75:
			pose("idle", 0.0, 1, time)
		elif time < 1.65:
			pose("run", 0.0, 1, time)
			game.player.position.x = preview_x + sin((time - 0.75) / 0.9 * PI) * 50.0
		elif time < 2.64:
			var elapsed := time - 1.65
			var stage := mini(int(elapsed / 0.33) + 1, 3)
			pose("attack", fmod(elapsed, 0.33), stage, time)
		else:
			pose("idle", 0.0, 1, time)
		await rendered_frame()
	print("Rendered 240 demo frames at a scripted 60 Hz timeline.")
