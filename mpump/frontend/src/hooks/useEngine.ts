import { useReducer, useCallback, useEffect, useState, useRef } from "react";
import type { Catalog, ClientMessage, EngineState, ServerMessage } from "../types";
import { useWebSocket } from "./useWebSocket";

// ── State ────────────────────────────────────────────────────────────────

const INITIAL: EngineState = {
  bpm: 120,
  s1: {
    genre_idx: 0, pattern_idx: 0, key_idx: 0, octave: 2,
    step: -1, connected: false, paused: false, editing: false, pattern_data: [],
  },
  t8: {
    drum_genre_idx: 0, bass_genre_idx: 0, pattern_idx: 0, bass_pattern_idx: 0,
    key_idx: 0, octave: 2, step: -1, connected: false, paused: false, editing: false,
    drum_data: [], bass_data: [],
  },
  j6: {
    genre_idx: 0, pattern_idx: 0,
    step: -1, connected: false, paused: false, editing: false, pattern_data: [],
  },
};

type Action =
  | { type: "full_state"; data: EngineState }
  | { type: "step"; device: string; step: number };

function reducer(state: EngineState, action: Action): EngineState {
  switch (action.type) {
    case "full_state":
      return action.data;
    case "step": {
      const { device, step } = action;
      if (device === "s1") return { ...state, s1: { ...state.s1, step } };
      if (device === "t8") return { ...state, t8: { ...state.t8, step } };
      if (device === "j6") return { ...state, j6: { ...state.j6, step } };
      return state;
    }
    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useEngine() {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const sendRef = useRef<((msg: ClientMessage) => void) | null>(null);

  const onMessage = useCallback((msg: ServerMessage) => {
    if (msg.type === "state") {
      dispatch({ type: "full_state", data: msg.data });
    } else if (msg.type === "step") {
      dispatch({ type: "step", device: msg.device, step: msg.step });
    } else if (msg.type === "catalog") {
      setCatalog(msg.data);
    }
  }, []);

  const send = useWebSocket(onMessage);
  sendRef.current = send;

  // Fetch catalog once (also pushed on WS connect, but this is a fallback)
  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then(setCatalog)
      .catch(() => {});
  }, []);

  const command = useCallback((msg: ClientMessage) => {
    sendRef.current?.(msg);
  }, []);

  return { state, catalog, command };
}
