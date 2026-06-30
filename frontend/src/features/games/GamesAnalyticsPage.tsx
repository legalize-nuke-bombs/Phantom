// Extended games analytics (route: /analytics) — a moderator-only dashboard over the house
// numbers per game, plus a stakes-over-time line built from per-ray backend aggregates.
//
// Backend, verified live:
//   GET /api/games/analytics?since={epochSec}&before={epochSec}  (both optional, half-open [since, before))
//     → { data: { "<GameType>": { count: number, bets: string, results: string } } }
//   count is a number; bets/results are decimal STRINGS (BigDecimal). Keys are GameType enum
//   names, but we iterate the REAL keys (Object.entries + gameMeta). Access = chatModeratorAccess.
//
// Wording (this is a casino — exact, not childish):
//   bets→«Ставки» (staked; NOT «Оборот») · results→«Выигрыши» (won back; NOT «Выплаты» = on-chain
//   withdrawals) · profit = bets−results →«Прибыль» (can be negative) · RTP = results/bets · avg = bets/count.
//
// COST: each query is cached with a long staleTime so flipping tabs / re-mounting doesn't rebuild
// the (expensive) aggregates — and `now` is pinned per mount so the query keys stay stable.
// Per-game colour uses the theme's restrained `tier-*` tokens via inline var() (Tailwind v4 can't
// purge an inline style the way it would a concatenated class).

