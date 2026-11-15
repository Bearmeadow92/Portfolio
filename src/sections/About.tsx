import { profile } from "../data/profile";
import { timeline } from "../data/timeline";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";

export function About() {
  return (
    <section id="about" className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-28 sm:px-6">
      <SectionHeading index="01" kicker="about" title="From the Corps to the codebase">
        Discipline, curiosity, and a security-first mindset.
      </SectionHeading>

      <div className="grid gap-12 lg:grid-cols-2">
        <div className="space-y-5 text-lg leading-relaxed text-text/85">
          {profile.about.map((p, i) => (
            <Reveal key={i} delay={i * 100}>
              <p>{p}</p>
            </Reveal>
          ))}
          <Reveal delay={300}>
            <dl className="grid grid-cols-2 gap-3 pt-4">
              {profile.stats.map((s) => (
                <div key={s.label} className="panel panel-hover flex flex-col-reverse p-4">
                  <dt className="text-sm text-muted">{s.label}</dt>
                  <dd className="font-mono text-3xl font-bold text-gradient">{s.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        <ol className="relative space-y-6 border-l border-border pl-8">
          {timeline.map((t, i) => (
            <Reveal key={t.title} delay={i * 120}>
              <li className="relative">
                <span className="absolute -left-[49px] grid h-8 w-8 place-items-center rounded-full border border-accent bg-surface text-base shadow-[0_0_20px_-4px_var(--accent)]" aria-hidden>
                  {t.icon}
                </span>
                <div className="panel panel-hover p-5">
                  <p className="font-mono text-xs uppercase tracking-widest text-accent">{t.period}</p>
                  <h3 className="mt-1 text-xl font-semibold">{t.title}</h3>
                  <p className="text-sm text-muted">{t.org}</p>
                  <p className="mt-2 text-text/80">{t.detail}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
