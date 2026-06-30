// Extended games analytics (route: /analytics) — a moderator-only dashboard over the house
// numbers per game, plus a turnover-over-time chart built from per-ray backend aggregates.
//
// Backend, verified live:
//   GET /api/games/analytics?since={epochSec}&before={epochSec}  (both optional, half-open [since, before))
//     → { data: { "<GameType>": { count: number, bets: string, results: string } } }
//   count is a number; bets/results are decimal STRINGS (BigDecimal). Keys are GameType enum
//   names, but we iterate the REAL keys (Object.entries + gameMeta) so a game the backend adds
//   before the frontend knows it still renders. Access = chatModeratorAccess (else 403).
//
// Wording (this is a casino — be exact, not childish):
//   • bets    → «Ставки»   (the amount staked; NOT «Оборот»)
//   • results → «Выигрыши» (what players won back; NOT «Выплаты» — that word is on-chain withdrawals)
//   • profit  = bets − results → «Прибыль» (the house's cut; can be negative when players are up)
//   • RTP     = results / bets  (share returned to players)
//   • avg bet = bets / count
// Money shown via <Amount>; profit via formatUsd + sign so win/lose colour isn't overridden by
// <Amount>'s size tier. All math through Number(); numbers are font-mono tabular-nums.
//
// Per-game colour is a restrained SAND→ACID-GREEN palette kept OUTSIDE the theme tokens
// (the owner wanted these specific muted hues), applied via inline var/hex so Tailwind v4's
// purge can't strip a concatenated class.

import { useMemo, useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { BarChart3, Coins, PieChart, Percent, Wallet } from 'lucide-react';
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

/* ── DTO ───────────────────────────────────────────────────────────────────── */
interface GameStat {
  count: number;
  bets: string;
  results: string;
}
type AnalyticsResponse = { data: Record<string, GameStat> };

/* ── periods ───────────────────────────────────────────────────────────────────
   Each period drives BOTH the headline aggregate (one /analytics call for the whole window)
   and the time chart (split into `rays` equal half-open intervals, one call each). "Всё время"
   omits `since` for the headline and has no rays (no lower bound to split). */
const DAY = 86400;
interface Period {
  key: string;
  label: string;
  windowSec: number | null; // null = all time
  rays: number; // how many intervals the time chart splits the window into (0 = no chart)
}
const PERIODS: readonly Period[] = [
  { key: '24h', label: '24 часа', windowSec: DAY, rays: 8 },
  { key: '7d', label: '7 дней', windowSec: 7 * DAY, rays: 7 },
  { key: '30d', label: '30 дней', windowSec: 30 * DAY, rays: 10 },
  { key: 'all', label: 'Всё время', windowSec: null, rays: 0 },
];

/* ── palette (sand → muted acid-green, OUTSIDE the theme on purpose) ──────────── */
const PALETTE = ['#cbb480', '#bcb457', '#a8ad44', '#90a23a', '#7f9b4a', '#9a9c55'] as const;
/** Stable colour for a game by its position in the (turnover-sorted) list. */
const colorAt = (i: number) => PALETTE[i % PALETTE.length];

/* ── view model ────────────────────────────────────────────────────────────────
   One row per game from the real response keys, sorted by stake desc so the biggest mover
   leads. Strings kept for <Amount>; the Number() fields drive the donut, RTP and the totals. */
interface Row {
  key: string;
  emoji: string;
  name: string;
  color: string;
  count: number;
  bets: string;
  results: string;
  betsNum: number;
  resultsNum: number;
  profitNum: number;
}

function toRows(data: Record<string, GameStat>): Row[] {
  return Object.entries(data)
    .map(([key, stat]) => {
      const meta = gameMeta(key);
      const betsNum = Number(stat.bets) || 0;
      const resultsNum = Number(stat.results) || 0;
      return {
        key,
        emoji: meta.emoji,
        name: meta.name,
        color: '',
        count: stat.count,
        bets: stat.bets,
        results: stat.results,
        betsNum,
        resultsNum,
        profitNum: betsNum - resultsNum,
      };
    })
    .sort((a, b) => b.betsNum - a.betsNum)
    .map((r, i) => ({ ...r, color: colorAt(i) }));
}

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

/** RTP as a share string ("96.5%"), or "—" when there were no stakes. */
function rtp(bets: number, results: number): string {
  if (bets <= 0) return '—';
  return `${((results / bets) * 100).toFixed(1)}%`;
}

/* ── time rays ─────────────────────────────────────────────────────────────────
   Split [now − window, now) into `count` equal half-open intervals for the chart. Labels are
   the interval START: hour for the 24h view, DD.MM for the multi-day views. */
interface Ray {
  since: number;
  before: number;
  label: string;
}
function raysFor(period: Period, now: number): Ray[] {
  if (period.windowSec == null || period.rays === 0) return [];
  const step = period.windowSec / period.rays;
  const start = now - period.windowSec;
  const hourly = period.windowSec <= DAY;
  return Array.from({ length: period.rays }, (_, i) => {
    const since = Math.floor(start + i * step);
    const before = Math.floor(start + (i + 1) * step);
    const d = new Date(since * 1000);
    const label = hourly
      ? `${String(d.getHours()).padStart(2, '0')}:00`
      : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { since, before, label };
  });
}

/* ── gate: no access (copied from ModerationPage so the page stands alone) ─────── */
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

function Header() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-fg">
        <BarChart3 size={22} strokeWidth={2} />
      </span>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Аналитика игр</h1>
        <p className="text-sm text-muted">Ставки, прибыль и RTP по играм</p>
      </div>
    </div>
  );
}

