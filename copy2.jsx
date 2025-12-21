import React, { useState, useEffect, useMemo, useRef } from 'react';

// =============================================================================
// MATRIX AESTHETICS ENGINE
// =============================================================================

const COLORS = {
  MATRIX: '#00FF41',
  GOLD: '#FFD700', // The Source / Neo Color
  DARK: '#0D0208',
  RED_PILL: '#FF0055',
  BLUE_PILL: '#0088FF',
};

const CHARS = {
  TL: '┌', TR: '┐', BL: '└', BR: '┘',
  H: '─', V: '│',
};

// --- Matrix Rain 背景 ---
const MatrixRain = () => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();
    const characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; 
    const fontSize = 14;
    const columns = Math.ceil(canvas.width / fontSize);
    const drops = new Array(columns).fill(0).map(() => Math.random() * -100);
    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#00FF41';
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const text = characters.charAt(Math.floor(Math.random() * characters.length));
        ctx.fillStyle = Math.random() > 0.95 ? '#FFF' : '#003300'; 
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      animationFrameId = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animationFrameId); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none opacity-40" />;
};

// --- 解码文字动画 ---
const DecodingText = ({ text, className = "" }) => {
  const [display, setDisplay] = useState(text);
  const chars = "0101XYZA@#$%";
  useEffect(() => {
    let iterations = 0;
    const interval = setInterval(() => {
      setDisplay(
        text.split("").map((char, index) => {
            if (index < iterations) return text[index];
            return chars[Math.floor(Math.random() * chars.length)];
          }).join("")
      );
      if (iterations >= text.length) clearInterval(interval);
      iterations += 1 / 3; 
    }, 30);
    return () => clearInterval(interval);
  }, [text]);
  return <span className={className}>{display}</span>;
};

// --- 真正的 "Neo" 风格头像 ---
const MatrixAvatar = ({ name, isAnon = false, isTheOne = false, size = 64 }) => {
  const hashCode = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
  };

  const hash = useMemo(() => hashCode(name || "unknown"), [name]);
  
  const generateGrid = () => {
    const grid = [];
    for (let i = 0; i < 15; i++) grid.push(((hash >> i) & 1) === 1);
    return grid;
  };

  const grid = useMemo(() => generateGrid(), [hash]);
  
  // Neo 获得了金色的源代码颜色
  const color = isAnon ? '#333' : isTheOne ? '#FFD700' : '#00FF41'; 
  
  // Neo 的光环极其强烈，且带有白色核心
  const glowFilter = isAnon 
    ? 'none' 
    : isTheOne 
        ? 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.8)) drop-shadow(0 0 15px rgba(255, 255, 255, 0.5))' 
        : 'drop-shadow(0 0 4px rgba(0, 255, 65, 0.6))';

  // 匿名状态
  if (isAnon) {
      return (
        <div style={{ width: size, height: size }} className="bg-[#00FF41]/5 border border-[#00FF41]/20 flex items-center justify-center overflow-hidden relative group">
            <span className="text-[#00FF41] font-black text-xl opacity-50">?</span>
        </div>
      )
  }

  // 实名状态 (包含 Neo 特效)
  return (
    <div 
      style={{ width: size, height: size }} 
      className={`relative p-1 transition-transform duration-300 hover:scale-105
        ${isTheOne ? 'bg-yellow-900/20 border border-yellow-500/50 z-10' : 'bg-[#001100] border border-[#00FF41]/40'}
      `}
    >
      {/* Neo 的故障特效层 */}
      {isTheOne && (
        <div className="absolute inset-0 bg-white opacity-10 animate-pulse mix-blend-overlay"></div>
      )}
      
      <svg viewBox="0 0 5 5" className="w-full h-full" style={{ filter: glowFilter }}>
        {grid.map((filled, i) => {
          if (!filled) return null;
          const r = Math.floor(i / 3);
          const c = i % 3;
          return (
            <React.Fragment key={i}>
              <rect x={c} y={r} width="1" height="1" fill={color} />
              {c < 2 && <rect x={4 - c} y={r} width="1" height="1" fill={color} />}
            </React.Fragment>
          );
        })}
      </svg>
    </div>
  );
};

