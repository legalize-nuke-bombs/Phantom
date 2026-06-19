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
// The flip is a CSS rotateY animation: while the round is in flight the coin spins;
// once resolved it settles on the winning face. All RAF/CSS — no animation libs.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Coins } from 'lucide-react';
import clsx from 'clsx';
import { getGameSettings } from '@/shared/lib/gameApi';
import { useGameRound } from '@/shared/lib/useGameRound';
import { errorMessage } from '@/shared/api/errors';
import { useQuery } from '@tanstack/react-query';
import Amount from '@/shared/ui/Amount';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import Spinner from '@/shared/ui/Spinner';
import BetInput from '@/shared/ui/BetInput';
import ProvablyFair from '@/shared/ui/ProvablyFair';

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
  { side: 'heads', label: 'Орёл', glyph: '💎' },
  { side: 'tails', label: 'Решка', glyph: '🪙' },
];

/** Lookup by side, derived from SIDES so the faces are defined in one place. */
const SIDE_INFO: Record<Side, SideInfo> = Object.fromEntries(
  SIDES.map((s) => [s.side, s]),
) as Record<Side, SideInfo>;

/** The opposite face — a loss lands on the side the user did not pick. */
const other = (s: Side): Side => (s === 'heads' ? 'tails' : 'heads');

/** A round resolves to the face that actually came up (your side on a win). */
type Outcome = 'win' | 'lose';

/** One face of the coin. */
function CoinFace({
  side,
  className,
}: {
  side: Side;
  className?: string;
}) {
  const info = SIDE_INFO[side];
  return (
    <div
      className={clsx(
        'absolute inset-0 grid place-items-center rounded-full',
        '[backface-visibility:hidden]',
        'bg-gradient-to-br from-ton via-ton-deep to-[#055f93]',
        'shadow-[inset_0_2px_8px_rgba(255,255,255,0.35),inset_0_-6px_14px_rgba(0,0,0,0.4)]',
        'ring-2 ring-ice/40',
        className,
      )}
    >
      <span
        className="text-5xl drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)] sm:text-6xl"
        aria-hidden
      >
        {info.glyph}
      </span>
    </div>
  );
}

/**
 * The flipping coin. A pure function of its props:
 *   • spinning → the CSS keyframe animation (`cf-coin-spin`) drives a fast tumble;
 *     while it runs it fully owns the transform.
 *   • at rest → we transition to `restAngle` so the resting face (the landed face if
 *     we have one, else the user's current selection) ends toward the viewer.
 * No render-time state/refs — the animation handles the motion, the transition the
 * settle.
 */
