# StreamChat — gRPC + React Web Chat

Full-stack chat app: Python gRPC backend · Flask REST bridge · React frontend

## Features
- 🔐 JWT auth (register / login)
- 👥 Friend system (search · send/accept/decline requests)
- 🟢 Real-time online status + heartbeat
- 💬 1-on-1 DMs
- # Group rooms (create · join · stream)
- 📜 Message history (SQLite)
- ⚡ Real-time via gRPC bidirectional streaming → SSE to browser

## Architecture

```
React (Vite :3000)
      │  HTTP / SSE
Flask Bridge (:8000)
      │  gRPC
gRPC Server (:50051)
      │
  chat.db (SQLite)
```

## Setup

### 1. Python backend

```bash
cd /Users/ruthvikg/pythonprojects/chatStream

# Install Python deps
pip install -r requirements.txt

# Compile proto stubs
python -m grpc_tools.protoc -I./proto \
    --python_out=./server \
    --grpc_python_out=./server \
    ./proto/chat.proto
```

### 2. React frontend

```bash
cd frontend
npm install
```

## Run (3 terminals)

**Terminal 1 — gRPC server:**
```bash
cd server
python server.py
```

**Terminal 2 — REST bridge:**
```bash
cd server
python api_bridge.py
```

**Terminal 3 — React dev server:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:3000** 🎉

## Project structure

```
chatStream/
├── proto/
│   └── chat.proto          # gRPC service definition
├── server/
│   ├── server.py           # gRPC server (auth, friends, rooms, streaming)
│   ├── api_bridge.py       # Flask REST↔gRPC bridge + SSE
│   ├── chat_pb2.py         # (generated)
│   └── chat_pb2_grpc.py    # (generated)
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Full React app
│   │   └── main.jsx        # Entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── requirements.txt
```

## Extending

| What | How |
|------|-----|
| Multi-instance | Swap in-memory broker with Redis pub/sub |
| TLS | Add SSL certs to gRPC server + secure_channel |
| Production | Nginx in front of Flask, gunicorn, Postgres instead of SQLite |
| Push notifications | Add Web Push via service worker |
| File sharing | S3 upload + message with file URL |
