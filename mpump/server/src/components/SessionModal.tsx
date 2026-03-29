import { useState, useRef, useEffect } from "react";

interface Props {
  defaultName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

export function SessionModal({ defaultName, onSave, onClose }: Props) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const [name, setName] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-header">
          <span className="share-title">Export Session</span>
          <button className="settings-close" title="Close" onClick={onClose}>✕</button>
        </div>
        <div className="share-hint">
          Save your full session — patterns, sounds, effects, volumes, and settings — as a JSON file you can import later.
        </div>
        <div className="share-url-row">
          <input
            ref={inputRef}
            className="share-url-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onClick={() => inputRef.current?.select()}
            onKeyDown={(e) => { if (e.key === "Enter") { onSave(name); onClose(); } }}
          />
          <button
            className="share-copy-btn"
            onClick={() => { onSave(name); onClose(); }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
