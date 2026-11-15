import { Suspense, useEffect, useRef } from "react";
import { closeItem, useActiveItem } from "../lib/launcher";
import { findItem } from "../data/catalog";
import { registry } from "./registry";
import { SoundToggle } from "./SoundToggle";

/**
 * Hosts whichever game or app is open inside a native <dialog>.
 * showModal() gives us a focus trap, Escape to close, and an inert background for free.
 */
export function Launcher() {
  const activeId = useActiveItem();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const item = activeId ? findItem(activeId) : undefined;
  const Component = activeId ? registry[activeId] : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (item && !dialog.open) dialog.showModal();
    if (!item && dialog.open) dialog.close();
  }, [item]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void bodyRef.current?.requestFullscreen?.();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={closeItem}
      // A click directly on the dialog element (not its children) means the backdrop was clicked.
      onClick={(e) => e.target === e.currentTarget && closeItem()}
      className="m-auto w-[min(960px,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)] rounded-2xl border border-border bg-surface p-0 text-text shadow-2xl shadow-accent/20 backdrop:bg-transparent"
      aria-labelledby="launcher-title"
    >
      {item && Component && (
        <div className="flex flex-col">
          <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
            <span className="text-2xl" aria-hidden>{item.icon}</span>
            <div className="min-w-0 flex-1">
              <h2 id="launcher-title" className="truncate font-mono text-lg font-bold">{item.title}</h2>
              <p className="hidden truncate text-xs text-muted sm:block">{item.blurb}</p>
            </div>
            {item.kind === "game" && <SoundToggle />}
            {item.kind === "game" && (
              <button onClick={toggleFullscreen} className="chip hover:text-text" title="Toggle fullscreen">
                ⛶<span className="sr-only">Fullscreen</span>
              </button>
            )}
            <button onClick={closeItem} className="chip hover:border-bad hover:text-bad" aria-label="Close window">
              ✕ <span className="hidden sm:inline">ESC</span>
            </button>
          </header>

          <div ref={bodyRef} className="bg-surface p-4 sm:p-6 [&:fullscreen]:grid [&:fullscreen]:place-items-center">
            <Suspense
              fallback={
                <div className="grid h-72 place-items-center font-mono text-muted">
                  <span className="caret">Loading module</span>
                </div>
              }
            >
              <Component />
            </Suspense>
          </div>

          <footer className="border-t border-border px-4 py-3 sm:px-6">
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent">Under the hood</p>
            <div className="flex flex-wrap gap-2">
              {[...item.tech, ...item.highlights].map((t) => (
                <span key={t} className="chip">{t}</span>
              ))}
            </div>
          </footer>
        </div>
      )}
    </dialog>
  );
}
