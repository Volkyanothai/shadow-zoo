class_name TigerVisual
extends Node2D
## Painted, native 2D rig. The fighter remains the authority for movement and hits.
## Atlas pieces are read in memory; source artwork is never cropped or rewritten.

const ATLAS_PATH := "res://assets/fighters/tiger/tiger-atlas.png"
const REGIONS_PATH := "res://assets/fighters/tiger/tiger-atlas.regions.json"
const PIECE_NAMES := [
	"head", "torso", "pelvis", "tail",
	"front_upper_arm", "front_forearm", "front_hand", "back_upper_arm",
	"back_forearm", "back_hand", "front_thigh", "front_shin",
	"front_foot", "back_thigh", "back_shin", "back_foot",
]
const ARM_UPPER := 52.0
const ARM_LOWER := 53.0
const LEG_UPPER := 58.0
const LEG_LOWER := 56.0
const FLOOR_Y := 528.0

var fighter = null
# Public read-only-by-convention inspection data for captures and rig validation.
var parts: Dictionary = {}
var joint_positions: Dictionary = {}
var pose_name := "idle"
var pose_phase := 0.0
var atlas_texture: Texture2D
var bounds_source := "runtime_alpha"
var _pose: Dictionary = {}
var _desired_pose: Dictionary = {}
var _piece_overrides: Dictionary = {}
var _pose_overrides: Dictionary = {}
var _facing := 1.0
var _ko_angle := 0.0
var _ko_offset := Vector2.ZERO
var _trail_strength := 0.0
var _trail_points := PackedVector2Array()
var _flash := 0.0
var _last_load_attempt := -10.0
var _time := 0.0
var _transition_remaining := 0.0
var _previous_pose_name := ""
var _previous_attack_id := ""

func setup(owner_fighter) -> void:
	fighter = owner_fighter
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	_load_atlas()
	sync_from_fighter(true)

func _ready() -> void:
	if fighter == null:
		setup(get_parent())

func has_art() -> bool:
	return atlas_texture != null and parts.size() == PIECE_NAMES.size()

## Replaces one piece with an already prepared, transparent painting. This is useful
## for hands, heads or a torso whose shape changes too far for skeletal animation.
func set_piece_texture(piece_name: String, texture: Texture2D) -> void:
	if texture == null:
		_piece_overrides.erase(piece_name)
	else:
		_piece_overrides[piece_name] = _texture_part(texture)
	queue_redraw()

## Optional per-pose paintings, e.g. set_pose_texture("heavy", "head", texture).
## Supported poses are idle, run, guard, light_1/2/3, heavy, hurt, dash, jump and ko.
func set_pose_texture(for_pose: String, piece_name: String, texture: Texture2D) -> void:
	if not _pose_overrides.has(for_pose):
		_pose_overrides[for_pose] = {}
	if texture == null:
		_pose_overrides[for_pose].erase(piece_name)
	else:
		_pose_overrides[for_pose][piece_name] = _texture_part(texture)
	queue_redraw()

func _load_atlas() -> void:
	if has_art() or not ResourceLoader.exists(ATLAS_PATH):
		return
	atlas_texture = load(ATLAS_PATH) as Texture2D
	if atlas_texture == null:
		return
	var image_size := Vector2i(atlas_texture.get_width(), atlas_texture.get_height())
	if _load_regions(image_size):
		return
	var source_image := atlas_texture.get_image()
	if source_image == null or source_image.is_empty():
		atlas_texture = null
		return
	if source_image.is_compressed():
		source_image.decompress()
	for index in range(PIECE_NAMES.size()):
		var cell := _cell_rect(index, image_size)
		var occupied := _alpha_bounds(source_image.get_region(cell))
		if occupied.size.x < 2 or occupied.size.y < 2:
			parts.clear()
			atlas_texture = null
			return
		var region := Rect2(Vector2(cell.position + occupied.position), Vector2(occupied.size))
		_append_part(PIECE_NAMES[index], cell, region)

func _cell_rect(index: int, image_size: Vector2i) -> Rect2i:
	var column := index % 4
	var row := index / 4
	var start := Vector2i(int(float(column) * image_size.x / 4.0), int(float(row) * image_size.y / 4.0))
	var finish := Vector2i(int(float(column + 1) * image_size.x / 4.0), int(float(row + 1) * image_size.y / 4.0))
	return Rect2i(start, finish - start)

