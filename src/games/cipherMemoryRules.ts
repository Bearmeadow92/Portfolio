/**
 * @file Cipher Memory rules: the deck, difficulty tiers, shuffling, and scoring.
 * Pure functions only, so everything here is unit tested.
 */

export interface CardSymbol {
  glyph: string;
  /** Plain language name, read by screen readers and shown after a match. */
  name: string;
}

export const SYMBOLS: readonly CardSymbol[] = [
  { glyph: "</>", name: "HTML tag" },
  { glyph: "{ }", name: "Object literal" },
  { glyph: "=>", name: "Arrow function" },
  { glyph: "λ", name: "Lambda" },
  { glyph: "#!", name: "Shebang" },
  { glyph: "0x", name: "Hex prefix" },
  { glyph: "&&", name: "Logical AND" },
  { glyph: "$_", name: "PowerShell pipeline variable" },
  { glyph: "::", name: "Scope resolution" },
  { glyph: "[]", name: "Array" },
  { glyph: "!=", name: "Not equal" },
  { glyph: "/**", name: "Doc comment" },
  { glyph: "??", name: "Nullish coalescing" },
  { glyph: "|>", name: "Pipe operator" },
];

export interface Card extends CardSymbol {
  /** Unique per card, used as the React key so cards keep their identity when they move. */
  id: number;
  /** Shared by the two cards that match. */
  pairId: number;
}

export type Difficulty = "junior" | "senior" | "staff";

export interface DifficultyConfig {
  label: string;
  pairs: number;
  /** Tailwind grid class. Written out in full so Tailwind's scanner can find it. */
  cols: string;
  /** Free looks at the whole board. */
  peeks: number;
  /** After this many misses, two face-down cards trade places. 0 disables scrambling. */
  scrambleEvery: number;
  blurb: string;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  junior: { label: "Junior", pairs: 8, cols: "grid-cols-4", peeks: 2, scrambleEvery: 0, blurb: "8 pairs. A warm up." },
  senior: { label: "Senior", pairs: 10, cols: "grid-cols-5", peeks: 2, scrambleEvery: 0, blurb: "10 pairs. Stay focused." },
  staff: { label: "Staff", pairs: 12, cols: "grid-cols-4 sm:grid-cols-6", peeks: 1, scrambleEvery: 3, blurb: "12 pairs, and every 3 misses two cards swap places." },
};

/**
 * Fisher-Yates shuffle. O(n), unbiased, and returns a new array.
 * @param rng Injectable random source so tests can be deterministic.
 */
export function shuffle<T>(input: readonly T[], rng: () => number = Math.random): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** Deals a shuffled board with `pairs` random symbols, two cards each. O(n). */
export function deal(pairs: number, rng: () => number = Math.random): Card[] {
  const chosen = shuffle(SYMBOLS, rng).slice(0, pairs);
  const cards = chosen.flatMap((symbol, pairId) => [
    { ...symbol, pairId, id: pairId * 2 },
    { ...symbol, pairId, id: pairId * 2 + 1 },
  ]);
  return shuffle(cards, rng);
}

/**
 * Swaps the board positions of two random cards that are still in play.
 * O(n) to find the candidates, then O(1) to swap.
 *
 * @returns The new board and the ids of the two cards that moved, or the same board
 *          and an empty list when fewer than two cards are eligible.
 */
export function scramble(cards: readonly Card[], matched: ReadonlySet<number>, rng: () => number = Math.random): { cards: Card[]; moved: number[] } {
  const open: number[] = [];
  cards.forEach((card, index) => {
    if (!matched.has(card.pairId)) open.push(index);
  });
  if (open.length < 2) return { cards: [...cards], moved: [] };

  const a = open[Math.floor(rng() * open.length)]!;
  let b = open[Math.floor(rng() * (open.length - 1))]!;
  if (b === a) b = open[open.length - 1]!; // Guarantees two different positions without a retry loop.

  const next = [...cards];
  [next[a], next[b]] = [next[b]!, next[a]!];
  return { cards: next, moved: [next[a]!.id, next[b]!.id] };
}

/**
 * Rates a finished game from 1 to 3 stars based on moves per pair.
 * A perfect memory needs exactly one move per pair, so the thresholds leave room to explore.
 */
export function starRating(moves: number, pairs: number): 1 | 2 | 3 {
  const ratio = moves / pairs;
  return ratio <= 1.75 ? 3 : ratio <= 2.5 ? 2 : 1;
}
