/**
 * @file About: who Jesse is, in as few words as possible.
 */
import { profile } from "../data/profile";
import { timeline } from "../data/timeline";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";

export function About() {
  return (
    <section id="about" className="mx-auto max-w-[1400px] scroll-mt-20 px-5 py-28 sm:px-10">
      <SectionHeading index="02" label="About" title="Learning out loud." />

      <div className="grid gap-x-4 gap-y-14 md:grid-cols-[10rem_1fr]">
        <div className="hidden md:block" aria-hidden />
        <div>
          <Reveal>
            <p className="max-w-4xl text-2xl leading-snug sm:text-[2rem] sm:leading-[1.25]">{profile.about.lead}</p>
          </Reveal>
          <Reveal className="mt-10 grid max-w-5xl gap-8 text-muted md:grid-cols-3" delay={80}>
            {profile.about.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </Reveal>
        </div>

        <p className="label pt-1 opacity-70">Path</p>
        <Reveal>
          <ol className="border-b border-border">
            {timeline.map((entry) => (
              <li key={entry.title} className="grid grid-cols-[6.5rem_1fr] items-baseline gap-x-6 border-t border-border py-4 sm:grid-cols-[9rem_1fr_1fr]">
                <span className="label opacity-70">{entry.period}</span>
                <span className="font-display text-xl font-medium tracking-tight">{entry.title}</span>
                <span className="col-start-2 text-muted sm:col-start-3">{entry.org}</span>
              </li>
            ))}
          </ol>
        </Reveal>

        <p className="label pt-1 opacity-70">Off the clock</p>
        <Reveal>
          <ul className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
            {profile.offTheClock.map((item, i) => (
              <li key={item.title} className="grid grid-cols-[2rem_1fr] gap-x-3">
                <span className="label pt-1.5 text-accent">0{i + 1}</span>
                <div>
                  <h3 className="font-display text-xl font-medium tracking-tight">{item.title}</h3>
                  <p className="mt-1 text-muted">{item.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
