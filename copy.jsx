import React, { useState, useEffect, useMemo, useRef } from "react";

// =============================================================================
// TUI 核心组件库 - 工业级视觉资产
// =============================================================================

const CHARS = {
  TOP_LEFT: "┌",
  TOP_RIGHT: "┐",
  BOTTOM_LEFT: "└",
  BOTTOM_RIGHT: "┘",
  HORIZONTAL: "─",
  VERTICAL: "│",
  T_TOP: "┬",
  T_BOTTOM: "┴",
  CROSS: "┼",
  BLOCK: "■",
  DOT: "·",
};

// 1. 高性能 Matrix Rain 背景
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
    const characters = "018X$#&%";
    const fontSize = 16;
    const columns = Math.ceil(canvas.width / fontSize);
    const drops = new Array(columns).fill(0).map(() => Math.random() * -100);
    const draw = () => {
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(5, 5, 5, 0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#00FF41";
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const text = characters.charAt(
          Math.floor(Math.random() * characters.length)
        );
        ctx.globalAlpha = 0.05;
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.985)
          drops[i] = 0;
        drops[i] += 1.2;
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
    <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />
  );
};

// 2. 增强型字符容器
const AsciiBox = ({ title, children, className = "", subtitle = "" }) => (
  <div
    className={`relative flex flex-col bg-black/80 backdrop-blur-md border border-[#00FF41]/10 shadow-2xl ${className}`}
  >
    <div className="flex items-center leading-none">
      <span className="shrink-0 text-[#00FF41]/30">{CHARS.TOP_LEFT}</span>
      <span className="mx-2 shrink-0 font-black uppercase tracking-[0.2em] text-[#00FF41] px-2 py-0.5 bg-[#00FF41]/10 text-[9px] border border-[#00FF41]/20">
        {title}
      </span>
      {subtitle && (
        <span className="text-[8px] opacity-30 mr-2 tracking-tighter">
          [{subtitle}]
        </span>
      )}
      <span className="flex-1 overflow-hidden whitespace-nowrap opacity-10 text-[#00FF41]">
        {CHARS.HORIZONTAL.repeat(100)}
      </span>
      <span className="shrink-0 text-[#00FF41]/30">{CHARS.TOP_RIGHT}</span>
    </div>
    <div className="flex flex-1">
      <div className="shrink-0 w-3 flex justify-center opacity-10 text-[#00FF41]">
        {CHARS.VERTICAL}
      </div>
      <div className="flex-1 py-4 px-2 relative z-10">{children}</div>
      <div className="shrink-0 w-3 flex justify-center opacity-10 text-[#00FF41]">
        {CHARS.VERTICAL}
      </div>
    </div>
    <div className="flex items-center leading-none opacity-10 text-[#00FF41]">
      <span className="shrink-0">{CHARS.BOTTOM_LEFT}</span>
      <span className="flex-1 overflow-hidden whitespace-nowrap">
        {CHARS.HORIZONTAL.repeat(100)}
      </span>
      <span className="shrink-0">{CHARS.BOTTOM_RIGHT}</span>
    </div>
  </div>
);

// 3. 数据行
const DataRow = ({ label, value, subValue, colorClass = "text-[#00FF41]" }) => (
  <div className="flex justify-between items-center border-b border-[#00FF41]/5 py-1.5 group hover:bg-[#00FF41]/5 transition-colors px-1">
    <span className="opacity-40 uppercase text-[8px] font-black tracking-widest leading-none">
      {label}
    </span>
    <div className="flex items-center space-x-3">
      {subValue && (
        <span className="text-[8px] opacity-20 italic font-mono">
          {subValue}
        </span>
      )}
      <span className={`font-black tracking-tight text-[11px] ${colorClass}`}>
        {value}
      </span>
    </div>
  </div>
);

