# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend
```bash
# Install Python deps
pip install -r requirements.txt flask flask-cors  # flask/flask-cors missing from requirements.txt

# Regenerate proto stubs (run from repo root)
python -m grpc_tools.protoc -I./proto --python_out=./server --grpc_python_out=./server ./proto/chat.proto
python -m grpc_tools.protoc -I./proto --python_out=./client --grpc_python_out=./client ./proto/chat.proto

# Run services (three separate terminals)
cd server && python server.py       # gRPC server on :50051
cd server && python api_bridge.py   # REST bridge on :8001
cd client && python client.py       # CLI client for testing
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # Vite dev server on :3000
npm run build
npm run preview
```

## Architecture

Three-tier stack:

```
React (Vite :3000)
    ↓ HTTP + SSE
Flask bridge (api_bridge.py :8001)
    ↓ gRPC
gRPC server (server.py :50051)
    ↓
SQLite (chat.db)
```

**gRPC server** (`server/server.py`) — all business logic: auth (JWT + bcrypt), friends, rooms, messages, bidirectional streaming, online status.

**Flask bridge** (`server/api_bridge.py`) — translates REST calls to gRPC unary stubs; bridges gRPC `ChatStream` bidirectional streams to Server-Sent Events (SSE) for browser EventSource.

**React frontend** (`frontend/src/App.jsx`) — single 750-line file, no routing, no component files, all styles inline as JS objects. Auth state via Context API + localStorage. Real-time messages via `EventSource` against `/api/stream`. Polls friends/pending every 10 seconds. Heartbeat every 15 seconds.

**CLI client** (`client/client.py`) — interactive terminal client; useful for integration testing without the browser.

## Key Patterns

**In-memory pub/sub broker** (`server.py:Broker`) — subscriptions keyed by `dm:userA:userB` (alphabetically sorted) or `room_id`. Thread-safe with `threading.Lock`. Lost on restart — no persistence.

**SSE bridge** (`api_bridge.py`) — long-lived background threads per channel maintain a gRPC stream. Per-channel queues feed SSE responses. Heartbeat pings every 25 seconds keep EventSource alive.

**Online status** — in-memory dict `_online` (username → epoch). TTL = 30s. Frontend sends `POST /api/heartbeat` every 15s.

**Proto changes** — edit `proto/chat.proto` then regenerate stubs for both `server/` and `client/`. Both directories keep their own copy of generated files.

**Database schema** — `users`, `friends` (bidirectional with requester column), `rooms`, `room_members`, `messages`. SQLite opened with `check_same_thread=False`.

## Known Gaps

- `flask` and `flask-cors` used in `api_bridge.py` but absent from `requirements.txt`
- JWT secret hardcoded in `server.py` — must be externalized before any real deployment
- In-memory broker lost on restart; needs Redis for multi-instance or persistence
