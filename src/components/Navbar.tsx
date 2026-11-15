import { useEffect, useState } from "react";
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
  { id: "github", label: "GitHub" },
  { id: "contact", label: "Contact" },
] as const;

const IDS = ["home", ...LINKS.map((l) => l.id)];

export function Navbar() {
  const active = useActiveSection(IDS);
  const theme = useTheme();
  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Scroll progress, throttled to one update per animation frame.
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? window.scrollY / max : 0);
        setScrolled(window.scrollY > 20);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const nextTheme = () => applyTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-border bg-bg/75 backdrop-blur-lg" : ""}`}>
      <div className="h-0.5 origin-left bg-gradient-to-r from-accent to-accent-2" style={{ transform: `scaleX(${progress})` }} aria-hidden />
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
          <button onClick={openPalette} className="chip hidden hover:text-text sm:inline-flex" title="Open command palette">
            ⌘K
          </button>
          <button onClick={nextTheme} className="chip hover:text-text" title="Cycle theme">
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
