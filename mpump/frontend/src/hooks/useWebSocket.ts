import { useEffect, useRef, useCallback } from "react";
import type { ClientMessage, ServerMessage } from "../types";

const RECONNECT_MS = 2000;

export function useWebSocket(onMessage: (msg: ServerMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number>(0);

  useEffect(() => {
    function connect() {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${proto}//${location.host}/ws`);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          onMessage(JSON.parse(ev.data));
        } catch {}
      };

      ws.onclose = () => {
        wsRef.current = null;
        reconnectTimer.current = window.setTimeout(connect, RECONNECT_MS);
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [onMessage]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return send;
}
