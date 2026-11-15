/**
 * Interactive "neural network" background for the hero.
 *
 * Performance notes:
 *  - Connecting every pair of particles is O(n²). Instead, particles are bucketed into a
 *    spatial hash grid whose cell size equals the link distance, so each particle only
 *    checks its own and neighboring cells. That is roughly O(n) per frame.
 *  - The loop pauses when the hero is offscreen (IntersectionObserver) or the tab is hidden.
 *  - Users who prefer reduced motion get a single static frame.
 */
import { useEffect, useRef } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useTheme } from "../lib/theme";

interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const LINK = 120;
const MOUSE_RADIUS = 160;

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const theme = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue("--accent").trim();
    const accent2 = styles.getPropertyValue("--accent-2").trim();

    let width = 0;
    let height = 0;
    let dots: Dot[] = [];
    let raf = 0;
    let visible = true;
    const mouse = { x: -9999, y: -9999, active: false };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Density scales with area, capped so huge monitors stay smooth.
      const count = Math.min(Math.floor((width * height) / 11000), 140);
      dots = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r: 1 + Math.random() * 1.8,
      }));
    };

    const frame = () => {
      ctx.clearRect(0, 0, width, height);

      // Build the spatial hash grid for this frame.
      const cols = Math.ceil(width / LINK) + 1;
      const grid = new Map<number, number[]>();
      dots.forEach((d, i) => {
        const key = Math.floor(d.y / LINK) * cols + Math.floor(d.x / LINK);
        const bucket = grid.get(key);
        if (bucket) bucket.push(i);
        else grid.set(key, [i]);
      });

      ctx.lineWidth = 1;
      for (let i = 0; i < dots.length; i++) {
        const a = dots[i]!;
        const cx = Math.floor(a.x / LINK);
        const cy = Math.floor(a.y / LINK);
        // Check the 3x3 neighborhood. `j > i` ensures each pair is drawn once.
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const bucket = grid.get((cy + oy) * cols + (cx + ox));
            if (!bucket) continue;
            for (const j of bucket) {
              if (j <= i) continue;
              const b = dots[j]!;
              const dist = Math.hypot(a.x - b.x, a.y - b.y);
              if (dist > LINK) continue;
              ctx.strokeStyle = accent;
              ctx.globalAlpha = (1 - dist / LINK) * 0.35;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }

        // Mouse interaction: link to the cursor and gently repel.
        if (mouse.active) {
          const dx = a.x - mouse.x;
          const dy = a.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < MOUSE_RADIUS && dist > 0.1) {
            ctx.strokeStyle = accent2;
            ctx.globalAlpha = (1 - dist / MOUSE_RADIUS) * 0.7;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
            const force = (1 - dist / MOUSE_RADIUS) * 0.6;
            a.vx += (dx / dist) * force * 0.15;
            a.vy += (dy / dist) * force * 0.15;
          }
        }
      }

      // Move and draw dots.
      ctx.globalAlpha = 1;
      for (const d of dots) {
        d.vx *= 0.985;
        d.vy *= 0.985;
        // Keep a little drift so the field never freezes.
        if (Math.abs(d.vx) < 0.08) d.vx += (Math.random() - 0.5) * 0.04;
        if (Math.abs(d.vy) < 0.08) d.vy += (Math.random() - 0.5) * 0.04;
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > width) d.vx *= -1;
        if (d.y < 0 || d.y > height) d.vy *= -1;
        d.x = Math.max(0, Math.min(width, d.x));
        d.y = Math.max(0, Math.min(height, d.y));
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      frame();
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const startLoop = () => {
      cancelAnimationFrame(raf);
      if (reduced) frame();
      else raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = mouse.y >= 0 && mouse.y <= rect.height;
    };
    const onLeave = () => (mouse.active = false);
    // Clicking sends out a shockwave that scatters nearby dots.
    const onClick = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (y < 0 || y > rect.height) return;
      for (const d of dots) {
        const dx = d.x - x;
        const dy = d.y - y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 260) {
          const force = (1 - dist / 260) * 9;
          d.vx += (dx / dist) * force;
          d.vy += (dy / dist) * force;
        }
      }
    };

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) frame();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) startLoop();
    });
    io.observe(canvas);
    const onVis = () => !document.hidden && visible && startLoop();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onClick, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    resize();
    startLoop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onClick);
      document.removeEventListener("pointerleave", onLeave);
    };
    // Re-run when the theme changes so colors update.
  }, [reduced, theme]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />;
}
