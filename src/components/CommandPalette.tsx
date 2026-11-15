import { useEffect, useMemo, useRef, useState } from "react";
import { catalog } from "../data/catalog";
import { fuzzyScore } from "../lib/fuzzy";
import { THEMES, THEME_LABELS, applyTheme } from "../lib/theme";
import { openItem } from "../lib/launcher";
import { scrollToSection, setMatrix } from "../lib/effects";
import { getMuted, setMuted } from "../lib/sound";
import { SECTIONS } from "../terminal/commands";

interface PaletteAction {
  id: string;
  label: string;
  group: string;
  icon: string;
  run: () => void;
}

const capitalize = (s: string) => s[0]!.toUpperCase() + s.slice(1);

const ACTIONS: PaletteAction[] = [
  ...SECTIONS.map((s) => ({ id: `go-${s}`, label: `Go to ${capitalize(s)}`, group: "Navigate", icon: "→", run: () => scrollToSection(s) })),
  ...catalog.map((c) => ({ id: `open-${c.id}`, label: `${c.kind === "game" ? "Play" : "Open"} ${c.title}`, group: c.kind === "game" ? "Arcade" : "Toolkit", icon: c.icon, run: () => openItem(c.id) })),
  ...THEMES.map((t) => ({ id: `theme-${t}`, label: `Theme: ${THEME_LABELS[t]}`, group: "Appearance", icon: "🎨", run: () => applyTheme(t) })),
  { id: "sound", label: "Toggle sound effects", group: "Appearance", icon: "🔊", run: () => setMuted(!getMuted()) },
  { id: "matrix", label: "Enter the Matrix", group: "Secrets", icon: "🐇", run: () => setMatrix(true) },
];

/** Ctrl/Cmd + K quick launcher with fuzzy search and full keyboard navigation. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

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
      className="mx-auto mt-[12vh] w-[min(600px,calc(100vw-1.5rem))] rounded-2xl border border-border bg-surface p-0 text-text shadow-2xl shadow-accent/20"
      aria-label="Command palette"
    >
      {open && (
        <div onKeyDown={onKeyDown}>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <span className="font-mono text-accent">❯</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder="Search actions, games, apps, themes..."
              className="w-full bg-transparent py-4 outline-none placeholder:text-muted"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-list"
              aria-activedescendant={results[active] ? `pal-${results[active]!.id}` : undefined}
            />
            <kbd className="chip">ESC</kbd>
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
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${i === active ? "bg-accent/15 text-text" : "text-muted"}`}
              >
                <span className="w-6 text-center">{a.icon}</span>
                <span className="flex-1">{a.label}</span>
                <span className="font-mono text-xs text-muted">{a.group}</span>
              </li>
            ))}
            {results.length === 0 && <li className="px-3 py-6 text-center text-muted">No matches. Try "play" or "theme".</li>}
          </ul>
        </div>
      )}
    </dialog>
  );
}

/** Opens the palette from anywhere, such as a navbar button. */
export const openPalette = () => window.dispatchEvent(new Event("ngt:palette"));
