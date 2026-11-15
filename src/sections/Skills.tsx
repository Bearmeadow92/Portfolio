/**
 * @file Skills section: a filterable grid of skill cards, a radar chart of category
 * averages, and a list of the HTML5 APIs this site uses.
 */
import { useState } from "react";
import { categoryAverages, skillCategories, skills, skillsByCategory, type SkillCategory } from "../data/skills";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";
import { useInView } from "../hooks/useInView";

/** Native HTML5 and browser APIs used across this site, with where to find them. */
const WEB_APIS = [
  { api: "Canvas 2D", where: "Games, hero particles, Matrix rain" },
  { api: "requestAnimationFrame", where: "Every game loop" },
  { api: "Web Audio API", where: "Synthesized sound effects, zero audio files" },
  { api: "<dialog>", where: "Game windows and command palette" },
  { api: "Drag and Drop", where: "Mission Board Kanban" },
  { api: "Web Crypto", where: "Hashing and secure password generation" },
  { api: "IntersectionObserver", where: "Scroll reveals and scrollspy" },
  { api: "ResizeObserver", where: "Responsive hero canvas" },
  { api: "Clipboard API", where: "Copy buttons in the toolkit" },
  { api: "Fullscreen API", where: "Fullscreen game mode" },
  { api: "Page Visibility", where: "Auto pause games when you tab away" },
  { api: "Pointer Events", where: "Unified mouse, touch, and pen input" },
  { api: "Typed Arrays", where: "Allocation-free particle systems" },
  { api: "localStorage", where: "High scores, theme, Kanban tasks" },
  { api: "matchMedia", where: "Respecting prefers-reduced-motion" },
];

type Filter = SkillCategory | "All";
const FILTERS: readonly Filter[] = ["All", ...skillCategories];

export function Skills() {
  const [filter, setFilter] = useState<Filter>("All");
  const [barsRef, barsVisible] = useInView<HTMLDivElement>({ threshold: 0.1 });
  // O(1): the per-category lists were indexed once at module load (see data/skills.ts).
  const shown = filter === "All" ? skills : skillsByCategory.get(filter)!;

  return (
    <section id="skills" className="relative scroll-mt-20 py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading index="02" kicker="skills" title="The toolbox">
          Tools I reach for, and how well I can wield them. Filter by category.
        </SectionHeading>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter skills">
              {FILTERS.map((c) => (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  aria-pressed={filter === c}
                  className={`chip text-sm transition-colors ${filter === c ? "border-accent bg-accent/10 text-accent" : "hover:text-text"}`}
                >
                  {c}
                </button>
              ))}
            </div>

            <div ref={barsRef} className="grid gap-3 sm:grid-cols-2">
              {shown.map((s) => (
                <div key={s.name} className="panel panel-hover group p-4" tabIndex={0}>
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-semibold">{s.name}</h3>
                    <span className="font-mono text-xs text-muted">{s.level}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={s.level} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.name} proficiency`}>
                    {/* Animating transform (not width) keeps the animation on the GPU with no layout work. */}
                    <div
                      className="h-full origin-left rounded-full bg-gradient-to-r from-accent to-accent-2 transition-transform duration-1000 ease-out"
                      style={{ transform: `scaleX(${barsVisible ? s.level / 100 : 0})` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-muted transition-colors group-hover:text-text/80">{s.note}</p>
                </div>
              ))}
            </div>
          </div>

          <Reveal>
            <div className="panel sticky top-24 p-5">
              <h3 className="font-mono text-sm text-accent">Category radar</h3>
              <Radar />
            </div>
          </Reveal>
        </div>

        <Reveal className="mt-16">
          <h3 className="mb-1 text-2xl font-bold">HTML5 APIs powering this site</h3>
          <p className="mb-6 text-muted">No game engines and no UI kits. Just the web platform, used well.</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WEB_APIS.map((w) => (
              <li key={w.api} className="panel panel-hover flex items-start gap-3 p-4">
                <span className="mt-0.5 font-mono text-accent">✓</span>
                <div>
                  <p className="font-mono text-sm font-semibold">{w.api}</p>
                  <p className="text-sm text-muted">{w.where}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Radar chart                                */
/* -------------------------------------------------------------------------- */

const RADAR_SIZE = 260;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 90;

/** Position of axis `i` at a distance of `scale` (0 to 1) from the center. */
function radarPoint(i: number, scale: number) {
  const angle = (Math.PI * 2 * i) / categoryAverages.length - Math.PI / 2;
  return [RADAR_CENTER + Math.cos(angle) * RADAR_RADIUS * scale, RADAR_CENTER + Math.sin(angle) * RADAR_RADIUS * scale] as const;
}

/**
 * The radar's geometry never changes, so every polygon string is computed once at
 * module load. Rendering the chart is then pure string interpolation.
 */
const RADAR_RINGS = [0.25, 0.5, 0.75, 1].map((r) => categoryAverages.map((_, i) => radarPoint(i, r).join(",")).join(" "));
const RADAR_SHAPE = categoryAverages.map((d, i) => radarPoint(i, d.average / 100).join(",")).join(" ");
const RADAR_LABEL = `Average proficiency: ${categoryAverages.map((d) => `${d.category} ${Math.round(d.average)}%`).join(", ")}`;

/** Hand-rolled SVG radar chart of the average level per category. No chart library needed. */
function Radar() {
  return (
    <svg viewBox={`-36 -6 ${RADAR_SIZE + 72} ${RADAR_SIZE + 12}`} className="mx-auto mt-2 w-full max-w-[320px]" role="img" aria-label={RADAR_LABEL}>
      {RADAR_RINGS.map((points) => (
        <polygon key={points} points={points} fill="none" stroke="var(--border)" />
      ))}
      {categoryAverages.map((d, i) => {
        const [x, y] = radarPoint(i, 1);
        return <line key={d.category} x1={RADAR_CENTER} y1={RADAR_CENTER} x2={x} y2={y} stroke="var(--border)" />;
      })}
      <polygon points={RADAR_SHAPE} fill="color-mix(in srgb, var(--accent) 25%, transparent)" stroke="var(--accent)" strokeWidth={2} />
      {categoryAverages.map((d, i) => {
        const [x, y] = radarPoint(i, d.average / 100);
        const [lx, ly] = radarPoint(i, 1.22);
        return (
          <g key={d.category}>
            <circle cx={x} cy={y} r={4} fill="var(--accent-2)" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="var(--muted)" fontSize="11" fontFamily="JetBrains Mono, monospace">
              {d.category} {Math.round(d.average)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
