// SlotsPage — the FRUITS game ("Fruits"): a full-width 3×5 reel slot machine
// with reels that genuinely spin.
//
// Verified against the backend (com.example.phantom.game.fruits.*,
// com.example.phantom.game.util.slot.*):
//   • GET  /api/games/fruits → { minBet, slots: { data: { slots, patterns } } }
//       patterns[name] = { name, k, data: number[3][5] } — the cell mask, straight
//       from the API (no client-side guessing).
//   • run → GameResult whose data map is:
//       { data: string[3][5] (row-major, data[y][x]), patternMatches: PatternMatch[] }
//     each PatternMatch = { patternName, slotName, patternK, slotK, k = patternK·slotK }.
//     patternMatches arrive ordered by value — i.e. the order to reveal them in.
//
// The reels are real: each column is a vertical strip of symbol art that scrolls
// up and decelerates (ease-out, RAF) onto the returned grid, stopping staggered
// L→R. After they rest the final grid stays shown — then we WALK the winning
// patterns one by one (~0.5s apart): each lights up its own cells (from the API
// mask) and plays one SHORT cue — bigWin for a rich line, smallWin for a cheap one,
// or a single lose if nothing matched. No permanent glow, no jackpot flash.

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

import {
  ROWS,
  COLS,
  artOf,
  randomFiller,
  loopingFiller,
  column,
  IDLE_GRID,
  FILLER_LEN,
  SPIN_TILE_LEN,
  SPIN_TILE_REPEATS,
  columnSpinMs,
  settleMs,
  easeOutQuint,
  FREE_SCROLL_PX_PER_MS_PER_CELL,
} from './slots/reel';

// ── Backend shapes ───────────────────────────────────────────────────────────
interface PatternMatch {
  patternName: string;
  slotName: string;
  patternK: number | string;
  slotK: number | string;
  /** This line's payout multiplier (patternK·slotK). */
  k: number | string;
}

