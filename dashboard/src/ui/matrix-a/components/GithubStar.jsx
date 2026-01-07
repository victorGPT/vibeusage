import React, { useEffect, useState } from "react";

/**
 * Matrix-themed GitHub Star Component
 */
export const GithubStar = ({
  repo = "victorGPT/vibeusage",
  isFixed = true,
  size = "default",
}) => {
  const [stars, setStars] = useState(null);

  useEffect(() => {
    // Attempt to fetch stars from GitHub API
    // Note: This might hit rate limits if not authenticated, but standard for non-sensitive data
    fetch(`https://api.github.com/repos/${repo}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.stargazers_count === "number") {
          setStars(data.stargazers_count);
        }
      })
      .catch((err) => console.error("GitHub API fetch failed", err));
  }, [repo]);

  const baseClasses =
    size === "header"
      ? "matrix-header-chip matrix-header-action text-caption uppercase font-bold tracking-[0.2em] select-none group gap-3 no-underline overflow-hidden"
      : "group flex items-center gap-3 px-4 py-2 bg-matrix-panel border border-matrix-ghost backdrop-blur-md transition-all duration-300 hover:border-matrix-primary hover:bg-matrix-panelStrong no-underline overflow-hidden";
  const positionClasses = isFixed ? "fixed top-6 right-6 z-[100]" : "relative";

  return (
    <a
      href={`https://github.com/${repo}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseClasses} ${positionClasses}`}
    >
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-matrix-dim group-hover:border-matrix-primary"></div>
      <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-matrix-dim group-hover:border-matrix-primary"></div>

      {/* GitHub Icon */}
      <div className="relative">
        <svg
          height="16"
          viewBox="0 0 16 16"
          width="16"
          className="fill-matrix-primary group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(0,255,65,0.8)] transition-all duration-500"
        >
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
        </svg>
      </div>

      {/* Label & Counter */}
      <div className="flex items-center gap-2 leading-none">
        <span className="text-matrix-primary">
          STAR
        </span>
        <span className="text-matrix-bright tabular-nums tracking-normal">
          {stars !== null ? stars : "---"}
        </span>
      </div>

      {/* Hover scanner line effect */}
      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-matrix-dim animate-[scanner_2s_linear_infinite]"></div>
      </div>

      <style>
        {`
          @keyframes scanner {
            0% { transform: translateY(0); }
            100% { transform: translateY(44px); }
          }
        `}
      </style>
    </a>
  );
};
