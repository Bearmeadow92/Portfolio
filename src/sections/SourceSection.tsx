/**
 * @file "Source" section: this portfolio is its own featured project.
 *
 * Shows the repository's live language breakdown and latest commits, pulled from the
 * GitHub REST API at runtime. If the API is unreachable or rate limited, the static
 * parts of the section still render, so the page never shows an empty hole.
 */
import { profile } from "../data/profile";
import { useRepo } from "../hooks/useRepo";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";

/** GitHub's own colors for common languages. */
const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", CSS: "#663399", HTML: "#e34c26", Python: "#3572A5", Rust: "#dea584",
};

/** Engineering practices worth pointing out to someone skimming the repo. */
const PRACTICES = [
  { icon: "🧪", title: "Unit tested", body: "Pure game rules and utilities are covered by Vitest." },
  { icon: "🤖", title: "CI on every push", body: "GitHub Actions runs the type check, tests, and build." },
  { icon: "🔒", title: "Strict TypeScript", body: "Strict mode, plus unchecked index access turned on." },
  { icon: "🪶", title: "Two dependencies", body: "React and React DOM. Everything else is hand built." },
];

/** Formats an ISO date as a short relative time, such as "3d ago". */
function timeAgo(iso: string) {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (Number.isNaN(hours)) return "";
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function SourceSection() {
  const data = useRepo(profile.github, profile.repo);
  const repoUrl = `${profile.links.github}/${profile.repo}`;

  return (
    <section id="source" className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-28 sm:px-6">
      <SectionHeading index="06" kicker="source" title="Read the code">
        This whole site is open source. The stats below are pulled live from the GitHub API, so they are always current.
      </SectionHeading>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* min-w-0 lets grid items shrink below their content width, so long commit titles truncate instead of widening the page. */}
        <Reveal className="min-w-0">
          <div className="panel h-full p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="break-all font-mono text-xl font-bold text-accent">
                  {profile.github}/{profile.repo}
                </h3>
                <p className="mt-1 text-muted">
                  {data.status === "ready" && data.repo.description ? data.repo.description : "The source code for this portfolio."}
                </p>
              </div>
              <a href={repoUrl} target="_blank" rel="noreferrer" className="btn btn-primary !py-2">
                View source ↗
              </a>
            </div>

            {/* Language bar, GitHub style. */}
            <div className="mt-6" aria-busy={data.status === "loading"}>
              <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Languages</p>
              {data.status === "ready" && data.languages.length > 0 ? (
                <>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-border" role="img" aria-label={data.languages.map((l) => `${l.name} ${l.percent.toFixed(1)}%`).join(", ")}>
                    {data.languages.map((l) => (
                      <div key={l.name} style={{ width: `${l.percent}%`, background: LANG_COLORS[l.name] ?? "var(--muted)" }} />
                    ))}
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-muted">
                    {data.languages.map((l) => (
                      <li key={l.name} className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: LANG_COLORS[l.name] ?? "var(--muted)" }} />
                        {l.name} <span className="text-text">{l.percent.toFixed(1)}%</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className={`h-2.5 rounded-full bg-border ${data.status === "loading" ? "animate-pulse" : ""}`} />
              )}
            </div>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {PRACTICES.map((item) => (
                <li key={item.title} className="flex gap-3 rounded-xl border border-border bg-bg/40 p-3">
                  <span className="text-xl" aria-hidden>{item.icon}</span>
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-sm text-muted">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={120} className="min-w-0">
          <div className="panel h-full p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-mono text-sm uppercase tracking-widest text-accent">Latest commits</h3>
              {data.status === "ready" && <span className="font-mono text-xs text-muted">pushed {timeAgo(data.repo.pushed_at)}</span>}
            </div>

            {data.status === "loading" && (
              <ul className="space-y-3" aria-busy="true" aria-label="Loading commits">
                {Array.from({ length: 4 }, (_, i) => (
                  <li key={i} className="h-10 animate-pulse rounded-lg bg-border/60" />
                ))}
              </ul>
            )}

            {data.status === "error" && (
              <p className="text-sm text-warn" role="alert">
                ⚠ {data.message} The full history is always available on{" "}
                <a href={`${repoUrl}/commits`} target="_blank" rel="noreferrer" className="underline">
                  GitHub
                </a>
                .
              </p>
            )}

            {data.status === "ready" && (
              <ol className="space-y-1">
                {data.commits.map((c) => (
                  <li key={c.sha}>
                    <a href={c.url} target="_blank" rel="noreferrer" className="group flex items-baseline gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/10">
                      <code className="shrink-0 font-mono text-xs text-accent-2">{c.sha.slice(0, 7)}</code>
                      <span className="min-w-0 flex-1 truncate text-sm group-hover:text-accent">{c.title}</span>
                      <span className="shrink-0 font-mono text-xs text-muted">{timeAgo(c.date)}</span>
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
