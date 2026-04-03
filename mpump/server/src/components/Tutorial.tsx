import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { PALETTES, type PaletteId } from "./Settings";
import { getItem, setItem } from "../utils/storage";
import { trackEvent } from "../utils/metrics";

const STORAGE_KEY = "mpump-tutorial-done";

interface Step {
  title: string;
  body: string;
  /** CSS selector for the spotlight target (desktop only). */
  target?: string;
  /** CSS class to add to the target element while this step is active. */
  highlight?: string;
  /** If true, this is the final step with special layout. */
  last?: boolean;
}

const STEPS: Step[] = [
  { title: "Welcome to mpump", body: "Make a beat, share it as a link. The other person can open it and change it too." },
  { title: "Play and mix", body: "▶ starts playback. MIX gives you a new groove. Drag the XY pad to shape the sound.", target: ".shuffle-btn" },
  { title: "Share it", body: "Send a playable link. They open it, hear your beat, and can change it. No app needed.", target: ".header-share-btn" },
  { title: "Jam together", body: "Start a live session with up to 4 friends, or a Live Set for up to 49 listeners.", target: ".jam-header-btn" },
  { title: "Works offline", body: "Bookmark or install as an app. Your stuff stays in your browser." },
  { title: "Go make something", body: "Everything you make is yours.\nNo install. No account. No personal data.", last: true },
];

const MOBILE_BREAKPOINT = 700;
const SPOTLIGHT_PADDING = 8;
const CARD_GAP = 12;

export function useTutorial() {
  const [show, setShow] = useState(() => !getItem(STORAGE_KEY));

  const dismiss = () => {
    setShow(false);
    setItem(STORAGE_KEY, "1");
  };

  return { showTutorial: show, dismissTutorial: dismiss };
}

interface Props {
  onDismiss: () => void;
}

function applyTheme(p: typeof PALETTES[number]) {
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
  setItem("mpump-palette", p.id);
}

/** Build a clip-path polygon covering the full viewport with a rectangular cutout. */
function buildClipPath(rect: DOMRect): string {
  const p = SPOTLIGHT_PADDING;
  const x1 = rect.left - p;
  const y1 = rect.top - p;
  const x2 = rect.right + p;
  const y2 = rect.bottom + p;

  // Outer rect (full viewport) wound clockwise, inner cutout wound counter-clockwise = hole
  return `polygon(evenodd,
    0px 0px, 100vw 0px, 100vw 100vh, 0px 100vh, 0px 0px,
    ${x1}px ${y1}px, ${x1}px ${y2}px, ${x2}px ${y2}px, ${x2}px ${y1}px, ${x1}px ${y1}px
  )`;
}

/** Compute card position: prefer below the target, fall back to above. */
function computeCardPos(targetRect: DOMRect, cardHeight: number): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardWidth = Math.min(380, vw - 32);

  // Center card horizontally relative to target, clamped to viewport
  let left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
  left = Math.max(16, Math.min(left, vw - cardWidth - 16));

  const spaceBelow = vh - (targetRect.bottom + SPOTLIGHT_PADDING + CARD_GAP);
  const spaceAbove = targetRect.top - SPOTLIGHT_PADDING - CARD_GAP;

  if (spaceBelow >= cardHeight) {
    return { position: "fixed", top: targetRect.bottom + SPOTLIGHT_PADDING + CARD_GAP, left, maxWidth: cardWidth, width: "90vw" };
  } else if (spaceAbove >= cardHeight) {
    return { position: "fixed", bottom: vh - (targetRect.top - SPOTLIGHT_PADDING - CARD_GAP), left, maxWidth: cardWidth, width: "90vw" };
  }
  return { position: "fixed", top: targetRect.bottom + SPOTLIGHT_PADDING + CARD_GAP, left, maxWidth: cardWidth, width: "90vw" };
}

export function Tutorial({ onDismiss }: Props) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onDismiss]);

  const [step, setStep] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState<PaletteId | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [clipPath, setClipPath] = useState<string | null>(null);
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({});
  const isMobile = typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;

  const positionSpotlight = useCallback(() => {
    const s = STEPS[step];
    if (isMobile || !s.target) {
      setClipPath(null);
      setCardStyle({});
      return;
    }

    const el = document.querySelector(s.target);
    if (!el) {
      setClipPath(null);
      setCardStyle({});
      return;
    }

    el.scrollIntoView({ behavior: "smooth", block: "nearest" });

    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      setClipPath(buildClipPath(rect));
      const cardHeight = cardRef.current?.offsetHeight ?? 200;
      setCardStyle(computeCardPos(rect, cardHeight));
    });
  }, [step, isMobile]);

  // Add/remove highlight class on target element
  useEffect(() => {
    const s = STEPS[step];
    if (!s.target || !s.highlight) return;
    const el = document.querySelector(s.target);
    if (!el) return;
    el.classList.add(s.highlight!);
    return () => { el.classList.remove(s.highlight!); };
  }, [step]);

  useEffect(() => {
    positionSpotlight();
    const handleResize = () => positionSpotlight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [positionSpotlight]);

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const hasSpotlight = !isMobile && !!clipPath;

  const cardContent = (
    <>
      <div className="tutorial-step-count">{step + 1} / {STEPS.length}</div>
      <div className="tutorial-title">{s.title}</div>
      {s.body === "_theme_" ? (
        <div className="tutorial-themes">
          <div className="tutorial-body">Choose a color theme. You can change it anytime with the ◐ button.</div>
          <div className="tutorial-theme-grid">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                className={`tutorial-theme-btn ${selectedTheme === p.id ? "active" : ""}`}
                style={{ background: p.bg, borderColor: selectedTheme === p.id ? p.preview : p.border }}
                onClick={() => { setSelectedTheme(p.id); applyTheme(p); }}
              >
                <span style={{ color: p.preview, fontSize: 10, fontWeight: 700 }}>{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="tutorial-body">{s.body}</div>
      )}
      <div className="tutorial-actions">
        {step > 0 && <button className="tutorial-skip" onClick={() => setStep(step - 1)}>Back</button>}
        {!s.last && <button className="tutorial-skip" onClick={() => { trackEvent("tutorial-skip"); onDismiss(); }}>Skip</button>}
        <button
          className="tutorial-next"
          onClick={() => { if (isLast) { trackEvent("tutorial-complete"); onDismiss(); } else setStep(step + 1); }}
        >
          {isLast ? "Make some noise" : "Next"}
        </button>
      </div>
      {s.last && <div style={{ textAlign: "center", fontSize: 28, marginTop: 12 }}>🤟😁</div>}
      <div className="tutorial-dots">
        {STEPS.map((_, i) => (
          <div key={i} className={`tutorial-dot ${i === step ? "active" : ""}`} />
        ))}
      </div>
    </>
  );

  if (hasSpotlight) {
    return createPortal(
      <>
        <div
          className="tutorial-overlay tutorial-spotlight"
          style={{ clipPath, WebkitClipPath: clipPath } as React.CSSProperties}
          onClick={onDismiss}
        />
        <div
          ref={cardRef}
          className="tutorial-card tutorial-card-floating"
          style={cardStyle}
          onClick={(e) => e.stopPropagation()}
        >
          {cardContent}
        </div>
      </>,
      document.body,
    );
  }

  return (
    <div className="tutorial-overlay" onClick={onDismiss}>
      <div ref={cardRef} className="tutorial-card" onClick={(e) => e.stopPropagation()}>
        {cardContent}
      </div>
    </div>
  );
}
