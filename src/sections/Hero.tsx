import { profile } from "../data/profile";
import { ParticleField } from "../components/ParticleField";
import { Typewriter } from "../components/Typewriter";
import { openItem } from "../lib/launcher";
import { openPalette } from "../components/CommandPalette";

/** A syntax-highlighted code card. Each token is a [text, className] pair. */
const CODE: [string, string][][] = [
  [["const ", "text-accent-2"], ["engineer", "text-accent"], [" = {", "text-text"]],
  [["  name: ", "text-muted"], [`"${profile.name}"`, "text-good"], [",", "text-text"]],
  [["  background: ", "text-muted"], ['"USMC"', "text-good"], [",", "text-text"]],
  [["  degree: ", "text-muted"], ['"B.S. Cybersecurity"', "text-good"], [",", "text-text"]],
  [["  stack: ", "text-muted"], ["[", "text-text"], ['"React"', "text-good"], [", ", "text-text"], ['"TS"', "text-good"], [", ", "text-text"], ['"HTML5"', "text-good"], ["],", "text-text"]],
  [["  openToWork: ", "text-muted"], ["true", "text-warn"], [",", "text-text"]],
  [["};", "text-text"]],
  [["", ""]],
  [["engineer", "text-accent"], [".", "text-text"], ["ship", "text-accent-2"], ["(", "text-text"], ["yourNextProject", "text-warn"], [");", "text-text"]],
];

export function Hero() {
  return (
    <section id="home" className="relative flex min-h-[100svh] items-center overflow-hidden pt-20">
      <ParticleField />
      <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
      {/* Soft glow blobs. */}
      <div className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-accent/20 blur-[120px]" aria-hidden />
      <div className="pointer-events-none absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-accent-2/20 blur-[120px]" aria-hidden />

      <div className="pointer-events-none relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="pointer-events-auto">
          <p className="chip mb-6 border-good/40 text-good">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-good" />
            </span>
            Available for software engineering roles
          </p>
          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
            Hi, I'm <span className="text-gradient">{profile.name}</span>.
          </h1>
          <p className="mt-4 font-mono text-xl text-muted sm:text-2xl" aria-live="off">
            <span className="text-accent">&gt;</span> <Typewriter words={profile.roles} />
          </p>
          <p className="mt-6 max-w-xl text-lg text-muted">{profile.tagline} This site is my resume you can play with.</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#arcade" className="btn btn-primary">🎮 Enter the arcade</a>
            <button className="btn btn-ghost" onClick={() => openItem("firewall")}>🛡️ Quick play</button>
            <a href="#contact" className="btn btn-ghost">✉️ Let's talk</a>
          </div>

          <p className="mt-8 font-mono text-xs text-muted">
            <span className="sm:hidden">Tap anywhere to send a shockwave</span>
            <span className="hidden sm:inline">
              Click anywhere to send a shockwave ·{" "}
              <button onClick={openPalette} className="underline decoration-dotted underline-offset-4 hover:text-accent">
                Ctrl + K
              </button>{" "}
              for commands
            </span>
          </p>
        </div>

        <div className="pointer-events-auto hidden animate-float lg:block" aria-hidden>
          <div className="panel overflow-hidden shadow-2xl shadow-accent-2/20">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="h-3 w-3 rounded-full bg-bad/80" />
              <span className="h-3 w-3 rounded-full bg-warn/80" />
              <span className="h-3 w-3 rounded-full bg-good/80" />
              <span className="ml-2 font-mono text-xs text-muted">engineer.ts</span>
            </div>
            <pre className="p-5 font-mono text-sm leading-7">
              {CODE.map((line, i) => (
                <div key={i}>
                  <span className="mr-4 inline-block w-4 text-right text-muted/50">{i + 1}</span>
                  {line.map(([text, cls], j) => (
                    <span key={j} className={cls}>{text}</span>
                  ))}
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>

      <a href="#about" className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-xs text-muted hover:text-accent" aria-label="Scroll to about section">
        <span className="block animate-bounce text-center text-lg">↓</span>
        scroll
      </a>
    </section>
  );
}
