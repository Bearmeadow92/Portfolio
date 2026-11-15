/**
 * @file Data fetching hook for a single public GitHub repository.
 */
import { useEffect, useState } from "react";

export interface RepoInfo {
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string;
}

export interface CommitSummary {
  sha: string;
  /** First line of the commit message. */
  title: string;
  date: string;
  url: string;
}

export interface LanguageShare {
  name: string;
  /** Share of the codebase by bytes, from 0 to 100. */
  percent: number;
}

export type RepoState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; repo: RepoInfo; languages: LanguageShare[]; commits: CommitSummary[] };

/** Shape of the parts of GitHub's commit list response that this hook reads. */
interface ApiCommit {
  sha: string;
  html_url: string;
  commit: { message: string; author: { date: string } | null };
}

const TTL_MS = 10 * 60 * 1000;

/** Converts GitHub's `{ language: bytes }` map into sorted percentages. O(k log k) for k languages. */
export function toLanguageShares(bytes: Record<string, number>): LanguageShare[] {
  const total = Object.values(bytes).reduce((sum, n) => sum + n, 0);
  if (total === 0) return [];
  return Object.entries(bytes)
    .map(([name, n]) => ({ name, percent: (n / total) * 100 }))
    .sort((a, b) => b.percent - a.percent);
}

/**
 * Fetches a repository's details, language breakdown, and latest commits.
 *
 * - The three requests run in parallel with Promise.all, so the wait is the slowest
 *   request, not the sum of all three.
 * - Results are cached in sessionStorage for 10 minutes, because the unauthenticated
 *   GitHub API allows only 60 requests per hour per IP address.
 * - An AbortController cancels in-flight requests if the component unmounts.
 */
export function useRepo(owner: string, repo: string, commitCount = 5): RepoState {
  const [state, setState] = useState<RepoState>({ status: "loading" });

  useEffect(() => {
    const cacheKey = `ngt:repo:${owner}/${repo}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { at, data } = JSON.parse(cached) as { at: number; data: Omit<Extract<RepoState, { status: "ready" }>, "status"> };
        if (Date.now() - at < TTL_MS) {
          setState({ status: "ready", ...data });
          return;
        }
      }
    } catch {
      /* A corrupt cache entry is not worth failing over. Fall through and refetch. */
    }

    const controller = new AbortController();
    const base = `https://api.github.com/repos/${owner}/${repo}`;
    const get = async <T,>(path: string): Promise<T> => {
      const res = await fetch(base + path, { signal: controller.signal, headers: { Accept: "application/vnd.github+json" } });
      if (res.status === 403 || res.status === 429) throw new Error("GitHub rate limit reached. Try again in a bit.");
      if (!res.ok) throw new Error(`GitHub responded with ${res.status}.`);
      return res.json() as Promise<T>;
    };

    Promise.all([get<RepoInfo>(""), get<Record<string, number>>("/languages"), get<ApiCommit[]>(`/commits?per_page=${commitCount}`)])
      .then(([info, languageBytes, apiCommits]) => {
        const data = {
          repo: info,
          languages: toLanguageShares(languageBytes),
          commits: apiCommits.map((c) => ({
            sha: c.sha,
            title: c.commit.message.split("\n", 1)[0] ?? "",
            date: c.commit.author?.date ?? "",
            url: c.html_url,
          })),
        };
        setState({ status: "ready", ...data });
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data }));
        } catch {
          /* Storage full or blocked. The data still renders, it just is not cached. */
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: err instanceof Error ? err.message : "Could not reach GitHub." });
      });

    return () => controller.abort();
  }, [owner, repo, commitCount]);

  return state;
}
