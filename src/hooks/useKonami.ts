/**
 * @file Konami code detector (up, up, down, down, left, right, left, right, B, A).
 */
import { useEffect } from "react";

/** The key sequence, matched one key at a time. */
const SEQUENCE = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a",
];

/** Fires `onUnlock` when the classic up-up-down-down cheat code is typed. */
export function useKonami(onUnlock: () => void) {
  useEffect(() => {
    // Index of the next expected key. Matching is O(1) per key press.
    let progress = 0;
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === SEQUENCE[progress]) {
        progress += 1;
        if (progress === SEQUENCE.length) {
          progress = 0;
          onUnlock();
        }
      } else {
        // Restart, but allow the wrong key to be the start of a new attempt.
        progress = key === SEQUENCE[0] ? 1 : 0;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onUnlock]);
}