// --- 字符边框容器 ---
const AsciiBox = ({ title, children, className = "" }) => (
  <div className={`relative flex flex-col bg-black/90 border border-[#00FF41]/30 shadow-[0_0_15px_rgba(0,255,65,0.1)] ${className}`}>
    <div className="flex items-center leading-none text-[#00FF41]">
      <span className="shrink-0">{CHARS.TL}</span>
      <span className="mx-2 shrink-0 font-bold uppercase tracking-[0.2em] text-[10px] bg-[#00FF41]/10 px-2 border border-[#00FF41]/30 crt-glow">
        <DecodingText text={title} />
      </span>
      <span className="flex-1 overflow-hidden whitespace-nowrap opacity-30">{CHARS.H.repeat(100)}</span>
      <span className="shrink-0">{CHARS.TR}</span>
    </div>
    <div className="flex flex-1 overflow-hidden relative">
      <div className="shrink-0 w-4 flex justify-center opacity-30 text-[#00FF41]">{CHARS.V}</div>
      <div className="flex-1 py-3 px-1 relative z-10 overflow-hidden flex flex-col">
        {children}
      </div>
      <div className="shrink-0 w-4 flex justify-center opacity-30 text-[#00FF41]">{CHARS.V}</div>
    </div>
    <div className="flex items-center leading-none opacity-30 text-[#00FF41]">
      <span className="shrink-0">{CHARS.BL}</span>
      <span className="flex-1 overflow-hidden whitespace-nowrap">{CHARS.H.repeat(100)}</span>
      <span className="shrink-0">{CHARS.BR}</span>
    </div>
    <div className="absolute top-0 left-0 w-1 h-1 bg-[#00FF41] opacity-50"></div>
    <div className="absolute bottom-0 right-0 w-1 h-1 bg-[#00FF41] opacity-50"></div>
  </div>
);

// --- 波动折线图 ---
const SeismographLine = ({ data }) => {
  const max = Math.max(...data, 1);
  const height = 100, width = 300;
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val / max) * height * 0.8) - 10; 
    return `${x},${y}`;
  }).join(' ');
  const fillPath = `${points} ${width},${height} 0,${height}`;

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#00FF41]/5 border border-[#00FF41]/10">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_95%,rgba(0,255,65,0.2)_100%)] bg-[length:20px_100%] animate-[scan_4s_linear_infinite] pointer-events-none"></div>
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 px-2 py-2">
        <div className="border-t border-dashed border-[#00FF41]"></div>
        <div className="border-t border-dashed border-[#00FF41]"></div>
        <div className="border-t border-dashed border-[#00FF41]"></div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00FF41" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#00FF41" stopOpacity="0" />
          </linearGradient>
          <filter id="neon"><feGaussianBlur stdDeviation="2" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <path d={`M${fillPath} Z`} fill="url(#glow)" />
        <polyline points={points} fill="none" stroke="#00FF41" strokeWidth="2" filter="url(#neon)" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="absolute top-2 right-2 text-[9px] font-bold text-[#00FF41] bg-black/80 px-2 border border-[#00FF41]">PEAK: {max}k</div>
    </div>
  );
};

