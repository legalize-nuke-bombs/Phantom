// SlotsPage — the FRUITS game ("Слоты"), a 3×5 reel slot machine.
//
// Verified against the backend source (com.example.phantom.game.fruits.*,
// com.example.phantom.game.util.slot.*):
//
//   • GET  /api/games/fruits        → FruitSettings { minBet, slots }.
//       We only need minBet (= 1). The reel/symbol/pattern model is fixed and
//       mirrored below (REELS = 3×5, PATTERNS) so we can light up exactly the
//       cells the server scored — without trusting any generated docs.
//   • init data is just { bet } (string). bet must be ≥ minBet; no max.
//   • run → GameRepresentation whose data map is:
//       { data: string[][3][5], patternMatches: PatternMatch[] }
//     where each PatternMatch is { patternName, slotName, patternK, slotK, k }
//     (k = patternK·slotK; BigDecimal → JSON number). result = bet · Σk.
//
// The whole round goes through useGameRound.play({ bet }) — one provably-fair
// handshake, balance refreshed inside the hook. We drive a CSS reel-spin that
// settles on the returned grid, then highlight the winning patterns and show the
// payout. WILD substitutes for any symbol (mirrors SimpleSlots.patternMatches).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, RotateCw, Info } from 'lucide-react';
import clsx from 'clsx';

import BetInput from '@/shared/ui/BetInput';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import Amount from '@/shared/ui/Amount';
import ProvablyFair from '@/shared/ui/ProvablyFair';
import { useGameRound } from '@/shared/lib/useGameRound';
import { getGameSettings } from '@/shared/lib/gameApi';
import type { GameResult } from '@/shared/lib/gameApi';
import { gameMeta } from '@/shared/lib/games';

import grape from '@/assets/symbols/grape.png';
import plum from '@/assets/symbols/plum.png';
import seven from '@/assets/symbols/seven.png';
import strawberry from '@/assets/symbols/strawberry.png';
import wild from '@/assets/symbols/wild.png';

// ── Reel model (mirrors FruitSlots / SimpleSlots) ───────────────────────────
const ROWS = 3;
const COLS = 5;

/** Slot art by backend slot name. WILD substitutes for any symbol. */
const SYMBOL_ART: Record<string, string> = {
  plum,
  grape,
  seven,
  wild,
};

/** Russian label per symbol — used in the result breakdown. */
const SYMBOL_LABEL: Record<string, string> = {
  plum: 'Слива',
  grape: 'Виноград',
  seven: 'Семёрка',
  wild: 'Вайлд',
};

/**
 * Symbols that can appear on the reels while they blur past, in rough order of
 * how often the server rolls them (plum/grape are common, seven/wild rare).
 * strawberry never lands (the backend has no such slot) — it's decorative
 * spin-fodder only, so the blur feels richer than four repeating frames.
 */
const SPIN_POOL = [plum, grape, plum, grape, strawberry, seven, plum, grape, wild, strawberry];

/**
 * The scoring patterns, mirrored from FruitSlots.registerPattern(...). The masks
 * are 3×5; a `1` marks a cell that belongs to the pattern. We use them only to
 * highlight the exact cells of a matched pattern — payouts always come from the
 * server (result.result), never recomputed here.
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

/** Russian label per pattern, for the win breakdown. */
const PATTERN_LABEL: Record<string, string> = {
  column1: 'Колонка 1',
  column2: 'Колонка 2',
  column3: 'Колонка 3',
  column4: 'Колонка 4',
  column5: 'Колонка 5',
  row1: 'Ряд 1',
  row2: 'Ряд 2',
  row3: 'Ряд 3',
  arrowUp: 'Стрелка вверх',
  arrowDown: 'Стрелка вниз',
  eye: 'Глаз',
  triangleUp: 'Треугольник вверх',
  triangleDown: 'Треугольник вниз',
  jackpot: 'Джекпот',
};

// ── Result shapes (the run() data map) ──────────────────────────────────────
interface PatternMatch {
  patternName: string;
  slotName: string;
  patternK: number;
  slotK: number;
  k: number;
}

/** Narrow the open result.data map to the slot spin payload, defensively. */
interface SpinPayload {
  grid: string[][];
  matches: PatternMatch[];
}

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

/**
 * A ROWS×COLS boolean mask of the cells that take part in ANY matched pattern —
 * the union of every matched pattern's mask. These are the cells we glow.
 */
function winningCells(matches: PatternMatch[]): boolean[][] {
  const lit: boolean[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => false),
  );
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

