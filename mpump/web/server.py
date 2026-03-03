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

def _deser_step(d):
    """Convert JSON step → tuple or None."""
    if d is None:
        return None
    return (d["semi"], d["vel"], d["slide"])


def _deser_drum_hits(hits):
    return [(h["note"], h["vel"]) for h in hits]


def _handle_command(msg: dict) -> str | None:
    """Handle a client command.  Returns 'catalog' if catalog changed."""
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
    elif t == "edit_step":
        engine.edit_step(msg["device"], msg["step"], _deser_step(msg.get("data")))
    elif t == "edit_drum_step":
        engine.edit_drum_step(msg["step"], _deser_drum_hits(msg.get("hits", [])))
    elif t == "discard_edit":
        engine.discard_edit(msg["device"])
    elif t == "save_pattern":
        engine.save_to_extras(msg["device"], msg["name"], msg.get("desc", ""))
        return "catalog"
    elif t == "delete_pattern":
        engine.delete_extra(msg["device"], msg["idx"])
        return "catalog"
    return None


async def _broadcast_catalog():
    await _broadcast(json.dumps({"type": "catalog", "data": engine.get_catalog()}))


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    try:
        await ws.send_json({"type": "state", "data": engine.get_state()})
        await ws.send_json({"type": "catalog", "data": engine.get_catalog()})
        while True:
            msg = await ws.receive_json()
            result = _handle_command(msg)
            await _broadcast_state()
            if result == "catalog":
                await _broadcast_catalog()
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
        description="mpump web UI — control MIDI devices from a browser.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Open http://<your-mac-ip>:PORT in any browser (iOS Safari, desktop, etc.).\n"
            "Supports Add-to-Home-Screen for a full-screen PWA experience.\n\n"
            "Features:\n"
            "  - Live pattern visualization synced to playback\n"
            "  - Browse and switch genres, patterns, keys, octaves\n"
            "  - Tap steps to edit patterns in real time\n"
            "  - Save edited patterns to the EXTRAS genre (~/.mpump/extras.json)\n"
            "  - Multiple simultaneous browser clients\n\n"
            "For a standalone browser sequencer (no Mac/server required), see\n"
            "mpump/server/ — uses Web MIDI API, deploy to any HTTPS host.\n"
        ),
    )
    parser.add_argument("--bpm", type=int, default=120, metavar="N", help="initial tempo in BPM, 20–300 (default: 120)")
    parser.add_argument("--port", type=int, default=8080, metavar="N", help="HTTP port to listen on (default: 8080)")
    args = parser.parse_args()

    app.state.bpm = args.bpm
    uvicorn.run(app, host="0.0.0.0", port=args.port)
