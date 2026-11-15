/**
 * @file CIPHER MEMORY
 *
 * A memory matching game built with plain React state and CSS 3D transforms. Unlike
 * the two canvas games, this one is all DOM: every card is a real <button>, so it is
 * fully keyboard and screen reader accessible.
 *
 * Twists that add depth:
 * - Three difficulty tiers with separate high scores.
 * - Peek: a limited power that reveals the whole board for a moment (costs 2 moves).
 * - Streaks: consecutive matches are tracked and celebrated.
 * - Staff mode: every third miss, two face-down cards quietly trade places.
 *
 * Complexity: a flip is O(1). Matched pairs are stored in a Set and flipped cards are
 * tracked by id, so there are no scans over the board in the hot path.
 */
import { useEffect, useRef, useState } from "react";
import { sfx } from "../lib/sound";
import { useHighScore } from "../hooks/useHighScore";
import { DIFFICULTIES, deal, scramble, starRating, type Card, type Difficulty } from "./cipherMemoryRules";

/** How long a mismatched pair stays face up, in milliseconds. */
const MISMATCH_MS = 750;
const PEEK_MS = 1300;
const PEEK_COST = 2;

interface Round {
  cards: Card[];
  /** Ids of the cards currently face up and unmatched (at most two). */
  flipped: number[];
  matched: Set<number>;
  moves: number;
  misses: number;
  streak: number;
  bestStreak: number;
  peeksLeft: number;
  /** Ids of cards that just swapped places, highlighted briefly. */
  moved: number[];
  /** Status line shown under the board. */
  message: string;
}

function newRound(difficulty: Difficulty): Round {
  const cfg = DIFFICULTIES[difficulty];
  return {
    cards: deal(cfg.pairs), flipped: [], matched: new Set(), moves: 0, misses: 0,
    streak: 0, bestStreak: 0, peeksLeft: cfg.peeks, moved: [], message: cfg.blurb,
  };
}

