import type { Catalog, ClientMessage, EngineState } from "../types";
import { DevicePanel } from "./DevicePanel";
import { BpmControl } from "./BpmControl";

interface Props {
  state: EngineState;
  catalog: Catalog | null;
  command: (msg: ClientMessage) => void;
}

export function Layout({ state, catalog, command }: Props) {
  const anyConnected = state.s1.connected || state.t8.connected || state.j6.connected;

  return (
    <div className="layout">
      <header className="header">
        <div className="title">
          <pre className="title-art">{"█▀▄▀█ █▀█ █ █ █▀▄▀█ █▀█\n█ ▀ █ █▀▀ ▀▄▀ █ ▀ █ █▀▀"}</pre>
          <span className="title-version">v1.3.3</span>
        </div>
        <BpmControl bpm={state.bpm} command={command} />
      </header>

      <main className="panels">
        {!anyConnected && (
          <div className="no-devices">
            <div className="no-devices-icon">instruments offline</div>
            <div className="no-devices-hint">connect a Roland AIRA device via USB</div>
          </div>
        )}

        {state.s1.connected && (
          <DevicePanel
            device="s1"
            label="S-1"
            accent="var(--s1)"
            state={state.s1}
            catalog={catalog}
            genreList={catalog?.s1.genres}
            patternList={catalog?.s1.genres[state.s1.genre_idx]?.patterns}
            genreIdx={state.s1.genre_idx}
            keys={catalog?.keys}
            keyIdx={state.s1.key_idx}
            octave={state.s1.octave}
            octaveMin={catalog?.octave_min ?? 0}
            octaveMax={catalog?.octave_max ?? 6}
            bpm={state.bpm}
            command={command}
          />
        )}

        {state.t8.connected && (
          <DevicePanel
            device="t8"
            label="T-8"
            accent="var(--t8)"
            state={state.t8}
            catalog={catalog}
            genreList={catalog?.t8.drum_genres}
            patternList={catalog?.t8.drum_genres[state.t8.drum_genre_idx]?.patterns}
            bassGenreList={catalog?.t8.bass_genres}
            bassPatternList={catalog?.t8.bass_genres[state.t8.bass_genre_idx]?.patterns}
            genreIdx={state.t8.drum_genre_idx}
            bassGenreIdx={state.t8.bass_genre_idx}
            keys={catalog?.keys}
            keyIdx={state.t8.key_idx}
            octave={state.t8.octave}
            octaveMin={catalog?.octave_min ?? 0}
            octaveMax={catalog?.octave_max ?? 6}
            bpm={state.bpm}
            command={command}
          />
        )}

        {state.j6.connected && (
          <DevicePanel
            device="j6"
            label="J-6"
            accent="var(--j6)"
            state={state.j6}
            catalog={catalog}
            genreList={catalog?.j6.genres}
            patternList={catalog?.j6.genres[state.j6.genre_idx]?.patterns}
            genreIdx={state.j6.genre_idx}
            bpm={state.bpm}
            command={command}
          />
        )}
      </main>
    </div>
  );
}
