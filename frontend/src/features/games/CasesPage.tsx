// CasesPage — the CASES game (/games/cases).
//
// Flow (verified against com.example.phantom.game.cases.*):
//   • GET  /api/games/cases       → CaseSettings { cases: [{ name, cost, size, data }] }
//       where `data` maps prizeAmount(string) → weight(count); `cost` is the case
//       price (set by the server on init — we never send a bet for cases).
//   • POST /api/games/cases/init  { data: { caseName } }   → commit serverHash
//   • POST /api/games/cases/run   { clientSeed }           → GameRepresentation
//       result = the won amount (one of the case's prize tiers); data = { caseName }.
//
// We drive the round through useGameRound('CASES').play({ caseName }) — the bet is
// the case cost, charged server-side. The reel is a CSS/RAF strip of prize tickets
// that decelerates onto the actual won amount, then we reveal the result + the
// ProvablyFair panel. The wallet auto-refreshes inside useGameRound.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Package, RotateCcw, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { getGameSettings } from '@/shared/lib/gameApi';
import type { GameResult } from '@/shared/lib/gameApi';
import { useGameRound } from '@/shared/lib/useGameRound';
import { errorMessage } from '@/shared/api/errors';
import { GAME_META } from '@/shared/lib/games';
import { useWallet } from '@/shared/lib/wallet';
import { formatUsd } from '@/shared/lib/money';
import { amountTier, tierTextClass, useFinanceColors } from '@/shared/lib/financeColors';
import type { FinanceTier, Thresholds } from '@/shared/lib/financeColors';
import { useQuery } from '@tanstack/react-query';
import Amount from '@/shared/ui/Amount';
import Button from '@/shared/ui/Button';
import Spinner from '@/shared/ui/Spinner';
import ProvablyFair from '@/shared/ui/ProvablyFair';

// ── Backend shapes (CaseSettings → Case) ──────────────────────────────────────
// BigDecimals serialize as numbers or strings depending on Jackson; we normalize
// with Number()/String() at the edges and keep money as decimal strings for <Amount>.

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

/** A case with its prize tiers resolved (sorted high → low) for display + the reel. */
interface CaseView {
  name: string;
  cost: string;
  size: number;
  prizes: Prize[];
  /** The biggest payout in the case — shown as the headline on the card. */
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
// A horizontal strip of weighted-random prize tickets with the *winning* ticket
// planted near the end, under a fixed centre marker. We animate translateX with a
// RAF easing curve so the strip glides to a stop exactly on the won amount.

const TICKET_W = 96; // px, must match the rendered ticket width below
const GAP = 8; // px gap between tickets (matches `gap-2`)
const CELL = TICKET_W + GAP;
const STRIP_LEN = 56; // total tickets on the strip
const WIN_INDEX = STRIP_LEN - 6; // where the winning ticket sits (leave a little tail)
const SPIN_MS = 4600;

/** Pick a prize by weight — used to fill the reel with believable filler tickets. */
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
  /** The resolved round (null until done) — its result plants the winning ticket. */
  result: GameResult | null;
  spinning: boolean;
  /** Fired once the strip finishes decelerating onto the winning ticket. */
  onSettled: () => void;
}

