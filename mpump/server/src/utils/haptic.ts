/**
 * Haptic feedback via navigator.vibrate (Android Chrome, some browsers).
 * Silently no-ops on unsupported platforms (iOS Safari, desktop).
 */

/** Short tap — buttons, toggles, step grid taps. */
export function tapVibrate(): void {
  try { navigator.vibrate?.(8); } catch { /* unsupported */ }
}

/** Medium press — MIX, play/stop, mute. */
export function pressVibrate(): void {
  try { navigator.vibrate?.(15); } catch { /* unsupported */ }
}

/** Heavy — record start, session export. */
export function heavyVibrate(): void {
  try { navigator.vibrate?.(30); } catch { /* unsupported */ }
}
