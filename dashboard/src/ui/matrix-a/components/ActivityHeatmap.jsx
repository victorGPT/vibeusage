import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { buildActivityHeatmap } from "../../../lib/activity-heatmap.js";

const OPACITY_BY_LEVEL = [0.12, 0.32, 0.5, 0.7, 1];
const CELL_SIZE = 12;
const CELL_GAP = 3;
const LABEL_WIDTH = 26;
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatTokenValue(value) {
  if (typeof value === "bigint") return value.toLocaleString();
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value).toLocaleString() : "0";
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (/^[0-9]+$/.test(s)) {
      try {
        return BigInt(s).toLocaleString();
      } catch (_e) {}
    }
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n).toLocaleString() : s;
  }
  return "0";
}

function parseUtcDate(value) {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(year, month, day));
  if (!Number.isFinite(dt.getTime())) return null;
  return dt;
}

function addUtcDays(date, days) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days
    )
  );
}

function diffUtcDays(a, b) {
  const ms =
    Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) -
    Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  return Math.floor(ms / 86400000);
}

function getWeekStart(date, weekStartsOn) {
  const desired = weekStartsOn === "mon" ? 1 : 0;
  const dow = date.getUTCDay();
  const delta = (dow - desired + 7) % 7;
  return addUtcDays(date, -delta);
}

function buildFullYearMonthMarkers({ weeksCount, to, weekStartsOn }) {
  if (!weeksCount) return [];
  const end = parseUtcDate(to) || new Date();
  const endMonth = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)
  );
  const months = [];
  for (let i = 11; i >= 0; i -= 1) {
    months.push(
      new Date(
        Date.UTC(endMonth.getUTCFullYear(), endMonth.getUTCMonth() - i, 1)
      )
    );
  }

  const endWeekStart = getWeekStart(end, weekStartsOn);
  const startAligned = addUtcDays(endWeekStart, -(weeksCount - 1) * 7);

  const markers = [];
  const usedIndexes = new Set();
  for (const monthStart of months) {
    const weekIndex = Math.floor(diffUtcDays(startAligned, monthStart) / 7);
    if (weekIndex < 0 || weekIndex >= weeksCount) continue;
    if (usedIndexes.has(weekIndex)) continue;
    usedIndexes.add(weekIndex);
    markers.push({
      label: MONTH_LABELS[monthStart.getUTCMonth()],
      index: weekIndex,
    });
  }
  return markers;
}