function Reel({ caseView, result, spinning, onSettled }: ReelProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(0);

  // Keep the viewport width so we can centre the winning ticket precisely.
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewport(el.clientWidth));
    ro.observe(el);
    setViewport(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // The strip's tickets: stable for a given round. The winning ticket carries the
  // actual won amount; everything else is weighted filler. Keyed by result id so a
  // new round reshuffles. Built idle (no result) too, so the reel looks alive.
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

  const tickets = useMemo<Prize[]>(() => {
    const out: Prize[] = [];
    for (let i = 0; i < STRIP_LEN; i++) {
      out.push(i === WIN_INDEX ? winPrize : weightedPick(caseView.prizes));
    }
    return out;
    // Reshuffle per round (result id) and per case.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseView.name, result?.id, winPrize]);

  // The translateX that lands the winning ticket's centre under the viewport centre.
  const targetX = useMemo(() => {
    if (!viewport) return 0;
    const ticketCentre = WIN_INDEX * CELL + TICKET_W / 2;
    return viewport / 2 - ticketCentre;
  }, [viewport]);

  // Resting offset before a spin: show a couple of tickets from the left, idle.
  const restX = -2 * CELL;

  // Hold the live transform in a ref so a phase change can continue from wherever
  // the strip currently is (no snap-back) and onSettled fires from a stable cb.
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

  // The reel runs in two RAF stages, both keyed off `spinning` + `winValue`:
  //   1. spinning, result not in yet  → free-scroll left at constant speed
  //   2. result known                 → ease-out from the current x onto targetX
  // Splitting them means the network result arriving mid-spin doesn't restart the
  // motion — it just hands off from a steady scroll into the deceleration.
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
      // Stage 1 — free scroll left while we wait for the server result. Capped a few
      // cells short of the winning ticket so there's always room for the Stage-2
      // deceleration; if the result is slow we simply idle at the cap (no jump).
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
      // Stage 2 — decelerate from the current position onto the winning ticket.
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

  return (
    <div
      ref={wrapRef}
      className="relative h-28 overflow-hidden rounded-xl border border-edge bg-ink"
    >
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-ink to-transparent" />

      {/* centre marker */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2">
        <div className="h-full w-0.5 bg-ton shadow-[0_0_12px_2px] shadow-ton/50" />
      </div>

      {/* the moving track */}
      <div
        ref={trackRef}
        className="absolute inset-y-0 left-0 flex items-center gap-2 will-change-transform"
        style={{ transform: `translate3d(${restX}px,0,0)` }}
      >
        {tickets.map((p, i) => (
          <ReelTicket key={i} prize={p} highlight={i === WIN_INDEX && !spinning} />
        ))}
      </div>
    </div>
  );
}

function ReelTicket({ prize, highlight }: { prize: Prize; highlight: boolean }) {
  return (
    <div
      style={{ width: TICKET_W }}
      className={clsx(
        'flex h-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border bg-panel-2 transition-colors',
        highlight ? 'border-ton bg-panel-2' : 'border-edge',
      )}
    >
      <span aria-hidden className="text-2xl leading-none">
        {GAME_META.CASES.emoji}
      </span>
      <span className={clsx('text-xs font-semibold tabular-nums', tierTextClass(prize.tier))}>
        {formatUsd(prize.amount)}
      </span>
    </div>
  );
}

// ── Case card (lobby) ──────────────────────────────────────────────────────────

function CaseCard({
  caseView,
  affordable,
  onOpen,
}: {
  caseView: CaseView;
  affordable: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={clsx(
        'group relative flex flex-col items-center gap-3 overflow-hidden rounded-xl border bg-panel p-4 text-center transition-all',
        'hover:border-ton/50 hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ton/60',
        !affordable && 'opacity-60',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full bg-ton/10 opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
      />

      <span
        aria-hidden
        className="relative text-5xl transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105"
      >
        {GAME_META.CASES.emoji}
      </span>

      <div className="relative">
        <p className="text-sm font-semibold tracking-tight text-fg">{caseView.name}</p>
        <p className="mt-0.5 text-[11px] text-muted">
          до <span className={tierTextClass(caseView.top.tier)}>{formatUsd(caseView.top.amount)}</span>
        </p>
      </div>

      <span
        className={clsx(
          'relative inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-sm font-semibold',
          affordable
            ? 'border-edge bg-ink text-fg group-hover:border-ton/60'
            : 'border-lose/40 bg-ink text-lose',
        )}
      >
        <Amount value={caseView.cost} />
      </span>
    </button>
  );
}

// ── Open view (selected case: reel + result) ─────────────────────────────────────

type Phase = 'ready' | 'spinning' | 'revealed';

function OpenView({ caseView, onBack }: { caseView: CaseView; onBack: () => void }) {
  const round = useGameRound('CASES');
  const { data: wallet } = useWallet();
  const balance = wallet ? Number(wallet.balance) : 0;

  // Phase is separate from the round status so the result UI waits for the reel to
  // *finish* before it pops in (round resolves well before the 4.6s animation ends).
  const [phase, setPhase] = useState<Phase>('ready');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const cost = Number(caseView.cost);
  const affordable = balance >= cost;
  const busy = round.busy || phase === 'spinning';

  const open = useCallback(async () => {
    setErrMsg(null);
    setPhase('spinning');
    try {
      await round.play({ caseName: caseView.name });
      // Result is in; the reel keeps spinning until onSettled flips to 'revealed'.
    } catch (e) {
      setPhase('ready');
      setErrMsg(errorMessage(e));
    }
  }, [round, caseView.name]);

  const again = useCallback(() => {
    round.reset();
    setErrMsg(null);
    setPhase('ready');
  }, [round]);

  const result = round.result;
  const net = result ? Number(result.result) - Number(result.bet) : 0;
  const isWin = net > 0;
  const isLoss = net < 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={16} />
          Все кейсы
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-panel-2 px-2.5 py-1 text-sm font-medium text-fg">
          {GAME_META.CASES.emoji} {caseView.name}
        </span>
      </div>

      <Reel
        caseView={caseView}
        result={phase === 'spinning' || phase === 'revealed' ? result : null}
        spinning={phase === 'spinning'}
        onSettled={() => setPhase('revealed')}
      />

      {/* Result / action zone */}
      {phase === 'revealed' && result ? (
        <ResultPanel result={result} isWin={isWin} isLoss={isLoss} onAgain={again} />
      ) : (
        <div className="space-y-2">
          <Button
            size="lg"
            className="w-full"
            onClick={open}
            loading={busy}
            disabled={busy || !affordable}
          >
            {!busy && <Package size={18} />}
            {affordable ? (
              <>Открыть за {formatUsd(caseView.cost)}</>
            ) : (
              'Недостаточно средств'
            )}
          </Button>
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="text-muted">
              Баланс: <span className="text-fg">{formatUsd(balance)}</span>
            </span>
            {errMsg ? (
              <span className="text-lose">{errMsg}</span>
            ) : (
              <span className="text-muted">Цена: {formatUsd(caseView.cost)}</span>
            )}
          </div>
        </div>
      )}

      {/* What's inside */}
      <PrizeList caseView={caseView} />

      <ProvablyFair
        serverHash={round.serverHash}
        serverSeed={result?.serverSeed}
        clientSeed={result?.clientSeed}
        verified={round.verified}
      />
    </div>
  );
}

function ResultPanel({
  result,
  isWin,
  isLoss,
  onAgain,
}: {
  result: GameResult;
  isWin: boolean;
  isLoss: boolean;
  onAgain: () => void;
}) {
  return (
    <div
      className={clsx(
        'overflow-hidden rounded-xl border bg-panel p-4 text-center transition-colors',
        isWin ? 'border-win/40' : isLoss ? 'border-lose/30' : 'border-edge',
      )}
    >
      <div className="flex items-center justify-center gap-1.5">
        {isWin && <Sparkles size={16} className="text-win" aria-hidden />}
        <p
          className={clsx(
            'text-xs font-medium uppercase tracking-wide',
            isWin ? 'text-win' : isLoss ? 'text-muted' : 'text-muted',
          )}
        >
          {isWin ? 'Выигрыш' : isLoss ? 'Не повезло' : 'Возврат ставки'}
        </p>
      </div>

      <div
        className={clsx(
          'mt-1 text-3xl font-bold tracking-tight transition-transform',
          isWin && 'animate-[casePop_360ms_ease-out]',
        )}
      >
        <Amount value={result.result} />
      </div>

      <p className="mt-1 text-xs text-muted">
        Ставка {formatUsd(result.bet)}
      </p>

      <Button variant="ghost" size="md" className="mt-3 w-full" onClick={onAgain}>
        <RotateCcw size={16} />
        Ещё раз
      </Button>

      {/* one-off keyframe for the win pop; scoped, no global CSS edits */}
      <style>{`@keyframes casePop{0%{transform:scale(.7);opacity:.4}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}

function PrizeList({ caseView }: { caseView: CaseView }) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <p className="mb-2 px-1 text-xs font-medium text-muted">Содержимое кейса</p>
      <ul className="space-y-1">
        {caseView.prizes.map((p) => (
          <li
            key={p.amount}
            className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm odd:bg-panel-2/40"
          >
            <span className={clsx('font-medium tabular-nums', tierTextClass(p.tier))}>
              {formatUsd(p.amount)}
            </span>
            <span className="text-xs text-muted tabular-nums">
              {(p.chance * 100).toFixed(p.chance < 0.01 ? 2 : 1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CasesPage() {
  const { data: cases, isLoading, isError, error, refetch } = useCases();
  const [selected, setSelected] = useState<string | null>(null);
  const { data: wallet } = useWallet();
  const balance = wallet ? Number(wallet.balance) : 0;

  const current = useMemo(
    () => cases?.find((c) => c.name === selected) ?? null,
    [cases, selected],
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <header className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-2xl">
          {GAME_META.CASES.emoji}
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            {GAME_META.CASES.name}
          </h1>
          <p className="text-sm text-muted">
            {current ? 'Крути и забирай приз' : 'Выбери кейс и испытай удачу'}
          </p>
        </div>
        <Link
          to="/games"
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-edge bg-panel-2 px-2.5 py-1.5 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={16} />
          Игры
        </Link>
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
      ) : current ? (
        <OpenView caseView={current} onBack={() => setSelected(null)} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cases?.map((c) => (
            <CaseCard
              key={c.name}
              caseView={c}
              affordable={balance >= Number(c.cost)}
              onOpen={() => setSelected(c.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
