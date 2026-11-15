/**
 * @file Per-game best score, persisted in localStorage.
 */
import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";

/** Per-game best score, persisted locally. `submit` returns true on a new record. */
export function useHighScore(gameId: string, lowerIsBetter = false) {
  const [best, setBest] = useLocalStorage<number | null>(`ngt:hs:${gameId}`, null);

  const submit = useCallback(
    (score: number) => {
      const isRecord = best === null || (lowerIsBetter ? score < best : score > best);
      if (isRecord) setBest(score);
      return isRecord;
    },
    [best, lowerIsBetter, setBest],
  );

  return { best, submit };
}
