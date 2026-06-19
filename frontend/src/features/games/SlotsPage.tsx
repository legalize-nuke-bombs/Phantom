// SlotsPage — the FRUITS game ("Фрукты"): a full-width 3×5 reel slot machine
// with reels that genuinely spin.
//
// Verified against the backend source (com.example.phantom.game.fruits.*,
// com.example.phantom.game.util.slot.*):
//
//   • GET  /api/games/fruits → FruitSettings { minBet (= 1), slots }.
//   • init data is just { bet } (string), bet ≥ minBet, no max.
//   • run → GameResult whose data map is:
//       { data: string[3][5] (row-major, data[y][x]), patternMatches: PatternMatch[] }
//     each PatternMatch = { patternName, slotName, patternK, slotK, k } (k = patternK·slotK).
//     result = bet·Σk.
//
// The reels are real: each of the 5 columns is a vertical strip of symbol art that
// scrolls upward and decelerates (ease-out, RAF) onto the returned grid, stopping
// staggered left→right. No instant substitution. After the reels rest the final
// grid simply stays shown — no cell glow, no jackpot flash, no "matches" panel.
//
// Sound is strictly per-pattern: one short start cue (sfx.startSpin) and nothing
// during the spin. On settle we walk the matched patterns in turn — sfx.bigWin()
// for a rich pattern (payout k ≥ RICH_PATTERN_K), sfx.smallWin() otherwise — and
// sfx.lose() when nothing matched.

import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';

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

import {
  ROWS,
  COLS,
  artOf,
  randomFiller,
  column,
  IDLE_GRID,
  FILLER_LEN,
  columnSpinMs,
  settleMs,
  easeOutQuint,
} from './slots/reel';

// ── Result shape (the run() data map) ───────────────────────────────────────
interface PatternMatch {
  patternName: string;
  slotName: string;
  patternK: number | string;
  slotK: number | string;
  /** This line's payout multiplier (patternK·slotK). */
  k: number | string;
}

