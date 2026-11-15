/**
 * @file React state that persists to localStorage.
 */
import { useCallback, useEffect, useState } from "react";

/**
 * useState that persists to localStorage.
 * Storage can throw (private mode, quota, blocked cookies), so every access is guarded
 * and the hook silently falls back to in-memory state.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable, keep in-memory value */
    }
  }, [key, value]);

  const reset = useCallback(() => setValue(initial), [initial]);
  return [value, setValue, reset] as const;
}