function Coin({
  spinning,
  landed,
  selected,
}: {
  spinning: boolean;
  landed: Side | null;
  selected: Side;
}) {
  // The face presented at rest. Heads faces front (0deg); tails is the back (180deg).
  const resting = landed ?? selected;
  const restAngle = resting === 'heads' ? 0 : 180;

  return (
    <div className="grid place-items-center" style={{ perspective: '900px' }}>
      <div
        className={clsx(
          'relative size-32 sm:size-36',
          spinning && 'cf-coin-spin',
        )}
        style={{
          transformStyle: 'preserve-3d',
          // While spinning the keyframe animation overrides this; at rest we ease to it.
          transform: `rotateY(${restAngle}deg)`,
          transition: spinning
            ? 'none'
            : 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        aria-hidden
      >
        <CoinFace side="heads" />
        <CoinFace side="tails" className="[transform:rotateY(180deg)]" />
      </div>
    </div>
  );
}

export default function CoinflipPage() {
  const settingsQuery = useQuery({
    queryKey: ['games', 'coinflip', 'settings'],
    queryFn: () => getGameSettings<CoinFlipSettings>('COINFLIP'),
    staleTime: Infinity,
  });

  const round = useGameRound('COINFLIP');

  const [side, setSide] = useState<Side>('heads');
  const [bet, setBet] = useState('');
  const [betValid, setBetValid] = useState(false);

  // Animation state, decoupled from the round so the coin keeps spinning briefly
  // even after a fast network reply (a too-quick result reads as no flip at all).
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState<Side | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const spinTimer = useRef<number | null>(null);

  const minimalBet = settingsQuery.data ? Number(settingsQuery.data.minimalBet) : 1;
  const multiplier = settingsQuery.data ? Number(settingsQuery.data.multiplier) : 1.8;

  // What a win pays at the current stake (bet × multiplier), for the "to win" hint.
  const betNum = Number(bet);
  const potentialWin = useMemo(
    () => (Number.isFinite(betNum) && betNum > 0 ? betNum * multiplier : 0),
    [betNum, multiplier],
  );

  useEffect(
    () => () => {
      if (spinTimer.current != null) window.clearTimeout(spinTimer.current);
    },
    [],
  );

  const flip = async () => {
    if (!betValid || round.busy) return;

    // Start the visual flip immediately; clear any previous result.
    setLanded(null);
    setOutcome(null);
    setSpinning(true);

    try {
      const result = await round.play({ bet });
      const won = Number(result.result) > 0;
      // The coin lands on the user's side when they win, the other side when they lose.
      const landedSide: Side = won ? side : other(side);

      // Let the coin tumble for a beat before settling, regardless of how fast the
      // server replied, so the flip always reads as a flip.
      spinTimer.current = window.setTimeout(() => {
        setSpinning(false);
        setLanded(landedSide);
        setOutcome(won ? 'win' : 'lose');
        spinTimer.current = null;
      }, 900);
    } catch {
      // round.error is set by the hook; stop the animation and surface it.
      setSpinning(false);
      setLanded(null);
      setOutcome(null);
    }
  };

  // Win payout: the resolved result string (= possibleResult on a win, "0" on a loss).
  const payout =
    round.result && Number(round.result.result) > 0 ? round.result.result : null;

  const showResult = outcome != null && !spinning && round.status === 'done';

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

  return (
    <div className="mx-auto w-full max-w-md">
      {/* Local keyframes for the tumble — RAF/CSS only, no libs. */}
      <style>{`
        @keyframes cf-spin {
          from { transform: rotateY(0deg); }
          to   { transform: rotateY(1800deg); }
        }
        .cf-coin-spin {
          animation: cf-spin 0.5s linear infinite;
        }
      `}</style>

      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-2xl">
          🪙
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            Коинфлип
          </h1>
          <p className="text-sm text-muted">Угадай сторону — выигрыш ×{multiplier}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-lg border border-edge bg-panel-2 px-2.5 py-1 text-sm font-semibold text-ton">
          <Coins size={14} aria-hidden />×{multiplier}
        </span>
      </div>

      {/* Coin stage */}
      <Card className="mb-4 flex flex-col items-center gap-4 p-6">
        <Coin spinning={spinning} landed={landed} selected={side} />

        <div className="h-7 text-center">
          {spinning ? (
            <span className="text-sm text-muted">Монета крутится…</span>
          ) : showResult ? (
            outcome === 'win' ? (
              <span className="text-lg font-semibold text-win">
                Выигрыш! +<Amount value={payout} className="font-semibold" />
              </span>
            ) : (
              <span className="text-lg font-semibold text-lose">Не повезло</span>
            )
          ) : (
            <span className="text-sm text-muted">
              Ваш выбор:{' '}
              <span className="font-medium text-fg">
                {SIDE_INFO[side].glyph} {SIDE_INFO[side].label}
              </span>
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
              onClick={() => setSide(s)}
              disabled={round.busy || spinning}
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
              <span className="text-xl" aria-hidden>
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
          onChange={setBet}
          min={minimalBet}
          onValidityChange={setBetValid}
          disabled={round.busy || spinning}
          error={round.status === 'error' ? (round.error ?? undefined) : undefined}
        />
      </div>

      {/* Potential win hint */}
      <div className="mb-4 flex items-center justify-between rounded-xl border border-edge bg-panel px-3.5 py-2.5 text-sm">
        <span className="text-muted">Выигрыш при победе</span>
        <Amount value={potentialWin} className="font-semibold" />
      </div>

      {/* Flip */}
      <Button
        size="lg"
        className="w-full"
        onClick={flip}
        loading={round.busy || spinning}
        disabled={!betValid}
      >
        {round.busy || spinning ? 'Подбрасываем…' : 'Подбросить монету'}
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
