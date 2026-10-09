extends Node2D

const FighterScript := preload("res://scripts/fighter.gd")
const ArenaScript := preload("res://scripts/arena.gd")
const TouchScript := preload("res://scripts/touch_pad.gd")
const EffectsScript := preload("res://scripts/effects.gd")
const AudioScript := preload("res://scripts/audio.gd")
const GOLD := Color("e1bc79")
const IVORY := Color("e9ead8")
const MUTED := Color("93b3b6")

var font: Font = preload("res://assets/fonts/Rajdhani-SemiBold.ttf")
var world: Node2D
var player: ZooFighter
var bot: ZooFighter
var pad: Node2D
var effects: Node2D
var audio: Node
var mode := "menu"
var previous_mode := "fight"
var clock := 0.0
var round_time := 60.0
var mode_time := 0.0
var round_number := 1
var player_wins := 0
var bot_wins := 0
var round_winner := ""
var bot_enabled := true
var bot_timer := 0.0
var hit_stop := 0.0
var shake := 0.0
var banner := ""
var banner_time := 0.0
var health_display := Vector2(100, 100)
var rng := RandomNumberGenerator.new()
var study_pose := "idle"
var study_time := 0.0
var model_study: Node3D

const PAINTED_PREVIEW_BUTTON := Rect2(294, 615, 320, 46)
const MODEL_PREVIEW_BUTTON := Rect2(636, 615, 350, 46)

const STUDY_BUTTONS := {
	"idle": Rect2(276, 617, 166, 54),
	"walk": Rect2(460, 617, 166, 54),
	"combo": Rect2(644, 617, 166, 54),
	"guard": Rect2(828, 617, 166, 54)
}

func _ready() -> void:
	# Handle Android Back here; its default SceneTree behavior would quit even
	# after the character studio restores the menu.
	get_tree().quit_on_go_back = false
	rng.randomize()
	world = Node2D.new()
	add_child(world)
	var arena := Node2D.new()
	arena.set_script(ArenaScript)
	world.add_child(arena)
	effects = Node2D.new()
	effects.set_script(EffectsScript)
	player = FighterScript.new()
	player.species = "tiger"
	player.reset_at(Vector2(405, ZooFighter.FLOOR_Y))
	player.facing = 1
	world.add_child(player)
	bot = FighterScript.new()
	bot.species = "wolf"
	bot.reset_at(Vector2(875, ZooFighter.FLOOR_Y))
	bot.facing = -1
	world.add_child(bot)
	world.add_child(effects)
	player.attack_active.connect(_on_strike)
	bot.attack_active.connect(_on_strike)
	player.damaged.connect(_on_damage)
	bot.damaged.connect(_on_damage)
	var ui_layer := CanvasLayer.new()
	ui_layer.layer = 10
	add_child(ui_layer)
	pad = Node2D.new()
	pad.set_script(TouchScript)
	ui_layer.add_child(pad)
	pad.action_pressed.connect(_on_action)
	# Draw HUD and overlays above the fighters, independently of screen shake.
	var hud := Node2D.new()
	hud.draw.connect(_draw_hud.bind(hud))
	ui_layer.add_child(hud)
	hud.set_meta("hud", true)
	audio = Node.new()
	audio.set_script(AudioScript)
	add_child(audio)
	var preferences := ConfigFile.new()
	if preferences.load("user://settings.cfg") == OK:
		if preferences.get_value("audio", "muted", false):
			audio.toggle_mute()
	set_meta("hud_node", hud)

func start_match(skip_intro := false) -> void:
	if is_instance_valid(model_study):
		leave_model_study()
	player.scale = Vector2.ONE
	bot.visible = true
	player_wins = 0
	bot_wins = 0
	round_number = 1
	begin_round(skip_intro)

func enter_study() -> void:
	if is_instance_valid(model_study):
		leave_model_study()
	mode = "study"
	mode_time = 0.0
	study_time = 0.0
	study_pose = "idle"
	player.reset_at(Vector2(640, ZooFighter.FLOOR_Y))
	player.facing = 1.0
	player.scale = Vector2(1.45, 1.45)
	player.active = false
	bot.active = false
	bot.visible = false
	pad.enabled = false
	pad.clear()
	effects.clear()
	world.position = Vector2.ZERO

