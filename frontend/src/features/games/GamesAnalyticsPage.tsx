// Extended games analytics (route: /analytics). A moderator-only dashboard over the
// house numbers per game: turnover (bets), payouts (results) and the casino's profit
// (bets − results) across a chosen time window.
//
// Backend, verified live:
//   GET /api/games/analytics?since={epochSec}&before={epochSec}  (both optional)
//     → { data: { "<GameType>": { count: number, bets: string, results: string } } }
//   count is a number; bets/results are decimal STRINGS (BigDecimal). Keys are
//   GameType enum names, but we iterate the REAL keys of the response (Object.entries
//   + gameMeta) so a game the backend adds before the frontend knows it still renders.
//   Access is the chatModeratorAccess grant — anyone else gets 403 NO_PERMISSION
//   ("Недостаточно прав", mapped in errors.ts). This page is UX gating, not security.
//
// SELF-GATING mirrors ModerationPage: gate on the CAPABILITY FLAG (useMyCapabilities
// → isChatModerator), never a role name; wait for useAuth().loading to settle first so
// a logged-in moderator never flashes the "no access" card on first paint.
//
// Semantics: bets = turnover (sum of stakes), results = sum of payouts to players.
// Profit = bets − results, and CAN be negative (a player up overall) — so every profit
// figure carries its sign and is tinted win (≥0) / lose (<0). Sums shown with <Amount>
// (size-tiered colour); only profit overrides the colour for sign. All math goes
// through Number(); display goes through <Amount> / formatUsd to keep the decimals
// honest. Numbers are font-mono tabular-nums.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Coins, PieChart, Receipt, Wallet } from 'lucide-react';
import clsx from 'clsx';

import { api } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { gameMeta } from '@/shared/lib/games';
import { formatUsd } from '@/shared/lib/money';
import { useMyCapabilities } from '@/shared/lib/roles';
import Amount from '@/shared/ui/Amount';
import Card from '@/shared/ui/Card';
import PageBack from '@/shared/ui/PageBack';
import Spinner from '@/shared/ui/Spinner';

/* ── DTO ──────────────────────────────────────────────────────────────────
   One bucket of GET /api/games/analytics, keyed by GameType enum name. count is a
   number; bets/results are decimal strings (never do float math on them un-coerced). */
interface GameStat {
  count: number;
  bets: string;
  results: string;
}
type AnalyticsResponse = { data: Record<string, GameStat> };

/* ── periods ───────────────────────────────────────────────────────────────
   The segmented control computes `since` as an epoch-second floor of (now − N). "Всё
   время" drops `since` entirely; `before` is never sent (always "up to now"). */
interface Period {
  key: string;
  label: string;
  /** Seconds to subtract from now; null = no lower bound (all time). */
  windowSec: number | null;
}

const DAY = 86400;
const PERIODS: readonly Period[] = [
  { key: '24h', label: '24 часа', windowSec: DAY },
  { key: '7d', label: '7 дней', windowSec: 7 * DAY },
  { key: '30d', label: '30 дней', windowSec: 30 * DAY },
  { key: 'all', label: 'Всё время', windowSec: null },
];

/* ── per-game palette ────────────────────────────────────────────────────────
   Tailwind v4 has no safelist here, so a colour can never be built by concatenation
   (`bg-${x}` would be purged). Each game maps to a LITERAL token name; bar fills use
   inline `var(--color-*)` and donut strokes the matching CSS var, so both read from
   the same source. Unknown games cycle through the spare tier hues by index. */
const GAME_COLOR: Record<string, string> = {
  CASES: 'ton',
  FRUITS: 'warn',
  COINFLIP: 'tier-purple',
  UPGRADER: 'win',
};
const FALLBACK_COLORS = ['tier-blue', 'tier-pink', 'tier-red', 'tier-gold'] as const;

/** Resolve a game key to its colour TOKEN (e.g. "ton"), assigning spares in order. */
function colorToken(key: string, fallbackIdx: number): string {
  return GAME_COLOR[key] ?? FALLBACK_COLORS[fallbackIdx % FALLBACK_COLORS.length];
}

/* ── view model ─────────────────────────────────────────────────────────────
   Flatten the response into one row per game (real keys → gameMeta + numbers), sorted
   by turnover desc so the biggest mover leads every chart. Strings are kept for
   <Amount>; the Number() fields drive bar widths, the donut and the totals. */
