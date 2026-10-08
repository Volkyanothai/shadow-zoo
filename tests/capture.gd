extends SceneTree

func _initialize() -> void:
	call_deferred("capture")

func capture() -> void:
	var game: Node2D = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await create_timer(0.15).timeout
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("/workspace/artifacts/shadow-zoo-title.png")
	game.bot_enabled = false
	game.start_match(true)
	game.player.position.x = 520
	game.bot.position.x = 700
	await create_timer(0.1).timeout
	game.player.attack("heavy")
	await create_timer(0.32).timeout
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("/workspace/artifacts/shadow-zoo-duel.png")
	print("Native title and combat frames captured")
	game.audio.stop_all()
	await create_timer(0.1).timeout
	game.queue_free()
	await process_frame
	quit()
