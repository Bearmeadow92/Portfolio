/**
 * @file Unit tests for fuzzy.ts.
 */
import { describe, expect, it } from "vitest";
import { fuzzyScore } from "./fuzzy";

describe("fuzzyScore", () => {
  it("matches subsequences and rejects non matches", () => {
    expect(fuzzyScore("fwd", "Play Firewall Defender")).toBeGreaterThan(0);
    expect(fuzzyScore("xyz", "Play Firewall Defender")).toBe(-1);
  });

  it("prefers consecutive and word start matches", () => {
    expect(fuzzyScore("scene", "Scene: Ripple")).toBeGreaterThan(fuzzyScore("scene", "Second chance menu"));
  });
});
