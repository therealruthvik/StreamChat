import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";

const API = "http://localhost:8001/api";
const api = {
  post: async (path, body, tok) => {
    const r = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
      body: JSON.stringify(body)
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

const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);

const fmt = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  const diffMins = Math.floor((Date.now() - d) / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const initials = (name) => name?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
const COLORS = ["#1877F2","#42B72A","#F7B928","#F02849","#8B5CF6","#06B6D4"];
const avatarColor = (name) => COLORS[(name?.charCodeAt(0) || 0) % COLORS.length];

const isImg = (c) => c?.startsWith("[IMG]");
const parseImg = (c) => { const p = c.slice(5).split("|||"); return { src: p[0], text: p[1] || "" }; };

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36, online }) {
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: avatarColor(name),
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.38, fontWeight: 700, color: "#fff"
      }}>{initials(name)}</div>
      {online !== undefined && (
        <div style={{
          position: "absolute", bottom: 1, right: 1,
          width: Math.max(10, size * 0.28), height: Math.max(10, size * 0.28),
          borderRadius: "50%", border: "2px solid #fff",
          background: online ? "#31A24C" : "#CED0D4"
        }} />
      )}
    </div>
  );
}

// ─── Auth Page ────────────────────────────────────────────────────────────────
function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", password: "", display_name: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr(""); setLoading(true);
    try {
      const r = await api.post(`/${mode}`, form);
      if (r.success) onAuth(r); else setErr(r.message);
    } catch { setErr("Server unreachable"); }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#F0F2F5",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: SYS, gap: 48, padding: "0 16px", flexWrap: "wrap"
    }}>
      <div style={{ maxWidth: 360 }}>
        <div style={{ fontSize: 52, fontWeight: 900, color: "#1877F2", fontStyle: "italic", marginBottom: 12 }}>
          streamchat
        </div>
        <div style={{ fontSize: 22, color: "#1C1E21", lineHeight: 1.4 }}>
          Connect with friends and the world around you.
        </div>
      </div>

      <div style={{
        background: "#fff", borderRadius: 8, padding: 16, width: 396,
        boxShadow: "0 2px 4px rgba(0,0,0,0.1),0 8px 16px rgba(0,0,0,0.1)"
      }}>
        {mode === "register" && (
          <FbInput placeholder="Display Name" value={form.display_name}
            onChange={v => setForm(f => ({ ...f, display_name: v }))} />
        )}
        <FbInput placeholder="Username" value={form.username}
          onChange={v => setForm(f => ({ ...f, username: v }))} />
        <FbInput placeholder="Password" value={form.password} type="password"
          onChange={v => setForm(f => ({ ...f, password: v }))} onEnter={submit} />

        {err && <div style={{ color: "#F02849", fontSize: 13, marginBottom: 12, paddingLeft: 4 }}>{err}</div>}

        <button onClick={submit} disabled={loading} style={{
          width: "100%", padding: "14px 0", background: "#1877F2",
          border: "none", borderRadius: 6, color: "#fff",
          fontSize: 20, fontWeight: 700, cursor: loading ? "default" : "pointer",
          fontFamily: SYS, opacity: loading ? 0.7 : 1, marginBottom: 16
        }}>{loading ? "..." : mode === "login" ? "Log in" : "Sign Up"}</button>

        <div style={{ borderTop: "1px solid #CED0D4", paddingTop: 16, textAlign: "center" }}>
          {mode === "login"
            ? <button onClick={() => { setMode("register"); setErr(""); }} style={{
                background: "#42B72A", border: "none", borderRadius: 6,
                padding: "14px 24px", color: "#fff", fontSize: 17,
                fontWeight: 700, cursor: "pointer", fontFamily: SYS
              }}>Create new account</button>
            : <button onClick={() => { setMode("login"); setErr(""); }} style={{
                background: "none", border: "none", color: "#1877F2",
                fontSize: 14, cursor: "pointer", fontFamily: SYS, fontWeight: 600
              }}>Already have an account? Log in</button>
          }
        </div>
      </div>
    </div>
  );
}

