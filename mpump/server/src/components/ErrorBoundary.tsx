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
          color: "var(--text)",
          background: "var(--bg)",
        }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Something went wrong.</div>
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Reload to try again.</div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: "10px 24px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              background: "var(--preview)",
              color: "#000",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
