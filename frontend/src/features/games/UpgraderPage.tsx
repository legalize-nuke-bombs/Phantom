// Upgrader (route: /games/upgrader).
//
// You stake a bet and pick a chance%. The lower the chance, the bigger the
// multiplier — pick 75% for a safe ×1.2, or gamble on 1% for ×90. Backend, verified
// against com.example.phantom.game.upgrader.{UpgraderService,UpgraderSettings}:
//
//   GET  /api/games/upgrader        → { percents: { "<chance>": "<multiplier>" }, minimalBet }
//       Map<Integer,BigDecimal> serialises with STRING keys; chances 75/50/25/10/5/1.
//   POST /api/games/upgrader/init   { data:{ bet, percent } }
//       → commits serverHash; data echoes { percent, possibleResult = bet*multiplier }.
//   POST /api/games/upgrader/run    { clientSeed }
//       → result == possibleResult on a win, "0" on a bust.
//
// Win rule (source): randomResult = random(1..100); WIN when percent >= randomResult.
// So the chosen percent IS the win chance, and the win arc on the dial is drawn to
// exactly that fraction — the picture matches the odds. We don't get randomResult
// back, so the needle lands at a random angle inside the matching zone (win/bust),
// derived from the revealed outcome.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TrendingUp, Sparkles, RotateCcw } from 'lucide-react';
import clsx from 'clsx';

import { useQuery } from '@tanstack/react-query';
import { errorMessage } from '@/shared/api/errors';
import { getGameSettings } from '@/shared/lib/gameApi';
import { useGameRound } from '@/shared/lib/useGameRound';
import { formatUsd } from '@/shared/lib/money';
import { gameMeta } from '@/shared/lib/games';

import Amount from '@/shared/ui/Amount';
import BetInput from '@/shared/ui/BetInput';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import ProvablyFair from '@/shared/ui/ProvablyFair';
import Spinner from '@/shared/ui/Spinner';

/* ── settings ──────────────────────────────────────────────────────────────
   Map<Integer,BigDecimal> -> JSON object with string keys, both stringly typed. */
interface UpgraderSettings {
  percents: Record<string, string>;
  minimalBet: string;
}

/** One playable option, derived from settings. chance == win %, mult == payout ×. */
interface Option {
  percent: number;
  chance: number; // == percent
  mult: number;
}

const META = gameMeta('UPGRADER');
const SPIN_MS = 2200;

/** Decompose settings into options sorted by chance, high → low (safe → risky). */
function toOptions(s: UpgraderSettings): Option[] {
  return Object.entries(s.percents)
    .map(([percent, mult]) => {
      const p = Number(percent);
      return { percent: p, chance: p, mult: Number(mult) };
    })
    .filter((o) => Number.isFinite(o.percent) && Number.isFinite(o.mult))
    .sort((a, b) => b.chance - a.chance);
}

/* ── the dial ──────────────────────────────────────────────────────────────
   A ring whose green arc covers exactly `chance`% of the circle, starting at the
   top and sweeping clockwise. A needle spins and eases to rest inside the win arc
   (win) or in the bust remainder (loss). All angles are degrees, 0° = top. */

const R = 86; // ring radius
const STROKE = 14;
const SIZE = (R + STROKE) * 2 + 8; // viewBox side
const C = 2 * Math.PI * R; // circumference
const CENTER = SIZE / 2;

/** easeOutQuart — fast launch, long graceful settle. */
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

interface DialPhase {
  /** Spin nonce — bump to (re)launch the needle. 0 = never spun (idle). */
  nonce: number;
  /** Did the round win? Decides which zone the needle lands in. */
  win: boolean;
}

