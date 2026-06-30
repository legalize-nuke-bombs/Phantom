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
// Presentation choices (analytics, NOT marketing):
//   • Money is shown as WHOLE dollars (formatUsd(x, 0)) in a neutral colour — these are aggregates,
//     cents are noise here, and the finance-tier "Amount" rainbow only distracts in a dashboard.
//   • Percentages carry one decimal (RTP / shares).
//   • Per-game colour is a calm sand-free BLUE-GREY monochrome (told apart by lightness + legend),
//     never the tier rainbow. The time line uses the brand accent (ton). Profit keeps win/lose —
//     that's +/- semantics, not a size tier.
//   Aggregates are cached (long staleTime) and `now` is pinned per mount so tab flips don't rebuild.

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
import Card from '@/shared/ui/Card';
import PageBack from '@/shared/ui/PageBack';
import Spinner from '@/shared/ui/Spinner';

const STALE = 5 * 60 * 1000; // cache window — don't refetch the aggregates on every tab flip

/** Whole-dollar money for the dashboard (no cents — aggregates), in a neutral colour. */
const usd = (n: number | string) => formatUsd(n, 0);
/** Signed profit, whole dollars: "+$28" / "−$5". */
const signedUsd = (n: number) => `${n >= 0 ? '+' : '−'}${formatUsd(Math.abs(n), 0)}`;

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

/* ── palette: calm blue-grey monochrome (told apart by lightness, never a rainbow) ── */
const PALETTE = ['#4a86b5', '#6699c0', '#82accb', '#9ec0d6', '#b6cfdd', '#cdddd6'] as const;
const colorAt = (i: number) => PALETTE[i % PALETTE.length];
const LINE = 'var(--color-ton)'; // brand accent for the one time-series line

/* ── view model ─────────────────────────────────────────────────────────────── */
interface Row {
  key: string;
  emoji: string;
  name: string;
  color: string;
  count: number;
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

/** RTP as a one-decimal share string ("96.5%"), or "—" when there were no stakes. */
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

/* ── summary: four headline figures, neutral money ──────────────────────────────*/
function SummaryCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-1.5 p-4">
      <div className="flex items-center gap-1.5 text-muted">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <span className="font-mono text-lg font-semibold tabular-nums text-fg">{children}</span>
    </Card>
  );
}

function Summary({ totals }: { totals: { count: number; bets: number; results: number } }) {
  const profit = totals.bets - totals.results;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCard icon={<BarChart3 size={14} strokeWidth={2} />} label="Игр">
        {totals.count.toLocaleString('ru-RU')}
      </SummaryCard>
      <SummaryCard icon={<Coins size={14} strokeWidth={2} />} label="Ставки">
        {usd(totals.bets)}
      </SummaryCard>
      <SummaryCard icon={<Wallet size={14} strokeWidth={2} />} label="Прибыль">
        <span className={profit >= 0 ? 'text-win' : 'text-lose'}>{signedUsd(profit)}</span>
      </SummaryCard>
      <SummaryCard icon={<Percent size={14} strokeWidth={2} />} label="RTP">
        {rtp(totals.bets, totals.results)}
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
          <tbody className="divide-y divide-edge font-mono tabular-nums">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-4 py-3 font-sans">
                  <span className="flex items-center gap-2 text-fg">
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                    <span aria-hidden className="text-base leading-none">
                      {r.emoji}
                    </span>
                    <span className="font-medium">{r.name}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-fg">{r.count.toLocaleString('ru-RU')}</td>
                <td className="px-4 py-3 text-right text-fg">{usd(r.betsNum)}</td>
                <td className="px-4 py-3 text-right text-muted">{r.count > 0 ? usd(r.betsNum / r.count) : '—'}</td>
                <td className="px-4 py-3 text-right text-fg">{usd(r.resultsNum)}</td>
                <td className="px-4 py-3 text-right text-muted">{rtp(r.betsNum, r.resultsNum)}</td>
                <td className={clsx('px-4 py-3 text-right font-semibold', r.profitNum >= 0 ? 'text-win' : 'text-lose')}>
                  {signedUsd(r.profitNum)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ── stakes over time — total staked up to each point in time (the integral of the per-period
   stakes), so the curve only climbs: flat where nothing was staked, rising where it was. A Y
   axis (0 / half / max) with gridlines makes the magnitude readable; X labels are thinned. An
   all-zero window shows an empty note. */
const CW = 640;
const CH = 200;
const PAD = { l: 52, r: 12, t: 14, b: 26 };
const IW = CW - PAD.l - PAD.r;
const IH = CH - PAD.t - PAD.b;

function StakesLine({ points, loading }: { points: { label: string; bets: number }[]; loading: boolean }) {
  const max = Math.max(0, ...points.map((p) => p.bets));
  const n = points.length;
  const xAt = (i: number) => PAD.l + (n <= 1 ? IW / 2 : (i / (n - 1)) * IW);
  const yAt = (v: number) => PAD.t + IH - (max > 0 ? (v / max) * IH : 0);
  const labelEvery = Math.max(1, Math.ceil(n / 7));
  const yTicks = [0, 0.5, 1].map((f) => f * max); // 0 / half / max

  const line = points.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.bets).toFixed(1)}`).join(' ');

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
          {/* Y gridlines + value labels (0 / half / max) */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.l} y1={yAt(t)} x2={PAD.l + IW} y2={yAt(t)} className="stroke-edge" strokeWidth={1} />
              <text
                x={PAD.l - 8}
                y={yAt(t) + 3}
                textAnchor="end"
                className="fill-muted"
                style={{ fontSize: 11 }}
              >
                {usd(t)}
              </text>
            </g>
          ))}
          {/* the cumulative curve */}
          <polyline
            points={line}
            fill="none"
            stroke={LINE}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* points + thinned x labels */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={xAt(i)} cy={yAt(p.bets)} r={2.5} fill={LINE} />
              {i % labelEvery === 0 ? (
                <text x={xAt(i)} y={CH - 8} textAnchor="middle" className="fill-muted" style={{ fontSize: 11 }}>
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
              <span className="font-mono text-base font-semibold tabular-nums text-fg">{usd(totalBets)}</span>
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
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted">{(a.share * 100).toFixed(1)}%</span>
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

  // Cumulative: each point is the running total of bets up to that ray, so the curve only ever
  // climbs (a "по времени" total can't shrink) — flat where nothing was staked, never dipping.
  const points = useMemo(() => {
    let cum = 0;
    return rays.map((ray, i) => {
      const data = rayResults[i]?.data?.data ?? {};
      let bets = 0;
      for (const s of Object.values(data)) bets += Number(s.bets) || 0;
      cum += bets;
      return { label: ray.label, bets: cum };
    });
  }, [rays, rayResults]);
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
