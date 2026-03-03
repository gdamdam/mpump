import { MidiPort } from "./MidiPort";
import { DEVICE_REGISTRY } from "../data/devices";

export type DetectedPorts = Record<string, MidiPort>;

/** Check if Web MIDI is available in this browser. */
export function isSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.requestMIDIAccess === "function" &&
    window.isSecureContext
  );
}

/** Request MIDI access. Returns MIDIAccess or null on denial. */
export async function requestAccess(): Promise<MIDIAccess | null> {
  try {
    return await navigator.requestMIDIAccess({ sysex: false });
  } catch {
    return null;
  }
}

/** Scan current outputs for known devices. */
export function detectPorts(access: MIDIAccess): DetectedPorts {
  const result: DetectedPorts = {};
  for (const output of access.outputs.values()) {
    if (output.state !== "connected" || output.type !== "output") continue;
    const name = output.name ?? "";
    for (const config of DEVICE_REGISTRY) {
      if (name.includes(config.portMatch) && !(config.id in result)) {
        result[config.id] = new MidiPort(output);
      }
    }
  }
  return result;
}
