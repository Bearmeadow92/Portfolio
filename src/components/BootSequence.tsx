/**
 * @file Terminal style boot screen shown on the first visit of a session.
 */
import { useEffect, useState } from "react";

/** Boot log lines, revealed one at a time. */
const LINES = [
  "[ OK ] Initializing NextGenOS kernel v1.0",
  "[ OK ] Mounting /dev/creativity",
  "[ OK ] Loading React 19 runtime",
  "[ OK ] Calibrating HTML5 canvas",
  "[ OK ] Arming firewall",
  "[ OK ] Brewing coffee",
  "[ OK ] Sharpening pixels",
  ">> Welcome. Systems online.",
];

/**
 * A quick terminal style boot screen. Shown once per browser session, skippable with any
 * key or click, and skipped entirely for users who prefer reduced motion.
 */
export function BootSequence({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(0);
  const [leaving, setLeaving] = useState(false);

  // Reveal the next line, or start the fade out once every line is shown.
  useEffect(() => {
    if (count < LINES.length) {
      const id = setTimeout(() => setCount((c) => c + 1), 170);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setLeaving(true), 350);
    return () => clearTimeout(id);
  }, [count]);

  // Wait for the fade out transition before unmounting.
  useEffect(() => {
    if (!leaving) return;
    const id = setTimeout(onDone, 450);
    return () => clearTimeout(id);
  }, [leaving, onDone]);

  // Any key skips the intro.
  useEffect(() => {
    const skip = () => setLeaving(true);
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, []);

  const progress = Math.round((count / LINES.length) * 100);

  return (
    <div
      className={`fixed inset-0 z-[90] grid place-items-center bg-bg px-6 transition-opacity duration-500 ${leaving ? "pointer-events-none opacity-0" : "opacity-100"}`}
      onClick={() => setLeaving(true)}
      role="status"
      aria-label="Loading portfolio"
    >
      <div className="w-full max-w-lg font-mono text-sm">
        <div className="mb-6 text-2xl font-bold text-gradient">&lt;NGT /&gt;</div>
        {LINES.slice(0, count).map((line) => (
          <div key={line} className={line.startsWith(">>") ? "mt-2 text-accent" : "text-muted"}>
            {line.startsWith("[ OK ]") ? (
              <>
                <span className="text-good">[ OK ]</span>
                {line.slice(6)}
              </>
            ) : (
              line
            )}
          </div>
        ))}
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-border">
          <div className="h-full bg-gradient-to-r from-accent to-accent-2 transition-all duration-150" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 text-xs text-muted">Press any key to skip</p>
      </div>
    </div>
  );
}
