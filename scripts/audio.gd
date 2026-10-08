extends Node

var muted := false
var voices: Array[AudioStreamPlayer] = []
var streams: Dictionary = {}
var music: AudioStreamPlayer
var voice_index := 0

func _ready() -> void:
	for sound in ["strike", "guard", "swing", "bell"]:
		var path := "res://assets/audio/%s.wav" % sound
		if ResourceLoader.exists(path):
			streams[sound] = load(path)
	for i in range(6):
		var voice := AudioStreamPlayer.new()
		voice.volume_db = -8.0
		add_child(voice)
		voices.append(voice)
	if ResourceLoader.exists("res://assets/audio/ambience.wav"):
		music = AudioStreamPlayer.new()
		music.stream = load("res://assets/audio/ambience.wav")
		music.volume_db = -20.0
		add_child(music)
		music.finished.connect(music.play)
		music.play()

func play(sound: String, pitch := 1.0) -> void:
	if muted or not streams.has(sound) or voices.is_empty():
		return
	var voice := voices[voice_index % voices.size()]
	voice_index += 1
	voice.stream = streams[sound]
	voice.pitch_scale = pitch
	voice.play()

func toggle_mute() -> void:
	muted = not muted
	if music:
		music.volume_db = -80.0 if muted else -20.0
	if muted:
		for voice in voices:
			voice.stop()

func stop_all() -> void:
	if music:
		music.stop()
		music.stream = null
	for voice in voices:
		voice.stop()
		voice.stream = null
	streams.clear()

func _exit_tree() -> void:
	stop_all()
