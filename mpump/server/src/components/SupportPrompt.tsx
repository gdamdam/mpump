/**
 * SupportPrompt — non-intrusive support modal + toast triggered after exports/shares.
 *
 * Export schedule:
 *   Export 5:  toast (first gentle nudge)
 *   Export 10: modal (one-time intro with context)
 *   Export 15, 30, 45...: toast (every 15th)
 *
 * Share schedule:
 *   Share 10:  toast (first nudge)
 *   Share 15:  modal
 *   Share 20, 30, 40...: toast (every 10th after the modal)
 *
 * Remix schedule:
 *   Remix share 1: toast only
 *
 * Footer "Support ♥" links directly to Ko-fi (no modal).
 * Toast "Support" button opens the modal.
 */

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { getJSON, setJSON } from "../utils/storage";
import { trackEvent } from "../utils/metrics";

const KOFI_URL = "https://ko-fi.com/gdamdam";

function shouldShowToast(n: number): boolean {
  if (n === 5) return true;
  if (n >= 15 && n % 15 === 0) return true;
  return false;
}

function shouldShowShareToast(n: number): boolean {
  if (n === 10) return true;
  if (n >= 20 && n % 10 === 0) return true;
  return false;
}

export function useSupportPrompt() {
  const [showModal, setShowModal] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const onExport = useCallback(() => {
    const count = getJSON<number>("mpump-export-count", 0) + 1;
    setJSON("mpump-export-count", count);

    if (count === 10) {
      setShowModal(true);
    } else if (shouldShowToast(count)) {
      setShowToast(true);
    }
  }, []);

  const onShare = useCallback(() => {
    const count = getJSON<number>("mpump-share-count", 0) + 1;
    setJSON("mpump-share-count", count);

    if (count === 15) {
      setShowModal(true);
    } else if (shouldShowShareToast(count)) {
      setShowToast(true);
    }
  }, []);

  const onRemixShare = useCallback(() => {
    const count = getJSON<number>("mpump-remix-share-count", 0) + 1;
    setJSON("mpump-remix-share-count", count);
    if (count === 1) setShowToast(true);
  }, []);

  return { showModal, setShowModal, showToast, setShowToast, onExport, onShare, onRemixShare };
}

// ── Modal ──────────────────────────────────────

interface ModalProps {
  onClose: () => void;
}

function SupportModal({ onClose }: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return createPortal(
    <div className="support-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="support-modal">
        <button className="support-modal-close" onClick={onClose}>✕</button>
        <h2>Support mpump</h2>
        <p>
          mpump is free and open source by design. If it's useful in your creative workflow,
          you can support its development.
        </p>
        <a href={KOFI_URL} target="_blank" rel="noopener noreferrer" className="support-modal-btn" onClick={() => trackEvent("kofi-modal")}>
          Support on Ko-fi
        </a>
        <div className="support-modal-footer">Always free. No features locked.</div>
      </div>
    </div>,
    document.body,
  );
}

// ── Toast ──────────────────────────────────────

interface ToastProps {
  onDismiss: () => void;
  onSupport: () => void;
}

function SupportToast({ onDismiss, onSupport }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return createPortal(
    <div className="support-toast">
      <span className="support-toast-text">If mpump is useful to you, consider supporting it.</span>
      <div className="support-toast-actions">
        <button className="support-toast-btn" onClick={onSupport}>Support</button>
        <button className="support-toast-dismiss" onClick={onDismiss}>✕</button>
      </div>
    </div>,
    document.body,
  );
}

// ── Combined renderer ──────────────────────────

interface SupportPromptProps {
  showModal: boolean;
  setShowModal: (v: boolean) => void;
  showToast: boolean;
  setShowToast: (v: boolean) => void;
}

export function SupportPromptUI({ showModal, setShowModal, showToast, setShowToast }: SupportPromptProps) {
  return (
    <>
      {showModal && <SupportModal onClose={() => setShowModal(false)} />}
      {showToast && (
        <SupportToast
          onDismiss={() => setShowToast(false)}
          onSupport={() => { setShowToast(false); setShowModal(true); }}
        />
      )}
    </>
  );
}
