/**
 * @file Hero: the first screen. A statement, two actions, and the backdrop at full strength.
 *
 * The headline uses `mix-blend-mode: difference`, so the generative art shows through
 * the letters in inverted color and the type always contrasts with whatever is behind it.
 */
import { profile } from "../data/profile";
import { Button } from "../components/Button";
import { SceneTabs } from "../components/SceneSwitcher";

export function Hero() {
  return (
    <section id="home" className="relative flex min-h-[100svh] flex-col justify-between px-5 pb-8 pt-28 sm:px-10">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-center">
        <p className="label mb-8 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>{profile.role}</span>
          <span className="opacity-40">/</span>
          <span>{profile.focus}</span>
          <span className="opacity-40">/</span>
          <span className="flex items-center gap-2 text-accent">
            <span className="blink h-1.5 w-1.5 bg-accent" aria-hidden />
            Open to work
          </span>
        </p>

        <h1 className="display whitespace-nowrap text-[clamp(2rem,8.4vw,9.25rem)] text-white mix-blend-difference">
          {profile.headline.map((line, i) => (
            <span key={line} className="rise">
              <span style={{ "--delay": `${0.1 + i * 0.12}s` } as React.CSSProperties}>{line}</span>
            </span>
          ))}
        </h1>

        <div className="mt-10 grid gap-8 md:grid-cols-[minmax(0,34rem)_1fr] md:items-end">
          <p className="text-xl leading-relaxed sm:text-2xl">{profile.intro}</p>
          <div className="flex flex-wrap gap-4 md:justify-end">
            <Button href="#work" variant="primary">
              See the work <span aria-hidden>↓</span>
            </Button>
            <Button href="#contact">Say hello</Button>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-14 flex w-full max-w-[1400px] flex-wrap items-end justify-between gap-6">
        <div>
          <p className="label mb-2 opacity-60">Background scene</p>
          <SceneTabs />
        </div>
        <p className="label hidden opacity-60 sm:block">Move your cursor. Click anywhere.</p>
      </div>
    </section>
  );
}
