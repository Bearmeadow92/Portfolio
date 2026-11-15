/**
 * Subsequence fuzzy matcher, similar in spirit to VS Code's quick open.
 * Returns a score (higher is better) or -1 for no match. O(n + m) single pass.
 * Consecutive matches and matches at word starts earn bonus points.
 */
export function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  if (!q) return 0;
  let score = 0;
  let qi = 0;
  let streak = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      const wordStart = ti === 0 || t[ti - 1] === " " || t[ti - 1] === "-";
      streak++;
      score += 1 + streak * 2 + (wordStart ? 6 : 0);
      qi++;
    } else {
      streak = 0;
    }
  }
  return qi === q.length ? score - t.length * 0.05 : -1;
}
