import { describe, expect, it } from "vitest";
import { analyzePassword, CHARSETS, generatePassword, poolSize } from "./password";

describe("poolSize", () => {
  it("adds up character classes", () => {
    expect(poolSize("abc")).toBe(26);
    expect(poolSize("aB")).toBe(52);
    expect(poolSize("aB3")).toBe(62);
    expect(poolSize("aB3!")).toBe(95);
  });
});

describe("analyzePassword", () => {
  it("flags common passwords as very weak", () => {
    const r = analyzePassword("password");
    expect(r.score).toBe(0);
    expect(r.crackTime).toBe("instantly");
  });

  it("rates long mixed passwords highly", () => {
    expect(analyzePassword("v9#Lq!2xR@7mTz$Wp4").score).toBe(4);
  });

  it("penalizes sequences", () => {
    const random = analyzePassword("Zxq825lr");
    const seq = analyzePassword("Zxq123lr");
    expect(seq.feedback.some((f) => f.includes("sequences"))).toBe(true);
    expect(seq.entropy).toBeLessThan(random.entropy);
  });
});

describe("generatePassword", () => {
  it("respects length and includes every chosen set", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword(16, ["lower", "upper", "digits", "symbols"]);
      expect(pw).toHaveLength(16);
      for (const set of Object.values(CHARSETS)) {
        expect([...pw].some((c) => set.includes(c))).toBe(true);
      }
    }
  });

  it("only uses characters from the chosen sets", () => {
    const pw = generatePassword(64, ["digits"]);
    expect(pw).toMatch(/^\d{64}$/);
  });
});
