import React, { useMemo } from "react";

import { useBackendStatus } from "../hooks/use-backend-status.js";

const DOT_CLASSES = {
  unknown: "bg-white/30",
  active: "bg-[#00FF41]",
  error: "bg-yellow-400",
  down: "bg-red-400",
};

export function BackendStatus({ baseUrl }) {
  const { status, checking, httpStatus, lastCheckedAt, lastOkAt, error, refresh } =
    useBackendStatus({ baseUrl });

  const host = useMemo(() => safeHost(baseUrl), [baseUrl]);
  const label = host || "Backend";
  const dotClass = DOT_CLASSES[status] || DOT_CLASSES.unknown;

  const title = useMemo(() => {
    const meta = [
      `status=${status}`,
      host ? `host=${host}` : null,
      lastCheckedAt ? `checked=${lastCheckedAt}` : null,
      lastOkAt ? `ok=${lastOkAt}` : null,
      httpStatus != null ? `http=${httpStatus}` : null,
      error ? `error=${error}` : null,
      "click=refresh",
    ]
      .filter(Boolean)
      .join(" • ");

    return meta;
  }, [error, host, httpStatus, lastCheckedAt, lastOkAt, status]);

  return (
    <button
      type="button"
      onClick={refresh}
      title={title}
      className="flex items-center max-w-[260px] hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF41]/30"
    >
      <span
        className={[
          "w-1.5 h-1.5 rounded-full mr-2",
          dotClass,
          checking ? "animate-pulse" : null,
        ]
          .filter(Boolean)
          .join(" ")}
      ></span>
      <span className="truncate">
        {label}
        {checking ? "…" : ""}
      </span>
    </button>
  );
}

function safeHost(baseUrl) {
  try {
    const u = new URL(baseUrl);
    return u.host;
  } catch (_e) {
    return null;
  }
}
