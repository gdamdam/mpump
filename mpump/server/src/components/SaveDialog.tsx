import { useState } from "react";

interface Props {
  accent: string;
  deviceLabel: string;
  onSave: (name: string, desc: string) => void;
  onClose: () => void;
}

export function SaveDialog({ accent, deviceLabel, onSave, onClose }: Props) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const handleBackdrop = (e: React.PointerEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const canSave = name.trim().length > 0;

  return (
    <div className="picker-backdrop" onPointerDown={handleBackdrop}>
      <div className="picker-sheet save-dialog">
        <div className="picker-header">
          <span className="picker-title" style={{ color: accent }}>
            Save to Extras
          </span>
          <button className="picker-close" onClick={onClose}>&times;</button>
        </div>

        <div className="editor-body">
          <div className="editor-row">
            <span className="editor-label">Device</span>
            <span className="editor-value">{deviceLabel}</span>
          </div>

          <div className="editor-row column">
            <span className="editor-label">Name</span>
            <input
              className="save-input"
              type="text"
              placeholder="My Pattern"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={40}
            />
          </div>

          <div className="editor-row column">
            <span className="editor-label">Description (optional)</span>
            <input
              className="save-input"
              type="text"
              placeholder="custom pattern"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={80}
            />
          </div>

          <div className="editor-actions">
            <button className="editor-action-btn delete" onClick={onClose}>
              Cancel
            </button>
            <button
              className="editor-action-btn save"
              style={{ background: canSave ? accent : "#555", color: "#000" }}
              disabled={!canSave}
              onClick={() => {
                if (canSave) {
                  onSave(name.trim(), desc.trim());
                  onClose();
                }
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