// --- 配置页 ---
const ConfigModal = ({ isOpen, onClose, isPublic, onToggle }) => {
  if (!isOpen) return null;
  const [processing, setProcessing] = useState(false);
  const handleChoice = () => {
    setProcessing(true);
    setTimeout(() => { onToggle(); setProcessing(false); onClose(); }, 1500);
  };
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="w-full max-w-lg relative border-2 border-[#00FF41] p-1 shadow-[0_0_50px_rgba(0,255,65,0.3)]">
        <div className="absolute inset-0 bg-[#00FF41]/5 pointer-events-none animate-pulse"></div>
        <div className="bg-black p-6 relative z-10 flex flex-col items-center text-center space-y-8">
          <h2 className="text-[#00FF41] text-xl font-black uppercase tracking-[0.3em] glow-text border-b border-[#00FF41]/30 pb-4 w-full">
            <DecodingText text="SYSTEM_OVERRIDE" />
          </h2>
          <div className="space-y-4 font-mono text-xs text-[#00FF41]/80 leading-relaxed max-w-sm">
            <p>You are about to modify your neural trace visibility.</p>
            <p className="opacity-60">"This is your last chance. After this, there is no turning back."</p>
          </div>
          {processing ? (
            <div className="text-[#00FF41] font-mono text-xs animate-pulse py-8">REWRITING_SOURCE_CODE...</div>
          ) : (
            <div className="grid grid-cols-2 gap-8 w-full">
              <button onClick={isPublic ? handleChoice : onClose} className="group flex flex-col items-center space-y-3 p-4 border border-blue-500/30 hover:border-blue-500 hover:bg-blue-500/10 transition-all">
                <div className="w-8 h-8 rounded-full bg-blue-500 shadow-[0_0_20px_blue] group-hover:scale-110 transition-transform"></div>
                <div className="text-blue-400 font-bold uppercase tracking-widest text-[10px]">Ghost_Mode</div>
              </button>
              <button onClick={!isPublic ? handleChoice : onClose} className="group flex flex-col items-center space-y-3 p-4 border border-red-500/30 hover:border-red-500 hover:bg-red-500/10 transition-all">
                <div className="w-8 h-8 rounded-full bg-red-500 shadow-[0_0_20px_red] group-hover:scale-110 transition-transform"></div>
                <div className="text-red-500 font-bold uppercase tracking-widest text-[10px]">Broadcast</div>
              </button>
            </div>
          )}
          <button onClick={onClose} className="text-[9px] text-[#00FF41]/40 hover:text-[#00FF41] uppercase tracking-widest mt-4">[ESC] ABORT_SEQUENCE</button>
        </div>
      </div>
    </div>
  );
};

