import { useEngine } from "./hooks/useEngine";
import { Layout } from "./components/Layout";
import { MidiGate } from "./components/MidiGate";

export function App() {
  const { state, catalog, command, midiState, retryMidi } = useEngine();

  if (midiState !== "granted") {
    return <MidiGate midiState={midiState} onRetry={retryMidi} />;
  }

  return <Layout state={state} catalog={catalog} command={command} />;
}
