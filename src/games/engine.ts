/**
 * @file Shared mini game engine.
 *
 * Everything the canvas games have in common lives here: canvas setup, the frame loop,
 * a pooled particle system, score popups, and cached background layers.
 *
 * Performance principles used throughout:
 *  1. No allocations in the hot path. Particles live in preallocated typed arrays
 *     (a "struct of arrays"), so the garbage collector never interrupts a frame.
 *  2. O(1) removal. Dead entities are removed by swapping the last live entity into
 *     their slot ("swap-remove") instead of Array.splice, which is O(n).
 *  3. Draw static content once. Backgrounds are rendered to an offscreen canvas and
 *     then blitted with a single drawImage call per frame.
 */
import { useEffect, useRef } from "react";

/* -------------------------------------------------------------------------- */
/*                                   Palette                                  */
/* -------------------------------------------------------------------------- */

/** Theme colors resolved to plain strings that the Canvas 2D API understands. */
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

/**
 * Reads the active theme's CSS variables so games re-skin with the site theme.
 * Called once when a game starts, never per frame (getComputedStyle forces style recalculation).
 */
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

/* -------------------------------------------------------------------------- */
/*                                Canvas helpers                              */
/* -------------------------------------------------------------------------- */

/** Device pixel ratio, capped at 2 so 3x phone screens do not triple the fill cost. */
export const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);

/**
 * Sizes a canvas backing store for the device pixel ratio and returns a context
 * whose coordinate system is in logical units (so game code never thinks about DPR).
 */
export function setupCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = pixelRatio();
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * Renders static content to an offscreen canvas once. Each frame can then draw the
 * whole layer with one `drawImage` call instead of replaying every path.
 *
 * @param width  Logical width.
 * @param height Logical height.
 * @param paint  Draws the layer's content in logical coordinates.
 */
export function createLayer(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  paint(setupCanvas(canvas, width, height));
  return canvas;
}

/** Converts a pointer event to logical canvas coordinates, regardless of CSS scaling. O(1). */
export function toLocal(canvas: HTMLCanvasElement, e: { clientX: number; clientY: number }, width: number, height: number) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * width,
    y: ((e.clientY - rect.top) / rect.height) * height,
  };
}

/** Strokes a square grid as a single path (one draw call no matter how many lines). */
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

/* -------------------------------------------------------------------------- */
/*                                  React glue                                */
/* -------------------------------------------------------------------------- */

/**
 * Sets up a game canvas once on mount.
 * @returns Refs to the canvas element, its 2D context, and the theme palette.
 */
export function useGameCanvas(width: number, height: number) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const paletteRef = useRef<Palette | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    ctxRef.current = setupCanvas(canvasRef.current, width, height);
    paletteRef.current = readPalette();
  }, [width, height]);

  return { canvasRef, ctxRef, paletteRef };
}