func leave_study() -> void:
	mode = "menu"
	player.scale = Vector2.ONE
	player.reset_at(Vector2(405, ZooFighter.FLOOR_Y))
	bot.reset_at(Vector2(875, ZooFighter.FLOOR_Y))
	bot.visible = true
	player.facing = 1
	bot.facing = -1

func enter_model_study() -> void:
	if is_instance_valid(model_study):
		return
	var scene := load("res://scenes/model_study.tscn") as PackedScene
	if scene == null:
		return
	mode = "model_study"
	player.active = false
	bot.active = false
	pad.enabled = false
	pad.clear()
	pad.hide()
	world.hide()
	world.process_mode = Node.PROCESS_MODE_DISABLED
	get_meta("hud_node").hide()
	if is_instance_valid(audio.music):
		audio.music.stream_paused = true
	for voice: AudioStreamPlayer in audio.voices:
		voice.stop()
	model_study = scene.instantiate()
	model_study.exited.connect(leave_model_study)
	add_child(model_study)

func leave_model_study() -> void:
	if is_instance_valid(model_study):
		model_study.queue_free()
	model_study = null
	world.process_mode = Node.PROCESS_MODE_INHERIT
	world.show()
	world.position = Vector2.ZERO
	pad.show()
	pad.enabled = false
	pad.clear()
	leave_study()
	get_meta("hud_node").show()
	get_meta("hud_node").queue_redraw()
	if is_instance_valid(audio.music):
		audio.music.stream_paused = false

func _update_study(delta: float) -> void:
	study_time += delta
	player.guard = false
	player.move_axis = 0.0
	match study_pose:
		"walk":
			player.state = "run"
			player.move_axis = 1.0
			player.state_time = study_time
		"combo":
			var cycle := fposmod(study_time, 1.65)
			if cycle < 1.05:
				player.state = "attack"
				player.attack_kind = "light"
				player.combo = mini(3, int(cycle / 0.35) + 1)
				player.state_time = fposmod(cycle, 0.35)
			else:
				player.state = "idle"
				player.state_time = cycle - 1.05
		"guard":
			player.state = "guard"
			player.guard = true
			player.state_time = study_time
		_:
			player.state = "idle"
			player.state_time = study_time

func begin_round(skip_intro := false) -> void:
	player.reset_at(Vector2(430, ZooFighter.FLOOR_Y))
	bot.reset_at(Vector2(850, ZooFighter.FLOOR_Y))
	player.facing = 1
	bot.facing = -1
	health_display = Vector2(100, 100)
	round_time = 60
	mode_time = 0
	mode = "fight" if skip_intro else "intro"
	bot_timer = 0.55
	hit_stop = 0
	shake = 0
	banner = ""
	banner_time = 0
	round_winner = ""
	pad.clear()
	pad.enabled = mode == "fight"
	effects.clear()
	audio.play("bell")

func _physics_process(delta: float) -> void:
	if mode == "model_study":
		return
	clock += delta
	mode_time += delta
	banner_time = maxf(0.0, banner_time - delta)
	shake = maxf(0.0, shake - delta * 28)
	world.position = Vector2(sin(clock * 131), cos(clock * 97)) * shake if shake > 0.05 else Vector2.ZERO
	health_display.x = move_toward(health_display.x, player.health, delta * 70)
	health_display.y = move_toward(health_display.y, bot.health, delta * 70)
	player.active = false
	bot.active = false
	pad.enabled = mode == "fight"
	if mode == "study":
		_update_study(delta)
	elif mode == "intro":
		if mode_time >= 1.6:
			mode = "fight"
			mode_time = 0
	elif mode == "fight":
		if hit_stop > 0.0:
			hit_stop = maxf(0.0, hit_stop - delta)
		else:
			player.active = true
			bot.active = true
			player.move_axis = clampf(pad.axis() + float(Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT)) - float(Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT)), -1, 1)
			player.guard = (pad.is_held("guard") or Input.is_physical_key_pressed(KEY_L)) and player.can_act() and player.is_grounded()
			if bot_enabled:
				bot_timer -= delta
				if bot_timer <= 0:
					_bot_think()
					bot_timer = rng.randf_range(0.18, 0.36)
			var direction := signf(bot.position.x - player.position.x)
			if player.state not in ["attack", "dash", "hurt", "ko"]:
				player.facing = direction if direction != 0 else player.facing
			if bot.state not in ["attack", "dash", "hurt", "ko"]:
				bot.facing = -direction if direction != 0 else bot.facing
			_separate_fighters()
			round_time = maxf(0.0, round_time - delta)
			if player.health <= 0 or bot.health <= 0 or round_time <= 0:
				_finish_round()
	elif mode == "ending":
		player.active = true
		bot.active = true
		player.move_axis = 0
		bot.move_axis = 0
		player.guard = false
		bot.guard = false
		if mode_time >= 1.2:
			mode = "matchover" if player_wins >= 2 or bot_wins >= 2 else "roundover"
			mode_time = 0
	var hud: Node2D = get_meta("hud_node")
	hud.queue_redraw()

