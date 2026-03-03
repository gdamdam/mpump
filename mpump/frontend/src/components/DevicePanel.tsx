import { useState, useRef } from "react";
import type { Catalog, ClientMessage, GenreInfo, PatternInfo, S1State, T8State, J6State } from "../types";
import { StepGrid } from "./StepGrid";
import { DrumGrid } from "./DrumGrid";
import { BassGrid } from "./BassGrid";
import { BeatIndicator } from "./BeatIndicator";
import { Transport } from "./Transport";
import { Picker } from "./Picker";

type PickerMode = null | "genre" | "pattern" | "key" | "octave" | "bass_genre" | "bass_pattern";

interface Props {
  device: string;
  label: string;
  accent: string;
  state: S1State | T8State | J6State;
  catalog: Catalog | null;
  genreList?: GenreInfo[];
  patternList?: PatternInfo[];
  bassGenreList?: GenreInfo[];
  bassPatternList?: PatternInfo[];
  genreIdx: number;
  bassGenreIdx?: number;
  keys?: string[];
  keyIdx?: number;
  octave?: number;
  octaveMin?: number;
  octaveMax?: number;
  bpm: number;
  command: (msg: ClientMessage) => void;
}

export function DevicePanel({
  device, label, accent, state, catalog,
  genreList, patternList, bassGenreList, bassPatternList,
  genreIdx, bassGenreIdx,
  keys, keyIdx, octave, octaveMin = 0, octaveMax = 6,
  command,
}: Props) {
  const [picker, setPicker] = useState<PickerMode>(null);

  // Swipe handling
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;

    const MIN_SWIPE = 50;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > MIN_SWIPE) {
      // Horizontal swipe → genre
      const delta = dx > 0 ? -1 : 1;
      const genres = genreList ?? [];
      if (genres.length) {
        command({ type: "set_genre", device, idx: (genreIdx + delta + genres.length) % genres.length });
      }
    } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > MIN_SWIPE) {
      // Vertical swipe → pattern
      const delta = dy > 0 ? -1 : 1;
      const patterns = patternList ?? [];
      const pidx = "pattern_idx" in state ? (state as any).pattern_idx : 0;
      if (patterns.length) {
        command({ type: "set_pattern", device, idx: (pidx + delta + patterns.length) % patterns.length });
      }
    }
  };

  const genreName = genreList?.[genreIdx]?.name ?? "---";
  const patIdx = "pattern_idx" in state ? (state as any).pattern_idx : 0;
  const patInfo = patternList?.[patIdx];

  // T-8 specific
  const isT8 = device === "t8";
  const t8 = isT8 ? (state as T8State) : null;

  // J-6 has no key/octave
  const hasKey = device !== "j6";

  return (
    <div
      className="device-panel"
      style={{ "--device-accent": accent } as React.CSSProperties}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header row */}
      <div className="panel-header">
        <span className="panel-label" style={{ color: accent }}>{label}</span>
        <Transport device={device} paused={state.paused} command={command} />
      </div>

      {/* Genre */}
      <button className="info-row" onClick={() => setPicker("genre")}>
        <span className="info-key">genre</span>
        <span className="info-val" style={{ color: accent }}>{genreName}</span>
      </button>

      {/* Pattern */}
      <button className="info-row" onClick={() => setPicker("pattern")}>
        <span className="info-key">pattern</span>
        <span className="info-val">{patInfo?.name ?? "---"}</span>
      </button>
      {patInfo?.desc && <div className="info-desc">{patInfo.desc}</div>}

      {/* Key + Octave (not for J-6) */}
      {hasKey && keys && (
        <div className="key-octave-row">
          <button className="info-row half" onClick={() => setPicker("key")}>
            <span className="info-key">key</span>
            <span className="info-val">{keys[keyIdx ?? 0]}</span>
          </button>
          <button className="info-row half" onClick={() => setPicker("octave")}>
            <span className="info-key">oct</span>
            <span className="info-val">{octave}</span>
          </button>
        </div>
      )}

      {/* T-8 bass genre + pattern */}
      {isT8 && t8 && (
        <>
          <button className="info-row" onClick={() => setPicker("bass_genre")}>
            <span className="info-key">bass genre</span>
            <span className="info-val" style={{ color: accent }}>
              {bassGenreList?.[t8.bass_genre_idx]?.name ?? "---"}
            </span>
          </button>
          <button className="info-row" onClick={() => setPicker("bass_pattern")}>
            <span className="info-key">bass pat</span>
            <span className="info-val">
              {bassPatternList?.[t8.bass_pattern_idx]?.name ?? "---"}
            </span>
          </button>
        </>
      )}

      {/* Beat indicator */}
      <BeatIndicator step={state.step} accent={accent} />

      {/* Grids */}
      {isT8 && t8 ? (
        <>
          <DrumGrid drumData={t8.drum_data} currentStep={state.step} accent={accent} />
          <BassGrid steps={t8.bass_data} currentStep={state.step} accent={accent} />
        </>
      ) : (
        <StepGrid
          steps={"pattern_data" in state ? (state as S1State | J6State).pattern_data : []}
          currentStep={state.step}
          accent={accent}
        />
      )}

      {/* Pickers */}
      {picker === "genre" && genreList && (
        <Picker
          title={`${label} Genre`}
          items={genreList.map((g) => ({ label: g.name }))}
          selectedIdx={genreIdx}
          onSelect={(i) => command({ type: "set_genre", device, idx: i })}
          onClose={() => setPicker(null)}
          accent={accent}
        />
      )}
      {picker === "pattern" && patternList && (
        <Picker
          title={`${label} Pattern`}
          items={patternList.map((p) => ({ label: p.name, desc: p.desc }))}
          selectedIdx={patIdx}
          onSelect={(i) => command({ type: "set_pattern", device, idx: i })}
          onClose={() => setPicker(null)}
          accent={accent}
        />
      )}
      {picker === "key" && keys && (
        <Picker
          title="Key"
          items={keys.map((k) => ({ label: k }))}
          selectedIdx={keyIdx ?? 0}
          onSelect={(i) => command({ type: "set_key", device, idx: i })}
          onClose={() => setPicker(null)}
          accent={accent}
        />
      )}
      {picker === "octave" && (
        <Picker
          title="Octave"
          items={Array.from({ length: octaveMax - octaveMin + 1 }, (_, i) => ({
            label: String(octaveMin + i),
          }))}
          selectedIdx={(octave ?? 2) - octaveMin}
          onSelect={(i) => command({ type: "set_octave", device, octave: octaveMin + i })}
          onClose={() => setPicker(null)}
          accent={accent}
        />
      )}
      {picker === "bass_genre" && isT8 && bassGenreList && t8 && (
        <Picker
          title="T-8 Bass Genre"
          items={bassGenreList.map((g) => ({ label: g.name }))}
          selectedIdx={t8.bass_genre_idx}
          onSelect={(i) => command({ type: "set_genre", device: "t8_bass", idx: i })}
          onClose={() => setPicker(null)}
          accent={accent}
        />
      )}
      {picker === "bass_pattern" && isT8 && bassPatternList && t8 && (
        <Picker
          title="T-8 Bass Pattern"
          items={bassPatternList.map((p) => ({ label: p.name, desc: p.desc }))}
          selectedIdx={t8.bass_pattern_idx}
          onSelect={(i) => command({ type: "set_pattern", device: "t8_bass", idx: i })}
          onClose={() => setPicker(null)}
          accent={accent}
        />
      )}
    </div>
  );
}
