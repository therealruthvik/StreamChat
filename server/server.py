"""
gRPC Chat Server — full featured
Auth · Friends · Group Rooms · DMs · Online Status · SQLite
"""

import grpc, jwt, bcrypt, sqlite3, threading, uuid, logging, time
from concurrent import futures
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import queue as _queue

import chat_pb2, chat_pb2_grpc

JWT_SECRET  = "change-me-in-prod-seriously-use-32chars!"
JWT_EXPIRY  = 48   # hours
DB_PATH     = "chat.db"
PORT        = "50051"
ONLINE_TTL  = 30   # seconds without heartbeat = offline

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ─── DB ──────────────────────────────────────────────────────────────────────

def get_db():
    c = sqlite3.connect(DB_PATH, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            username     TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at   TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS friends (
            user_a   TEXT,
            user_b   TEXT,
            status   TEXT DEFAULT 'pending',  -- pending | accepted
            requester TEXT,
            created_at TEXT,
            PRIMARY KEY (user_a, user_b)
        );
        CREATE TABLE IF NOT EXISTS rooms (
            room_id   TEXT PRIMARY KEY,
            room_name TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS room_members (
            room_id  TEXT,
            username TEXT,
            PRIMARY KEY (room_id, username)
        );
        CREATE TABLE IF NOT EXISTS messages (
            msg_id    TEXT PRIMARY KEY,
            sender    TEXT NOT NULL,
            display_name TEXT NOT NULL,
            room_id   TEXT,
            to_user   TEXT,
            content   TEXT NOT NULL,
            timestamp TEXT NOT NULL
        );
    """)
    db.commit(); db.close()
    log.info("DB ready at %s", DB_PATH)

# ─── JWT ─────────────────────────────────────────────────────────────────────

def make_token(username):
    return jwt.encode(
        {"sub": username, "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY)},
        JWT_SECRET, algorithm="HS256"
    )

def check_token(token):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])["sub"]
    except:
        return None

# ─── Online tracking ─────────────────────────────────────────────────────────

_online: dict[str, float] = {}   # username → last heartbeat epoch
_online_lock = threading.Lock()

def mark_online(username):
    with _online_lock:
        _online[username] = time.time()

def is_online(username) -> bool:
    with _online_lock:
        ts = _online.get(username, 0)
    return (time.time() - ts) < ONLINE_TTL

# ─── Pub/Sub broker ──────────────────────────────────────────────────────────

class Broker:
    def __init__(self):
        self._lock = threading.Lock()
        self._subs: dict[str, list] = defaultdict(list)

    @staticmethod
    def dm_key(a, b): return "dm:" + ":".join(sorted([a, b]))

    def subscribe(self, key):
        q = _queue.Queue()
        with self._lock: self._subs[key].append(q)
        return q

    def unsubscribe(self, key, q):
        with self._lock:
            try: self._subs[key].remove(q)
            except ValueError: pass

    def publish(self, key, msg):
        with self._lock: qs = list(self._subs.get(key, []))
        for q in qs: q.put(msg)

broker = Broker()

# ─── Friend helpers ──────────────────────────────────────────────────────────

def _friend_key(a, b):
    return tuple(sorted([a, b]))

def get_friend_status(db, me, other):
    a, b = _friend_key(me, other)
    row = db.execute("SELECT status, requester FROM friends WHERE user_a=? AND user_b=?", (a,b)).fetchone()
    if not row: return "none"
    if row["status"] == "accepted": return "friends"
    if row["requester"] == me: return "sent"
    return "pending"

# ─── Servicer ────────────────────────────────────────────────────────────────

class ChatServicer(chat_pb2_grpc.ChatServiceServicer):

    # Auth ────────────────────────────────────────────────────────────────────

    def Register(self, req, ctx):
        if not req.username or not req.password:
            return chat_pb2.AuthResponse(success=False, message="username/password required")
        db = get_db()
        try:
            if db.execute("SELECT 1 FROM users WHERE username=?", (req.username,)).fetchone():
                return chat_pb2.AuthResponse(success=False, message="Username taken")
            h = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
            dn = req.display_name or req.username
            db.execute("INSERT INTO users VALUES (?,?,?,?)",
                       (req.username, dn, h, datetime.now(timezone.utc).isoformat()))
            db.commit()
            return chat_pb2.AuthResponse(success=True, token=make_token(req.username),
                                         username=req.username, display_name=dn, message="OK")
        finally: db.close()

    def Login(self, req, ctx):
        db = get_db()
        try:
            row = db.execute("SELECT * FROM users WHERE username=?", (req.username,)).fetchone()
            if not row or not bcrypt.checkpw(req.password.encode(), row["password_hash"].encode()):
                return chat_pb2.AuthResponse(success=False, message="Invalid credentials")
            mark_online(req.username)
            return chat_pb2.AuthResponse(success=True, token=make_token(req.username),
                                         username=req.username, display_name=row["display_name"], message="OK")
        finally: db.close()

    # Users / Friends ─────────────────────────────────────────────────────────

    def SearchUsers(self, req, ctx):
        me = check_token(req.token)
        if not me: ctx.abort(grpc.StatusCode.UNAUTHENTICATED, "bad token")
        db = get_db()
        try:
            rows = db.execute(
                "SELECT username, display_name FROM users WHERE username LIKE ? AND username != ? LIMIT 20",
                (f"%{req.query}%", me)
            ).fetchall()
            users = []
            for r in rows:
                users.append(chat_pb2.UserInfo(
                    username=r["username"], display_name=r["display_name"],
                    online=is_online(r["username"]),
                    friend_status=get_friend_status(db, me, r["username"])
                ))
            return chat_pb2.SearchResponse(users=users)
        finally: db.close()

    def SendFriendRequest(self, req, ctx):
        me = check_token(req.token)
        if not me: ctx.abort(grpc.StatusCode.UNAUTHENTICATED, "bad token")
        db = get_db()
        try:
            if not db.execute("SELECT 1 FROM users WHERE username=?", (req.to_username,)).fetchone():
                return chat_pb2.FriendResponse(success=False, message="User not found")
            a, b = _friend_key(me, req.to_username)
            existing = db.execute("SELECT status FROM friends WHERE user_a=? AND user_b=?", (a,b)).fetchone()
            if existing:
                return chat_pb2.FriendResponse(success=False, message="Request already exists")
            db.execute("INSERT INTO friends VALUES (?,?,?,?,?)",
                       (a, b, "pending", me, datetime.now(timezone.utc).isoformat()))
            db.commit()
            return chat_pb2.FriendResponse(success=True, message="Request sent")
        finally: db.close()

    def RespondFriend(self, req, ctx):
        me = check_token(req.token)
        if not me: ctx.abort(grpc.StatusCode.UNAUTHENTICATED, "bad token")
        db = get_db()
        try:
            a, b = _friend_key(me, req.from_username)
            row = db.execute("SELECT * FROM friends WHERE user_a=? AND user_b=?", (a,b)).fetchone()
            if not row or row["requester"] == me:
                return chat_pb2.FriendResponse(success=False, message="No pending request")
            if req.accept:
                db.execute("UPDATE friends SET status='accepted' WHERE user_a=? AND user_b=?", (a,b))
                msg = "Friend added"
            else:
                db.execute("DELETE FROM friends WHERE user_a=? AND user_b=?", (a,b))
                msg = "Request declined"
            db.commit()
            return chat_pb2.FriendResponse(success=True, message=msg)
        finally: db.close()

    def GetFriends(self, req, ctx):
        me = check_token(req.token)
        if not me: ctx.abort(grpc.StatusCode.UNAUTHENTICATED, "bad token")
        db = get_db()
        try:
            rows = db.execute(
                "SELECT user_a, user_b FROM friends WHERE (user_a=? OR user_b=?) AND status='accepted'",
                (me, me)
            ).fetchall()
            friends = []
            for r in rows:
                other = r["user_b"] if r["user_a"] == me else r["user_a"]
                u = db.execute("SELECT display_name FROM users WHERE username=?", (other,)).fetchone()
                friends.append(chat_pb2.UserInfo(
                    username=other, display_name=u["display_name"] if u else other,
                    online=is_online(other), friend_status="friends"
                ))
            return chat_pb2.FriendListResponse(friends=friends)
        finally: db.close()

    def GetPendingRequests(self, req, ctx):
        me = check_token(req.token)
        if not me: ctx.abort(grpc.StatusCode.UNAUTHENTICATED, "bad token")
        db = get_db()
        try:
            rows = db.execute(
                "SELECT user_a, user_b, requester FROM friends WHERE (user_a=? OR user_b=?) AND status='pending'",
                (me, me)
            ).fetchall()
            pending = []
            for r in rows:
                if r["requester"] == me: continue  # sent by me, not incoming
                other = r["user_b"] if r["user_a"] == me else r["user_a"]
                u = db.execute("SELECT display_name FROM users WHERE username=?", (other,)).fetchone()
                pending.append(chat_pb2.UserInfo(
                    username=other, display_name=u["display_name"] if u else other,
                    online=is_online(other), friend_status="pending"
                ))
            return chat_pb2.PendingResponse(requests=pending)
        finally: db.close()

    # Rooms ───────────────────────────────────────────────────────────────────

    def CreateRoom(self, req, ctx):
        me = check_token(req.token)
        if not me: ctx.abort(grpc.StatusCode.UNAUTHENTICATED, "bad token")
        db = get_db()
        try:
            if db.execute("SELECT 1 FROM rooms WHERE room_name=?", (req.room_name,)).fetchone():
                return chat_pb2.RoomResponse(success=False, message="Name taken")
            rid = str(uuid.uuid4())[:8]
            db.execute("INSERT INTO rooms VALUES (?,?,?)", (rid, req.room_name, datetime.now(timezone.utc).isoformat()))
            db.execute("INSERT INTO room_members VALUES (?,?)", (rid, me))
            db.commit()
            return chat_pb2.RoomResponse(success=True, room_id=rid, room_name=req.room_name)
        finally: db.close()

    def JoinRoom(self, req, ctx):
        me = check_token(req.token)
        if not me: ctx.abort(grpc.StatusCode.UNAUTHENTICATED, "bad token")
        db = get_db()
        try:
            r = db.execute("SELECT * FROM rooms WHERE room_id=?", (req.room_id,)).fetchone()
            if not r: return chat_pb2.RoomResponse(success=False, message="Room not found")
            db.execute("INSERT OR IGNORE INTO room_members VALUES (?,?)", (req.room_id, me))
            db.commit()
            return chat_pb2.RoomResponse(success=True, room_id=r["room_id"], room_name=r["room_name"])
        finally: db.close()

    def ListRooms(self, req, ctx):
        if not check_token(req.token): ctx.abort(grpc.StatusCode.UNAUTHENTICATED, "bad token")
        db = get_db()
        try:
            rows = db.execute("""
                SELECT r.room_id, r.room_name, COUNT(m.username) as members
                FROM rooms r LEFT JOIN room_members m ON r.room_id=m.room_id
                GROUP BY r.room_id
            """).fetchall()
            return chat_pb2.ListRoomsResponse(rooms=[
                chat_pb2.Room(room_id=r["room_id"], room_name=r["room_name"], members=r["members"])
                for r in rows
            ])
        finally: db.close()

    # Chat streaming ──────────────────────────────────────────────────────────

    def ChatStream(self, request_iterator, ctx):
        me = None; sub_key = None; sub_q = None

        def read():
            nonlocal me, sub_key, sub_q
            for msg in request_iterator:
                if not me:
                    me = check_token(msg.token)
                    if not me: ctx.abort(grpc.StatusCode.UNAUTHENTICATED, "bad token"); return
                    mark_online(me)
                    sub_key = msg.room_id if msg.room_id else Broker.dm_key(me, msg.to_user)
                    sub_q   = broker.subscribe(sub_key)

                if msg.content == "__join__": continue

                db = get_db()
                u  = db.execute("SELECT display_name FROM users WHERE username=?", (me,)).fetchone()
                dn = u["display_name"] if u else me
                db.close()

                now = datetime.now(timezone.utc).isoformat()
                mid = str(uuid.uuid4())[:12]
                out = chat_pb2.ChatMessage(
                    msg_id=mid, sender=me, display_name=dn,
                    room_id=msg.room_id, to_user=msg.to_user,
                    content=msg.content, timestamp=now
                )
                db = get_db()
                db.execute("INSERT INTO messages VALUES (?,?,?,?,?,?,?)",
                           (mid, me, dn, msg.room_id or None, msg.to_user or None, msg.content, now))
                db.commit(); db.close()
                broker.publish(sub_key, out)

        t = threading.Thread(target=read, daemon=True); t.start()

        timeout = 10; elapsed = 0
        while sub_q is None and elapsed < timeout:
            time.sleep(0.1); elapsed += 0.1
        if sub_q is None: return

        try:
            while ctx.is_active():
                try: yield sub_q.get(timeout=1)
                except _queue.Empty: continue
        finally:
            if sub_key and sub_q: broker.unsubscribe(sub_key, sub_q)

    def GetHistory(self, req, ctx):
        me = check_token(req.token)
        if not me: ctx.abort(grpc.StatusCode.UNAUTHENTICATED, "bad token")
        limit = req.limit if req.limit > 0 else 50
        db = get_db()
        try:
            if req.room_id:
                rows = db.execute(
                    "SELECT * FROM messages WHERE room_id=? ORDER BY timestamp DESC LIMIT ?",
                    (req.room_id, limit)).fetchall()
            else:
                rows = db.execute(
                    """SELECT * FROM messages WHERE
                       (sender=? AND to_user=?) OR (sender=? AND to_user=?)
                       ORDER BY timestamp DESC LIMIT ?""",
                    (me, req.to_user, req.to_user, me, limit)).fetchall()
            return chat_pb2.HistoryResponse(messages=[
                chat_pb2.ChatMessage(
                    msg_id=r["msg_id"], sender=r["sender"], display_name=r["display_name"],
                    room_id=r["room_id"] or "", to_user=r["to_user"] or "",
                    content=r["content"], timestamp=r["timestamp"]
                ) for r in reversed(rows)
            ])
        finally: db.close()

    # Online status ───────────────────────────────────────────────────────────

    def Heartbeat(self, req, ctx):
        me = check_token(req.token)
        if me: mark_online(me)
        return chat_pb2.HeartbeatResponse(ok=bool(me))

    def GetOnlineStatus(self, req, ctx):
        if not check_token(req.token): ctx.abort(grpc.StatusCode.UNAUTHENTICATED, "bad token")
        return chat_pb2.OnlineStatusResponse(
            status={u: is_online(u) for u in req.usernames}
        )

# ─── Main ─────────────────────────────────────────────────────────────────────

def serve():
    init_db()
    s = grpc.server(futures.ThreadPoolExecutor(max_workers=20))
    chat_pb2_grpc.add_ChatServiceServicer_to_server(ChatServicer(), s)
    s.add_insecure_port(f"[::]:{PORT}")
    s.start()
    log.info("gRPC server on port %s", PORT)
    s.wait_for_termination()

if __name__ == "__main__":
    serve()
