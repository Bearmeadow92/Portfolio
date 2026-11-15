import { useMemo, useState } from "react";
import { skillCategories, skills, type SkillCategory } from "../data/skills";
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
  { api: "localStorage", where: "High scores, theme, Kanban tasks" },
  { api: "matchMedia", where: "Respecting prefers-reduced-motion" },
];

type Filter = SkillCategory | "All";

export function Skills() {
  const [filter, setFilter] = useState<Filter>("All");
  const [barsRef, barsVisible] = useInView<HTMLDivElement>({ threshold: 0.1 });
  const shown = useMemo(() => (filter === "All" ? skills : skills.filter((s) => s.category === filter)), [filter]);

  return (
    <section id="skills" className="relative scroll-mt-20 py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading index="02" kicker="skills" title="The loadout">
          Tools I reach for, and how well I can wield them. Filter by category.
        </SectionHeading>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter skills">
              {(["All", ...skillCategories] as Filter[]).map((c) => (
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
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-1000 ease-out"
                      style={{ width: barsVisible ? `${s.level}%` : "0%" }}
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

/** Hand-rolled SVG radar chart of the average level per category. */
function Radar() {
  const size = 260;
  const c = size / 2;
  const radius = 90;
  const data = skillCategories.map((cat) => {
    const list = skills.filter((s) => s.category === cat);
    return { cat, value: list.reduce((sum, s) => sum + s.level, 0) / list.length };
  });

  const point = (i: number, scale: number) => {
    const angle = (Math.PI * 2 * i) / data.length - Math.PI / 2;
    return [c + Math.cos(angle) * radius * scale, c + Math.sin(angle) * radius * scale] as const;
  };
  const polygon = data.map((d, i) => point(i, d.value / 100).join(",")).join(" ");

  return (
    <svg viewBox={`-36 -6 ${size + 72} ${size + 12}`} className="mx-auto mt-2 w-full max-w-[320px]" role="img" aria-label={`Average proficiency: ${data.map((d) => `${d.cat} ${Math.round(d.value)}%`).join(", ")}`}>
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <polygon key={r} points={data.map((_, i) => point(i, r).join(",")).join(" ")} fill="none" stroke="var(--border)" />
      ))}
      {data.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--border)" />;
      })}
      <polygon points={polygon} fill="color-mix(in srgb, var(--accent) 25%, transparent)" stroke="var(--accent)" strokeWidth={2} />
      {data.map((d, i) => {
        const [x, y] = point(i, d.value / 100);
        const [lx, ly] = point(i, 1.22);
        return (
          <g key={d.cat}>
            <circle cx={x} cy={y} r={4} fill="var(--accent-2)" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="var(--muted)" fontSize="11" fontFamily="JetBrains Mono, monospace">
              {d.cat} {Math.round(d.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
