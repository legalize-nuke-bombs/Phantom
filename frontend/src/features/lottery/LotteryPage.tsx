// Lottery (route: /games/lottery). One global round runs at a time; everyone buys
// tickets into the same pot, and at draw time a provably-fair "happy ticket" picks
// one winner who takes 95% of the pot.
//
// Backend (com.example.phantom.lottery):
//   • GET  /api/lottery/current
//       → CurrentLotteryRepresentation {
//           id, timestampStart, timestampBlock, timestampEnd,   // epoch SECONDS
//           seed1Hash, seed2Hash,                                // committed hashes
//           ticketCost,                                          // USD decimal string
//           ticketsAmountPersonal, ticketsAmountTotal,           // counts (never null)
//           costPersonal, costTotal,                             // USD decimal strings
//         }
//       404 LOTTERY_NOT_FOUND in the brief window before the scheduler seeds a round.
//       timestampBlock = sales & refunds CLOSE; timestampEnd = the draw fires.
//   • POST /api/lottery/buy-tickets    { amount } → { message }   (>= timestampBlock ⇒ LOTTERY_SALES_CLOSED)
//   • POST /api/lottery/refund-tickets { amount } → { message }   (>= timestampBlock ⇒ LOTTERY_REFUND_CLOSED;
//                                                                   amount > held ⇒ NOT_ENOUGH_TICKETS)
//     Both move the wallet, so refresh the balance after a success.
//   • GET  /api/lottery/history?limit&before
//       → FinishedLotteryRepresentation[] {
//           id, timestamp, seed1, seed2,
//           user,         // ShortUser | null  (no winner, or winner hid their lottery activity)
//           happyTicket,  // number | null
//           prize,        // USD decimal string | null
//           ticketsSold,  // number
//         }

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ArrowLeft,
  History,
  Minus,
  Plus,
  Ticket,
  Trophy,
  Users,
} from 'lucide-react';

import { api, ApiError } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import { levelFor, useExperienceBatch } from '@/shared/lib/experience';
import { LOTTERY_META } from '@/shared/lib/games';
import { formatUsd } from '@/shared/lib/money';
import { formatTime } from '@/shared/lib/time';
import { useRefreshBalance, useWallet } from '@/shared/lib/wallet';
import type { ShortUser } from '@/shared/types';
import Amount from '@/shared/ui/Amount';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import { SUPPRESS_AUTOFILL } from '@/shared/ui/Input';
import Spinner from '@/shared/ui/Spinner';
import UserChip from '@/shared/ui/UserChip';

const HISTORY_LIMIT = 12;
const CURRENT_QUERY_KEY = ['lottery', 'current'] as const;
const HISTORY_QUERY_KEY = ['lottery', 'history'] as const;

/* ── backend DTOs (verified against the *Representation classes) ──────────── */
interface CurrentLottery {
  id: number;
  timestampStart: number;
  timestampBlock: number;
  timestampEnd: number;
  seed1Hash: string;
  seed2Hash: string;
  ticketCost: string;
  ticketsAmountPersonal: number;
  ticketsAmountTotal: number;
  costPersonal: string;
  costTotal: string;
}

interface FinishedLottery {
  id: number;
  timestamp: number;
  seed1: string;
  seed2: string;
  user: ShortUser | null;
  happyTicket: number | null;
  prize: string | null;
  ticketsSold: number;
}

/* ── live clock ──────────────────────────────────────────────────────────
   A single 1s tick shared by the whole page. Returns epoch-seconds "now" so
   every countdown derives from one consistent value. */
