import { useState, useRef, useEffect } from "react";
import type { EffectName } from "../types";

const LABELS: Record<EffectName, string> = {
  compressor: "COMP",
  highpass: "HPF",
  distortion: "DIST",
  bitcrusher: "CRUSH",
  chorus: "CHORUS",
  phaser: "PHASER",
  delay: "DELAY",
  reverb: "REVERB",
  duck: "DUCK",
};

interface Props {
  order: EffectName[];
  activeEffects: Set<EffectName>;
  onSave: (order: EffectName[]) => void;
  onClose: () => void;
}

export function ChainEditor({ order: initial, activeEffects, onSave, onClose }: Props) {
  const [items, setItems] = useState<EffectName[]>([...initial]);
  const dragging = useRef<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleDragStart = (idx: number) => {
    dragging.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    dragOverIdx.current = idx;
  };

  const handleDrop = (idx: number) => {
    const from = dragging.current;
    if (from === null || from === idx) return;
    const updated = [...items];
    const [moved] = updated.splice(from, 1);
    updated.splice(idx, 0, moved);
    setItems(updated);
    dragging.current = null;
    dragOverIdx.current = null;
  };

  // Touch drag support
  const touchIdx = useRef<number | null>(null);
  const touchClone = useRef<HTMLElement | null>(null);

  const handleTouchStart = (e: React.TouchEvent, idx: number) => {
    touchIdx.current = idx;
    const el = e.currentTarget as HTMLElement;
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.position = "fixed";
    clone.style.pointerEvents = "none";
    clone.style.opacity = "0.8";
    clone.style.zIndex = "9999";
    clone.style.width = el.offsetWidth + "px";
    document.body.appendChild(clone);
    touchClone.current = clone;
    const touch = e.touches[0];
    clone.style.left = touch.clientX - el.offsetWidth / 2 + "px";
    clone.style.top = touch.clientY - 20 + "px";
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (touchClone.current) {
      touchClone.current.style.left = touch.clientX - 40 + "px";
      touchClone.current.style.top = touch.clientY - 20 + "px";
    }
    // Find which item we're over
    const els = document.querySelectorAll(".chain-item");
    for (let i = 0; i < els.length; i++) {
      const rect = els[i].getBoundingClientRect();
      if (touch.clientY > rect.top && touch.clientY < rect.bottom) {
        dragOverIdx.current = i;
        break;
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchClone.current) {
      touchClone.current.remove();
      touchClone.current = null;
    }
    const from = touchIdx.current;
    const to = dragOverIdx.current;
    if (from !== null && to !== null && from !== to) {
      const updated = [...items];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      setItems(updated);
    }
    touchIdx.current = null;
    dragOverIdx.current = null;
  };

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-modal chain-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-header">
          <span className="share-title">Effect Chain Order</span>
          <button className="settings-close" title="Close" onClick={onClose}>✕</button>
        </div>
        <div className="chain-editor-hint">Drag to reorder. Signal flows top → bottom.</div>
        <div className="chain-editor-list">
          {items.map((name, idx) => (
            <div
              key={name}
              className={`chain-item ${activeEffects.has(name) ? "chain-item-active" : ""}`}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onTouchStart={(e) => handleTouchStart(e, idx)}
              onTouchMove={(e) => handleTouchMove(e)}
              onTouchEnd={handleTouchEnd}
            >
              <span className="chain-item-num">{idx + 1}</span>
              <span className="chain-item-grip">⠿</span>
              <span className="chain-item-name">{LABELS[name]}</span>
              {activeEffects.has(name) && <span className="chain-item-dot" />}
            </div>
          ))}
        </div>
        <div className="chain-editor-actions">
          <button className="editor-action-btn save" onClick={() => { onSave(items); onClose(); }}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
