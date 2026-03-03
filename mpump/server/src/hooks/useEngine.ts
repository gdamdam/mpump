import { useReducer, useCallback, useEffect, useState, useRef } from "react";
import type { Catalog, ClientMessage, EngineState, MidiState } from "../types";
import { Engine } from "../engine/Engine";
import { isSupported, requestAccess } from "../engine/MidiAccess";

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
  const [midiState, setMidiState] = useState<MidiState>(
    isSupported() ? "pending" : "unsupported",
  );
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    if (!isSupported()) {
      setMidiState("unsupported");
      return;
    }

    let engine: Engine | null = null;

    (async () => {
      const access = await requestAccess();
      if (!access) {
        setMidiState("denied");
        return;
      }

      setMidiState("granted");

      engine = new Engine(access, {
        onStateChange: (s) => dispatch({ type: "full_state", data: s }),
        onStep: (device, step) => dispatch({ type: "step", device, step }),
        onCatalogChange: (c) => setCatalog(c),
      });
      engineRef.current = engine;

      await engine.init();
    })();

    return () => {
      engine?.shutdown();
      engineRef.current = null;
    };
  }, []);

  const command = useCallback((msg: ClientMessage) => {
    const engine = engineRef.current;
    if (!engine) return;

    switch (msg.type) {
      case "set_genre":
        engine.setGenre(msg.device, msg.idx);
        break;
      case "set_pattern":
        engine.setPattern(msg.device, msg.idx);
        break;
      case "set_key":
        engine.setKey(msg.device, msg.idx);
        break;
      case "set_octave":
        engine.setOctave(msg.device, msg.octave);
        break;
      case "set_bpm":
        engine.setBpm(msg.bpm);
        break;
      case "toggle_pause":
        engine.togglePause(msg.device);
        break;
      case "edit_step":
        engine.editStep(msg.device, msg.step, msg.data);
        break;
      case "edit_drum_step":
        engine.editDrumStep(msg.step, msg.hits);
        break;
      case "discard_edit":
        engine.discardEdit(msg.device);
        break;
      case "save_pattern":
        engine.saveToExtras(msg.device, msg.name, msg.desc);
        break;
      case "delete_pattern":
        engine.deleteExtra(msg.device, msg.idx);
        break;
    }
  }, []);

  const retryMidi = useCallback(async () => {
    setMidiState("pending");
    const access = await requestAccess();
    if (!access) {
      setMidiState("denied");
      return;
    }

    setMidiState("granted");

    const engine = new Engine(access, {
      onStateChange: (s) => dispatch({ type: "full_state", data: s }),
      onStep: (device, step) => dispatch({ type: "step", device, step }),
      onCatalogChange: (c) => setCatalog(c),
    });
    engineRef.current = engine;
    await engine.init();
  }, []);

  return { state, catalog, command, midiState, retryMidi };
}
