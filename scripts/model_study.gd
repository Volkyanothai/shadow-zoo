extends Node3D
## A separate native studio for inspecting the actual skinned character asset.
## The fighting scene owns entry and exit; this scene never changes match state.

signal exited

const MODEL_PATH := "res://assets/fighters/tiger3d/tiger-study.glb"
const POSES := ["idle_guard", "step_forward", "step_back", "jab"]
const POSE_LABELS := {
	"idle_guard": "STANCE", "step_forward": "STEP FORWARD",
	"step_back": "STEP BACK", "jab": "PUNCH",
}
const ACCENT := Color("dfb779")
const TEXT := Color("e5e9ec")
const MUTED := Color("8f9ba9")

# Kept public so the native capture and motion checks inspect the same studio.
var modelroot: Node3D
var animation_player: AnimationPlayer
var camera: Camera3D
var selected_pose := "idle_guard"
var camera_mode := "side"
var preview_time := 0.0
var animation_ids: Dictionary = {}
var preview_paused := false
var playback_speed := 1.0

var _ui: Control
var _pose_buttons: Dictionary = {}
var _camera_buttons: Dictionary = {}
var _button_actions: Dictionary = {}
var _status: Label
var _hint: Label
var _progress: ProgressBar
var _slow_button: Button
var _pause_button: Button
var _font: Font
var _orbit_angle := -0.70
var _orbit_elevation := 0.19
var _drag_pointer := -1
var _mouse_drag := false
var _clip_duration := 0.0
var _finished := false
var _missing_reason := ""
var _exit_requested := false


func _ready() -> void:
	_font = load("res://assets/fonts/Rajdhani-SemiBold.ttf") as Font
	_build_studio()
	_build_ui()
	_load_character()
	set_camera_mode("side")
	set_pose("idle_guard")


func _build_studio() -> void:
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("111620")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("c8d1dc")
	environment.ambient_light_energy = 0.25
	var world_environment := WorldEnvironment.new()
	world_environment.name = "StudioEnvironment"
	world_environment.environment = environment
	add_child(world_environment)

	var floor_material := StandardMaterial3D.new()
	floor_material.albedo_color = Color("10151d")
	floor_material.roughness = 0.95
	var floor_mesh := PlaneMesh.new()
	floor_mesh.size = Vector2(30, 30)
	var floor_node := MeshInstance3D.new()
	floor_node.name = "StudioFloor"
	floor_node.mesh = floor_mesh
	floor_node.material_override = floor_material
	floor_node.position.y = -0.005
	add_child(floor_node)

	var platform_material := StandardMaterial3D.new()
	platform_material.albedo_color = Color("18212d")
	platform_material.roughness = 0.9
	var platform_mesh := CylinderMesh.new()
	platform_mesh.top_radius = 1.5
	platform_mesh.bottom_radius = 1.5
	platform_mesh.height = 0.014
	platform_mesh.radial_segments = 80
	var platform := MeshInstance3D.new()
	platform.name = "InspectionPlatform"
	platform.mesh = platform_mesh
	platform.material_override = platform_material
	platform.position.y = -0.012
	add_child(platform)

	var marker_material := StandardMaterial3D.new()
	marker_material.albedo_color = Color("778391")
	marker_material.roughness = 0.9
	# Quiet distance marks make planted feet and real forward travel readable.
	for offset: float in [-1.0, -0.5, 0.0, 0.5, 1.0]:
		var marker := MeshInstance3D.new()
		var marker_mesh := BoxMesh.new()
		marker_mesh.size = Vector3(0.16, 0.002, 0.009)
		marker.mesh = marker_mesh
		marker.material_override = marker_material
		marker.position = Vector3(-0.75, -0.003, offset)
		add_child(marker)

	var key := DirectionalLight3D.new()
	key.name = "KeyLight"
	key.rotation_degrees = Vector3(-48, -38, 0)
	key.light_color = Color("fff0db")
	key.light_energy = 0.8
	key.shadow_enabled = true
	key.shadow_opacity = 0.65
	key.directional_shadow_max_distance = 12.0
	add_child(key)

	var fill := OmniLight3D.new()
	fill.name = "FillLight"
	fill.position = Vector3(-3.0, 2.7, 3.6)
	fill.light_color = Color("bbcfe9")
	fill.light_energy = 0.3
	fill.omni_range = 9.0
	add_child(fill)

	var rim := OmniLight3D.new()
	rim.name = "RimLight"
	rim.position = Vector3(2.0, 3.0, -2.5)
	rim.light_color = Color("e0e8fa")
	rim.light_energy = 0.45
	rim.omni_range = 8.0
	add_child(rim)

	camera = Camera3D.new()
	camera.name = "InspectionCamera"
	camera.current = true
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 3.65
	camera.near = 0.05
	camera.far = 45.0
	add_child(camera)


