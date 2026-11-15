/**
 * @file Unit tests for firewallRules.ts.
 */
import { describe, expect, it } from "vitest";
import {
  KINDS, UPGRADES, armorFactor, comboMultiplier, emptyLoadout, pickUpgrades, rollKind, turretInterval, waveConfig,
} from "./firewallRules";

describe("waveConfig", () => {
  it("builds a cumulative spawn table that ends at exactly 1", () => {
    for (let wave = 1; wave <= 30; wave++) {
      const { table } = waveConfig(wave);
      const bounds = table.map(([, b]) => b);
      expect(bounds.at(-1)).toBeCloseTo(1, 10);
      // Bounds must strictly increase, or some kinds could never be rolled.
      for (let i = 1; i < bounds.length; i++) expect(bounds[i]!).toBeGreaterThan(bounds[i - 1]!);
    }
  });

  it("unlocks enemy types gradually", () => {
    const kindsAt = (wave: number) => waveConfig(wave).table.map(([k]) => k);
    expect(kindsAt(1)).not.toContain("worm");
    expect(kindsAt(2)).toContain("worm");
    expect(kindsAt(2)).not.toContain("trojan");
    expect(kindsAt(3)).toContain("trojan");
    expect(kindsAt(4)).toContain("botnet");
  });

  it("gets harder every wave, within sane limits", () => {
    const early = waveConfig(1);
    const late = waveConfig(50);
    expect(late.count).toBeGreaterThan(early.count);
    expect(late.speed).toBeGreaterThan(early.speed);
    expect(late.interval).toBeLessThan(early.interval);
    expect(late.interval).toBeGreaterThan(0.3); // Never humanly impossible.
  });

  it("schedules a boss on every fifth wave only", () => {
    expect([1, 4, 5, 6, 10].map((w) => waveConfig(w).boss)).toEqual([false, false, true, false, true]);
  });
});

describe("rollKind", () => {
  it("maps the ends of the range to the first and last table entries", () => {
    const cfg = waveConfig(4);
    expect(rollKind(cfg, 0)).toBe(cfg.table[0]![0]);
    expect(rollKind(cfg, 0.999999)).toBe(cfg.table.at(-1)![0]);
  });

  it("only ever returns kinds that exist in the balance table", () => {
    const cfg = waveConfig(8);
    for (let i = 0; i < 200; i++) expect(KINDS[rollKind(cfg)]).toBeDefined();
  });
});

describe("pickUpgrades", () => {
  it("offers distinct upgrades", () => {
    for (let i = 0; i < 100; i++) {
      const picks = pickUpgrades(emptyLoadout());
      expect(picks).toHaveLength(3);
      expect(new Set(picks).size).toBe(3);
    }
  });

  it("never offers an upgrade that is already maxed", () => {
    const loadout = { ...emptyLoadout(), turret: UPGRADES.turret.max, dpi: UPGRADES.dpi.max, armor: UPGRADES.armor.max };
    for (let i = 0; i < 100; i++) {
      const picks = pickUpgrades(loadout);
      expect(picks).not.toContain("turret");
      expect(picks).not.toContain("dpi");
      expect(picks).not.toContain("armor");
    }
  });

  it("always has the repair consumable available as a fallback", () => {
    const maxed = { turret: 3, capacitor: 3, armor: 3, tarpit: 3, dpi: 1, repair: 99 };
    expect(pickUpgrades(maxed)).toEqual(["repair"]);
  });
});

describe("stat helpers", () => {
  it("scales as documented", () => {
    expect(turretInterval(0)).toBe(Infinity);
    expect(turretInterval(3)).toBeLessThan(turretInterval(1));
    expect(armorFactor(3)).toBeCloseTo(0.4);
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(5)).toBe(2);
    expect(comboMultiplier(999)).toBe(5);
  });
});
