import React, { useEffect, useRef } from "react";

export function MatrixRain() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const reduceMotion = Boolean(
      window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
    if (reduceMotion) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const chars =
      "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(
        ""
      );

    let width = 0;
    let height = 0;
    let layers = [];
    let raf = 0;

    function resize() {
      width = window.innerWidth || 0;
      height = window.innerHeight || 0;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.filter = "none";
      ctx.fillStyle = "rgba(0, 0, 0, 1)";
      ctx.fillRect(0, 0, width, height);

      layers = [
        { density: 0.32, speed: 1.05, opacity: 0.32, size: 18, blur: 0 },
        { density: 0.18, speed: 0.75, opacity: 0.14, size: 14, blur: 1 },
        { density: 0.08, speed: 0.48, opacity: 0.07, size: 10, blur: 2 },
      ].map((config) => {
        const columns = Math.ceil(width / config.size);
        const randChar = () => chars[Math.floor(Math.random() * chars.length)];
        return {
          ...config,
          active: Array.from(
            { length: columns },
            () => Math.random() < config.density
          ),
          speeds: Array.from(
            { length: columns },
            () => config.speed * (0.75 + Math.random() * 0.5)
          ),
          glyphs: Array.from({ length: columns }, () => randChar()),
          drops: Array.from({ length: columns }, () => Math.random() * -120),
        };
      });
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });

    let last = 0;
    function draw(ts) {
      const dt = ts - last;
      if (dt < 45) {
        raf = window.requestAnimationFrame(draw);
        return;
      }
      last = ts;

      ctx.filter = "none";
      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      ctx.fillRect(0, 0, width, height);

      layers.forEach((layer) => {
        ctx.font = `${layer.size}px "Share Tech Mono", monospace`;
        ctx.fillStyle = `rgba(0, 255, 65, ${layer.opacity})`;

        if (layer.blur > 0) {
          ctx.filter = `blur(${layer.blur}px)`;
        } else {
          ctx.filter = "none";
        }

        for (let i = 0; i < layer.drops.length; i++) {
          if (!layer.active[i]) continue;

          const x = i * layer.size;
          const y = layer.drops[i] * layer.size;

          if (Math.random() > 0.985) {
            layer.glyphs[i] = chars[Math.floor(Math.random() * chars.length)];
          }
          const char = layer.glyphs[i];

          ctx.fillText(char, x, y);

          if (Math.random() > 0.995) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            ctx.fillText(char, x, y);
            ctx.fillStyle = `rgba(0, 255, 65, ${layer.opacity})`;
          }

          if (y > height && Math.random() > 0.99) {
            layer.drops[i] = Math.random() * -80;
          } else {
            layer.drops[i] += layer.speeds[i] || layer.speed;
          }
        }
      });

      raf = window.requestAnimationFrame(draw);
    }

    raf = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="fixed inset-0 w-screen h-screen pointer-events-none opacity-[0.14] z-0"
      aria-hidden="true"
    />
  );
}
