/**
 * useEngine — orchestrates the audio engine lifecycle, effects, MIDI access,
 * and state dispatch. The reducer handles two action types: full_state replaces
 * the entire tree (used on engine state snapshots), and step updates only the
 * playhead position for a single device (high-frequency, avoids full re-render).
 */
import { useReducer, useCallback, useState, useRef } from "react";
import type { Catalog, ClientMessage, EngineState, MidiState } from "../types";
import { Engine } from "../engine/Engine";
import { trackEvent } from "../utils/metrics";
import { isSupported, requestAccess } from "../engine/MidiAccess";

// ── State ────────────────────────────────────────────────────────────────

const INITIAL: EngineState = {
  bpm: 120,
  swing: 0.5,
  devices: {},
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
      const ds = state.devices[device];
      if (!ds) return state;
      return {
        ...state,
        devices: {
          ...state.devices,
          [device]: { ...ds, step },
        },
      };
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
    isSupported() ? "idle" : "unsupported",
  );
  const engineRef = useRef<Engine | null>(null);
  const catalogRef = useRef<Catalog | null>(null);

  const command = useCallback((msg: ClientMessage) => {
    const engine = engineRef.current;
    if (!engine) return;

    switch (msg.type) {
      case "set_genre": {
        engine.setGenre(msg.device, msg.idx);
        const cat = catalogRef.current;
        const genres = cat?.s1?.genres ?? cat?.t8?.drum_genres ?? [];
        const gName = genres[msg.idx]?.name;
        if (gName) trackEvent(`genre-${gName}`);
        break;
      }
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
      case "bulk_set_pattern":
        engine.bulkSetPattern(msg.device, msg.pattern_data, msg.drum_data, msg.bass_data);
        break;
      case "clear_pattern":
        engine.clearPattern(msg.device);
        break;
      case "edit_drum_step":
        engine.editDrumStep(msg.device, msg.step, msg.hits);
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
      case "randomize_all":
        engine.randomizeAll((msg as Record<string, unknown>).linkGenre as boolean ?? false);
        trackEvent("mix");
        break;
      case "randomize_device":
        engine.randomizeSingle(msg.device);
        break;
      case "randomize_bass":
        engine.randomizeBass(msg.device);
        break;
      case "set_pattern_length":
        engine.setPatternLength(msg.device, msg.length);
        break;
      case "toggle_bass_mute":
        engine.toggleBassMute(msg.device);
        break;
      case "toggle_drums_mute":
        engine.toggleDrumsMute(msg.device);
        break;
      case "set_drums_mute":
        engine.setDrumsMute(msg.device, msg.muted);
        break;
      case "set_bass_mute":
        engine.setBassMute(msg.device, msg.muted);
        break;
      case "set_synth_params":
        engine.setSynthParams(msg.device, msg.params);
        break;
      case "set_bass_synth_params":
        engine.setBassSynthParams(msg.device, msg.params);
        break;
      case "set_effect":
        engine.setEffect(msg.name, msg.params as never);
        break;
      case "set_volume":
        engine.setVolume(msg.volume);
        break;
      case "set_drum_voice":
        engine.setDrumVoice(msg.note, msg.params);
        break;
      case "set_swing":
        engine.setSwing(msg.swing);
        break;
      case "set_device_volume":
        engine.setDeviceVolume(msg.device, msg.volume);
        break;
      case "undo_edit":
        engine.undoEdit(msg.device);
        break;
      case "load_preset":
        engine.loadPreset(msg.bpm, msg.genres);
        break;
      case "toggle_chain":
        engine.toggleChain(msg.device, msg.chainIdx);
        break;
      case "set_cv_enabled":
        engine.setCVEnabled(msg.on);
        break;
      case "toggle_drum_voice_mute":
        engine.toggleDrumVoiceMute(msg.note);
        break;
      case "cv_test_note":
        engine.cvTestNote();
        break;
      case "cv_test_octave":
        engine.cvTestOctave();
        break;
      case "set_midi_clock_sync":
        engine.setMidiClockSync(msg.on);
        break;
      case "set_channel_volume":
        engine.setChannelVolume(msg.channel, msg.volume);
        break;
      case "set_anti_clip":
        engine.setAntiClipMode(msg.mode);
        break;
      case "set_metronome":
        engine.setMetronome(msg.on);
        break;
      case "set_humanize":
        engine.setHumanize(msg.on);
        break;
      case "copy_pattern":
        engine.copyPattern(msg.device);
        break;
      case "paste_pattern":
        engine.pastePattern(msg.device);
        break;
      case "set_sidechain_duck":
        engine.setSidechainDuck(msg.on);
        break;
      case "set_duck_params":
        engine.setDuckParams((msg as Record<string, unknown>).depth as number, (msg as Record<string, unknown>).release as number);
        break;
      case "set_mono":
        engine.setMono(msg.on);
        break;
      case "set_drive":
        engine.setDrive(msg.db);
        break;
      case "set_eq": {
        const m = msg as Record<string, unknown>;
        engine.setEQ(m.low as number, m.mid as number, m.high as number);
        break;
      }
      case "set_master_boost": {
        engine.setMasterBoost((msg as Record<string, unknown>).gain as number);
        break;
      }
      case "set_multiband":
        engine.setMultibandEnabled(msg.on);
        break;
      case "set_multiband_amount":
        engine.setMultibandAmount(msg.amount);
        break;
      case "set_width":
        engine.setWidth(msg.width);
        break;
      case "set_low_cut":
        engine.setLowCut(msg.freq);
        break;
      case "set_channel_eq":
        engine.setChannelEQ(msg.channel, msg.low, msg.mid, msg.high);
        break;
      case "set_channel_hpf":
        engine.setChannelHPF(msg.channel, msg.freq);
        break;
      case "set_channel_gate":
        engine.setChannelGate(msg.channel, msg.on, msg.rate, msg.depth, msg.shape, msg.mode, msg.pattern);
        break;
      case "set_channel_pan":
        engine.setChannelPan(msg.channel, msg.pan);
        break;
      case "set_channel_mono":
        engine.setChannelMono(msg.channel, msg.on);
        break;
      case "set_effect_order":
        engine.setEffectOrder(msg.order);
        break;
      case "set_arp":
        engine.setArp(msg.enabled, msg.mode, msg.rate, msg.device);
        break;
    }
  }, []);

  /** Request MIDI access and start engine with hardware devices. */
  const connectMidi = useCallback(async () => {
    setMidiState("pending");
    const access = await requestAccess();
    if (!access) {
      setMidiState("denied");
      return;
    }

    // Shut down existing preview engine if running
    engineRef.current?.shutdown();

    setMidiState("granted");

    const engine = new Engine(access, {
      onStateChange: (s) => dispatch({ type: "full_state", data: s }),
      onStep: (device, step) => dispatch({ type: "step", device, step }),
      onCatalogChange: (c) => { catalogRef.current = c; setCatalog(c); },
    });
    engineRef.current = engine;
    await engine.init();
  }, []);

  /** Start the engine in audio preview mode (no MIDI required). */
  const startPreview = useCallback(async (skipRandomize = false) => {
    setMidiState("preview");

    const engine = new Engine(null, {
      onStateChange: (s) => dispatch({ type: "full_state", data: s }),
      onStep: (device, step) => dispatch({ type: "step", device, step }),
      onCatalogChange: (c) => { catalogRef.current = c; setCatalog(c); },
    });
    engineRef.current = engine;

    // Create AudioPort synchronously within user gesture (Safari requirement)
    engine.createAudioPort();

    await engine.init();
    await engine.startPreview(skipRandomize);
  }, []);

  const getAnalyser = useCallback((): AnalyserNode | null => {
    return engineRef.current?.getAnalyser() ?? null;
  }, []);

  const getChannelAnalyser = useCallback((ch: number): AnalyserNode | null => {
    return engineRef.current?.getChannelAnalyser(ch) ?? null;
  }, []);

  const loadCustomSamples = useCallback((samples: Map<number, AudioBuffer>) => {
    engineRef.current?.loadCustomSamples(samples);
  }, []);

  const getMixerState = useCallback(() => {
    return engineRef.current?.getMixerState() ?? { drive: 0, eq: { low: 1, mid: 0, high: 0 }, width: 0.5, lowCut: 0, mbOn: true };
  }, []);

  const getMutedDrumNotes = useCallback((): Set<number> => {
    return engineRef.current?.getMutedDrumNotes() ?? new Set();
  }, []);

  const playNote = useCallback((ch: number, note: number, vel = 100) => {
    engineRef.current?.playNote(ch, note, vel);
  }, []);

  const stopNote = useCallback((ch: number, note: number) => {
    engineRef.current?.stopNote(ch, note);
  }, []);

  const getCpuLoad = useCallback(() => engineRef.current?.getCpuLoad() ?? 0, []);

  return { state, catalog, command, midiState, connectMidi, startPreview, getAnalyser, getChannelAnalyser, loadCustomSamples, getMutedDrumNotes, playNote, stopNote, getMixerState, getCpuLoad };
}
