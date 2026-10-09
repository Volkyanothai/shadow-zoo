class_name ZooFighter
extends Node2D

signal attack_active(fighter: ZooFighter)
signal damaged(amount: float, blocked: bool, point: Vector2)

const MAX_HEALTH := 100.0
const MAX_STAMINA := 100.0
const FLOOR_Y := 528.0
const MOVE_SPEED := 245.0
const GRAVITY := 1700.0
const LIGHT_RANGE := 155.0
const HEAVY_RANGE := 180.0

var species := "tiger"
var health := MAX_HEALTH
var stamina := MAX_STAMINA
var facing := 1.0
var state := "idle"
var state_time := 0.0
var move_axis := 0.0
var guard := false
var active := false
var vertical_speed := 0.0
var knockback := 0.0
var attack_kind := "light"
var attack_connected := false
var combo := 0
var combo_window := 0.0
var animation_time := 0.0
var damage_flash := 0.0
var dash_direction := 1.0
var visual: Node2D

func _ready() -> void:
	if species == "tiger" and ResourceLoader.exists("res://assets/fighters/tiger/tiger-atlas.png"):
		var rig_script: Script = load("res://scripts/tiger_visual.gd")
		if rig_script:
			visual = Node2D.new()
			visual.name = "PaintedTiger"
			visual.set_script(rig_script)
			add_child(visual)
			visual.setup(self)

func uses_detailed_art() -> bool:
	return is_instance_valid(visual) and visual.has_art()

func reset_at(at: Vector2) -> void:
	position = at
	health = MAX_HEALTH
	stamina = MAX_STAMINA
	state = "idle"
	state_time = 0.0
	move_axis = 0.0
	guard = false
	vertical_speed = 0.0
	knockback = 0.0
	combo = 0
	combo_window = 0.0
	damage_flash = 0.0
	queue_redraw()

func is_grounded() -> bool:
	return position.y >= FLOOR_Y - 0.5

func can_act() -> bool:
	return active and health > 0.0 and state not in ["attack", "hurt", "dash", "ko"]

func attack(kind: String) -> bool:
	var cost := 12.0 if kind == "light" else 27.0
	if not can_act() or stamina < cost or guard:
		return false
	stamina -= cost
	attack_kind = kind
	state = "attack"
	state_time = 0.0
	attack_connected = false
	combo = (combo % 3) + 1 if combo_window > 0.0 and kind == "light" else 1
	combo_window = 0.85
	return true

func jump() -> bool:
	if not can_act() or not is_grounded() or stamina < 10.0:
		return false
	vertical_speed = -650.0
	stamina -= 10.0
	guard = false
	return true

func dash() -> bool:
	if not can_act() or not is_grounded() or stamina < 22.0:
		return false
	state = "dash"
	state_time = 0.0
	stamina -= 22.0
	dash_direction = move_axis if absf(move_axis) > 0.1 else -facing
	guard = false
	return true

func receive_hit(amount: float, source_x: float, push: float) -> Dictionary:
	if not active or health <= 0.0 or (state == "dash" and state_time < 0.19):
		return {"hit": false, "blocked": false, "damage": 0.0}
	var from_front := (source_x - position.x) * facing > 0.0
	var blocked := guard and can_act() and is_grounded() and from_front
	if blocked:
		var guard_cost := amount * 1.45
		if stamina >= guard_cost:
			stamina -= guard_cost
			amount *= 0.08
			push *= 0.2
		else:
			stamina = 0.0
			blocked = false
			guard = false
			amount *= 1.2
	health = maxf(0.0, health - amount)
	knockback = signf(position.x - source_x) * push
	damage_flash = 0.12
	if not blocked:
		state = "hurt" if health > 0.0 else "ko"
		state_time = 0.0
	damaged.emit(amount, blocked, position + Vector2(0, -125))
	return {"hit": true, "blocked": blocked, "damage": amount}

