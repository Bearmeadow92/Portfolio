/**
 * @file Shared menu, pause, and game over screens for the canvas games.
 *
 * The overlay is plain React and DOM (not canvas), so its buttons are real, focusable,
 * screen reader friendly controls.
 */
import type { ReactNode } from "react";

/**
 * Lifecycle of a game session.
 * `intermission` is a game-owned screen (for example an upgrade picker), so the shared
 * overlay stays out of the way during it.
 */
export type Phase = "menu" | "playing" | "paused" | "intermission" | "over";

interface Props {
  phase: Phase;
  title: string;
  tagline: string;
  /** One line per control hint, shown on the menu screen. */
  controls: string[];
  /** Final score, shown on the game over screen. */
  score?: number;
  scoreLabel?: string;
  /** Saved personal best, or null if this is the first run. */
  best: number | null;
  isRecord?: boolean;
  onStart: () => void;
  onResume: () => void;
  /** Extra game over content, such as run statistics. */
  children?: ReactNode;
}

/** Menu, pause, and game over screen layered on top of a game canvas. */
export function GameOverlay({ phase, title, tagline, controls, score, scoreLabel = "Score", best, isRecord, onStart, onResume, children }: Props) {
  if (phase === "playing" || phase === "intermission") return null;

  return (
    <div className="absolute inset-0 grid place-items-center bg-bg/75 backdrop-blur-sm p-4 text-center">
      <div className="max-w-md">
        {phase === "menu" && (
          <>
            <h3 className="font-mono text-3xl font-bold text-gradient">{title}</h3>
            <p className="mt-2 text-muted">{tagline}</p>
            <ul className="mt-4 space-y-1 font-mono text-sm text-text/90">
              {controls.map((c) => (
                <li key={c}>
                  <span className="text-accent">›</span> {c}
                </li>
              ))}
            </ul>
            <button className="btn btn-primary mt-6" onClick={onStart} autoFocus>
              ▶ Start game
            </button>
          </>
        )}

        {phase === "paused" && (
          <>
            <h3 className="font-mono text-3xl font-bold text-accent">PAUSED</h3>
            <p className="mt-2 text-muted">Take a breather. The bugs will wait.</p>
            <div className="mt-6 flex justify-center gap-3">
              <button className="btn btn-primary" onClick={onResume} autoFocus>
                Resume
              </button>
              <button className="btn btn-ghost" onClick={onStart}>
                Restart
              </button>
            </div>
          </>
        )}

        {phase === "over" && (
          <>
            <h3 className="font-mono text-3xl font-bold text-gradient">{isRecord ? "NEW RECORD!" : "GAME OVER"}</h3>
            <p className="mt-4 font-mono text-5xl font-bold">{score?.toLocaleString()}</p>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">{scoreLabel}</p>
            {best !== null && <p className="mt-2 font-mono text-sm text-muted">Personal best: {best.toLocaleString()}</p>}
            {children}
            <button className="btn btn-primary mt-6" onClick={onStart} autoFocus>
              ↻ Play again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
