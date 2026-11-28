## Talks to the game server through its JSON door (server/src/jsonGateway.ts).
## Added as the autoload "Net", so any script can call Net.send_game("move", {...}).
extends Node

signal opened
signal joined(session_id: String)
signal failed(code: int, message: String)
signal state_changed(msg: Dictionary)
signal server_message(type: String, data: Variant)
signal closed(reason: String)

var session_id := ""
var _ws := WebSocketPeer.new()
var _connecting := false
var _open := false
var _queue: Array[String] = []


## Opens the connection. url looks like "wss://mikes-rpg.onrender.com/json".
func open(url: String) -> void:
	close()
	_ws = WebSocketPeer.new()
	_ws.inbound_buffer_size = 4 * 1024 * 1024 # the first state message holds every player and monster
	_ws.outbound_buffer_size = 256 * 1024
	var err := _ws.connect_to_url(url)
	if err != OK:
		failed.emit(0, "Couldn't reach the server at %s." % url)
		return
	_connecting = true


func close() -> void:
	if _open or _connecting:
		_ws.close()
	_open = false
	_connecting = false
	_queue.clear()
	session_id = ""


func is_open() -> bool:
	return _open


## Logs in (create = make a new account first).
func join(username: String, password: String, create: bool) -> void:
	_send({"op": "join", "username": username, "password": password, "create": create})


## Sends one of the web game's messages, e.g. send_game("move", {"x": 10, "y": 20}).
func send_game(type: String, data: Variant = {}) -> void:
	_send({"op": "send", "type": type, "data": data})


func _send(d: Dictionary) -> void:
	var text := JSON.stringify(d)
	if _open:
		_ws.send_text(text)
	else:
		_queue.append(text)


func _process(_delta: float) -> void:
	if not (_open or _connecting):
		return
	_ws.poll()
	var st := _ws.get_ready_state()
	if st == WebSocketPeer.STATE_OPEN:
		if not _open:
			_open = true
			_connecting = false
			opened.emit()
			for text in _queue:
				_ws.send_text(text)
			_queue.clear()
		while _ws.get_available_packet_count() > 0:
			_handle(_ws.get_packet().get_string_from_utf8())
	elif st == WebSocketPeer.STATE_CLOSED:
		var was_open := _open
		_open = false
		_connecting = false
		session_id = ""
		if was_open:
			closed.emit("The connection closed (code %d)." % _ws.get_close_code())
		else:
			failed.emit(0, "Couldn't connect to the server. Check the address and your internet.")


func _handle(text: String) -> void:
	var m: Variant = JSON.parse_string(text)
	if typeof(m) != TYPE_DICTIONARY:
		return
	match str(m.get("op", "")):
		"joined":
			session_id = str(m.get("sessionId", ""))
			joined.emit(session_id)
		"error":
			failed.emit(int(m.get("code", 0)), str(m.get("message", "Something went wrong.")))
		"state":
			state_changed.emit(m)
		"msg":
			server_message.emit(str(m.get("type", "")), m.get("data"))
		"left":
			closed.emit("You left the world.")