func _separate_fighters() -> void:
	var gap := bot.position.x - player.position.x
	if absf(gap) < 69 and absf(bot.position.y - player.position.y) < 95:
		var direction := signf(gap) if gap != 0 else 1.0
		var overlap := (69 - absf(gap)) * 0.5
		player.position.x = clampf(player.position.x - direction * overlap, 95, 1185)
		bot.position.x = clampf(bot.position.x + direction * overlap, 95, 1185)

func _bot_think() -> void:
	if not bot.can_act():
		return
	var distance := absf(player.position.x - bot.position.x)
	var toward := signf(player.position.x - bot.position.x)
	bot.guard = false
	if player.state == "attack" and distance < 195 and rng.randf() < 0.55:
		bot.guard = true
		bot.move_axis = 0
		return
	if bot.stamina < 24:
		bot.move_axis = -toward if distance < 230 else 0.0
		bot.guard = distance < 170
	elif distance > 138:
		bot.move_axis = toward
		if distance < 170 and rng.randf() < 0.22:
			bot.move_axis = 0
			bot.attack("heavy")
	else:
		bot.move_axis = 0
		var choice := rng.randf()
		if choice < 0.61:
			bot.attack("light" if choice < 0.43 else "heavy")
		elif choice < 0.8:
			bot.guard = true
		else:
			bot.move_axis = -toward

func _on_action(action: String) -> void:
	if mode != "fight" or hit_stop > 0:
		return
	if action in ["light", "heavy"]:
		if player.attack(action):
			audio.play("swing", 1.15 if action == "light" else 0.82)
	elif action == "jump":
		player.jump()
	elif action == "dash":
		if player.dash():
			audio.play("swing", 0.7)

func _on_strike(attacker: ZooFighter) -> void:
	if mode != "fight":
		return
	var target := bot if attacker == player else player
	var gap := target.position.x - attacker.position.x
	var heavy := attacker.attack_kind == "heavy"
	var reach := ZooFighter.HEAVY_RANGE if heavy else ZooFighter.LIGHT_RANGE
	if gap * attacker.facing < 0 or absf(gap) > reach or absf(target.position.y - attacker.position.y) > 84:
		return
	var damage := 20.0 if heavy else (8.0 + attacker.combo * 2.0)
	var result := target.receive_hit(damage, attacker.position.x, 290.0 if heavy else 175.0)
	if result.hit:
		var point := target.position + Vector2(-target.facing * 20, -123)
		effects.burst(point, result.blocked, heavy)
		audio.play("guard" if result.blocked else "strike", 0.84 if heavy else 1.0)
		hit_stop = 0.025 if result.blocked else (0.065 if heavy else 0.04)
		shake = 1.5 if result.blocked else (5.0 if heavy else 2.5)
		if attacker == player and attacker.combo == 3 and not heavy and not result.blocked:
			banner = "3 HIT CHAIN"
			banner_time = 0.9

func _on_damage(_amount: float, _blocked: bool, _point: Vector2) -> void:
	pass

func _finish_round() -> void:
	if player.health == bot.health:
		round_winner = "draw"
	elif player.health > bot.health:
		round_winner = "player"
		player_wins += 1
	else:
		round_winner = "bot"
		bot_wins += 1
	mode = "ending"
	mode_time = 0
	pad.clear()
	audio.play("bell", 0.8)

