import type { MidiState } from "../types";

interface Props {
  midiState: MidiState;
  onRetry: () => void;
}

export function MidiGate({ midiState, onRetry }: Props) {
  return (
    <div className="midi-gate">
      <pre className="midi-gate-logo">{"█▀▄▀█ █▀█ █ █ █▀▄▀█ █▀█\n█ ▀ █ █▀▀ ▀▄▀ █ ▀ █ █▀▀"}</pre>
      <span className="title-version">v1.3.8</span>

      {midiState === "unsupported" && (
        <>
          <div className="midi-gate-title">Web MIDI not available</div>
          <div className="midi-gate-body">
            This app requires the Web MIDI API to communicate with your
            MIDI devices. Please use Chrome, Edge, or Opera.
            Firefox may work with a Web MIDI add-on.
          </div>
        </>
      )}

      {midiState === "pending" && (
        <>
          <div className="midi-gate-title">Requesting MIDI access...</div>
          <div className="midi-gate-body">
            Please grant MIDI permission when prompted by your browser.
          </div>
        </>
      )}

      {midiState === "denied" && (
        <>
          <div className="midi-gate-title">MIDI access denied</div>
          <div className="midi-gate-body">
            mpump needs MIDI permission to send notes to your devices.
            Check your browser settings or try again.
          </div>
          <button className="midi-gate-btn" onClick={onRetry}>
            Retry
          </button>
        </>
      )}
      <div className="midi-gate-footer">
        <a href="https://github.com/gdamdam/mpump#supported-devices" target="_blank" rel="noopener noreferrer">
          supported devices
        </a>
      </div>
    </div>
  );
}
