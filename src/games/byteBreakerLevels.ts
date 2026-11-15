/**
 * @file Byte Breaker level data and brick grid logic.
 *
 * Pure functions with no canvas or React inside, so the level parser and the
 * chain reaction algorithm can be unit tested.
 *
 * Bricks live in a flat array indexed by `row * COLS + col`. A flat grid gives O(1)
 * lookup by position, which is what makes ball collision, laser hits, and explosion
 * neighbors constant time instead of a scan over every brick.
 */

export const COLS = 10;
export const ROWS = 8;

export type BrickType = "normal" | "armored" | "explosive" | "steel";

export interface Brick {
  type: BrickType;
  hp: number;
  maxHp: number;
  row: number;
}

/** A grid cell holds a brick or nothing. */
export type Grid = (Brick | null)[];

/**
 * Level layouts, drawn as ASCII art so they are easy to read and edit.
 *
 * Legend:
 *   .  empty
 *   1  bug (1 hit)
 *   2  legacy code (2 hits)
 *   3  legacy code (3 hits)
 *   X  null pointer (explodes and destroys its neighbors, chain reactions welcome)
 *   #  tech debt (indestructible, except by explosions)
 */
export const LEVELS: readonly { name: string; rows: readonly string[] }[] = [
  {
    name: "Hello World",
    rows: ["..........", "1111111111", "1111111111", "111X11X111", "1111111111", "..........", "..........", ".........."],
  },
  {
    name: "Legacy Code",
    rows: ["2222222222", "1111111111", "1X111111X1", "1111111111", ".11111111.", "..........", "..........", ".........."],
  },
  {
    name: "Checkerboard",
    rows: ["1.1.1.1.1.", ".2.2.2.2.2", "1.X.1.1.X.", ".1.1.1.1.1", "1.1.1.1.1.", ".1.1.1.1.1", "..........", ".........."],
  },
  {
    name: "Tech Debt",
    rows: ["1111111111", "1##1111##1", "1111XX1111", "2222222222", "1111111111", ".#......#.", "..........", ".........."],
  },
  {
    name: "Diamond",
    rows: ["....11....", "...1221...", "..12XX21..", ".12333321.", "..12XX21..", "...1221...", "....11....", ".........."],
  },
  {
    name: "Fortress",
    rows: ["3333333333", "2.2.2.2.2.", "1X1X1X1X1X", "1111111111", "#..#..#..#", "..........", "..........", ".........."],
  },
  {
    name: "Chain Reaction",
    rows: ["1111111111", "1XXXXXXXX1", "1X111111X1", "1X1####1X1", "1X111111X1", "1XXXXXXXX1", "1111111111", ".........."],
  },
  {
    name: "The Monolith",
    rows: ["3333333333", "3222222223", "32X1111X23", "3211##1123", "32X1111X23", "3222222223", "3333333333", ".........."],
  },
];

/** Name of the layout used for a 1-based level number (levels cycle forever). */
export const levelName = (level: number) => LEVELS[(level - 1) % LEVELS.length]!.name;

/**
 * Parses a level into a brick grid. O(ROWS * COLS).
 * After the last layout the levels repeat, with one extra hit point per full cycle.
 *
 * @returns The grid and the number of breakable bricks (everything except tech debt).
 */
export function buildGrid(level: number): { grid: Grid; breakable: number } {
  const layout = LEVELS[(level - 1) % LEVELS.length]!.rows;
  const bonusHp = Math.floor((level - 1) / LEVELS.length);
  const grid: Grid = new Array<Brick | null>(ROWS * COLS).fill(null);
  let breakable = 0;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const ch = layout[row]?.[col] ?? ".";
      let brick: Brick | null = null;
      if (ch === "#") brick = { type: "steel", hp: Infinity, maxHp: Infinity, row };
      else if (ch === "X") brick = { type: "explosive", hp: 1, maxHp: 1, row };
      else if (ch >= "1" && ch <= "3") {
        const hp = Number(ch) + bonusHp;
        brick = { type: hp > 1 ? "armored" : "normal", hp, maxHp: hp, row };
      }
      if (brick && brick.type !== "steel") breakable++;
      grid[row * COLS + col] = brick;
    }
  }
  return { grid, breakable };
}

/** Indices of the up to eight cells surrounding `index`. O(1). */
export function neighbors(index: number): number[] {
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) out.push(r * COLS + c);
    }
  }
  return out;
}

/**
 * Detonates the brick at `start` and resolves the whole chain reaction.
 *
 * Iterative flood fill with an explicit stack (no recursion, so no stack overflow risk).
 * Every cell is cleared the first time it is visited, so each brick is handled at most
 * once and the total cost is O(k) for k destroyed bricks.
 *
 * @returns Every destroyed brick with its grid index, in blast order. The grid is mutated.
 */
export function detonate(grid: Grid, start: number): { index: number; brick: Brick }[] {
  const destroyed: { index: number; brick: Brick }[] = [];
  const stack = [start];
  while (stack.length) {
    const index = stack.pop()!;
    const brick = grid[index];
    if (!brick) continue;
    grid[index] = null;
    destroyed.push({ index, brick });
    if (brick.type === "explosive") stack.push(...neighbors(index));
  }
  return destroyed;
}

/** Score multiplier for consecutive brick hits without touching the paddle. */
export const chainMultiplier = (chain: number) => Math.min(1 + Math.floor(chain / 4), 6);
