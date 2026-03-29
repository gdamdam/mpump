import { useEffect, useRef } from "react";
import type { ClientMessage, EngineState } from "../types";

/**
 * Keyboard shortcuts for preview mode:
 * Space = play/stop all
 * R = randomize all
 * ←/→ = prev/next pattern (drums device)
 * ↑/↓ = prev/next genre (drums device)
 */
export function useKeyboard(
  state: EngineState,
  command: (msg: ClientMessage) => void,
  enabled: boolean,
  onToggleAllPause?: () => void,
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
          command({ type: "randomize_all" });
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
          // Cmd+S / Ctrl+S — prevent browser "Save Page" dialog
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
          }
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (drumsDevice) {
            command({ type: "set_pattern", device: drumsDevice.id, idx: drumsDevice.pattern_idx + 1 });
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (drumsDevice) {
            command({ type: "set_pattern", device: drumsDevice.id, idx: Math.max(0, drumsDevice.pattern_idx - 1) });
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          if (drumsDevice) {
            command({ type: "set_genre", device: drumsDevice.id, idx: drumsDevice.genre_idx + 1 });
          }
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          if (drumsDevice) {
            command({ type: "set_genre", device: drumsDevice.id, idx: Math.max(0, drumsDevice.genre_idx - 1) });
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state, command, enabled]);
}