function FbInput({ placeholder, value, onChange, type = "text", onEnter }) {
  const [focused, setFocused] = useState(false);
  return (
    <input type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => e.key === "Enter" && onEnter?.()}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        width: "100%", padding: "14px 16px", marginBottom: 12,
        border: `1px solid ${focused ? "#1877F2" : "#CED0D4"}`,
        borderRadius: 6, fontSize: 17, fontFamily: SYS,
        outline: "none", boxSizing: "border-box", color: "#1C1E21", background: "#fff"
      }} />
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("chat_user")); } catch { return null; }
  });

  const onAuth = (data) => { localStorage.setItem("chat_user", JSON.stringify(data)); setUser(data); };
  const logout = () => { localStorage.removeItem("chat_user"); setUser(null); };

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
      <FbShell onLogout={logout} />
    </AuthCtx.Provider>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────
function FbShell({ onLogout }) {
  const user = useAuth();
  const [friends, setFriends] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [pending, setPending] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [openDMs, setOpenDMs] = useState([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [nav, setNav] = useState("home");

  const loadFriends = useCallback(async () => {
    const r = await api.get("/friends", user.token); setFriends(r.friends || []);
  }, [user.token]);
  const loadRooms = useCallback(async () => {
    const r = await api.get("/rooms", user.token); setRooms(r.rooms || []);
  }, [user.token]);
  const loadPending = useCallback(async () => {
    const r = await api.get("/friends/pending", user.token); setPending(r.requests || []);
  }, [user.token]);

  useEffect(() => {
    loadFriends(); loadRooms(); loadPending();
    const iv = setInterval(() => { loadFriends(); loadPending(); }, 10000);
    return () => clearInterval(iv);
  }, [loadFriends, loadRooms, loadPending]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!search.trim()) { setSearchResults([]); return; }
      const r = await api.get("/users/search", user.token, { q: search });
      setSearchResults(r.users || []);
    }, 300);
    return () => clearTimeout(t);
  }, [search, user.token]);

  const openDM = (f) => setOpenDMs(prev =>
    prev.some(d => d.username === f.username) ? prev : [...prev, f].slice(-3)
  );
  const closeDM = (username) => setOpenDMs(prev => prev.filter(d => d.username !== username));

  const joinRoom = async (room) => {
    await api.post(`/rooms/${room.room_id}/join`, {}, user.token);
    setActiveRoom(room); setNav("groups");
  };

  const sendFriendReq = async (to) => {
    await api.post("/friends/request", { to_username: to }, user.token);
    const r = await api.get("/users/search", user.token, { q: search });
    setSearchResults(r.users || []);
  };

  const respondFriend = async (from, accept) => {
    await api.post("/friends/respond", { from_username: from, accept }, user.token);
    loadFriends(); loadPending();
  };

  const createRoom = async (name) => {
    const r = await api.post("/rooms", { room_name: name }, user.token);
    if (r.success) loadRooms();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F0F2F5", fontFamily: SYS, color: "#1C1E21" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: #CED0D4; border-radius: 4px; }
      `}</style>

      <TopNav
        pending={pending} onLogout={onLogout}
        search={search} setSearch={setSearch}
        searchResults={searchResults}
        nav={nav} setNav={setNav}
        sendFriendReq={sendFriendReq} openDM={openDM}
      />

      <div style={{ display: "flex", maxWidth: 1280, margin: "0 auto", paddingTop: 56 }}>
        <LeftNav
          rooms={rooms} pending={pending}
          nav={nav} setNav={setNav}
          activeRoom={activeRoom} onOpenRoom={joinRoom}
          onCreateRoom={createRoom}
        />

        <main style={{ flex: 1, padding: "20px 8px", minWidth: 0 }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            {(nav === "home" || nav === "groups") && (
              <FeedView activeRoom={activeRoom} rooms={rooms} onOpenRoom={joinRoom} nav={nav} />
            )}
            {nav === "friends" && (
              <FriendsView friends={friends} pending={pending} respondFriend={respondFriend} openDM={openDM} />
            )}
          </div>
        </main>

        <RightContacts friends={friends} onOpenDM={openDM} />
      </div>

      <div style={{ position: "fixed", bottom: 0, right: 16, display: "flex", gap: 12, alignItems: "flex-end", zIndex: 200 }}>
        {openDMs.map(dm => <ChatPopup key={dm.username} friend={dm} onClose={() => closeDM(dm.username)} />)}
      </div>
    </div>
  );
}

// ─── Top Nav ──────────────────────────────────────────────────────────────────
function TopNav({ pending, onLogout, search, setSearch, searchResults, nav, setNav, sendFriendReq, openDM }) {
  const user = useAuth();
  const [showSearch, setShowSearch] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, height: 56,
      background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      display: "flex", alignItems: "center", padding: "0 16px",
      zIndex: 100, gap: 8
    }}>
      {/* Logo */}
      <div onClick={() => setNav("home")} style={{
        width: 40, height: 40, borderRadius: "50%", background: "#1877F2",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 26, fontWeight: 900, color: "#fff", cursor: "pointer",
        fontStyle: "italic", flexShrink: 0
      }}>f</div>

      {/* Search */}
      <div style={{ position: "relative" }}>
        <div style={{
          background: "#F0F2F5", borderRadius: 20,
          display: "flex", alignItems: "center", padding: "0 12px",
          gap: 8, height: 40, width: showSearch ? 240 : 40,
          transition: "width 0.2s", overflow: "hidden", cursor: "text"
        }} onClick={() => setShowSearch(true)}>
          <span style={{ color: "#65676B", fontSize: 16, flexShrink: 0 }}>🔍</span>
          {showSearch && (
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              onBlur={() => { if (!search) setShowSearch(false); }}
              placeholder="Search StreamChat"
              style={{
                background: "none", border: "none", outline: "none",
                fontSize: 15, color: "#1C1E21", flex: 1, fontFamily: SYS, width: "100%"
              }} />
          )}
        </div>
        {showSearch && search && searchResults.length > 0 && (
          <div style={{
            position: "absolute", top: 44, left: 0, width: 320,
            background: "#fff", borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 200
          }}>
            {searchResults.map(u => (
              <div key={u.username} style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = "#F2F2F2"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <Avatar name={u.display_name} size={36} online={u.online} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{u.display_name}</div>
                  <div style={{ fontSize: 12, color: "#65676B" }}>@{u.username}</div>
                </div>
                {u.friend_status === "none" && (
                  <button onClick={() => sendFriendReq(u.username)} style={smallBtn("#1877F2")}>Add</button>
                )}
                {u.friend_status === "friends" && (
                  <button onClick={() => openDM({ username: u.username, display_name: u.display_name })}
                    style={smallBtn("#E4E6EB", "#1C1E21")}>Message</button>
                )}
                {u.friend_status === "sent" && <span style={{ fontSize: 12, color: "#65676B" }}>Sent</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Center nav */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", gap: 4 }}>
        {[["home","🏠","Home"],["friends","👥","Friends"],["groups","#️⃣","Groups"]].map(([id, icon, label]) => (
          <button key={id} onClick={() => setNav(id)} title={label} style={{
            padding: "0 28px", height: 48, border: "none",
            background: nav === id ? "#E7F3FF" : "none",
            borderBottom: `3px solid ${nav === id ? "#1877F2" : "transparent"}`,
            color: nav === id ? "#1877F2" : "#65676B",
            fontSize: 20, cursor: "pointer", borderRadius: "4px 4px 0 0",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: SYS, transition: "background 0.1s"
          }}>{icon}</button>
        ))}
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Notifs */}
        <div style={{ position: "relative" }}>
          <button onClick={() => { setShowNotifs(v => !v); setShowUserMenu(false); }} style={{
            width: 40, height: 40, borderRadius: "50%", background: "#E4E6EB",
            border: "none", cursor: "pointer", fontSize: 18,
            display: "flex", alignItems: "center", justifyContent: "center", position: "relative"
          }}>
            🔔
            {pending.length > 0 && (
              <span style={{
                position: "absolute", top: 0, right: 0,
                background: "#F02849", color: "#fff", borderRadius: "50%",
                width: 18, height: 18, fontSize: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, border: "2px solid #fff"
              }}>{pending.length}</span>
            )}
          </button>
          {showNotifs && (
            <div style={{
              position: "absolute", top: 44, right: 0, width: 280,
              background: "#fff", borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)", padding: 16, zIndex: 200
            }}>
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>Notifications</div>
              {pending.length === 0
                ? <div style={{ color: "#65676B", fontSize: 14 }}>No new notifications</div>
                : pending.map(u => (
                  <div key={u.username} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                    <Avatar name={u.display_name} size={40} />
                    <div style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{u.display_name}</span> sent you a friend request
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* User menu */}
        <div style={{ position: "relative" }}>
          <div onClick={() => { setShowUserMenu(v => !v); setShowNotifs(false); }} style={{ cursor: "pointer" }}>
            <Avatar name={user.display_name} size={40} />
          </div>
          {showUserMenu && (
            <div style={{
              position: "absolute", top: 44, right: 0, width: 220,
              background: "#fff", borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)", padding: 8, zIndex: 200
            }}>
              <div style={{ padding: "10px 12px", borderBottom: "1px solid #E4E6EB", marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{user.display_name}</div>
                <div style={{ fontSize: 12, color: "#65676B" }}>@{user.username}</div>
              </div>
              <button onClick={onLogout} style={{
                width: "100%", padding: "10px 12px", border: "none",
                background: "none", textAlign: "left", cursor: "pointer",
                borderRadius: 6, fontSize: 15, fontFamily: SYS, color: "#1C1E21"
              }}
                onMouseEnter={e => e.currentTarget.style.background = "#F2F2F2"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >🚪 Log Out</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Left Nav ─────────────────────────────────────────────────────────────────
function LeftNav({ rooms, pending, nav, setNav, activeRoom, onOpenRoom, onCreateRoom }) {
  const user = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreateRoom(newName.trim());
    setNewName(""); setShowCreate(false);
  };

  return (
    <div style={{
      width: 280, flexShrink: 0, padding: "16px 8px",
      position: "sticky", top: 56,
      height: "calc(100vh - 56px)", overflowY: "auto"
    }}>
      <NavRow icon={<Avatar name={user.display_name} size={36} online />}
        label={user.display_name} active={false} onClick={() => {}} bold />

      <div style={{ borderTop: "1px solid #E4E6EB", margin: "8px 0" }} />

      {[
        { id: "home", icon: "🏠", label: "Home" },
        { id: "friends", icon: "👥", label: "Friends", badge: pending.length },
        { id: "groups", icon: "#️⃣", label: "Groups" },
      ].map(item => (
        <NavRow key={item.id} icon={<span style={{ fontSize: 20 }}>{item.icon}</span>}
          label={item.label} badge={item.badge}
          active={nav === item.id} onClick={() => setNav(item.id)} />
      ))}

      <div style={{ borderTop: "1px solid #E4E6EB", margin: "8px 0" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Groups</span>
        <button onClick={() => setShowCreate(v => !v)} style={{
          background: "#E4E6EB", border: "none", borderRadius: "50%",
          width: 32, height: 32, fontSize: 22, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#1C1E21"
        }}>+</button>
      </div>

      {showCreate && (
        <div style={{ padding: "0 8px 8px", display: "flex", gap: 8 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Group name" autoFocus
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            style={{
              flex: 1, padding: "8px 12px", border: "1px solid #CED0D4",
              borderRadius: 6, fontSize: 14, outline: "none",
              fontFamily: SYS, color: "#1C1E21"
            }} />
          <button onClick={handleCreate} style={smallBtn("#1877F2")}>Create</button>
        </div>
      )}

      {rooms.map(r => (
        <NavRow key={r.room_id}
          icon={
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: "#1877F2",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800, color: "#fff"
            }}>#</div>
          }
          label={r.room_name}
          sub={`${r.members} member${r.members !== 1 ? "s" : ""}`}
          active={activeRoom?.room_id === r.room_id}
          onClick={() => onOpenRoom(r)}
        />
      ))}
    </div>
  );
}

function NavRow({ icon, label, sub, active, onClick, badge, bold }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "8px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 2,
      background: active ? "#E7F3FF" : hov ? "#E4E6EB" : "transparent",
      color: active ? "#1877F2" : "#1C1E21"
    }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    >
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: bold || active ? 700 : 500, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: "#65676B" }}>{sub}</div>}
      </div>
      {badge > 0 && (
        <span style={{
          background: "#F02849", color: "#fff", borderRadius: "50%",
          minWidth: 20, height: 20, fontSize: 11, padding: "0 4px",
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800
        }}>{badge}</span>
      )}
    </div>
  );
}

// ─── Right Contacts ───────────────────────────────────────────────────────────
function RightContacts({ friends, onOpenDM }) {
  return (
    <div style={{
      width: 280, flexShrink: 0, padding: "16px 8px",
      position: "sticky", top: 56,
      height: "calc(100vh - 56px)", overflowY: "auto"
    }}>
      <div style={{ padding: "0 12px", marginBottom: 8, fontWeight: 700, fontSize: 17 }}>Contacts</div>
      {friends.length === 0 && (
        <div style={{ padding: "12px", color: "#65676B", fontSize: 14 }}>
          No friends yet. Search to add people!
        </div>
      )}
      {[...friends].sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0)).map(f => (
        <NavRow key={f.username}
          icon={<Avatar name={f.display_name} size={36} online={f.online} />}
          label={f.display_name}
          sub={f.online ? "Active now" : "Offline"}
          active={false} onClick={() => onOpenDM(f)}
        />
      ))}
    </div>
  );
}

// ─── Feed View ────────────────────────────────────────────────────────────────
function FeedView({ activeRoom, rooms, onOpenRoom, nav }) {
  const user = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [postText, setPostText] = useState("");
  const [postImg, setPostImg] = useState(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!activeRoom) { setMessages([]); return; }
    setMessages([]); setLoading(true);
    api.get("/history", user.token, { room_id: activeRoom.room_id, limit: 60 })
      .then(r => { setMessages(r.messages || []); setLoading(false); });

    const params = new URLSearchParams({ token: user.token, me: user.username, room_id: activeRoom.room_id });
    const es = new EventSource(`http://localhost:8001/api/stream?${params}`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "connected") return;
      setMessages(prev => prev.some(m => m.msg_id === data.msg_id) ? prev : [data, ...prev]);
    };
    return () => es.close();
  }, [activeRoom?.room_id]);

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 900;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      setPostImg(canvas.toDataURL("image/jpeg", 0.75));
      URL.revokeObjectURL(url);
    };
    img.src = url;
    e.target.value = "";
  };

  const submitPost = async () => {
    if (!postText.trim() && !postImg) return;
    setPosting(true);
    const content = postImg ? `[IMG]${postImg}|||${postText}` : postText;
    await api.post("/send", { sender: user.username, room_id: activeRoom.room_id, content }, user.token);
    setPostText(""); setPostImg(null); setPosting(false);
  };

  // Groups landing
  if (nav === "groups" && !activeRoom) {
    return (
      <div>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>Your Groups</div>
        {rooms.length === 0 && (
          <Card style={{ padding: 32, textAlign: "center", color: "#65676B" }}>
            No groups yet. Create one from the left sidebar!
          </Card>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {rooms.map(r => (
            <div key={r.room_id} onClick={() => onOpenRoom(r)} style={{
              background: "#fff", borderRadius: 8, overflow: "hidden",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)", cursor: "pointer"
            }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.1)"}
            >
              <div style={{
                height: 80, background: "linear-gradient(135deg,#1877F2,#42B72A)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 32, fontWeight: 800, color: "#fff"
              }}>#</div>
              <div style={{ padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{r.room_name}</div>
                <div style={{ fontSize: 13, color: "#65676B" }}>{r.members} member{r.members !== 1 ? "s" : ""}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Home no room
  if (!activeRoom) {
    return (
      <Card style={{ padding: 48, textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>👥</div>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Welcome to StreamChat</div>
        <div style={{ color: "#65676B" }}>Join a group from the sidebar to see posts</div>
      </Card>
    );
  }

  const canPost = postText.trim() || postImg;

  return (
    <div>
      {/* Composer */}
      <Card style={{ padding: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <Avatar name={user.display_name} size={40} />
          <div style={{
            flex: 1, background: "#F0F2F5", borderRadius: 20,
            padding: "10px 16px", cursor: "text"
          }} onClick={() => document.getElementById("post-ta")?.focus()}>
            <textarea id="post-ta" value={postText}
              onChange={e => setPostText(e.target.value)}
              placeholder={`What's on your mind in #${activeRoom.room_name}?`}
              rows={postText ? 3 : 1}
              style={{
                width: "100%", background: "none", border: "none",
                outline: "none", fontSize: 16, fontFamily: SYS,
                color: "#1C1E21", resize: "none", lineHeight: 1.4
              }} />
          </div>
        </div>

        {postImg && (
          <div style={{ position: "relative", marginBottom: 10, borderRadius: 8, overflow: "hidden" }}>
            <img src={postImg} alt="preview" style={{ width: "100%", maxHeight: 300, objectFit: "cover", display: "block" }} />
            <button onClick={() => setPostImg(null)} style={{
              position: "absolute", top: 8, right: 8,
              background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%",
              width: 30, height: 30, color: "#fff", cursor: "pointer",
              fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center"
            }}>✕</button>
          </div>
        )}

        <div style={{ borderTop: "1px solid #E4E6EB", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 12px", border: "none", borderRadius: 6,
              background: "none", cursor: "pointer", color: "#45BD62",
              fontFamily: SYS, fontWeight: 600, fontSize: 14
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#F0F2F5"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >🖼️ Photo/Video</button>
          </div>
          <button onClick={submitPost} disabled={posting || !canPost} style={{
            padding: "8px 20px",
            background: canPost && !posting ? "#1877F2" : "#E4E6EB",
            border: "none", borderRadius: 6,
            color: canPost && !posting ? "#fff" : "#BCC0C4",
            fontWeight: 700, fontSize: 15,
            cursor: canPost && !posting ? "pointer" : "default",
            fontFamily: SYS
          }}>{posting ? "Posting…" : "Post"}</button>
        </div>
      </Card>

      {loading && <FbSpinner />}

      {!loading && messages.length === 0 && (
        <Card style={{ padding: 32, textAlign: "center", color: "#65676B" }}>
          No posts yet. Be the first to post!
        </Card>
      )}

      {[...messages]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .map(m => <PostCard key={m.msg_id} msg={m} />)
      }
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────
function PostCard({ msg }) {
  const hasImg = isImg(msg.content);
  const { src, text } = hasImg ? parseImg(msg.content) : { src: null, text: msg.content };
  const [liked, setLiked] = useState(false);

  return (
    <Card style={{ marginBottom: 16, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={msg.display_name} size={42} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{msg.display_name}</div>
          <div style={{ fontSize: 12, color: "#65676B" }}>{fmt(msg.timestamp)}</div>
        </div>
      </div>

      {text && <div style={{ padding: "0 16px 12px", fontSize: 15, lineHeight: 1.5 }}>{text}</div>}
      {src && <img src={src} alt="post" style={{ width: "100%", display: "block", maxHeight: 500, objectFit: "cover" }} />}

      <div style={{ borderTop: "1px solid #E4E6EB", padding: "2px 12px", display: "flex", gap: 4 }}>
        {[
          { label: "👍 Like", active: liked, onClick: () => setLiked(v => !v), color: "#1877F2" },
          { label: "💬 Comment", active: false, onClick: () => {} },
          { label: "↗ Share", active: false, onClick: () => {} },
        ].map(btn => (
          <button key={btn.label} onClick={btn.onClick} style={{
            flex: 1, padding: "8px 0", border: "none", background: "none",
            cursor: "pointer", fontSize: 14, fontWeight: 700,
            color: btn.active ? btn.color : "#65676B",
            borderRadius: 4, fontFamily: SYS
          }}
            onMouseEnter={e => e.currentTarget.style.background = "#F0F2F5"}
            onMouseLeave={e => e.currentTarget.style.background = "none"}
          >{btn.label}</button>
        ))}
      </div>
    </Card>
  );
}

// ─── Friends View ─────────────────────────────────────────────────────────────
function FriendsView({ friends, pending, respondFriend, openDM }) {
  return (
    <div>
      {pending.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>Friend Requests</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {pending.map(u => (
              <Card key={u.username} style={{ padding: 16 }}>
                <Avatar name={u.display_name} size={80} />
                <div style={{ fontWeight: 700, fontSize: 16, marginTop: 8 }}>{u.display_name}</div>
                <div style={{ fontSize: 13, color: "#65676B", marginBottom: 12 }}>@{u.username}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => respondFriend(u.username, true)} style={{
                    flex: 1, padding: "8px 0", background: "#1877F2", border: "none",
                    borderRadius: 6, color: "#fff", fontWeight: 700, fontSize: 14,
                    cursor: "pointer", fontFamily: SYS
                  }}>Confirm</button>
                  <button onClick={() => respondFriend(u.username, false)} style={{
                    flex: 1, padding: "8px 0", background: "#E4E6EB", border: "none",
                    borderRadius: 6, color: "#1C1E21", fontWeight: 700, fontSize: 14,
                    cursor: "pointer", fontFamily: SYS
                  }}>Delete</button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>All Friends ({friends.length})</div>
      {friends.length === 0 && (
        <Card style={{ padding: 32, textAlign: "center", color: "#65676B" }}>
          No friends yet. Use the search bar to find people!
        </Card>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {friends.map(f => (
          <Card key={f.username} style={{ padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar name={f.display_name} size={60} online={f.online} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{f.display_name}</div>
              <div style={{ fontSize: 12, color: f.online ? "#31A24C" : "#65676B" }}>
                {f.online ? "● Active now" : "Offline"}
              </div>
            </div>
            <button onClick={() => openDM(f)} style={smallBtn("#E4E6EB", "#1C1E21")}>Message</button>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Chat Popup ───────────────────────────────────────────────────────────────
function ChatPopup({ friend, onClose }) {
  const user = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [minimized, setMinimized] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    api.get("/history", user.token, { to_user: friend.username, limit: 40 })
      .then(r => setMessages(r.messages || []));

    const params = new URLSearchParams({ token: user.token, me: user.username, to_user: friend.username });
    const es = new EventSource(`http://localhost:8001/api/stream?${params}`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "connected") return;
      setMessages(prev => prev.some(m => m.msg_id === data.msg_id) ? prev : [...prev, data]);
    };
    return () => es.close();
  }, [friend.username]);

  useEffect(() => {
    if (!minimized) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, minimized]);

  const send = async () => {
    if (!input.trim()) return;
    const content = input.trim(); setInput("");
    await api.post("/send", { sender: user.username, to_user: friend.username, content }, user.token);
  };

  return (
    <div style={{
      width: 328, background: "#fff",
      borderRadius: "12px 12px 0 0",
      boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
      display: "flex", flexDirection: "column",
      maxHeight: minimized ? 52 : 400
    }}>
      {/* Header */}
      <div onClick={() => setMinimized(v => !v)} style={{
        padding: "8px 12px", display: "flex", alignItems: "center", gap: 8,
        borderBottom: minimized ? "none" : "1px solid #E4E6EB",
        cursor: "pointer", flexShrink: 0, borderRadius: "12px 12px 0 0",
        background: "#fff"
      }}>
        <Avatar name={friend.display_name} size={32} online={friend.online} />
        <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{friend.display_name}</span>
        <button onClick={e => { e.stopPropagation(); setMinimized(v => !v); }} style={iBtn}>
          {minimized ? "▲" : "▼"}
        </button>
        <button onClick={e => { e.stopPropagation(); onClose(); }} style={iBtn}>✕</button>
      </div>

      {!minimized && (
        <>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
            {messages.map(m => {
              const mine = m.sender === user.username;
              const imgContent = isImg(m.content);
              const { src, text } = imgContent ? parseImg(m.content) : { src: null, text: m.content };
              return (
                <div key={m.msg_id} style={{
                  display: "flex", justifyContent: mine ? "flex-end" : "flex-start",
                  alignItems: "flex-end", gap: 6
                }}>
                  {!mine && <Avatar name={m.display_name} size={24} />}
                  <div style={{
                    maxWidth: "70%",
                    background: mine ? "#1877F2" : "#F0F2F5",
                    color: mine ? "#fff" : "#1C1E21",
                    borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    overflow: "hidden"
                  }}>
                    {src && <img src={src} alt="" style={{ width: "100%", display: "block" }} />}
                    {text && <div style={{ padding: "8px 12px", fontSize: 14, lineHeight: 1.4, wordBreak: "break-word" }}>{text}</div>}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: "8px 12px", borderTop: "1px solid #E4E6EB", display: "flex", gap: 8, alignItems: "center" }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Aa"
              style={{
                flex: 1, padding: "8px 12px", background: "#F0F2F5",
                border: "none", borderRadius: 20, fontSize: 14,
                outline: "none", fontFamily: SYS, color: "#1C1E21"
              }} />
            <button onClick={send} disabled={!input.trim()} style={{
              width: 32, height: 32, borderRadius: "50%",
              background: input.trim() ? "#1877F2" : "#E4E6EB",
              border: "none", cursor: input.trim() ? "pointer" : "default",
              color: "#fff", fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>➤</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 8,
      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
      ...style
    }}>{children}</div>
  );
}

function FbSpinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        border: "3px solid #E4E6EB", borderTopColor: "#1877F2",
        animation: "spin 0.7s linear infinite"
      }} />
    </div>
  );
}

const SYS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const smallBtn = (bg, color = "#fff") => ({
  padding: "6px 14px", background: bg, border: "none",
  borderRadius: 6, color, cursor: "pointer",
  fontFamily: SYS, fontWeight: 700, fontSize: 14, whiteSpace: "nowrap"
});

const iBtn = {
  background: "none", border: "none", cursor: "pointer",
  color: "#65676B", fontSize: 14, padding: "2px 4px",
  borderRadius: 4, lineHeight: 1
};

export default App;
