/**
 * ThemePicker — Simple day/night toggle between Minimal and Forest.
 * All themes available in Settings.
 */

import { useState, useEffect } from "react";
import { PALETTES, type PaletteId } from "./Settings";
import { getItem, setItem } from "../utils/storage";

function loadPalette(): PaletteId {
  const stored = getItem("mpump-palette");
  if (stored && PALETTES.find(p => p.id === stored)) return stored as PaletteId;
  return "forest";
}

function applyPalette(p: typeof PALETTES[number]) {
  const root = document.documentElement;
  root.style.setProperty("--bg", p.bg);
  root.style.setProperty("--bg-panel", p.panel);
  root.style.setProperty("--bg-cell", p.cell);
  root.style.setProperty("--border", p.border);
  root.style.setProperty("--text", p.text);
  root.style.setProperty("--text-dim", p.dim);
  root.style.setProperty("--preview", p.preview);
  root.style.setProperty("--fg", p.text);
  root.style.setProperty("--fg-dim", p.dim);
  document.body.style.background = p.bg;
  document.body.style.color = p.text;
}

export function ThemePicker() {
  const [palette, setPalette] = useState<PaletteId>(loadPalette);

  useEffect(() => {
    const p = PALETTES.find(x => x.id === palette)!;
    applyPalette(p);
    setItem("mpump-palette", palette);
  }, [palette]);

  // Toggle between minimal (day) and forest (night)
  const toggle = () => {
    const next = palette === "minimal" ? "forest" : "minimal";
    setPalette(next);
  };

  const isDark = palette !== "minimal";

  return (
    <button
      className="header-settings-btn"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
    >
{"\u25D1"}
    </button>
  );
}
