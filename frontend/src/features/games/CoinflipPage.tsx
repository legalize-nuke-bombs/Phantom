// Coinflip — pick a side, stake, flip.
//
// Backend contract (verified against com.example.phantom.game.coinflip):
//   • CoinFlipService.initGame reads ONLY "bet" from the init data map and commits
//     data { possibleResult = bet × multiplier }. There is NO server-side side: the
//     coin is a pure 50/50 (random.nextInt(2) == 1 ⇒ win). So the side the user
//     picks is presentational — we map the outcome onto it (win ⇒ the coin lands on
//     your side, loss ⇒ it lands on the other). We therefore send the round exactly
//     { bet } and keep the chosen side as local UI state — no phantom keys.
//   • run returns result = possibleResult on a win, "0" on a loss.
//   • CoinFlipSettings: minimalBet, multiplier (e.g. 1.8).
//
// The flip is driven by requestAnimationFrame, not a fixed-speed CSS keyframe: we
// pre-compute a total rotation that ENDS exactly on the outcome face, then ease it
// with a cubic ease-out so the angular speed decelerates smoothly to a stop (no
// spin-then-snap). The whirr sound rides the same progress and fades as it settles.

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getGameSettings } from '@/shared/lib/gameApi';
import { useGameRound } from '@/shared/lib/useGameRound';
import { errorMessage } from '@/shared/api/errors';
import { sfx } from '@/shared/lib/sound';
import type { SpinHandle } from '@/shared/lib/sound';
import Amount from '@/shared/ui/Amount';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import Spinner from '@/shared/ui/Spinner';
import BetInput from '@/shared/ui/BetInput';
import ProvablyFair from '@/shared/ui/ProvablyFair';
import PageBack from '@/shared/ui/PageBack';
import CoinGlyph from '@/shared/ui/CoinGlyph';
import clsx from 'clsx';

/** CoinFlipSettings — the shape returned by GET /api/games/coinflip. Decimals are strings. */
interface CoinFlipSettings {
  minimalBet: string;
  multiplier: string;
}

/** The two faces. Purely presentational — the backend coin has no side. */
type Side = 'heads' | 'tails';

interface SideInfo {
  side: Side;
  label: string;
  glyph: string;
}

const SIDES: readonly SideInfo[] = [
  { side: 'heads', label: 'Герб', glyph: '💎' },
  { side: 'tails', label: 'Цифра', glyph: '1' },
];

/** Lookup by side, derived from SIDES so the faces are defined in one place. */
const SIDE_INFO: Record<Side, SideInfo> = Object.fromEntries(
  SIDES.map((s) => [s.side, s]),
) as Record<Side, SideInfo>;

/** The opposite face — a loss lands on the side the user did not pick. */
const other = (s: Side): Side => (s === 'heads' ? 'tails' : 'heads');

/* ── flip animation tuning ──────────────────────────────────────────────── */

const FLIP_MS = 2200; // total flight time
const FLIP_TURNS = 6; // whole turns before settling — enough to read as a real flip
const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3); // cubic: fast → slow → stop

/** The resting Y-rotation (deg) that shows `side` toward the viewer. */
const faceAngle = (s: Side): number => (s === 'heads' ? 0 : 180);

/* ── screen state ───────────────────────────────────────────────────────── */

// A tiny reducer keeps the screen in one of three honest phases, so the result is
// gated on the animation finishing (not the network) and a finished round resets to
// `picking` in a single click — no dead intermediate frame needing a second tap.
type Phase = 'picking' | 'flipping' | 'result';

interface State {
  phase: Phase;
  side: Side; // the user's pick (sticky across rounds)
  bet: string;
  betValid: boolean;
  landed: Side | null; // the face that came up, once resolved
  won: boolean | null;
  payout: string | null; // winning amount string, or null on a loss
}

type Action =
  | { type: 'setSide'; side: Side }
  | { type: 'setBet'; bet: string }
  | { type: 'setBetValid'; valid: boolean }
  | { type: 'startFlip' }
  | { type: 'settle'; landed: Side; won: boolean; payout: string | null }
  | { type: 'reset' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setSide':
      return { ...state, side: action.side };
    case 'setBet':
      return { ...state, bet: action.bet };
    case 'setBetValid':
      return { ...state, betValid: action.valid };
    case 'startFlip':
      return { ...state, phase: 'flipping', landed: null, won: null, payout: null };
    case 'settle':
      return {
        ...state,
        phase: 'result',
        landed: action.landed,
        won: action.won,
        payout: action.payout,
      };
    case 'reset':
      // Keep side + bet so "ещё раз" replays the same wager instantly.
      return { ...state, phase: 'picking', landed: null, won: null, payout: null };
  }
}

const initialState: State = {
  phase: 'picking',
  side: 'heads',
  bet: '',
  betValid: false,
  landed: null,
  won: null,
  payout: null,
};

