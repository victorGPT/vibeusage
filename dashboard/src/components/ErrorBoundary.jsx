import React from "react";
import { copy } from "../lib/copy";
import { StateScreen } from "../ui/vu1/StateScreen";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (import.meta?.env?.DEV) {
      console.error("ErrorBoundary caught an error:", error, info);
    } else {
      console.error("ErrorBoundary caught an error:", error);
    }
  }

  handleReload() {
    if (typeof window === "undefined") return;
    window.location.reload();
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const errorMessage = String(error?.message || error || "");
    return (
      <div className="px-s4 pt-s4 pb-s8">
        <main className="grid-page mx-auto max-w-shell">
          <div className="col-span-12 lg:col-start-2 lg:col-end-12">
            <StateScreen
              variant="crash"
              detail={copy("shared.error.prefix", { error: errorMessage || "-" })}
              onRetry={this.handleReload}
            />
          </div>
        </main>
      </div>
    );
  }
}
