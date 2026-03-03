import { useEffect, useRef } from "react";

interface Props {
  title: string;
  items: { label: string; desc?: string }[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  onClose: () => void;
  accent: string;
}

export function Picker({ title, items, selectedIdx, onSelect, onClose, accent }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll selected item into view
    const el = listRef.current?.children[selectedIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "center" });
  }, [selectedIdx]);

  // Close on backdrop tap
  const handleBackdrop = (e: React.PointerEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="picker-backdrop" onPointerDown={handleBackdrop}>
      <div className="picker-sheet">
        <div className="picker-header">
          <span className="picker-title" style={{ color: accent }}>{title}</span>
          <button className="picker-close" onClick={onClose}>&times;</button>
        </div>
        <div className="picker-list" ref={listRef}>
          {items.map((item, i) => (
            <button
              key={i}
              className={`picker-item ${i === selectedIdx ? "selected" : ""}`}
              style={i === selectedIdx ? { borderColor: accent, color: accent } : undefined}
              onClick={() => {
                onSelect(i);
                onClose();
              }}
            >
              <span className="picker-item-label">{item.label}</span>
              {item.desc && <span className="picker-item-desc">{item.desc}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
