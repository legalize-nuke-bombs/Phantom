// caseModel — shared model + UI for the CASES game, used by both the picker
// (CasesPage) and the open screen (CaseOpenPage).
//
// Backend source of truth (com.example.phantom.game.cases.*):
//   • GET  /api/games/cases       → CaseSettings { cases: [{ name, cost, size, data }] }
//       where `data` maps prizeAmount(decimal string) → weight(count); `cost` is the
//       case price computed server-side (EV ÷ 0.9). We never send a bet for cases.
//   • POST /api/games/cases/init  { data: { caseName } }   → commit serverHash
//   • POST /api/games/cases/run   { clientSeed }           → GameResult
//       result = the won amount (one of the case's prize tiers); data = { caseName }.
//   The prize amounts are exactly the finance-tier thresholds, so each prize colours
//   by amountTier() out of the box.
//
// This module owns the types, buildCaseView, useCases, the animated Reel (with the
// replay-speed fix preserved), ReelTile, the per-tier colouring helpers, and the
// tier-row contents renderer shared by both pages.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import clsx from 'clsx';
import { getGameSettings } from '@/shared/lib/gameApi';
import type { GameResult } from '@/shared/lib/gameApi';
import { useQuery } from '@tanstack/react-query';
import {
  amountTier,
  tierTextClass,
  useFinanceColors,
} from '@/shared/lib/financeColors';
import type { FinanceTier, Thresholds } from '@/shared/lib/financeColors';
import Amount from '@/shared/ui/Amount';

// ── Backend shapes (CaseSettings → Case) ──────────────────────────────────────
// BigDecimals serialize as numbers or strings depending on Jackson; we normalize
// at the edges and keep money as decimal strings for <Amount>.

interface CaseDto {
  name: string;
  /** Case price (USD). May arrive as a number or a string. */
  cost: number | string;
  /** Total tickets in the case (sum of weights). */
  size: number;
  /** prizeAmount → weight. Keys are decimal strings (TreeMap<BigDecimal,Integer>). */
  data: Record<string, number>;
}

interface CaseSettingsDto {
  cases: CaseDto[];
}

/** One prize tier of a case: its payout, drop weight, and colour tier. */
export interface Prize {
  /** Payout as a decimal string (passed straight to <Amount>). */
  amount: string;
  value: number;
  /** Number of tickets in the case (the raw weight). */
  weight: number;
  /** Drop chance in [0,1]. */
  chance: number;
  tier: FinanceTier;
}

/** A case with its prize tiers resolved for display + the reel. */
export interface CaseView {
  name: string;
  cost: string;
  size: number;
  /** Prize tiers, sorted BEST → worst (highest payout first) — reel filler order. */
  prizes: Prize[];
  /** The biggest payout in the case. */
  top: Prize;
}

function buildCaseView(dto: CaseDto, thresholds: Thresholds): CaseView {
  const size = dto.size || Object.values(dto.data).reduce((a, b) => a + b, 0);
  const prizes: Prize[] = Object.entries(dto.data)
    .map(([amount, weight]) => {
      const value = Number(amount);
      return {
        amount,
        value,
        weight,
        chance: size > 0 ? weight / size : 0,
        tier: amountTier(value, thresholds),
      };
    })
    .sort((a, b) => b.value - a.value);

  return {
    name: dto.name,
    cost: String(dto.cost),
    size,
    prizes,
    top: prizes[0],
  };
}

export function useCases() {
  const { data: thresholds } = useFinanceColors();
  return useQuery({
    queryKey: ['games', 'cases', 'settings'],
    queryFn: () => getGameSettings<CaseSettingsDto>('CASES'),
    staleTime: 1000 * 60 * 30, // the case list is effectively static
    select: (dto) => dto.cases.map((c) => buildCaseView(c, thresholds)),
  });
}

// ── Tier colouring ────────────────────────────────────────────────────────────
// The text colour comes from tierTextClass(); the row/tile background is a very
// dark wash of the same hue, mixed against the ink panel via color-mix so it stays
// subtle in the dark theme. Helper returns inline styles (no new utilities needed).

const TIER_VAR: Record<FinanceTier, string> = {
  grey: 'var(--color-tier-grey)',
  blue: 'var(--color-tier-blue)',
  purple: 'var(--color-tier-purple)',
  pink: 'var(--color-tier-pink)',
  red: 'var(--color-tier-red)',
  gold: 'var(--color-tier-gold)',
};

