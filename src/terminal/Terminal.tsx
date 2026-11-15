/**
 * @file Interactive terminal UI.
 *
 * This component only handles presentation and keyboard input. All command logic
 * lives in the pure `runCommand` function in commands.ts.
 */
import { useEffect, useRef, useState } from "react";
import { complete, runCommand, type Line, type Tone } from "./commands";
import { performAction } from "./actions";

/** Tailwind text color for each output tone. */
const TONE_CLASS: Record<Tone, string> = {
  text: "text-text/90",
  accent: "text-accent",
  muted: "text-muted",
  good: "text-good",
  bad: "text-bad",
  warn: "text-warn",
};

const WELCOME: Line[] = [
  { text: "NextGenOS ngt-sh 1.0  (type 'help' to get started)", tone: "accent" },
  { text: "Try: whoami · skills security · play firewall · theme matrix · sudo hire-jesse", tone: "muted" },
];

/** One block of scrollback: an optional echoed prompt plus its output lines. */
interface Entry {
  id: number;
  prompt?: string;
  lines: Line[];
}

/** A fully interactive in-browser shell with history, tab completion, and real side effects. */
export function Terminal() {
  const [entries, setEntries] = useState<Entry[]>([{ id: 0, lines: WELCOME }]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  // Keep the latest output in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  /** Runs the typed command, records it in history, and applies any side effect. */
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = input;
    const result = runCommand(value, { history });
    if (value.trim()) setHistory((h) => [...h.slice(-49), value.trim()]);
    setCursor(null);
    setInput("");

    if (result.action?.type === "clear") {
      setEntries([]);
      return;
    }
    // Scrollback is capped at 80 entries so memory and render cost stay bounded.
    setEntries((prev) => [...prev.slice(-80), { id: nextId.current++, prompt: value, lines: result.lines }]);
    if (result.action) performAction(result.action);
  };

  /** Shell style shortcuts: arrows for history, Tab to complete, Ctrl + L to clear. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" && history.length) {
      e.preventDefault();
      const idx = cursor === null ? history.length - 1 : Math.max(0, cursor - 1);
      setCursor(idx);
      setInput(history[idx]!);
    } else if (e.key === "ArrowDown" && cursor !== null) {
      e.preventDefault();
      const idx = cursor + 1;
      if (idx >= history.length) {
        setCursor(null);
        setInput("");
      } else {
        setCursor(idx);
        setInput(history[idx]!);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const options = complete(input);
      if (options.length === 1) setInput(options[0]! + " ");
      else if (options.length > 1) {
        setEntries((prev) => [...prev, { id: nextId.current++, prompt: input, lines: [{ text: options.join("   "), tone: "muted" }] }]);
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setEntries([]);
    }
  };

  return (
    <div className="panel overflow-hidden shadow-2xl shadow-accent/10" onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center gap-2 border-b border-border bg-surface-2/80 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-bad/80" />
        <span className="h-3 w-3 rounded-full bg-warn/80" />
        <span className="h-3 w-3 rounded-full bg-good/80" />
        <span className="ml-2 font-mono text-xs text-muted">jesse@nextgen: ~</span>
      </div>
      <div ref={scrollRef} className="h-[380px] overflow-y-auto p-4 font-mono text-[13px] leading-relaxed" role="log" aria-live="polite">
        {entries.map((entry) => (
          <div key={entry.id} className="mb-2">
            {entry.prompt !== undefined && (
              <div>
                <span className="text-good">jesse@nextgen</span>
                <span className="text-muted">:</span>
                <span className="text-accent">~</span>
                <span className="text-muted">$ </span>
                {entry.prompt}
              </div>
            )}
            {entry.lines.map((line, i) => (
              <div key={i} className={`whitespace-pre-wrap break-words ${TONE_CLASS[line.tone ?? "text"]}`}>
                {line.text || " "}
              </div>
            ))}
          </div>
        ))}
        <form onSubmit={submit} className="flex items-center">
          <label htmlFor="term-input" className="shrink-0">
            <span className="text-good">jesse@nextgen</span>
            <span className="text-muted">:</span>
            <span className="text-accent">~</span>
            <span className="text-muted">$&nbsp;</span>
          </label>
          <input
            id="term-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            className="min-w-0 flex-1 bg-transparent text-text caret-accent outline-none"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Terminal command input"
          />
        </form>
      </div>
    </div>
  );
}
