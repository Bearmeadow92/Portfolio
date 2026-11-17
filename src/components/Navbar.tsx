/**
 * @file Fixed top navigation: section links with scrollspy, a scroll progress line,
 * the scene switcher, and a collapsible menu for small screens.
 */
import { useEffect, useRef, useState } from "react";
import { profile } from "../data/profile";
import { useActiveSection } from "../hooks/useActiveSection";
import { openPalette } from "./CommandPalette";
import { SceneButton } from "./SceneSwitcher";
import { SoundToggle } from "./SoundToggle";

const LINKS = [
  { id: "work", label: "Work" },
  { id: "about", label: "About" },
  { id: "skills", label: "Skills" },
  { id: "terminal", label: "Terminal" },
  { id: "source", label: "Source" },
  { id: "contact", label: "Contact" },
] as const;

/** Section ids watched by the scrollspy. Module level so the array identity is stable. */
const SECTION_IDS = ["home", ...LINKS.map((l) => l.id)];

export function Navbar() {
  const active = useActiveSection(SECTION_IDS);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  /**
   * Scroll handling, tuned to do as little work as possible:
   * - The listener is passive, so it can never block scrolling.
   * - Work is throttled to one update per animation frame.
   * - The progress line is updated by writing a transform directly to the DOM node.
   *   Using React state here would re-render the whole navbar on every scroll frame.
   * - `scrolled` is React state, but it only changes when crossing the threshold
   *   (React skips re-renders when the new value equals the old one).
   */
  useEffect(() => {
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? window.scrollY / max : 0;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress})`;
      setScrolled(window.scrollY > 40);
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

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${scrolled || menuOpen ? "border-b border-border bg-bg" : "border-b border-transparent"}`}>
      <nav className="mx-auto flex max-w-[1400px] items-center gap-6 px-5 py-4 sm:px-10" aria-label="Main">
        <a href="#home" className="font-display text-xl font-medium tracking-tight tracking-tight" aria-label={`${profile.name}, back to top`}>
          {profile.name}
          <span className="text-accent">.</span>
        </a>

        <ul className="ml-auto hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <li key={l.id}>
              <a href={`#${l.id}`} aria-current={active === l.id ? "true" : undefined} className={`label link py-1 ${active === l.id ? "text-accent" : ""}`}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-5 lg:ml-4 lg:border-l lg:border-border lg:pl-6">
          <SceneButton />
          <span className="hidden md:inline">
            <SoundToggle />
          </span>
          <button onClick={openPalette} className="label hidden py-1 hover:text-accent md:inline" title="Open the command palette">
            Ctrl K
          </button>
          <button className="label py-1 lg:hidden" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-controls="mobile-menu">
            {menuOpen ? "Close" : "Menu"}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <ul id="mobile-menu" className="border-t border-border px-5 py-3 lg:hidden">
          {LINKS.map((l, i) => (
            <li key={l.id}>
              <a href={`#${l.id}`} onClick={() => setMenuOpen(false)} className={`flex items-baseline gap-4 py-2.5 font-display text-2xl font-medium tracking-tight ${active === l.id ? "text-accent" : ""}`}>
                <span className="label w-6 opacity-60">0{i + 1}</span>
                {l.label}
              </a>
            </li>
          ))}
          <li className="mt-2 border-t border-border pt-3">
            <SoundToggle />
          </li>
        </ul>
      )}

      <div ref={progressRef} className="absolute inset-x-0 bottom-0 h-px origin-left bg-accent" style={{ transform: "scaleX(0)" }} aria-hidden />
    </header>
  );
}
