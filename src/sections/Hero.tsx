/**
 * @file Hero: the first screen. A statement, two actions, and the backdrop at full strength.
 *
 * The backdrop steps back behind the copy (its "clear zone", see shaders.ts), so the type
 * stays crisp without any overlay. The bottom row is a small instrument panel: the scene
 * tabs, and a live readout of the pointer position and frame rate that the WebGL engine
 * writes straight into the `data-telemetry` element.
 */
import type { CSSProperties } from "react";
import { profile } from "../data/profile";
import { Button } from "../components/Button";
import { SceneTabs } from "../components/SceneSwitcher";

export function Hero() {
  return (
    <section id="home" className="relative flex min-h-[100svh] flex-col px-5 pb-6 pt-28 sm:px-10">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-center">
        <p className="label mb-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
          <span>{profile.role}</span>
          <span aria-hidden>·</span>
          <span>{profile.focus}</span>
          <span aria-hidden>·</span>
          <span className="flex items-center gap-2 text-accent">
            <span className="blink h-1.5 w-1.5 bg-accent" aria-hidden />
            Open to work
          </span>
        </p>

        <h1 className="display text-[clamp(2.9rem,9.2vw,9.75rem)]">
          {profile.headline.map((line, i) => (
            <span key={line} className="rise">
              <span style={{ "--delay": `${0.08 + i * 0.1}s` } as CSSProperties}>{line}</span>
            </span>
          ))}
        </h1>

        <div className="mt-10 grid gap-8 md:grid-cols-[minmax(0,30rem)_1fr] md:items-end">
          <p className="text-lg leading-relaxed text-muted sm:text-xl">
            <span className="text-text">{profile.intro.split(".")[0]}.</span>
            {profile.intro.slice(profile.intro.indexOf(".") + 1)}
          </p>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <Button href="#work" variant="primary">
              See the work <span aria-hidden>↓</span>
            </Button>
            <Button href="#contact">Say hello</Button>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-14 grid w-full max-w-[1400px] gap-4 border-t border-border pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <SceneTabs />
        <p className="label hidden whitespace-pre text-muted sm:block" data-telemetry aria-hidden>
          X 0000  Y 0000   -- FPS
        </p>
      </div>
    </section>
  );
}