func _load_character() -> void:
	if not ResourceLoader.exists(MODEL_PATH):
		_missing_reason = "The character could not be loaded. Please reopen the studio."
		_show_asset_error()
		return
	var packed := load(MODEL_PATH) as PackedScene
	if packed == null:
		_missing_reason = "The character could not be loaded. Please reopen the studio."
		_show_asset_error()
		return
	modelroot = packed.instantiate() as Node3D
	if modelroot == null:
		_missing_reason = "The character could not be loaded. Please reopen the studio."
		_show_asset_error()
		return
	modelroot.name = "GreyTiger"
	add_child(modelroot)
	animation_player = _find_animation_player(modelroot)
	if animation_player == null:
		_missing_reason = "The character's movements could not be loaded."
		_show_asset_error()
		return
	for pose: String in POSES:
		for animation_name: StringName in animation_player.get_animation_list():
			var name_text := String(animation_name)
			if name_text == pose or name_text.ends_with("/" + pose) or name_text.ends_with("_" + pose) or name_text.ends_with("|" + pose):
				animation_ids[pose] = animation_name
				break
	if animation_ids.size() != POSES.size():
		_missing_reason = "Some movements could not be loaded. Please reopen the studio."
		_show_asset_error()


func _find_animation_player(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer:
		return node as AnimationPlayer
	for child: Node in node.get_children():
		var found := _find_animation_player(child)
		if found != null:
			return found
	return null


func _show_asset_error() -> void:
	_status.text = _missing_reason
	_hint.text = "Use EXIT to return to the game."
	for button: Button in _pose_buttons.values():
		button.disabled = true
	_slow_button.disabled = true
	_pause_button.disabled = true


func set_pose(pose: String) -> void:
	if pose not in POSES:
		return
	selected_pose = pose
	preview_time = 0.0
	_finished = false
	preview_paused = false
	if is_instance_valid(modelroot):
		# Restarting a motion never carries its root travel into the next clip.
		modelroot.position = Vector3.ZERO
	if is_instance_valid(animation_player) and animation_ids.has(pose):
		animation_player.stop()
		var animation_id: StringName = animation_ids[pose]
		var clip := animation_player.get_animation(animation_id)
		_clip_duration = clip.length
		# Only stance loops. A step completes once and remains at its destination,
		# so the planted support foot does not slide when a loop resets position.
		clip.loop_mode = Animation.LOOP_LINEAR if pose == "idle_guard" else Animation.LOOP_NONE
		animation_player.play(animation_id)
		animation_player.speed_scale = playback_speed
		animation_player.seek(0.0, true)
	_update_ui()


func seek_pose(seconds: float, paused: bool = true) -> void:
	if not is_instance_valid(animation_player) or not animation_ids.has(selected_pose):
		return
	var target := clampf(seconds, 0.0, maxf(0.0, _clip_duration - 0.00001))
	if animation_player.current_animation != animation_ids[selected_pose]:
		animation_player.play(animation_ids[selected_pose])
	animation_player.seek(target, true)
	preview_time = target
	preview_paused = paused
	_finished = target >= _clip_duration - 0.001 and selected_pose != "idle_guard"
	if paused:
		animation_player.pause()
	_update_ui()


func set_camera_mode(mode: String) -> void:
	if mode not in ["side", "orbit"]:
		return
	camera_mode = mode
	_drag_pointer = -1
	_mouse_drag = false
	if mode == "orbit":
		_orbit_angle = -0.70
		_orbit_elevation = 0.19
	_update_camera()
	_update_ui()


func _update_camera() -> void:
	if not is_instance_valid(camera):
		return
	var target := Vector3(0.0, 1.0, 0.0)
	if camera_mode == "side":
		camera.position = Vector3(-5.6, 1.37, 0.0)
	else:
		var radius := 5.7
		camera.position = target + Vector3(sin(_orbit_angle) * radius, sin(_orbit_elevation) * radius, cos(_orbit_angle) * radius)
	camera.look_at(target, Vector3.UP)


func _process(delta: float) -> void:
	if is_instance_valid(animation_player) and not preview_paused and not _finished:
		preview_time += delta * playback_speed
		if selected_pose == "idle_guard" and _clip_duration > 0.0:
			preview_time = fposmod(preview_time, _clip_duration)
		elif _clip_duration > 0.0 and preview_time >= _clip_duration:
			preview_time = _clip_duration
			_finished = true
			# Clamp to the last authored pose; let the user replay it explicitly.
			animation_player.seek(maxf(0.0, _clip_duration - 0.00001), true)
			animation_player.pause()
			_update_ui()
		_progress.value = preview_time / _clip_duration if _clip_duration > 0.0 else 0.0


func leave_study() -> void:
	if _exit_requested:
		return
	_exit_requested = true
	exited.emit()


func _set_speed() -> void:
	playback_speed = 0.35 if playback_speed > 0.5 else 1.0
	if is_instance_valid(animation_player):
		animation_player.speed_scale = playback_speed
	_update_ui()


func _toggle_pause() -> void:
	if not is_instance_valid(animation_player) or not animation_ids.has(selected_pose):
		return
	if _finished:
		set_pose(selected_pose)
		return
	preview_paused = not preview_paused
	if preview_paused:
		animation_player.pause()
	else:
		animation_player.play()
	_update_ui()


func _build_ui() -> void:
	var layer := CanvasLayer.new()
	layer.name = "StudyUI"
	layer.layer = 30
	add_child(layer)
	_ui = Control.new()
	_ui.name = "Controls"
	_ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ui.theme = Theme.new()
	_ui.theme.default_font = _font
	layer.add_child(_ui)

	_panel(Rect2(0, 0, 1280, 111), Color(0.042, 0.056, 0.080, 0.91))
	_label("SHADOW ZOO", Rect2(48, 24, 290, 24), 20, ACCENT)
	_label("KAI  /  FORM & MOTION", Rect2(48, 47, 580, 43), 34, TEXT)
	_label("GREY TIGER STUDY", Rect2(850, 39, 225, 31), 19, MUTED, HORIZONTAL_ALIGNMENT_RIGHT)
	_button("EXIT", Rect2(1124, 32, 108, 48), leave_study)

	_label("VIEW", Rect2(48, 131, 90, 27), 17, MUTED)
	_camera_buttons["side"] = _button("SIDE", Rect2(48, 163, 101, 45), set_camera_mode.bind("side"))
	_camera_buttons["orbit"] = _button("ORBIT", Rect2(159, 163, 108, 45), set_camera_mode.bind("orbit"))
	_label("PLAYBACK", Rect2(48, 238, 180, 27), 17, MUTED)
	_slow_button = _button("SPEED  1×", Rect2(48, 270, 130, 45), _set_speed)
	_pause_button = _button("PAUSE", Rect2(48, 325, 130, 45), _toggle_pause)

	_panel(Rect2(0, 578, 1280, 142), Color(0.042, 0.056, 0.080, 0.95))
	_status = _label("STANCE", Rect2(48, 592, 310, 24), 19, TEXT)
	_hint = _label("Tap a move to replay it.", Rect2(500, 592, 732, 24), 17, MUTED, HORIZONTAL_ALIGNMENT_RIGHT)
	var button_x := 202.0
	for pose: String in POSES:
		_pose_buttons[pose] = _button(POSE_LABELS[pose], Rect2(button_x, 629, 207, 58), set_pose.bind(pose), 22)
		button_x += 223.0
	_progress = ProgressBar.new()
	_progress.name = "MotionProgress"
	_progress.position = Vector2(48, 697)
	_progress.size = Vector2(1184, 3)
	_progress.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_progress.show_percentage = false
	_progress.max_value = 1.0
	_progress.add_theme_stylebox_override("background", _style(Color("253242"), 0))
	_progress.add_theme_stylebox_override("fill", _style(ACCENT, 0))
	_ui.add_child(_progress)


func _panel(rect: Rect2, color: Color) -> void:
	var panel := Panel.new()
	panel.position = rect.position
	panel.size = rect.size
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_theme_stylebox_override("panel", _style(color, 0))
	_ui.add_child(panel)


func _label(value: String, rect: Rect2, size: int, color: Color, alignment: HorizontalAlignment = HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var label := Label.new()
	label.text = value
	label.position = rect.position
	label.size = rect.size
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.horizontal_alignment = alignment
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	_ui.add_child(label)
	return label


func _button(value: String, rect: Rect2, action: Callable, font_size: int = 19) -> Button:
	var button := Button.new()
	button.text = value
	button.position = rect.position
	button.size = rect.size
	button.focus_mode = Control.FOCUS_NONE
	button.add_theme_font_size_override("font_size", font_size)
	button.add_theme_color_override("font_color", TEXT)
	button.add_theme_color_override("font_hover_color", Color.WHITE)
	button.add_theme_color_override("font_pressed_color", ACCENT)
	button.add_theme_stylebox_override("normal", _style(Color("1b2736"), 8, Color("374555")))
	button.add_theme_stylebox_override("hover", _style(Color("2b394a"), 8, Color("687485")))
	button.add_theme_stylebox_override("pressed", _style(Color("3a352d"), 8, ACCENT))
	button.add_theme_stylebox_override("disabled", _style(Color("18202b"), 8, Color("26313e")))
	button.pressed.connect(action)
	_button_actions[button] = action
	_ui.add_child(button)
	return button


func _style(color: Color, radius: int, border: Color = Color.TRANSPARENT) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.set_corner_radius_all(radius)
	style.border_color = border
	style.set_border_width_all(1 if border.a > 0.0 else 0)
	return style


func _update_ui() -> void:
	if not is_instance_valid(_status):
		return
	if _missing_reason.is_empty():
		var suffix := "  /  REPLAY READY" if _finished else ""
		if preview_paused and not _finished:
			suffix = "  /  PAUSED"
		_status.text = POSE_LABELS.get(selected_pose, "STANCE") + suffix
		_hint.text = "Drag the character to turn the view.  •  Tap a move to replay." if camera_mode == "orbit" else "Tap a move to replay it.  •  ORBIT lets you inspect every side."
	for pose: String in _pose_buttons:
		_mark_selected(_pose_buttons[pose], pose == selected_pose)
	for view: String in _camera_buttons:
		_mark_selected(_camera_buttons[view], view == camera_mode)
	_slow_button.text = "SPEED  0.35×" if playback_speed < 0.5 else "SPEED  1×"
	_pause_button.text = "REPLAY" if _finished else ("RESUME" if preview_paused else "PAUSE")
	_progress.value = preview_time / _clip_duration if _clip_duration > 0.0 else 0.0


func _mark_selected(button: Button, selected: bool) -> void:
	button.add_theme_color_override("font_color", ACCENT if selected else TEXT)
	button.add_theme_stylebox_override("normal", _style(Color("3a352d") if selected else Color("1b2736"), 8, ACCENT if selected else Color("374555")))


func _button_at(point: Vector2) -> Button:
	for candidate: Button in _button_actions:
		if candidate.get_global_rect().has_point(point):
			return candidate
	return null


func _input(event: InputEvent) -> void:
	# The app deliberately does not emulate mouse input from touch. Handle native
	# touch buttons explicitly, while desktop buttons retain normal GUI behavior.
	if event is InputEventScreenTouch:
		if event.pressed:
			var button := _button_at(event.position)
			if button != null:
				if not button.disabled:
					var action: Callable = _button_actions[button]
					action.call()
				get_viewport().set_input_as_handled()
			elif camera_mode == "orbit" and event.position.y > 111 and event.position.y < 578:
				_drag_pointer = event.index
				get_viewport().set_input_as_handled()
		elif event.index == _drag_pointer:
			_drag_pointer = -1
			get_viewport().set_input_as_handled()
	elif event is InputEventScreenDrag and event.index == _drag_pointer:
		_orbit_drag(event.relative)
		get_viewport().set_input_as_handled()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_1: set_pose("idle_guard")
			KEY_2: set_pose("step_forward")
			KEY_3: set_pose("step_back")
			KEY_4: set_pose("jab")
			KEY_C: set_camera_mode("orbit" if camera_mode == "side" else "side")
			_: return
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if camera_mode == "orbit" and event.position.y > 111 and event.position.y < 578 and _button_at(event.position) == null:
			_mouse_drag = event.pressed
			get_viewport().set_input_as_handled()
		elif not event.pressed:
			_mouse_drag = false
	elif event is InputEventMouseMotion and _mouse_drag:
		_orbit_drag(event.relative)
		get_viewport().set_input_as_handled()


func _orbit_drag(relative: Vector2) -> void:
	_orbit_angle -= relative.x * 0.008
	_orbit_elevation = clampf(_orbit_elevation + relative.y * 0.005, 0.025, 0.55)
	_update_camera()
