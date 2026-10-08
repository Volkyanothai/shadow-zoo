extends Node2D

var clock := 0.0
var artwork: Texture2D

func _ready() -> void:
	if ResourceLoader.exists("res://assets/arena.png"):
		artwork = load("res://assets/arena.png")

func _process(delta: float) -> void:
	clock += delta
	queue_redraw()

func _draw() -> void:
	if artwork:
		draw_texture_rect(artwork, Rect2(0, 0, 1280, 720), false)
		draw_rect(Rect2(0, 0, 1280, 720), Color(0.015, 0.035, 0.055, 0.13))
	else:
		draw_rect(Rect2(0, 0, 1280, 720), Color("122e3a"))
		draw_circle(Vector2(800, 170), 86, Color("e2dfb9"))
		for layer in range(3):
			var points := PackedVector2Array([Vector2(0, 530)])
			for i in range(17):
				points.append(Vector2(i * 80, 260 + layer * 70 + sin(i * 0.8 + layer) * 75))
			points.append(Vector2(1280, 530))
			draw_colored_polygon(points, Color("17353c").darkened(layer * 0.2))
		for x in [40, 81, 120, 1160, 1210, 1250]:
			draw_line(Vector2(x, 540), Vector2(x - 20, 60), Color("071c25"), 15, true)
			for y in range(80, 440, 60):
				draw_line(Vector2(x, y), Vector2(x + 48, y - 26), Color("163f43"), 4, true)
	# A consistent ground plane keeps the painted platform aligned with collision.
	draw_rect(Rect2(0, 529, 1280, 191), Color(0.02, 0.055, 0.075, 0.36))
	draw_line(Vector2(0, 531), Vector2(1280, 531), Color(0.6, 0.74, 0.66, 0.38), 2, true)
	for i in range(11):
		draw_line(Vector2(i * 128, 535), Vector2((i - 5) * 172 + 640, 720), Color(0.05, 0.1, 0.13, 0.27), 2, true)
	for y in [569, 621, 701]:
		draw_line(Vector2(0, y), Vector2(1280, y), Color(0.03, 0.07, 0.09, 0.28), 2)
	# Subtle living atmosphere, using a bounded particle count for mobile.
	for i in range(30):
		var x := fposmod(i * 137.1 + clock * (4.0 + i % 4), 1280)
		var y := 140 + fposmod(i * 73.2, 350) + sin(clock * 0.6 + i) * 13
		var alpha := 0.18 + (sin(clock * 1.7 + i * 2.3) + 1) * 0.2
		draw_circle(Vector2(x, y), 4, Color(0.95, 0.77, 0.4, alpha * 0.12))
		draw_circle(Vector2(x, y), 1.3, Color(0.98, 0.84, 0.55, alpha))