func toggle_pause() -> void:
	if mode == "pause":
		mode = previous_mode
		mode_time = 0
	elif mode in ["fight", "intro"]:
		previous_mode = mode
		mode = "pause"
		pad.clear()
		player.move_axis = 0
		bot.move_axis = 0

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT and is_instance_valid(player):
		if mode in ["fight", "intro"]:
			toggle_pause()
	elif what == NOTIFICATION_WM_GO_BACK_REQUEST:
		if mode == "model_study":
			leave_model_study()
		elif mode == "study":
			leave_study()
		elif mode in ["fight", "intro", "pause"]:
			toggle_pause()
		elif mode in ["menu", "roundover", "matchover"]:
			get_tree().quit()

func _input(event: InputEvent) -> void:
	if mode == "model_study":
		if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_ESCAPE:
			leave_model_study()
		return
	if event is InputEventKey and event.pressed and not event.echo:
		match event.physical_keycode:
			KEY_ENTER:
				_continue()
			KEY_ESCAPE:
				if mode == "study":
					leave_study()
				else:
					toggle_pause()
			KEY_R:
				start_match()
			KEY_J:
				_on_action("light")
			KEY_K:
				_on_action("heavy")
			KEY_SPACE:
				_on_action("jump")
			KEY_SHIFT:
				_on_action("dash")
	var point := Vector2(-999, -999)
	if event is InputEventScreenTouch and event.pressed:
		point = event.position
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		point = event.position
	if mode == "study":
		if Rect2(1165, 22, 90, 42).has_point(point):
			leave_study()
		for pose: String in STUDY_BUTTONS:
			if STUDY_BUTTONS[pose].has_point(point):
				study_pose = pose
				study_time = 0.0
		return
	if mode == "menu" and MODEL_PREVIEW_BUTTON.has_point(point):
		enter_model_study()
		return
	if mode == "menu" and PAINTED_PREVIEW_BUTTON.has_point(point):
		enter_study()
		return
	if Rect2(1185, 22, 68, 40).has_point(point) and mode in ["fight", "intro", "pause"]:
		toggle_pause()
	elif Rect2(1080, 22, 96, 40).has_point(point):
		audio.toggle_mute()
		var preferences := ConfigFile.new()
		preferences.set_value("audio", "muted", audio.muted)
		preferences.save("user://settings.cfg")
	elif Rect2(440, 461, 400, 62).has_point(point):
		_continue()
	elif mode == "pause" and Rect2(440, 540, 400, 46).has_point(point):
		mode = "menu"
		pad.clear()

func _continue() -> void:
	match mode:
		"menu", "matchover":
			start_match()
		"pause":
			toggle_pause()
		"study":
			leave_study()
		"model_study":
			leave_model_study()
		"roundover":
			round_number += 1
			begin_round()

func _label(hud: Node2D, text: String, point: Vector2, size: int, color := IVORY, center := false) -> void:
	var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	hud.draw_string(font, point - Vector2(width * 0.5 if center else 0, 0), text, HORIZONTAL_ALIGNMENT_LEFT, -1, size, color)

func _panel(hud: Node2D, rect: Rect2, fill: Color, border: Color) -> void:
	var p := rect.position
	var s := rect.size
	var cut := 8.0
	var polygon := PackedVector2Array([p + Vector2(cut, 0), p + Vector2(s.x - cut, 0), p + Vector2(s.x, cut), p + Vector2(s.x, s.y - cut), p + Vector2(s.x - cut, s.y), p + Vector2(cut, s.y), p + Vector2(0, s.y - cut), p + Vector2(0, cut)])
	hud.draw_colored_polygon(polygon, fill)
	polygon.append(polygon[0])
	hud.draw_polyline(polygon, border, 1.0, true)