func _append_part(piece_name: String, cell: Rect2i, region: Rect2) -> void:
	var texture := AtlasTexture.new()
	texture.atlas = atlas_texture
	texture.region = region
	texture.filter_clip = true
	parts[piece_name] = {
		"texture": texture, "region": region, "cell": cell,
		"size": region.size, "aspect": region.size.x / region.size.y,
	}

func _load_regions(image_size: Vector2i) -> bool:
	# Offline alpha analysis can be supplied beside the untouched painting. This
	# avoids GPU texture readback and millions of script pixel reads on tablets.
	if not FileAccess.file_exists(REGIONS_PATH):
		return false
	var metadata = JSON.parse_string(FileAccess.get_file_as_string(REGIONS_PATH))
	if not metadata is Dictionary:
		return false
	var recorded_size = metadata.get("image_size", [])
	var regions = metadata.get("regions", {})
	if not recorded_size is Array or recorded_size.size() != 2 or not regions is Dictionary:
		return false
	if Vector2i(int(recorded_size[0]), int(recorded_size[1])) != image_size:
		return false
	var validated: Array[Rect2] = []
	for index in range(PIECE_NAMES.size()):
		var values = regions.get(PIECE_NAMES[index], [])
		if not values is Array or values.size() != 4:
			return false
		var region := Rect2(float(values[0]), float(values[1]), float(values[2]), float(values[3]))
		var cell := Rect2(_cell_rect(index, image_size))
		if region.size.x < 2 or region.size.y < 2 or not cell.encloses(region):
			return false
		validated.append(region)
	for index in range(PIECE_NAMES.size()):
		_append_part(PIECE_NAMES[index], _cell_rect(index, image_size), validated[index])
	bounds_source = "metadata"
	return true

func _alpha_bounds(image: Image) -> Rect2i:
	var initial := image.get_used_rect()
	var first := Vector2i(image.get_width(), image.get_height())
	var last := Vector2i(-1, -1)
	for y in range(initial.position.y, initial.end.y):
		for x in range(initial.position.x, initial.end.x):
			if image.get_pixel(x, y).a >= 0.15:
				first.x = mini(first.x, x)
				first.y = mini(first.y, y)
				last.x = maxi(last.x, x)
				last.y = maxi(last.y, y)
	if last.x < 0:
		return Rect2i()
	return Rect2i(first, last - first + Vector2i.ONE)

func _texture_part(texture: Texture2D) -> Dictionary:
	var size := texture.get_size()
	return {"texture": texture, "region": Rect2(Vector2.ZERO, size), "size": size,
		"aspect": size.x / maxf(size.y, 1.0)}

func _process(delta: float) -> void:
	_time += delta
	if not has_art() and _time - _last_load_attempt > 1.0:
		_last_load_attempt = _time
		_load_atlas()
	if fighter == null or not is_instance_valid(fighter):
		return
	_update_pose(delta, false)
	queue_redraw()

## Deterministic entry point: set fighter fields, then call this before a capture.
func sync_from_fighter(immediate: bool = true) -> void:
	if fighter == null or not is_instance_valid(fighter):
		return
	_update_pose(0.0, immediate)
	queue_redraw()

func _update_pose(delta: float, immediate: bool) -> void:
	_facing = 1.0 if float(fighter.facing) >= 0.0 else -1.0
	_flash = clampf(float(fighter.damage_flash) / 0.12, 0.0, 1.0)
	_desired_pose = _sample_pose()
	var attack_id := str(fighter.combo) + ":" + str(fighter.attack_kind) if str(fighter.state) == "attack" else ""
	if pose_name != _previous_pose_name or attack_id != _previous_attack_id:
		_transition_remaining = 0.045 if str(fighter.state) == "attack" else 0.08
		_previous_pose_name = pose_name
		_previous_attack_id = attack_id
	if immediate or _pose.is_empty():
		_pose = _desired_pose.duplicate()
		_transition_remaining = 0.0
	else:
		var blend := 1.0
		if _transition_remaining > 0.0:
			blend = minf(1.0, delta / maxf(_transition_remaining, 0.001))
			_transition_remaining = maxf(0.0, _transition_remaining - delta)
		for key in _desired_pose:
			if _desired_pose[key] is Vector2:
				_pose[key] = (_pose.get(key, _desired_pose[key]) as Vector2).lerp(_desired_pose[key], blend)
			else:
				_pose[key] = lerpf(float(_pose.get(key, _desired_pose[key])), float(_desired_pose[key]), blend)
	_resolve_joints()

