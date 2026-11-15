/**
 * @file Liquid, magnetic button.
 *
 * Two small effects, both driven by the pointer position:
 *  - Liquid fill: the hover color grows outward from the exact point where the pointer
 *    entered. The CSS lives in index.css (.btn). This component only feeds it the
 *    coordinates through the --x and --y custom properties.
 *  - Magnetic pull: the button leans a few pixels toward the cursor.
 *
 * Both are written straight to the DOM node's style, so moving the mouse over a button
 * never causes a React re-render.
 */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, PointerEvent, ReactNode } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";

/** How far the button travels toward the cursor, as a fraction of the pointer offset. */
const PULL = 0.22;

interface BaseProps {
  variant?: "primary" | "ghost";
  children: ReactNode;
  className?: string;
}
type AsButton = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type AsLink = BaseProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/** Renders an <a> when given `href`, otherwise a <button>. Both get the same effects. */
export function Button({ variant = "ghost", className = "", children, ...rest }: AsButton | AsLink) {
  const reduced = useReducedMotion();

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty("--x", `${x}px`);
    el.style.setProperty("--y", `${y}px`);
    // The magnetic pull only makes sense for a mouse, and is skipped for reduced motion.
    if (e.pointerType === "mouse" && !reduced) {
      el.style.transform = `translate(${(x - rect.width / 2) * PULL}px, ${(y - rect.height / 2) * PULL}px)`;
    }
  };

  const onPointerLeave = (e: PointerEvent<HTMLElement>) => {
    e.currentTarget.style.transform = "";
  };

  const shared = {
    className: `btn ${variant === "primary" ? "btn-primary" : ""} ${className}`,
    onPointerEnter: onPointerMove,
    onPointerMove,
    onPointerLeave,
  };

  if (rest.href !== undefined) {
    return (
      <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} {...shared}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} {...shared}>
      {children}
    </button>
  );
}