// ── Reel rendering ──────────────────────────────────────────────────────────
// Each column is a vertical strip: a randomized lead-in then the 3 settling
// symbols at the bottom. We translate the strip up so its last 3 frames land in
// the 3 visible rows; a per-column transition-delay makes them stop L→R.

const CELL = 64; // px — visible cell size (also the strip frame height)
const LEAD_IN = 14; // blur frames before the settling symbols

interface ReelColumnProps {
  /** The 3 final symbol names for this column (top→bottom). */
  finalColumn: string[];
  /** Which of the 3 final cells are winning (top→bottom). */
  winColumn: boolean[];
  /** Blur frames (art urls) shown above the settling symbols this spin. */
  leadIn: string[];
  /** Column index — drives the staggered stop. */
  index: number;
  /** Whether the reels are mid-spin (true) or settled (false). */
  spinning: boolean;
  /** Reveal win glow once everything has stopped. */
  landed: boolean;
}

function ReelColumn({
  finalColumn,
  winColumn,
  leadIn,
  index,
  spinning,
  landed,
}: ReelColumnProps) {
  // Full strip: blur frames + the 3 settling symbols (rendered as art below).
  const finalArt = finalColumn.map((name) => SYMBOL_ART[name] ?? strawberry);
  const strip = [...leadIn, ...finalArt];
  const settleOffset = -(strip.length - ROWS) * CELL;

  // Stagger: each column starts a touch later and runs a touch longer, so they
  // clatter to a stop left→right like a real cabinet.
  const delay = index * 0.14;
  const duration = 0.7 + index * 0.16;

  return (
    <div
      className="relative overflow-hidden rounded-lg bg-ink/70 ring-1 ring-edge"
      style={{ height: ROWS * CELL, width: CELL }}
    >
      {/* The moving strip. When spinning we slide to settleOffset with an eased
          transition; when idle we snap to it instantly (no transition) so the
          settled grid is just "there" before the next spin. */}
      <div
        className="flex flex-col will-change-transform"
        style={{
          transform: `translateY(${settleOffset}px)`,
          transition: spinning
            ? `transform ${duration}s cubic-bezier(0.18, 0.9, 0.24, 1) ${delay}s`
            : 'none',
        }}
      >
        {strip.map((art, i) => {
          // The settling symbols are the last ROWS frames of the strip.
          const settleRow = i - (strip.length - ROWS);
          const isSettle = settleRow >= 0;
          const isWin = isSettle && landed && winColumn[settleRow];
          return (
            <div
              key={i}
              className="grid shrink-0 place-items-center"
              style={{ height: CELL, width: CELL }}
            >
              <span
                className={clsx(
                  'grid place-items-center rounded-md transition-all duration-300',
                  isWin
                    ? 'bg-ton/15 ring-2 ring-ton shadow-[0_0_18px_-2px_var(--color-ton)]'
                    : 'ring-0',
                )}
                style={{ height: CELL - 12, width: CELL - 12 }}
              >
                <img
                  src={art}
                  alt=""
                  draggable={false}
                  className={clsx(
                    'h-9 w-9 select-none object-contain transition-opacity',
                    landed && isSettle && !isWin && 'opacity-45',
                  )}
                />
              </span>
            </div>
          );
        })}
      </div>

      {/* Top/bottom fade so the strip melts into the cabinet edges. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-ink/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-ink/80 to-transparent" />
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const IDLE_GRID: string[][] = Array.from({ length: ROWS }, () => [
  'plum',
  'grape',
  'seven',
  'grape',
  'plum',
]);

const NO_WINS: boolean[][] = Array.from({ length: ROWS }, () =>
  Array.from({ length: COLS }, () => false),
);

/** Pull column `x` (top→bottom) out of a row-major grid. */
function column<T>(grid: T[][], x: number): T[] {
  return grid.map((row) => row[x]);
}

/**
 * Fresh blur frames for every column, one new set per spin so two spins never
 * look identical. Impure (Math.random) by design — only ever called from the
 * spin event handler, never during render.
 */
function randomLeadIns(): string[][] {
  return Array.from({ length: COLS }, () =>
    Array.from(
      { length: LEAD_IN },
      () => SPIN_POOL[Math.floor(Math.random() * SPIN_POOL.length)],
    ),
  );
}

/** A column of LEAD_IN identical resting frames — the still face before a spin. */
const STILL_LEAD_INS: string[][] = Array.from({ length: COLS }, () =>
  Array.from({ length: LEAD_IN }, () => strawberry),
);

// ── Page ────────────────────────────────────────────────────────────────────
const META = gameMeta('FRUITS');

export default function SlotsPage() {
  const round = useGameRound('FRUITS');

  // Bet state (BetInput is controlled on the raw string).
  const [bet, setBet] = useState('1');
  const [betValid, setBetValid] = useState(false);

  // Min bet from settings (defaults to 1 until loaded — matches FruitSettings).
  const [minBet, setMinBet] = useState(1);
  useEffect(() => {
    let alive = true;
    getGameSettings<{ minBet: number }>('FRUITS')
      .then((s) => {
        if (alive && typeof s.minBet === 'number') setMinBet(s.minBet);
      })
      .catch(() => {
        /* keep the default min; the run call will still validate server-side */
      });
    return () => {
      alive = false;
    };
  }, []);

  // What the reels currently show. Updated from the latest result; the IDLE_GRID
  // is just a pleasant resting face before the first spin.
  const [grid, setGrid] = useState<string[][]>(IDLE_GRID);
  const [wins, setWins] = useState<boolean[][]>(NO_WINS);

  // Animation phase. `spinning` runs the strip transition; `landed` reveals the
  // win glow + payout once every column has stopped.
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);
  // Per-column blur frames; replaced with a fresh set at the start of each spin.
  const [leadIns, setLeadIns] = useState<string[][]>(STILL_LEAD_INS);

  // The result we're presenting (drives the payout + provably-fair reveal). We
  // hold it separately so the reveal only appears after the reels settle.
  const [shown, setShown] = useState<GameResult | null>(null);

  // Timer that flips `landed` after the last column stops — cleared on unmount /
  // restart so a quick re-spin never fires a stale reveal.
  const landTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (landTimer.current) clearTimeout(landTimer.current);
    },
    [],
  );

  const payout = shown ? Number(shown.result) : 0;
  const isWin = landed && payout > 0;

  const matches = useMemo<PatternMatch[]>(() => {
    if (!shown) return [];
    const spin = readSpin(shown);
    return spin ? spin.matches : [];
  }, [shown]);

  const spin = useCallback(async () => {
    if (round.busy || spinning || !betValid) return;

    // Start fresh: clear the previous reveal, kick the reels into motion with a
    // new set of blur frames.
    if (landTimer.current) clearTimeout(landTimer.current);
    setShown(null);
    setWins(NO_WINS);
    setLanded(false);
    setLeadIns(randomLeadIns());
    setSpinning(true);

    let result: GameResult;
    try {
      result = await round.play({ bet });
    } catch {
      // useGameRound has surfaced the error into round.error; stop the reels and
      // restore the previous face so the cabinet isn't stuck spinning.
      setSpinning(false);
      return;
    }

    const parsed = readSpin(result);
    const finalGrid = parsed ? parsed.grid : IDLE_GRID;
    const finalWins = parsed ? winningCells(parsed.matches) : NO_WINS;

    // Lock the settling symbols in, let the strips glide to their stop, then —
    // after the last column's delay+duration — reveal wins and the payout.
    setGrid(finalGrid);
    setShown(result);

    const lastDelay = (COLS - 1) * 0.14;
    const lastDuration = 0.7 + (COLS - 1) * 0.16;
    const settleMs = (lastDelay + lastDuration) * 1000 + 80;

    landTimer.current = setTimeout(() => {
      setSpinning(false);
      setWins(finalWins);
      setLanded(true);
    }, settleMs);
  }, [round, spinning, betValid, bet]);

  const canSpin = betValid && !round.busy && !spinning;

  return (
    <div className="mx-auto w-full max-w-xl pb-10">
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
            3×5 — соберите линию, и вайлд заменит любой символ
          </p>
        </div>
      </div>

      {/* The cabinet */}
      <Card className="overflow-hidden p-4 sm:p-5">
        <div
          className={clsx(
            'relative rounded-2xl border border-edge bg-gradient-to-b from-panel-2 to-ink p-3 sm:p-4',
            isWin && 'shadow-[0_0_40px_-12px_var(--color-ton)]',
          )}
        >
          {/* Reels */}
          <div className="flex justify-center gap-1.5 sm:gap-2">
            {Array.from({ length: COLS }, (_, x) => (
              <ReelColumn
                key={x}
                index={x}
                finalColumn={column(grid, x)}
                winColumn={column(wins, x)}
                leadIn={leadIns[x]}
                spinning={spinning}
                landed={landed}
              />
            ))}
          </div>

          {/* Payout banner — sits under the reels, reserved height so the layout
              never jumps between spins. */}
          <div className="mt-3 flex min-h-9 items-center justify-center">
            {landed && shown ? (
              isWin ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-win/10 px-3 py-1.5 text-sm font-semibold text-win">
                  <Sparkles size={15} aria-hidden />
                  Выигрыш <Amount value={shown.result} className="font-bold" />
                </span>
              ) : (
                <span className="rounded-full bg-panel px-3 py-1.5 text-sm text-muted">
                  Без выигрыша — крутите ещё
                </span>
              )
            ) : spinning ? (
              <span className="text-sm text-muted">Крутим…</span>
            ) : (
              <span className="text-sm text-muted">Сделайте ставку и крутите</span>
            )}
          </div>
        </div>

        {/* Win breakdown — which patterns hit and their multipliers. */}
        {landed && isWin && matches.length > 0 && (
          <WinBreakdown matches={matches} />
        )}

        {/* Controls */}
        <div className="mt-4 flex flex-col gap-3">
          <BetInput
            value={bet}
            onChange={setBet}
            min={minBet}
            onValidityChange={setBetValid}
            disabled={spinning || round.busy}
            error={round.status === 'error' ? round.error ?? undefined : undefined}
          />

          <Button
            size="lg"
            onClick={spin}
            loading={round.busy || spinning}
            disabled={!canSpin}
            className="w-full"
          >
            <RotateCw
              size={18}
              aria-hidden
              className={clsx('shrink-0', (spinning || round.busy) && 'animate-spin')}
            />
            {spinning || round.busy ? 'Крутится…' : 'Крутить'}
          </Button>
        </div>
      </Card>

      {/* Paytable hint */}
      <Paytable />

      {/* Provably fair — appears with the committed hash, then reveals seeds. */}
      {(round.serverHash || shown) && (
        <ProvablyFair
          className="mt-4"
          serverHash={round.serverHash}
          serverSeed={landed ? shown?.serverSeed : null}
          clientSeed={landed ? shown?.clientSeed : null}
          verified={landed ? round.verified : null}
        />
      )}
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────

/** Breakdown of every matched pattern: pattern · symbol · ×multiplier. */
function WinBreakdown({ matches }: { matches: PatternMatch[] }) {
  // Best (highest k) first — that's the line the player cares about.
  const ordered = [...matches].sort((a, b) => Number(b.k) - Number(a.k));
  return (
    <div className="mt-3 rounded-xl border border-edge bg-panel-2/60 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
        <Sparkles size={13} className="text-ton" aria-hidden />
        Совпадения ({ordered.length})
      </div>
      <ul className="flex flex-col gap-1.5">
        {ordered.map((m, i) => (
          <li
            key={`${m.patternName}-${m.slotName}-${i}`}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="flex items-center gap-2 text-fg">
              <img
                src={SYMBOL_ART[m.slotName] ?? strawberry}
                alt=""
                draggable={false}
                className="size-5 select-none object-contain"
              />
              <span className="text-muted">
                {PATTERN_LABEL[m.patternName] ?? m.patternName}
                {' · '}
                {SYMBOL_LABEL[m.slotName] ?? m.slotName}
              </span>
            </span>
            <span className="font-mono font-semibold text-ice">
              ×{formatK(Number(m.k))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Static paytable / rules, collapsible to stay out of the way. */
function Paytable() {
  const [open, setOpen] = useState(false);
  const rows: { art: string; label: string; note: string }[] = [
    { art: wild, label: SYMBOL_LABEL.wild, note: 'заменяет любой символ' },
    { art: seven, label: SYMBOL_LABEL.seven, note: 'самый ценный символ' },
    { art: grape, label: SYMBOL_LABEL.grape, note: 'частый символ' },
    { art: plum, label: SYMBOL_LABEL.plum, note: 'частый символ' },
  ];
  return (
    <div className="mt-4 rounded-xl border border-edge bg-panel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <Info size={16} className="shrink-0 text-ton" aria-hidden />
        <span className="text-sm font-medium text-fg">Как это работает</span>
        <span
          className={clsx(
            'ml-auto text-xs text-muted transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-edge px-3 py-3">
          <p className="text-xs leading-relaxed text-muted">
            Выпадает поле 3×5. Выигрыш даёт совпадение символов по линии или
            фигуре (ряды, колонки, стрелки, глаз, треугольники и джекпот — всё
            поле). Чем реже фигура и символ, тем выше множитель; итог умножается
            на ставку. Вайлд подставляется под любой символ.
          </p>
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center gap-2 text-sm">
                <img
                  src={r.art}
                  alt=""
                  draggable={false}
                  className="size-6 select-none object-contain"
                />
                <span className="text-fg">{r.label}</span>
                <span className="text-xs text-muted">— {r.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Multiplier formatting: up to 2 decimals, trailing zeros trimmed (×0.05, ×2, ×500). */
function formatK(k: number): string {
  if (!Number.isFinite(k)) return '0';
  return k.toFixed(2).replace(/\.?0+$/, '');
}