func _sample_pose() -> Dictionary:
	var animation_time: float = fighter.animation_time
	var state_time: float = fighter.state_time
	var state: String = fighter.state
	var breath := sin(animation_time * 3.15) * 1.5
	var pose := {
		"pelvis": Vector2(0, -101 + breath * 0.32),
		"torso": Vector2(3, -154 + breath),
		"head": Vector2(10, -208 + breath),
		"front_shoulder": Vector2(23, -176 + breath),
		"back_shoulder": Vector2(-18, -176 + breath),
		"front_wrist": Vector2(65, -166 + breath),
		"back_wrist": Vector2(8, -163 + breath),
		"front_ankle": Vector2(43, -11),
		"back_ankle": Vector2(-42, -11),
		"torso_angle": -0.045,
		"head_angle": 0.035,
		"front_hand_angle": -0.3,
		"back_hand_angle": -0.28,
		"front_foot_angle": 0.0,
		"back_foot_angle": 0.0,
		"tail_angle": 0.4 + sin(animation_time * 2.4) * 0.07,
	}
	pose_name = state
	pose_phase = 0.0
	_trail_strength = 0.0
	_ko_angle = 0.0
	_ko_offset = Vector2.ZERO
	if state == "run":
		var phase := animation_time * 10.8
		var direction := float(fighter.move_axis) * _facing
		var stride := sin(phase)
		var pelvis_drop := absf(cos(phase)) * 3.2
		pose["pelvis"] += Vector2(direction * 3, pelvis_drop)
		pose["torso"] += Vector2(direction * 7, pelvis_drop)
		pose["head"] += Vector2(direction * 8, pelvis_drop)
		pose["front_shoulder"] += Vector2(direction * 6, pelvis_drop)
		pose["back_shoulder"] += Vector2(direction * 6, pelvis_drop)
		pose["front_ankle"] = Vector2(22 + stride * 38, -11 - maxf(0, cos(phase)) * 21)
		pose["back_ankle"] = Vector2(-22 - stride * 38, -11 - maxf(0, -cos(phase)) * 21)
		pose["front_wrist"] += Vector2(-stride * 9 + direction * 5, stride * 5)
		pose["back_wrist"] += Vector2(stride * 9 + direction * 5, -stride * 5)
		pose["torso_angle"] = -0.09 * direction
		pose["tail_angle"] = 0.44 - direction * 0.1 + sin(phase * 0.5) * 0.11
	elif state == "guard" or bool(fighter.guard):
		pose_name = "guard"
		_shift_upper(pose, Vector2(-5, 5))
		pose["front_wrist"] = Vector2(39, -203)
		pose["back_wrist"] = Vector2(18, -196)
		pose["front_hand_angle"] = 0.0
		pose["back_hand_angle"] = -0.1
		pose["head_angle"] = -0.13
		pose["front_ankle"] += Vector2(5, 0)
		pose["back_ankle"] += Vector2(-4, 0)
	elif state == "attack":
		if str(fighter.attack_kind) == "heavy":
			_sample_heavy(pose, state_time)
		else:
			_sample_light(pose, state_time, int(fighter.combo))
	elif state == "hurt":
		var recoil := sin(clampf(state_time / 0.24, 0, 1) * PI)
		_shift_upper(pose, Vector2(-19 * recoil, 8 * recoil))
		pose["front_wrist"] += Vector2(-10, 14) * recoil
		pose["back_wrist"] += Vector2(-12, 9) * recoil
		pose["torso_angle"] = 0.2 * recoil
		pose["head_angle"] = -0.18 * recoil
	elif state == "dash":
		var dash_forward: float = fighter.dash_direction * _facing
		_shift_upper(pose, Vector2(dash_forward * 24, 21))
		pose["pelvis"] += Vector2(dash_forward * 9, 12)
		pose["front_wrist"] += Vector2(-dash_forward * 19, 17)
		pose["back_wrist"] += Vector2(-dash_forward * 12, 19)
		pose["front_ankle"] += Vector2(dash_forward * 20, 0)
		pose["back_ankle"] += Vector2(-dash_forward * 24, 0)
		pose["torso_angle"] = -dash_forward * 0.22
		pose["tail_angle"] = 0.56 - dash_forward * 0.12
	elif state == "ko":
		var fall := _smooth(clampf(state_time / 0.42, 0, 1))
		_ko_angle = -1.50 * fall
		_ko_offset = Vector2(-20 * fall, -18 * fall)
		pose["front_wrist"] = Vector2(58, -128)
		pose["back_wrist"] = Vector2(-34, -135)
		pose["front_ankle"] = Vector2(36, -14)
		pose["back_ankle"] = Vector2(-27, -18)
		pose["head_angle"] = -0.14
	if not bool(fighter.is_grounded()) and state != "ko":
		if state != "attack":
			pose_name = "jump"
		var rise := clampf(-float(fighter.vertical_speed) / 650.0, -1, 1)
		pose["front_ankle"] += Vector2(-10, -38 - rise * 8)
		pose["back_ankle"] += Vector2(14, -51 + rise * 7)
		pose["pelvis"] += Vector2(0, 3)
		if state != "attack":
			pose["front_wrist"] += Vector2(3, -18)
			pose["back_wrist"] += Vector2(-13, -17)
			pose["tail_angle"] += 0.14
	return pose

