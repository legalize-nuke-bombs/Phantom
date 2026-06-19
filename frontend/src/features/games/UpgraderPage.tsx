// Upgrader (route: /games/upgrader).
//
// Stake a bet, pick a success chance. The lower the chance, the bigger the
// multiplier — 75% is a safe ×1.2, 1% gambles for ×90.
//
// Backend, verified against com.example.phantom.game.upgrader.{UpgraderService,
// UpgraderSettings}:
//   GET  /api/games/upgrader        → { percents: { "<chance>": "<multiplier>" }, minimalBet }
//       Map<Integer,BigDecimal> serialises with STRING keys; chances 75/50/25/10/5/1.
//   POST /api/games/upgrader/init   { data: { bet, percent } }  → commits serverHash.
//   POST /api/games/upgrader/run    { clientSeed }
//       → result == bet × multiplier on a win, "0" on a miss.
//
// Win rule (source): randomResult = random(1..100); WIN when percent >= randomResult.
// So the chosen percent IS the win chance. The ring's bright arc is drawn to exactly
// that fraction, so the picture matches the odds. We don't get randomResult back, so
// the cursor lands at a random angle inside the matching zone (win arc / miss
// remainder), derived from the revealed outcome.
//
// The indicator is a CURSOR that travels ALONG THE PERIMETER of the ring (it never
// sits over the percent number). It runs a few laps, then eases to a gradual stop
// inside or outside the win arc.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';

import { errorMessage } from '@/shared/api/errors';
import { getGameSettings } from '@/shared/lib/gameApi';
import { useGameRound } from '@/shared/lib/useGameRound';
import { gameMeta } from '@/shared/lib/games';
import { formatUsd } from '@/shared/lib/money';
import { sfx } from '@/shared/lib/sound';

import Amount from '@/shared/ui/Amount';
import BetInput from '@/shared/ui/BetInput';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import PageBack from '@/shared/ui/PageBack';
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

/** Trim trailing zeros from a multiplier: 1.2 → "1.2", 9 → "9", 3.60 → "3.6". */
function fmtMult(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, '');
}

/* ── the ring ────────────────────────────────────────────────────────────────
   A ring whose bright arc covers exactly `chance`% of the circle, starting at the
   top (12 o'clock) and sweeping clockwise. A cursor rides the perimeter and eases
   to rest inside the win arc (win) or in the miss remainder (loss). All angles in
   degrees, 0° = top, increasing clockwise. */

const R = 84; // ring radius
const STROKE = 12;
const PAD = 14; // room for the cursor to overhang the stroke
const SIZE = (R + STROKE / 2 + PAD) * 2; // viewBox side
const C = 2 * Math.PI * R; // circumference
const CENTER = SIZE / 2;
const CURSOR_R = 9; // cursor radius

const SPIN_MS = 3000;
const LAPS = 4; // full turns before easing to the target

/** Payout multiplier at/above which a win is "big" (bigWin cue) vs. "small". */
const BIG_WIN_MULT = 3;

/** easeOutQuint — quick launch, long gentle settle (slower stop than quart). */
function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

/**
 * Point on the ring for a given clockwise angle from the top (in the SVG's own,
 * un-rotated coordinate space). 0° = top, 90° = right, etc.
 */
function pointOnRing(angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180; // -90° so 0° points up
  return { x: CENTER + R * Math.cos(rad), y: CENTER + R * Math.sin(rad) };
}

interface SpinPhase {
  /** Spin nonce — bump to (re)launch the cursor. 0 = never spun (idle). */
  nonce: number;
  /** Did the round win? Decides which zone the cursor lands in. */
  win: boolean;
}

