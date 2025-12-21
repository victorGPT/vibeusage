import React, { useState, useEffect, useMemo, useRef } from "react";

// =============================================================================
// 1. 绝对安全的视觉引擎 (CORE ENGINE)
// =============================================================================

/**
 * 稳定版解码文字 (Ultra-Stable)
 */
const DecodingText = ({ text = "", className = "" }) => {
  const [display, setDisplay] = useState("");
  const chars = "0101XYZA@#$%";

  useEffect(() => {
    const target = String(text || "");
    if (!target) return;

    setDisplay(target);
    let iterations = 0;
    const interval = setInterval(() => {
      setDisplay(() => {
        const baseText = String(target);
        return baseText
          .split("")
          .map((char, index) => {
            if (index < iterations) return baseText[index];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("");
      });

      if (iterations >= target.length) clearInterval(interval);
      iterations += 1 / 2;
    }, 30);

    return () => clearInterval(interval);
  }, [text]);

  return <span className={className}>{display}</span>;
};

/**
 * 矩阵代码雨
 */
const MatrixRain = () => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationFrameId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    resize();

    const characters = "01XYZA@#$%";
    const fontSize = 16;
    const columns = Math.ceil(canvas.width / fontSize);
    const drops = new Array(columns).fill(0).map(() => Math.random() * -100);

    const draw = () => {
      ctx.fillStyle = "rgba(5, 5, 5, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#00FF41";
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = characters.charAt(
          Math.floor(Math.random() * characters.length)
        );
        ctx.fillStyle = Math.random() > 0.95 ? "#FFF" : "#00FF41";
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.985)
          drops[i] = 0;
        drops[i]++;
      }
      animationFrameId = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none opacity-20"
    />
  );
};

// =============================================================================
// 2. 界面原子组件 (UI ATOMS)
// =============================================================================

const AsciiBox = ({ title = "SIGNAL", children, className = "" }) => (
  <div
    className={`relative flex flex-col bg-black/90 border border-[#00FF41]/30 shadow-2xl ${className}`}
  >
    <div className="flex items-center text-[#00FF41] leading-none text-[10px] p-1 border-b border-[#00FF41]/20">
      <span className="font-black bg-[#00FF41]/10 px-2 py-0.5 border border-[#00FF41]/30 mr-2">
        <DecodingText text={title} />
      </span>
      <span className="flex-1 opacity-10 truncate">
        --------------------------------------------------
      </span>
    </div>
    <div className="p-4 relative z-10 h-full">{children}</div>
    <div className="absolute top-0 left-0 w-1.5 h-1.5 bg-[#00FF41] opacity-60"></div>
    <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-[#00FF41] opacity-60"></div>
  </div>
);

const MatrixAvatar = ({ name = "USER", isTheOne = false, size = 64 }) => {
  const safeName = String(name || "unknown");
  const grid = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < safeName.length; i++)
      hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
    const g = [];
    for (let i = 0; i < 15; i++) g.push(((hash >> i) & 1) === 1);
    return g;
  }, [safeName]);

  const color = isTheOne ? "#FFD700" : "#00FF41";

  return (
    <div
      style={{ width: size, height: size }}
      className={`p-1 border bg-black/40 ${
        isTheOne
          ? "border-yellow-500 shadow-[0_0_10px_rgba(255,215,0,0.3)]"
          : "border-[#00FF41]/40"
      }`}
    >
      <svg viewBox="0 0 5 5" className="w-full h-full">
        {grid.map((filled, i) => {
          if (!filled) return null;
          const r = Math.floor(i / 3);
          const c = i % 3;
          return (
            <React.Fragment key={i}>
              <rect x={c} y={r} width="1" height="1" fill={color} />
              {c < 2 && (
                <rect x={4 - c} y={r} width="1" height="1" fill={color} />
              )}
            </React.Fragment>
          );
        })}
      </svg>
    </div>
  );
};

// =============================================================================
// 3. 实时演示组件 (已更新审核文字)
// =============================================================================