func _health_bar(hud: Node2D, x: float, health: float, trailing: float, stamina: float, reverse: bool) -> void:
	_panel(hud, Rect2(x, 82, 430, 26), Color("091820"), Color("648580"))
	var trailing_width := clampf(trailing / 100, 0, 1) * 418
	var width := clampf(health / 100, 0, 1) * 418
	var offset := 418 - width if reverse else 0.0
	var trail_offset := 418 - trailing_width if reverse else 0.0
	hud.draw_rect(Rect2(x + 6 + trail_offset, 88, trailing_width, 14), Color("ac623e"))
	hud.draw_rect(Rect2(x + 6 + offset, 88, width, 14), Color("76b1a1") if reverse else Color("d7ab68"))
	hud.draw_line(Vector2(x + 6 + offset, 88), Vector2(x + 6 + offset + width, 88), Color("eddfb4"), 2)
	for i in range(1, 5):
		hud.draw_line(Vector2(x + 6 + i * 83.6, 88), Vector2(x + 6 + i * 83.6, 102), Color(0.04, 0.08, 0.1, 0.3), 1)
	hud.draw_rect(Rect2(x + 6, 119, 418, 4), Color("122c35"))
	var stamina_width := 418 * stamina / 100
	hud.draw_rect(Rect2(x + 6 + (418 - stamina_width if reverse else 0.0), 119, stamina_width, 4), Color("93bdc0"))

func _draw_hud(hud: Node2D) -> void:
	if mode == "model_study":
		return
	if mode == "study":
		_draw_study_hud(hud)
		return
	# Readable top scrim and a quiet bottom scrim over the painted scene.
	for i in range(12):
		hud.draw_rect(Rect2(0, i * 12, 1280, 12), Color(0.025, 0.05, 0.075, 0.79 * (1.0 - float(i) / 12)))
	_label(hud, "SHADOW ZOO", Vector2(640, 36), 20, GOLD, true)
	_label(hud, "KAI", Vector2(61, 64), 33)
	_label(hud, "TIGER  /  YOU", Vector2(121, 62), 15, MUTED)
	_label(hud, "FEN", Vector2(1155, 64), 33)
	_label(hud, "WOLF  /  CPU", Vector2(1025, 62), 15, MUTED)
	_health_bar(hud, 58, player.health, health_display.x, player.stamina, false)
	_health_bar(hud, 792, bot.health, health_display.y, bot.stamina, true)
	_label(hud, "%02d" % ceili(round_time), Vector2(640, 103), 50, IVORY, true)
	_label(hud, "ROUND %d" % round_number, Vector2(640, 125), 14, MUTED, true)
	for i in range(2):
		hud.draw_circle(Vector2(516 + i * 20, 96), 5, GOLD if i < player_wins else Color("294049"))
		hud.draw_circle(Vector2(764 - i * 20, 96), 5, Color("9bcfc6") if i < bot_wins else Color("294049"))
	_label(hud, "MUTED" if audio.muted else "SOUND", Vector2(1128, 28), 13, MUTED, true)
	if mode in ["fight", "intro"]:
		_label(hud, "II", Vector2(1218, 52), 25, IVORY, true)
	if mode == "fight":
		_label(hud, "THE MOONLIT SHRINE", Vector2(640, 565), 16, Color("a5bdb4"), true)
		_label(hud, "MOVE", Vector2(147, 699), 13, MUTED, true)
		_label(hud, "HOLD TO BLOCK", Vector2(1020, 707), 12, MUTED, true)
		if banner_time > 0:
			_label(hud, banner, Vector2(640, 200), 26, GOLD, true)
	elif mode == "intro":
		var text := "ROUND %d" % round_number if mode_time < 0.95 else "FIGHT"
		_label(hud, text, Vector2(640, 315), 72, GOLD, true)
	elif mode == "ending":
		_label(hud, "TIME" if round_time <= 0 else "K.O.", Vector2(640, 305), 88, GOLD, true)
	elif mode in ["menu", "pause", "roundover", "matchover"]:
		hud.draw_rect(Rect2(0, 0, 1280, 720), Color(0.018, 0.04, 0.06, 0.66))
		_panel(hud, Rect2(342, 173, 596, 425), Color(0.025, 0.07, 0.09, 0.93), Color(0.5, 0.61, 0.53, 0.5))
		var title := "SHADOW ZOO"
		var subtitle := "THE FIRST DUEL"
		var description := "Two predators. One arena. Find your rhythm."
		var button := "ENTER THE ARENA"
		if mode == "pause":
			title = "PAUSED"
			subtitle = "TAKE A BREATH"
			description = "The arena will wait."
			button = "RESUME DUEL"
		elif mode in ["roundover", "matchover"]:
			title = "ROUND WON" if round_winner == "player" else "ROUND LOST"
			if round_winner == "draw":
				title = "DRAW"
			subtitle = "%d  —  %d" % [player_wins, bot_wins]
			description = "Watch the distance. Guard, then counter."
			button = "NEXT ROUND"
			if mode == "matchover":
				title = "VICTORY" if player_wins >= 2 else "DEFEATED"
				description = "The shrine remembers your strength." if player_wins >= 2 else "Every duel teaches you something. Try again."
				button = "FIGHT AGAIN"
		_label(hud, subtitle, Vector2(640, 223), 18, GOLD, true)
		_label(hud, title, Vector2(640, 300), 64, IVORY, true)
		hud.draw_line(Vector2(510, 327), Vector2(770, 327), Color("506860"), 1)
		hud.draw_colored_polygon(PackedVector2Array([Vector2(640, 322), Vector2(646, 327), Vector2(640, 332), Vector2(634, 327)]), GOLD)
		_label(hud, description, Vector2(640, 366), 21, MUTED, true)
		_label(hud, "STRIKE  ·  GUARD  ·  DODGE  ·  COUNTER", Vector2(640, 409), 17, GOLD, true)
		_panel(hud, Rect2(440, 461, 400, 62), Color("cba569"), GOLD)
		_label(hud, button, Vector2(640, 501), 26, Color("10232c"), true)
		if mode == "pause":
			_label(hud, "BACK TO TITLE", Vector2(640, 570), 18, MUTED, true)
		else:
			_label(hud, "TOUCH CONTROLS  /  A D MOVE · J STRIKE · K HEAVY", Vector2(640, 555), 15, MUTED, true)
			_label(hud, "L GUARD · SPACE JUMP · SHIFT DODGE · ESC PAUSE", Vector2(640, 576), 15, MUTED, true)
	if mode == "menu":
		_panel(hud, PAINTED_PREVIEW_BUTTON, Color(0.025, 0.07, 0.09, 0.93), Color("647f72"))
		_label(hud, "PREVIEW KAI", PAINTED_PREVIEW_BUTTON.get_center() + Vector2(0, 8), 22, GOLD, true)
		_panel(hud, MODEL_PREVIEW_BUTTON, Color("cba569"), GOLD)
		_label(hud, "3D MOTION STUDY", MODEL_PREVIEW_BUTTON.get_center() + Vector2(0, 8), 22, Color("10232c"), true)
	_label(hud, "MODEL STUDY  /  0.3", Vector2(640, 704), 12, Color(0.63, 0.73, 0.73, 0.6), true)

