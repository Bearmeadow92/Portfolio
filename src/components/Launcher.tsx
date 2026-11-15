/**
 * @file Window host for games and apps, built on the native <dialog> element.
 */
import { Suspense, useEffect, useRef } from "react";
import { catalog, findItem } from "../data/catalog";
import { closeItem, useActiveItem } from "../lib/launcher";
import { registry } from "./registry";
import { SoundToggle } from "./SoundToggle";

/**
 * Hosts whichever game or app is open inside a native <dialog>.
 * showModal() provides a focus trap, Escape to close, and an inert background for free.
 * The component for the open item is lazy loaded, so its code is only downloaded on demand.
 *
 * Games render on the `.stage` palette (always dark), so their status colors stay
 * readable no matter which scene the rest of the site is using.
 */
export function Launcher() {
  const activeId = useActiveItem();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const item = activeId ? findItem(activeId) : undefined;
  const Component = activeId ? registry[activeId] : undefined;

  // Open or close the native dialog to match the launcher store.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (item && !dialog.open) dialog.showModal();
    if (!item && dialog.open) dialog.close();
  }, [item]);

  /** Fullscreen API: expands just the game area, not the whole page. */
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void bodyRef.current?.requestFullscreen?.();
  };

  const isGame = item?.kind === "game";

  return (
    <dialog
      ref={dialogRef}
      onClose={closeItem}
      // A click directly on the dialog element (not its children) means the backdrop was clicked.
      onClick={(e) => e.target === e.currentTarget && closeItem()}
      className={`m-auto max-h-[calc(100dvh-1.5rem)] w-[min(960px,calc(100vw-1.5rem))] border border-text bg-bg p-0 text-text ${isGame ? "stage !border-border" : ""}`}
      aria-labelledby="launcher-title"
    >
      {item && Component && (
        <div className="flex flex-col">
          <header className="sticky top-0 z-10 flex items-center gap-5 border-b border-border bg-bg px-5 py-4">
            <span className="label opacity-60">{String(catalog.indexOf(item) + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1">
              <h2 id="launcher-title" className="truncate font-display text-xl font-extrabold tracking-tight">
                {item.title}
              </h2>
            </div>
            {isGame && <SoundToggle />}
            {isGame && (
              <button onClick={toggleFullscreen} className="label hidden py-1 hover:text-accent sm:block">
                Fullscreen
              </button>
            )}
            <button onClick={closeItem} className="label py-1 hover:text-accent" aria-label="Close window">
              Close <span className="hidden opacity-60 sm:inline">Esc</span>
            </button>
          </header>

          <div ref={bodyRef} className="bg-bg p-4 sm:p-6 [&:fullscreen]:grid [&:fullscreen]:place-items-center">
            <Suspense fallback={<p className="label grid h-72 place-items-center opacity-60">Loading</p>}>
              <Component />
            </Suspense>
          </div>

          <footer className="border-t border-border px-5 py-4">
            <p className="mb-3 max-w-2xl text-sm text-muted">{item.blurb}</p>
            <div className="flex flex-wrap gap-1.5">
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
