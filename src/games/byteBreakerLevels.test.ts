/**
 * @file Unit tests for byteBreakerLevels.ts.
 */
import { describe, expect, it } from "vitest";
import { COLS, LEVELS, ROWS, buildGrid, chainMultiplier, detonate, neighbors, type Brick, type Grid } from "./byteBreakerLevels";

const brick = (type: Brick["type"], hp = 1): Brick => ({ type, hp, maxHp: hp, row: 0 });
const emptyGrid = (): Grid => new Array<Brick | null>(ROWS * COLS).fill(null);

describe("LEVELS", () => {
  it("are all well formed", () => {
    for (const level of LEVELS) {
      expect(level.rows).toHaveLength(ROWS);
      for (const row of level.rows) expect(row).toMatch(new RegExp(`^[.123X#]{${COLS}}$`));
    }
  });

  it("are all winnable (at least one breakable brick)", () => {
    LEVELS.forEach((_, i) => expect(buildGrid(i + 1).breakable).toBeGreaterThan(0));
  });
});

describe("buildGrid", () => {
  it("counts breakable bricks and excludes tech debt", () => {
    const { grid, breakable } = buildGrid(4); // "Tech Debt" has steel bricks.
    const steel = grid.filter((b) => b?.type === "steel").length;
    const total = grid.filter(Boolean).length;
    expect(steel).toBeGreaterThan(0);
    expect(breakable).toBe(total - steel);
  });

  it("adds a hit point per full cycle through the levels", () => {
    const first = buildGrid(1).grid.find((b) => b?.type === "normal")!;
    const second = buildGrid(1 + LEVELS.length).grid.find((b) => b && b.type !== "steel" && b.type !== "explosive")!;
    expect(second.hp).toBe(first.hp + 1);
  });
});

describe("neighbors", () => {
  it("returns 3 for corners, 5 for edges, and 8 for interior cells", () => {
    expect(neighbors(0)).toHaveLength(3);
    expect(neighbors(COLS - 1)).toHaveLength(3);
    expect(neighbors(3)).toHaveLength(5);
    expect(neighbors(COLS + 3)).toHaveLength(8);
  });

  it("never wraps around the left or right edge", () => {
    // Cell at row 1, col 0 must not be adjacent to row 0, col 9.
    expect(neighbors(COLS)).not.toContain(COLS - 1);
  });
});

describe("detonate", () => {
  it("destroys the explosive and its neighbors, even armored and steel ones", () => {
    const grid = emptyGrid();
    grid[COLS + 1] = brick("explosive");
    grid[0] = brick("armored", 3);
    grid[COLS + 2] = brick("steel", Infinity);
    grid[5] = brick("normal"); // Out of range, must survive.
    const blast = detonate(grid, COLS + 1);
    expect(blast).toHaveLength(3);
    expect(grid[0]).toBeNull();
    expect(grid[COLS + 2]).toBeNull();
    expect(grid[5]).not.toBeNull();
  });

  it("chains through adjacent explosives, handling each brick exactly once", () => {
    const grid = emptyGrid();
    // A row of five explosives: the blast should travel the whole line.
    for (let c = 0; c < 5; c++) grid[c] = brick("explosive");
    grid[6] = brick("normal"); // Not adjacent to the last explosive (col 4), so it survives.
    grid[5] = brick("normal"); // Adjacent to col 4, so it is destroyed.
    const blast = detonate(grid, 0);
    expect(blast).toHaveLength(6);
    expect(new Set(blast.map((b) => b.index)).size).toBe(6);
    expect(grid[6]).not.toBeNull();
  });

  it("does nothing on an empty cell", () => {
    expect(detonate(emptyGrid(), 12)).toEqual([]);
  });
});

describe("chainMultiplier", () => {
  it("grows every four bricks and caps at x6", () => {
    expect(chainMultiplier(0)).toBe(1);
    expect(chainMultiplier(4)).toBe(2);
    expect(chainMultiplier(1000)).toBe(6);
  });
});