function useNowSeconds(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** Seconds → "mm:ss" (or "h:mm:ss" past an hour). Never negative. */
function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/* ── current round ──────────────────────────────────────────────────────── */
function CurrentRound({ lottery }: { lottery: CurrentLottery }) {
  const now = useNowSeconds();
  const qc = useQueryClient();
  const refreshBalance = useRefreshBalance();
  const { data: wallet } = useWallet();

  const [qty, setQty] = useState(1);
  // The raw text in the box, kept SEPARATE from the numeric `qty` so the field can be
  // emptied mid-edit — type 50 straight over the 1 instead of the "150 then delete the 1"
  // dance. `qty` stays the clamped (≥1) source of truth for cost/buy; `qtyText` is display.
  const [qtyText, setQtyText] = useState('1');
  const [actionError, setActionError] = useState<string | null>(null);
  // A server rejection is tied to one round; if the round rotates under us, drop
  // the stale message during render (the recommended alternative to an effect).
  const [errorRoundId, setErrorRoundId] = useState(lottery.id);
  if (errorRoundId !== lottery.id) {
    setErrorRoundId(lottery.id);
    setActionError(null);
  }

  // Changing the desired quantity clears any prior rejection — the next attempt
  // is a fresh one. Clamps to >= 1.
  function changeQty(next: number) {
    const clamped = Math.max(1, Math.floor(next) || 1);
    setQty(clamped);
    setQtyText(String(clamped));
    setActionError(null);
  }

  const ticketCost = Number(lottery.ticketCost);
  const balance = wallet ? Number(wallet.balance) : 0;

  const secondsToDraw = lottery.timestampEnd - now;
  const secondsToClose = lottery.timestampBlock - now;
  const drawn = secondsToDraw <= 0; // round is being settled right now
  const salesClosed = secondsToClose <= 0; // no more buy/refund

  // Pot fill: your tickets vs the whole pot (purely visual).
  const sharePct =
    lottery.ticketsAmountTotal > 0
      ? Math.min(100, (lottery.ticketsAmountPersonal / lottery.ticketsAmountTotal) * 100)
      : 0;

  const orderCost = Number.isFinite(ticketCost) ? ticketCost * qty : 0;
  // Compare in whole cents so binary float error can't block an affordable buy
  // (e.g. 3 × 0.1 = 0.30000000000000004 must not exceed a balance of exactly 0.30).
  const cantAfford = Math.round(orderCost * 100) > Math.round(balance * 100);
  const cantRefund = qty > lottery.ticketsAmountPersonal;

  // While the draw is happening, poll harder so the next round appears promptly.
  useEffect(() => {
    if (!drawn) return;
    const id = window.setInterval(() => {
      qc.invalidateQueries({ queryKey: CURRENT_QUERY_KEY });
      qc.invalidateQueries({ queryKey: HISTORY_QUERY_KEY });
    }, 2000);
    return () => window.clearInterval(id);
  }, [drawn, qc]);

  const buy = useMutation({
    mutationFn: () => api.post<{ message: string }>('/lottery/buy-tickets', { amount: qty }),
    onSuccess: async () => {
      setActionError(null);
      await refreshBalance();
      qc.invalidateQueries({ queryKey: CURRENT_QUERY_KEY });
    },
    onError: (err) => setActionError(errorMessage(err, 'Не удалось купить билеты')),
  });

  const refund = useMutation({
    mutationFn: () => api.post<{ message: string }>('/lottery/refund-tickets', { amount: qty }),
    onSuccess: async () => {
      setActionError(null);
      await refreshBalance();
      qc.invalidateQueries({ queryKey: CURRENT_QUERY_KEY });
    },
    onError: (err) => setActionError(errorMessage(err, 'Не удалось вернуть билеты')),
  });

  const pending = buy.isPending || refund.isPending;
  const controlsDisabled = salesClosed || drawn || pending;

  const countdown = drawn
    ? 'Розыгрыш…'
    : formatCountdown(secondsToDraw);

  return (
    <Card className="overflow-hidden">
      {/* Pot + countdown header */}
      <div className="relative border-b border-edge bg-panel-2/40 px-5 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted">
              <Trophy size={13} strokeWidth={2} />
              Банк раунда
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              <Amount value={lottery.costTotal} />
            </p>
            <p className="mt-1 text-xs text-muted">
              Билет {formatUsd(lottery.ticketCost)} · {lottery.ticketsAmountTotal}{' '}
              {lottery.ticketsAmountTotal === 1 ? 'билет' : 'билетов'} продано
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted">
              {drawn ? 'Статус' : salesClosed ? 'Розыгрыш через' : 'До закрытия продаж'}
            </p>
            <p
              className={
                'mt-1 font-mono text-2xl font-semibold tabular-nums sm:text-3xl ' +
                (salesClosed && !drawn ? 'text-warn' : drawn ? 'text-muted' : 'text-ice')
              }
            >
              {countdown}
            </p>
            {!drawn && !salesClosed && (
              <p className="mt-1 text-xs text-muted">
                розыгрыш в {formatTime(lottery.timestampEnd, 'time')}
              </p>
            )}
            {!drawn && salesClosed && (
              <p className="mt-1 text-xs text-warn">продажи закрыты</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {/* Your tickets vs pot */}
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted">
              <Ticket size={14} strokeWidth={2} />
              Ваши билеты
            </span>
            <span className="text-fg">
              <span className="font-semibold text-ton">{lottery.ticketsAmountPersonal}</span>
              <span className="text-muted"> / {lottery.ticketsAmountTotal}</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-panel-2 border border-edge">
            <div
              className="h-full rounded-full bg-ton transition-all duration-500"
              style={{ width: `${sharePct}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {lottery.ticketsAmountPersonal > 0 ? (
              <>
                Ваш вклад <Amount value={lottery.costPersonal} /> · шанс выигрыша{' '}
                <span className="text-fg">{sharePct.toFixed(1)}%</span>
              </>
            ) : (
              'Купите билеты, чтобы участвовать в розыгрыше'
            )}
          </p>
        </div>

        {/* Quantity control */}
        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted">Количество билетов</span>
          <div className="flex items-stretch gap-2">
            <div className="flex flex-1 items-center justify-between rounded-xl bg-panel-2 border border-edge px-2">
              <button
                type="button"
                aria-label="Меньше"
                onClick={() => changeQty(qty - 1)}
                disabled={controlsDisabled || qty <= 1}
                className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus size={16} />
              </button>
              <input
                inputMode="numeric"
                aria-label="Количество билетов"
                value={qtyText}
                onChange={(e) => {
                  // The box follows the field as typed (empty / "0" allowed); qty trails it
                  // HONESTLY — 0 stays 0, never silently bumped to 1. Buying is disabled below
                  // when qty < 1, so an empty/zero box can't charge for a phantom ticket.
                  const digits = e.target.value.replace(/\D/g, '');
                  setQtyText(digits);
                  setActionError(null);
                  setQty(digits === '' ? 0 : Number(digits));
                }}
                // Leaving the field normalises a blank/zero back to the minimum 1, so the
                // selector never sits empty — but only on blur, never mid-typing.
                onBlur={() => {
                  if (qty < 1) {
                    setQty(1);
                    setQtyText('1');
                  }
                }}
                disabled={controlsDisabled}
                autoComplete="off"
                {...SUPPRESS_AUTOFILL}
                className="min-w-0 flex-1 bg-transparent text-center text-lg font-semibold text-fg focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                aria-label="Больше"
                onClick={() => changeQty(qty + 1)}
                disabled={controlsDisabled}
                className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="text-xs">
            <span className="text-muted">
              Стоимость:{' '}
              <span className={cantAfford && !controlsDisabled ? 'text-lose' : 'text-fg'}>
                {formatUsd(orderCost)}
              </span>
            </span>
          </div>
        </div>

        {actionError && <p className="text-sm text-lose">{actionError}</p>}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            onClick={() => buy.mutate()}
            loading={buy.isPending}
            disabled={controlsDisabled || cantAfford || qty < 1}
          >
            <Ticket size={16} strokeWidth={2} />
            Купить
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => refund.mutate()}
            loading={refund.isPending}
            disabled={controlsDisabled || cantRefund || qty < 1}
          >
            <Minus size={16} strokeWidth={2} />
            Вернуть
          </Button>
        </div>

        {salesClosed && !drawn && (
          <p className="text-center text-xs text-muted">
            Билеты можно купить или вернуть только до закрытия продаж
          </p>
        )}
      </div>
    </Card>
  );
}

/* ── history ────────────────────────────────────────────────────────────── */
function HistoryRow({
  round,
  level,
}: {
  round: FinishedLottery;
  level: ReturnType<typeof levelFor>;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-edge bg-panel-2 text-base"
        >
          {LOTTERY_META.emoji}
        </span>
        <div className="min-w-0">
          {round.user ? (
            <UserChip user={round.user} level={level} size={22} />
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <Users size={14} strokeWidth={2} />
              Победитель скрыт
            </span>
          )}
          <p className="mt-0.5 text-xs text-muted">
            {formatTime(round.timestamp, 'relative')} · {round.ticketsSold}{' '}
            {round.ticketsSold === 1 ? 'билет' : 'билетов'}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold">
          <Amount value={round.prize} />
        </p>
        <p className="text-[11px] text-muted">приз</p>
      </div>
    </li>
  );
}

function HistorySection() {
  const query = useQuery<FinishedLottery[]>({
    queryKey: HISTORY_QUERY_KEY,
    queryFn: () => api.get<FinishedLottery[]>(`/lottery/history?limit=${HISTORY_LIMIT}`),
  });

  const rounds = useMemo(() => query.data ?? [], [query.data]);

  // ONE batch request for every winner's level (hidden/absent winners are skipped).
  const ids = useMemo(
    () => rounds.map((r) => r.user?.id).filter((id): id is number => id != null),
    [rounds],
  );
  const levels = useExperienceBatch(ids);

  let body: ReactNode;
  if (query.isLoading) {
    body = (
      <div className="flex justify-center py-2">
        <Spinner size={20} />
      </div>
    );
  } else if (query.isError) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-lose">
          {errorMessage(query.error, 'Не удалось загрузить историю')}
        </p>
        <Button type="button" variant="ghost" onClick={() => query.refetch()}>
          Повторить
        </Button>
      </div>
    );
  } else if (rounds.length === 0) {
    body = (
      <p className="py-1 text-sm text-muted">Розыгрышей пока не было</p>
    );
  } else {
    body = (
      <ul className="divide-y divide-edge">
        {rounds.map((round) => (
          <HistoryRow
            key={round.id}
            round={round}
            level={round.user ? levelFor(levels.data, round.user.id) : null}
          />
        ))}
      </ul>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-muted">
        <History size={16} strokeWidth={2} />
        <h2 className="text-sm font-medium">Прошлые розыгрыши</h2>
      </div>
      {body}
    </Card>
  );
}

/* ── page ───────────────────────────────────────────────────────────────── */
function CurrentSection() {
  const query = useQuery<CurrentLottery>({
    queryKey: CURRENT_QUERY_KEY,
    queryFn: () => api.get<CurrentLottery>('/lottery/current'),
    // Keep the pot/ticket counts reasonably fresh as other players join.
    refetchInterval: 8000,
  });

  // 404 = no active round mid-rotation; the scheduler seeds the next one within a
  // second, so invite a retry rather than treating it as a hard error.
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <span aria-hidden className="text-3xl">
          {LOTTERY_META.emoji}
        </span>
        <p className="text-sm text-muted">
          {notFound
            ? 'Раунд готовится, загляните через мгновение'
            : errorMessage(query.error, 'Не удалось загрузить раунд')}
        </p>
        <Button type="button" variant="ghost" onClick={() => query.refetch()}>
          Обновить
        </Button>
      </Card>
    );
  }

  if (query.isPending || !query.data) {
    return (
      <Card className="flex justify-center p-10">
        <Spinner size={28} />
      </Card>
    );
  }

  return <CurrentRound lottery={query.data} />;
}

export default function LotteryPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div>
        <Link
          to="/games"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          К играм
        </Link>
        <div className="mt-3 flex items-center gap-2 text-fg">
          <span aria-hidden className="text-xl leading-none">
            {LOTTERY_META.emoji}
          </span>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {LOTTERY_META.name}
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted">
          Купите билеты в общий банк — победитель забирает 95% призового фонда
        </p>
      </div>

      <CurrentSection />
      <HistorySection />
    </div>
  );
}
