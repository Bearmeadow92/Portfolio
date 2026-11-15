/**
 * @file A ring that trails the mouse cursor and grows over anything clickable.
 *
 * The native cursor stays visible, so this is decoration, never the only pointer.
 * It is skipped entirely on touch devices and for users who prefer reduced motion.
 *
 * Performance: the ring is moved with a transform (compositor only, no layout), and
 * its animation loop runs only while the ring is still catching up to the cursor.
 * When the mouse rests, the loop stops and costs nothing.
 */
import { useEffect, useRef } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";

/** Elements that make the ring expand. */
const INTERACTIVE = "a, button, input, textarea, select, label, [role='option'], [role='tab']";

export function CursorRing() {
  const ringRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring || reduced || !window.matchMedia("(pointer: fine)").matches) return;

    let x = 0;
    let y = 0;
    let targetX = 0;
    let targetY = 0;
    let raf = 0;
    let running = false;

    const tick = () => {
      x += (targetX - x) * 0.18;
      y += (targetY - y) * 0.18;
      ring.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      // Stop once the ring has effectively caught up. The next mouse move restarts it.
      if (Math.abs(targetX - x) + Math.abs(targetY - y) < 0.2) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      targetX = e.clientX;
      targetY = e.clientY;
      if (ring.style.opacity !== "1") {
        // First movement: appear at the cursor instead of flying in from the corner.
        x = targetX;
        y = targetY;
        ring.style.opacity = "1";
      }
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    // Event delegation: one listener on the document instead of one per button.
    const onOver = (e: PointerEvent) => {
      ring.dataset.active = String(!!(e.target as Element | null)?.closest?.(INTERACTIVE));
    };
    const onLeave = () => {
      ring.style.opacity = "0";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced]);

  return (
    <div ref={ringRef} className="group pointer-events-none fixed left-0 top-0 z-[80] opacity-0 mix-blend-difference transition-opacity duration-300" aria-hidden>
      {/* The inner element handles size, so it can transition without fighting the transform above. */}
      <div className="-ml-4 -mt-4 h-8 w-8 rounded-full border border-white transition-transform duration-300 ease-out group-data-[active=true]:scale-[2.2] group-data-[active=true]:bg-white/20" />
    </div>
  );
}