function PeriodTabs({ value, onChange }: { value: string; onChange: (key: string) => void }) {
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

/* ── summary: four headline figures, kept deliberately few ─────────────────────── */
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

function Summary({ totals }: { totals: { count: number; bets: number; results: number } }) {
  const profit = totals.bets - totals.results;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCard icon={<BarChart3 size={14} strokeWidth={2} />} label="Игр">
        <span className="text-fg">{totals.count.toLocaleString('ru-RU')}</span>
      </SummaryCard>
      <SummaryCard icon={<Coins size={14} strokeWidth={2} />} label="Ставки">
        <Amount value={totals.bets} />
      </SummaryCard>
      <SummaryCard icon={<Wallet size={14} strokeWidth={2} />} label="Прибыль">
        <span className={profit >= 0 ? 'text-win' : 'text-lose'}>
          {profit >= 0 ? '+' : '−'}
          {formatUsd(Math.abs(profit))}
        </span>
      </SummaryCard>
      <SummaryCard icon={<Percent size={14} strokeWidth={2} />} label="RTP">
        <span className="text-fg">{rtp(totals.bets, totals.results)}</span>
      </SummaryCard>
    </div>
  );
}

/* ── per-game table — the main carrier of the numbers ──────────────────────────── */
function GamesTable({ rows }: { rows: Row[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Игра</th>
              <th className="px-4 py-3 text-right font-medium">Игр</th>
              <th className="px-4 py-3 text-right font-medium">Ставки</th>
              <th className="px-4 py-3 text-right font-medium">Ср. ставка</th>
              <th className="px-4 py-3 text-right font-medium">Выигрыши</th>
              <th className="px-4 py-3 text-right font-medium">RTP</th>
              <th className="px-4 py-3 text-right font-medium">Прибыль</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 text-fg">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: r.color }}
                    />
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
                  {r.count > 0 ? (
                    <Amount value={r.betsNum / r.count} className="font-mono tabular-nums" />
                  ) : (
                    <span className="font-mono text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Amount value={r.results} className="font-mono tabular-nums" />
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-muted">
                  {rtp(r.betsNum, r.resultsNum)}
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

/* ── donut — share of stakes by game ───────────────────────────────────────────── */
const DONUT = 168;
const DONUT_R = 66;
const DONUT_STROKE = 20;
const DONUT_C = 2 * Math.PI * DONUT_R;
const DONUT_CENTER = DONUT / 2;

function StakeDonut({ rows, totalBets }: { rows: Row[]; totalBets: number }) {
  const segments = rows.filter((r) => r.betsNum > 0);
  let acc = 0;
  const arcs = segments.map((r) => {
    const share = totalBets > 0 ? r.betsNum / totalBets : 0;
    const len = DONUT_C * share;
    const offset = -DONUT_C * acc;
    acc += share;
    return { key: r.key, name: r.name, emoji: r.emoji, color: r.color, share, len, offset };
  });

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-fg">
        <span className="text-muted">
          <PieChart size={16} strokeWidth={2} />
        </span>
        <h2 className="text-sm font-semibold">Доля ставок по играм</h2>
      </div>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
        <div className="relative aspect-square w-44 shrink-0">
          <svg viewBox={`0 0 ${DONUT} ${DONUT}`} className="h-full w-full">
            <circle
              cx={DONUT_CENTER}
              cy={DONUT_CENTER}
              r={DONUT_R}
              fill="none"
              strokeWidth={DONUT_STROKE}
              className="stroke-edge"
            />
            <g transform={`rotate(-90 ${DONUT_CENTER} ${DONUT_CENTER})`}>
              {arcs.map((a) => (
                <circle
                  key={a.key}
                  cx={DONUT_CENTER}
                  cy={DONUT_CENTER}
                  r={DONUT_R}
                  fill="none"
                  strokeWidth={DONUT_STROKE}
                  stroke={a.color}
                  strokeDasharray={`${a.len} ${DONUT_C - a.len}`}
                  strokeDashoffset={a.offset}
                />
              ))}
            </g>
          </svg>
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-muted">Ставки</span>
              <Amount value={totalBets} className="font-mono text-base font-semibold tabular-nums" />
            </div>
          </div>
        </div>

        <ul className="flex w-full flex-col gap-2 sm:flex-1">
          {arcs.map((a) => (
            <li key={a.key} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: a.color }}
              />
              <span className="min-w-0 flex-1 truncate text-fg">
                <span aria-hidden className="mr-1">
                  {a.emoji}
                </span>
                {a.name}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                {(a.share * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

/* ── time chart — stakes over the window, one bar per ray ──────────────────────── */
function StakesOverTime({
  bars,
  loading,
}: {
  bars: { label: string; bets: number; profit: number }[];
  loading: boolean;
}) {
  const max = Math.max(1, ...bars.map((b) => b.bets));
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-fg">
        <span className="text-muted">
          <BarChart3 size={16} strokeWidth={2} />
        </span>
        <h2 className="text-sm font-semibold">Ставки по времени</h2>
      </div>

      {loading ? (
        <div className="grid h-44 place-items-center">
          <Spinner size={24} />
        </div>
      ) : (
        <div className="flex h-44 items-end gap-1.5">
          {bars.map((b, i) => {
            const h = Math.max(2, (b.bets / max) * 100);
            return (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t transition-[height] duration-500"
                    style={{ height: `${h}%`, background: PALETTE[0] }}
                    title={`${b.label}: ставки ${formatUsd(b.bets)}, прибыль ${b.profit >= 0 ? '+' : '−'}${formatUsd(Math.abs(b.profit))}`}
                  />
                </div>
                <span className="w-full truncate text-center text-[10px] tabular-nums text-muted">
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ── page ──────────────────────────────────────────────────────────────────────*/
export default function GamesAnalyticsPage() {
  const { loading } = useAuth();
  const { isChatModerator } = useMyCapabilities();
  const [periodKey, setPeriodKey] = useState<string>(PERIODS[0].key);
  const period = PERIODS.find((p) => p.key === periodKey) ?? PERIODS[0];

  // One pinned "now" per period selection so the headline call and every ray share the same
  // window edges (and react-query keys stay stable until the period changes).
  const now = useMemo(() => Math.floor(Date.now() / 1000), [periodKey]);

  const headlineQs = period.windowSec == null ? '' : `?since=${now - period.windowSec}`;
  const headline = useQuery({
    queryKey: ['games', 'analytics', period.key, now],
    queryFn: () => api.get<AnalyticsResponse>(`/games/analytics${headlineQs}`),
    enabled: isChatModerator,
  });

  // Time chart: one aggregate per ray, fetched in parallel. Each ray is a half-open [since,before).
  const rays = useMemo(() => raysFor(period, now), [period, now]);
  const rayResults = useQueries({
    queries: rays.map((ray) => ({
      queryKey: ['games', 'analytics', 'ray', ray.since, ray.before],
      queryFn: () => api.get<AnalyticsResponse>(`/games/analytics?since=${ray.since}&before=${ray.before}`),
      enabled: isChatModerator,
    })),
  });

  const rows = useMemo(() => (headline.data ? toRows(headline.data.data) : []), [headline.data]);
  const totals = useMemo(() => totalsOf(rows), [rows]);

  const bars = useMemo(
    () =>
      rays.map((ray, i) => {
        const data = rayResults[i]?.data?.data ?? {};
        let bets = 0;
        let results = 0;
        for (const s of Object.values(data)) {
          bets += Number(s.bets) || 0;
          results += Number(s.results) || 0;
        }
        return { label: ray.label, bets, profit: bets - results };
      }),
    [rays, rayResults],
  );
  const raysLoading = rays.length > 0 && rayResults.some((q) => q.isLoading);

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

      {headline.isLoading ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner size={32} />
        </div>
      ) : headline.isError ? (
        <Card className="p-8 text-center text-sm text-lose">
          {errorMessage(headline.error, 'Не удалось загрузить аналитику')}
        </Card>
      ) : rows.length === 0 ? (
        <Card className="grid place-items-center gap-3 p-10 text-center">
          <BarChart3 size={28} className="text-muted" />
          <p className="text-sm text-muted">За выбранный период игр не было</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-5 sm:gap-6">
          <Summary totals={totals} />
          <GamesTable rows={rows} />
          {rays.length > 0 ? <StakesOverTime bars={bars} loading={raysLoading} /> : null}
          <StakeDonut rows={rows} totalBets={totals.bets} />
        </div>
      )}
    </div>
  );
}
