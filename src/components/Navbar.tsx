/**
 * @file Fixed top navigation: section links with scrollspy, a scroll progress bar,
 * theme and sound toggles, and a collapsible menu for small screens.
 */
import { useEffect, useRef, useState } from "react";
import { profile } from "../data/profile";
import { useActiveSection } from "../hooks/useActiveSection";
import { THEMES, THEME_LABELS, applyTheme, useTheme } from "../lib/theme";
import { openPalette } from "./CommandPalette";
import { SoundToggle } from "./SoundToggle";

const LINKS = [
  { id: "about", label: "About" },
  { id: "skills", label: "Skills" },
  { id: "arcade", label: "Arcade" },
  { id: "toolkit", label: "Toolkit" },
  { id: "terminal", label: "Terminal" },
  { id: "source", label: "Source" },
  { id: "contact", label: "Contact" },
] as const;

/** Section ids watched by the scrollspy. Module level so the array identity is stable. */
const SECTION_IDS = ["home", ...LINKS.map((l) => l.id)];

export function Navbar() {
  const active = useActiveSection(SECTION_IDS);
  const theme = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  /**
   * Scroll handling, tuned to do as little work as possible:
   * - The listener is passive, so it can never block scrolling.
   * - Work is throttled to one update per animation frame.
   * - The progress bar is updated by writing a transform directly to the DOM node.
   *   Using React state here would re-render the whole navbar on every scroll frame.
   * - `scrolled` is React state, but it only changes when crossing the 20px threshold
   *   (React skips re-renders when the new value equals the old one).
   */
  useEffect(() => {
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? window.scrollY / max : 0;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress})`;
      setScrolled(window.scrollY > 20);
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /** Advances to the next theme, wrapping around at the end of the list. */
  const nextTheme = () => applyTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-border bg-bg/75 backdrop-blur-lg" : ""}`}>
      <div ref={progressRef} className="h-0.5 origin-left bg-gradient-to-r from-accent to-accent-2" style={{ transform: "scaleX(0)" }} aria-hidden />
      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6" aria-label="Main">
        <a href="#home" className="glitch font-mono text-lg font-bold" aria-label={`${profile.brand} home`}>
          <span className="text-accent">&lt;</span>NGT<span className="text-accent-2"> /&gt;</span>
        </a>

        <ul className="ml-auto hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.id}>
              <a
                href={`#${l.id}`}
                aria-current={active === l.id ? "true" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${active === l.id ? "bg-accent/10 text-accent" : "text-muted hover:text-text"}`}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2 lg:ml-2">
          <button onClick={openPalette} className="chip hidden hover:text-text sm:inline-flex" title="Open command palette (Ctrl + K)">
            ⌘K
          </button>
          <button onClick={nextTheme} className="chip hover:text-text" title="Cycle color theme">
            🎨 <span className="hidden sm:inline">{THEME_LABELS[theme]}</span>
          </button>
          <SoundToggle />
          <button
            className="chip lg:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label="Toggle menu"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <ul id="mobile-menu" className="mx-4 mb-3 grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface/95 p-3 backdrop-blur lg:hidden">
          {LINKS.map((l) => (
            <li key={l.id}>
              <a
                href={`#${l.id}`}
                onClick={() => setMenuOpen(false)}
                className={`block rounded-lg px-3 py-2 text-sm ${active === l.id ? "bg-accent/10 text-accent" : "text-muted"}`}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
