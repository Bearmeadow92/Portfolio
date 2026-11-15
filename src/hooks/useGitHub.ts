import { useEffect, useState } from "react";

export interface Repo {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string;
  fork: boolean;
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
  html_url: string;
  public_repos: number;
  followers: number;
  bio: string | null;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; user: GitHubUser; repos: Repo[] };

const TTL_MS = 10 * 60 * 1000;

/**
 * Fetches a GitHub profile and its most recently pushed repos.
 * Results are cached in sessionStorage for 10 minutes because the unauthenticated
 * API allows only 60 requests per hour per IP. AbortController cancels on unmount.
 */
export function useGitHub(username: string): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const cacheKey = `ngt:gh:${username}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { at, user, repos } = JSON.parse(cached) as { at: number; user: GitHubUser; repos: Repo[] };
        if (Date.now() - at < TTL_MS) {
          setState({ status: "ready", user, repos });
          return;
        }
      }
    } catch {
      /* ignore bad cache */
    }

    const controller = new AbortController();
    const get = async <T,>(path: string): Promise<T> => {
      const res = await fetch(`https://api.github.com${path}`, {
        signal: controller.signal,
        headers: { Accept: "application/vnd.github+json" },
      });
      if (res.status === 403) throw new Error("GitHub rate limit reached. Try again in a bit.");
      if (!res.ok) throw new Error(`GitHub responded with ${res.status}.`);
      return res.json() as Promise<T>;
    };

    Promise.all([get<GitHubUser>(`/users/${username}`), get<Repo[]>(`/users/${username}/repos?sort=pushed&per_page=30`)])
      .then(([user, all]) => {
        const repos = all.filter((r) => !r.fork).slice(0, 6);
        setState({ status: "ready", user, repos });
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), user, repos }));
        } catch {
          /* ignore */
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: err instanceof Error ? err.message : "Could not reach GitHub." });
      });

    return () => controller.abort();
  }, [username]);

  return state;
}