func _physics_process(delta: float) -> void:
	animation_time += delta
	damage_flash = maxf(0.0, damage_flash - delta)
	if not active:
		queue_redraw()
		return
	state_time += delta
	combo_window = maxf(0.0, combo_window - delta)
	if state == "ko":
		position.x = clampf(position.x + knockback * delta, 95.0, 1185.0)
		knockback = move_toward(knockback, 0.0, 1200.0 * delta)
		vertical_speed += GRAVITY * delta
		position.y = minf(FLOOR_Y, position.y + vertical_speed * delta)
		queue_redraw()
		return
	var regen := 5.0 if guard else 19.0
	if state not in ["attack", "dash"]:
		stamina = minf(MAX_STAMINA, stamina + regen * delta)
	if state == "attack":
		var strike_time := 0.105 if attack_kind == "light" else 0.29
		var duration := 0.33 if attack_kind == "light" else 0.66
		if state_time >= strike_time and not attack_connected:
			attack_connected = true
			attack_active.emit(self)
		if state_time >= duration:
			state = "idle"
	elif state == "hurt":
		if state_time >= 0.24:
			state = "idle"
	elif state == "dash":
		position.x += dash_direction * 610.0 * delta
		if state_time >= 0.26:
			state = "idle"
	else:
		var speed := MOVE_SPEED * (0.34 if guard else 1.0)
		position.x += move_axis * speed * delta
		state = "guard" if guard and is_grounded() else ("run" if absf(move_axis) > 0.1 else "idle")
	position.x = clampf(position.x + knockback * delta, 95.0, 1185.0)
	knockback = move_toward(knockback, 0.0, 1350.0 * delta)
	if not is_grounded() or vertical_speed < 0.0:
		vertical_speed += GRAVITY * delta
		position.y += vertical_speed * delta
		if position.y >= FLOOR_Y:
			position.y = FLOOR_Y
			vertical_speed = 0.0
	queue_redraw()

func _limb(a: Vector2, b: Vector2, width: float, color: Color) -> void:
	draw_line(a, b, Color("09151f"), width + 5.0, true)
	draw_circle(a, width * 0.5 + 2.0, Color("09151f"))
	draw_circle(b, width * 0.5 + 2.0, Color("09151f"))
	draw_line(a, b, color, width, true)
	draw_circle(b, width * 0.5, color)
	draw_line(a + Vector2(-2, -3), b + Vector2(-2, -3), color.lightened(0.2), 3.0, true)

func _poly(points: Array, color: Color) -> void:
	draw_colored_polygon(PackedVector2Array(points), color)

