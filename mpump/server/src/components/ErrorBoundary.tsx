import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("mpump crash:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 32,
          textAlign: "center",
          fontFamily: "monospace",
          color: "#c8e6c8",
          background: "#0b1a0b",
        }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Something went wrong.</div>
          <div style={{ fontSize: 13, opacity: 0.7, maxWidth: 340, lineHeight: 1.6 }}>
            Try reloading the page. If the problem persists, a full reset will clear saved data and start fresh.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                background: "#66ff99",
                color: "#000",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Reload
            </button>
            <button
              onClick={() => {
                if (confirm("This will clear all saved settings, presets, and sessions. Continue?")) {
                  localStorage.clear();
                  window.location.href = window.location.pathname;
                }
              }}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                background: "transparent",
                color: "#66ff99",
                border: "1px solid #66ff99",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Full Reset
            </button>
          </div>
          <div style={{ fontSize: 11, opacity: 0.4, marginTop: 12 }}>
            Full reset clears all saved data. Your beats and settings will be lost.
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