func _sample_light(pose: Dictionary, time: float, chain: int) -> void:
	chain = clampi(chain, 1, 3)
	pose_name = "light_%d" % chain
	pose_phase = clampf(time / 0.33, 0.0, 1.0)
	var wind := _smooth(clampf(time / 0.055, 0, 1)) * (1 - _smooth(clampf((time - 0.045) / 0.045, 0, 1)))
	var strike := _smooth(clampf((time - 0.048) / 0.057, 0, 1)) * (1 - _smooth(clampf((time - 0.135) / 0.18, 0, 1)))
	var rotation := 0.0
	if chain == 1:
		_shift_upper(pose, Vector2(-7 * wind + 13 * strike, 0))
		pose["front_wrist"] = (pose["front_wrist"] as Vector2).lerp(Vector2(143, -180), strike)
		pose["front_wrist"] += Vector2(-18, -3) * wind
		pose["back_wrist"] = (pose["back_wrist"] as Vector2).lerp(Vector2(27, -180), strike)
		pose["front_hand_angle"] = -1.4 * strike - 0.3
		rotation = -0.1 * strike
	elif chain == 2:
		_shift_upper(pose, Vector2(-5 * wind + 18 * strike, 3 * strike))
		pose["back_shoulder"] += Vector2(17 * strike, 0)
		pose["back_wrist"] = (pose["back_wrist"] as Vector2).lerp(Vector2(126, -160), strike)
		pose["back_wrist"] += Vector2(-20, -12) * wind
		pose["front_wrist"] = (pose["front_wrist"] as Vector2).lerp(Vector2(41, -190), strike)
		pose["back_hand_angle"] = -1.55 * strike - 0.28
		rotation = -0.19 * strike
	else:
		_shift_upper(pose, Vector2(-5 * wind + 11 * strike, 8 * wind - 8 * strike))
		pose["front_wrist"] = (pose["front_wrist"] as Vector2).lerp(Vector2(111, -226), strike)
		pose["front_wrist"] += Vector2(-12, 25) * wind
		pose["back_wrist"] = (pose["back_wrist"] as Vector2).lerp(Vector2(36, -168), strike)
		pose["front_hand_angle"] = -0.8 * strike - 0.3
		pose["head_angle"] = -0.08 * strike
		rotation = -0.12 * strike
	pose["pelvis"] += Vector2(5 * strike, 3 * wind)
	pose["torso_angle"] = rotation
	pose["front_ankle"] += Vector2(5 * strike, 0)
	pose["back_foot_angle"] = -0.08 * strike
	_trail_strength = sin(clampf((time - 0.065) / 0.11, 0, 1) * PI) * 0.62

