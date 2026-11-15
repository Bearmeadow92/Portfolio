/**
 * @file Card with a pointer-following 3D tilt and spotlight glow.
 */
import { useRef, type ReactNode } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";

/**
 * 3D tilt that follows the pointer, plus a spotlight glow at the cursor position.
 * Styles are written straight to the DOM node, so moving the mouse never re-renders React.
 */
export function TiltCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || reduced || e.pointerType !== "mouse") return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * 8}deg) rotateY(${(px - 0.5) * 10}deg) translateY(-4px)`;
    el.style.setProperty("--spot-x", `${px * 100}%`);
    el.style.setProperty("--spot-y", `${py * 100}%`);
  };

  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`panel group relative overflow-hidden transition-[transform,border-color,box-shadow] duration-200 ease-out hover:border-accent/60 hover:shadow-[0_20px_50px_-20px_var(--accent)] ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(400px circle at var(--spot-x, 50%) var(--spot-y, 50%), color-mix(in srgb, var(--accent) 14%, transparent), transparent 60%)" }}
        aria-hidden
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
