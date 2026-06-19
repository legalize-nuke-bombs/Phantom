// LotteryStatusCard — a compact, live snapshot of the current global lottery round,
// shown as its own "Лотерея" section on both the home page and the games lobby (one
// shared badge in both places). Links to /games/lottery.
//
// Mirrors the lottery page contract: epoch-SECONDS timestamps, costTotal as the pot,
// and a 404 (LOTTERY_NOT_FOUND) in the brief window between rounds (handled softly).

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Ticket, Trophy } from 'lucide-react';
import { api, ApiError } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import { LOTTERY_META } from '@/shared/lib/games';
import Amount from '@/shared/ui/Amount';
import Card from '@/shared/ui/Card';
import Spinner from '@/shared/ui/Spinner';

interface CurrentLottery {
  id: number;
  timestampBlock: number;
  timestampEnd: number;
  ticketCost: string;
  ticketsAmountTotal: number;
  costTotal: string;
}

/** Seconds → "mm:ss" (or "h:mm:ss" past an hour). Never negative. */
function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

function useNowSeconds(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function LotteryCardInner({ lottery }: { lottery: CurrentLottery }) {
  const now = useNowSeconds();
  const drawn = lottery.timestampEnd - now <= 0; // round is being settled
  const salesClosed = lottery.timestampBlock - now <= 0; // no more buy/refund

  const status: ReactNode = drawn ? (
    <span className="font-mono text-base font-semibold tabular-nums text-muted">
      Розыгрыш…
    </span>
  ) : salesClosed ? (
    <span className="text-sm font-medium text-warn">Продажи закрыты</span>
  ) : (
    <span className="font-mono text-base font-semibold tabular-nums text-ice">
      {formatCountdown(lottery.timestampEnd - now)}
    </span>
  );

  return (
    <Link
      to="/games/lottery"
      className="group relative flex items-center gap-4 overflow-hidden rounded-xl border border-edge bg-panel p-4 transition-colors hover:border-ton/50 hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ton/60"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-ton/10 opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
      />
      <span
        aria-hidden
        className="relative grid size-12 shrink-0 place-items-center rounded-xl border border-edge bg-panel-2 text-2xl"
      >
        {LOTTERY_META.emoji}
      </span>
      <div className="relative min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted">
          <Trophy size={12} strokeWidth={2} />
          Банк лотереи
        </p>
        <p className="mt-0.5 truncate text-xl font-bold tracking-tight">
          <Amount value={lottery.costTotal} />
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {lottery.ticketsAmountTotal}{' '}
          {lottery.ticketsAmountTotal === 1 ? 'билет' : 'билетов'} продано
        </p>
      </div>
      <div className="relative shrink-0 text-right">
        <p className="text-[10px] uppercase tracking-wide text-muted">
          {drawn ? 'Статус' : salesClosed ? 'Розыгрыш' : 'До розыгрыша'}
        </p>
        <p className="mt-0.5">{status}</p>
      </div>
    </Link>
  );
}

/** The full "Лотерея" section: heading + the live round card (or soft fallbacks). */
export default function LotteryStatusCard() {
  const query = useQuery<CurrentLottery>({
    queryKey: ['lottery', 'current'],
    queryFn: () => api.get<CurrentLottery>('/lottery/current'),
    refetchInterval: 15_000,
    retry: false, // a 404 between rounds is expected — the interval picks the next up
  });

  let body: ReactNode;
  if (query.isPending) {
    body = (
      <Card className="flex items-center gap-3 p-4 text-sm text-muted">
        <Spinner size={20} />
        Загружаем лотерею…
      </Card>
    );
  } else if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    body = (
      <Link
        to="/games/lottery"
        className="group flex items-center gap-3 rounded-xl border border-edge bg-panel p-4 transition-colors hover:border-ton/50 hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ton/60"
      >
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-edge bg-panel-2 text-xl"
        >
          {LOTTERY_META.emoji}
        </span>
        <span className="min-w-0 flex-1 text-sm text-muted">
          {notFound
            ? 'Новый раунд лотереи готовится — загляните через мгновение'
            : errorMessage(query.error, 'Не удалось загрузить лотерею')}
        </span>
        <ArrowUpRight
          size={16}
          aria-hidden
          className="shrink-0 text-muted transition-colors group-hover:text-ton"
        />
      </Link>
    );
  } else {
    body = <LotteryCardInner lottery={query.data} />;
  }

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted">
        <Ticket size={14} strokeWidth={2} />
        Лотерея
      </h2>
      {body}
    </section>
  );
}
