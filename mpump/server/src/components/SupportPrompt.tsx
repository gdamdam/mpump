/**
 * SupportPrompt — non-intrusive support modal + toast triggered after exports/shares.
 *
 * Export schedule:
 *   Export 1:  toast (first gentle nudge)
 *   Export 2:  modal (one-time intro with context)
 *   Export 4:  toast
 *   Export 7:  toast
 *   Export 10, 20, 30...: toast (every 10th)
 *
 * Share schedule (starts later — sharing is lighter engagement):
 *   Share 3:   toast (first nudge)
 *   Share 5:   modal
 *   Share 7:   toast
 *   Share 10, 20, 30...: toast (every 10th)
 *
 * Footer "Support ♥" links directly to Ko-fi (no modal).
 * Toast "Support" button opens the modal.
 */

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { getJSON, setJSON } from "../utils/storage";

const KOFI_URL = "https://ko-fi.com/gdamdam";

function shouldShowToast(n: number): boolean {
  if (n === 1 || n === 4 || n === 7 || n === 10) return true;
  if (n > 10 && n % 10 === 0) return true;
  return false;
}

function shouldShowShareToast(n: number): boolean {
  if (n === 3 || n === 7 || n === 10) return true;
  if (n > 10 && n % 10 === 0) return true;
  return false;
}

export function useSupportPrompt() {
  const [showModal, setShowModal] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const onExport = useCallback(() => {
    const count = getJSON<number>("mpump-export-count", 0) + 1;
    setJSON("mpump-export-count", count);

    const isMobile = window.innerWidth < 700;

    if (count === 2) {
      setShowModal(true);
    } else if (shouldShowToast(count)) {
      if (isMobile) {
        setShowModal(true);
      } else {
        setShowToast(true);
      }
    }
  }, []);

  const onShare = useCallback(() => {
    const count = getJSON<number>("mpump-share-count", 0) + 1;
    setJSON("mpump-share-count", count);

    const isMobile = window.innerWidth < 700;

    if (count === 5) {
      setShowModal(true);
    } else if (shouldShowShareToast(count)) {
      if (isMobile) {
        setShowModal(true);
      } else {
        setShowToast(true);
      }
    }
  }, []);

  return { showModal, setShowModal, showToast, setShowToast, onExport, onShare };
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
        <a href={KOFI_URL} target="_blank" rel="noopener noreferrer" className="support-modal-btn">
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
