/**
 * @file Unit tests for cipherMemoryRules.ts.
 */
import { describe, expect, it } from "vitest";
import { DIFFICULTIES, SYMBOLS, deal, scramble, shuffle, starRating } from "./cipherMemoryRules";

describe("shuffle", () => {
  it("keeps every element and does not mutate the input", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(input);
  });

  it("is deterministic with an injected random source", () => {
    const rng = () => 0; // Always picks index 0, which rotates the array left by one.
    expect(shuffle([1, 2, 3, 4], rng)).toEqual([2, 3, 4, 1]);
  });
});

describe("deal", () => {
  it("has enough symbols for the hardest difficulty", () => {
    const most = Math.max(...Object.values(DIFFICULTIES).map((d) => d.pairs));
    expect(SYMBOLS.length).toBeGreaterThanOrEqual(most);
  });

  it("creates exactly two cards per pair, with ids that encode the pair", () => {
    for (const { pairs } of Object.values(DIFFICULTIES)) {
      const cards = deal(pairs);
      expect(cards).toHaveLength(pairs * 2);
      expect(new Set(cards.map((c) => c.id)).size).toBe(pairs * 2);
      const counts = new Map<number, number>();
      for (const card of cards) {
        counts.set(card.pairId, (counts.get(card.pairId) ?? 0) + 1);
        expect(card.id >> 1).toBe(card.pairId); // The game relies on this shortcut.
      }
      expect([...counts.values()].every((n) => n === 2)).toBe(true);
    }
  });
});

describe("scramble", () => {
  it("swaps exactly two unmatched cards and leaves matched cards in place", () => {
    const cards = deal(8);
    const matched = new Set([cards[0]!.pairId, cards[1]!.pairId]);
    for (let i = 0; i < 100; i++) {
      const result = scramble(cards, matched);
      const changed = result.cards.map((c, idx) => (c.id === cards[idx]!.id ? -1 : idx)).filter((idx) => idx >= 0);
      expect(changed).toHaveLength(2);
      expect(result.moved).toHaveLength(2);
      for (const idx of changed) expect(matched.has(cards[idx]!.pairId)).toBe(false);
    }
  });

  it("is a no-op when fewer than two cards are in play", () => {
    const cards = deal(2);
    const all = new Set(cards.map((c) => c.pairId));
    expect(scramble(cards, all).moved).toEqual([]);
  });
});

describe("starRating", () => {
  it("rewards efficient play", () => {
    expect(starRating(8, 8)).toBe(3);
    expect(starRating(18, 8)).toBe(2);
    expect(starRating(40, 8)).toBe(1);
  });
});
