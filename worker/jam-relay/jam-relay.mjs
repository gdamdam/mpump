/**
 * Minimal WebSocket relay for mpump live jam & live set.
 * Rooms are keyed by room ID. Messages from peers are broadcast to others.
 * Privacy: no IPs logged, no data persisted. Rooms exist only in memory.
 *
 * Room types:
 *   jam     — up to 4 peers, everyone can send (collaborative)
 *   liveset — 1 controller + up to 49 listeners (performance)
 *
 * Run locally: node jam-relay.mjs
 * Deploy: fly deploy (from this directory)
 */

import { createServer } from "http";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 4444;

// Room state: { type, controller, peers: Set<ws> }
const rooms = new Map();

const MAX_JAM = 4;
const MAX_LIVESET = 50; // 1 controller + 49 listeners

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET" };

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain", ...CORS });
    res.end("ok");
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain", ...CORS });
  res.end("mpump jam relay");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let roomId = null;
  let role = null; // "controller" | "peer" | "listener"

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // Peek: get room count without joining
    if (msg.type === "peek") {
      const room = rooms.get(msg.room);
      const count = room ? room.peers.size : 0;
      const roomType = room ? room.type : null;
      ws.send(JSON.stringify({ type: "peers", count, roomType }));
      return;
    }

    // Join room
    if (msg.type === "join") {
      roomId = msg.room;
      const roomType = msg.roomType || "jam"; // "jam" or "liveset"

      if (!rooms.has(roomId)) {
        // First peer creates the room
        rooms.set(roomId, { type: roomType, controller: ws, peers: new Set() });
        role = roomType === "liveset" ? "controller" : "peer";
      } else {
        const room = rooms.get(roomId);
        // Check capacity
        const max = room.type === "liveset" ? MAX_LIVESET : MAX_JAM;
        if (room.peers.size >= max) {
          ws.send(JSON.stringify({ type: "error", message: "Room is full" }));
          return;
        }
        role = room.type === "liveset" ? "listener" : "peer";
      }

      const room = rooms.get(roomId);
      room.peers.add(ws);

      // Notify all peers of new count
      const count = room.peers.size;
      for (const peer of room.peers) {
        peer.send(JSON.stringify({ type: "peers", count, roomType: room.type }));
      }

      // Ask controller/host to send sync to the new joiner
      if (room.peers.size > 1) {
        const host = room.controller || [...room.peers][0];
        if (host !== ws && host.readyState === 1) {
          host.send(JSON.stringify({ type: "sync_request" }));
        }
      }

      // Tell the joiner their role
      ws.send(JSON.stringify({ type: "role", role }));

      return;
    }

    // Relay messages
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);

      // In liveset mode, only controller can broadcast (except reactions)
      if (room.type === "liveset" && ws !== room.controller) {
        try { const m = JSON.parse(raw); if (m.type !== "reaction") return; } catch { return; }
      }

      // Broadcast to all other peers in room
      const data = raw.toString();
      for (const peer of room.peers) {
        if (peer !== ws && peer.readyState === 1) {
          peer.send(data);
        }
      }
    }
  });

  ws.on("close", () => {
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.peers.delete(ws);

      if (room.peers.size === 0) {
        rooms.delete(roomId);
      } else {
        // If controller left in liveset, promote next peer
        if (room.type === "liveset" && room.controller === ws) {
          room.controller = [...room.peers][0];
          room.controller.send(JSON.stringify({ type: "role", role: "controller" }));
        }
        // Notify remaining peers
        for (const peer of room.peers) {
          peer.send(JSON.stringify({ type: "peers", count: room.peers.size, roomType: room.type }));
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Jam relay listening on port ${PORT}`);
});
