import { MidiPort } from "./MidiPort";

export type DeviceName = "S-1" | "T-8" | "J-6";

const PORT_MATCHERS: Record<DeviceName, string> = {
  "S-1": "S-1",
  "T-8": "T-8",
  "J-6": "J-6",
};

export interface DetectedPorts {
  "S-1"?: MidiPort;
  "T-8"?: MidiPort;
  "J-6"?: MidiPort;
}

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
    for (const [device, match] of Object.entries(PORT_MATCHERS)) {
      if (name.includes(match) && !(device in result)) {
        result[device as DeviceName] = new MidiPort(output);
      }
    }
  }
  return result;
}
