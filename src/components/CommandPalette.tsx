/**
 * @file Ctrl/Cmd + K command palette with fuzzy search.
 *
 * Ranking cost is O(a * L) per keystroke for a actions with labels of length L
 * (about 25 short strings), which is far below one millisecond.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { catalog } from "../data/catalog";
import { fuzzyScore } from "../lib/fuzzy";
import { SCENES, applyScene } from "../lib/scene";
import { openItem } from "../lib/launcher";
import { scrollToSection, setMatrix } from "../lib/effects";
import { getMuted, setMuted } from "../lib/sound";
import { SECTIONS } from "../terminal/commands";

interface PaletteAction {
  id: string;
  /** Text shown in the list and matched by the fuzzy search. */
  label: string;
  /** Category shown on the right, also searchable. */
  group: string;
  run: () => void;
}

const capitalize = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** Every action, built once at module load from the catalog, sections, and scenes. */
const ACTIONS: PaletteAction[] = [
  ...SECTIONS.map((s) => ({ id: `go-${s}`, label: `Go to ${capitalize(s)}`, group: "Navigate", run: () => scrollToSection(s) })),
  ...catalog.map((c) => ({ id: `open-${c.id}`, label: `${c.kind === "game" ? "Play" : "Open"} ${c.title}`, group: c.kind === "game" ? "Games" : "Tools", run: () => openItem(c.id) })),
  ...SCENES.map((s) => ({ id: `scene-${s.id}`, label: `Scene: ${s.name}`, group: "Background", run: () => applyScene(s.id) })),
  { id: "sound", label: "Toggle sound effects", group: "Settings", run: () => setMuted(!getMuted()) },
  { id: "matrix", label: "Enter the Matrix", group: "Secrets", run: () => setMatrix(true) },
];

/** Ctrl/Cmd + K quick launcher with fuzzy search and full keyboard navigation. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Global shortcut, plus a custom event so other components can open the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("ngt:palette", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("ngt:palette", onOpenEvent);
    };
  }, []);

  // Keep the native dialog in sync with React state.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      setQuery("");
      setActive(0);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  // Rank by fuzzy score; with an empty query keep the natural order.
  const results = useMemo(() => {
    if (!query.trim()) return ACTIONS;
    return ACTIONS.map((a) => ({ a, s: Math.max(fuzzyScore(query, a.label), fuzzyScore(query, a.group) - 4) }))
      .filter((r) => r.s >= 0)
      .sort((x, y) => y.s - x.s)
      .map((r) => r.a);
  }, [query]);

  // Keep the highlighted row visible while arrowing through a long list.
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (action?: PaletteAction) => {
    if (!action) return;
    setOpen(false);
    // Let the palette close before the action (which may open another dialog).
    requestAnimationFrame(action.run);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(results.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % Math.max(results.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(results[active]);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={() => setOpen(false)}
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      className="mx-auto mt-[12vh] w-[min(600px,calc(100vw-1.5rem))] border border-text bg-bg p-0 text-text"
      aria-label="Command palette"
    >
      {open && (
        <div onKeyDown={onKeyDown}>
          <div className="flex items-center gap-3 border-b border-border px-5">
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder="Search tools, games, scenes, sections"
              className="w-full bg-transparent py-4 text-lg outline-none placeholder:text-muted"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-list"
              aria-activedescendant={results[active] ? `pal-${results[active]!.id}` : undefined}
            />
            <kbd className="label opacity-60">Esc</kbd>
          </div>
          <ul id="palette-list" ref={listRef} role="listbox" className="max-h-80 overflow-y-auto p-2">
            {results.map((a, i) => (
              <li
                key={a.id}
                id={`pal-${a.id}`}
                data-index={i}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => run(a)}
                className={`flex cursor-pointer items-baseline gap-3 px-3 py-2.5 ${i === active ? "bg-text text-bg" : ""}`}
              >
                <span className="flex-1">{a.label}</span>
                <span className="label opacity-60">{a.group}</span>
              </li>
            ))}
            {results.length === 0 && <li className="px-3 py-6 text-center text-muted">No matches. Try "play" or "scene".</li>}
          </ul>
        </div>
      )}
    </dialog>
  );
}

/** Opens the palette from anywhere, such as a navbar button. */
export const openPalette = () => window.dispatchEvent(new Event("ngt:palette"));
