import { useRef, useCallback, useState } from "react";
import { classifyGesture } from "../utils/gridGesture";

/**
 * Shared pointer + keyboard behavior for the step/drum/bass grids (#3 + #5).
 *
 * Pointer gestures (one finger / mouse), classified by initial drag direction:
 *  - tap (no drag)        → onTap(i)            toggle the cell
 *  - horizontal drag      → onPaint(i, on)      paint cells under the pointer
 *  - vertical drag        → onVerticalStart/Move(i, dy)   pitch (melodic) / velocity (drums)
 *  - hold without moving  → onLongPress(i)      open the step editor (melodic grids)
 *
 * Accessibility: cells are exposed as toggle buttons (role="button" +
 * aria-pressed) with a roving tabindex — Arrow/Home/End move focus within the
 * row, Enter/Space toggles. The container is a labelled group.
 *
 * Cells must spread cellProps(i) (which sets data-grid-idx, used by the
 * elementFromPoint paint hit-test) and the container must use gridRef + gridHandlers.
 */
export interface GridPointerOpts {
  cellCount: number;
  /** Is cell i currently filled? Decides paint direction + aria-pressed. */
  cellOn: (i: number) => boolean;
  onTap: (i: number) => void;
  /** Set cell i to `on` during a horizontal paint drag. */
  onPaint: (i: number, on: boolean) => void;
  /** Vertical drag began on cell i — capture its starting value. */
  onVerticalStart?: (i: number) => void;
  /** Vertical drag moved; dy = px from the press point (up = negative). */
  onVerticalMove?: (i: number, dy: number) => void;
  onLongPress?: (i: number) => void;
  /** Screen-reader label for cell i. */
  cellLabel?: (i: number) => string;
  longPressMs?: number;
  threshold?: number;
}

export function useGridPointer(opts: GridPointerOpts) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const cellEls = useRef<(HTMLElement | null)[]>([]);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const g = useRef<{
    sx: number; sy: number; idx: number;
    kind: "pending" | "paint" | "adjust";
    paintOn: boolean; painted: Set<number>; longFired: boolean;
  } | null>(null);
  const timer = useRef(0);
  const [pressingIdx, setPressingIdx] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);

  const idxFromPoint = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const cell = el?.closest("[data-grid-idx]") as HTMLElement | null;
    if (!cell || !gridRef.current?.contains(cell)) return null;
    const i = Number(cell.dataset.gridIdx);
    return Number.isInteger(i) ? i : null;
  };

  const reset = useCallback(() => {
    clearTimeout(timer.current);
    g.current = null;
    setPressingIdx(null);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const cell = (e.target as HTMLElement).closest("[data-grid-idx]") as HTMLElement | null;
    if (!cell || !gridRef.current?.contains(cell)) return;
    const idx = Number(cell.dataset.gridIdx);
    if (!Number.isInteger(idx)) return;
    const o = optsRef.current;
    g.current = { sx: e.clientX, sy: e.clientY, idx, kind: "pending", paintOn: false, painted: new Set(), longFired: false };
    setPressingIdx(idx);
    setFocusIdx(idx);
    clearTimeout(timer.current);
    if (o.onLongPress) {
      timer.current = window.setTimeout(() => {
        const s = g.current;
        if (s && s.kind === "pending") { s.longFired = true; setPressingIdx(null); o.onLongPress?.(s.idx); }
      }, o.longPressMs ?? 500);
    }
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* */ }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = g.current;
    if (!s || s.longFired) return;
    const o = optsRef.current;
    const dx = e.clientX - s.sx;
    const dy = e.clientY - s.sy;
    if (s.kind === "pending") {
      const k = classifyGesture(dx, dy, o.threshold ?? 6);
      if (k === "pending") return;
      clearTimeout(timer.current);
      s.kind = k;
      setPressingIdx(null);
      if (k === "paint") {
        s.paintOn = !o.cellOn(s.idx);
        o.onPaint(s.idx, s.paintOn);
        s.painted.add(s.idx);
      } else {
        o.onVerticalStart?.(s.idx);
      }
    }
    if (s.kind === "paint") {
      const i = idxFromPoint(e.clientX, e.clientY);
      if (i !== null && !s.painted.has(i)) { o.onPaint(i, s.paintOn); s.painted.add(i); }
    } else if (s.kind === "adjust") {
      o.onVerticalMove?.(s.idx, dy);
    }
  }, []);

  const onPointerUp = useCallback(() => {
    const s = g.current;
    if (s && !s.longFired && s.kind === "pending") optsRef.current.onTap(s.idx);
    reset();
  }, [reset]);

  const moveFocus = useCallback((next: number) => {
    const i = Math.max(0, Math.min(optsRef.current.cellCount - 1, next));
    setFocusIdx(i);
    cellEls.current[i]?.focus();
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const cell = (e.target as HTMLElement).closest("[data-grid-idx]") as HTMLElement | null;
    const idx = cell ? Number(cell.dataset.gridIdx) : focusIdx;
    const cur = Number.isInteger(idx) ? idx : focusIdx;
    switch (e.key) {
      case "ArrowRight": moveFocus(cur + 1); break;
      case "ArrowLeft": moveFocus(cur - 1); break;
      case "Home": moveFocus(0); break;
      case "End": moveFocus(optsRef.current.cellCount - 1); break;
      case "Enter":
      case " ": optsRef.current.onTap(cur); break;
      default: return;
    }
    e.preventDefault();
  }, [focusIdx, moveFocus]);

  // NOTE: each cell must ALSO set `data-grid-idx={i}` in JSX (kept out of this
  // object so the data-* attr doesn't trip the spread's type-check); the hook
  // reads it from the DOM for the elementFromPoint paint hit-test.
  const cellProps = (i: number) => ({
    role: "button" as const,
    "aria-pressed": optsRef.current.cellOn(i),
    "aria-label": optsRef.current.cellLabel?.(i),
    tabIndex: i === focusIdx ? 0 : -1,
    onKeyDown,
    ref: (el: HTMLElement | null) => { cellEls.current[i] = el; },
  });

  return {
    gridRef,
    gridHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onLostPointerCapture: reset,
    },
    cellProps,
    pressingIdx,
  };
}
