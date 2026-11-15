/**
 * @file Skills: four plain columns, and a ticker of the browser APIs this site uses.
 */
import { skillCategories, skillsByCategory } from "../data/skills";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";
import { useInView } from "../hooks/useInView";

/** Native browser APIs used across this site. No game engine, no UI kit, no chart library. */
const WEB_APIS = [
  "WebGL2", "GLSL shaders", "Canvas 2D", "requestAnimationFrame", "Web Audio", "<dialog>", "Drag and Drop",
  "Web Crypto", "IntersectionObserver", "Clipboard", "Fullscreen", "Page Visibility", "Pointer Events",
  "Typed Arrays", "localStorage", "matchMedia",
];

export function Skills() {
  const [barsRef, barsVisible] = useInView<HTMLDivElement>({ threshold: 0.15 });

  return (
    <section id="skills" className="scroll-mt-20 py-28">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-10">
        <SectionHeading index="03" label="Skills" title="What I work with.">
          Honest numbers. The lower ones are the ones I am actively working on.
        </SectionHeading>

        <div ref={barsRef} className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {skillCategories.map((category, c) => (
            <Reveal key={category} delay={c * 70}>
              <h3 className="label mb-2 text-accent">{category}</h3>
              <ul>
                {/* O(1) lookup: the per-category lists were indexed once at module load. */}
                {skillsByCategory.get(category)!.map((skill, i) => (
                  <li key={skill.name} className="relative border-t border-border py-3" title={skill.note}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{skill.name}</span>
                      <span className="font-mono text-sm text-muted">{skill.level}</span>
                    </div>
                    {/* Animating transform (not width) stays on the GPU and causes no layout work. */}
                    <span
                      className="absolute inset-x-0 top-[-1px] h-px origin-left bg-text transition-transform duration-1000 ease-out"
                      style={{ transform: `scaleX(${barsVisible ? skill.level / 100 : 0})`, transitionDelay: `${c * 70 + i * 40}ms` }}
                      role="progressbar"
                      aria-valuenow={skill.level}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${skill.name} proficiency`}
                    />
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Ticker. The list is rendered twice so the loop is seamless. The copy is hidden from screen readers. */}
      <div className="mt-24 overflow-hidden border-y border-border py-5">
        <p className="sr-only">Browser APIs used on this site: {WEB_APIS.join(", ")}.</p>
        <div className="marquee" aria-hidden>
          {[0, 1].map((copy) => (
            <ul key={copy} className="flex shrink-0">
              {WEB_APIS.map((api) => (
                <li key={api} className="display flex items-center whitespace-nowrap text-3xl sm:text-5xl">
                  <span className="px-6">{api}</span>
                  <span className="h-2 w-2 bg-accent" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
