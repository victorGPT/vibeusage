import React, { useEffect, useRef } from "react";

/**
 * Matrix rain background.
 */
export const MatrixRain = () => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion = Boolean(
      window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );

    const settings = {
      scale: prefersReducedMotion ? 0.45 : 0.5,
      fps: prefersReducedMotion ? 3 : 8,
      baseFontSize: 16,
      spacing: prefersReducedMotion ? 1.7 : 1.4,
      trailAlpha: prefersReducedMotion ? 0.2 : 0.12,
      speed: prefersReducedMotion ? 0.5 : 0.85,
      resetChance: prefersReducedMotion ? 0.97 : 0.985,
      highlightChance: 0.05,
    };

    const characters = "01XYZA@#$%";
    let animationFrameId = 0;
    let resizeFrameId = 0;
    let lastFrameTime = 0;
    let drops = [];
    let fontSize = 12;
    let columnPitch = 16;
    let isVisible = document.visibilityState !== "hidden";

    const resize = () => {
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      const width = Math.max(1, Math.floor(window.innerWidth * settings.scale));
      const height = Math.max(1, Math.floor(window.innerHeight * settings.scale));
      canvas.width = width;
      canvas.height = height;

      fontSize = Math.max(8, Math.round(settings.baseFontSize * settings.scale));
      columnPitch = Math.max(10, Math.round(fontSize * settings.spacing));
      const columns = Math.ceil(canvas.width / columnPitch);
      drops = Array.from({ length: columns }, () => Math.random() * -100);

      ctx.font = `${fontSize}px monospace`;
      ctx.textBaseline = "top";
      ctx.imageSmoothingEnabled = false;
    };

    const handleResize = () => {
      if (resizeFrameId) cancelAnimationFrame(resizeFrameId);
      resizeFrameId = requestAnimationFrame(resize);
    };

    const drawFrame = () => {
      ctx.fillStyle = `rgba(5, 5, 5, ${settings.trailAlpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < drops.length; i++) {
        const char = characters.charAt(
          Math.floor(Math.random() * characters.length)
        );
        ctx.fillStyle =
          Math.random() < settings.highlightChance ? "#E8FFE9" : "#00FF41";
        ctx.fillText(char, i * columnPitch, drops[i] * fontSize);
        if (
          drops[i] * fontSize > canvas.height &&
          Math.random() > settings.resetChance
        ) {
          drops[i] = 0;
        }
        drops[i] += settings.speed;
      }
    };

    const loop = (time) => {
      if (!isVisible) return;
      const frameInterval = 1000 / settings.fps;
      if (time - lastFrameTime >= frameInterval) {
        drawFrame();
        lastFrameTime = time;
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    const start = () => {
      if (!isVisible) return;
      lastFrameTime = performance.now();
      animationFrameId = requestAnimationFrame(loop);
    };

    const stop = () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = 0;
    };

    const handleVisibility = () => {
      isVisible = document.visibilityState !== "hidden";
      if (isVisible) {
        stop();
        start();
      } else {
        stop();
      }
    };

    resize();
    start();

    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      stop();
      if (resizeFrameId) cancelAnimationFrame(resizeFrameId);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      className="matrix-rain fixed inset-0 z-0 pointer-events-none opacity-20"
      style={{ width: "100%", height: "100%" }}
    />
  );
};
