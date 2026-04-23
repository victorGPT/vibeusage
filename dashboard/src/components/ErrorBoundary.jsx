import { Button } from "@base-ui/react/button";
import React from "react";
import { copy } from "../lib/copy";

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
    const errorLabel = errorMessage
      ? copy("shared.error.prefix", { error: errorMessage })
      : copy("error.boundary.no_details");

    return (
      <div className="min-h-screen bg-surface text-ink font-mono flex items-center justify-center p-6">
        <div className="w-full max-w-xl border border-ink-muted bg-surface/70 p-6 text-center space-y-4">
          <div className="text-micro uppercase tracking-caps opacity-60">
            {copy("error.boundary.title")}
          </div>
          <div className="text-display-3 font-black text-ink-bright">{copy("error.boundary.subtitle")}</div>
          <div className="text-micro opacity-60">{copy("error.boundary.hint")}</div>
          <div className="text-micro text-ink-text break-words">{errorLabel}</div>
          <Button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center justify-center px-4 py-2 border border-ink text-micro font-black uppercase tracking-caps text-ink hover:bg-ink hover:text-surface transition-colors"
          >
            {copy("error.boundary.action.reload")}
          </Button>
        </div>
      </div>
    );
  }
}
