/**
 * @file Password Lab: strength analyzer and secure generator.
 * All logic lives in lib/password.ts. This file is the UI.
 */
import { useMemo, useState } from "react";
import { analyzePassword, generatePassword, type CharsetKey } from "../lib/password";
import { CopyButton } from "../components/CopyButton";

/** Button labels for each character set toggle. */
const SET_LABELS: Record<CharsetKey, string> = { lower: "a-z", upper: "A-Z", digits: "0-9", symbols: "!@#" };
/** Strength meter color for each score from 0 to 4. */
const BAR_COLORS = ["bg-bad", "bg-bad", "bg-warn", "bg-good", "bg-accent"];

/** Password strength analyzer and cryptographically secure generator. Nothing leaves the browser. */
export default function PasswordLab() {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [length, setLength] = useState(18);
  const [sets, setSets] = useState<CharsetKey[]>(["lower", "upper", "digits", "symbols"]);

  // Analysis is O(n) in password length, and memoized so it only reruns when the input changes.
  const report = useMemo(() => analyzePassword(password), [password]);

  /** Adds or removes a character set from the generator options. */
  const toggleSet = (key: CharsetKey) =>
    setSets((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="pw-input" className="mb-1 block text-sm text-muted">
          Test a password
        </label>
        <div className="flex gap-2">
          <input
            id="pw-input"
            className="input"
            type={visible ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Type or generate a password"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="chip hover:text-text" onClick={() => setVisible((v) => !v)} aria-pressed={visible}>
            {visible ? "Hide" : "Show"}
          </button>
          <CopyButton text={password} />
        </div>
      </div>

      <div>
        <div className="flex gap-1" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-2 flex-1 transition-colors duration-300 ${password && i <= report.score ? BAR_COLORS[report.score] : "bg-border"}`} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center font-mono text-xs">
          <div className="panel p-2">
            <div className="text-base text-text">{report.label}</div>strength
          </div>
          <div className="panel p-2">
            <div className="text-base text-text">{report.entropy} bits</div>entropy
          </div>
          <div className="panel p-2">
            <div className="truncate text-base text-text" title={report.crackTime}>{report.crackTime}</div>to crack
          </div>
        </div>
        <ul className="mt-3 space-y-1 text-sm text-muted" aria-live="polite">
          {report.feedback.slice(0, 4).map((f) => (
            <li key={f}>
              <span className="text-accent">›</span> {f}
            </li>
          ))}
        </ul>
      </div>

      <fieldset className="panel space-y-3 p-4">
        <legend className="px-1 font-mono text-sm text-accent">Secure generator</legend>
        <div className="flex items-center gap-3">
          <label htmlFor="pw-length" className="text-sm text-muted">Length</label>
          <input id="pw-length" type="range" min={8} max={64} value={length} onChange={(e) => setLength(Number(e.target.value))} className="flex-1 accent-[var(--accent)]" />
          <span className="w-8 text-right font-mono">{length}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SET_LABELS) as CharsetKey[]).map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => toggleSet(k)}
              aria-pressed={sets.includes(k)}
              className={`chip ${sets.includes(k) ? "border-accent text-accent" : ""}`}
            >
              {SET_LABELS[k]}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-primary w-full" onClick={() => setPassword(generatePassword(length, sets))}>
          Generate with crypto.getRandomValues()
        </button>
      </fieldset>
      <p className="text-xs text-muted">Crack time assumes an offline attack at 10 billion guesses per second.</p>
    </div>
  );
}