interface Row {
  key: string;
  emoji: string;
  name: string;
  color: string; // token, e.g. "ton"
  count: number;
  bets: string;
  results: string;
  betsNum: number;
  resultsNum: number;
  profitNum: number;
}

function toRows(data: Record<string, GameStat>): Row[] {
  return Object.entries(data)
    .map(([key, stat], i) => {
      const meta = gameMeta(key);
      const betsNum = Number(stat.bets) || 0;
      const resultsNum = Number(stat.results) || 0;
      return {
        key,
        emoji: meta.emoji,
        name: meta.name,
        color: colorToken(key, i),
        count: stat.count,
        bets: stat.bets,
        results: stat.results,
        betsNum,
        resultsNum,
        profitNum: betsNum - resultsNum,
      };
    })
    .sort((a, b) => b.betsNum - a.betsNum);
}

/** Totals across all games — the summary cards and donut centre. */
function totalsOf(rows: Row[]) {
  return rows.reduce(
    (acc, r) => ({
      count: acc.count + r.count,
      bets: acc.bets + r.betsNum,
      results: acc.results + r.resultsNum,
    }),
    { count: 0, bets: 0, results: 0 },
  );
}

/* ── gate: no access ──────────────────────────────────────────────────────
   Shown to anyone without chat-moderator access (copied from ModerationPage so the
   page stands alone even though the nav link is hidden for them). */
function NoAccess() {
  return (
    <div className="mx-auto w-full max-w-lg">
      <Card className="grid place-items-center p-10 text-center">
        <div className="max-w-sm">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl border border-edge bg-panel-2 text-lose">
            <BarChart3 size={24} strokeWidth={2} />
          </span>
          <h1 className="text-lg font-semibold text-fg">Недостаточно прав</h1>
          <p className="mt-1.5 text-sm text-muted">
            Эта аналитика доступна только модераторам платформы.
          </p>
        </div>
      </Card>
    </div>
  );
}

/* ── header ──────────────────────────────────────────────────────────────── */
function Header() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-ton">
        <BarChart3 size={22} strokeWidth={2} />
      </span>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
          Аналитика игр
        </h1>
        <p className="text-sm text-muted">Обороты, выплаты и профит по играм 📊</p>
      </div>
    </div>
  );
}

/* ── period segmented control (driven by state, styled like ProgressPage) ──── */
function PeriodTabs({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <nav className="flex gap-1 rounded-xl border border-edge bg-panel p-1">
      {PERIODS.map((p) => {
        const active = p.key === value;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(p.key)}
            aria-pressed={active}
            className={clsx(
              'flex-1 rounded-lg px-2 py-2 text-center text-xs font-medium transition-colors sm:text-sm',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ton',
              active ? 'bg-panel-2 text-fg shadow-sm' : 'text-muted hover:text-fg',
            )}
          >
            {p.label}
          </button>
        );
      })}
    </nav>
  );
}

/* ── summary cards ───────────────────────────────────────────────────────────
   Four headline figures. Profit is the only signed one — win when the house is up,
   lose when players are. Σ turnover / payouts go through <Amount> (size-tiered). */
function SummaryCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-1.5 p-4">
      <div className="flex items-center gap-1.5 text-muted">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <span className="font-mono text-lg font-semibold tabular-nums">{children}</span>
    </Card>
  );
}

function Summary({
  totals,
}: {
  totals: { count: number; bets: number; results: number };
}) {
  const profit = totals.bets - totals.results;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCard
        icon={<BarChart3 size={14} strokeWidth={2} />}
        label="Всего игр"
      >
        <span className="text-fg">{totals.count.toLocaleString('ru-RU')}</span>
      </SummaryCard>
      <SummaryCard icon={<Coins size={14} strokeWidth={2} />} label="Оборот">
        <Amount value={totals.bets} />
      </SummaryCard>
      <SummaryCard icon={<Receipt size={14} strokeWidth={2} />} label="Выплаты">
        <Amount value={totals.results} />
      </SummaryCard>
      <SummaryCard icon={<Wallet size={14} strokeWidth={2} />} label="Профит казино">
        <span className={profit >= 0 ? 'text-win' : 'text-lose'}>
          {profit >= 0 ? '+' : '−'}
          {formatUsd(Math.abs(profit))}
        </span>
      </SummaryCard>
    </div>
  );
}

