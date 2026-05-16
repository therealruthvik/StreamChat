"""
gRPC Chat Client — interactive CLI
Commands: /register /login /rooms /create /join /dm /history /quit
"""

import grpc
import threading
import sys
import os

# adjust path so we find generated stubs
sys.path.insert(0, os.path.dirname(__file__))

import chat_pb2
import chat_pb2_grpc

SERVER = "localhost:50051"

# ─── State ───────────────────────────────────────────────────────────────────

token       = None
username    = None
active_room = None   # room_id
active_dm   = None   # target username
send_queue  = None   # injected from stream thread

# ─── Helpers ─────────────────────────────────────────────────────────────────

def stub():
    channel = grpc.insecure_channel(SERVER)
    return chat_pb2_grpc.ChatServiceStub(channel)

def print_msg(msg):
    ts = msg.timestamp[11:19] if len(msg.timestamp) > 19 else msg.timestamp
    dest = f"[room:{msg.room_id}]" if msg.room_id else f"[dm:{msg.sender}→{msg.to_user}]"
    print(f"\n  💬 {dest} {msg.sender} [{ts}]: {msg.content}")
    print("  > ", end="", flush=True)

# ─── Commands ────────────────────────────────────────────────────────────────

def cmd_register(args):
    if len(args) < 2:
        print("Usage: /register <username> <password>"); return
    resp = stub().Register(chat_pb2.RegisterRequest(username=args[0], password=args[1]))
    if resp.success:
        global token, username
        token    = resp.token
        username = args[0]
        print(f"  ✅ Registered & logged in as {username}")
    else:
        print(f"  ❌ {resp.message}")

def cmd_login(args):
    if len(args) < 2:
        print("Usage: /login <username> <password>"); return
    resp = stub().Login(chat_pb2.LoginRequest(username=args[0], password=args[1]))
    if resp.success:
        global token, username
        token    = resp.token
        username = args[0]
        print(f"  ✅ Logged in as {username}")
    else:
        print(f"  ❌ {resp.message}")

def cmd_rooms(_):
    resp = stub().ListRooms(chat_pb2.ListRoomsRequest(token=token))
    if not resp.rooms:
        print("  No rooms yet. Create one with /create <name>"); return
    print("  Rooms:")
    for r in resp.rooms:
        print(f"    [{r.room_id}] {r.room_name}  ({r.members} members)")

def cmd_create(args):
    if not args:
        print("Usage: /create <room_name>"); return
    resp = stub().CreateRoom(chat_pb2.CreateRoomRequest(token=token, room_name=args[0]))
    if resp.success:
        print(f"  ✅ Created room '{resp.room_name}' (id: {resp.room_id})")
    else:
        print(f"  ❌ {resp.message}")

def cmd_join(args):
    if not args:
        print("Usage: /join <room_id>"); return
    resp = stub().JoinRoom(chat_pb2.JoinRoomRequest(token=token, room_id=args[0]))
    if resp.success:
        global active_room, active_dm
        active_room = args[0]
        active_dm   = None
        print(f"  ✅ Joined '{resp.room_name}'. Start typing to chat!")
        start_stream(room_id=active_room)
    else:
        print(f"  ❌ {resp.message}")

def cmd_dm(args):
    if not args:
        print("Usage: /dm <username>"); return
    global active_dm, active_room
    active_dm   = args[0]
    active_room = None
    print(f"  ✅ DM with {active_dm}. Start typing!")
    start_stream(to_user=active_dm)

def cmd_history(args):
    room_id = args[0] if args else (active_room or "")
    to_user = "" if room_id else (active_dm or "")
    limit   = int(args[1]) if len(args) > 1 else 20

    resp = stub().GetHistory(chat_pb2.HistoryRequest(
        token=token, room_id=room_id, to_user=to_user, limit=limit
    ))
    if not resp.messages:
        print("  No history"); return
    print(f"  ─── Last {len(resp.messages)} messages ───")
    for m in resp.messages:
        ts = m.timestamp[11:19]
        print(f"  [{ts}] {m.sender}: {m.content}")

# ─── Streaming ───────────────────────────────────────────────────────────────

import queue as _queue

_send_q: _queue.Queue = _queue.Queue()

def message_generator():
    """Yields outbound ChatMessage objects from the send queue."""
    while True:
        msg = _send_q.get()
        if msg is None:
            break
        yield msg

def start_stream(room_id="", to_user=""):
    """Start a bidirectional stream in a background thread."""
    # Send initial auth message
    _send_q.put(chat_pb2.ChatMessage(
        token   = token,
        room_id = room_id,
        to_user = to_user,
        content = "__join__",
    ))

    def run():
        try:
            for incoming in stub().ChatStream(message_generator()):
                if incoming.content != "__join__":
                    print_msg(incoming)
        except grpc.RpcError as e:
            if e.code() != grpc.StatusCode.CANCELLED:
                print(f"\n  ⚠️  Stream error: {e.details()}")

    t = threading.Thread(target=run, daemon=True)
    t.start()

def send_chat(text):
    msg = chat_pb2.ChatMessage(
        token   = token,
        room_id = active_room or "",
        to_user = active_dm   or "",
        content = text,
    )
    _send_q.put(msg)

# ─── REPL ────────────────────────────────────────────────────────────────────

COMMANDS = {
    "/register": cmd_register,
    "/login":    cmd_login,
    "/rooms":    cmd_rooms,
    "/create":   cmd_create,
    "/join":     cmd_join,
    "/dm":       cmd_dm,
    "/history":  cmd_history,
}

HELP = """
  Commands:
    /register <user> <pass>   — create account
    /login    <user> <pass>   — login
    /rooms                    — list rooms
    /create   <name>          — create room
    /join     <room_id>       — join & stream room
    /dm       <username>      — open DM
    /history  [room_id] [n]   — fetch history
    /quit                     — exit
"""

def main():
    print("─" * 50)
    print("  gRPC Chat Client  •  server:", SERVER)
    print("─" * 50)
    print(HELP)

    while True:
        try:
            line = input("  > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n  Bye!"); break

        if not line:
            continue

        if line == "/quit":
            print("  Bye!"); break

        if line == "/help":
            print(HELP); continue

        if line.startswith("/"):
            parts   = line.split()
            cmd     = parts[0]
            args    = parts[1:]
            handler = COMMANDS.get(cmd)
            if handler:
                if cmd not in ("/register", "/login") and not token:
                    print("  ⚠️  Login first"); continue
                try:
                    handler(args)
                except grpc.RpcError as e:
                    print(f"  ❌ gRPC error: {e.details()}")
            else:
                print(f"  Unknown command: {cmd}")
        else:
            # plain text → send to active channel
            if not token:
                print("  ⚠️  Login first"); continue
            if not active_room and not active_dm:
                print("  ⚠️  Join a room (/join) or open a DM (/dm) first"); continue
            send_chat(line)

if __name__ == "__main__":
    main()