func _draw_study_hud(hud: Node2D) -> void:
	for i in range(10):
		hud.draw_rect(Rect2(0, i * 12, 1280, 12), Color(0.025, 0.05, 0.075, 0.8 * (1.0 - float(i) / 10)))
	_label(hud, "SHADOW ZOO", Vector2(640, 35), 20, GOLD, true)
	_label(hud, "KAI  /  TIGER", Vector2(640, 79), 34, IVORY, true)
	_label(hud, "CHARACTER PREVIEW", Vector2(640, 104), 15, MUTED, true)
	_panel(hud, Rect2(1165, 22, 90, 42), Color("102832"), Color("647f72"))
	_label(hud, "BACK", Vector2(1210, 51), 19, IVORY, true)
	var labels := {"idle": "STANCE", "walk": "WALK", "combo": "COMBO", "guard": "GUARD"}
	for pose: String in STUDY_BUTTONS:
		var rect: Rect2 = STUDY_BUTTONS[pose]
		var selected := study_pose == pose
		_panel(hud, rect, Color("cba569") if selected else Color("102832"), GOLD if selected else Color("647f72"))
		_label(hud, labels[pose], rect.get_center() + Vector2(0, 8), 23, Color("10232c") if selected else IVORY, true)
	_label(hud, "Tap a pose to preview", Vector2(640, 595), 17, MUTED, true)
	_label(hud, "VISUAL STUDY  /  0.2", Vector2(640, 704), 12, MUTED, true)
