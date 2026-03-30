import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initPalette } from "./components/Settings";
import { trackEvent } from "./utils/metrics";
import "./styles/globals.css";

initPalette();

// Capture Android install prompt for PWA "Add to Home Screen"
let deferredInstallPrompt: Event | null = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  window.dispatchEvent(new Event("mpump-install-available"));
});
/** Trigger the deferred install prompt (Android only). */
export function triggerInstallPrompt(): void {
  if (deferredInstallPrompt && "prompt" in deferredInstallPrompt) {
    trackEvent("pwa-install-prompt");
    (deferredInstallPrompt as { prompt: () => void }).prompt();
    deferredInstallPrompt = null;
  }
}
window.addEventListener("appinstalled", () => trackEvent("pwa-installed"));
export function isInstallAvailable(): boolean {
  return deferredInstallPrompt !== null;
}

// Log unhandled errors to console (debug Firefox crashes)
window.addEventListener("error", (e) => console.error("Unhandled error:", e.error));
window.addEventListener("unhandledrejection", (e) => console.error("Unhandled rejection:", e.reason));

// Register service worker for PWA install + offline support
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
