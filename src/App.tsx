import { useCallback, useState } from "react";
import { Navbar } from "./components/Navbar";
import { BootSequence } from "./components/BootSequence";
import { CommandPalette } from "./components/CommandPalette";
import { Launcher } from "./components/Launcher";
import { MatrixRain } from "./components/MatrixRain";
import { Hero } from "./sections/Hero";
import { About } from "./sections/About";
import { Skills } from "./sections/Skills";
import { Showcase } from "./sections/Showcase";
import { TerminalSection } from "./sections/TerminalSection";
import { GitHubFeed } from "./sections/GitHubFeed";
import { Contact } from "./sections/Contact";
import { Footer } from "./sections/Footer";
import { useKonami } from "./hooks/useKonami";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { setMatrix } from "./lib/effects";

/** Show the boot screen once per browser session, never for reduced motion users. */
function shouldBoot() {
  try {
    if (sessionStorage.getItem("ngt:booted")) return false;
    sessionStorage.setItem("ngt:booted", "1");
  } catch {
    /* storage blocked, still show it */
  }
  return true;
}

// Evaluated once at module load. A useState initializer would run twice under StrictMode.
const FIRST_VISIT_THIS_SESSION = shouldBoot();

export default function App() {
  const reduced = useReducedMotion();
  const [booting, setBooting] = useState(() => !reduced && FIRST_VISIT_THIS_SESSION);
  const finishBoot = useCallback(() => setBooting(false), []);
  useKonami(useCallback(() => setMatrix(true), []));

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-bg">
        Skip to content
      </a>
      {booting && <BootSequence onDone={finishBoot} />}
      <Navbar />
      <main id="main">
        <Hero />
        <About />
        <Skills />
        <Showcase kind="game" />
        <Showcase kind="app" />
        <TerminalSection />
        <GitHubFeed />
        <Contact />
      </main>
      <Footer />
      <Launcher />
      <CommandPalette />
      <MatrixRain />
    </>
  );
}
