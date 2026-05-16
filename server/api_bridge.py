"""
REST → gRPC bridge
React calls this Flask API; Flask calls the gRPC server.
Runs on port 8000.
"""

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import grpc, json, time, threading, queue
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import chat_pb2, chat_pb2_grpc

app = Flask(__name__)
CORS(app)

GRPC_ADDR = "localhost:50051"

def stub():
    ch = grpc.insecure_channel(GRPC_ADDR)
    return chat_pb2_grpc.ChatServiceStub(ch)

def token():
    auth = request.headers.get("Authorization", "")
    return auth.replace("Bearer ", "").strip()

def err(msg, code=400):
    return jsonify({"success": False, "message": msg}), code

# ─── Auth ────────────────────────────────────────────────────────────────────

@app.post("/api/register")
def register():
    d = request.json
    r = stub().Register(chat_pb2.RegisterRequest(
        username=d.get("username",""), password=d.get("password",""),
        display_name=d.get("display_name","")
    ))
    return jsonify({"success": r.success, "token": r.token, "username": r.username,
                    "display_name": r.display_name, "message": r.message})

@app.post("/api/login")
def login():
    d = request.json
    r = stub().Login(chat_pb2.LoginRequest(username=d.get("username",""), password=d.get("password","")))
    return jsonify({"success": r.success, "token": r.token, "username": r.username,
                    "display_name": r.display_name, "message": r.message})

# ─── Users / Friends ─────────────────────────────────────────────────────────

@app.get("/api/users/search")
def search():
    q = request.args.get("q", "")
    r = stub().SearchUsers(chat_pb2.SearchRequest(token=token(), query=q))
    return jsonify({"users": [
        {"username": u.username, "display_name": u.display_name,
         "online": u.online, "friend_status": u.friend_status}
        for u in r.users
    ]})

@app.post("/api/friends/request")
def friend_request():
    d = request.json
    r = stub().SendFriendRequest(chat_pb2.FriendRequest(token=token(), to_username=d.get("to_username","")))
    return jsonify({"success": r.success, "message": r.message})

@app.post("/api/friends/respond")
def friend_respond():
    d = request.json
    r = stub().RespondFriend(chat_pb2.RespondFriendRequest(
        token=token(), from_username=d.get("from_username",""), accept=d.get("accept", False)
    ))
    return jsonify({"success": r.success, "message": r.message})

@app.get("/api/friends")
def friends():
    r = stub().GetFriends(chat_pb2.FriendListRequest(token=token()))
    return jsonify({"friends": [
        {"username": u.username, "display_name": u.display_name,
         "online": u.online, "friend_status": u.friend_status}
        for u in r.friends
    ]})

@app.get("/api/friends/pending")
def pending():
    r = stub().GetPendingRequests(chat_pb2.PendingRequest(token=token()))
    return jsonify({"requests": [
        {"username": u.username, "display_name": u.display_name, "online": u.online}
        for u in r.requests
    ]})

# ─── Rooms ───────────────────────────────────────────────────────────────────

@app.get("/api/rooms")
def list_rooms():
    r = stub().ListRooms(chat_pb2.ListRoomsRequest(token=token()))
    return jsonify({"rooms": [
        {"room_id": rm.room_id, "room_name": rm.room_name, "members": rm.members}
        for rm in r.rooms
    ]})

@app.post("/api/rooms")
def create_room():
    d = request.json
    r = stub().CreateRoom(chat_pb2.CreateRoomRequest(token=token(), room_name=d.get("room_name","")))
    return jsonify({"success": r.success, "room_id": r.room_id, "room_name": r.room_name, "message": r.message})

@app.post("/api/rooms/<room_id>/join")
def join_room(room_id):
    r = stub().JoinRoom(chat_pb2.JoinRoomRequest(token=token(), room_id=room_id))
    return jsonify({"success": r.success, "room_id": r.room_id, "room_name": r.room_name})

# ─── History ─────────────────────────────────────────────────────────────────

@app.get("/api/history")
def history():
    room_id = request.args.get("room_id", "")
    to_user = request.args.get("to_user", "")
    limit   = int(request.args.get("limit", 50))
    r = stub().GetHistory(chat_pb2.HistoryRequest(token=token(), room_id=room_id, to_user=to_user, limit=limit))
    return jsonify({"messages": [
        {"msg_id": m.msg_id, "sender": m.sender, "display_name": m.display_name,
         "room_id": m.room_id, "to_user": m.to_user, "content": m.content, "timestamp": m.timestamp}
        for m in r.messages
    ]})

