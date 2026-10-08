extends Node2D

signal action_pressed(action: String)

const BUTTONS := {
	"left": {"point": Vector2(91, 626), "radius": 45.0, "label": ""},
	"right": {"point": Vector2(204, 626), "radius": 45.0, "label": ""},
	"dash": {"point": Vector2(875, 646), "radius": 34.0, "label": "DASH"},
	"jump": {"point": Vector2(971, 574), "radius": 34.0, "label": "JUMP"},
	"guard": {"point": Vector2(1019, 650), "radius": 37.0, "label": "GUARD"},
	"light": {"point": Vector2(1120, 622), "radius": 50.0, "label": "STRIKE"},
	"heavy": {"point": Vector2(1211, 570), "radius": 36.0, "label": "HEAVY"}
}

var enabled := false
var pointers: Dictionary = {}
var font: Font = preload("res://assets/fonts/Rajdhani-SemiBold.ttf")
var feedback: Dictionary = {}

func clear() -> void:
	pointers.clear()
	queue_redraw()

func is_held(action: String) -> bool:
	return enabled and action in pointers.values()

func axis() -> float:
	return float(is_held("right")) - float(is_held("left"))

func button_at(point: Vector2) -> String:
	for action: String in BUTTONS:
		if point.distance_to(BUTTONS[action].point) <= BUTTONS[action].radius + 9:
			return action
	return ""

func _input(event: InputEvent) -> void:
	if not enabled:
		return
	if event is InputEventScreenTouch:
		if event.pressed:
			_press(event.index, event.position)
		else:
			pointers.erase(event.index)
	elif event is InputEventScreenDrag:
		var action := button_at(event.position)
		# Sliding across movement buttons changes direction without lifting a thumb.
		if pointers.get(event.index, "") in ["left", "right"]:
			pointers[event.index] = action if action in ["left", "right"] else ""
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_press(-1, event.position)
		else:
			pointers.erase(-1)
	queue_redraw()

func _press(index: int, point: Vector2) -> void:
	var action := button_at(point)
	if action.is_empty():
		return
	pointers[index] = action
	feedback[action] = 0.13
	action_pressed.emit(action)

func _process(delta: float) -> void:
	for key: String in feedback:
		feedback[key] = maxf(0.0, feedback[key] - delta)
	queue_redraw()

func _draw() -> void:
	if not enabled:
		return
	for action: String in BUTTONS:
		var button: Dictionary = BUTTONS[action]
		var point: Vector2 = button.point
		var radius: float = button.radius
		var lit: bool = is_held(action) or feedback.get(action, 0.0) > 0.0
		var accent := Color("e8bb76") if action in ["light", "heavy"] else Color("b4d4cb")
		draw_circle(point + Vector2(0, 4), radius + 2, Color(0, 0, 0, 0.25))
		draw_circle(point, radius, Color(0.07, 0.14, 0.18, 0.82) if not lit else Color(0.3, 0.34, 0.29, 0.91))
		draw_arc(point, radius, 0, TAU, 64, Color(accent, 0.9 if lit else 0.46), 2, true)
		draw_arc(point, radius - 5, -PI * 0.78, -PI * 0.27, 16, Color(accent, 0.5), 1, true)
		if action in ["left", "right"]:
			var direction := -1 if action == "left" else 1
			draw_polyline(PackedVector2Array([point + Vector2(-direction * 6, -12), point + Vector2(direction * 7, 0), point + Vector2(-direction * 6, 12)]), accent, 4, true)
		else:
			var size := 16 if radius < 40 else 20
			var label: String = button.label
			var width := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
			draw_string(font, point + Vector2(-width * 0.5, 6), label, HORIZONTAL_ALIGNMENT_LEFT, -1, size, accent)
