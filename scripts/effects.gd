extends Node2D

var particles: Array[Dictionary] = []
var rings: Array[Dictionary] = []
var rng := RandomNumberGenerator.new()

func burst(point: Vector2, blocked: bool, heavy: bool) -> void:
	var color := Color("b7efe3") if blocked else Color("ffc279")
	var count := 10 if blocked else (23 if heavy else 15)
	for i in range(count):
		var angle := rng.randf_range(-PI, PI)
		particles.append({"point": point, "velocity": Vector2.from_angle(angle) * rng.randf_range(90, 390), "life": rng.randf_range(0.18, 0.42), "color": color, "size": rng.randf_range(1.5, 3.0)})
	rings.append({"point": point, "age": 0.0, "blocked": blocked, "color": color})

func clear() -> void:
	particles.clear()
	rings.clear()

func _process(delta: float) -> void:
	for p: Dictionary in particles:
		p.life -= delta
		p.point += p.velocity * delta
		p.velocity.y += 420 * delta
	particles = particles.filter(func(p: Dictionary) -> bool: return p.life > 0.0)
	for ring: Dictionary in rings:
		ring.age += delta
	rings = rings.filter(func(r: Dictionary) -> bool: return r.age < 0.22)
	queue_redraw()

func _draw() -> void:
	for p: Dictionary in particles:
		draw_line(p.point, p.point - p.velocity * 0.026, Color(p.color, minf(p.life * 5, 1.0)), p.size, true)
	for ring: Dictionary in rings:
		var radius: float = 9 + ring.age * 230
		var alpha: float = 1.0 - ring.age / 0.22
		if ring.blocked:
			draw_arc(ring.point, radius, -PI * 0.65, PI * 0.65, 24, Color(ring.color, alpha), 3, true)
		else:
			for i in range(5):
				var direction := Vector2.from_angle(i * TAU / 5)
				draw_line(ring.point + direction * radius * 0.3, ring.point + direction * radius, Color(ring.color, alpha), 2, true)