import { useMemo, useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { BarChart3, Coins, LineChart, PieChart, Percent, Wallet } from 'lucide-react';
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

const STALE = 5 * 60 * 1000; // cache window — don't refetch the aggregates on every tab flip

/* ── DTO ───────────────────────────────────────────────────────────────────── */
interface GameStat {
  count: number;
  bets: string;
  results: string;
}
type AnalyticsResponse = { data: Record<string, GameStat> };

/* ── periods (only two, per the owner) ──────────────────────────────────────────
   headlineWindow drives the summary/table/donut (one call; null = all time). The line chart
   always has a finite window split into `chartRays` half-open intervals — for "Всё время" we
   show the last 4 weeks by day so the curve has an x-axis even though the headline is unbounded. */
const DAY = 86400;
interface Period {
  key: string;
  label: string;
  headlineWindow: number | null;
  chartWindow: number;
  chartRays: number;
}
const PERIODS: readonly Period[] = [
  { key: '24h', label: '24 часа', headlineWindow: DAY, chartWindow: DAY, chartRays: 8 },
  { key: 'all', label: 'Всё время', headlineWindow: null, chartWindow: 28 * DAY, chartRays: 14 },
];

/* ── palette (theme tier tokens — restrained, on-brand) ───────────────────────── */
const PALETTE = [
  'var(--color-tier-blue)',
  'var(--color-tier-purple)',
  'var(--color-tier-pink)',
  'var(--color-tier-gold)',
  'var(--color-tier-grey)',
  'var(--color-tier-red)',
] as const;
const colorAt = (i: number) => PALETTE[i % PALETTE.length];

/* ── view model ─────────────────────────────────────────────────────────────── */
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

function rtp(bets: number, results: number): string {
  if (bets <= 0) return '—';
  return `${((results / bets) * 100).toFixed(1)}%`;
}

/* ── time rays ──────────────────────────────────────────────────────────────── */
interface Ray {
  since: number;
  before: number;
  label: string;
}
function raysFor(period: Period, now: number): Ray[] {
  const step = period.chartWindow / period.chartRays;
  const start = now - period.chartWindow;
  const hourly = period.chartWindow <= DAY;
  return Array.from({ length: period.chartRays }, (_, i) => {
    const since = Math.floor(start + i * step);
    const before = Math.floor(start + (i + 1) * step);
    const d = new Date(since * 1000);
    const label = hourly
      ? `${String(d.getHours()).padStart(2, '0')}:00`
      : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { since, before, label };
  });
}

/* ── gate ─────────────────────────────────────────────────────────────────────*/
function NoAccess() {
  return (
    <div className="mx-auto w-full max-w-lg">
      <Card className="grid place-items-center p-10 text-center">
        <div className="max-w-sm">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl border border-edge bg-panel-2 text-lose">
            <BarChart3 size={24} strokeWidth={2} />
          </span>
          <h1 className="text-lg font-semibold text-fg">Недостаточно прав</h1>
          <p className="mt-1.5 text-sm text-muted">Эта аналитика доступна только модераторам платформы.</p>
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
              'flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors',
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

/* ── summary: four headline figures ─────────────────────────────────────────────*/
function SummaryCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
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

/* ── per-game table — the main carrier of the numbers ───────────────────────────*/
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
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
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

/* ── stakes over time — an XY line (not bars), one point per ray ─────────────────
   Plotted in a fixed viewBox; the polyline is the stakes curve, with a faint area fill under it
   and a dot per point. X labels are thinned so they never collide. Flat-zero windows (no games
   in the range) show an empty note instead of a line pinned to the floor. */
const CW = 640;
const CH = 200;
const PAD = { l: 10, r: 10, t: 14, b: 26 };
const IW = CW - PAD.l - PAD.r;
const IH = CH - PAD.t - PAD.b;

function StakesLine({ points, loading }: { points: { label: string; bets: number }[]; loading: boolean }) {
  const max = Math.max(0, ...points.map((p) => p.bets));
  const n = points.length;
  const xAt = (i: number) => PAD.l + (n <= 1 ? IW / 2 : (i / (n - 1)) * IW);
  const yAt = (v: number) => PAD.t + IH - (max > 0 ? (v / max) * IH : 0);
  const labelEvery = Math.max(1, Math.ceil(n / 7));

  const line = points.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.bets).toFixed(1)}`).join(' ');
  const area = `${PAD.l},${(PAD.t + IH).toFixed(1)} ${line} ${(PAD.l + IW).toFixed(1)},${(PAD.t + IH).toFixed(1)}`;

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-fg">
        <span className="text-muted">
          <LineChart size={16} strokeWidth={2} />
        </span>
        <h2 className="text-sm font-semibold">Ставки по времени</h2>
      </div>

      {loading ? (
        <div className="grid h-48 place-items-center">
          <Spinner size={24} />
        </div>
      ) : max === 0 ? (
        <div className="grid h-48 place-items-center text-sm text-muted">За этот период ставок не было</div>
      ) : (
        <svg viewBox={`0 0 ${CW} ${CH}`} className="h-48 w-full" preserveAspectRatio="none">
          {/* baseline */}
          <line x1={PAD.l} y1={PAD.t + IH} x2={PAD.l + IW} y2={PAD.t + IH} className="stroke-edge" strokeWidth={1} />
          {/* area under the curve */}
          <polygon points={area} fill="var(--color-ton)" opacity={0.12} />
          {/* the curve */}
          <polyline
            points={line}
            fill="none"
            stroke="var(--color-ton)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* points + thinned x labels */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={xAt(i)} cy={yAt(p.bets)} r={2.5} fill="var(--color-ton)" />
              {i % labelEvery === 0 ? (
                <text
                  x={xAt(i)}
                  y={CH - 8}
                  textAnchor="middle"
                  className="fill-muted"
                  style={{ fontSize: 11 }}
                >
                  {p.label}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      )}
    </Card>
  );
}

/* ── donut — share of stakes by game ────────────────────────────────────────────*/
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
            <circle cx={DONUT_CENTER} cy={DONUT_CENTER} r={DONUT_R} fill="none" strokeWidth={DONUT_STROKE} className="stroke-edge" />
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
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
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

/* ── page ──────────────────────────────────────────────────────────────────────*/
export default function GamesAnalyticsPage() {
  const { loading } = useAuth();
  const { isChatModerator } = useMyCapabilities();
  const [periodKey, setPeriodKey] = useState<string>(PERIODS[0].key);
  const period = PERIODS.find((p) => p.key === periodKey) ?? PERIODS[0];

  // Pin "now" to the mount (NOT to the period) so flipping tabs reuses cached query keys.
  const now = useMemo(() => Math.floor(Date.now() / 1000), []);

  const headlineQs = period.headlineWindow == null ? '' : `?since=${now - period.headlineWindow}`;
  const headline = useQuery({
    queryKey: ['games', 'analytics', period.key, now],
    queryFn: () => api.get<AnalyticsResponse>(`/games/analytics${headlineQs}`),
    enabled: isChatModerator,
    staleTime: STALE,
  });

  const rays = useMemo(() => raysFor(period, now), [period, now]);
  const rayResults = useQueries({
    queries: rays.map((ray) => ({
      queryKey: ['games', 'analytics', 'ray', ray.since, ray.before],
      queryFn: () => api.get<AnalyticsResponse>(`/games/analytics?since=${ray.since}&before=${ray.before}`),
      enabled: isChatModerator,
      staleTime: STALE,
    })),
  });

  const rows = useMemo(() => (headline.data ? toRows(headline.data.data) : []), [headline.data]);
  const totals = useMemo(() => totalsOf(rows), [rows]);

  const points = useMemo(
    () =>
      rays.map((ray, i) => {
        const data = rayResults[i]?.data?.data ?? {};
        let bets = 0;
        for (const s of Object.values(data)) bets += Number(s.bets) || 0;
        return { label: ray.label, bets };
      }),
    [rays, rayResults],
  );
  const raysLoading = rayResults.some((q) => q.isLoading);

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
          <StakesLine points={points} loading={raysLoading} />
          <StakeDonut rows={rows} totalBets={totals.bets} />
        </div>
      )}
    </div>
  );
}
