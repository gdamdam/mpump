import type { Catalog, ClientMessage, EngineState } from "../types";
import { DevicePanel } from "./DevicePanel";
import { BpmControl } from "./BpmControl";

interface Props {
  state: EngineState;
  catalog: Catalog | null;
  command: (msg: ClientMessage) => void;
}

export function Layout({ state, catalog, command }: Props) {
  const connectedDevices = Object.values(state.devices).filter(d => d.connected);
  const anyConnected = connectedDevices.length > 0;

  return (
    <div className="layout">
      <header className="header">
        <div className="title">
          <pre className="title-art">{"█▀▄▀█ █▀█ █ █ █▀▄▀█ █▀█\n█ ▀ █ █▀▀ ▀▄▀ █ ▀ █ █▀▀"}</pre>
          <span className="title-version">v1.1.0</span>
        </div>
        <BpmControl bpm={state.bpm} command={command} />
      </header>

      <main className="panels">
        {!anyConnected && (
          <div className="no-devices">
            <div className="no-devices-icon">no instruments detected</div>
            <div className="no-devices-hint">
              connect a MIDI device via USB
            </div>
            <div className="no-devices-hint">
              devices are detected automatically when plugged in
            </div>
          </div>
        )}

        {connectedDevices.map(ds => (
          <DevicePanel
            key={ds.id}
            state={ds}
            catalog={catalog}
            command={command}
          />
        ))}
      </main>
    </div>
  );
}