func _sample_heavy(pose: Dictionary, time: float) -> void:
	pose_name = "heavy"
	pose_phase = clampf(time / 0.66, 0, 1)
	var chamber := _smooth(clampf(time / 0.15, 0, 1)) * (1 - _smooth(clampf((time - 0.16) / 0.15, 0, 1)))
	var kick := _smooth(clampf((time - 0.15) / 0.14, 0, 1)) * (1 - _smooth(clampf((time - 0.36) / 0.26, 0, 1)))
	_shift_upper(pose, Vector2(-15 * chamber - 24 * kick, 5 * chamber))
	pose["pelvis"] += Vector2(-4 * kick, -2 * kick)
	pose["front_ankle"] = (pose["front_ankle"] as Vector2).lerp(Vector2(66, -108), chamber)
	pose["front_ankle"] = (pose["front_ankle"] as Vector2).lerp(Vector2(140, -113), kick)
	pose["front_foot_angle"] = -1.37 * kick - 0.22 * chamber
	pose["front_wrist"] = (pose["front_wrist"] as Vector2).lerp(Vector2(29, -188), kick)
	pose["back_wrist"] = (pose["back_wrist"] as Vector2).lerp(Vector2(-51, -151), kick)
	pose["torso_angle"] = 0.24 * kick
	pose["head_angle"] = -0.12 * kick
	pose["tail_angle"] += 0.18 * kick
	_trail_strength = sin(clampf((time - 0.23) / 0.16, 0, 1) * PI) * 0.42

func _shift_upper(pose: Dictionary, offset: Vector2) -> void:
	for key in ["torso", "head", "front_shoulder", "back_shoulder", "front_wrist", "back_wrist"]:
		pose[key] += offset

func _smooth(value: float) -> float:
	return value * value * (3.0 - 2.0 * value)

## Analytic two-bone IK; tips are clamped to physical reach rather than stretched.
func _two_bone(root: Vector2, target: Vector2, upper: float, lower: float, bend: float) -> Array[Vector2]:
	var offset := target - root
	var distance := clampf(offset.length(), absf(upper - lower) + 0.1, upper + lower - 0.5)
	var direction := offset.normalized() if offset.length_squared() > 0.01 else Vector2.DOWN
	var along := (upper * upper - lower * lower + distance * distance) / (2.0 * distance)
	var away := sqrt(maxf(0, upper * upper - along * along))
	var elbow := root + direction * along + Vector2(-direction.y, direction.x) * away * bend
	return [root, elbow, root + direction * distance]

func _resolve_joints() -> void:
	joint_positions.clear()
	for key in ["head", "torso", "pelvis", "front_shoulder", "back_shoulder"]:
		joint_positions[key] = _pose[key]
	var pelvis: Vector2 = _pose["pelvis"]
	for side in ["back", "front"]:
		var shoulder: Vector2 = _pose[side + "_shoulder"]
		var wrist: Vector2 = _pose[side + "_wrist"]
		var arm := _two_bone(shoulder, wrist, ARM_UPPER, ARM_LOWER, 1.0)
		joint_positions[side + "_elbow"] = arm[1]
		joint_positions[side + "_wrist"] = arm[2]
		var hip := pelvis + Vector2(-14 if side == "back" else 14, 2)
		var ankle: Vector2 = _pose[side + "_ankle"]
		var leg := _two_bone(hip, ankle, LEG_UPPER, LEG_LOWER, 1.0 if side == "back" else -1.0)
		joint_positions[side + "_hip"] = hip
		joint_positions[side + "_knee"] = leg[1]
		joint_positions[side + "_ankle"] = leg[2]
	_trail_points = PackedVector2Array()
	if _trail_strength > 0.01:
		var side := "back" if pose_name == "light_2" else "front"
		var tip: Vector2 = joint_positions[side + "_wrist"] if pose_name != "heavy" else joint_positions["front_ankle"]
		var root: Vector2 = joint_positions[side + "_shoulder"] if pose_name != "heavy" else joint_positions["front_hip"]
		var direction := (tip - root).normalized()
		for index in range(9):
			var fraction := float(index) / 8.0
			var curve := Vector2(-direction.y, direction.x) * sin(fraction * PI) * 8.0
			_trail_points.append(tip - direction * (45.0 * (1.0 - fraction)) + curve)