const LiveSniffer = () => {
  const [logs, setLogs] = useState([
    "[SYSTEM] KERNEL_UPLINK_ESTABLISHED",
    "[SOCKET] LISTENING_ON_LOCAL_CLI_PIPE...",
  ]);

  useEffect(() => {
    const events = [
      "> INTERCEPTED: CODEX_COMPLETION_EVENT",
      "> QUANTIFYING: +64 NEURAL_TOKENS",
      "> ANALYSIS: HIGH_VIBE_FLOW_DETECTED",
      "> SYNC: UPLOADING_TO_ZION_MAINFRAME",
      "[STATUS] BATCH_TRANSMISSION_COMPLETE",
      "> HOOKING: CODEX_CLI_PIPE_SIGNAL",
      "> CAPTURE: +128 NEURAL_TOKENS",
    ];
    let i = 0;
    const interval = setInterval(() => {
      setLogs((prev) => [...prev.slice(-4), events[i % events.length]]);
      i++;
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="font-mono text-[10px] text-[#00FF41]/80 space-y-1 h-full flex flex-col justify-end">
      {logs.map((log, idx) => (
        <div
          key={idx}
          className="animate-pulse border-l-2 border-[#00FF41]/20 pl-2 truncate"
        >
          {log}
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// 4. 登录页主入口 (APP)
// =============================================================================

export default function App() {
  const [handle, setHandle] = useState("VIBE_USER");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 200);
    return () => clearTimeout(timer);
  }, []);

  if (!isLoaded) return <div className="min-h-screen bg-black" />;

  return (
    <div className="min-h-screen bg-[#050505] font-mono text-[#00FF41] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* 视觉层 */}
      <MatrixRain />
      <div className="pointer-events-none fixed inset-0 z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px]"></div>

      {/* 主面板 */}
      <main className="w-full max-w-4xl relative z-10 flex flex-col items-center space-y-12 py-10">
        {/* Slogan 区域 */}
        <div className="text-center space-y-6">
          <h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter leading-none glow-text select-none">
            <DecodingText text="MORE_TOKENS." /> <br />
            <span className="text-[#00FF41]">
              <DecodingText text="MORE_VIBE." />
            </span>
          </h1>

          <div className="flex flex-col items-center space-y-2">
            <div className="px-6 py-2 border-l border-r border-[#00FF41]/40 bg-[#00FF41]/5 relative group">
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00FF41]"></div>
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00FF41]"></div>
              <p className="text-[10px] md:text-xs uppercase tracking-[0.4em] font-bold">
                QUANTIFY YOUR NEURAL OUTPUT
              </p>
            </div>
            {/* 包含 Codex CLI Token 的精准描述 */}
            <p className="text-[9px] text-[#00FF41]/60 uppercase tracking-[0.2em]">
              Real-time Token Analytics for Codex CLI & AI Engineers.
            </p>
          </div>
        </div>

        {/* 演示区域 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          {/* 身份探测 */}
          <AsciiBox title="IDENTITY_PROBE" className="h-44">
            <div className="flex items-center space-x-6 h-full">
              <MatrixAvatar
                name={handle}
                size={80}
                isTheOne={handle === "NEO"}
              />
              <div className="flex-1 text-left space-y-3">
                <div className="flex flex-col">
                  <label className="text-[8px] opacity-40 uppercase tracking-widest mb-1 font-bold">
                    Set_Handle
                  </label>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.toUpperCase())}
                    className="w-full bg-transparent border-b border-[#00FF41]/50 text-white font-black text-xl p-1 focus:outline-none focus:border-[#00FF41] transition-colors"
                    maxLength={10}
                    placeholder="TRY 'NEO'"
                  />
                </div>
                <div className="text-[8px] opacity-60">
                  RANK_EXPECTATION:{" "}
                  {handle === "NEO" ? "SINGULARITY" : "UNRANKED"}
                </div>
              </div>
            </div>
          </AsciiBox>

          {/* 实时抓包 (显示审核文字) */}
          <AsciiBox title="LIVE_SNIFFER" className="h-44">
            <LiveSniffer />
          </AsciiBox>
        </div>

        {/* 核心操作 */}
        <div className="w-full max-w-sm flex flex-col items-center space-y-6">
          <button
            onClick={() =>
              window.alert("Redirecting to GitHub Authorization...")
            }
            className="w-full group relative border-2 border-[#00FF41] bg-[#00FF41]/10 py-5 overflow-hidden transition-all hover:bg-[#00FF41] hover:text-black active:scale-95 shadow-[0_0_20px_rgba(0,255,65,0.2)]"
          >
            <span className="font-black uppercase tracking-[0.4em] text-sm relative z-10 animate-pulse group-hover:animate-none">
              {">>"} INITIALIZE_UPLINK {"<<"}
            </span>
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
          </button>

          <div className="flex space-x-8 opacity-30 text-[9px] uppercase tracking-widest font-bold">
            <span className="hover:text-white cursor-pointer transition-colors">
              Manifesto
            </span>
            <span className="hover:text-white cursor-pointer transition-colors">
              Documentation
            </span>
            <span className="hover:text-white cursor-pointer transition-colors">
              Security
            </span>
          </div>
        </div>
      </main>

      <footer className="absolute bottom-8 opacity-20 text-[9px] tracking-[0.6em] uppercase select-none">
        System_Ready // 2024 VibeScore OS
      </footer>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .glow-text { text-shadow: 0 0 20px rgba(0, 255, 65, 0.5); }
      `,
        }}
      />
    </div>
  );
}