/* ── the coin ───────────────────────────────────────────────────────────── */

/** One metallic face of the coin. A diamond "герб" vs. a GRAM "цифра". */
function CoinFace({ side, back }: { side: Side; back?: boolean }) {
  const info = SIDE_INFO[side];
  return (
    <div
      className="absolute inset-0 rounded-full [backface-visibility:hidden]"
      style={{ transform: back ? 'rotateY(180deg)' : undefined }}
    >
      {/* Brushed-metal disc: a radial sheen over a steel→deep-ton body. */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 32% 26%, #aef0ff 0%, #4cc4ff 26%, #149bf0 55%, #0a73c4 78%, #064a82 100%)',
          boxShadow:
            'inset 0 3px 10px rgba(255,255,255,0.55), inset 0 -10px 22px rgba(0,0,0,0.5)',
        }}
      />
      {/* Raised rim. */}
      <div
        className="absolute inset-0 rounded-full ring-2 ring-ice/50"
        style={{ boxShadow: 'inset 0 0 0 5px rgba(2,30,55,0.55)' }}
      />
      {/* Inner bevel that frames the emblem. */}
      <div className="absolute inset-[14%] grid place-items-center rounded-full border border-ice/25 bg-black/10">
        {side === 'heads' ? (
          <span
            className="text-5xl drop-shadow-[0_2px_4px_rgba(0,8,20,0.6)] sm:text-6xl"
            aria-hidden
          >
            {info.glyph}
          </span>
        ) : (
          <span
            className="font-mono text-6xl font-black tracking-tighter text-ice drop-shadow-[0_2px_4px_rgba(0,8,20,0.7)] sm:text-7xl"
            aria-hidden
          >
            {info.glyph}
          </span>
        )}
      </div>
      {/* Moving glint — a soft diagonal highlight to sell the metal. */}
      <div
        className="absolute inset-0 rounded-full mix-blend-screen"
        style={{
          background:
            'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.5) 49%, transparent 60%)',
        }}
      />
    </div>
  );
}

/**
 * The coin element. The parent drives its rotateY through a ref each animation
 * frame (no per-frame React state), so the flip is buttery and the component never
 * re-renders mid-spin.
 */
const Coin = ({ innerRef }: { innerRef: React.RefObject<HTMLDivElement | null> }) => (
  <div className="grid place-items-center" style={{ perspective: '1000px' }}>
    <div
      ref={innerRef}
      className="relative size-36 will-change-transform sm:size-40"
      style={{ transformStyle: 'preserve-3d', transform: 'rotateY(0deg)' }}
      aria-hidden
    >
      <CoinFace side="heads" />
      <CoinFace side="tails" back />
    </div>
  </div>
);

/* ── page ───────────────────────────────────────────────────────────────── */