func _draw() -> void:
	if uses_detailed_art():
		return
	var fur := Color("d99a53") if species == "tiger" else Color("8daab3")
	var light_fur := Color("f1d6a7") if species == "tiger" else Color("dbe5df")
	var dark_fur := Color("71482c") if species == "tiger" else Color("526c80")
	var cloth := Color("172732")
	var trim := Color("b2a083")
	var scarf := Color("c95d3f") if species == "tiger" else Color("4ba5a5")
	if damage_flash > 0.0:
		fur = fur.lerp(Color.WHITE, 0.6)
	draw_set_transform(Vector2(0, FLOOR_Y - position.y + 4), 0, Vector2(1, 0.22))
	draw_circle(Vector2.ZERO, 67, Color(0.0, 0.01, 0.03, 0.36))
	draw_set_transform(Vector2.ZERO, 0, Vector2(facing, 1))
	if state == "ko":
		draw_set_transform(Vector2(0, -13), -minf(state_time * 4.8, PI * 0.5) * facing, Vector2(facing, 1))
	var breath := sin(animation_time * 3.6) * 2.0
	var stride := sin(animation_time * 11.0) if state == "run" else 0.0
	var lean := move_axis * facing * 5.0 if state == "run" else 0.0
	var strike := 0.0
	if state == "attack":
		var hit_time := 0.105 if attack_kind == "light" else 0.29
		strike = clampf(1.0 - absf(state_time - hit_time - 0.025) / (0.15 if attack_kind == "light" else 0.25), 0.0, 1.0)
		lean += strike * (17.0 if attack_kind == "light" else -15.0)
	if state == "hurt":
		lean -= 15.0
	var hip := Vector2(lean * 0.35, -84)
	var shoulder := Vector2(lean, -145 + breath)
	var head := shoulder + Vector2(6, -33)
	var back_knee := Vector2(-27 - stride * 25, -42)
	var back_foot := Vector2(-44 - stride * 31, -6)
	var front_knee := Vector2(27 + stride * 25, -42)
	var front_foot := Vector2(43 + stride * 31, -6)
	if not is_grounded():
		back_knee.y -= 18
		back_foot += Vector2(12, -36)
		front_foot += Vector2(-8, -25)
	if state == "attack" and attack_kind == "heavy":
		front_knee = front_knee.lerp(Vector2(46, -112), strike)
		front_foot = front_foot.lerp(Vector2(151, -123), strike)
	# Tail and scarf trail behind the silhouette.
	var tail := PackedVector2Array()
	for i in range(15):
		var t := float(i) / 14.0
		tail.append(hip + Vector2(-12 - 81 * t, 6 - sin(t * PI) * 22 + sin(animation_time * 3 + t * 4) * t * 10))
	draw_polyline(tail, Color("09151f"), 17, true)
	draw_polyline(tail, fur, 12, true)
	if species == "tiger":
		for i in range(3, 14, 3):
			draw_line(tail[i] + Vector2(0, -5), tail[i] + Vector2(0, 5), Color("26313a"), 5, true)
	else:
		draw_polyline(PackedVector2Array([tail[9], tail[11], tail[14]]), dark_fur, 15, true)
	var flap := sin(animation_time * 5) * 8
	_poly([shoulder + Vector2(-8, -8), shoulder + Vector2(-81, 8 + flap), shoulder + Vector2(-64, 17 + flap), shoulder + Vector2(-10, 5)], scarf.darkened(0.2))
	_limb(hip + Vector2(-10, 0), back_knee, 24, cloth.darkened(0.22))
	_limb(back_knee, back_foot, 20, dark_fur.darkened(0.1))
	_limb(back_foot + Vector2(-4, 0), back_foot + Vector2(18, 0), 15, Color("111e29"))
	var back_elbow := shoulder + Vector2(-32, 29)
	var back_hand := shoulder + Vector2(-15, 9)
	if guard:
		back_elbow += Vector2(34, -8)
		back_hand += Vector2(45, -30)
	_limb(shoulder + Vector2(-13, 4), back_elbow, 19, dark_fur)
	_limb(back_elbow, back_hand, 16, fur.darkened(0.1))
	draw_circle(back_hand, 11, trim.darkened(0.15))
	_poly([shoulder + Vector2(-22, 2), shoulder + Vector2(20, 3), hip + Vector2(24, -5), hip + Vector2(13, 14), hip + Vector2(-23, 9)], fur)
	_poly([shoulder + Vector2(-9, 4), shoulder + Vector2(10, 5), hip + Vector2(13, 3), hip + Vector2(-7, 4)], light_fur)
	# Cross-body harness and waist sash.
	draw_line(shoulder + Vector2(-19, 4), hip + Vector2(17, 0), cloth, 12, true)
	draw_line(shoulder + Vector2(20, 6), hip + Vector2(-13, 3), cloth, 10, true)
	_poly([hip + Vector2(-27, -3), hip + Vector2(26, -3), hip + Vector2(22, 12), hip + Vector2(-24, 12)], scarf)
	_poly([hip + Vector2(7, 9), hip + Vector2(24, 9), hip + Vector2(16 + flap * 0.3, 61), hip + Vector2(4, 48)], scarf.darkened(0.15))
	draw_rect(Rect2(hip + Vector2(-5, -1), Vector2(12, 10)), Color("e2bf75"))
	_limb(hip + Vector2(12, 5), front_knee, 27, cloth)
	_limb(front_knee, front_foot, 22, fur.darkened(0.23))
	for t in [0.35, 0.48, 0.61, 0.74]:
		var wrap: Vector2 = front_knee.lerp(front_foot, t)
		draw_line(wrap + Vector2(-9, -2), wrap + Vector2(9, 2), trim, 4, true)
	_limb(front_foot + Vector2(-3, 0), front_foot + Vector2(22, 0), 16, Color("182932"))
	# Angular animal head, muzzle, ears and expressive glowing eye.
	_poly([head + Vector2(-23, -7), head + Vector2(-27, -31), head + Vector2(-9, -22), head + Vector2(9, -20), head + Vector2(17, -30), head + Vector2(24, -14), head + Vector2(22, 3), head + Vector2(37, 8), head + Vector2(30, 22), head + Vector2(8, 27), head + Vector2(-20, 17), head + Vector2(-29, 2)], Color("09151f"))
	_poly([head + Vector2(-21, -7), head + Vector2(-23, -26), head + Vector2(-8, -17), head + Vector2(10, -16), head + Vector2(17, -25), head + Vector2(20, -10), head + Vector2(17, 4), head + Vector2(33 if species == "tiger" else 43, 10), head + Vector2(27, 19), head + Vector2(7, 23), head + Vector2(-18, 13), head + Vector2(-25, 1)], fur)
	_poly([head + Vector2(-19, -19), head + Vector2(-17, -9), head + Vector2(-10, -14)], dark_fur)
	_poly([head + Vector2(11, 6), head + Vector2(33 if species == "tiger" else 43, 10), head + Vector2(26, 18), head + Vector2(9, 21), head + Vector2(-1, 12)], light_fur)
	_poly([head + Vector2(30 if species == "tiger" else 38, 8), head + Vector2(38 if species == "tiger" else 45, 10), head + Vector2(30, 14)], Color("0b1822"))
	draw_line(head + Vector2(11, 0), head + Vector2(24, -1), Color("09151f"), 8, true)
	draw_line(head + Vector2(13, 1), head + Vector2(23, 0), Color("fff3cd") if species == "tiger" else Color("c2fff1"), 3, true)
	draw_line(head + Vector2(15, 16), head + Vector2(28, 15), Color("26323a"), 2, true)
	if species == "tiger":
		for offset in [-13.0, -2.0, 8.0]:
			_poly([head + Vector2(offset - 5, -15), head + Vector2(offset + 3, -16), head + Vector2(offset - 1, -5)], Color("26313a"))
		for offset in [0.0, 11.0]:
			draw_line(head + Vector2(-21, offset), head + Vector2(-10, offset + 4), Color("26313a"), 4, true)
	else:
		_poly([head + Vector2(-23, -4), head + Vector2(-10, -12), head + Vector2(11, -13), head + Vector2(10, -4), head + Vector2(-8, 7)], dark_fur)
		draw_line(head + Vector2(13, 1), head + Vector2(23, 0), Color("c2fff1"), 3, true)
	# Leading arm, fist and claw trails.
	var front_elbow := shoulder + Vector2(36, 25)
	var front_hand := shoulder + Vector2(49, -5)
	if guard:
		front_elbow = shoulder + Vector2(31, 6)
		front_hand = shoulder + Vector2(30, -26)
	if state == "attack" and attack_kind == "light":
		front_elbow = front_elbow.lerp(shoulder + Vector2(68, 4), strike)
		front_hand = front_hand.lerp(shoulder + Vector2(135, -1 + (combo - 1) * 7), strike)
	_limb(shoulder + Vector2(16, 5), front_elbow, 22, fur)
	_limb(front_elbow, front_hand, 19, fur)
	var band := front_elbow.lerp(front_hand, 0.77)
	draw_line(band + Vector2(-6, -9), band + Vector2(6, 9), trim, 8, true)
	draw_circle(front_hand, 12, trim)
	draw_line(front_hand + Vector2(3, -7), front_hand + Vector2(9, 1), Color("fff0c9"), 2, true)
	if strike > 0.55:
		var end := front_hand if attack_kind == "light" else front_foot
		for i in range(3):
			draw_line(end + Vector2(-35, i * 6 - 9), end + Vector2(18, i * 6 - 14), Color(fur, strike * 0.75), 2, true)
	draw_set_transform(Vector2.ZERO)
