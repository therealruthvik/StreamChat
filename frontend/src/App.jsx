import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";

// ─── API ─────────────────────────────────────────────────────────────────────

const API = "http://localhost:8001/api";

const api = {
  post: async (path, body, tok) => {
    const r = await fetch(`${API}${path}`, {
      method: "POST", headers: {
        "Content-Type": "application/json",
        ...(tok ? { Authorization: `Bearer ${tok}` } : {})
      }, body: JSON.stringify(body)
    });
    return r.json();
  },
  get: async (path, tok, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const r = await fetch(`${API}${path}${qs ? "?" + qs : ""}`, {
      headers: tok ? { Authorization: `Bearer ${tok}` } : {}
    });
    return r.json();
  }
};

// ─── Auth Context ────────────────────────────────────────────────────────────

const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);

// ─── Utilities ───────────────────────────────────────────────────────────────

const fmt = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const initials = (name) =>
  name?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";

const COLORS = ["#6366f1","#8b5cf6","#ec4899","#14b8a6","#f59e0b","#10b981","#3b82f6","#f43f5e"];
const avatarColor = (name) => COLORS[name?.charCodeAt(0) % COLORS.length || 0];

// ─── Components ──────────────────────────────────────────────────────────────

function Avatar({ name, size = 36, online }) {
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: `linear-gradient(135deg, ${avatarColor(name)}, ${avatarColor(name + "x")})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.35, fontWeight: 700, color: "#fff",
        fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.02em"
      }}>
        {initials(name)}
      </div>
      {online !== undefined && (
        <div style={{
          position: "absolute", bottom: 0, right: 0,
          width: size * 0.28, height: size * 0.28,
          borderRadius: "50%", border: "2px solid #0f1117",
          background: online ? "#22c55e" : "#4b5563"
        }} />
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
      <div style={{
        width: 24, height: 24, borderRadius: "50%",
        border: "2px solid #1e2330", borderTopColor: "#6366f1",
        animation: "spin 0.7s linear infinite"
      }} />
    </div>
  );
}

// ─── Login / Register ────────────────────────────────────────────────────────

function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", password: "", display_name: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr(""); setLoading(true);
    try {
      const r = await api.post(`/${mode}`, form);
      if (r.success) onAuth(r);
      else setErr(r.message);
    } catch { setErr("Server unreachable"); }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#080b12",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{
        width: 420, background: "#0f1117",
        border: "1px solid #1e2330", borderRadius: 20,
        padding: "48px 40px", boxShadow: "0 32px 80px rgba(0,0,0,0.6)"
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26
          }}>💬</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.03em" }}>
            StreamChat
          </h1>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </p>
        </div>

        {/* Toggle */}
        <div style={{
          display: "flex", background: "#1a1f2e", borderRadius: 10,
          padding: 4, marginBottom: 28
        }}>
          {["login","register"].map(m => (
            <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{
              flex: 1, padding: "8px 0", border: "none", borderRadius: 8,
              background: mode === m ? "#6366f1" : "transparent",
              color: mode === m ? "#fff" : "#64748b",
              fontWeight: 600, fontSize: 14, cursor: "pointer",
              fontFamily: "inherit", transition: "all 0.2s"
            }}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        {/* Fields */}
        {mode === "register" && (
          <Input label="Display Name" value={form.display_name}
            onChange={v => setForm(f => ({ ...f, display_name: v }))}
            placeholder="Your Name" />
        )}
        <Input label="Username" value={form.username}
          onChange={v => setForm(f => ({ ...f, username: v }))}
          placeholder="username" />
        <Input label="Password" value={form.password} type="password"
          onChange={v => setForm(f => ({ ...f, password: v }))}
          placeholder="••••••••" onEnter={submit} />

        {err && (
          <div style={{
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            color: "#f87171", borderRadius: 8, padding: "10px 14px",
            fontSize: 13, marginBottom: 20
          }}>{err}</div>
        )}

        <button onClick={submit} disabled={loading} style={{
          width: "100%", padding: "13px 0", border: "none", borderRadius: 12,
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
          fontFamily: "inherit", opacity: loading ? 0.7 : 1,
          boxShadow: "0 4px 20px rgba(99,102,241,0.35)"
        }}>
          {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder, onEnter }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onEnter?.()}
        style={{
          width: "100%", padding: "11px 14px", background: "#1a1f2e",
          border: "1px solid #1e2330", borderRadius: 10, color: "#f1f5f9",
          fontSize: 14, fontFamily: "inherit", outline: "none",
          boxSizing: "border-box", transition: "border-color 0.2s"
        }}
        onFocus={e => e.target.style.borderColor = "#6366f1"}
        onBlur={e => e.target.style.borderColor = "#1e2330"}
      />
    </div>
  );
}

// ─── Main App Shell ──────────────────────────────────────────────────────────

function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("chat_user")); } catch { return null; }
  });

  const onAuth = (data) => {
    localStorage.setItem("chat_user", JSON.stringify(data));
    setUser(data);
  };

  const logout = () => {
    localStorage.removeItem("chat_user");
    setUser(null);
  };

  // Heartbeat
  useEffect(() => {
    if (!user) return;
    const hb = () => api.post("/heartbeat", {}, user.token);
    hb();
    const iv = setInterval(hb, 15000);
    return () => clearInterval(iv);
  }, [user]);

  if (!user) return <AuthPage onAuth={onAuth} />;
  return (
    <AuthCtx.Provider value={user}>
      <ChatShell onLogout={logout} />
    </AuthCtx.Provider>
  );
}

// ─── Chat Shell ──────────────────────────────────────────────────────────────

function ChatShell({ onLogout }) {
  const user = useAuth();
  const [tab, setTab] = useState("friends");       // friends | rooms | search | pending
  const [friends, setFriends] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [pending, setPending] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // {type:'dm'|'room', id, name}
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [newRoom, setNewRoom] = useState("");
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [sidebarLoading, setSidebarLoading] = useState(false);

  const loadFriends = useCallback(async () => {
    const r = await api.get("/friends", user.token);
    setFriends(r.friends || []);
  }, [user.token]);

  const loadRooms = useCallback(async () => {
    const r = await api.get("/rooms", user.token);
    setRooms(r.rooms || []);
  }, [user.token]);

  const loadPending = useCallback(async () => {
    const r = await api.get("/friends/pending", user.token);
    setPending(r.requests || []);
  }, [user.token]);

  useEffect(() => {
    loadFriends(); loadRooms(); loadPending();
    const iv = setInterval(() => { loadFriends(); loadPending(); }, 10000);
    return () => clearInterval(iv);
  }, [loadFriends, loadRooms, loadPending]);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setSearchResults([]); return; }
    const r = await api.get("/users/search", user.token, { q });
    setSearchResults(r.users || []);
  }, [user.token]);

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(t);
  }, [search, doSearch]);

  const sendFriendReq = async (to) => {
    await api.post("/friends/request", { to_username: to }, user.token);
    doSearch(search);
  };

  const respondFriend = async (from, accept) => {
    await api.post("/friends/respond", { from_username: from, accept }, user.token);
    loadFriends(); loadPending();
  };

  const createRoom = async () => {
    if (!newRoom.trim()) return;
    const r = await api.post("/rooms", { room_name: newRoom }, user.token);
    if (r.success) { setNewRoom(""); setShowNewRoom(false); loadRooms(); }
  };

  const joinRoom = async (room_id) => {
    await api.post(`/rooms/${room_id}/join`, {}, user.token);
    loadRooms();
    const rm = rooms.find(r => r.room_id === room_id);
    if (rm) setActiveChat({ type: "room", id: room_id, name: rm.room_name });
  };

  const SIDEBAR_W = 300;

  return (
    <div style={{
      height: "100vh", display: "flex", background: "#080b12",
      fontFamily: "'DM Sans', sans-serif", overflow: "hidden", color: "#f1f5f9"
    }}>
      {/* Sidebar */}
      <div style={{
        width: SIDEBAR_W, display: "flex", flexDirection: "column",
        borderRight: "1px solid #1e2330", background: "#0c0f1a", flexShrink: 0
      }}>
        {/* User header */}
        <div style={{
          padding: "20px 16px", borderBottom: "1px solid #1e2330",
          display: "flex", alignItems: "center", gap: 12
        }}>
          <Avatar name={user.display_name} size={40} online={true} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user.display_name}
            </div>
            <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>● Online</div>
          </div>
          <button onClick={onLogout} title="Logout" style={{
            background: "none", border: "none", color: "#475569",
            cursor: "pointer", fontSize: 18, padding: 4, borderRadius: 6,
            lineHeight: 1
          }}>⎋</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #1e2330" }}>
          {[["friends","👥"],["rooms","#"],["search","🔍"],["pending","🔔"]].map(([t, ic]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "10px 0", border: "none",
              background: tab === t ? "#13172a" : "transparent",
              color: tab === t ? "#6366f1" : "#475569",
              cursor: "pointer", fontSize: 13, fontFamily: "inherit",
              fontWeight: 600, borderBottom: tab === t ? "2px solid #6366f1" : "2px solid transparent",
              position: "relative"
            }}>
              {ic}
              {t === "pending" && pending.length > 0 && (
                <span style={{
                  position: "absolute", top: 4, right: 4,
                  background: "#ef4444", color: "#fff",
                  borderRadius: "50%", width: 16, height: 16,
                  fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800
                }}>{pending.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div style={{ flex: 1, overflowY: "auto" }}>

          {tab === "friends" && (
            <div>
              <div style={{ padding: "12px 16px 4px", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Direct Messages
              </div>
              {friends.length === 0 && (
                <div style={{ padding: "24px 16px", color: "#475569", fontSize: 13, textAlign: "center" }}>
                  No friends yet.<br/>Search to add people!
                </div>
              )}
              {friends.map(f => (
                <SidebarItem key={f.username}
                  name={f.display_name} sub={`@${f.username}`}
                  online={f.online}
                  active={activeChat?.id === f.username}
                  onClick={() => setActiveChat({ type: "dm", id: f.username, name: f.display_name })}
                />
              ))}
            </div>
          )}

          {tab === "rooms" && (
            <div>
              <div style={{ padding: "12px 16px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>Rooms</span>
                <button onClick={() => setShowNewRoom(v => !v)} style={{
                  background: "none", border: "none", color: "#6366f1",
                  cursor: "pointer", fontSize: 20, lineHeight: 1, fontWeight: 300
                }}>+</button>
              </div>
              {showNewRoom && (
                <div style={{ padding: "0 12px 12px", display: "flex", gap: 8 }}>
                  <input value={newRoom} onChange={e => setNewRoom(e.target.value)}
                    placeholder="room-name" onKeyDown={e => e.key === "Enter" && createRoom()}
                    style={{
                      flex: 1, padding: "8px 10px", background: "#1a1f2e",
                      border: "1px solid #1e2330", borderRadius: 8,
                      color: "#f1f5f9", fontSize: 13, fontFamily: "inherit", outline: "none"
                    }} />
                  <button onClick={createRoom} style={{
                    padding: "8px 12px", background: "#6366f1", border: "none",
                    borderRadius: 8, color: "#fff", cursor: "pointer",
                    fontFamily: "inherit", fontWeight: 700, fontSize: 13
                  }}>Go</button>
                </div>
              )}
              {rooms.map(r => (
                <SidebarItem key={r.room_id}
                  name={`# ${r.room_name}`} sub={`${r.members} member${r.members !== 1 ? "s" : ""}`}
                  active={activeChat?.id === r.room_id}
                  onClick={() => {
                    setActiveChat({ type: "room", id: r.room_id, name: r.room_name });
                    joinRoom(r.room_id);
                  }}
                  isRoom
                />
              ))}
            </div>
          )}

          {tab === "search" && (
            <div>
              <div style={{ padding: 12 }}>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by username…" autoFocus
                  style={{
                    width: "100%", padding: "10px 12px", background: "#1a1f2e",
                    border: "1px solid #1e2330", borderRadius: 10,
                    color: "#f1f5f9", fontSize: 14, fontFamily: "inherit",
                    outline: "none", boxSizing: "border-box"
                  }} />
              </div>
              {searchResults.map(u => (
                <div key={u.username} style={{
                  padding: "10px 16px", display: "flex",
                  alignItems: "center", gap: 12
                }}>
                  <Avatar name={u.display_name} size={36} online={u.online} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#f1f5f9" }}>{u.display_name}</div>
                    <div style={{ fontSize: 12, color: "#475569" }}>@{u.username}</div>
                  </div>
                  {u.friend_status === "none" && (
                    <button onClick={() => sendFriendReq(u.username)} style={addBtnStyle}>Add</button>
                  )}
                  {u.friend_status === "sent" && (
                    <span style={{ fontSize: 12, color: "#64748b" }}>Sent</span>
                  )}
                  {u.friend_status === "friends" && (
                    <span style={{ fontSize: 12, color: "#22c55e" }}>✓</span>
                  )}
                  {u.friend_status === "pending" && (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => respondFriend(u.username, true)} style={{ ...addBtnStyle, background: "#22c55e" }}>✓</button>
                      <button onClick={() => respondFriend(u.username, false)} style={{ ...addBtnStyle, background: "#ef4444" }}>✕</button>
                    </div>
                  )}
                </div>
              ))}
              {search && searchResults.length === 0 && (
                <div style={{ padding: "24px 16px", color: "#475569", fontSize: 13, textAlign: "center" }}>No users found</div>
              )}
            </div>
          )}

          {tab === "pending" && (
            <div>
              <div style={{ padding: "12px 16px 4px", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Friend Requests
              </div>
              {pending.length === 0 && (
                <div style={{ padding: "24px 16px", color: "#475569", fontSize: 13, textAlign: "center" }}>No pending requests</div>
              )}
              {pending.map(u => (
                <div key={u.username} style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar name={u.display_name} size={36} online={u.online} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#f1f5f9" }}>{u.display_name}</div>
                    <div style={{ fontSize: 12, color: "#475569" }}>@{u.username}</div>
                  </div>
                  <button onClick={() => respondFriend(u.username, true)}
                    style={{ ...addBtnStyle, background: "#22c55e" }}>✓</button>
                  <button onClick={() => respondFriend(u.username, false)}
                    style={{ ...addBtnStyle, background: "#ef4444" }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {activeChat
          ? <ChatView chat={activeChat} />
          : <EmptyState />
        }
      </div>
    </div>
  );
}

const addBtnStyle = {
  padding: "5px 12px", background: "#6366f1", border: "none",
  borderRadius: 6, color: "#fff", cursor: "pointer",
  fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 12
};

function SidebarItem({ name, sub, online, active, onClick, isRoom }) {
  return (
    <div onClick={onClick} style={{
      padding: "10px 16px", display: "flex", alignItems: "center", gap: 12,
      cursor: "pointer", background: active ? "#13172a" : "transparent",
      borderLeft: active ? "3px solid #6366f1" : "3px solid transparent",
      transition: "all 0.15s"
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#0f1320"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {isRoom
        ? <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "#1a1f2e", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#6366f1"
          }}>#</div>
        : <Avatar name={name} size={36} online={online} />
      }
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ fontSize: 12, color: "#475569" }}>{sub}</div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16, color: "#334155"
    }}>
      <div style={{ fontSize: 64 }}>💬</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#475569" }}>Select a conversation</div>
      <div style={{ fontSize: 14, color: "#334155" }}>Choose a friend or room from the sidebar</div>
    </div>
  );
}

// ─── Chat View ───────────────────────────────────────────────────────────────

function ChatView({ chat }) {
  const user = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const esRef = useRef(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const params = chat.type === "room"
      ? { room_id: chat.id }
      : { to_user: chat.id };
    const r = await api.get("/history", user.token, { ...params, limit: 60 });
    setMessages(r.messages || []);
    setLoading(false);
  }, [chat.id, chat.type, user.token]);

  useEffect(() => {
    setMessages([]);
    loadHistory();

    // SSE stream
    const params = new URLSearchParams({
      token: user.token,
      me: user.username,
      ...(chat.type === "room" ? { room_id: chat.id } : { to_user: chat.id })
    });
    const es = new EventSource(`http://localhost:8001/api/stream?${params}`);
    esRef.current = es;

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "connected") return;
      setMessages(prev => {
        if (prev.some(m => m.msg_id === data.msg_id)) return prev;
        return [...prev, data];
      });
    };

    return () => { es.close(); };
  }, [chat.id, chat.type]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const content = input.trim();
    setInput("");
    await api.post("/send", {
      sender: user.username,
      ...(chat.type === "room" ? { room_id: chat.id } : { to_user: chat.id }),
      content
    }, user.token);
  };

  // Group consecutive messages from same sender
  const grouped = messages.reduce((acc, m, i) => {
    const prev = messages[i - 1];
    const isFirst = !prev || prev.sender !== m.sender ||
      (new Date(m.timestamp) - new Date(prev.timestamp)) > 5 * 60000;
    acc.push({ ...m, isFirst });
    return acc;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        padding: "16px 24px", borderBottom: "1px solid #1e2330",
        display: "flex", alignItems: "center", gap: 12,
        background: "#0c0f1a"
      }}>
        {chat.type === "dm"
          ? <Avatar name={chat.name} size={38} />
          : <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "#1a1f2e", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 18, color: "#6366f1", fontWeight: 800
            }}>#</div>
        }
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#f1f5f9" }}>
            {chat.type === "dm" ? chat.name : `# ${chat.name}`}
          </div>
          <div style={{ fontSize: 12, color: "#475569" }}>
            {chat.type === "dm" ? `@${chat.id}` : "Group room"}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
        {loading && <Spinner />}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: "center", color: "#334155", paddingTop: 60, fontSize: 14 }}>
            No messages yet. Say hello! 👋
          </div>
        )}
        {grouped.map((m) => (
          <MessageBubble key={m.msg_id} msg={m} isMe={m.sender === user.username} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "16px 24px", borderTop: "1px solid #1e2330",
        background: "#0c0f1a"
      }}>
        <div style={{
          display: "flex", gap: 12, alignItems: "flex-end",
          background: "#1a1f2e", borderRadius: 14,
          border: "1px solid #1e2330", padding: "8px 8px 8px 16px"
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder={`Message ${chat.type === "room" ? "#" + chat.name : chat.name}…`}
            rows={1}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "#f1f5f9", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
              resize: "none", lineHeight: 1.5, maxHeight: 120, overflowY: "auto"
            }}
          />
          <button onClick={send} disabled={!input.trim()} style={{
            width: 38, height: 38, borderRadius: 10, border: "none",
            background: input.trim() ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#1e2330",
            color: "#fff", cursor: input.trim() ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, flexShrink: 0, transition: "all 0.2s"
          }}>➤</button>
        </div>
        <div style={{ fontSize: 11, color: "#334155", marginTop: 6, paddingLeft: 4 }}>
          Enter to send · Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, isMe }) {
  return (
    <div style={{
      display: "flex", gap: 10, marginBottom: msg.isFirst ? 16 : 4,
      flexDirection: isMe ? "row-reverse" : "row",
      alignItems: "flex-end"
    }}>
      {msg.isFirst && !isMe && <Avatar name={msg.display_name} size={32} />}
      {msg.isFirst && isMe && <div style={{ width: 32 }} />}
      {!msg.isFirst && <div style={{ width: 32 + 10 }} />}

      <div style={{ maxWidth: "65%", minWidth: 0 }}>
        {msg.isFirst && !isMe && (
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>
            {msg.display_name}
            <span style={{ fontWeight: 400, marginLeft: 8 }}>{fmt(msg.timestamp)}</span>
          </div>
        )}
        <div style={{
          padding: "9px 14px",
          background: isMe
            ? "linear-gradient(135deg, #6366f1, #7c3aed)"
            : "#1a1f2e",
          color: "#f1f5f9", borderRadius: isMe
            ? "18px 18px 4px 18px"
            : "18px 18px 18px 4px",
          fontSize: 14, lineHeight: 1.5,
          border: isMe ? "none" : "1px solid #1e2330",
          wordBreak: "break-word"
        }}>
          {msg.content}
        </div>
        {msg.isFirst && isMe && (
          <div style={{ fontSize: 11, color: "#475569", textAlign: "right", marginTop: 3 }}>
            {fmt(msg.timestamp)}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
