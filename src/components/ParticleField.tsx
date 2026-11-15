/**
 * @file Interactive "neural network" background for the hero section.
 *
 * Dots drift, link to nearby dots, react to the cursor, and scatter on click.
 *
 * Performance notes (this runs every frame, so it is tuned hard)
 * --------------------------------------------------------------
 * 1. Spatial hash grid: linking every pair of dots is O(n²). Dots are bucketed into a
 *    uniform grid whose cell size equals the link distance, so each dot only checks its
 *    own and neighboring cells. That is O(n) on average.
 * 2. Zero allocations per frame: dot data lives in typed arrays, and the grid is an
 *    intrusive linked list (`cellHead` + `next`) stored in two Int32Arrays. Nothing is
 *    created or garbage collected while animating.
 * 3. Batched drawing: every line has its own opacity, which would normally mean one
 *    stroke call per line (hundreds per frame). Lines are sorted into a few opacity
 *    buckets instead, and each bucket is stroked as a single path. Dots are filled as
 *    one path too. Total: about eight draw calls per frame.
 * 4. No square roots in the pair loop: distances are compared squared.
 * 5. The loop pauses when the hero is offscreen or the tab is hidden, and users who
 *    prefer reduced motion get a single static frame.
 */
import { useEffect, useRef } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useTheme } from "../lib/theme";

