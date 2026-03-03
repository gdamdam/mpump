"""FastAPI server — WebSocket + REST + static SPA serving."""

from __future__ import annotations

import argparse
import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse

from .engine import WebEngine

DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

engine: WebEngine | None = None
clients: set[WebSocket] = set()
_tasks: list[asyncio.Task] = []


# ── Broadcast helpers ─────────────────────────────────────────────────────

async def _broadcast(msg: str):
    dead: list[WebSocket] = []
    for ws in clients:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.append(ws)
    for ws in dead:
        clients.discard(ws)


async def _broadcast_state():
    await _broadcast(json.dumps({"type": "state", "data": engine.get_state()}))


async def _broadcast_step(device: str, step: int):
    await _broadcast(json.dumps({"type": "step", "device": device, "step": step}))


# ── Background loops ─────────────────────────────────────────────────────

async def _event_loop():
    """Drain the engine's async queue (step ticks, connection changes)."""
    while True:
        event = await engine._queue.get()
        kind = event[0]
        if kind == "step":
            _, device, idx = event
            if device == "s1":
                engine.s1_step = idx
            elif device == "t8":
                engine.t8_step = idx
            elif device == "j6":
                engine.j6_step = idx
            await _broadcast_step(device, idx)
        elif kind == "connected":
            _, name, state = event
            if name == "S-1":
                engine.s1_connected = state
                if not state:
                    engine.s1_step = -1
                    engine.s1_paused = False
            elif name == "T-8":
                engine.t8_connected = state
                if not state:
                    engine.t8_step = -1
                    engine.t8_paused = False
            elif name == "J-6":
                engine.j6_connected = state
                if not state:
                    engine.j6_step = -1
                    engine.j6_paused = False
            await _broadcast_state()


async def _tick_loop():
    """Poll MIDI ports on the same cadence as the TUI (0.5 s)."""
    while True:
        engine.tick()
        await asyncio.sleep(0.5)


# ── Lifespan ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    engine = WebEngine(bpm=getattr(app.state, "bpm", 120))
    _tasks.append(asyncio.create_task(_event_loop()))
    _tasks.append(asyncio.create_task(_tick_loop()))
    yield
    for t in _tasks:
        t.cancel()
    engine.shutdown()


app = FastAPI(lifespan=lifespan)


# ── REST ──────────────────────────────────────────────────────────────────

@app.get("/api/catalog")
async def catalog():
    return engine.get_catalog()


# ── WebSocket ─────────────────────────────────────────────────────────────

def _handle_command(msg: dict):
    t = msg.get("type")
    if t == "set_genre":
        engine.set_genre(msg["device"], msg["idx"])
    elif t == "set_pattern":
        engine.set_pattern(msg["device"], msg["idx"])
    elif t == "set_key":
        engine.set_key(msg["device"], msg["idx"])
    elif t == "set_octave":
        engine.set_octave(msg["device"], msg["octave"])
    elif t == "set_bpm":
        engine.set_bpm(msg["bpm"])
    elif t == "toggle_pause":
        engine.toggle_pause(msg["device"])


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    try:
        await ws.send_json({"type": "state", "data": engine.get_state()})
        while True:
            msg = await ws.receive_json()
            _handle_command(msg)
            await _broadcast_state()
    except WebSocketDisconnect:
        pass
    finally:
        clients.discard(ws)


# ── SPA static files (catch-all, must be last) ───────────────────────────

@app.get("/{path:path}")
async def serve_spa(path: str):
    if not DIST_DIR.exists():
        return JSONResponse(
            {"error": "Frontend not built. Run: cd mpump/frontend && npm install && npm run build"},
            status_code=404,
        )
    file = DIST_DIR / path
    if file.exists() and file.is_file():
        return FileResponse(file)
    return FileResponse(DIST_DIR / "index.html")


# ── CLI entry point ───────────────────────────────────────────────────────

def main():
    import uvicorn

    parser = argparse.ArgumentParser(
        prog="mpump-web",
        description="mpump web UI — control your AIRA devices from a browser",
    )
    parser.add_argument("--bpm", type=int, default=120, help="Initial BPM (20–300)")
    parser.add_argument("--port", type=int, default=8080, help="HTTP port (default 8080)")
    args = parser.parse_args()

    app.state.bpm = args.bpm
    uvicorn.run(app, host="0.0.0.0", port=args.port)
