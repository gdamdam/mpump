import { useRef, useCallback, useState, useEffect } from "react";
import type { ClientMessage } from "../types";

const MIN_BPM = 20;
const MAX_BPM = 300;

interface Props {
  bpm: number;
  command: (msg: ClientMessage) => void;
  showModal?: boolean;
  onModalClose?: () => void;
}

export function BpmControl({ bpm, command, showModal, onModalClose }: Props) {
  const timerRef = useRef<number>(0);
  const holdCount = useRef(0);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // External trigger (keyboard shortcut B)
  useEffect(() => {
    if (showModal && !editing) {
      setEditing(true);
    }
  }, [showModal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editing) {
      // Focus and select on next frame
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing]);

  const closeModal = () => {
    setEditing(false);
    onModalClose?.();
  };

  const applyBpm = (val: string) => {
    const n = parseInt(val);
    if (!isNaN(n) && n >= MIN_BPM && n <= MAX_BPM) {
      command({ type: "set_bpm", bpm: n });
    }
    closeModal();
  };

  const step = useCallback(
    (delta: number) => {
      holdCount.current++;
      const size = holdCount.current > 15 ? 5 * Math.sign(delta) : delta;
      const next = Math.max(MIN_BPM, Math.min(MAX_BPM, bpmRef.current + size));
      if (next !== bpmRef.current) command({ type: "set_bpm", bpm: next });
    },
    [command],
  );

  const startHold = useCallback(
    (delta: number) => {
      holdCount.current = 0;
      step(delta);
      let delay = 200;
      const tick = () => {
        step(delta);
        delay = Math.max(60, delay - 8);
        timerRef.current = window.setTimeout(tick, delay);
      };
      timerRef.current = window.setTimeout(tick, delay);
    },
    [step],
  );

  const stopHold = useCallback(() => {
    clearTimeout(timerRef.current);
    holdCount.current = 0;
  }, []);

  return (
    <>
      <div className="bpm-control">
        <div className="bpm-arrows">
          <button className="bpm-arrow" title="Increase BPM"
            onPointerDown={() => startHold(1)} onPointerUp={stopHold} onPointerLeave={stopHold}>▲</button>
          <button className="bpm-arrow" title="Decrease BPM"
            onPointerDown={() => startHold(-1)} onPointerUp={stopHold} onPointerLeave={stopHold}>▼</button>
        </div>
        <div className="bpm-display" onClick={() => setEditing(true)} style={{ cursor: "pointer" }} title="Click to set BPM">
          <span className="bpm-value">{bpm}</span>
          <span className="bpm-label">BPM</span>
        </div>
      </div>
      {editing && (
        <div className="bpm-modal-overlay" onClick={closeModal}>
          <div className="bpm-modal" onClick={e => e.stopPropagation()}>
            <div className="bpm-modal-title">Set BPM</div>
            <input
              ref={inputRef}
              className="bpm-modal-input"
              type="number"
              min={MIN_BPM}
              max={MAX_BPM}
              defaultValue={bpm}
              onKeyDown={e => {
                if (e.key === "Enter") applyBpm((e.target as HTMLInputElement).value);
                if (e.key === "Escape") closeModal();
              }}
            />
            <div className="bpm-modal-range">{MIN_BPM}–{MAX_BPM}</div>
            <div className="bpm-modal-actions">
              <button className="bpm-modal-btn" onClick={closeModal}>Cancel</button>
              <button className="bpm-modal-btn bpm-modal-btn-ok" onClick={() => applyBpm(inputRef.current?.value ?? "")}>Set</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
