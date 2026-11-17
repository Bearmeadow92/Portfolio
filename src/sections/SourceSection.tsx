/**
 * @file Source: this portfolio is its own featured project.
 *
 * Shows the repository's live language breakdown and latest commits, pulled from the
 * GitHub REST API at runtime. If the API is unreachable or rate limited, the static
 * parts of the section still render, so the page never shows an empty hole.
 */
import { profile } from "../data/profile";
import { useRepo } from "../hooks/useRepo";
import { Button } from "../components/Button";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";

/** Language bar segments use the scene palette (ranked by share), not per-language brand colors. */
const SEGMENT_CLASSES = ["bg-text", "bg-accent", "bg-muted", "bg-border"];

/** Engineering practices worth pointing out to someone skimming the repo. */
const PRACTICES = [
  { title: "Unit tested", body: "Game rules and utilities are pure functions covered by Vitest." },
  { title: "CI on every push", body: "GitHub Actions runs the type check, the tests, and the build." },
  { title: "Strict TypeScript", body: "Strict mode, with unchecked index access turned on." },
  { title: "Two dependencies", body: "React and React DOM. Everything else, shaders included, is hand written." },
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
    <section id="source" className="mx-auto max-w-[1400px] scroll-mt-20 px-5 py-28 sm:px-10">
      <SectionHeading index="05" label="Source" title="Read the code.">
        The whole site is open source. The numbers below come live from the GitHub API.
      </SectionHeading>

      {/* min-w-0 lets grid items shrink below their content width, so long commit titles truncate instead of widening the page. */}
      <div className="grid gap-x-16 gap-y-14 md:pl-[11rem] lg:grid-cols-2">
        <Reveal className="min-w-0">
          <a href={repoUrl} target="_blank" rel="noreferrer" className="link break-all font-display text-2xl font-medium tracking-tight sm:text-3xl">
            {profile.github}/{profile.repo}
          </a>

          <div className="mt-8" aria-busy={data.status === "loading"}>
            <p className="label mb-3 opacity-70">Languages</p>
            {data.status === "ready" && data.languages.length > 0 ? (
              <>
                <div className="flex h-2 gap-px" role="img" aria-label={data.languages.map((l) => `${l.name} ${l.percent.toFixed(1)}%`).join(", ")}>
                  {data.languages.map((l, i) => (
                    <div key={l.name} className={SEGMENT_CLASSES[Math.min(i, SEGMENT_CLASSES.length - 1)]} style={{ width: `${l.percent}%` }} />
                  ))}
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-sm text-muted">
                  {data.languages.map((l, i) => (
                    <li key={l.name} className="flex items-center gap-2">
                      <span className={`h-2 w-2 ${SEGMENT_CLASSES[Math.min(i, SEGMENT_CLASSES.length - 1)]}`} />
                      {l.name} <span className="text-text">{l.percent.toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className={`h-2 bg-border ${data.status === "loading" ? "animate-pulse" : ""}`} />
            )}
          </div>

          <ul className="mt-10 border-b border-border">
            {PRACTICES.map((item) => (
              <li key={item.title} className="grid gap-x-6 border-t border-border py-3.5 sm:grid-cols-[11rem_1fr]">
                <span className="font-medium">{item.title}</span>
                <span className="text-muted">{item.body}</span>
              </li>
            ))}
          </ul>

          <Button href={repoUrl} target="_blank" rel="noreferrer" className="mt-8">
            View on GitHub <span aria-hidden>↗</span>
          </Button>
        </Reveal>

        <Reveal delay={100} className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="label opacity-70">Latest commits</p>
            {data.status === "ready" && <p className="label opacity-60">Pushed {timeAgo(data.repo.pushed_at)}</p>}
          </div>

          {data.status === "loading" && (
            <ul aria-busy="true" aria-label="Loading commits">
              {Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="border-t border-border py-4">
                  <div className="h-4 animate-pulse bg-border" style={{ width: `${85 - i * 9}%` }} />
                </li>
              ))}
            </ul>
          )}

          {data.status === "error" && (
            <p className="border-t border-border py-4 text-warn" role="alert">
              {data.message} The full history is always on{" "}
              <a href={`${repoUrl}/commits`} target="_blank" rel="noreferrer" className="underline">
                GitHub
              </a>
              .
            </p>
          )}

          {data.status === "ready" && (
            <ol className="border-b border-border">
              {data.commits.map((commit) => (
                <li key={commit.sha}>
                  <a href={commit.url} target="_blank" rel="noreferrer" className="row grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-x-4 px-2 py-4">
                    <code className="font-mono text-sm opacity-70">{commit.sha.slice(0, 7)}</code>
                    <span className="min-w-0 truncate">{commit.title}</span>
                    <span className="label opacity-70">{timeAgo(commit.date)}</span>
                  </a>
                </li>
              ))}
            </ol>
          )}
        </Reveal>
      </div>
    </section>
  );
}
