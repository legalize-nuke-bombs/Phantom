// CasesPage — the CASES game (/games/cases).
//
// Flow (verified against com.example.phantom.game.cases.*):
//   • GET  /api/games/cases       → CaseSettings { cases: [{ name, cost, size, data }] }
//       where `data` maps prizeAmount(decimal string) → weight(count); `cost` is the
//       case price computed server-side (EV ÷ 0.9). We never send a bet for cases.
//   • POST /api/games/cases/init  { data: { caseName } }   → commit serverHash
//   • POST /api/games/cases/run   { clientSeed }           → GameResult
//       result = the won amount (one of the case's prize tiers); data = { caseName }.
//   The prize amounts are exactly the finance-tier thresholds (0.1/1/15/100/1000),
//   so each prize colours by amountTier() out of the box.
//
// One screen: a compact case picker (tabs) drives a focused case below it — its
// reel + open button + its contents grid (sorted worst → best, tinted by the
// prize's tier). useGameRound('CASES').play({ caseName }) charges the case cost
// server-side, verifies the provably-fair hash, and refreshes the wallet. The reel
// is a RAF strip that decelerates onto the won amount; on landing we show the
// winnings ("Ваш выигрыш", 0 if nothing — never a loss/minus). Mobile-first.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { getGameSettings } from '@/shared/lib/gameApi';
import type { GameResult } from '@/shared/lib/gameApi';
import { useGameRound } from '@/shared/lib/useGameRound';
import { errorMessage } from '@/shared/api/errors';
import { GAME_META } from '@/shared/lib/games';
import { sfx } from '@/shared/lib/sound';
import type { SpinHandle } from '@/shared/lib/sound';
import { amountTier, tierTextClass, useFinanceColors } from '@/shared/lib/financeColors';
import type { FinanceTier, Thresholds } from '@/shared/lib/financeColors';
import { useQuery } from '@tanstack/react-query';
import Amount from '@/shared/ui/Amount';
import Button from '@/shared/ui/Button';
import Spinner from '@/shared/ui/Spinner';
import ProvablyFair from '@/shared/ui/ProvablyFair';
import PageBack from '@/shared/ui/PageBack';

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
interface Prize {
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
interface CaseView {
  name: string;
  cost: string;
  size: number;
  /** Prize tiers, sorted BEST → worst (highest payout first) — used for the headline + reel filler. */
  prizes: Prize[];
  /** The biggest payout in the case — the card headline. */
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

function useCases() {
  const { data: thresholds } = useFinanceColors();
  return useQuery({
    queryKey: ['games', 'cases', 'settings'],
    queryFn: () => getGameSettings<CaseSettingsDto>('CASES'),
    staleTime: 1000 * 60 * 30, // the case list is effectively static
    select: (dto) => dto.cases.map((c) => buildCaseView(c, thresholds)),
  });
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

function Reel({ caseView, result, spinning, onSettled }: ReelProps) {
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
      const ease = (now: number) => {
        const t = Math.min(1, (now - start) / SPIN_MS);
        setX(from + (to - from) * easeOutQuint(t));
        if (t < 1) {
          raf = requestAnimationFrame(ease);
        } else if (!done) {
          done = true;
          setX(to);
          settledRef.current();
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
        highlight
          ? 'border-ton bg-panel-2 ring-2 ring-ton/50'
          : 'border-edge',
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

// ── Contents preview (minimal, tier-coloured prize chips) ────────────────────────

/**
 * The case's possible prizes as compact, tier-coloured chips (worst → best). This
 * is the whole "what's inside" — no max-prize headline. `detailed` adds the drop
 * chance to each chip (shown once a case is selected/opened).
 */
function ContentsPreview({ prizes, detailed }: { prizes: Prize[]; detailed?: boolean }) {
  // prizes are stored best → worst; show worst → best (cheapest first).
  const items = useMemo(() => [...prizes].reverse(), [prizes]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((p) => (
        <span
          key={p.amount}
          className={clsx(
            'inline-flex items-baseline gap-1 rounded-lg border border-edge bg-ink px-2 py-1',
            'text-xs font-semibold tabular-nums',
            tierTextClass(p.tier),
          )}
        >
          <Amount value={p.amount} />
          {detailed && (
            <span className="text-[10px] font-normal text-muted">
              {(p.chance * 100).toFixed(p.chance < 0.01 ? 2 : 1)}%
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

// ── Case panel (one large, selectable case showing what's inside) ────────────────

/**
 * One case as a large panel: name + price, with a minimal preview of its contents
 * (tier-coloured prize chips). Selecting it expands the open view (reel + button)
 * inline and reveals the drop chances. No "max prize" headline.
 */
function CasePanel({
  caseView,
  selected,
  onSelect,
}: {
  caseView: CaseView;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={clsx(
        'overflow-hidden rounded-2xl border transition-colors',
        selected
          ? 'border-ton/60 bg-panel-2 ring-1 ring-ton/30'
          : 'border-edge bg-panel hover:border-ton/40',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex w-full flex-col gap-3 p-4 text-left focus-visible:outline-none"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-semibold tracking-tight text-fg">
            {caseView.name}
          </span>
          <span
            className={clsx(
              'shrink-0 rounded-lg border px-2.5 py-1 text-sm font-semibold tabular-nums',
              selected ? 'border-ton/50 bg-ink text-ton' : 'border-edge bg-ink text-fg',
            )}
          >
            <Amount value={caseView.cost} />
          </span>
        </div>
        <ContentsPreview prizes={caseView.prizes} detailed={selected} />
      </button>

      {selected && (
        <div className="border-t border-edge/70 p-4">
          <OpenView caseView={caseView} />
        </div>
      )}
    </div>
  );
}

// ── Open view (focused case: reel + open/result + contents) ──────────────────────

type Phase = 'ready' | 'spinning' | 'revealed';

function OpenView({ caseView }: { caseView: CaseView }) {
  const round = useGameRound('CASES');

  // Phase is separate from the round status so the result waits for the reel to
  // *finish* (the round resolves well before the animation ends).
  const [phase, setPhase] = useState<Phase>('ready');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const spinSound = useRef<SpinHandle | null>(null);

  // Switching tabs remounts this view (keyed on the case name in the parent), so
  // the round + phase reset for free. We only need to stop the whirr on unmount in
  // case a tab switch (or navigation) happens mid-spin.
  useEffect(
    () => () => {
      spinSound.current?.stop();
      spinSound.current = null;
    },
    [],
  );

  const open = useCallback(async () => {
    if (phase === 'spinning') return;
    setErrMsg(null);
    // One-click replay: if we're showing a result, clear it before the new round so
    // there's no dead intermediate screen needing a second click.
    round.reset();
    setPhase('spinning');
    sfx.click();
    spinSound.current = sfx.startSpin();
    try {
      await round.play({ caseName: caseView.name });
      // Result is in; the reel keeps spinning until onSettled flips to 'revealed'.
    } catch (e) {
      spinSound.current?.stop();
      spinSound.current = null;
      setPhase('ready');
      setErrMsg(errorMessage(e));
    }
  }, [round, caseView.name, phase]);

  const onSettled = useCallback(() => {
    spinSound.current?.stop();
    spinSound.current = null;
    setPhase('revealed');
    const won = round.result ? Number(round.result.result) > 0 : false;
    if (won) {
      sfx.reveal();
      sfx.win();
    } else {
      sfx.reveal();
    }
  }, [round.result]);

  const result = round.result;
  const reelResult = phase === 'spinning' || phase === 'revealed' ? result : null;
  const revealed = phase === 'revealed' && !!result;
  const won = revealed ? Number(result.result) > 0 : false;
  const busy = round.busy || phase === 'spinning';

  return (
    <div className="space-y-4">
      <Reel
        caseView={caseView}
        result={reelResult}
        spinning={phase === 'spinning'}
        onSettled={onSettled}
      />

      {/* Outcome — always framed as winnings; 0 (and grey) if nothing, never a loss. */}
      {revealed && (
        <div
          className={clsx(
            'overflow-hidden rounded-xl border bg-panel p-4 text-center',
            won ? 'border-win/40' : 'border-edge',
          )}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Ваш выигрыш
          </p>
          <div
            className={clsx(
              'mt-1 text-3xl font-bold tracking-tight',
              won && 'animate-[casePop_360ms_ease-out]',
            )}
          >
            <Amount value={result.result} />
          </div>
        </div>
      )}

      {/* Single persistent action — one click opens, and one click replays. */}
      <Button
        size="lg"
        className="w-full"
        onClick={open}
        loading={busy}
        disabled={busy}
      >
        {busy
          ? 'Открываем…'
          : revealed
            ? 'Открыть ещё раз'
            : 'Открыть кейс'}
      </Button>

      {errMsg && <p className="text-center text-sm text-lose">{errMsg}</p>}

      <ProvablyFair
        serverHash={round.serverHash}
        serverSeed={result?.serverSeed}
        clientSeed={result?.clientSeed}
        verified={round.verified}
      />

      {/* one-off keyframe for the win pop; scoped, no global CSS edits */}
      <style>{`@keyframes casePop{0%{transform:scale(.7);opacity:.4}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CasesPage() {
  const { data: cases, isLoading, isError, error, refetch } = useCases();
  const [selected, setSelected] = useState<string | null>(null);

  // Default to the first case once loaded; keep the user's pick otherwise.
  useEffect(() => {
    if (cases && cases.length > 0 && !cases.some((c) => c.name === selected)) {
      setSelected(cases[0].name);
    }
  }, [cases, selected]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <PageBack to="/games" label="К играм" />

      <header className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-2xl">
          {GAME_META.CASES.emoji}
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            {GAME_META.CASES.name}
          </h1>
          <p className="text-sm text-muted">Выбери кейс и открой его</p>
        </div>
      </header>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Spinner size={28} />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-edge bg-panel p-6 text-center">
          <p className="text-sm text-muted">{errorMessage(error)}</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => refetch()}>
            Повторить
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {cases?.map((c) => (
            <CasePanel
              key={c.name}
              caseView={c}
              selected={c.name === selected}
              onSelect={() => {
                if (c.name !== selected) sfx.click();
                setSelected(c.name);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
