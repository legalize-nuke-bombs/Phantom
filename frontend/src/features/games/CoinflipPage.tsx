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

const SETTLE_MS = 1500; // deceleration from free spin onto the outcome face
const SETTLE_TURNS = 4; // whole turns added during the settle — keeps it lively
const FREE_SPEED = 360 / 600; // free-spin angular speed (deg/ms) ≈ 0.6 turn/s … brisk
const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3); // cubic: fast → slow → stop
const TILT = 'rotateX(12deg)'; // fixed 3D tilt baked into every transform write

/** The resting Y-rotation (deg) that shows `side` toward the viewer. */
const faceAngle = (s: Side): number => (s === 'heads' ? 0 : 180);

/** Compose the coin transform, always preserving the fixed 3D tilt. */
const coinTransform = (yDeg: number): string => `${TILT} rotateY(${yDeg}deg)`;

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
  const heads = side === 'heads';
  return (
    <div
      className="absolute inset-0 rounded-full [backface-visibility:hidden]"
      // The back face is rotated a half-turn so it faces away at rest; without this
      // both faces would stack frontwards and look identical through the flip.
      style={{ transform: back ? 'rotateY(180deg)' : undefined }}
    >
      {/* Brushed-metal disc — the two faces use distinct sheens so they read apart
          mid-spin: Герб is a brighter ice-blue, Цифра a deeper steel-ton. */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: heads
            ? 'radial-gradient(circle at 32% 26%, #d4f6ff 0%, #6fd2ff 26%, #1ea6f5 55%, #0d7fce 78%, #075596 100%)'
            : 'radial-gradient(circle at 32% 26%, #8fd6ff 0%, #2f9be6 26%, #0d72c0 55%, #084f8c 78%, #042f57 100%)',
          boxShadow:
            'inset 0 3px 10px rgba(255,255,255,0.55), inset 0 -10px 22px rgba(0,0,0,0.5)',
        }}
      />
      {/* Raised rim. */}
      <div
        className="absolute inset-0 rounded-full ring-2 ring-ice/50"
        style={{ boxShadow: 'inset 0 0 0 5px rgba(2,30,55,0.55)' }}
      />
      {/* Inner bevel that frames the emblem. The back face's content is counter-
          mirrored (scaleX -1) so the digit reads the right way round, not reversed. */}
      <div
        className="absolute inset-[14%] grid place-items-center rounded-full border border-ice/25 bg-black/10"
        style={back ? { transform: 'scaleX(-1)' } : undefined}
      >
        {heads ? (
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
      // A small fixed rotateX tilt makes the rotateY flip read as a true 3D turn
      // (you see the disc's edge sweep through) rather than a flat swap.
      style={{
        transformStyle: 'preserve-3d',
        transform: coinTransform(0),
      }}
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
  // The coin's live Y-rotation (deg). Drives the handoff from the free spin into the
  // settle so the deceleration continues from wherever the coin currently is.
  const angleRef = useRef(0);

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
   * Stage 1 — free spin. Start turning the coin IMMEDIATELY on click at a constant
   * angular speed, before the server answers, so there's no static pause. Runs until
   * `settleTo` takes over (it cancels this RAF). Resets angle to 0 each flip so the
   * settle's whole-turn maths stays in a tidy range.
   */
  const startFreeSpin = useCallback(() => {
    const el = coinRef.current;
    if (!el) return;
    angleRef.current = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      angleRef.current += FREE_SPEED * dt;
      el.style.transform = coinTransform(angleRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  /**
   * Stage 2 — settle. Hand off from the free spin (cancel it) and ease from the
   * current angle to the next angle that both adds a few whole turns AND shows
   * `landedSide`, decelerating with a cubic ease-out to a clean stop on the outcome.
   * Resolves when the motion finishes.
   */
  const settleTo = useCallback((landedSide: Side): Promise<void> => {
    const el = coinRef.current;
    return new Promise((resolve) => {
      if (!el) {
        resolve();
        return;
      }
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      const from = angleRef.current;
      // Land on the right face after a few whole extra turns: align to the face within
      // the current turn, then pad with SETTLE_TURNS full rotations for a lively stop.
      const align = ((faceAngle(landedSide) - (from % 360) + 360) % 360);
      const target = from + align + SETTLE_TURNS * 360;
      const start = performance.now();
      const tick = (nowTs: number) => {
        const p = Math.min(1, (nowTs - start) / SETTLE_MS);
        angleRef.current = from + (target - from) * EASE_OUT(p);
        el.style.transform = coinTransform(angleRef.current);
        if (p < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          angleRef.current = target;
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

    dispatch({ type: 'startFlip' });
    spinRef.current = sfx.startSpin();
    // Start spinning RIGHT NOW — the coin is already turning before we ask the server,
    // so there's never a static pause waiting on the network.
    startFreeSpin();

    try {
      const result = await round.play({ bet });
      const isWin = Number(result.result) > 0;
      const landedSide: Side = isWin ? side : other(side);

      // Hand the free spin off into the deceleration onto the outcome, then reveal —
      // the result is gated on the coin actually stopping, never on the round-trip.
      await settleTo(landedSide);
      spinRef.current?.stop();
      spinRef.current = null;

      dispatch({
        type: 'settle',
        landed: landedSide,
        won: isWin,
        payout: isWin ? result.result : null,
      });
      if (isWin) sfx.smallWin();
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
      angleRef.current = faceAngle(side);
      if (coinRef.current) {
        coinRef.current.style.transform = coinTransform(faceAngle(side));
      }
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
            Монетка
          </h1>
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
              onClick={() => dispatch({ type: 'setSide', side: s })}
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

      {/* Potential win — a small muted caption, not a boxed field. */}
      <p className="mb-4 text-xs text-muted">
        Выигрыш при победе:{' '}
        {betValid ? (
          <Amount value={potentialWin} className="font-medium text-ice" />
        ) : (
          <span className="font-medium text-fg">—</span>
        )}
      </p>

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
