/**
 * @file Unit tests for the pure helpers in useRepo.ts.
 */
import { describe, expect, it } from "vitest";
import { toLanguageShares } from "./useRepo";

describe("toLanguageShares", () => {
  it("converts bytes to percentages, largest first", () => {
    const shares = toLanguageShares({ CSS: 100, TypeScript: 800, HTML: 100 });
    expect(shares.map((s) => s.name)).toEqual(["TypeScript", "CSS", "HTML"]);
    expect(shares[0]!.percent).toBe(80);
    expect(shares.reduce((sum, s) => sum + s.percent, 0)).toBeCloseTo(100);
  });

  it("returns an empty list for an empty repository", () => {
    expect(toLanguageShares({})).toEqual([]);
  });
});
