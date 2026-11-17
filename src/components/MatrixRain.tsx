/**
 * @file Full screen "digital rain" easter egg, drawn on canvas.
 */
import { useEffect, useRef } from "react";
import { setMatrix, useMatrix } from "../lib/effects";
import { sfx } from "../lib/sound";

/** Characters the rain is made of. */
const GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0101001101<>{}[]$#=;";

/** Full screen digital rain. Unlocked by the Konami code or the `matrix` terminal command. */
export function MatrixRain() {
  const on = useMatrix();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!on) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const color = getComputedStyle(document.documentElement).getPropertyValue("--good").trim() || "#39ff6a";
    const size = 16;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // One "drop" per column, each holding its current row.
    const drops = Array.from({ length: Math.ceil(canvas.width / size) }, () => Math.random() * -50);
    let raf = 0;
    let last = 0;
    sfx.power();

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 45) return; // About 22 fps reads as more "retro".
      last = t;
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${size}px 'Geist Mono', monospace`;
      drops.forEach((row, col) => {
        const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!;
        ctx.fillStyle = Math.random() > 0.95 ? "#ffffff" : color;
        ctx.fillText(ch, col * size, row * size);
        drops[col] = row * size > canvas.height && Math.random() > 0.975 ? 0 : row + 1;
      });
    };
    raf = requestAnimationFrame(draw);

    const stop = () => setMatrix(false);
    const timer = setTimeout(stop, 9000);
    window.addEventListener("keydown", stop);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener("keydown", stop);
    };
  }, [on]);

  if (!on) return null;
  return (
    <div className="fixed inset-0 z-[100] cursor-pointer bg-black" onClick={() => setMatrix(false)} role="presentation">
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
      <p className="pointer-events-none absolute inset-x-0 bottom-10 text-center font-mono text-sm text-good">
        Konami code accepted. You found the secret. Click or press any key to return.
      </p>
    </div>
  );
}
