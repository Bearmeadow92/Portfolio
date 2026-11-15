/**
 * @file Scroll reveal wrapper.
 */
import type { ReactNode } from "react";
import { useInView } from "../hooks/useInView";

/** Fades children in when they scroll into view. `delay` staggers groups of items. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.15 });
  return (
    <div ref={ref} className={`reveal ${inView ? "is-visible" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