# ─── Heartbeat ───────────────────────────────────────────────────────────────

@app.post("/api/heartbeat")
def heartbeat():
    stub().Heartbeat(chat_pb2.HeartbeatRequest(token=token()))
    return jsonify({"ok": True})

# ─── SSE stream (sends new messages to browser) ───────────────────────────────

# active SSE queues keyed by (channel_key)
_sse_queues: dict[str, list] = {}
_sse_lock = threading.Lock()

def sse_subscribe(key):
    q = queue.Queue()
    with _sse_lock:
        _sse_queues.setdefault(key, []).append(q)
    return q

def sse_unsubscribe(key, q):
    with _sse_lock:
        try: _sse_queues[key].remove(q)
        except: pass

def sse_publish(key, data):
    with _sse_lock:
        qs = list(_sse_queues.get(key, []))
    for q in qs:
        q.put(data)

# Background thread: bridges gRPC stream → SSE queues
_active_grpc_streams: set = set()
_streams_lock = threading.Lock()

def start_grpc_bridge(channel_key, token_val, room_id="", to_user=""):
    with _streams_lock:
        if channel_key in _active_grpc_streams:
            return
        _active_grpc_streams.add(channel_key)

    def run():
        send_q = queue.Queue()
        # send join message
        send_q.put(chat_pb2.ChatMessage(token=token_val, room_id=room_id, to_user=to_user, content="__join__"))

        def gen():
            while True:
                msg = send_q.get()
                if msg is None: break
                yield msg

        try:
            for incoming in stub().ChatStream(gen()):
                if incoming.content == "__join__": continue
                data = {
                    "msg_id": incoming.msg_id, "sender": incoming.sender,
                    "display_name": incoming.display_name, "room_id": incoming.room_id,
                    "to_user": incoming.to_user, "content": incoming.content,
                    "timestamp": incoming.timestamp
                }
                sse_publish(channel_key, data)
        except Exception as e:
            print(f"gRPC bridge error ({channel_key}):", e)
        finally:
            with _streams_lock:
                _active_grpc_streams.discard(channel_key)

    threading.Thread(target=run, daemon=True).start()

@app.get("/api/stream")
def stream():
    tok     = request.args.get("token", "")
    room_id = request.args.get("room_id", "")
    to_user = request.args.get("to_user", "")
    key     = room_id if room_id else f"dm:{':'.join(sorted([request.args.get('me',''), to_user]))}"

    start_grpc_bridge(key, tok, room_id=room_id, to_user=to_user)
    q = sse_subscribe(key)

    def event_stream():
        try:
            yield "data: {\"type\":\"connected\"}\n\n"
            while True:
                try:
                    data = q.get(timeout=25)
                    yield f"data: {json.dumps(data)}\n\n"
                except queue.Empty:
                    yield ": ping\n\n"
        finally:
            sse_unsubscribe(key, q)

    return Response(event_stream(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.post("/api/send")
def send_msg():
    """HTTP endpoint to inject a message into the gRPC stream."""
    d = request.json
    tok     = token()
    room_id = d.get("room_id", "")
    to_user = d.get("to_user", "")
    content = d.get("content", "")

    key = room_id if room_id else f"dm:{':'.join(sorted([d.get('sender',''), to_user]))}"
    start_grpc_bridge(key, tok, room_id=room_id, to_user=to_user)

    # Use a one-shot gRPC stream to deliver the message
    def one_shot():
        send_q = queue.Queue()
        send_q.put(chat_pb2.ChatMessage(token=tok, room_id=room_id, to_user=to_user, content="__join__"))
        send_q.put(chat_pb2.ChatMessage(token=tok, room_id=room_id, to_user=to_user, content=content))
        send_q.put(None)

        def gen():
            while True:
                msg = send_q.get()
                if msg is None: break
                yield msg

        try:
            for _ in stub().ChatStream(gen()): pass
        except: pass

    threading.Thread(target=one_shot, daemon=True).start()
    return jsonify({"ok": True})

if __name__ == "__main__":
    app.run(port=8001, debug=False, threaded=True)
