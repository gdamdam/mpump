import { useEffect, useRef } from "react";
import type { ClientMessage, EngineState } from "../types";
import { getBool } from "../utils/storage";

/**
 * Keyboard shortcuts for preview mode:
 * Space = play/stop all
 * R = randomize all
 * ←/→ = switch focused instrument
 * ↑/↓ = cycle sound preset
 * Shift+←/→ = prev/next pattern
 * Shift+↑/↓ = prev/next genre
 * M = mute/unmute focused instrument
 * S = solo/unsolo focused instrument
 * L = lock/unlock sound for focused instrument
 * Shift+M = MIX (randomize all)
 * B = open BPM input modal
 */
export function useKeyboard(
  state: EngineState,
  command: (msg: ClientMessage) => void,
  enabled: boolean,
  onToggleAllPause?: () => void,
  focusDevice?: string | null,
  presetNav?: { cycleSynth: (dir: number) => void; cycleBass: (dir: number) => void; cycleDrumKit: (dir: number) => void },
  onFocusChange?: (deviceId: string) => void,
  keyActions?: { toggleLock?: (deviceId: string) => void; doMix?: () => void; toggleSolo?: (ch: "drums" | "bass" | "synth") => void; openBpm?: () => void },
) {
  // Remember which devices were playing before spacebar pause
  const playingBeforePause = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      const devices = Object.values(state.devices).filter(d => d.connected);
      const drumsDevice = devices.find(d => d.id === "preview_drums");

      switch (e.code) {
        case "Space": {
          e.preventDefault();
          if (onToggleAllPause) {
            onToggleAllPause();
          } else {
            const anyPlaying = devices.some(d => !d.paused);
            if (anyPlaying) {
              playingBeforePause.current = new Set(devices.filter(d => !d.paused).map(d => d.id));
              for (const id of playingBeforePause.current) {
                command({ type: "toggle_pause", device: id });
              }
            } else {
              const toResume = playingBeforePause.current.size > 0
                ? playingBeforePause.current
                : new Set(devices.map(d => d.id));
              for (const id of toResume) {
                command({ type: "toggle_pause", device: id });
              }
            }
          }
          break;
        }
        case "KeyR": {
          if (e.metaKey || e.ctrlKey) break; // don't randomize on Cmd+R / Ctrl+R (browser reload)
          command({ type: "randomize_all", linkGenre: getBool("mpump-genre-link") } as ClientMessage);
          break;
        }
        case "KeyZ": {
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            // Undo on all connected devices
            for (const d of devices) {
              command({ type: "undo_edit", device: d.id });
            }
          }
          break;
        }
        case "KeyS": {
          if (e.metaKey || e.ctrlKey) {
            // Cmd+S / Ctrl+S — prevent browser "Save Page" dialog
            e.preventDefault();
          } else if (!e.shiftKey) {
            // S = solo/unsolo focused instrument
            const focusId = focusDevice?.split(":")[0] ?? "preview_drums";
            const ch = focusId === "preview_drums" ? "drums" : focusId === "preview_bass" ? "bass" : "synth";
            keyActions?.toggleSolo?.(ch);
          }
          break;
        }
        case "KeyM": {
          if (e.metaKey || e.ctrlKey) break;
          if (e.shiftKey) {
            // Shift+M = MIX
            keyActions?.doMix?.();
          } else {
            // M = mute/unmute focused instrument
            const focusId = focusDevice?.split(":")[0] ?? "preview_drums";
            command({ type: "toggle_drums_mute", device: focusId });
          }
          break;
        }
        case "KeyL": {
          if (e.metaKey || e.ctrlKey) break;
          if (!e.shiftKey) {
            // L = lock/unlock sound for focused instrument
            const focusId = focusDevice?.split(":")[0] ?? "preview_drums";
            keyActions?.toggleLock?.(focusId);
          }
          break;
        }
        case "KeyB": {
          if (e.metaKey || e.ctrlKey || e.shiftKey) break;
          // B = open BPM input modal
          keyActions?.openBpm?.();
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (e.shiftKey) {
            // Shift+→ = next pattern
            const focusId = focusDevice?.split(":")[0];
            const target = devices.find(d => d.id === focusId) ?? drumsDevice;
            if (target) command({ type: "set_pattern", device: target.id, idx: target.pattern_idx + 1 });
          } else if (onFocusChange) {
            // → = switch focused instrument right (drums → bass → synth)
            const order = ["preview_drums", "preview_bass", "preview_synth"];
            const focusId = focusDevice?.split(":")[0];
            const idx = order.indexOf(focusId ?? "");
            const next = order[(idx + 1) % order.length];
            onFocusChange(next);
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (e.shiftKey) {
            // Shift+← = prev pattern
            const focusId = focusDevice?.split(":")[0];
            const target = devices.find(d => d.id === focusId) ?? drumsDevice;
            if (target) command({ type: "set_pattern", device: target.id, idx: Math.max(0, target.pattern_idx - 1) });
          } else if (onFocusChange) {
            // ← = switch focused instrument left (synth → bass → drums)
            const order = ["preview_drums", "preview_bass", "preview_synth"];
            const focusId = focusDevice?.split(":")[0];
            const idx = order.indexOf(focusId ?? "");
            const next = order[(idx - 1 + order.length) % order.length];
            onFocusChange(next);
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          if (e.shiftKey) {
            // Shift+↑ = next genre
            const focusId = focusDevice?.split(":")[0];
            const target = devices.find(d => d.id === focusId) ?? drumsDevice;
            if (target) command({ type: "set_genre", device: target.id, idx: target.genre_idx + 1 });
          } else if (presetNav) {
            // ↑ = next sound preset
            const focusId = focusDevice?.split(":")[0] ?? "preview_drums";
            if (focusId === "preview_drums") presetNav.cycleDrumKit(1);
            else if (focusId === "preview_bass") presetNav.cycleBass(1);
            else presetNav.cycleSynth(1);
          }
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          if (e.shiftKey) {
            // Shift+↓ = prev genre
            const focusId = focusDevice?.split(":")[0];
            const target = devices.find(d => d.id === focusId) ?? drumsDevice;
            if (target) command({ type: "set_genre", device: target.id, idx: Math.max(0, target.genre_idx - 1) });
          } else if (presetNav) {
            // ↓ = prev sound preset
            const focusId = focusDevice?.split(":")[0] ?? "preview_drums";
            if (focusId === "preview_drums") presetNav.cycleDrumKit(-1);
            else if (focusId === "preview_bass") presetNav.cycleBass(-1);
            else presetNav.cycleSynth(-1);
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state, command, enabled, focusDevice, presetNav, onFocusChange, keyActions]);
}