// 4. 实时趋势图
const TrendChart = ({ data }) => {
  const max = Math.max(...data) || 1;
  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-end h-24 space-x-1 border-b border-[#00FF41]/20 pb-1 relative">
        {/* 背景辅助线 */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
          <div className="border-t border-[#00FF41] w-full"></div>
          <div className="border-t border-[#00FF41] w-full"></div>
          <div className="border-t border-[#00FF41] w-full"></div>
        </div>
        {data.map((val, i) => (
          <div key={i} className="flex-1 bg-[#00FF41]/5 relative group">
            <div
              style={{ height: `${(val / max) * 100}%` }}
              className="w-full bg-[#00FF41] opacity-50 group-hover:opacity-100 group-hover:bg-white transition-all duration-300 shadow-[0_0_10px_rgba(0,255,65,0.2)]"
            ></div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[7px] opacity-30 font-black uppercase tracking-[0.2em]">
        <span>T-24H</span>
        <span>Peak: {max.toLocaleString()} TKNS</span>
        <span>Realtime_Flow</span>
      </div>
    </div>
  );
};

// =============================================================================
// 主业务逻辑
// =============================================================================

export default function App() {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [booted, setBooted] = useState(false);
  const [logs, setLogs] = useState([]);
  const [cpuUsage, setCpuUsage] = useState(12);

  // 模拟系统日志与数据
  useEffect(() => {
    const logPool = [
      "SCRAPING_CODEX_ENDPOINT_0x2A1F",
      "SYNCING_NEURAL_WEIGHTS... OK",
      "TOKEN_BUFFER_OVERFLOW_DETECTED",
      "PUSHING_VIBE_METRICS_TO_UPLINK",
      "RECALIBRATING_RANK_COORDINATES",
      "DEEP_WORK_STATE_ESTABLISHED",
      "UPLOADING_LOCAL_RECEPTOR_LOGS",
    ];

    const logInterval = setInterval(() => {
      setLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] ${
          logPool[Math.floor(Math.random() * logPool.length)]
        }`,
        ...prev.slice(0, 5),
      ]);
      setCpuUsage(Math.floor(Math.random() * 40) + 10);
    }, 3000);

    const timer = setInterval(
      () => setTime(new Date().toLocaleTimeString()),
      1000
    );
    const boot = setTimeout(() => setBooted(true), 1200);

    return () => {
      clearInterval(logInterval);
      clearInterval(timer);
      clearTimeout(boot);
    };
  }, []);

  const heatmapLayout = useMemo(() => {
    const rows = 7;
    const monthGroups = 12;
    const weeksPerGroup = 4;
    let groups = [];
    for (let g = 0; g < monthGroups; g++) {
      let weekArray = [];
      for (let w = 0; w < weeksPerGroup; w++) {
        let dayArray = [];
        for (let d = 0; d < rows; d++) {
          const noise = Math.random();
          let level =
            noise > 0.9
              ? 4
              : noise > 0.7
              ? 3
              : noise > 0.5
              ? 2
              : noise > 0.3
              ? 1
              : 0;
          if (d === 0 || d === 6)
            if (Math.random() > 0.5) level = Math.max(0, level - 2);
          dayArray.push(level);
        }
        weekArray.push(dayArray);
      }
      groups.push(weekArray);
    }
    return groups;
  }, []);

  if (!booted) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#00FF41] font-mono flex items-center justify-center p-4">
        <div className="text-center z-10 animate-pulse">
          <pre className="text-[8px] leading-[1.2] mb-6 opacity-80">
            {`
   _  _ ___ ___ ___  ___  ___  ___  ___ ___ 
  | || | _ | _ | __|/ __|/ __|/ _ \\| _ | __|
   \\  /| _ | _ | _| \\__ | (__| (_) | _ | _| 
    \\/ |___|___|___||___/\\___|\\___/|___|___|
`}
          </pre>
          <p className="tracking-[0.8em] text-[10px] font-black uppercase text-[#00FF41]/60">
            Booting_Vibe_OS
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#00FF41] font-mono p-4 md:p-8 flex flex-col leading-tight text-[11px] md:text-[12px] selection:bg-[#00FF41] selection:text-black overflow-hidden h-screen">
      <MatrixRain />

      {/* 扫描线 */}
      <div className="pointer-events-none fixed inset-0 z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.06)_50%)] bg-[length:100%_4px]"></div>

      {/* 状态顶部栏 */}
      <header className="relative z-10 flex justify-between border-b border-[#00FF41]/20 pb-3 mb-6 items-center shrink-0">
        <div className="flex items-center space-x-6">
          <div className="bg-[#00FF41] text-black px-3 py-1 font-black text-xs">
            VIBE_SYSTEM_X
          </div>
          <div className="flex items-center space-x-4 opacity-50 text-[9px] tracking-widest font-black uppercase">
            <span className="flex items-center">
              <span className="w-1.5 h-1.5 bg-[#00FF41] rounded-full mr-2 animate-pulse"></span>
              Link_Active
            </span>
            <span className="hidden sm:inline">CPU_{cpuUsage}%</span>
            <span className="hidden sm:inline">MEM_402MB</span>
          </div>
        </div>
        <div className="text-[#00FF41] font-bold bg-[#00FF41]/5 px-3 py-1 border border-[#00FF41]/20 flex items-center space-x-4">
          <span className="opacity-40 font-normal uppercase text-[8px]">
            Session_Time:
          </span>
          <span className="text-white tracking-widest">{time}</span>
        </div>
      </header>

      {/* 主控制面板 */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* 左侧区域 (4 col) */}
        <div className="lg:col-span-4 flex flex-col space-y-6 overflow-hidden">
          <AsciiBox title="Architect_Identity" subtitle="Authorized">
            <div className="flex items-center space-x-6">
              <div className="relative group">
                <div className="w-20 h-20 border border-[#00FF41]/30 flex items-center justify-center text-3xl font-black bg-[#00FF41]/5 shadow-[0_0_15px_rgba(0,255,65,0.1)]">
                  VS
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white text-black text-[8px] px-1 font-black uppercase">
                  Lvl_05
                </div>
              </div>
              <div className="space-y-3 flex-1">
                <div className="border-l-2 border-[#00FF41] pl-3 py-1 bg-[#00FF41]/5">
                  <div className="text-[8px] opacity-40 uppercase font-black mb-1 tracking-tighter">
                    Access_Handle
                  </div>
                  <div className="text-white font-black text-lg tracking-tight leading-none uppercase">
                    Neo.Syst_3m
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#00FF41]/5 p-1 border border-[#00FF41]/10 text-center">
                    <div className="text-[7px] opacity-40 uppercase font-black">
                      Rank
                    </div>
                    <div className="text-[#00FF41] font-black underline underline-offset-2">
                      #0042
                    </div>
                  </div>
                  <div className="bg-[#00FF41]/5 p-1 border border-[#00FF41]/10 text-center">
                    <div className="text-[7px] opacity-40 uppercase font-black">
                      Streak
                    </div>
                    <div className="text-yellow-400 font-black tracking-tighter">
                      12_DAYS
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AsciiBox>

          <AsciiBox title="Realtime_Telemetry" subtitle="Live_Stream">
            <div className="space-y-4">
              <div>
                <div className="text-[8px] opacity-40 uppercase font-black mb-1 tracking-widest">
                  Lifetime_Token_Weight
                </div>
                <div className="text-4xl font-black tracking-tighter text-white glow-text leading-none flex items-baseline">
                  142,892{" "}
                  <span className="text-[9px] opacity-30 tracking-[0.4em] ml-2">
                    Tks
                  </span>
                </div>
              </div>
              <div className="space-y-3 border-t border-[#00FF41]/10 pt-4">
                {[
                  { l: "CODEX_X2", p: 88, c: "bg-[#00FF41]" },
                  { l: "GPT_4_CORE", p: 75, c: "bg-[#00FF41]/80" },
                  { l: "CLAUDE_3_OP", p: 42, c: "bg-[#00FF41]/60" },
                ].map((m, i) => (
                  <div key={i} className="group">
                    <div className="flex justify-between text-[8px] mb-1 font-black tracking-widest opacity-60">
                      <span>{m.l}</span>
                      <span>{m.p}%</span>
                    </div>
                    <div className="h-1 bg-[#00FF41]/5 border border-[#00FF41]/10 relative overflow-hidden">
                      <div
                        className={`absolute top-0 left-0 h-full ${m.c} shadow-[0_0_8px_#00FF41]`}
                        style={{ width: `${m.p}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AsciiBox>

          {/* 实时系统日志 - 填充空白，增加“忙碌”感 */}
          <AsciiBox
            title="System_Logs"
            className="flex-1 overflow-hidden"
            subtitle="0x2A1"
          >
            <div className="text-[8px] space-y-1.5 font-mono opacity-50 h-full overflow-hidden">
              {logs.map((log, i) => (
                <p
                  key={i}
                  className={`whitespace-nowrap transition-opacity duration-1000 ${
                    i === 0 ? "opacity-100 text-white" : "opacity-40"
                  }`}
                >
                  {log}
                </p>
              ))}
              <p className="animate-pulse">_</p>
            </div>
          </AsciiBox>
        </div>

        {/* 右侧区域 (8 col) */}
        <div className="lg:col-span-8 flex flex-col space-y-6 overflow-hidden">
          {/* 热力图矩阵 */}
          <AsciiBox title="Activity_Matrix" subtitle="Year_2024">
            <div className="overflow-x-auto no-scrollbar py-1">
              <div className="flex space-x-1.5 min-w-fit">
                {heatmapLayout.map((group, gIdx) => (
                  <div
                    key={gIdx}
                    className="flex space-x-0.5 border-r border-[#00FF41]/10 pr-1.5 last:border-none"
                  >
                    {group.map((week, wIdx) => (
                      <div key={wIdx} className="flex flex-col space-y-0.5">
                        {week.map((level, dIdx) => (
                          <span
                            key={dIdx}
                            className={`text-[9px] leading-none transition-all duration-700 ${
                              level === 0
                                ? "text-[#00FF41]/10"
                                : "text-[#00FF41] shadow-glow"
                            }`}
                            style={{
                              opacity: level === 0 ? 0.15 : 0.3 + level * 0.175,
                            }}
                          >
                            {level === 0 ? "·" : "■"}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center mt-3 text-[7px] border-t border-[#00FF41]/5 pt-2 opacity-40 font-black uppercase tracking-widest">
              <div className="flex space-x-3 items-center">
                <span>Density_Scale:</span>
                <div className="flex gap-1.5 font-mono">
                  <span className="opacity-20 text-[10px]">·</span>
                  <span className="opacity-40 text-[10px]">■</span>
                  <span className="opacity-60 text-[10px]">■</span>
                  <span className="opacity-80 text-[10px]">■</span>
                  <span className="opacity-100 text-[10px] shadow-glow">■</span>
                </div>
              </div>
              <span>Sync_Freq: 120s</span>
            </div>
          </AsciiBox>

          {/* 趋势图与项目列表 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 shrink-0">
            <AsciiBox title="Token_Flow_History" subtitle="24h">
              <TrendChart
                data={[
                  20, 35, 28, 60, 85, 40, 25, 45, 90, 100, 70, 55, 30, 20, 40,
                  65, 80, 50, 30, 45, 75, 90, 60, 45,
                ]}
              />
            </AsciiBox>

            <AsciiBox title="Active_Nodes" subtitle="Clusters">
              <div className="space-y-0.5">
                {[
                  { n: "Vibe_Core", v: "82.1k", tag: "SRV_01" },
                  { n: "Neural_Relay", v: "44.4k", tag: "SRV_02" },
                  { n: "Wasm_Edge", v: "21.2k", tag: "NODE_X" },
                  { n: "Auth_Proxy", v: "1.4k", tag: "LOCAL" },
                ].map((p, i) => (
                  <DataRow key={i} label={p.n} value={p.v} subValue={p.tag} />
                ))}
              </div>
            </AsciiBox>
          </div>

          {/* 底部装饰面板 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
            <AsciiBox title="Network_Stat" className="md:col-span-2">
              <div className="flex justify-between items-center text-[10px] h-full">
                <div className="flex space-x-4">
                  <div className="flex flex-col">
                    <span className="opacity-40 text-[7px]">UP_LINK</span>
                    <span>1.2MB/S</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="opacity-40 text-[7px]">DOWN_LINK</span>
                    <span>4.5MB/S</span>
                  </div>
                </div>
                <div className="text-[14px] font-black opacity-20 tracking-tighter hidden sm:block font-mono leading-none">
                  {"<<< SYNC_DATA_PACKET_0x4F2 >>>"}
                </div>
              </div>
            </AsciiBox>
            <div className="bg-[#00FF41]/10 border border-[#00FF41]/20 p-2 flex items-center justify-center cursor-pointer hover:bg-[#00FF41] hover:text-black transition-all group">
              <div className="text-center">
                <div className="text-[10px] font-black tracking-widest uppercase">
                  Generate_VCard
                </div>
                <div className="text-[7px] opacity-60 uppercase font-bold group-hover:text-black">
                  Click to Export PNG
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="relative z-10 mt-6 pt-3 border-t border-[#00FF41]/10 flex justify-between opacity-30 text-[8px] uppercase font-black tracking-[0.3em] shrink-0">
        <div className="flex space-x-10 items-center">
          <span className="cursor-help hover:text-white">[F1] Help</span>
          <span className="cursor-pointer hover:text-white border-b border-white">
            [F2] Snapshot
          </span>
          <span className="hidden sm:inline">[F3] Configure</span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="font-bold">Neural_Index: 0.942.A1</span>
          <span className="opacity-50 tracking-normal">
            © 2024 VibeScore_Corp
          </span>
        </div>
      </footer>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .glow-text { text-shadow: 0 0 15px rgba(0, 255, 65, 0.4); }
        .shadow-glow { filter: drop-shadow(0 0 2px rgba(0, 255, 65, 0.3)); }
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
      `,
        }}
      />
    </div>
  );
}