function Dial({
  chance,
  phase,
  spinning,
  children,
}: {
  chance: number;
  phase: DialPhase;
  spinning: boolean;
  children: React.ReactNode;
}) {
  const fraction = Math.min(Math.max(chance / 100, 0), 1);
  const winArc = C * fraction;

  // Needle angle in degrees (0 = pointing up). Driven by RAF on each spin.
  const [angle, setAngle] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (phase.nonce === 0) return; // idle, no spin yet
    if (raf.current != null) cancelAnimationFrame(raf.current);

    // Land at a random angle within the matching zone, with a small margin so the
    // needle never sits exactly on the win/bust seam.
    const winSpan = 360 * fraction;
    const margin = Math.min(6, winSpan / 6 || 0);
    const target = phase.win
      ? margin + Math.random() * Math.max(winSpan - 2 * margin, 0)
      : winSpan + margin + Math.random() * Math.max(360 - winSpan - 2 * margin, 0);

    const start = angle;
    // Several full turns on top of the shortest forward delta to the target.
    const base = ((target - start) % 360 + 360) % 360;
    const total = base + 360 * 4;
    const t0 = performance.now();

    const tick = (now: number) => {
      const p = Math.min((now - t0) / SPIN_MS, 1);
      setAngle(start + total * easeOutQuart(p));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
    // Re-run only when a new spin is requested.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.nonce]);

  const settled = !spinning && phase.nonce > 0;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[280px]">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full -rotate-90">
        {/* bust track (full ring) */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-edge"
          strokeLinecap="round"
        />
        {/* win arc — exactly `chance`% of the ring */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${winArc} ${C - winArc}`}
          className={clsx(
            'stroke-win transition-[stroke-dasharray] duration-500',
            settled && !phase.win && 'opacity-30',
          )}
        />
      </svg>

      {/* needle — rotated in screen space (0° = up). */}
      <div
        className="pointer-events-none absolute inset-0 grid place-items-center"
        style={{ transform: `rotate(${angle}deg)` }}
      >
        <div
          className={clsx(
            'origin-bottom rounded-full',
            spinning ? 'bg-ice' : settled ? (phase.win ? 'bg-win' : 'bg-lose') : 'bg-ton',
          )}
          style={{ width: 4, height: R + 2, transform: `translateY(-${(R + 2) / 2}px)` }}
        />
      </div>
      {/* hub */}
      <span className="pointer-events-none absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-edge bg-panel-2" />

      {/* centre readout */}
      <div className="absolute inset-0 grid place-items-center px-8 text-center">
        {children}
      </div>
    </div>
  );
}

/* ── chance / multiplier picker ──────────────────────────────────────────── */
function PercentPicker({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Option[];
  value: number;
  onChange: (percent: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((o) => {
        const active = o.percent === value;
        return (
          <button
            key={o.percent}
            type="button"
            onClick={() => onChange(o.percent)}
            disabled={disabled}
            aria-pressed={active}
            className={clsx(
              'flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              active
                ? 'border-ton bg-ton/10 text-fg'
                : 'border-edge bg-panel-2 text-muted hover:border-ton/50 hover:text-fg',
            )}
          >
            <span className="text-base font-semibold leading-none">×{o.mult}</span>
            <span className="text-[11px] leading-none text-muted">{o.chance}% шанс</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── page ──────────────────────────────────────────────────────────────────*/
export default function UpgraderPage() {
  const settingsQuery = useQuery({
    queryKey: ['game-settings', 'upgrader'],
    queryFn: () => getGameSettings<UpgraderSettings>('UPGRADER'),
    staleTime: Infinity,
  });

  const options = useMemo(
    () => (settingsQuery.data ? toOptions(settingsQuery.data) : []),
    [settingsQuery.data],
  );
  const minBet = settingsQuery.data ? Number(settingsQuery.data.minimalBet) : 1;

  const round = useGameRound('UPGRADER');

  const [bet, setBet] = useState('');
  const [betValid, setBetValid] = useState(false);
  // The user's explicit pick (null = none yet → fall back to the safest option).
  const [percent, setPercent] = useState<number | null>(null);
  // Animation phase, decoupled from the round so the result text only flips when
  // the needle finishes its sweep.
  const [phase, setPhase] = useState<DialPhase>({ nonce: 0, win: false });
  const [revealed, setRevealed] = useState(false);
  const spinTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (spinTimer.current != null) clearTimeout(spinTimer.current);
    },
    [],
  );

  // Default to the first (safest) option until the user picks one — derived, so no
  // state-syncing effect is needed.
  const selected =
    options.find((o) => o.percent === percent) ?? options[0] ?? null;
  const betNum = Number(bet);
  const target = selected && Number.isFinite(betNum) ? betNum * selected.mult : 0;

  const spinning = round.busy || (phase.nonce > 0 && !revealed);
  const canPlay =
    !spinning && betValid && selected != null && settingsQuery.isSuccess;

  const play = useCallback(async () => {
    if (selected == null || !betValid) return;
    setRevealed(false);
    try {
      const result = await round.play({
        bet: String(betNum),
        percent: String(selected.percent),
      });
      const win = Number(result.result) > 0;
      // Launch the needle; reveal the verdict only after it lands.
      setPhase({ nonce: Date.now(), win });
      if (spinTimer.current != null) clearTimeout(spinTimer.current);
      spinTimer.current = window.setTimeout(() => setRevealed(true), SPIN_MS);
    } catch {
      // round.error carries the localized message; nothing to do here.
    }
  }, [round, selected, betValid, betNum]);

  const replay = useCallback(() => {
    if (spinTimer.current != null) clearTimeout(spinTimer.current);
    setRevealed(false);
    setPhase({ nonce: 0, win: false });
    round.reset();
  }, [round]);

  const result = round.result;
  const won = revealed && result != null && Number(result.result) > 0;

  /* ── states ── */
  if (settingsQuery.isLoading) {
    return (
      <div className="mx-auto grid w-full max-w-lg place-items-center py-24">
        <Spinner size={32} />
      </div>
    );
  }
  if (settingsQuery.isError || !selected) {
    return (
      <div className="mx-auto w-full max-w-lg">
        <PageHeader />
        <Card className="p-5 text-sm text-lose">
          {settingsQuery.isError
            ? errorMessage(settingsQuery.error)
            : 'Не удалось загрузить настройки игры'}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <PageHeader />

      <Card className="overflow-hidden p-5 sm:p-6">
        {/* dial */}
        <Dial chance={selected.chance} phase={phase} spinning={spinning}>
          {!revealed ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl font-bold tabular-nums text-fg">
                {selected.chance}%
              </span>
              <span className="text-xs text-muted">шанс апгрейда</span>
              <span className="mt-1 text-sm font-medium text-ton">×{selected.mult}</span>
            </div>
          ) : won ? (
            <div className="flex flex-col items-center gap-1">
              <Sparkles className="text-win" size={26} />
              <Amount value={result!.result} className="text-2xl font-bold" />
              <span className="text-xs font-medium uppercase tracking-wide text-win">
                Апгрейд!
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-lose">Буст сорван</span>
              <span className="text-xs text-muted">в этот раз не повезло</span>
            </div>
          )}
        </Dial>

        {/* outcome banner */}
        {revealed && result && (
          <div
            className={clsx(
              'mt-4 flex items-center justify-between rounded-xl border px-4 py-3 text-sm',
              won ? 'border-win/30 bg-win/5' : 'border-lose/30 bg-lose/5',
            )}
          >
            <span className="text-muted">
              Ставка <span className="text-fg">{formatUsd(result.bet)}</span>
            </span>
            <span className={clsx('font-semibold', won ? 'text-win' : 'text-lose')}>
              {won ? '+' : '−'}
              {formatUsd(won ? result.result : result.bet)}
            </span>
          </div>
        )}

        {/* controls */}
        <div className="mt-5 flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Ставка
            </p>
            <BetInput
              value={bet}
              onChange={setBet}
              min={minBet}
              onValidityChange={setBetValid}
              disabled={spinning}
              error={round.status === 'error' ? round.error ?? undefined : undefined}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Множитель и шанс
              </p>
              <p className="text-xs text-muted">
                Цель:{' '}
                <span className="font-medium text-ice">
                  {betValid ? formatUsd(target) : '—'}
                </span>
              </p>
            </div>
            <PercentPicker
              options={options}
              value={selected.percent}
              onChange={setPercent}
              disabled={spinning}
            />
          </div>

          {revealed ? (
            <Button variant="ghost" size="lg" onClick={replay} className="w-full">
              <RotateCcw size={16} />
              Ещё раз
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={play}
              loading={spinning}
              disabled={!canPlay}
              className="w-full"
            >
              {spinning ? 'Апгрейд…' : 'Апгрейд'}
            </Button>
          )}
        </div>
      </Card>

      <ProvablyFair
        className="mt-4"
        serverHash={round.serverHash}
        serverSeed={revealed ? result?.serverSeed : null}
        clientSeed={revealed ? result?.clientSeed : null}
        verified={revealed ? round.verified : null}
      />
    </div>
  );
}

function PageHeader() {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-2xl">
        {META.emoji}
      </span>
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-fg sm:text-2xl">
          {META.name}
          <TrendingUp size={20} className="text-ton" aria-hidden />
        </h1>
        <p className="text-sm text-muted">Чем рискованнее, тем выше множитель</p>
      </div>
    </div>
  );
}