/**
 * requestAnimationFrame loop that reports delta time in seconds.
 *
 * - Delta is clamped to 50ms, so returning to a backgrounded tab cannot teleport objects.
 * - The callback is stored in a ref, so the loop never restarts when its identity changes.
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

/** Calls `onHide` when the tab is hidden (Page Visibility API), so games can auto pause. */
export function usePauseOnHide(onHide: () => void) {
  const cb = useRef(onHide);
  useEffect(() => {
    cb.current = onHide;
  });
  useEffect(() => {
    const handler = () => document.hidden && cb.current();
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);
}

/* -------------------------------------------------------------------------- */
/*                               Particle system                              */
/* -------------------------------------------------------------------------- */

/**
 * Fixed-capacity particle pool stored as a struct of arrays.
 *
 * | Operation | Cost | Notes                                          |
 * | --------- | ---- | ---------------------------------------------- |
 * | burst     | O(k) | k = particles spawned, no allocation           |
 * | update    | O(n) | n = live particles, swap-remove is O(1) each   |
 * | draw      | O(n) | one fillRect per particle                      |
 *
 * When the pool is full, new particles are simply dropped. Nobody notices a missing
 * spark, but everybody notices a dropped frame.
 */
export class ParticlePool {
  readonly capacity: number;
  /** Number of live particles. Live particles always occupy indices [0, count). */
  count = 0;
  private readonly x: Float32Array;
  private readonly y: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly size: Float32Array;
  private readonly color: string[];

  constructor(capacity = 768) {
    this.capacity = capacity;
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.color = new Array<string>(capacity).fill("");
  }

  /** Spawns `count` particles flying outward from a point at random angles. */
  burst(x: number, y: number, color: string, count = 14, speed = 180) {
    const n = Math.min(count, this.capacity - this.count);
    for (let k = 0; k < n; k++) {
      const i = this.count++;
      const angle = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      const life = 0.4 + Math.random() * 0.4;
      this.x[i] = x;
      this.y[i] = y;
      this.vx[i] = Math.cos(angle) * s;
      this.vy[i] = Math.sin(angle) * s;
      this.life[i] = life;
      this.maxLife[i] = life;
      this.size[i] = 2 + Math.random() * 2.5;
      this.color[i] = color;
    }
  }

  /** Advances every particle and recycles the dead ones. */
  update(dt: number) {
    // Frame-rate independent drag: 0.96 per frame at 60fps.
    const drag = Math.pow(0.96, dt * 60);
    for (let i = this.count - 1; i >= 0; i--) {
      this.life[i]! -= dt;
      if (this.life[i]! <= 0) {
        // Swap-remove: move the last live particle into this slot. O(1).
        const last = --this.count;
        this.x[i] = this.x[last]!;
        this.y[i] = this.y[last]!;
        this.vx[i] = this.vx[last]!;
        this.vy[i] = this.vy[last]!;
        this.life[i] = this.life[last]!;
        this.maxLife[i] = this.maxLife[last]!;
        this.size[i] = this.size[last]!;
        this.color[i] = this.color[last]!;
        continue;
      }
      this.x[i]! += this.vx[i]! * dt;
      this.y[i]! += this.vy[i]! * dt;
      this.vx[i]! *= drag;
      this.vy[i]! *= drag;
    }
  }

  /** Draws every particle as a small square that fades out over its lifetime. */
  draw(ctx: CanvasRenderingContext2D) {
    let lastColor = "";
    for (let i = 0; i < this.count; i++) {
      const size = this.size[i]!;
      // Only touch fillStyle when the color actually changes (state changes are not free).
      if (this.color[i] !== lastColor) {
        lastColor = this.color[i]!;
        ctx.fillStyle = lastColor;
      }
      ctx.globalAlpha = Math.max(this.life[i]! / this.maxLife[i]!, 0);
      ctx.fillRect(this.x[i]! - size / 2, this.y[i]! - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  /** Removes every particle. O(1). */
  clear() {
    this.count = 0;
  }
}

/* -------------------------------------------------------------------------- */
/*                                Score popups                                */
/* -------------------------------------------------------------------------- */

/** Floating "+100" style text that drifts upward and fades. */
export interface Popup {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

/** Advances popups and swap-removes the expired ones. O(n). */
export function updatePopups(list: Popup[], dt: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]!;
    p.life -= dt;
    p.y -= 40 * dt;
    if (p.life <= 0) swapRemove(list, i);
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

/* -------------------------------------------------------------------------- */
/*                                  Utilities                                 */
/* -------------------------------------------------------------------------- */

/**
 * Removes the element at `index` in O(1) by overwriting it with the last element.
 * Order is not preserved, which is fine for unordered entity lists.
 * Safe to call while iterating backwards.
 */
export function swapRemove<T>(list: T[], index: number) {
  const last = list.pop()!;
  if (index < list.length) list[index] = last;
}

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Random element of a non-empty array. O(1). */
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
