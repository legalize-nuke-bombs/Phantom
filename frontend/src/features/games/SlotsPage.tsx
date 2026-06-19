// SlotsPage — the FRUITS game ("Слоты"): a full-width 3×5 reel slot machine.
//
// Verified against the backend source (com.example.phantom.game.fruits.*,
// com.example.phantom.game.util.slot.*):
//
//   • GET  /api/games/fruits        → FruitSettings { minBet (= 1), slots }.
//       The reel / symbol / pattern model is fixed and mirrored below (3×5 grid,
//       PATTERNS) so we can light up exactly the cells the server scored — never
//       trusting any generated docs. Only the symbols plum/grape/seven/wild land
//       (FruitSlots registers exactly those); strawberry is decorative spin-fodder.
//   • init data is just { bet } (string), bet ≥ minBet, no max.
//   • run → GameRepresentation whose data map is:
//       { data: string[3][5] (row-major, data[y][x]), patternMatches: PatternMatch[] }
//     each PatternMatch = { patternName, slotName, patternK, slotK, k } (k = patternK·slotK).
//     result = bet·Σk. We reveal the lines cheapest → most expensive, sorting by k.
//
// The whole round goes through useGameRound.play({ bet }) — one provably-fair
// handshake, balance refreshed inside the hook. We spin a CSS reel that decelerates
// onto the returned grid, then flash each winning pattern in turn (cheapest first)
// with a tick, and finally show the total "Ваш выигрыш" (0 if none — never a minus).

import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import clsx from 'clsx';

import BetInput from '@/shared/ui/BetInput';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import Amount from '@/shared/ui/Amount';
import PageBack from '@/shared/ui/PageBack';
import ProvablyFair from '@/shared/ui/ProvablyFair';
import { useGameRound } from '@/shared/lib/useGameRound';
import { getGameSettings } from '@/shared/lib/gameApi';
import type { GameResult } from '@/shared/lib/gameApi';
import { GAME_META } from '@/shared/lib/games';
import { sfx } from '@/shared/lib/sound';

import grape from '@/assets/symbols/grape.png';
import plum from '@/assets/symbols/plum.png';
import seven from '@/assets/symbols/seven.png';
import strawberry from '@/assets/symbols/strawberry.png';
import wild from '@/assets/symbols/wild.png';

// ── Reel model (mirrors FruitSlots / SimpleSlots) ───────────────────────────
const ROWS = 3;
const COLS = 5;

/** Slot art by backend slot name. WILD substitutes for any symbol. */
const SYMBOL_ART: Record<string, string> = { plum, grape, seven, wild };

/**
 * Symbols shown while a reel blurs past, in rough order of how often the server
 * rolls them (plum/grape common, seven/wild rare). strawberry never lands (the
 * backend has no such slot) — it is decorative spin-fodder so the blur looks
 * richer than four repeating frames.
 */
const SPIN_POOL = [plum, grape, plum, grape, strawberry, seven, plum, grape, wild, strawberry];

/**
 * Scoring pattern masks, mirrored from FruitSlots.registerPattern(...). 3×5; a `1`
 * marks a cell belonging to the pattern. Used ONLY to highlight a matched pattern's
 * exact cells — payouts always come from the server, never recomputed here. Order
 * here is irrelevant: we flash in the order the server returns matches.
 */
type Mask = ReadonlyArray<ReadonlyArray<0 | 1>>;
const PATTERNS: Record<string, Mask> = {
  column1: [[1, 0, 0, 0, 0], [1, 0, 0, 0, 0], [1, 0, 0, 0, 0]],
  column2: [[0, 1, 0, 0, 0], [0, 1, 0, 0, 0], [0, 1, 0, 0, 0]],
  column3: [[0, 0, 1, 0, 0], [0, 0, 1, 0, 0], [0, 0, 1, 0, 0]],
  column4: [[0, 0, 0, 1, 0], [0, 0, 0, 1, 0], [0, 0, 0, 1, 0]],
  column5: [[0, 0, 0, 0, 1], [0, 0, 0, 0, 1], [0, 0, 0, 0, 1]],
  row1: [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]],
  row2: [[0, 0, 0, 0, 0], [1, 1, 1, 1, 1], [0, 0, 0, 0, 0]],
  row3: [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [1, 1, 1, 1, 1]],
  arrowUp: [[0, 0, 1, 0, 0], [0, 1, 0, 1, 0], [1, 0, 0, 0, 1]],
  arrowDown: [[1, 0, 0, 0, 1], [0, 1, 0, 1, 0], [0, 0, 1, 0, 0]],
  eye: [[0, 1, 1, 1, 0], [1, 0, 0, 0, 1], [0, 1, 1, 1, 0]],
  triangleUp: [[0, 0, 1, 0, 0], [0, 1, 1, 1, 0], [1, 1, 1, 1, 1]],
  triangleDown: [[1, 1, 1, 1, 1], [0, 1, 1, 1, 0], [0, 0, 1, 0, 0]],
  jackpot: [[1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]],
};

