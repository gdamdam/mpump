import type { ClientMessage } from "../types";
import { pressVibrate } from "../utils/haptic";

interface Props {
  device: string;
  paused: boolean;
  command: (msg: ClientMessage) => void;
}

export function Transport({ device, paused, command }: Props) {
  return (
    <button
      className={`transport-btn ${paused ? "paused" : "playing"}`}
      title={paused ? "Play" : "Pause"}
      onClick={() => { pressVibrate(); command({ type: "toggle_pause", device }); }}
    >
      {paused ? "\u25B6" : "\u275A\u275A"}
    </button>
  );
}
