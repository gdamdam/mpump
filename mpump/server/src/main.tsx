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

// Report unhandled errors to worker + console
const ERROR_URL = import.meta.env.DEV ? "http://localhost:8787/error" : "https://s.mpump.live/error";
function reportError(message: string, stack?: string) {
  fetch(ERROR_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, stack, ua: navigator.userAgent }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => {});
}
window.addEventListener("error", (e) => {
  console.error("Unhandled error:", e.error);
  reportError(e.message, e.error?.stack);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled rejection:", e.reason);
  reportError(String(e.reason), e.reason?.stack);
});

// Register service worker for PWA install + offline support
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