func _draw() -> void:
	if not has_art() or _pose.is_empty() or fighter == null:
		return
	# Shadow stays on the floor when the fighter jumps. It does not inherit facing.
	var height := maxf(0, FLOOR_Y - float(fighter.position.y))
	var radius := clampf(56.0 - height * 0.055, 28, 56)
	var shadow_y := FLOOR_Y - float(fighter.position.y) + 3
	draw_set_transform(Vector2(0, shadow_y), 0, Vector2(1, 0.2))
	draw_circle(Vector2.ZERO, radius, Color(0.005, 0.015, 0.025, 0.25))
	draw_circle(Vector2.ZERO, radius * 0.65, Color(0.005, 0.01, 0.018, 0.17))
	draw_set_transform(_ko_offset, _ko_angle * _facing, Vector2(_facing, 1))
	_draw_tail()
	_draw_leg("back", Color(0.76, 0.83, 0.87))
	_draw_arm("back", Color(0.81, 0.86, 0.89))
	_draw_part("torso", joint_positions["torso"], 92, float(_pose["torso_angle"]), Color.WHITE)
	_draw_part("pelvis", joint_positions["pelvis"] + Vector2(0, 5), 54, float(_pose["torso_angle"]) * 0.4, Color.WHITE)
	_draw_leg("front", Color.WHITE)
	_draw_part("head", joint_positions["head"], 64, float(_pose["head_angle"]), Color.WHITE)
	_draw_arm("front", Color.WHITE)
	_draw_claws()
	draw_set_transform(Vector2.ZERO)

func _art_for(piece_name: String) -> Dictionary:
	if _pose_overrides.has(pose_name) and _pose_overrides[pose_name].has(piece_name):
		return _pose_overrides[pose_name][piece_name]
	return _piece_overrides.get(piece_name, parts.get(piece_name, {}))

func _tint(color: Color) -> Color:
	return color.lerp(Color(1.25, 1.2, 1.08, 1), _flash * 0.34)

func _draw_part(piece_name: String, center: Vector2, height: float, angle: float, color: Color, pivot := Vector2(0.5, 0.5)) -> void:
	var art := _art_for(piece_name)
	if art.is_empty():
		return
	var size := Vector2(height * float(art["aspect"]), height)
	# Applying the rig's mirror once keeps all art and IK coordinates consistent.
	var transform := Transform2D(_ko_angle * _facing, Vector2(_facing, 1), 0.0, _ko_offset)
	transform = transform * Transform2D(angle, center)
	draw_set_transform_matrix(transform)
	draw_texture_rect(art["texture"], Rect2(-size * pivot, size), false, _tint(color))

func _draw_bone(piece_name: String, start: Vector2, end: Vector2, color: Color) -> void:
	var axis := end - start
	# 12% overlap at both joint ends hides joins without scaling the bone length.
	var height := axis.length() / 0.76
	_draw_part(piece_name, start, height, axis.angle() - PI * 0.5, color, Vector2(0.5, 0.12))

func _draw_arm(side: String, color: Color) -> void:
	var shoulder: Vector2 = joint_positions[side + "_shoulder"]
	var elbow: Vector2 = joint_positions[side + "_elbow"]
	var wrist: Vector2 = joint_positions[side + "_wrist"]
	_draw_bone(side + "_upper_arm", shoulder, elbow, color)
	_draw_bone(side + "_forearm", elbow, wrist, color)
	_draw_part(side + "_hand", wrist, 31, float(_pose[side + "_hand_angle"]), color, Vector2(0.5, 0.2))

func _draw_leg(side: String, color: Color) -> void:
	var hip: Vector2 = joint_positions[side + "_hip"]
	var knee: Vector2 = joint_positions[side + "_knee"]
	var ankle: Vector2 = joint_positions[side + "_ankle"]
	_draw_bone(side + "_thigh", hip, knee, color)
	_draw_bone(side + "_shin", knee, ankle, color)
	_draw_part(side + "_foot", ankle + Vector2(4, 0), 28, float(_pose[side + "_foot_angle"]), color, Vector2(0.42, 0.58))

func _draw_tail() -> void:
	var hip: Vector2 = joint_positions["pelvis"]
	# Tail painting is upright; rotate its long axis behind the body.
	_draw_part("tail", hip + Vector2(-13, 6), 100, 1.1 + float(_pose["tail_angle"]), Color(0.84, 0.87, 0.89), Vector2(0.5, 0.12))

func _draw_claws() -> void:
	if _trail_points.size() < 2 or _trail_strength <= 0.01:
		return
	# Restore mirrored character transform after individual part transforms.
	draw_set_transform(_ko_offset, _ko_angle * _facing, Vector2(_facing, 1))
	for lane in range(3):
		var offset := Vector2(0, (lane - 1) * 5.0)
		var points := PackedVector2Array()
		for point in _trail_points:
			points.append(point + offset)
		draw_polyline(points, Color(0.95, 0.56, 0.16, _trail_strength * 0.18), 6, true)
		draw_polyline(points, Color(1.0, 0.83, 0.43, _trail_strength * 0.65), 1.3, true)