export default function CoinflipPage() {
  const settingsQuery = useQuery({
    queryKey: ['games', 'coinflip', 'settings'],
    queryFn: () => getGameSettings<CoinFlipSettings>('COINFLIP'),
    staleTime: Infinity,
  });

  const round = useGameRound('COINFLIP');
  const [state, dispatch] = useReducer(reducer, initialState);
  const { phase, side, bet, betValid, won, payout } = state;

  const coinRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const spinRef = useRef<SpinHandle | null>(null);

  const multiplier = settingsQuery.data ? Number(settingsQuery.data.multiplier) : 1.8;
  const minimalBet = settingsQuery.data ? Number(settingsQuery.data.minimalBet) : 1;

  // What a win pays at the current stake — the only forward-looking number we show.
  const betNum = Number(bet);
  const potentialWin = useMemo(
    () => (Number.isFinite(betNum) && betNum > 0 ? betNum * multiplier : 0),
    [betNum, multiplier],
  );

  // Tear down any in-flight animation / sound on unmount.
  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      spinRef.current?.stop();
    },
    [],
  );

  /**
   * Animate the coin from its current angle to a final angle that shows `landedSide`,
   * decelerating with a cubic ease-out so it eases to a clean stop on the outcome
   * face. Resolves when the motion finishes.
   */
  const animateTo = useCallback((landedSide: Side): Promise<void> => {
    const el = coinRef.current;
    const target = FLIP_TURNS * 360 + faceAngle(landedSide);
    return new Promise((resolve) => {
      if (!el) {
        resolve();
        return;
      }
      const start = performance.now();
      const tick = (nowTs: number) => {
        const p = Math.min(1, (nowTs - start) / FLIP_MS);
        const eased = EASE_OUT(p);
        el.style.transform = `rotateY(${eased * target}deg)`;
        if (p < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
          resolve();
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    });
  }, []);

  const flip = async () => {
    // One handler for both the first flip and "ещё раз": if a result is showing we
    // reset to picking first, so a single click always starts a fresh flip.
    if (round.busy || phase === 'flipping') return;
    if (phase === 'result') dispatch({ type: 'reset' });
    if (!betValid) return;

    sfx.click();
    dispatch({ type: 'startFlip' });
    spinRef.current = sfx.startSpin();

    try {
      const result = await round.play({ bet });
      const isWin = Number(result.result) > 0;
      const landedSide: Side = isWin ? side : other(side);

      // Drive the deceleration to rest on the outcome, then reveal — the result is
      // gated on the coin actually stopping, never on the network round-trip.
      await animateTo(landedSide);
      spinRef.current?.stop();
      spinRef.current = null;

      dispatch({
        type: 'settle',
        landed: landedSide,
        won: isWin,
        payout: isWin ? result.result : null,
      });
      sfx.reveal();
      if (isWin) sfx.win();
      else sfx.lose();
    } catch {
      // round.error carries the localized message; unwind the animation + sound and
      // return to picking so the player can immediately retry.
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      spinRef.current?.stop();
      spinRef.current = null;
      if (coinRef.current) coinRef.current.style.transform = `rotateY(${faceAngle(side)}deg)`;
      dispatch({ type: 'reset' });
    }
  };

  if (settingsQuery.isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-md">
        <PageBack to="/games" label="К играм" className="mb-4" />
        <Card className="p-6 text-center">
          <p className="text-sm text-lose">{errorMessage(settingsQuery.error)}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-4"
            onClick={() => settingsQuery.refetch()}
          >
            Повторить
          </Button>
        </Card>
      </div>
    );
  }

  const flipping = phase === 'flipping';
  const showResult = phase === 'result';
  const playLabel = showResult ? 'Ещё раз' : 'Подбросить';

  return (
    <div className="mx-auto w-full max-w-md">
      <PageBack to="/games" label="К играм" className="mb-4" />

      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2">
          <CoinGlyph size={28} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            Коинфлип
          </h1>
          <p className="text-sm text-muted">Угадай сторону — выигрыш ×{multiplier}</p>
        </div>
      </div>

      {/* Coin stage */}
      <Card className="mb-4 flex flex-col items-center gap-5 p-7">
        <Coin innerRef={coinRef} />

        <div className="min-h-[2rem] text-center">
          {flipping ? (
            <span className="text-sm text-muted">Монета крутится…</span>
          ) : showResult ? (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs text-muted">Ваш выигрыш</span>
              {won && payout ? (
                <Amount value={payout} className="text-2xl font-bold" />
              ) : (
                <span className="text-2xl font-bold text-muted">
                  <Amount value={0} />
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted">
              Ваш выбор:{' '}
              <span className="font-medium text-fg">{SIDE_INFO[side].label}</span>
            </span>
          )}
        </div>
      </Card>

      {/* Side picker */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        {SIDES.map(({ side: s, label, glyph }) => {
          const active = side === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => {
                sfx.click();
                dispatch({ type: 'setSide', side: s });
              }}
              disabled={flipping || round.busy}
              aria-pressed={active}
              className={clsx(
                'flex items-center justify-center gap-2 rounded-xl border px-4 py-3',
                'text-sm font-medium transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                active
                  ? 'border-ton bg-ton/10 text-fg ring-1 ring-ton/40'
                  : 'border-edge bg-panel-2 text-muted hover:border-ton/50 hover:text-fg',
              )}
            >
              <span
                className={clsx(
                  s === 'tails' && 'font-mono font-black text-ton',
                  'text-lg leading-none',
                )}
                aria-hidden
              >
                {glyph}
              </span>
              {label}
            </button>
          );
        })}
      </div>

      {/* Stake */}
      <div className="mb-4">
        <BetInput
          value={bet}
          onChange={(v) => dispatch({ type: 'setBet', bet: v })}
          min={minimalBet}
          onValidityChange={(v) => dispatch({ type: 'setBetValid', valid: v })}
          disabled={flipping || round.busy}
          error={round.status === 'error' ? (round.error ?? undefined) : undefined}
        />
      </div>

      {/* Potential win */}
      <div className="mb-4 flex items-center justify-between rounded-xl border border-edge bg-panel px-3.5 py-2.5 text-sm">
        <span className="text-muted">Выигрыш при победе</span>
        <Amount value={potentialWin} className="font-semibold" />
      </div>

      {/* Flip / replay — one click, always playable */}
      <Button
        size="lg"
        className="w-full"
        onClick={flip}
        loading={flipping || round.busy}
        disabled={!betValid && !showResult}
      >
        {flipping || round.busy ? 'Подбрасываем…' : playLabel}
      </Button>

      {/* Provably fair */}
      <ProvablyFair
        className="mt-4"
        serverHash={round.serverHash}
        serverSeed={round.result?.serverSeed}
        clientSeed={round.result?.clientSeed}
        verified={round.verified}
      />
    </div>
  );
}