/** Maximum distance at which two dots are linked, in CSS pixels. Also the grid cell size. */
const LINK = 120;
const LINK_SQ = LINK * LINK;
const MOUSE_RADIUS = 160;
const SHOCKWAVE_RADIUS = 260;
const MAX_DOTS = 140;
/** Number of opacity levels lines are quantized into. More buckets look smoother but cost more draw calls. */
const BUCKETS = 6;
/** Line segments each bucket can hold. Extra segments are dropped, which is invisible in practice. */
const BUCKET_CAPACITY = 1024;

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

    // Struct of arrays: one typed array per property, indexed by dot.
    const x = new Float32Array(MAX_DOTS);
    const y = new Float32Array(MAX_DOTS);
    const vx = new Float32Array(MAX_DOTS);
    const vy = new Float32Array(MAX_DOTS);
    const radius = new Float32Array(MAX_DOTS);
    /** next[i] is the next dot in the same grid cell as dot i, or -1. */
    const next = new Int32Array(MAX_DOTS);
    /** cellHead[c] is the first dot in grid cell c, or -1. Resized with the canvas. */
    let cellHead = new Int32Array(0);
    /** Line endpoints per opacity bucket: [x1, y1, x2, y2, ...]. */
    const segments = Array.from({ length: BUCKETS }, () => new Float32Array(BUCKET_CAPACITY * 4));
    const segmentCount = new Int32Array(BUCKETS);

    let count = 0;
    let width = 0;
    let height = 0;
    let cols = 1;
    let rows = 1;
    let raf = 0;
    let visible = true;
    const mouse = { x: 0, y: 0, active: false };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.floor(width / LINK) + 1;
      rows = Math.floor(height / LINK) + 1;
      cellHead = new Int32Array(cols * rows);

      // Density scales with area, capped so huge monitors stay smooth.
      count = Math.min(Math.floor((width * height) / 11000), MAX_DOTS);
      for (let i = 0; i < count; i++) {
        x[i] = Math.random() * width;
        y[i] = Math.random() * height;
        vx[i] = (Math.random() - 0.5) * 0.5;
        vy[i] = (Math.random() - 0.5) * 0.5;
        radius[i] = 1 + Math.random() * 1.8;
      }
    };

    const frame = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Move dots, bounce off the edges, and insert each one into the grid. O(n).
      cellHead.fill(-1);
      for (let i = 0; i < count; i++) {
        vx[i]! *= 0.985;
        vy[i]! *= 0.985;
        // Keep a little drift so the field never freezes.
        if (Math.abs(vx[i]!) < 0.08) vx[i]! += (Math.random() - 0.5) * 0.04;
        if (Math.abs(vy[i]!) < 0.08) vy[i]! += (Math.random() - 0.5) * 0.04;
        let nx = x[i]! + vx[i]!;
        let ny = y[i]! + vy[i]!;
        if (nx < 0 || nx > width) { vx[i] = -vx[i]!; nx = nx < 0 ? 0 : width; }
        if (ny < 0 || ny > height) { vy[i] = -vy[i]!; ny = ny < 0 ? 0 : height; }
        x[i] = nx;
        y[i] = ny;

        // Push onto the front of this cell's linked list. O(1).
        const cell = Math.floor(ny / LINK) * cols + Math.floor(nx / LINK);
        next[i] = cellHead[cell]!;
        cellHead[cell] = i;
      }

      // 2. Find links by checking each dot against its 3x3 cell neighborhood.
      segmentCount.fill(0);
      for (let i = 0; i < count; i++) {
        const xi = x[i]!;
        const yi = y[i]!;
        const cx = Math.floor(xi / LINK);
        const cy = Math.floor(yi / LINK);
        for (let oy = -1; oy <= 1; oy++) {
          const ry = cy + oy;
          if (ry < 0 || ry >= rows) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const rx = cx + ox;
            if (rx < 0 || rx >= cols) continue;
            // Walk the cell's linked list. `j > i` makes sure each pair is linked once.
            for (let j = cellHead[ry * cols + rx]!; j !== -1; j = next[j]!) {
              if (j <= i) continue;
              const dx = xi - x[j]!;
              const dy = yi - y[j]!;
              const distSq = dx * dx + dy * dy;
              if (distSq > LINK_SQ) continue;
              // Closer pairs go in higher (more opaque) buckets.
              const bucket = Math.min(BUCKETS - 1, Math.floor((1 - distSq / LINK_SQ) * BUCKETS));
              const n = segmentCount[bucket]!;
              if (n >= BUCKET_CAPACITY) continue;
              const buf = segments[bucket]!;
              const o = n * 4;
              buf[o] = xi;
              buf[o + 1] = yi;
              buf[o + 2] = x[j]!;
              buf[o + 3] = y[j]!;
              segmentCount[bucket] = n + 1;
            }
          }
        }
      }

      // 3. Stroke each opacity bucket as a single path.
      ctx.lineWidth = 1;
      ctx.strokeStyle = accent;
      for (let b = 0; b < BUCKETS; b++) {
        const n = segmentCount[b]!;
        if (n === 0) continue;
        const buf = segments[b]!;
        ctx.globalAlpha = ((b + 0.5) / BUCKETS) * 0.4;
        ctx.beginPath();
        for (let s = 0; s < n * 4; s += 4) {
          ctx.moveTo(buf[s]!, buf[s + 1]!);
          ctx.lineTo(buf[s + 2]!, buf[s + 3]!);
        }
        ctx.stroke();
      }

      // 4. Cursor interaction: link nearby dots to the pointer and push them away. O(n).
      if (mouse.active) {
        ctx.strokeStyle = accent2;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const dx = x[i]! - mouse.x;
          const dy = y[i]! - mouse.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > MOUSE_RADIUS * MOUSE_RADIUS || distSq < 0.01) continue;
          ctx.moveTo(x[i]!, y[i]!);
          ctx.lineTo(mouse.x, mouse.y);
          const dist = Math.sqrt(distSq); // Only dots in range pay for a square root.
          const force = (1 - dist / MOUSE_RADIUS) * 0.09;
          vx[i]! += (dx / dist) * force;
          vy[i]! += (dy / dist) * force;
        }
        ctx.stroke();
      }

      // 5. Fill every dot as one path.
      ctx.globalAlpha = 1;
      ctx.fillStyle = accent;
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        ctx.moveTo(x[i]! + radius[i]!, y[i]!);
        ctx.arc(x[i]!, y[i]!, radius[i]!, 0, Math.PI * 2);
      }
      ctx.fill();
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
    const onLeave = () => {
      mouse.active = false;
    };
    /** Clicking sends out a shockwave that scatters nearby dots. O(n). */
    const onDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      if (py < 0 || py > rect.height) return;
      for (let i = 0; i < count; i++) {
        const dx = x[i]! - px;
        const dy = y[i]! - py;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < SHOCKWAVE_RADIUS) {
          const force = (1 - dist / SHOCKWAVE_RADIUS) * 9;
          vx[i]! += (dx / dist) * force;
          vy[i]! += (dy / dist) * force;
        }
      }
    };

    // ResizeObserver also fires once on observe, which performs the initial sizing.
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
    const onVisibility = () => !document.hidden && visible && startLoop();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    resize();
    startLoop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerleave", onLeave);
    };
    // `theme` is a dependency so the colors are re-read when the theme changes.
  }, [reduced, theme]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />;
}
