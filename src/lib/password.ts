/**
 * @file Password analysis and generation.
 * Entropy is estimated as length * log2(poolSize), then penalized for common weaknesses.
 * Generation uses crypto.getRandomValues with rejection sampling, so there is no modulo bias.
 */

export const CHARSETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.<>?/~",
} as const;

export type CharsetKey = keyof typeof CHARSETS;

/** Symbol lookup as a Set, so classifying a character is O(1) instead of scanning a string. */
const SYMBOL_SET: ReadonlySet<string> = new Set([...CHARSETS.symbols, " "]);

/** A small sample of the most breached passwords. Set membership is O(1). */
const COMMON = new Set([
  "password", "123456", "12345678", "qwerty", "letmein", "admin", "welcome",
  "iloveyou", "monkey", "dragon", "football", "baseball", "abc123", "111111",
  "passw0rd", "letmein1", "trustno1", "sunshine", "master", "login",
]);

export interface PasswordReport {
  /** Estimated entropy in bits, after penalties. */
  entropy: number;
  /** 0 (very weak) to 4 (excellent). Drives the strength meter. */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  /** Human readable brute force estimate. */
  crackTime: string;
  /** Actionable tips, most important first. */
  feedback: string[];
}

/** Size of the character pool a password draws from. O(n) single pass. */
export function poolSize(pw: string): number {
  let lower = false, upper = false, digit = false, symbol = false, other = false;
  for (const ch of pw) {
    if (ch >= "a" && ch <= "z") lower = true;
    else if (ch >= "A" && ch <= "Z") upper = true;
    else if (ch >= "0" && ch <= "9") digit = true;
    else if (SYMBOL_SET.has(ch)) symbol = true;
    else other = true;
  }
  return (lower ? 26 : 0) + (upper ? 26 : 0) + (digit ? 10 : 0) + (symbol ? 33 : 0) + (other ? 100 : 0);
}

/** Human readable time to brute force, assuming 10 billion guesses per second (offline GPU attack). */
export function formatCrackTime(entropyBits: number): string {
  const guessesPerSecond = 1e10;
  // Average case is half the keyspace.
  const seconds = Math.pow(2, entropyBits - 1) / guessesPerSecond;
  if (seconds < 1) return "instantly";
  const units: [string, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 365],
    ["year", 1000],
    ["thousand years", 1000],
    ["million years", 1000],
    ["billion years", Infinity],
  ];
  let value = seconds;
  for (const [unit, next] of units) {
    if (value < next) {
      const n = Math.round(value);
      return `${n.toLocaleString()} ${unit}${n === 1 || unit.includes(" ") ? "" : "s"}`;
    }
    value /= next;
  }
  return "longer than the universe has existed";
}

/**
 * Scores a password and explains how to improve it. O(n) in the password length.
 * Runs entirely in the browser. The password is never stored or sent anywhere.
 */
export function analyzePassword(pw: string): PasswordReport {
  const feedback: string[] = [];
  if (!pw) {
    return { entropy: 0, score: 0, label: "Empty", crackTime: "instantly", feedback: ["Type a password to analyze it. Nothing leaves your browser."] };
  }

  let entropy = pw.length * Math.log2(Math.max(poolSize(pw), 1));

  if (COMMON.has(pw.toLowerCase())) {
    entropy = Math.min(entropy, 5);
    feedback.push("This is on common password lists. Attackers try these first.");
  }
  if (/(.)\1{2,}/.test(pw)) {
    entropy *= 0.8;
    feedback.push("Avoid repeated characters like 'aaa'.");
  }
  if (/(?:abc|bcd|cde|123|234|345|456|567|678|789|qwe|wer|asd)/i.test(pw)) {
    entropy *= 0.85;
    feedback.push("Avoid predictable sequences like '123' or 'qwe'.");
  }
  if (pw.length < 12) feedback.push("Length is king. Aim for 14 or more characters.");
  if (!/[A-Z]/.test(pw)) feedback.push("Add uppercase letters to widen the character pool.");
  if (!/\d/.test(pw)) feedback.push("Add some digits.");
  if (!/[^A-Za-z0-9]/.test(pw)) feedback.push("Add symbols for a big entropy boost.");

  const score: PasswordReport["score"] = entropy < 28 ? 0 : entropy < 40 ? 1 : entropy < 60 ? 2 : entropy < 80 ? 3 : 4;
  const label = ["Very weak", "Weak", "Fair", "Strong", "Fortress"][score]!;
  if (score === 4) feedback.unshift("Excellent. This would take serious hardware a very long time.");

  return { entropy: Math.round(entropy), score, label, crackTime: formatCrackTime(entropy), feedback };
}

/**
 * Unbiased random integer in [0, max) from the cryptographic RNG.
 *
 * `random % max` is slightly biased toward small numbers whenever 2^32 is not a
 * multiple of `max`. Rejection sampling fixes that by discarding the few values that
 * fall in the uneven tail. Expected iterations: fewer than 2.
 */
function secureRandomInt(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0]!;
  } while (x >= limit);
  return x % max;
}

/**
 * Generates a random password of `length` characters drawn from the chosen sets,
 * guaranteeing at least one character from each set. O(n).
 */
export function generatePassword(length: number, sets: CharsetKey[]): string {
  const active = sets.length ? sets : (["lower"] as CharsetKey[]);
  const pool = active.map((k) => CHARSETS[k]).join("");
  // Guarantee at least one character from each chosen set.
  const chars = active.map((k) => CHARSETS[k][secureRandomInt(CHARSETS[k].length)]!);
  while (chars.length < length) chars.push(pool[secureRandomInt(pool.length)]!);
  // Fisher-Yates shuffle so the guaranteed characters are not always first. O(n).
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.slice(0, length).join("");
}
