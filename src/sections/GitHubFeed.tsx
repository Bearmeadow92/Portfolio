import { profile } from "../data/profile";
import { useGitHub } from "../hooks/useGitHub";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5", Java: "#b07219", Rust: "#dea584",
  "C++": "#f34b7d", C: "#555555", HTML: "#e34c26", CSS: "#563d7c", PowerShell: "#012456", Astro: "#ff5a03", Shell: "#89e051",
};

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function GitHubFeed() {
  const gh = useGitHub(profile.github);

  return (
    <section id="github" className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-28 sm:px-6">
      <SectionHeading index="06" kicker="github" title="Live from GitHub">
        Pulled straight from the GitHub REST API at runtime, so this is always current.
      </SectionHeading>

      {gh.status === "loading" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading repositories">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="panel h-40 animate-pulse p-5">
              <div className="h-4 w-1/2 rounded bg-border" />
              <div className="mt-4 h-3 w-full rounded bg-border/70" />
              <div className="mt-2 h-3 w-4/5 rounded bg-border/70" />
            </div>
          ))}
        </div>
      )}

      {gh.status === "error" && (
        <div className="panel p-6 text-center" role="alert">
          <p className="text-warn">⚠ {gh.message}</p>
          <a className="btn btn-ghost mt-4" href={profile.links.github} target="_blank" rel="noreferrer">
            View my GitHub directly ↗
          </a>
        </div>
      )}

      {gh.status === "ready" && (
        <>
          <Reveal>
            <a href={gh.user.html_url} target="_blank" rel="noreferrer" className="panel panel-hover mb-6 flex items-center gap-4 p-4">
              <img src={gh.user.avatar_url} alt="" width={56} height={56} className="h-14 w-14 rounded-full border border-border" loading="lazy" />
              <div className="flex-1">
                <p className="font-mono font-bold">@{gh.user.login}</p>
                {gh.user.bio && <p className="text-sm text-muted">{gh.user.bio}</p>}
              </div>
              <div className="hidden gap-6 text-center font-mono sm:flex">
                <div><div className="text-xl font-bold text-accent">{gh.user.public_repos}</div><div className="text-xs text-muted">repos</div></div>
                <div><div className="text-xl font-bold text-accent">{gh.user.followers}</div><div className="text-xs text-muted">followers</div></div>
              </div>
            </a>
          </Reveal>

          {gh.repos.length === 0 ? (
            <p className="text-muted">No public repositories yet. This portfolio is about to be the first! 🚀</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gh.repos.map((r, i) => (
                <Reveal key={r.id} delay={i * 70} className="h-full">
                  <a href={r.html_url} target="_blank" rel="noreferrer" className="panel panel-hover flex h-full flex-col p-5">
                    <h3 className="font-mono font-bold text-accent">{r.name}</h3>
                    <p className="mt-2 flex-1 text-sm text-muted">{r.description ?? "No description yet."}</p>
                    <div className="mt-4 flex items-center gap-4 font-mono text-xs text-muted">
                      {r.language && (
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: LANG_COLORS[r.language] ?? "var(--muted)" }} />
                          {r.language}
                        </span>
                      )}
                      <span>★ {r.stargazers_count}</span>
                      <span>⑂ {r.forks_count}</span>
                      <span className="ml-auto">{timeAgo(r.pushed_at)}</span>
                    </div>
                  </a>
                </Reveal>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