/** Inline style for a faint tier-tinted plate (dark wash + hairline of the hue). */
export function tierPlateStyle(tier: FinanceTier): CSSProperties {
  const c = TIER_VAR[tier];
  return {
    backgroundColor: `color-mix(in srgb, ${c} 9%, transparent)`,
    borderColor: `color-mix(in srgb, ${c} 22%, transparent)`,
  };
}

// ── Contents rows (one full-width tier plate per prize, worst → best) ────────────

/**
 * The case contents as full-width rows, sorted worst → best (cheapest first). Each
 * row is a tier-tinted plate: prize amount (tier-coloured) on the left, drop chance
 * (muted %) on the right. No "max prize" headline.
 */
export function ContentsRows({ prizes }: { prizes: Prize[] }) {
  // prizes are stored best → worst; show worst → best (cheapest first).
  const items = useMemo(() => [...prizes].reverse(), [prizes]);
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((p) => (
        <div
          key={p.amount}
          style={tierPlateStyle(p.tier)}
          className="flex items-center justify-between rounded-lg border px-3 py-2"
        >
          <span
            className={clsx(
              'text-sm font-semibold tabular-nums',
              tierTextClass(p.tier),
            )}
          >
            <Amount value={p.amount} />
          </span>
          <span className="text-xs font-medium tabular-nums text-muted">
            {(p.chance * 100).toFixed(p.chance < 0.01 ? 2 : 1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Reel ──────────────────────────────────────────────────────────────────────
// A horizontal strip of weighted-random prize tiles with the *winning* tile planted
// near the end, under a fixed centre marker. We animate translateX with a RAF
// easing curve so the strip glides to a stop exactly on the won amount.

const TILE_W = 92; // px, must match the rendered tile width below
const GAP = 8; // px gap between tiles (matches `gap-2`)
const CELL = TILE_W + GAP;
const STRIP_LEN = 56; // total tiles on the strip
const WIN_INDEX = STRIP_LEN - 6; // where the winning tile sits (leave a little tail)
const SPIN_MS = 4200;

/** Pick a prize by weight — fills the reel with believable filler tiles. */
function weightedPick(prizes: Prize[]): Prize {
  const total = prizes.reduce((a, p) => a + p.weight, 0);
  let r = Math.random() * total;
  for (const p of prizes) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return prizes[prizes.length - 1];
}

function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

interface ReelProps {
  caseView: CaseView;
  /** The resolved round (null until done) — its result plants the winning tile. */
  result: GameResult | null;
  spinning: boolean;
  /** Fired once the strip finishes decelerating onto the winning tile. */
  onSettled: () => void;
}

export function Reel({ caseView, result, spinning, onSettled }: ReelProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(0);

  // Keep the viewport width so we can centre the winning tile precisely.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewport(el.clientWidth));
    ro.observe(el);
    setViewport(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // The winning tile carries the actual won amount; everything else is weighted
  // filler. Resolved from the case's prizes (fallback synthesises one for an amount
  // the case somehow doesn't list, e.g. a future tier).
  const winValue = result ? Number(result.result) : null;
  const winPrize = useMemo<Prize>(() => {
    if (winValue == null) return caseView.top;
    return (
      caseView.prizes.find((p) => p.value === winValue) ?? {
        amount: result!.result,
        value: winValue,
        weight: 0,
        chance: 0,
        tier: 'grey',
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winValue, caseView, result?.id]);

  const tiles = useMemo<Prize[]>(() => {
    const out: Prize[] = [];
    for (let i = 0; i < STRIP_LEN; i++) {
      out.push(i === WIN_INDEX ? winPrize : weightedPick(caseView.prizes));
    }
    return out;
    // Reshuffle per round (result id) and per case.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseView.name, result?.id, winPrize]);

  // The translateX that lands the winning tile's centre under the viewport centre.
  const targetX = useMemo(() => {
    if (!viewport) return 0;
    const tileCentre = WIN_INDEX * CELL + TILE_W / 2;
    return viewport / 2 - tileCentre;
  }, [viewport]);

  // Resting offset before a spin: a couple of tiles in from the left, idle.
  const restX = -2 * CELL;

  // Hold the live transform in a ref so a phase change continues from wherever the
  // strip currently is (no snap-back) and onSettled fires from a stable callback.
  const xRef = useRef(restX);
  const setX = useCallback((x: number) => {
    xRef.current = x;
    const track = trackRef.current;
    if (track) track.style.transform = `translate3d(${x}px,0,0)`;
  }, []);
  const settledRef = useRef(onSettled);
  useEffect(() => {
    settledRef.current = onSettled;
  }, [onSettled]);

  // Two RAF stages, both keyed off `spinning` + `winValue`:
  //   1. spinning, result not in yet → free-scroll left at constant speed
  //   2. result known                → ease-out from the current x onto targetX
  // Splitting them means a result arriving mid-spin doesn't restart the motion — it
  // hands off from a steady scroll into the deceleration.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    // Not in a round: park idle (after a reset) — but keep a landed strip put.
    if (!spinning) {
      if (winValue == null) setX(restX);
      return;
    }
    if (!viewport) return;

    let raf = 0;

    if (winValue == null) {
      // Stage 1 — free scroll left while we wait for the server result. Start from the
      // idle rest position EVERY spin so a replay scrolls the full strip: otherwise it
      // would begin at the previous landed tile (a hair from the target) and barely
      // move. Capped a few cells short of the winning tile so there's always room for
      // the Stage-2 deceleration; if the result is slow we idle at the cap (no jump).
      setX(restX);
      const cap = targetX + CELL * 8;
      let last = performance.now();
      const speed = CELL / 26; // px per ms — brisk but readable
      const loop = (now: number) => {
        const dt = now - last;
        last = now;
        const x = Math.max(cap, xRef.current - speed * dt);
        setX(x);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } else {
      // Stage 2 — decelerate from the current position onto the winning tile.
      const from = xRef.current;
      const to = targetX;
      const start = performance.now();
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        setX(to);
        settledRef.current();
      };
      const ease = (now: number) => {
        const t = Math.min(1, (now - start) / SPIN_MS);
        const x = from + (to - from) * easeOutQuint(t);
        setX(x);
        // The easeOutQuint tail is visually flat: once the tile is within a fraction
        // of a pixel of centre the rest of the motion is imperceptible. Finish then
        // instead of burning the remaining SPIN_MS, so onSettled fires when the strip
        // *looks* stopped — not ~0.5s later (the perceived end-of-animation lag).
        if (t < 1 && Math.abs(to - x) > 0.6) {
          raf = requestAnimationFrame(ease);
        } else {
          finish();
        }
      };
      raf = requestAnimationFrame(ease);
    }

    return () => cancelAnimationFrame(raf);
  }, [spinning, viewport, targetX, winValue, result?.id, setX, restX]);

  const landed = !spinning && winValue != null;

  return (
    <div
      ref={wrapRef}
      className="relative h-24 overflow-hidden rounded-xl border border-edge bg-ink"
    >
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-ink to-transparent" />

      {/* centre marker */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2">
        <div className="h-full w-0.5 bg-ton shadow-[0_0_14px_3px] shadow-ton/60" />
      </div>

      {/* the moving track */}
      <div
        ref={trackRef}
        className="absolute inset-y-0 left-0 flex items-center gap-2 will-change-transform"
        style={{ transform: `translate3d(${restX}px,0,0)` }}
      >
        {tiles.map((p, i) => (
          <ReelTile key={i} prize={p} highlight={landed && i === WIN_INDEX} />
        ))}
      </div>
    </div>
  );
}

/** One reel cell — amount centred, tinted by the prize's tier. No emoji. */
function ReelTile({ prize, highlight }: { prize: Prize; highlight: boolean }) {
  return (
    <div
      style={{ width: TILE_W }}
      className={clsx(
        'grid h-16 shrink-0 place-items-center rounded-lg border bg-panel-2 transition-all',
        highlight ? 'border-ton bg-panel-2 ring-2 ring-ton/50' : 'border-edge',
      )}
    >
      <span
        className={clsx(
          'text-sm font-semibold tabular-nums',
          tierTextClass(prize.tier),
          highlight && 'scale-110',
        )}
      >
        <Amount value={prize.amount} />
      </span>
    </div>
  );
}