interface SpinPayload {
  /** Row-major grid: grid[y][x]. */
  grid: string[][];
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

// ── Sound tuning ─────────────────────────────────────────────────────────────
/**
 * A pattern is "rich" (bigWin) at or above this payout multiplier, otherwise it
 * is a cheap line (smallWin). The cheap families pay k≤0.1 (columns/rows ·
 * common slots); the expensive families (arrows ·2, eye ·20, triangles ·25,
 * jackpot ·500, or any line carrying the seven/wild ·10 slot) clear 1. Threshold
 * sits above the cheap ceiling.
 */
const RICH_PATTERN_K = 1;
/** Gap between successive per-pattern sounds during the walk. */
const PATTERN_SOUND_GAP_MS = 280;

// ── Reel column ─────────────────────────────────────────────────────────────
interface ReelColumnProps {
  /** Full strip of art for this column: [...filler, top, mid, bottom]. */
  strip: string[];
  /** Current vertical offset in px (negative = scrolled up). */
  offset: number;
  /** Measured square cell size in px. 0 until first layout. */
  cellPx: number;
}

function ReelColumn({ strip, offset, cellPx }: ReelColumnProps) {
  return (
    <div className="relative overflow-hidden">
      {/* Square window: ROWS cells tall, full column wide. */}
      <div style={{ height: cellPx * ROWS }}>
        <div
          className="flex flex-col will-change-transform"
          style={{ transform: `translate3d(0, ${offset}px, 0)` }}
        >
          {strip.map((art, i) => (
            <div
              key={i}
              className="grid shrink-0 place-items-center p-[6%]"
              style={{ height: cellPx, width: cellPx }}
            >
              <img
                src={art}
                alt=""
                draggable={false}
                className="size-[78%] select-none object-contain"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
const META = GAME_META.FRUITS;

type Phase = 'idle' | 'spinning' | 'done';

/** Build a column strip from its final 3 symbol names (top→bottom). */
function buildStrip(finalColumn: string[]): string[] {
  return [...randomFiller(FILLER_LEN), ...finalColumn.map(artOf)];
}

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

  // Per-column strips (art) + live vertical offsets (px). Offsets are driven by a
  // single RAF loop; strips change only when a new spin is launched.
  const [strips, setStrips] = useState<string[][]>(() =>
    Array.from({ length: COLS }, (_, x) => buildStrip(column(IDLE_GRID, x))),
  );
  const [offsets, setOffsets] = useState<number[]>(() =>
    Array.from({ length: COLS }, () => 0),
  );

  // The round we're presenting (drives the payout + provably-fair reveal).
  const [shown, setShown] = useState<GameResult | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  // Measured square cell size, so the cabinet fills the width but the px-based
  // strip translate stays exact.
  const reelsRef = useRef<HTMLDivElement>(null);
  const [cellPx, setCellPx] = useState(0);
  const cellPxRef = useRef(0);
  useEffect(() => {
    const el = reelsRef.current;
    if (!el) return;
    const measure = () => {
      const px = el.clientWidth / COLS;
      cellPxRef.current = px;
      setCellPx(px);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // The rest offset puts the last ROWS frames of a strip in the visible window.
  const restOffset = useCallback(
    (stripLen: number) => -(stripLen - ROWS) * cellPxRef.current,
    [],
  );

  // ── Animation + cleanup machinery ──────────────────────────────────────────
  const rafRef = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const spinHandle = useRef<ReturnType<typeof sfx.startSpin> | null>(null);

  const clearAll = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    timers.current.forEach(clearTimeout);
    timers.current = [];
    spinHandle.current?.stop();
    spinHandle.current = null;
  }, []);
  useEffect(() => clearAll, [clearAll]);

  // Walk the matched patterns in the server's order, playing one sound each —
  // bigWin for a rich line, smallWin for a cheap one — or a single lose if empty.
  const playOutcomeSounds = useCallback((matches: PatternMatch[]) => {
    if (matches.length === 0) {
      sfx.lose();
      return;
    }
    matches.forEach((m, i) => {
      const rich = Number(m.k) >= RICH_PATTERN_K;
      timers.current.push(
        setTimeout(() => {
          if (rich) sfx.bigWin();
          else sfx.smallWin();
        }, i * PATTERN_SOUND_GAP_MS),
      );
    });
  }, []);

  // Drive all 5 columns from one RAF loop. Each column scrolls from a deep filler
  // offset up to its rest point, easing out, finishing at staggered times.
  const animate = useCallback(
    (finalStrips: string[][], result: GameResult) => {
      const start = performance.now();
      // Start each column scrolled to the very top of its strip (filler showing),
      // travelling down to the rest offset (final 3 in view).
      const starts = finalStrips.map(() => 0);
      const rests = finalStrips.map((s) => restOffset(s.length));
      const durations = finalStrips.map((_, x) => columnSpinMs(x));

      const tick = (now: number) => {
        const elapsed = now - start;
        const next = finalStrips.map((_, x) => {
          const t = Math.min(1, elapsed / durations[x]);
          const eased = easeOutQuint(t);
          return starts[x] + (rests[x] - starts[x]) * eased;
        });
        setOffsets(next);

        if (elapsed < settleMs()) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
          // Snap exactly to rest, end the spin, fire per-pattern sounds.
          setOffsets(finalStrips.map((s) => restOffset(s.length)));
          const parsed = readSpin(result);
          setPhase('done');
          playOutcomeSounds(parsed ? parsed.matches : []);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [restOffset, playOutcomeSounds],
  );

  const spin = useCallback(async () => {
    if (round.busy || phase === 'spinning' || !betValid) return;

    // One click resets everything — no stale loop/timer can fire.
    clearAll();
    setShown(null);
    setPhase('spinning');
    sfx.click();
    spinHandle.current = sfx.startSpin();

    let result: GameResult;
    try {
      result = await round.play({ bet });
    } catch {
      clearAll();
      setPhase('idle');
      return;
    }

    const parsed = readSpin(result);
    const finalGrid = parsed ? parsed.grid : IDLE_GRID;
    const finalStrips = Array.from({ length: COLS }, (_, x) =>
      buildStrip(column(finalGrid, x)),
    );

    setStrips(finalStrips);
    setShown(result);
    // Render the fresh strips (offset 0 = filler showing) before animating.
    setOffsets(Array.from({ length: COLS }, () => 0));
    animate(finalStrips, result);
  }, [round, phase, betValid, bet, clearAll, animate]);

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
        <div className="rounded-2xl border border-edge bg-gradient-to-b from-panel-2 to-ink p-2.5 sm:p-3">
          {/* Reels — a 5-column grid of square cells spanning the full width. */}
          <div ref={reelsRef} className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {Array.from({ length: COLS }, (_, x) => (
              <ReelColumn
                key={x}
                strip={strips[x]}
                offset={offsets[x]}
                cellPx={cellPx}
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
              <Amount value={shown?.result ?? 0} className="text-2xl font-bold" />
            </div>
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

      {/* Provably fair — always rendered; reveals seeds once the round resolves. */}
      <ProvablyFair
        className="mt-4"
        serverHash={round.serverHash}
        serverSeed={phase === 'done' ? shown?.serverSeed : null}
        clientSeed={phase === 'done' ? shown?.clientSeed : null}
        verified={phase === 'done' ? round.verified : null}
      />
    </div>
  );
}
