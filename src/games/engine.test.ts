/**
 * @file Unit tests for the DOM-free parts of engine.ts.
 */
import { describe, expect, it } from "vitest";
import { ParticlePool, clamp, swapRemove } from "./engine";

describe("swapRemove", () => {
  it("removes one element in O(1) without preserving order", () => {
    const list = ["a", "b", "c", "d"];
    swapRemove(list, 1);
    expect(list).toEqual(["a", "d", "c"]);
  });

  it("handles the last element and single element lists", () => {
    const list = [1, 2];
    swapRemove(list, 1);
    expect(list).toEqual([1]);
    swapRemove(list, 0);
    expect(list).toEqual([]);
  });
});

describe("ParticlePool", () => {
  it("never exceeds its capacity", () => {
    const pool = new ParticlePool(10);
    pool.burst(0, 0, "red", 25);
    expect(pool.count).toBe(10);
  });

  it("recycles particles once their life runs out", () => {
    const pool = new ParticlePool(32);
    pool.burst(0, 0, "red", 20);
    pool.update(0.1);
    expect(pool.count).toBe(20); // Lifetimes are 0.4s to 0.8s, so all are still alive.
    pool.update(1);
    expect(pool.count).toBe(0);
    pool.burst(0, 0, "blue", 5); // Freed slots are reusable.
    expect(pool.count).toBe(5);
  });
});

describe("clamp", () => {
  it("limits a value to a range", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