export function ActivityHeatmap({ heatmap }) {
  const weekStartsOn = heatmap?.week_starts_on === "mon" ? "mon" : "sun";
  const normalizedHeatmap = useMemo(() => {
    const sourceWeeks = Array.isArray(heatmap?.weeks) ? heatmap.weeks : [];
    if (!sourceWeeks.length) return { weeks: [] };
    const rows = [];
    for (const week of sourceWeeks) {
      for (const cell of Array.isArray(week) ? week : []) {
        if (!cell?.day) continue;
        rows.push({ day: cell.day, total_tokens: cell.value ?? 0 });
      }
    }
    const desiredWeeks = Math.max(52, sourceWeeks.length);
    const rebuilt = buildActivityHeatmap({
      dailyRows: rows,
      weeks: desiredWeeks,
      to: heatmap?.to,
      weekStartsOn,
    });
    return rebuilt;
  }, [heatmap?.to, heatmap?.weeks, weekStartsOn]);

  const weeks = normalizedHeatmap?.weeks || [];
  const dayLabels =
    weekStartsOn === "mon"
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const monthMarkers = useMemo(
    () =>
      buildFullYearMonthMarkers({
        weeksCount: weeks.length,
        to: normalizedHeatmap?.to,
        weekStartsOn,
      }),
    [normalizedHeatmap?.to, weekStartsOn, weeks.length]
  );

  const scrollRef = useRef(null);
  const trackRef = useRef(null);
  const thumbRef = useRef(null);
  const hasAutoScrolledRef = useRef(false);

  const [scrollState, setScrollState] = useState({
    left: 0,
    width: 1, // 0..1 ratio of viewport width to content width
    overflow: false,
  });

  const [isDraggingContent, setIsDraggingContent] = useState(false);
  const [isDraggingScrollbar, setIsDraggingScrollbar] = useState(false);
  const [isHoveringHeatmap, setIsHoveringHeatmap] = useState(false);

  // Refs for drag math to avoid closure staleness
  const dragContentRef = useRef(null);
  const dragScrollbarRef = useRef(null);

  // Update Scroll State (syncs custom scrollbar with native scroll)
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { clientWidth, scrollWidth, scrollLeft } = el;
    const maxScroll = scrollWidth - clientWidth;

    const overflow = maxScroll > 1;
    const widthRatio = scrollWidth > 0 ? clientWidth / scrollWidth : 1;
    const leftRatio = maxScroll > 0 ? scrollLeft / maxScroll : 0;

    setScrollState({
      left: Math.max(0, Math.min(1, leftRatio)),
      width: Math.max(0, Math.min(1, widthRatio)),
      overflow,
    });
  }, []);

  // Initialize and listen to scroll/resize
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();

    const onScroll = () => requestAnimationFrame(updateScrollState);
    const onResize = () => requestAnimationFrame(updateScrollState);

    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [updateScrollState, weeks.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (hasAutoScrolledRef.current) return;
    if (!weeks.length) return;

    const snapToLatest = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll > 1) {
        el.scrollLeft = maxScroll;
      }
      updateScrollState();
      hasAutoScrolledRef.current = true;
    };

    // Wait for layout to settle before snapping.
    requestAnimationFrame(() => requestAnimationFrame(snapToLatest));
  }, [updateScrollState, weeks.length]);

  // --- CONTENT DRAG HANDLERS ---
  const handleContentPointerMoveGlobal = useCallback((e) => {
    if (!dragContentRef.current) return;
    const el = scrollRef.current;
    if (!el) return;

    const dx = e.clientX - dragContentRef.current.startX;
    el.scrollLeft = dragContentRef.current.startScroll - dx;
    e.preventDefault();
  }, []);

  const handleContentPointerUp = useCallback(
    (e) => {
      dragContentRef.current = null;
      setIsDraggingContent(false);
      window.removeEventListener("pointermove", handleContentPointerMoveGlobal);
      window.removeEventListener("pointerup", handleContentPointerUp);
    },
    [handleContentPointerMoveGlobal]
  );

  const onContentPointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return; // Left click only
      const el = scrollRef.current;
      if (!el) return;

      setIsDraggingContent(true);
      dragContentRef.current = {
        startX: e.clientX,
        startScroll: el.scrollLeft,
      };

      // Attach to window to handle drags outside component
      window.addEventListener("pointermove", handleContentPointerMoveGlobal);
      window.addEventListener("pointerup", handleContentPointerUp);

      // We don't use setPointerCapture here to allow window listeners to work more naturally
      // but touch-action: none on the element is crucial (already added)
    },
    [handleContentPointerMoveGlobal, handleContentPointerUp]
  );

  // --- SCROLLBAR DRAG HANDLERS ---
  const handleThumbPointerMoveGlobal = useCallback((e) => {
    if (!dragScrollbarRef.current) return;
    const el = scrollRef.current;
    if (!el) return;

    const dx = e.clientX - dragScrollbarRef.current.startX;
    // dx is pixels moved by mouse. Multiply by ratio to get scroll pixels.
    el.scrollLeft =
      dragScrollbarRef.current.startScroll +
      dx * dragScrollbarRef.current.ratio;
    e.preventDefault();
  }, []);

  const handleThumbPointerUp = useCallback(
    (e) => {
      dragScrollbarRef.current = null;
      setIsDraggingScrollbar(false);

      // Re-enable transition
      const thumb = thumbRef.current;
      if (thumb) {
        thumb.style.transition = "left 100ms linear";
      }

      window.removeEventListener("pointermove", handleThumbPointerMoveGlobal);
      window.removeEventListener("pointerup", handleThumbPointerUp);
    },
    [handleThumbPointerMoveGlobal]
  );

  const onThumbPointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      const el = scrollRef.current;
      const track = trackRef.current;
      const thumb = thumbRef.current;
      if (!el || !track || !thumb) return;

      // Calculate the scrollable pixels in the track
      const trackRect = track.getBoundingClientRect();
      const thumbRect = thumb.getBoundingClientRect();
      const availableTrack = trackRect.width - thumbRect.width;
      const maxScroll = el.scrollWidth - el.clientWidth;

      if (availableTrack <= 0 || maxScroll <= 0) return;

      setIsDraggingScrollbar(true);
      // Disable transition temporarily for instant follow
      thumb.style.transition = "none";

      dragScrollbarRef.current = {
        startX: e.clientX,
        startScroll: el.scrollLeft,
        ratio: maxScroll / availableTrack,
      };

      window.addEventListener("pointermove", handleThumbPointerMoveGlobal);
      window.addEventListener("pointerup", handleThumbPointerUp);
      e.preventDefault();
    },
    [handleThumbPointerMoveGlobal, handleThumbPointerUp]
  );

  // --- WHEEL HANDLER ---
  const handleWheel = useCallback((e) => {
    const el = scrollRef.current;
    if (!el) return;
    // Map vertical wheel to horizontal scroll
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, []);

  if (!weeks.length) {
    return (
      <div className="text-[10px] opacity-40 font-mono">
        No activity data yet.
      </div>
    );
  }

  const gridColumns = {
    display: "grid",
    gridTemplateColumns: `${LABEL_WIDTH}px repeat(${weeks.length}, ${CELL_SIZE}px)`,
    columnGap: `${CELL_GAP}px`,
  };

  const labelRows = {
    display: "grid",
    gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
    rowGap: `${CELL_GAP}px`,
  };

  const gridRows = {
    display: "grid",
    gridAutoFlow: "column",
    gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
    gap: `${CELL_GAP}px`,
  };

  const contentWidth =
    LABEL_WIDTH +
    weeks.length * CELL_SIZE +
    Math.max(0, weeks.length - 1) * CELL_GAP;

  const showScrollbar =
    scrollState.overflow && (isHoveringHeatmap || isDraggingScrollbar);

  return (
    <div
      className="flex flex-col gap-2"
      onMouseEnter={() => setIsHoveringHeatmap(true)}
      onMouseLeave={() => setIsHoveringHeatmap(false)}
    >
      <div className="relative group">
        {/* Scroll Container: Hide native scrollbar but allow scrolling */}
        <div
          ref={scrollRef}
          className="w-full max-w-full overflow-x-scroll no-scrollbar select-none pb-2 outline-none"
          tabIndex={0}
          aria-label="Activity heatmap"
          onWheel={handleWheel}
          style={{ scrollbarWidth: "none" }} // Firefox
        >
          <div
            className={`inline-flex flex-col min-w-max outline-none ${
              isDraggingContent ? "cursor-grabbing" : "cursor-grab"
            }`}
            style={{ touchAction: "none", minWidth: contentWidth }}
            onPointerDown={onContentPointerDown}
            // Move and Up are handled by window listeners now
          >
            <div
              style={gridColumns}
              className="text-[8px] uppercase opacity-40 tracking-widest mb-2"
            >
              <span></span>
              {monthMarkers.map((label) => (
                <span
                  key={`${label.label}-${label.index}`}
                  style={{ gridColumnStart: label.index + 2 }}
                  className="whitespace-nowrap"
                >
                  {label.label}
                </span>
              ))}
            </div>

            <div style={gridColumns}>
              <div
                style={labelRows}
                className="text-[8px] uppercase opacity-40 tracking-widest"
              >
                {dayLabels.map((label) => (
                  <span key={label} className="leading-none">
                    {label}
                  </span>
                ))}
              </div>

              <div style={gridRows}>
                {weeks.map((week, wIdx) =>
                  (Array.isArray(week) ? week : []).map((cell, dIdx) => {
                    const key = cell?.day || `empty-${wIdx}-${dIdx}`;
                    if (!cell) {
                      return (
                        <span
                          key={key}
                          className="rounded-[2px] border border-transparent"
                          style={{ width: CELL_SIZE, height: CELL_SIZE }}
                        ></span>
                      );
                    }

                    const level = Number(cell.level) || 0;
                    const opacity = OPACITY_BY_LEVEL[level] ?? 0.3;
                    const color =
                      level === 0
                        ? "rgba(0,255,65,0.08)"
                        : `rgba(0,255,65,${opacity})`;

                    return (
                      <span
                        key={key}
                        title={`${cell.day} • ${formatTokenValue(
                          cell.value
                        )} tokens`}
                        className="rounded-[2px] border border-[#00FF41]/10"
                        style={{
                          width: CELL_SIZE,
                          height: CELL_SIZE,
                          background: color,
                        }}
                      ></span>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Scrollbar Track */}
      <div
        ref={trackRef}
        className="heatmap-scrollbar-track relative h-[6px] rounded-full bg-[#00FF41]/10 border border-[#00FF41]/20 overflow-visible mt-1 transition-opacity duration-150"
        style={{
          opacity: showScrollbar ? 1 : 0,
          pointerEvents: showScrollbar ? "auto" : "none",
        }}
      >
        {/* Scrollbar Thumb */}
        <div
          ref={thumbRef}
          className={`absolute top-0 bottom-0 rounded-full bg-[#00FF41]/50 hover:bg-[#00FF41]/70 shadow-[0_0_10px_rgba(0,255,65,0.4)] ${
            isDraggingScrollbar ? "cursor-grabbing" : "cursor-grab"
          }`}
          style={{
            left: `${scrollState.left * 100 * (1 - scrollState.width)}%`,
            width: `${scrollState.width * 100}%`,
            transition: isDraggingScrollbar ? "none" : "left 100ms linear",
            touchAction: "none",
          }}
          onPointerDown={onThumbPointerDown}
          // specific move/up listeners not needed on element due to global win listeners
        />
      </div>

      <div className="flex justify-between items-center text-[7px] border-t border-[#00FF41]/5 pt-2 opacity-40 font-black uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <span>Less</span>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((level) => (
              <span
                key={level}
                className="rounded-[2px] border border-[#00FF41]/10"
                style={{
                  width: 10,
                  height: 10,
                  background:
                    level === 0
                      ? "rgba(0,255,65,0.08)"
                      : `rgba(0,255,65,${OPACITY_BY_LEVEL[level]})`,
                }}
              ></span>
            ))}
          </div>
          <span>More</span>
        </div>
        <span>UTC</span>
      </div>
    </div>
  );
}