/* ── chart 1: horizontal bars — turnover by game ─────────────────────────────
   Each row is a labelled bar whose width is the game's share of the MAX turnover (so
   the leader fills the track). Fill colour is the per-game token via inline
   var(--color-*) — never a concatenated class (Tailwind v4 would purge it). */
function TurnoverBars({ rows, maxBets }: { rows: Row[]; maxBets: number }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-fg">
        <span className="text-ton">
          <Coins size={16} strokeWidth={2} />
        </span>
        <h2 className="text-sm font-semibold">Оборот по играм</h2>
      </div>

      <div className="flex flex-col gap-4">
        {rows.map((r) => {
          const pct = maxBets > 0 ? Math.max(2, (r.betsNum / maxBets) * 100) : 0;
          return (
            <div key={r.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5 text-sm text-fg">
                  <span aria-hidden className="text-base leading-none">
                    {r.emoji}
                  </span>
                  <span className="truncate font-medium">{r.name}</span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                    {r.count.toLocaleString('ru-RU')} игр
                  </span>
                </span>
                <Amount
                  value={r.bets}
                  className="shrink-0 font-mono text-sm font-semibold tabular-nums"
                />
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full border border-edge bg-panel-2">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${pct}%`, background: `var(--color-${r.color})` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ── chart 2: donut — share of turnover by game ──────────────────────────────
   A multi-segment ring (same technique as UpgraderPage's Ring): each game is one
   <circle> whose strokeDasharray draws its arc and whose strokeDashoffset is the
   negative cumulative length so the next arc begins where the last ended; the whole
   ring is rotated -90° to start at 12 o'clock. Stroke colour is the per-game CSS var.
   Centre shows Σ turnover; a legend lists each game with its colour dot and share. */
const DONUT = 168; // viewBox side
const DONUT_R = 66; // ring radius
const DONUT_STROKE = 20;
const DONUT_C = 2 * Math.PI * DONUT_R; // circumference
const DONUT_CENTER = DONUT / 2;

function TurnoverDonut({ rows, totalBets }: { rows: Row[]; totalBets: number }) {
  // Only games with turnover contribute an arc; their shares sum to ≤ 100%.
  const segments = rows.filter((r) => r.betsNum > 0);

  // Pre-compute (share, dash length, offset) walking the ring once.
  let acc = 0;
  const arcs = segments.map((r) => {
    const share = totalBets > 0 ? r.betsNum / totalBets : 0;
    const len = DONUT_C * share;
    const offset = -DONUT_C * acc; // start where the previous arc ended
    acc += share;
    return { key: r.key, color: r.color, share, len, offset };
  });

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-fg">
        <span className="text-ton">
          <PieChart size={16} strokeWidth={2} />
        </span>
        <h2 className="text-sm font-semibold">Доля оборота по играм</h2>
      </div>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
        <div className="relative aspect-square w-44 shrink-0">
          <svg viewBox={`0 0 ${DONUT} ${DONUT}`} className="h-full w-full">
            {/* base track under the segments */}
            <circle
              cx={DONUT_CENTER}
              cy={DONUT_CENTER}
              r={DONUT_R}
              fill="none"
              strokeWidth={DONUT_STROKE}
              className="stroke-edge"
            />
            {/* one arc per game, sweeping clockwise from 12 o'clock */}
            <g transform={`rotate(-90 ${DONUT_CENTER} ${DONUT_CENTER})`}>
              {arcs.map((a) => (
                <circle
                  key={a.key}
                  cx={DONUT_CENTER}
                  cy={DONUT_CENTER}
                  r={DONUT_R}
                  fill="none"
                  strokeWidth={DONUT_STROKE}
                  stroke={`var(--color-${a.color})`}
                  strokeDasharray={`${a.len} ${DONUT_C - a.len}`}
                  strokeDashoffset={a.offset}
                />
              ))}
            </g>
          </svg>
          {/* centre readout — Σ turnover, clear of the ring */}
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-muted">
                Оборот
              </span>
              <Amount
                value={totalBets}
                className="font-mono text-base font-semibold tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* legend */}
        <ul className="flex w-full flex-col gap-2 sm:flex-1">
          {arcs.map((a) => {
            const meta = gameMeta(a.key);
            return (
              <li key={a.key} className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: `var(--color-${a.color})` }}
                />
                <span className="min-w-0 flex-1 truncate text-fg">
                  <span aria-hidden className="mr-1">
                    {meta.emoji}
                  </span>
                  {meta.name}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                  {(a.share * 100).toFixed(1)}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

/* ── per-game table ──────────────────────────────────────────────────────────
   game | count | bets | results | profit. Profit carries its sign and is tinted
   win/lose. font-mono tabular-nums throughout; sums via <Amount>, profit via formatUsd
   so the sign colour isn't overridden by <Amount>'s size tier. On narrow screens the
   table scrolls horizontally rather than cramping. */
function GamesTable({ rows }: { rows: Row[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Игра</th>
              <th className="px-4 py-3 text-right font-medium">Игр</th>
              <th className="px-4 py-3 text-right font-medium">Ставки</th>
              <th className="px-4 py-3 text-right font-medium">Выплаты</th>
              <th className="px-4 py-3 text-right font-medium">Профит</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5 text-fg">
                    <span aria-hidden className="text-base leading-none">
                      {r.emoji}
                    </span>
                    <span className="font-medium">{r.name}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-fg">
                  {r.count.toLocaleString('ru-RU')}
                </td>
                <td className="px-4 py-3 text-right">
                  <Amount value={r.bets} className="font-mono tabular-nums" />
                </td>
                <td className="px-4 py-3 text-right">
                  <Amount value={r.results} className="font-mono tabular-nums" />
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={clsx(
                      'font-mono font-semibold tabular-nums',
                      r.profitNum >= 0 ? 'text-win' : 'text-lose',
                    )}
                  >
                    {r.profitNum >= 0 ? '+' : '−'}
                    {formatUsd(Math.abs(r.profitNum))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ── page ──────────────────────────────────────────────────────────────────*/
export default function GamesAnalyticsPage() {
  const { loading } = useAuth();
  const { isChatModerator } = useMyCapabilities();
  const [periodKey, setPeriodKey] = useState<string>(PERIODS[0].key);

  const period = PERIODS.find((p) => p.key === periodKey) ?? PERIODS[0];

  // since = now − window (epoch seconds); "Всё время" omits it. before is never sent.
  const queryString = useMemo(() => {
    if (period.windowSec == null) return '';
    const since = Math.floor(Date.now() / 1000) - period.windowSec;
    const params = new URLSearchParams({ since: String(since) });
    return `?${params}`;
  }, [period.windowSec]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['games', 'analytics', period.key],
    queryFn: () => api.get<AnalyticsResponse>(`/games/analytics${queryString}`),
    // Don't fetch until we know the viewer is allowed — keeps a 403 out of the cache
    // for non-moderators who somehow reach the route directly.
    enabled: isChatModerator,
  });

  const rows = useMemo(() => (data ? toRows(data.data) : []), [data]);
  const totals = useMemo(() => totalsOf(rows), [rows]);
  const maxBets = rows.length ? rows[0].betsNum : 0; // rows are sorted by bets desc

  // Wait for auth to settle before deciding access — otherwise a moderator would flash
  // the "no access" card while /users/me is in flight.
  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (!isChatModerator) return <NoAccess />;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 sm:gap-6">
      <PageBack to="/games" label="К играм" />
      <Header />
      <PeriodTabs value={periodKey} onChange={setPeriodKey} />

      {isLoading ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner size={32} />
        </div>
      ) : isError ? (
        <Card className="p-8 text-center text-sm text-lose">
          {errorMessage(error, 'Не удалось загрузить аналитику')}
        </Card>
      ) : rows.length === 0 ? (
        <Card className="grid place-items-center gap-3 p-10 text-center">
          <BarChart3 size={28} className="text-muted" />
          <p className="text-sm text-muted">За выбранный период игр не было</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-5 sm:gap-6">
          <Summary totals={totals} />
          <TurnoverBars rows={rows} maxBets={maxBets} />
          <TurnoverDonut rows={rows} totalBets={totals.bets} />
          <GamesTable rows={rows} />
        </div>
      )}
    </div>
  );
}