function Ring({
  chance,
  mult,
  phase,
  spinning,
  settled,
  won,
  payout,
}: {
  chance: number;
  mult: number;
  phase: SpinPhase;
  spinning: boolean;
  settled: boolean;
  won: boolean;
  payout: string | null;
}) {
  const fraction = Math.min(Math.max(chance / 100, 0), 1);
  const winArc = C * fraction;

  // Cursor angle in degrees (clockwise from the top). Driven by RAF on each spin.
  const [angle, setAngle] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (phase.nonce === 0) return; // idle, no spin yet
    if (raf.current != null) cancelAnimationFrame(raf.current);

    // Land at a random angle within the matching zone, with a small margin so the
    // cursor never rests exactly on the win/miss seam.
    const winSpan = 360 * fraction;
    const margin = Math.min(8, winSpan / 5 || 0);
    const target = phase.win
      ? margin + Math.random() * Math.max(winSpan - 2 * margin, 0)
      : winSpan + margin + Math.random() * Math.max(360 - winSpan - 2 * margin, 0);

    const start = angle;
    const base = (((target - start) % 360) + 360) % 360;
    const total = base + 360 * LAPS;
    const t0 = performance.now();

    // The cursor travels in silence — no per-frame ticks. The single start cue
    // plays at launch (in `play`); the outcome cue plays on reveal.
    const tick = (now: number) => {
      const p = Math.min((now - t0) / SPIN_MS, 1);
      const next = start + total * easeOutQuint(p);
      setAngle(next);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
    // Re-run only when a new spin is requested.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.nonce]);

  const cursor = pointOnRing(angle);
  const startPt = pointOnRing(0);

  // Cursor colour: blue while travelling, win/lose once it lands.
  const cursorFill = spinning
    ? 'var(--color-ice)'
    : settled
      ? won
        ? 'var(--color-win)'
        : 'var(--color-lose)'
      : 'var(--color-ton)';

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[260px]">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full">
        {/* miss track (full ring) */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-edge"
        />
        {/* win arc — exactly `chance`% of the ring, sweeping clockwise from the top.
            Rotated -90° so the dash starts at 12 o'clock. */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${winArc} ${C - winArc}`}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          className={clsx(
            'stroke-ton transition-[stroke-dasharray] duration-500',
            settled && !won && 'opacity-25',
          )}
        />
        {/* start marker at 12 o'clock — the seam the cursor leaves from */}
        <circle cx={startPt.x} cy={startPt.y} r={2.5} className="fill-muted" />

        {/* the travelling cursor */}
        <g>
          {spinning && (
            <circle
              cx={cursor.x}
              cy={cursor.y}
              r={CURSOR_R + 4}
              fill={cursorFill}
              opacity={0.18}
            />
          )}
          <circle
            cx={cursor.x}
            cy={cursor.y}
            r={CURSOR_R}
            fill={cursorFill}
            stroke="var(--color-ink)"
            strokeWidth={3}
          />
        </g>
      </svg>

      {/* centre readout — always clear of the cursor (which rides the perimeter) */}
      <div className="absolute inset-0 grid place-items-center px-10 text-center">
        {settled ? (
          won ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted">Ваш выигрыш</span>
              <Amount value={payout} className="text-2xl font-bold" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted">Ваш выигрыш</span>
              <span className="text-2xl font-bold text-muted">{formatUsd(0)}</span>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-3xl font-bold tabular-nums text-fg">{chance}%</span>
            <span className="text-sm font-medium text-ton">×{fmtMult(mult)}</span>
          </div>
        )}
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
            onClick={() => {
              sfx.click();
              onChange(o.percent);
            }}
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
            <span className="text-base font-semibold leading-none">×{fmtMult(o.mult)}</span>
            <span className="text-[11px] leading-none text-muted">{o.chance}%</span>
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
  // Animation phase, decoupled from the round so the verdict only flips once the
  // cursor finishes its travel.
  const [phase, setPhase] = useState<SpinPhase>({ nonce: 0, win: false });
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
  const selected = options.find((o) => o.percent === percent) ?? options[0] ?? null;
  const betNum = Number(bet);
  const target = selected && Number.isFinite(betNum) ? betNum * selected.mult : 0;

  // Cursor is in motion from the moment we launch it until the reveal lands.
  const spinning = phase.nonce > 0 && !revealed;
  const settled = revealed;
  const result = round.result;
  const won = revealed && result != null && Number(result.result) > 0;
  const payout = won ? result!.result : null;

  const canPlay = !spinning && betValid && selected != null && settingsQuery.isSuccess;

  // One handler for the first play AND "ещё раз": a finished round is cleared up
  // front in the SAME click, so the button is always immediately playable — no dead
  // intermediate screen needing a second tap.
  const play = useCallback(async () => {
    if (selected == null || !betValid || spinning) return;
    sfx.click();
    // Reset any previous result/animation before launching the new round.
    if (spinTimer.current != null) clearTimeout(spinTimer.current);
    setRevealed(false);
    round.reset();
    try {
      const res = await round.play({
        bet: String(betNum),
        percent: String(selected.percent),
      });
      const win = Number(res.result) > 0;
      // One short start cue; the cursor then travels in silence (no-op handle).
      sfx.startSpin();
      // Launch the cursor; reveal the verdict (and play the outcome cue) only after
      // it lands.
      setPhase({ nonce: Date.now(), win });
      if (spinTimer.current != null) clearTimeout(spinTimer.current);
      spinTimer.current = window.setTimeout(() => {
        setRevealed(true);
        if (!win) sfx.lose();
        else if (selected.mult >= BIG_WIN_MULT) sfx.bigWin();
        else sfx.smallWin();
      }, SPIN_MS);
    } catch {
      // round.error carries the localized message; nothing to do here.
    }
  }, [round, selected, betValid, betNum, spinning]);

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
        <PageBack to="/games" label="К играм" className="mb-4" />
        <Header />
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
      <PageBack to="/games" label="К играм" className="mb-4" />
      <Header />

      <Card className="overflow-hidden p-5 sm:p-6">
        <Ring
          chance={selected.chance}
          mult={selected.mult}
          phase={phase}
          spinning={spinning}
          settled={settled}
          won={won}
          payout={payout}
        />

        {/* controls */}
        <div className="mt-6 flex flex-col gap-4">
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
              error={round.status === 'error' ? (round.error ?? undefined) : undefined}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Шанс и множитель
              </p>
              <p className="text-xs text-muted">
                Выигрыш:{' '}
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

          {/* Single persistent action — one click plays, and one click replays. */}
          <Button
            size="lg"
            onClick={play}
            loading={spinning}
            disabled={!canPlay}
            className="w-full"
          >
            {spinning ? 'Крутится…' : revealed ? 'Ещё раз' : 'Играть'}
          </Button>
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

function Header() {
  return (
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
        <p className="text-sm text-muted">Чем ниже шанс, тем выше множитель</p>
      </div>
    </div>
  );
}