interface FruitSettings {
  minBet: number;
  slots: { data: { patterns: Record<string, { name: string; k: number | string; data: number[][] }> } };
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

// ── Tuning ─────────────────────────────────────────────────────────────────
/** Gap between successive pattern reveals (light-up + short sound + sum bump). */
const PATTERN_STEP_MS = 760;

// ── Reel column ─────────────────────────────────────────────────────────────
interface ReelColumnProps {
  /** Full strip of art for this column: [...filler, top, mid, bottom]. */
  strip: string[];
  /** Current vertical offset in px (negative = scrolled up). */
  offset: number;
  /** Measured square cell size in px. 0 until first layout. */
  cellPx: number;
  /** Per-row light-up for this column's 3 result cells (null = none). */
  highlight: boolean[] | null;
}

function ReelColumn({ strip, offset, cellPx, highlight }: ReelColumnProps) {
  const finalStart = strip.length - ROWS; // first index of the result window
  return (
    <div className="relative overflow-hidden rounded-lg bg-ink/40">
      {/* Square window: ROWS cells tall, full column wide. */}
      <div style={{ height: cellPx * ROWS }}>
        <div
          className="flex flex-col will-change-transform"
          style={{ transform: `translate3d(0, ${offset}px, 0)` }}
        >
          {strip.map((art, i) => {
            const fy = i - finalStart; // 0..ROWS-1 for the result cells, <0 for filler
            const lit = fy >= 0 && !!highlight?.[fy];
            return (
              <div
                key={i}
                className="grid w-full shrink-0 place-items-center p-[6%]"
                style={{ height: cellPx }}
              >
                <div
                  className={clsx(
                    'grid size-full place-items-center rounded-md transition-colors duration-150',
                    lit && 'bg-ton/15 ring-2 ring-ton',
                  )}
                >
                  <img
                    src={art}
                    alt=""
                    draggable={false}
                    className="size-[80%] select-none object-contain"
                  />
                </div>
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

  // Settings: min bet + the pattern masks (name → 3×5 grid), from the API.
  const [minBet, setMinBet] = useState(1);
  const patternsRef = useRef<Record<string, number[][]>>({});
  useEffect(() => {
    let alive = true;
    getGameSettings<FruitSettings>('FRUITS')
      .then((s) => {
        if (!alive) return;
        if (typeof s.minBet === 'number') setMinBet(s.minBet);
        const pats = s.slots?.data?.patterns;
        if (pats) {
          const masks: Record<string, number[][]> = {};
          for (const [name, p] of Object.entries(pats)) {
            if (Array.isArray(p?.data)) masks[name] = p.data;
          }
          patternsRef.current = masks;
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Per-column strips (art) + live vertical offsets (px).
  const [strips, setStrips] = useState<string[][]>(() =>
    Array.from({ length: COLS }, (_, x) => buildStrip(column(IDLE_GRID, x))),
  );
  const [offsets, setOffsets] = useState<number[]>(() =>
    Array.from({ length: COLS }, () => 0),
  );

  // Light-up of the winning cells during the per-pattern walk (null = none).
  const [highlight, setHighlight] = useState<boolean[][] | null>(null);

  // Running winnings shown during the walk: starts at 0 and climbs by each
  // pattern's contribution (bet × its k) as it lights up. Lands on result.result.
  const [winShown, setWinShown] = useState(0);

  // The round we're presenting (drives the payout + provably-fair reveal).
  const [shown, setShown] = useState<GameResult | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  // Measured square cell size (= true column width, gap-aware) so the cabinet fills
  // the width while the px-based strip translate stays exact and cells stay square.
  const reelsRef = useRef<HTMLDivElement>(null);
  const [cellPx, setCellPx] = useState(0);
  const cellPxRef = useRef(0);
  useEffect(() => {
    const el = reelsRef.current;
    if (!el) return;
    const measure = () => {
      const gap = parseFloat(getComputedStyle(el).columnGap || '0') || 0;
      const px = (el.clientWidth - (COLS - 1) * gap) / COLS;
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

  const clearAll = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearAll, [clearAll]);

  /** Boolean mask for a pattern name (from the API), or null if unknown. */
  const maskOf = useCallback((name: string): boolean[][] | null => {
    const m = patternsRef.current[name];
    return m ? m.map((row) => row.map((v) => v === 1)) : null;
  }, []);

  // Walk the matched patterns in the server's (value) order: light each one's cells,
  // play one short cue, and add its contribution (bet × its k) to the running win —
  // so the shown sum climbs from 0 to result.result across the walk. ~0.76s apart.
  // A single lose if nothing matched.
  const walkOutcome = useCallback(
    (matches: PatternMatch[], betAmount: number, total: number) => {
      setWinShown(0);
      if (matches.length === 0) {
        sfx.lose();
        return;
      }
      let running = 0;
      matches.forEach((m, i) => {
        const isLast = i === matches.length - 1;
        timers.current.push(
          setTimeout(() => {
            setHighlight(maskOf(m.patternName));
            // Snap to the exact server total on the final reveal (avoids fp drift).
            running = isLast ? total : running + betAmount * Number(m.k);
            setWinShown(running);
            sfx.match(Number(m.k));
          }, i * PATTERN_STEP_MS),
        );
      });
      // Leave the final (most valuable) pattern lit after the walk — it stays
      // highlighted until the next spin (spin() resets highlight to null).
    },
    [maskOf],
  );

  // Live per-column offsets, mirrored in a ref so the deceleration can hand off from
  // wherever the free-scroll currently is (no snap).
  const offsetsRef = useRef<number[]>(Array.from({ length: COLS }, () => 0));
  const applyOffsets = useCallback((next: number[]) => {
    offsetsRef.current = next;
    setOffsets(next);
  }, []);

  // Stage 1 — free scroll: each column whirls upward forever at constant speed while
  // we wait for the server. Started immediately on click, so there's no static pause
  // before motion. Cleared by clearAll / handoff.
  //
  // The strip is one random tile repeated (loopingFiller), so wrapping the offset by
  // EXACTLY one tile height lands each scrolled-in cell on the identical scrolled-out
  // one — a truly seamless loop. The offset itself stays a continuous float (no
  // per-frame quantization, which would stutter); the cell-aligned period is what
  // makes the eye read one smooth, continuous reel instead of chaotic noise.
  const startFreeScroll = useCallback(() => {
    const cell = () => cellPxRef.current || 1;
    // One full tile is the loop period; wrapping by it is invisible.
    const wrap = () => SPIN_TILE_LEN * cell();
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      const speed = FREE_SCROLL_PX_PER_MS_PER_CELL * cell(); // px/ms
      const w = wrap();
      const next = offsetsRef.current.map((o) => {
        // scroll up (more negative); wrap back into (-w, 0] so it never runs off.
        let v = o - speed * dt;
        if (v <= -w) v += w;
        return v;
      });
      applyOffsets(next);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [applyOffsets]);

  // Stage 2 — deceleration: swap in the final strips and ease each column from its
  // current (free-scroll) offset onto its rest point, staggered L→R.
  const decelerate = useCallback(
    (finalStrips: string[][], result: GameResult, betAmount: number) => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const rests = finalStrips.map((s) => restOffset(s.length));
      // Hand off from the live whirl with NO snap: the wrapped offset sits within one
      // tile above the top of the (random) filler, and the rest sits a full FILLER_LEN
      // below it, so we glide straight down onto rest. Guarantee a minimum travel so a
      // column caught right at the wrap still decelerates visibly — shifting it up by
      // whole TILES keeps the swap onto the final strip's filler invisible.
      const cell = cellPxRef.current || 1;
      const tile = SPIN_TILE_LEN * cell;
      const minTravel = 6 * cell;
      const from = offsetsRef.current.map((o, x) => {
        let v = o;
        while (v - rests[x] < minTravel) v += tile;
        return v;
      });
      const durations = finalStrips.map((_, x) => columnSpinMs(x));
      const start = performance.now();

      const tick = (now: number) => {
        const elapsed = now - start;
        const next = finalStrips.map((_, x) => {
          const t = Math.min(1, elapsed / durations[x]);
          return from[x] + (rests[x] - from[x]) * easeOutQuint(t);
        });
        applyOffsets(next);

        // Finish the moment the reels are visually at rest (every column within a
        // pixel of its stop), not at the full eased duration — easeOutQuint's flat
        // tail is imperceptible and otherwise leaves the result feeling ~0.5s laggy.
        const atRest = next.every((v, x) => Math.abs(v - rests[x]) < 0.6);

        if (!atRest && elapsed < settleMs()) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
          applyOffsets(rests);
          const parsed = readSpin(result);
          setPhase('done');
          walkOutcome(
            parsed ? parsed.matches : [],
            betAmount,
            Number(result.result) || 0,
          );
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [restOffset, walkOutcome, applyOffsets],
  );

  const spin = useCallback(async () => {
    if (round.busy || phase === 'spinning' || !betValid) return;

    // One click resets everything — no stale loop/timer/highlight can fire.
    clearAll();
    setHighlight(null);
    setWinShown(0);
    setShown(null);
    setPhase('spinning');
    sfx.startSpin();

    // Fresh seamless looping strips and start whirling RIGHT AWAY — don't wait for the
    // server. Each is its own random tile, so the 5 columns scroll independently.
    const fillerStrips = Array.from({ length: COLS }, () =>
      loopingFiller(SPIN_TILE_REPEATS),
    );
    setStrips(fillerStrips);
    applyOffsets(Array.from({ length: COLS }, () => 0));
    startFreeScroll();

    const betAmount = Number(bet) || 0;

    let result: GameResult;
    try {
      result = await round.play({ bet });
    } catch {
      clearAll();
      applyOffsets(Array.from({ length: COLS }, () => 0));
      setPhase('idle');
      return;
    }

    const parsed = readSpin(result);
    const finalGrid = parsed ? parsed.grid : IDLE_GRID;
    // Final strips: same filler length so the rest point lines up with the whirl,
    // with the column's resolved 3 symbols planted at the bottom.
    const finalStrips = Array.from({ length: COLS }, (_, x) =>
      buildStrip(column(finalGrid, x)),
    );

    setStrips(finalStrips);
    setShown(result);
    decelerate(finalStrips, result, betAmount);
  }, [
    round,
    phase,
    betValid,
    bet,
    clearAll,
    applyOffsets,
    startFreeScroll,
    decelerate,
  ]);

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
                highlight={highlight ? column(highlight, x) : null}
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
              <Amount value={winShown} className="text-2xl font-bold" />
            </div>
          ) : null}
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
            {!busy && (playedOnce ? 'Крутить ещё' : 'Крутить')}
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
