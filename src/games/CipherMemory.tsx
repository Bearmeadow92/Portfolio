/**
 * CIPHER MEMORY
 * A memory matching game built with plain React state and CSS 3D transforms (no canvas).
 * Each card is a real <button>, so the game is fully keyboard and screen reader accessible.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { sfx } from "../lib/sound";
import { useHighScore } from "../hooks/useHighScore";

const SYMBOLS = [
  { glyph: "</>", name: "HTML tag" },
  { glyph: "{ }", name: "Object literal" },
  { glyph: "=>", name: "Arrow function" },
  { glyph: "λ", name: "Lambda" },
  { glyph: "#!", name: "Shebang" },
  { glyph: "0x", name: "Hex prefix" },
  { glyph: "&&", name: "Logical AND" },
  { glyph: "$_", name: "PowerShell pipeline variable" },
  { glyph: "::", name: "Scope resolution" },
  { glyph: "[]", name: "Array" },
];

interface Card {
  id: number;
  pairId: number;
  glyph: string;
  name: string;
}

type Difficulty = "recruit" | "veteran";
const PAIRS: Record<Difficulty, number> = { recruit: 8, veteran: 10 };

/** Fisher-Yates shuffle: O(n), unbiased, and does not mutate the input. */
function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function deal(pairs: number): Card[] {
  const chosen = shuffle(SYMBOLS).slice(0, pairs);
  return shuffle(chosen.flatMap((s, pairId) => [0, 1].map((k) => ({ id: pairId * 2 + k, pairId, ...s }))));
}

export default function CipherMemory() {
  const [difficulty, setDifficulty] = useState<Difficulty>("recruit");
  const [cards, setCards] = useState(() => deal(PAIRS.recruit));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [record, setRecord] = useState(false);
  const lock = useRef(false);
  const { best, submit } = useHighScore(`memory-${difficulty}`, true);

  const won = matched.size === cards.length / 2;

  // Timer runs from the first flip until the board is cleared.
  useEffect(() => {
    if (!started || won) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [started, won]);

  const reset = (d: Difficulty = difficulty) => {
    setDifficulty(d);
    setCards(deal(PAIRS[d]));
    setFlipped([]);
    setMatched(new Set());
    setMoves(0);
    setSeconds(0);
    setStarted(false);
    setRecord(false);
    lock.current = false;
  };

  const flip = (index: number) => {
    const card = cards[index]!;
    if (lock.current || flipped.includes(index) || matched.has(card.pairId)) return;
    setStarted(true);
    sfx.click();

    if (flipped.length === 0) {
      setFlipped([index]);
      return;
    }

    const first = cards[flipped[0]!]!;
    setFlipped([flipped[0]!, index]);
    const nextMoves = moves + 1;
    setMoves(nextMoves);

    if (first.pairId === card.pairId) {
      const next = new Set(matched).add(card.pairId);
      setMatched(next);
      setFlipped([]);
      sfx.hit();
      if (next.size === cards.length / 2) {
        sfx.win();
        setRecord(submit(nextMoves));
      }
    } else {
      // Lock input briefly so the player can see the mismatch.
      lock.current = true;
      setTimeout(() => {
        setFlipped([]);
        lock.current = false;
      }, 750);
    }
  };

  const cols = useMemo(() => (cards.length > 16 ? "grid-cols-5" : "grid-cols-4"), [cards.length]);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 font-mono text-sm">
        <div className="flex gap-2" role="group" aria-label="Difficulty">
          {(Object.keys(PAIRS) as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => reset(d)}
              className={`chip capitalize ${d === difficulty ? "border-accent text-accent" : "hover:text-text"}`}
              aria-pressed={d === difficulty}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="flex gap-4 text-muted" aria-live="polite">
          <span>Moves <b className="text-text">{moves}</b></span>
          <span>Time <b className="text-text">{time}</b></span>
          <span>Best <b className="text-accent">{best ?? "--"}</b></span>
        </div>
      </div>

      <div className={`grid ${cols} gap-2 sm:gap-3`}>
        {cards.map((card, i) => {
          const isUp = flipped.includes(i) || matched.has(card.pairId);
          const isMatched = matched.has(card.pairId);
          return (
            <button
              key={card.id}
              onClick={() => flip(i)}
              disabled={isMatched}
              aria-label={isUp ? card.name : `Hidden card ${i + 1}`}
              className="aspect-square [perspective:800px]"
            >
              <div
                className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${isUp ? "[transform:rotateY(180deg)]" : ""}`}
              >
                <div className="absolute inset-0 grid place-items-center rounded-xl border border-border bg-surface-2 [backface-visibility:hidden] hover:border-accent">
                  <span className="font-mono text-xl text-muted/60">?</span>
                </div>
                <div
                  className={`absolute inset-0 grid place-items-center rounded-xl border [backface-visibility:hidden] [transform:rotateY(180deg)] ${
                    isMatched ? "border-good bg-good/10 text-good" : "border-accent bg-accent/10 text-accent"
                  }`}
                >
                  <span className="font-mono text-xl font-bold sm:text-3xl">{card.glyph}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {won && (
        <div className="panel mt-5 p-4 text-center" role="status">
          <p className="font-mono text-xl font-bold text-gradient">{record ? "NEW RECORD! " : ""}Cipher cracked!</p>
          <p className="mt-1 text-muted">
            {moves} moves in {time}. Memory like a well kept log file.
          </p>
          <button className="btn btn-primary mt-3" onClick={() => reset()}>
            ↻ New board
          </button>
        </div>
      )}
    </div>
  );
}
