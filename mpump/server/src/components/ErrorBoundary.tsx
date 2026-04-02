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
          <div style={{ fontSize: 13, opacity: 0.7 }}>Please reload the page.</div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
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
        </div>
      );
    }

    return this.props.children;
  }
}
