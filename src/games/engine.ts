/**
 * Shared mini game engine utilities.
 * Games run on a fixed logical resolution and scale to any screen, crisp on high DPI displays.
 */
import { useEffect, useRef } from "react";

export interface Palette {
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  good: string;
  bad: string;
  warn: string;
}

/** Reads the active theme's CSS variables so games re-skin with the site theme. */
export function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    bg: v("--bg"),
    surface: v("--surface"),
    border: v("--border"),
    text: v("--text"),
    muted: v("--muted"),
    accent: v("--accent"),
    accent2: v("--accent-2"),
    good: v("--good"),
    bad: v("--bad"),
    warn: v("--warn"),
  };
}

/** Sizes the backing store for the device pixel ratio and returns a context in logical units. */
export function setupCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** Converts a pointer event to logical canvas coordinates, regardless of CSS scaling. */
export function toLocal(canvas: HTMLCanvasElement, e: { clientX: number; clientY: number }, width: number, height: number) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * width,
    y: ((e.clientY - rect.top) / rect.height) * height,
  };
}

/**
 * requestAnimationFrame loop with delta time in seconds.
 * Delta is clamped so a backgrounded tab does not cause objects to teleport.
 * The callback lives in a ref, so the loop never restarts when the callback identity changes.
 */
export function useGameLoop(callback: (dt: number) => void, running: boolean) {
  const cb = useRef(callback);
  useEffect(() => {
    cb.current = callback;
  });

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const frame = (t: number) => {
      const dt = Math.min((t - last) / 1000, 1 / 20);
      last = t;
      cb.current(dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running]);
}

/** Lightweight particle burst. Swap-remove keeps cleanup O(1) per dead particle. */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export function burst(list: Particle[], x: number, y: number, color: string, count = 14, speed = 180) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    const life = 0.4 + Math.random() * 0.4;
    list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, maxLife: life, color, size: 2 + Math.random() * 2.5 });
  }
}

export function updateParticles(list: Particle[], dt: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]!;
    p.life -= dt;
    if (p.life <= 0) {
      list[i] = list[list.length - 1]!;
      list.pop();
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D, list: Particle[]) {
  for (const p of list) {
    ctx.globalAlpha = Math.max(p.life / p.maxLife, 0);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

/** Floating "+100" style score popups. */
export interface Popup {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

export function updatePopups(list: Popup[], dt: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]!;
    p.life -= dt;
    p.y -= 40 * dt;
    if (p.life <= 0) {
      list[i] = list[list.length - 1]!;
      list.pop();
    }
  }
}

export function drawPopups(ctx: CanvasRenderingContext2D, list: Popup[]) {
  ctx.font = "bold 14px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  for (const p of list) {
    ctx.globalAlpha = Math.min(p.life * 2, 1);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

export function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, size = 40) {
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x += size) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = 0; y <= h; y += size) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