// ── Result shape (the run() data map) ───────────────────────────────────────
interface PatternMatch {
  patternName: string;
  slotName: string;
  patternK: number;
  slotK: number;
  k: number;
}

interface SpinPayload {
  /** Row-major grid: grid[y][x]. */
  grid: string[][];
  /** Matches in the server's order (ascending k = cheapest → most expensive). */
  matches: PatternMatch[];
}

/** Narrow the open result.data map to the slot payload, defensively. */
function readSpin(result: GameResult): SpinPayload | null {
  const raw = result.data as { data?: unknown; patternMatches?: unknown };
  const grid = raw?.data;
  if (!Array.isArray(grid) || grid.length !== ROWS) return null;
  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== COLS) return null;
  }
  const matches = Array.isArray(raw.patternMatches)
    ? (raw.patternMatches as PatternMatch[])
    : [];
  return { grid: grid as string[][], matches };
}

/** A ROWS×COLS boolean mask of the cells in ONE pattern — the cells to glow. */
function patternCells(patternName: string): boolean[][] {
  const mask = PATTERNS[patternName];
  return Array.from({ length: ROWS }, (_, y) =>
    Array.from({ length: COLS }, (_, x) => Boolean(mask?.[y]?.[x])),
  );
}

const NO_CELLS: boolean[][] = Array.from({ length: ROWS }, () =>
  Array.from({ length: COLS }, () => false),
);

/** Pleasant resting face before the first spin. */
const IDLE_GRID: string[][] = Array.from({ length: ROWS }, () => [
  'plum',
  'grape',
  'seven',
  'grape',
  'plum',
]);

/** Pull column `x` (top→bottom) out of a row-major grid. */
function column<T>(grid: T[][], x: number): T[] {
  return grid.map((row) => row[x]);
}

// ── Reel animation tuning ───────────────────────────────────────────────────
const LEAD_IN = 16; // blur frames above the settling symbols
const BASE_DELAY = 0.1; // s — first column's stop delay
const STAGGER = 0.14; // s — extra delay per column (clatter L→R)
const BASE_DURATION = 0.75; // s — first column's glide
const DURATION_STEP = 0.16; // s — extra glide per column
const FLASH_MS = 560; // per-pattern highlight duration during the reveal

/** When the LAST column has come to rest (ms from spin start). */
function settleMs(): number {
  const lastDelay = BASE_DELAY + (COLS - 1) * STAGGER;
  const lastDuration = BASE_DURATION + (COLS - 1) * DURATION_STEP;
  return (lastDelay + lastDuration) * 1000 + 60;
}

/** Fresh blur frames per column — one new set per spin so no two look identical. */
function randomLeadIns(): string[][] {
  return Array.from({ length: COLS }, () =>
    Array.from(
      { length: LEAD_IN },
      () => SPIN_POOL[Math.floor(Math.random() * SPIN_POOL.length)],
    ),
  );
}

const STILL_LEAD_INS: string[][] = Array.from({ length: COLS }, () =>
  Array.from({ length: LEAD_IN }, () => strawberry),
);

// ── Reel column ─────────────────────────────────────────────────────────────
interface ReelColumnProps {
  /** The 3 final symbol names for this column (top→bottom). */
  finalColumn: string[];
  /** Which of the 3 visible cells are lit right now (top→bottom). */
  litColumn: boolean[];
  /** Blur frames (art urls) shown above the settling symbols this spin. */
  leadIn: string[];
  /** Column index — drives the staggered stop. */
  index: number;
  /** Measured cell size in px (square). 0 until first layout. */
  cellPx: number;
  /** true mid-spin (animated glide), false when settled (snap, no transition). */
  spinning: boolean;
}

