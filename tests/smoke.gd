extends SceneTree

var failures: Array[String] = []
var checks := 0
var game: Node2D

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, description: String) -> void:
	checks += 1
	if condition:
		print("PASS: ", description)
	else:
		failures.append(description)
		push_error("FAIL: " + description)

func wait(seconds: float) -> void:
	await create_timer(seconds).timeout

func fresh(distance := 120.0) -> void:
	game.begin_round(true)
	game.player.position.x = 500
	game.bot.position.x = 500 + distance
	game.player.active = true
	game.bot.active = true

func run() -> void:
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await wait(0.05)
	game.bot_enabled = false
	check(game.mode == "menu", "native main scene opens on the title screen")
	game.start_match(true)
	await wait(0.05)
	check(game.player.health == 100 and game.bot.health == 100, "match initializes both fighters")
	var old_x: float = game.player.position.x
	game.pad.pointers[1] = "right"
	await wait(0.25)
	check(game.player.position.x > old_x + 40, "held touch movement advances the player")
	game.pad.clear()
	game.toggle_pause()
	var stopped_x: float = game.player.position.x
	var stopped_clock: float = game.round_time
	await wait(0.18)
	check(game.player.position.x == stopped_x and game.round_time == stopped_clock, "pause freezes gameplay and round timer")
	game.toggle_pause()
	fresh()
	check(game.player.attack("light"), "light strike can start")
	await wait(0.2)
	check(game.bot.health == 90, "active strike applies damage exactly once")
	await wait(0.19)
	game.bot.position.x = 620
	game.player.attack("light")
	await wait(0.39)
	game.bot.position.x = 620
	game.player.attack("light")
	await wait(0.2)
	check(game.bot.health == 64 and game.player.combo == 3, "three-strike chain progresses and applies increasing damage")
	fresh()
	game.bot.guard = true
	game.player.attack("heavy")
	await wait(0.38)
	check(is_equal_approx(game.bot.health, 98.4), "front guard reduces heavy damage to chip damage")
	check(game.bot.stamina < 80, "blocking consumes stamina")
	fresh()
	game.bot.guard = true
	game.bot.stamina = 0
	game.bot.receive_hit(20, 500, 200)
	check(game.bot.state == "hurt" and game.bot.health == 76, "insufficient stamina breaks guard")
	fresh()
	game.player.stamina = 5
	check(not game.player.attack("heavy"), "insufficient stamina rejects heavy attacks")
	game.player.stamina = 100
	check(game.player.dash(), "dodge can start")
	var result: Dictionary = game.player.receive_hit(20, 620, 100)
	check(not result.hit and game.player.health == 100, "early dodge frames avoid damage")
	await wait(0.21)
	result = game.player.receive_hit(20, 620, 100)
	check(result.hit, "dodge invulnerability expires before recovery ends")
	fresh(300)
	game.player.attack("heavy")
	await wait(0.4)
	check(game.bot.health == 100, "out-of-range strike misses")
	fresh()
	game.player.jump()
	await wait(0.2)
	check(game.player.position.y < ZooFighter.FLOOR_Y - 84, "jump leaves grounded attack height")
	game._on_strike(game.bot)
	check(game.player.health == 100, "ground strike misses a high airborne target")
	await wait(0.65)
	check(game.player.is_grounded(), "jump returns to the arena floor")
	fresh()
	var touch := InputEventScreenTouch.new()
	touch.index = 1
	touch.pressed = true
	touch.position = Vector2(204, 626)
	game.pad._input(touch)
	touch = InputEventScreenTouch.new()
	touch.index = 2
	touch.pressed = true
	touch.position = Vector2(1019, 650)
	game.pad._input(touch)
	check(game.pad.axis() == 1 and game.pad.is_held("guard"), "two-finger movement and guard are tracked independently")
	touch.pressed = false
	game.pad._input(touch)
	check(game.pad.axis() == 1 and not game.pad.is_held("guard"), "releasing one touch preserves the other")
	fresh()
	game.player_wins = 0
	game.bot_wins = 0
	game.bot.health = 0
	await wait(1.4)
	check(game.mode == "roundover" and game.player_wins == 1, "knockout awards one round and shows the next-round screen")
	game.begin_round(true)
	game.bot.health = 0
	await wait(1.4)
	check(game.mode == "matchover" and game.player_wins == 2, "two round wins finish the match")
	game.start_match(true)
	check(game.player_wins == 0 and game.bot_wins == 0 and game.player.health == 100, "rematch resets scores and fighter state")
	fresh()
	game.round_time = 0.01
	game.player.health = 80
	game.bot.health = 50
	await wait(0.06)
	check(game.mode == "ending" and game.round_winner == "player", "timer expiry awards the round by remaining health")
	fresh()
	game.bot_enabled = true
	game.rng.seed = 47
	await wait(1.8)
	check(game.player.health < 100, "AI opponent executes attacks and damages the player")
	print("\nRESULT: %d checks, %d failures" % [checks, failures.size()])
	game.audio.stop_all()
	await wait(0.1)
	game.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
