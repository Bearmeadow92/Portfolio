/**
 * @file Unit tests for the Firewall Defender rules.
 */
import { describe, expect, it } from "vitest";
import {
  sanitizeLab,
  KINDS, RESEARCH, TOWERS, buildGraph, canResearch, comboMultiplier, modifiers, mulberry32, nextHop, polyVulnerable,
  researchEarned, rollKind, waveConfig, type ResearchId,
} from "./rules";

describe("buildGraph", () => {
  it("connects every node to the core", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const g = buildGraph(seed);
      g.dist.forEach((d) => expect(d).toBeLessThan(Infinity));
    }
  });

  it("is reproducible from a seed", () => {
    const a = buildGraph(42);
    const b = buildGraph(42);
    expect(a.nodes.map((n) => [n.x, n.y, n.links.length])).toEqual(b.nodes.map((n) => [n.x, n.y, n.links.length]));
  });

  it("places gates on the edge, linked inward", () => {
    const g = buildGraph(7);
    expect(g.gates).toHaveLength(8);
    for (const id of g.gates) expect(g.nodes[id]!.links.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps links symmetric", () => {
    const g = buildGraph(3);
    for (const n of g.nodes) for (const m of n.links) expect(g.nodes[m]!.links).toContain(n.id);
  });
});

describe("nextHop", () => {
  it("always moves strictly closer to the core, and arrives", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const g = buildGraph(seed);
      const rng = mulberry32(seed);
      for (const gate of g.gates) {
        let at = gate;
        let steps = 0;
        while (at !== 0) {
          const next = nextHop(g, at, rng);
          expect(g.dist[next]!).toBeLessThan(g.dist[at]!);
          at = next;
          expect(++steps).toBeLessThan(20);
        }
      }
    }
  });
});

describe("waveConfig", () => {
  it("builds cumulative tables that end at 1", () => {
    for (let wave = 1; wave <= 30; wave++) {
      const bounds = waveConfig(wave).table.map(([, b]) => b);
      expect(bounds.at(-1)).toBeCloseTo(1, 10);
      for (let i = 1; i < bounds.length; i++) expect(bounds[i]!).toBeGreaterThan(bounds[i - 1]!);
    }
  });

  it("unlocks threats gradually", () => {
    const kinds = (w: number) => waveConfig(w).table.map(([k]) => k);
    expect(kinds(1)).toEqual(["legit", "exploit"]);
    expect(kinds(3)).toContain("trojan");
    expect(kinds(4)).toContain("ddos");
    expect(kinds(5)).not.toContain("poly");
    expect(kinds(7)).toContain("botnet");
  });

  it("cycles bosses every fifth wave and scales them", () => {
    expect([5, 10, 15, 20].map((w) => waveConfig(w).boss)).toEqual(["ransomware", "rootkit", "zeroday", "ransomware"]);
    expect(waveConfig(4).boss).toBeNull();
    expect(waveConfig(20).bossHpMul).toBeGreaterThan(waveConfig(5).bossHpMul);
  });

  it("rolls only known kinds", () => {
    const cfg = waveConfig(9);
    for (let i = 0; i < 100; i++) expect(KINDS[rollKind(cfg)]).toBeDefined();
  });
});

describe("polymorphic cycle", () => {
  it("alternates between vulnerable and shielded", () => {
    expect(polyVulnerable(0.1)).toBe(true);
    expect(polyVulnerable(1.5)).toBe(false);
    expect(polyVulnerable(2.5)).toBe(true);
  });
});

describe("research", () => {
  it("requires prerequisites and points", () => {
    expect(canResearch("h1", [], 2)).toBe(true);
    expect(canResearch("h1", [], 1)).toBe(false);
    expect(canResearch("h2", [], 9)).toBe(false);
    expect(canResearch("h2", ["h1"], 3)).toBe(true);
    expect(canResearch("h1", ["h1"], 9)).toBe(false);
  });

  it("forms three straight branches of three", () => {
    for (const r of RESEARCH) if (r.requires) expect(RESEARCH.find((x) => x.id === r.requires)!.branch).toBe(r.branch);
    expect(RESEARCH.filter((r) => r.requires === null)).toHaveLength(3);
  });

  it("turns owned research into modifiers", () => {
    const base = modifiers([]);
    const all = modifiers(RESEARCH.map((r) => r.id) as ResearchId[]);
    expect(all.maxIntegrity).toBeGreaterThan(base.maxIntegrity);
    expect(all.breachMul).toBeLessThan(base.breachMul);
    expect(all.towerCostMul).toBeLessThan(1);
    expect(all.clickDamage).toBe(2);
    expect(all.threatIntel).toBe(true);
  });

  it("awards points for waves and bosses", () => {
    expect(researchEarned(4, 0)).toBe(4);
    expect(researchEarned(10, 2)).toBe(16);
  });
});

describe("balance sanity", () => {
  it("prices towers so the starting budget buys at least one", () => {
    expect(Math.min(...Object.values(TOWERS).map((t) => t.cost))).toBeLessThanOrEqual(120);
  });

  it("caps the combo multiplier", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(8)).toBe(2);
    expect(comboMultiplier(999)).toBe(5);
  });
});

describe("sanitizeLab", () => {
  it("keeps a valid save as is", () => {
    expect(sanitizeLab({ points: 5, owned: ["h1", "t1"] })).toEqual({ points: 5, owned: ["h1", "t1"] });
  });
  it("drops unknown, inherited, and duplicate ids", () => {
    expect(sanitizeLab({ points: 1, owned: ["h1", "h1", "bogus", "__proto__", "constructor", 7] }).owned).toEqual(["h1"]);
  });
  it("clamps or resets bad point values", () => {
    expect(sanitizeLab({ points: -40, owned: [] }).points).toBe(0);
    expect(sanitizeLab({ points: 1e9, owned: [] }).points).toBe(999);
    expect(sanitizeLab({ points: Infinity, owned: [] }).points).toBe(0);
    expect(sanitizeLab({ points: "50", owned: [] }).points).toBe(0);
  });
  it("survives garbage", () => {
    for (const junk of [null, undefined, 42, "x", [], { owned: "h1" }]) expect(sanitizeLab(junk)).toEqual({ points: 0, owned: [] });
  });
});