function ReelColumn({
  finalColumn,
  litColumn,
  leadIn,
  index,
  cellPx,
  spinning,
}: ReelColumnProps) {
  const finalArt = finalColumn.map((name) => SYMBOL_ART[name] ?? strawberry);
  const strip = [...leadIn, ...finalArt];
  // Slide the strip up so its last ROWS frames sit in the visible window.
  const settleOffset = -(strip.length - ROWS) * cellPx;
  const delay = BASE_DELAY + index * STAGGER;
  const duration = BASE_DURATION + index * DURATION_STEP;

  return (
    <div className="relative overflow-hidden">
      {/* Square window: ROWS cells tall, full column wide. */}
      <div style={{ height: cellPx * ROWS }}>
        <div
          className="flex flex-col will-change-transform"
          style={{
            transform: `translateY(${settleOffset}px)`,
            transition: spinning
              ? `transform ${duration}s cubic-bezier(0.16, 0.86, 0.22, 1) ${delay}s`
              : 'none',
          }}
        >
          {strip.map((art, i) => {
            const settleRow = i - (strip.length - ROWS);
            const isSettle = settleRow >= 0;
            const lit = isSettle && !spinning && litColumn[settleRow];
            return (
              <div
                key={i}
                className="grid shrink-0 place-items-center p-[6%]"
                style={{ height: cellPx, width: cellPx }}
              >
                <span
                  className={clsx(
                    'grid size-full place-items-center rounded-lg transition-all duration-200',
                    lit
                      ? 'scale-105 bg-ton/20 ring-2 ring-ton shadow-[0_0_22px_-2px_var(--color-ton)]'
                      : 'ring-0',
                  )}
                >
                  <img
                    src={art}
                    alt=""
                    draggable={false}
                    className="size-[78%] select-none object-contain"
                  />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
const META = GAME_META.FRUITS;

type Phase = 'idle' | 'spinning' | 'revealing' | 'done';

export default function SlotsPage() {
  const round = useGameRound('FRUITS');

  // Bet (BetInput is controlled on the raw string).
  const [bet, setBet] = useState('');
  const [betValid, setBetValid] = useState(false);

  // Min bet from settings (defaults to 1 — matches FruitSettings; run validates too).
  const [minBet, setMinBet] = useState(1);
  useEffect(() => {
    let alive = true;
    getGameSettings<{ minBet: number }>('FRUITS')
      .then((s) => {
        if (alive && typeof s.minBet === 'number') setMinBet(s.minBet);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // What the reels show + which cells glow right now.
  const [grid, setGrid] = useState<string[][]>(IDLE_GRID);
  const [lit, setLit] = useState<boolean[][]>(NO_CELLS);
  const [leadIns, setLeadIns] = useState<string[][]>(STILL_LEAD_INS);

  // The round we're presenting (drives the payout + provably-fair reveal).
  const [shown, setShown] = useState<GameResult | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  // Measured square cell size, so the cabinet fills the available width but the
  // px-based strip translate stays exact.
  const reelsRef = useRef<HTMLDivElement>(null);
  const [cellPx, setCellPx] = useState(0);
  useEffect(() => {
    const el = reelsRef.current;
    if (!el) return;
    const measure = () => setCellPx(el.clientWidth / COLS);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // Every pending timer/loop for the current round, so a fresh spin (one click,
  // any time) tears them all down — this is what kills the double-click dead-screen.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const spinHandle = useRef<ReturnType<typeof sfx.startSpin> | null>(null);
  const clearAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    spinHandle.current?.stop();
    spinHandle.current = null;
  }, []);
  useEffect(() => clearAll, [clearAll]);

  const payout = shown ? Number(shown.result) : 0;
  const isWin = phase === 'done' && payout > 0;

  // Flash each winning pattern in the server's order (cheapest → most expensive):
  // light its cells + tick, fade, next. Then settle to the total and the win chord.
  const runReveal = useCallback(
    (result: GameResult) => {
      const spin = readSpin(result);
      // Reveal cheapest → most expensive by each line's actual payout (k). The
      // server already sorts ascending, but we sort by k explicitly so the order
      // is exactly "cheapest first" regardless of the server's compound ordering.
      const matches = spin
        ? [...spin.matches].sort((a, b) => Number(a.k) - Number(b.k))
        : [];

      if (matches.length === 0) {
        setLit(NO_CELLS);
        setPhase('done');
        sfx.lose();
        return;
      }

      setPhase('revealing');
      matches.forEach((m, i) => {
        timers.current.push(
          setTimeout(() => {
            setLit(patternCells(m.patternName));
            sfx.tick();
          }, i * FLASH_MS),
        );
      });
      // After the last flash: union-glow everything that won, total, win chord.
      timers.current.push(
        setTimeout(() => {
          setLit(unionCells(matches));
          setPhase('done');
          sfx.win();
        }, matches.length * FLASH_MS),
      );
    },
    [],
  );

  const spin = useCallback(async () => {
    if (round.busy || phase === 'spinning' || !betValid) return;

    // One click resets everything and starts fresh — no stale reveal can fire.
    clearAll();
    setShown(null);
    setLit(NO_CELLS);
    setLeadIns(randomLeadIns());
    setPhase('spinning');
    sfx.click();
    spinHandle.current = sfx.startSpin();

    let result: GameResult;
    try {
      result = await round.play({ bet });
    } catch {
      // useGameRound surfaced the error into round.error; stop the reels.
      clearAll();
      setPhase('idle');
      return;
    }

    const parsed = readSpin(result);
    const finalGrid = parsed ? parsed.grid : IDLE_GRID;

    // Lock the settling symbols in and let the strips glide to rest; once the last
    // column stops, cut the whirr and start the sequential pattern reveal.
    setGrid(finalGrid);
    setShown(result);

    timers.current.push(
      setTimeout(() => {
        spinHandle.current?.stop();
        spinHandle.current = null;
        runReveal(result);
      }, settleMs()),
    );
  }, [round, phase, betValid, bet, clearAll, runReveal]);

  const spinning = phase === 'spinning';
  const busy = round.busy || spinning;
  const canSpin = betValid && !busy;
  const playedOnce = phase === 'done';

  return (
    <div className="mx-auto w-full max-w-xl pb-10">
      <PageBack to="/games" label="К играм" className="mb-4" />

      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-2xl"
        >
          {META.emoji}
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            {META.name}
          </h1>
          <p className="text-sm text-muted">
            3×5 — соберите фигуру, вайлд заменит любой символ
          </p>
        </div>
      </div>

      {/* The cabinet — the centerpiece, fills the width */}
      <Card className="overflow-hidden p-3 sm:p-4">
        <div
          className={clsx(
            'rounded-2xl border border-edge bg-gradient-to-b from-panel-2 to-ink p-2.5 transition-shadow duration-300 sm:p-3',
            isWin && 'shadow-[0_0_48px_-12px_var(--color-ton)]',
          )}
        >
          {/* Reels — a 5-column grid of square cells spanning the full width. */}
          <div ref={reelsRef} className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {Array.from({ length: COLS }, (_, x) => (
              <ReelColumn
                key={x}
                index={x}
                finalColumn={column(grid, x)}
                litColumn={column(lit, x)}
                leadIn={leadIns[x]}
                cellPx={cellPx}
                spinning={spinning}
              />
            ))}
          </div>
        </div>

        {/* Outcome — one line, always framed as winnings (0, never a minus). */}
        <div className="mt-3 flex min-h-12 items-center justify-center text-center">
          {phase === 'done' ? (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs uppercase tracking-wide text-muted">
                Ваш выигрыш
              </span>
              <Amount
                value={shown?.result ?? 0}
                className={clsx('text-2xl font-bold', isWin && 'animate-[slotPop_360ms_ease-out]')}
              />
            </div>
          ) : phase === 'revealing' ? (
            <span className="text-sm text-muted">Считаем линии…</span>
          ) : spinning ? (
            <span className="text-sm text-muted">Крутим…</span>
          ) : (
            <span className="text-sm text-muted">Сделайте ставку и крутите</span>
          )}
        </div>

        {/* Controls */}
        <div className="mt-2 flex flex-col gap-3">
          <BetInput
            value={bet}
            onChange={setBet}
            min={minBet}
            onValidityChange={setBetValid}
            disabled={busy}
            error={round.status === 'error' ? (round.error ?? undefined) : undefined}
          />

          <Button
            size="lg"
            onClick={spin}
            loading={busy}
            disabled={!canSpin}
            className="w-full"
          >
            {!busy && <RotateCw size={18} aria-hidden className="shrink-0" />}
            {busy ? 'Крутим…' : playedOnce ? 'Крутить ещё' : 'Крутить'}
          </Button>
        </div>
      </Card>

      {/* Provably fair — tiny service link; reveals seeds once the round resolves. */}
      {(round.serverHash || shown) && (
        <ProvablyFair
          className="mt-4"
          serverHash={round.serverHash}
          serverSeed={phase === 'done' ? shown?.serverSeed : null}
          clientSeed={phase === 'done' ? shown?.clientSeed : null}
          verified={phase === 'done' ? round.verified : null}
        />
      )}

      {/* Scoped win-pop keyframe — no global CSS edits. */}
      <style>{`@keyframes slotPop{0%{transform:scale(.8);opacity:.5}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}

/** Union of every matched pattern's cells — the final all-wins glow. */
function unionCells(matches: PatternMatch[]): boolean[][] {
  const lit = NO_CELLS.map((row) => row.slice());
  for (const m of matches) {
    const mask = PATTERNS[m.patternName];
    if (!mask) continue;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (mask[y][x]) lit[y][x] = true;
      }
    }
  }
  return lit;
}
