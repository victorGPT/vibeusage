import React from "react";

import { copy } from "../lib/copy.js";

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
      <div className="min-h-screen bg-black text-[#00FF41] font-mono flex items-center justify-center p-6">
        <div className="w-full max-w-xl border border-[#00FF41]/30 bg-black/70 p-6 text-center space-y-4">
          <div className="text-[10px] uppercase tracking-[0.6em] opacity-60">
            {copy("error.boundary.title")}
          </div>
          <div className="text-2xl font-black text-white">
            {copy("error.boundary.subtitle")}
          </div>
          <div className="text-[10px] opacity-60">
            {copy("error.boundary.hint")}
          </div>
          <div className="text-[10px] text-[#00FF41]/80 break-words">
            {errorLabel}
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center justify-center px-4 py-2 border border-[#00FF41] text-[10px] font-black uppercase tracking-[0.4em] text-[#00FF41] hover:bg-[#00FF41] hover:text-black transition-colors"
          >
            {copy("error.boundary.action.reload")}
          </button>
        </div>
      </div>
    );
  }
}
