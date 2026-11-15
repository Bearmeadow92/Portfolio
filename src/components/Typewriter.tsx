/**
 * @file Typewriter text effect for the hero.
 */
import { useEffect, useState } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";

/** Types, pauses, deletes, and cycles through a list of words. */
export function Typewriter({ words, typeMs = 70, holdMs = 1600 }: { words: readonly string[]; typeMs?: number; holdMs?: number }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const word = words[index % words.length]!;
    let delay = deleting ? typeMs / 2 : typeMs;
    if (!deleting && text === word) delay = holdMs;

    const id = setTimeout(() => {
      if (!deleting && text === word) setDeleting(true);
      else if (deleting && text === "") {
        setDeleting(false);
        setIndex((i) => i + 1);
      } else setText(word.slice(0, text.length + (deleting ? -1 : 1)));
    }, delay);
    return () => clearTimeout(id);
  }, [text, deleting, index, words, typeMs, holdMs, reduced]);

  return <span className="caret">{reduced ? words[0] : text}</span>;
}
