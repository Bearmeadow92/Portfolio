/**
 * @file Root component. Composes the page sections and mounts the global layers:
 * the generative backdrop, the cursor ring, the game and app launcher, the command
 * palette, and the Matrix rain easter egg.
 */
import { useCallback } from "react";
import { Backdrop } from "./art/Backdrop";
import { CommandPalette } from "./components/CommandPalette";
import { CursorRing } from "./components/CursorRing";
import { Launcher } from "./components/Launcher";
import { MatrixRain } from "./components/MatrixRain";
import { Navbar } from "./components/Navbar";
import { useKonami } from "./hooks/useKonami";
import { setMatrix } from "./lib/effects";
import { About } from "./sections/About";
import { Contact } from "./sections/Contact";
import { Footer } from "./sections/Footer";
import { Hero } from "./sections/Hero";
import { Skills } from "./sections/Skills";
import { TerminalSection } from "./sections/TerminalSection";
import { Work } from "./sections/Work";

export default function App() {
  useKonami(useCallback(() => setMatrix(true), []));

  return (
    <>
      <a href="#main" className="label sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-accent focus:px-4 focus:py-2 focus:text-bg">
        Skip to content
      </a>
      <Backdrop />
      <Navbar />
      <main id="main">
        <Hero />
        <Work />
        <About />
        <Skills />
        <TerminalSection />
        <Contact />
      </main>
      <Footer />
      <Launcher />
      <CommandPalette />
      <MatrixRain />
      <CursorRing />
    </>
  );
}
