/**
 * Pure helpers for grid pointer gestures (shared by useGridPointer).
 * Kept side-effect free so they can be unit-tested without the DOM.
 */

export type GestureKind = "pending" | "paint" | "adjust";

/**
 * Classify a drag from its delta relative to the press point:
 *  - below `threshold` in both axes → "pending" (still a candidate tap)
 *  - horizontal-dominant → "paint" (toggle cells under the pointer)
 *  - vertical-dominant (ties included) → "adjust" (pitch on melodic grids,
 *    velocity on drums)
 */
export function classifyGesture(dx: number, dy: number, threshold = 6): GestureKind {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < threshold && ady < threshold) return "pending";
  return adx > ady ? "paint" : "adjust";
}

/**
 * Quantize a vertical drag into integer steps. Screen Y grows downward, so an
 * upward drag (negative dy) yields positive steps ("more"). Returns 0 for a
 * non-positive step size.
 */
export function dyToSteps(dy: number, pxPerStep: number): number {
  if (pxPerStep <= 0) return 0;
  return Math.round(-dy / pxPerStep) || 0; // normalize -0 → 0
}
