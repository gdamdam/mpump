/**
 * Integration tests for the Fly.io jam relay WebSocket server.
 * These hit the live deployed relay — skip in CI with SKIP_INTEGRATION=1.
 */
import { describe, it, expect, afterEach } from "vitest";

const RELAY_URL = "wss://mpump-jam-relay.fly.dev";
const SKIP = !!process.env.SKIP_INTEGRATION;

function connect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(RELAY_URL);
    ws.onopen = () => resolve(ws);
    ws.onerror = (e) => reject(e);
  });
}

function waitMsg(ws: WebSocket, timeout = 5000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout waiting for message")), timeout);
    ws.onmessage = (e) => {
      clearTimeout(timer);
      resolve(JSON.parse(typeof e.data === "string" ? e.data : ""));
    };
  });
}

describe.skipIf(SKIP)("jam relay (live)", () => {
  const sockets: WebSocket[] = [];
  const track = (ws: WebSocket) => { sockets.push(ws); return ws; };

  afterEach(() => {
    for (const ws of sockets) {
      try { ws.close(); } catch {}
    }
    sockets.length = 0;
  });

  it("health endpoint responds", async () => {
    const res = await fetch("https://mpump-jam-relay.fly.dev/health");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("ok");
  });

  it("connects via WebSocket", async () => {
    const ws = track(await connect());
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });

  it("peek returns count for nonexistent room", async () => {
    const ws = track(await connect());
    ws.send(JSON.stringify({ type: "peek", room: "test-empty-" + Date.now() }));
    const msg = await waitMsg(ws);
    expect(msg.type).toBe("peers");
    expect(msg.count).toBe(0);
  });

  it("join creates room and assigns role", async () => {
    const room = "test-join-" + Date.now();
    const ws = track(await connect());

    ws.send(JSON.stringify({ type: "join", room, roomType: "jam", name: "Alice" }));

    // Should get peers notification and role assignment
    const msgs: Record<string, unknown>[] = [];
    const collectMsgs = () => new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 2000);
      ws.onmessage = (e) => {
        msgs.push(JSON.parse(typeof e.data === "string" ? e.data : ""));
        if (msgs.length >= 2) { clearTimeout(timer); resolve(); }
      };
    });
    await collectMsgs();

    const peersMsg = msgs.find((m) => m.type === "peers");
    const roleMsg = msgs.find((m) => m.type === "role");
    expect(peersMsg).toBeDefined();
    expect(peersMsg!.count).toBe(1);
    expect(roleMsg).toBeDefined();
    expect(roleMsg!.role).toBe("peer");
  });

  it("two peers see each other in jam room", async () => {
    const room = "test-pair-" + Date.now();

    const ws1 = track(await connect());
    ws1.send(JSON.stringify({ type: "join", room, roomType: "jam", name: "A" }));
    // Drain join messages for ws1
    await waitMsg(ws1);

    const ws2 = track(await connect());
    ws2.send(JSON.stringify({ type: "join", room, roomType: "jam", name: "B" }));

    // ws1 should receive updated peer count
    const msg = await waitMsg(ws1);
    expect(msg.type).toBe("peers");
    expect(msg.count).toBe(2);
  });

  it("liveset assigns controller to first peer", async () => {
    const room = "test-liveset-" + Date.now();
    const ws = track(await connect());

    ws.send(JSON.stringify({ type: "join", room, roomType: "liveset", name: "DJ" }));

    const msgs: Record<string, unknown>[] = [];
    const collectMsgs = () => new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 2000);
      ws.onmessage = (e) => {
        msgs.push(JSON.parse(typeof e.data === "string" ? e.data : ""));
        if (msgs.length >= 2) { clearTimeout(timer); resolve(); }
      };
    });
    await collectMsgs();

    const roleMsg = msgs.find((m) => m.type === "role");
    expect(roleMsg).toBeDefined();
    expect(roleMsg!.role).toBe("controller");
  });

  it("messages relay between peers", async () => {
    const room = "test-relay-" + Date.now();

    const ws1 = track(await connect());
    ws1.send(JSON.stringify({ type: "join", room, roomType: "jam", name: "A" }));

    const ws2 = track(await connect());

    // Drain all join/role messages from both sockets before testing relay
    const drain = (ws: WebSocket) => new Promise<void>((resolve) => {
      const msgs: Record<string, unknown>[] = [];
      const timer = setTimeout(resolve, 1500);
      ws.onmessage = (e) => {
        msgs.push(JSON.parse(typeof e.data === "string" ? e.data : ""));
        // Keep draining until quiet
        clearTimeout(timer);
        setTimeout(resolve, 500);
      };
    });

    // Small delay to let ws1 join settle
    await new Promise((r) => setTimeout(r, 500));
    ws2.send(JSON.stringify({ type: "join", room, roomType: "jam", name: "B" }));
    await Promise.all([drain(ws1), drain(ws2)]);

    // Now ws1 sends a message, ws2 should receive it
    ws1.send(JSON.stringify({ type: "bpm", value: 140 }));
    const relayed = await waitMsg(ws2);
    expect(relayed.type).toBe("bpm");
    expect(relayed.value).toBe(140);
    expect(relayed.sender).toBeDefined();
  });
});