export default function CipherMemory() {
  const [difficulty, setDifficulty] = useState<Difficulty>("junior");
  const [round, setRound] = useState(() => newRound("junior"));
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const [record, setRecord] = useState(false);
  /** True while a mismatch is on display, which blocks input. A ref, because it never needs to re-render. */
  const locked = useRef(false);
  /** Pending timeouts, cleared on reset and unmount so nothing fires on a stale board. */
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { best, submit } = useHighScore(`memory-${difficulty}`, true);

  const cfg = DIFFICULTIES[difficulty];
  const won = round.matched.size === cfg.pairs;

  // The clock runs from the first flip until the board is cleared.
  useEffect(() => {
    if (!started || won) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [started, won]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  /** Runs `fn` after `ms`, tracked so it can be cancelled. */
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const reset = (next: Difficulty = difficulty) => {
    clearTimers();
    locked.current = false;
    setDifficulty(next);
    setRound(newRound(next));
    setSeconds(0);
    setStarted(false);
    setPeeking(false);
    setRecord(false);
  };

  const flip = (card: Card) => {
    if (locked.current || peeking || round.flipped.includes(card.id) || round.matched.has(card.pairId)) return;
    setStarted(true);
    sfx.click();

    // First card of a pair: just turn it over.
    if (round.flipped.length === 0) {
      setRound({ ...round, flipped: [card.id], moved: [] });
      return;
    }

    // Second card: resolve the pair. `id >> 1` recovers the pairId without a lookup.
    const firstPair = round.flipped[0]! >> 1;
    const moves = round.moves + 1;

    if (firstPair === card.pairId) {
      const matched = new Set(round.matched).add(card.pairId);
      const streak = round.streak + 1;
      setRound({
        ...round, moves, matched, flipped: [], streak,
        bestStreak: Math.max(round.bestStreak, streak),
        message: `Matched ${card.glyph}  ${card.name}${streak > 1 ? `  ·  ${streak} in a row!` : ""}`,
      });
      sfx.hit();
      if (matched.size === cfg.pairs) {
        sfx.win();
        setRecord(submit(moves));
      }
      return;
    }

    // Mismatch: show both cards briefly, then turn them back (and maybe scramble).
    const misses = round.misses + 1;
    const pending: Round = { ...round, moves, misses, streak: 0, flipped: [round.flipped[0]!, card.id], message: "No match. Keep going." };
    setRound(pending);
    locked.current = true;
    later(() => {
      locked.current = false;
      if (cfg.scrambleEvery && misses % cfg.scrambleEvery === 0) {
        const { cards, moved } = scramble(pending.cards, pending.matched);
        setRound({ ...pending, cards, moved, flipped: [], message: "⚠ Scramble! Two cards just traded places." });
        sfx.zap();
      } else {
        setRound({ ...pending, flipped: [] });
      }
    }, MISMATCH_MS);
  };

  const peek = () => {
    if (round.peeksLeft === 0 || peeking || locked.current || won) return;
    setStarted(true);
    setPeeking(true);
    setRound({ ...round, peeksLeft: round.peeksLeft - 1, moves: round.moves + PEEK_COST, flipped: [], message: `Peek used (+${PEEK_COST} moves).` });
    sfx.power();
    later(() => setPeeking(false), PEEK_MS);
  };

  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const stars = won ? starRating(round.moves, cfg.pairs) : 0;

  return (
    <div className="mx-auto w-full max-w-[680px]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 font-mono text-sm">
        <div className="flex gap-2" role="group" aria-label="Difficulty">
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => reset(d)}
              className={`chip ${d === difficulty ? "border-accent text-accent" : "hover:text-text"}`}
              aria-pressed={d === difficulty}
            >
              {DIFFICULTIES[d].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-muted">
          <span>Moves <b className="text-text">{round.moves}</b></span>
          <span>Time <b className="text-text">{time}</b></span>
          <span>Best <b className="text-accent">{best ?? "--"}</b></span>
          <button onClick={peek} disabled={round.peeksLeft === 0 || peeking || won} className="chip hover:border-accent-2 hover:text-accent-2 disabled:opacity-40" title={`Reveal every card briefly (costs ${PEEK_COST} moves)`}>
            👁 Peek ×{round.peeksLeft}
          </button>
        </div>
      </div>

      <div className={`grid ${cfg.cols} gap-2 sm:gap-3`}>
        {round.cards.map((card, i) => {
          const isMatched = round.matched.has(card.pairId);
          const isUp = isMatched || peeking || round.flipped.includes(card.id);
          const justMoved = round.moved.includes(card.id);
          return (
            <button
              key={card.id}
              onClick={() => flip(card)}
              disabled={isMatched}
              aria-label={isUp ? card.name : `Hidden card ${i + 1}`}
              className={`aspect-square rounded-xl [perspective:800px] ${justMoved ? "ring-2 ring-warn" : ""}`}
            >
              <div className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${isUp ? "[transform:rotateY(180deg)]" : ""}`}>
                <div className="absolute inset-0 grid place-items-center rounded-xl border border-border bg-surface-2 [backface-visibility:hidden] hover:border-accent">
                  <span className="font-mono text-xl text-muted/60">?</span>
                </div>
                <div
                  className={`absolute inset-0 grid place-items-center rounded-xl border [backface-visibility:hidden] [transform:rotateY(180deg)] ${
                    isMatched ? "border-good bg-good/10 text-good" : "border-accent bg-accent/10 text-accent"
                  }`}
                >
                  {/* Ligatures are disabled so the font does not merge "!=" or "=>" into single glyphs. */}
                  <span className="font-mono text-lg font-bold [font-variant-ligatures:none] sm:text-2xl">{card.glyph}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-3 min-h-5 text-center font-mono text-xs text-muted" role="status" aria-live="polite">
        {round.message}
      </p>

      {won && (
        <div className="panel mt-3 p-4 text-center">
          <p className="text-2xl tracking-widest text-warn" aria-label={`${stars} out of 3 stars`}>
            {"★".repeat(stars)}
            <span className="text-border">{"★".repeat(3 - stars)}</span>
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-gradient">{record ? "NEW RECORD! " : ""}Cipher cracked!</p>
          <p className="mt-1 text-muted">
            {round.moves} moves in {time}, with a best streak of {round.bestStreak}. Memory like a well kept log file.
          </p>
          <button className="btn btn-primary mt-3" onClick={() => reset()}>
            ↻ New board
          </button>
        </div>
      )}
    </div>
  );
}