// --- 主程序 ---
export default function App() {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [booted, setBooted] = useState(false);
  const [activeTab, setActiveTab] = useState('DASHBOARD'); 
  const [isIdentityPublic, setIsIdentityPublic] = useState(false); 
  const [rankPeriod, setRankPeriod] = useState('ALL'); 
  const [showConfig, setShowConfig] = useState(false);
  const [waveData, setWaveData] = useState(Array.from({length: 30}, () => Math.random() * 50 + 20));

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    const b = setTimeout(() => setBooted(true), 1500); 
    const w = setInterval(() => {
      setWaveData(prev => [...prev.slice(1), Math.random() * 60 + 20 + Math.sin(Date.now())*20]);
    }, 800);
    return () => { clearInterval(t); clearTimeout(b); clearInterval(w); };
  }, []);

  const heatmap = useMemo(() => {
    const g = [];
    for(let i=0; i<12; i++) {
        let w = [];
        for(let j=0; j<4; j++) {
            let d = [];
            for(let k=0; k<7; k++) d.push(Math.random()>0.7 ? Math.floor(Math.random()*5) : 0);
            w.push(d);
        }
        g.push(w);
    }
    return g;
  }, []);

  // 模拟排行榜数据 (Rank 1 是 Neo，拥有金色特效)
  const leaderboardData = [
    { r: 1, n: "The_Oracle", v: 1250.4, anon: false },
    { r: 2, n: "0x8F2A...B1", v: 942.1, anon: true },
    { r: 3, n: "Morpheus", v: 712.4, anon: false },
    { r: 42, n: "Neo.Syst_3m", v: 142.8, anon: !isIdentityPublic, self: true },
    { r: 43, n: "Tank_Oper", v: 135.2, anon: false },
    { r: 44, n: "Dozer_Node", v: 128.9, anon: false },
  ];

  if (!booted) return (
    <div className="min-h-screen bg-black text-[#00FF41] font-mono flex flex-col items-center justify-center p-8 text-center">
      <div className="animate-pulse tracking-[0.5em] text-xs font-bold mb-4">WAKE UP, OPERATOR...</div>
      <div className="w-64 h-1 bg-[#003300] relative overflow-hidden">
        <div className="absolute inset-0 bg-[#00FF41] animate-[loader_2s_linear_infinite]"></div>
      </div>
      <style>{`@keyframes loader { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-[#00FF41] font-mono flex flex-col leading-tight selection:bg-[#00FF41] selection:text-black overflow-hidden h-screen crt-container">
      <MatrixRain />
      
      <div className="pointer-events-none fixed inset-0 z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] opacity-20"></div>
      <div className="pointer-events-none fixed inset-0 z-[51] animate-flicker opacity-[0.03] bg-white mix-blend-overlay"></div>

      <ConfigModal isOpen={showConfig} onClose={() => setShowConfig(false)} isPublic={isIdentityPublic} onToggle={() => setIsIdentityPublic(!isIdentityPublic)} />

      <header className="relative z-10 flex justify-between border-b border-[#00FF41]/30 p-4 items-center shrink-0 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center space-x-4">
          <div className="bg-[#00FF41] text-black px-2 py-0.5 font-black text-xs skew-x-[-10deg] border border-[#00FF41] shadow-[0_0_10px_#00FF41]">
            VIBE_OS_v9.0
          </div>
          <span className="opacity-70 text-[9px] hidden sm:inline font-bold tracking-widest text-shadow-glow animate-pulse">
            {isIdentityPublic ? 'SIGNAL: BROADCASTING' : 'SIGNAL: ENCRYPTED'}
          </span>
        </div>
        <div className="text-[#00FF41] font-bold text-xs font-mono tracking-widest">{time}</div>
      </header>

      <main className="relative z-10 flex-1 p-4 overflow-hidden flex flex-col">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
          
          {/* 左侧：个人中心 (DASHBOARD) */}
          <div className={`${activeTab === 'DASHBOARD' ? 'flex' : 'hidden'} lg:flex lg:col-span-5 flex-col space-y-6 overflow-hidden`}>
            <AsciiBox title="Identity_Matrix">
              <div className="flex items-center space-x-6 px-2">
                
                {/* 我自己的头像 (普通用户) */}
                <MatrixAvatar name={isIdentityPublic ? "Neo.Syst_3m" : "unknown"} isAnon={!isIdentityPublic} size={80} />

                <div className="flex-1 space-y-2">
                  <div>
                    <div className="text-[8px] opacity-50 uppercase tracking-widest">Operator_Handle</div>
                    <div className="text-white font-black text-xl tracking-tighter text-shadow-sm">
                      <DecodingText text={isIdentityPublic ? 'NEO.SYST_3M' : 'UNKNOWN_GHOST'} />
                    </div>
                  </div>
                  {!isIdentityPublic && (
                    <button onClick={() => setShowConfig(true)} className="text-[9px] text-black bg-[#00FF41] px-2 py-1 font-bold uppercase hover:bg-white transition-colors blink-anim">
                      [ ! ] DECRYPT_IDENTITY
                    </button>
                  )}
                </div>
              </div>
            </AsciiBox>

            <AsciiBox title="Archive_Sector" className="flex-1 flex flex-col">
              <div className="overflow-x-auto no-scrollbar py-2">
                <div className="flex space-x-1.5 min-w-fit">
                  {heatmap.map((group, gIdx) => (
                    <div key={gIdx} className="flex space-x-0.5 border-r border-[#00FF41]/10 pr-1 last:border-none">
                      {group.map((week, wIdx) => (
                        <div key={wIdx} className="flex flex-col space-y-0.5">
                          {week.map((level, dIdx) => (
                            <span key={dIdx} className="text-[10px] leading-none" style={{ opacity: level === 0 ? 0.1 : 0.3 + (level * 0.2), textShadow: level > 3 ? '0 0 5px #00FF41' : 'none' }}>
                              {level === 0 ? '·' : '■'}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-auto pt-2 border-t border-[#00FF41]/10 text-[8px] opacity-50 flex justify-between uppercase">
                 <span>Yearly_Map</span>
                 <span>Total: 142k</span>
              </div>
            </AsciiBox>
          </div>

          {/* 右侧：波动与排名 (NETWORK) */}
          <div className={`${activeTab === 'RANKINGS' ? 'flex' : 'hidden'} lg:flex lg:col-span-7 flex-col space-y-6 overflow-hidden`}>
            
            <AsciiBox title="Neural_Flux_Monitor" className="h-48 flex-shrink-0">
               <SeismographLine data={waveData} />
            </AsciiBox>

            <AsciiBox title="Zion_Index" className="flex-1 flex flex-col overflow-hidden">
              <div className="flex border-b border-[#00FF41]/20 mb-2 pb-1 gap-4 px-2">
                <button className={`text-[9px] font-black uppercase ${rankPeriod === '24H' ? 'text-white border-b-2 border-[#00FF41]' : 'text-[#00FF41]/40'}`} onClick={() => setRankPeriod('24H')}>Cycle_24h</button>
                <button className={`text-[9px] font-black uppercase ${rankPeriod === 'ALL' ? 'text-white border-b-2 border-[#00FF41]' : 'text-[#00FF41]/40'}`} onClick={() => setRankPeriod('ALL')}>Legacy_All</button>
              </div>

              {rankPeriod === 'ALL' ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-6 opacity-90 py-4">
                   <div className="text-center">
                      <div className="text-[10px] uppercase opacity-50 tracking-widest mb-2">Total_System_Output</div>
                      <div className="text-4xl font-black text-white glow-text">94,201,482</div>
                      <div className="text-[8px] opacity-40 mt-1">SINCE GENESIS 2024.01.01</div>
                   </div>
                   <div className="grid grid-cols-2 gap-4 w-full px-8">
                      <div className="border border-[#00FF41]/30 bg-[#00FF41]/5 p-3 text-center">
                         <div className="text-[8px] opacity-50 uppercase">Active_Nodes</div>
                         <div className="text-xl font-bold text-white">14,291</div>
                      </div>
                      <div className="border border-[#00FF41]/30 bg-[#00FF41]/5 p-3 text-center">
                         <div className="text-[8px] opacity-50 uppercase">Avg_Daily</div>
                         <div className="text-xl font-bold text-white">42.8k</div>
                      </div>
                   </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto no-scrollbar py-2 px-1">
                  {leaderboardData.map((p, i) => (
                    <div key={i} className={`flex justify-between items-center py-2 px-2 border-b border-[#00FF41]/10 hover:bg-[#00FF41]/5 group ${p.self ? 'bg-[#00FF41]/20 border-l-2 border-l-[#00FF41]' : ''}`}>
                      <div className="flex items-center space-x-3">
                        <span className={`font-mono text-[9px] w-6 ${p.r <= 3 ? 'text-[#00FF41] font-bold' : 'opacity-40'}`}>{p.r.toString().padStart(2,'0')}</span>
                        
                        {/* The One (Rank 1) 拥有金色特权，其他人是绿色 */}
                        <MatrixAvatar name={p.n} isAnon={p.anon} isTheOne={p.r === 1} size={24} />

                        <span className={`text-[10px] uppercase font-bold tracking-tight ${p.anon ? 'opacity-30 blur-[1px]' : 'text-white'}`}>{p.n}</span>
                      </div>
                      <span className="font-mono text-[10px] text-[#00FF41]">{p.v.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="text-center text-[8px] opacity-40 py-2 hover:text-[#00FF41] cursor-pointer">-- LOAD_NEXT_BATCH --</div>
                </div>
              )}
            </AsciiBox>
          </div>

        </div>
      </main>

      <footer className="relative z-20 border-t border-[#00FF41]/20 bg-[#050505] p-2 flex shrink-0">
        <div className="flex-1 grid grid-cols-3 gap-1">
          <button onClick={() => setActiveTab('DASHBOARD')} className={`py-3 text-[10px] font-black uppercase border transition-all ${activeTab === 'DASHBOARD' ? 'bg-[#00FF41] text-black' : 'border-[#00FF41]/20 text-[#00FF41]/50'}`}>[F1] NODE</button>
          <button onClick={() => setActiveTab('RANKINGS')} className={`py-3 text-[10px] font-black uppercase border transition-all ${activeTab === 'RANKINGS' ? 'bg-[#00FF41] text-black' : 'border-[#00FF41]/20 text-[#00FF41]/50'}`}>[F2] NET</button>
          <button onClick={() => setShowConfig(true)} className="py-3 text-[10px] font-black uppercase border border-[#00FF41]/20 text-[#00FF41]/50 hover:text-[#00FF41] hover:border-[#00FF41]">[F3] CFG</button>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .glow-text { text-shadow: 0 0 10px #00FF41; }
        .text-shadow-glow { text-shadow: 0 0 5px rgba(0,255,65,0.5); }
        .crt-glow { box-shadow: 0 0 5px rgba(0,255,65,0.4); }
        @keyframes flicker { 0% { opacity: 0.03; } 5% { opacity: 0.05; } 10% { opacity: 0.03; } 15% { opacity: 0.07; } 100% { opacity: 0.03; } }
        .animate-flicker { animation: flicker 0.15s infinite; }
        @keyframes scan { 0% { background-position: 0% 0%; } 100% { background-position: 100% 0%; } }
        .blink-anim { animation: blink 1s step-end infinite; }
        @keyframes blink { 50% { opacity: 0; } }
      `}} />
    </div>
  );
}


