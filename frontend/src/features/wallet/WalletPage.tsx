// Wallet + Gifts (route: /wallet). Four sections behind a tab bar:
//
//   • Баланс    — the plain USD balance (the ONE place money is shown uncoloured).
//   • Пополнение — the on-chain deposit address for GRAM (CoinType TON), shown with a
//                  locally-generated QR code (qrcode lib — the address never leaves the
//                  device) + copy + a "Проверить депозиты" action that scans the chain
//                  and refreshes the balance.
//   • Вывод      — { address, amount } → withdraw, then refresh; shows the resulting
//                  withdrawal status. Also a prominent "Проверить статус выводов" action
//                  that re-checks pending withdrawals server-side, refunds any that
//                  failed, refreshes the balance and summarises the outcome.
//   • Подарки    — send a present (gated by SEND_PRESENT) and the inbox of received
//                  presents with per-item claim + claim-all.
//
// Backend (verified against source, NOT ENDPOINTS.md):
//   GET  /api/wallets/me                        → Wallet { id, balance }            (useWallet)
//   GET  /api/wallets/me/crypto/{coin}          → { coin, address }
//   POST /api/wallets/me/crypto/{coin}/check-deposits → DepositRepresentation[]
//   POST /api/wallets/me/crypto/{coin}/withdraw → WithdrawalRepresentation
//   POST /api/wallets/me/crypto/check-pending-withdrawals → WithdrawalRepresentation[]
//   GET  /api/presents?claimed&limit&before     → PresentRepresentation[]
//   GET  /api/presents/count?claimed            → { result }
//   POST /api/presents/send  { receiverId, amount, anonymous, description? } → 200
//   POST /api/presents/claim { presentId }      → PresentRepresentation
//   POST /api/presents/claim-all                → { result } (sum claimed)
//
// Balances/amounts are internal USD; the deposit coin is Gram/GRAM (coin enum TON).

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  CheckCheck,
  Copy,
  Gift,
  Hourglass,
  RefreshCw,
  Send,
  ShieldCheck,
  Wallet as WalletIcon,
} from 'lucide-react';
import QRCode from 'qrcode';

import { api, ApiError } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { coinName, coinTicker } from '@/shared/lib/coin';
import type { CoinType } from '@/shared/lib/coin';
import { levelFor, useExperienceBatch } from '@/shared/lib/experience';
import { FeatureLock, useFeatureGate } from '@/shared/lib/levelFeatures';
import { formatUsd } from '@/shared/lib/money';
import { formatTime } from '@/shared/lib/time';
import { useRefreshBalance, useWallet } from '@/shared/lib/wallet';
import { markBucketRead, markPresentRead, useUnreadCount } from '@/shared/realtime/badges';
import type { LevelName, ShortUser, User } from '@/shared/types';
import Amount from '@/shared/ui/Amount';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import Input, { SUPPRESS_AUTOFILL } from '@/shared/ui/Input';
import Spinner from '@/shared/ui/Spinner';
import Switch from '@/shared/ui/Switch';
import UserChip from '@/shared/ui/UserChip';
import UserLookup from '@/shared/ui/UserLookup';

/* ── DTOs (verified against backend *Representation classes) ──────────────── */

type TransferStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

interface CryptoWallet {
  coin: CoinType;
  address: string;
}

interface Deposit {
  id: number;
  coin: CoinType;
  timestamp: number;
  txHash: string;
  amount: string;
}

interface Withdrawal {
  id: number;
  user: ShortUser;
  coin: CoinType;
  timestamp: number;
  receiver: string;
  amount: string;
  status: TransferStatus;
  hash: string | null;
}

interface Present {
  id: number;
  claimed: boolean;
  timestamp: number;
  amount: string;
  description: string;
  /** null when the sender chose to send anonymously. */
  sender: ShortUser | null;
}

/** The only coin today; the rail is GRAM, the backend enum value is TON. */
const COIN: CoinType = 'TON';

const PRESENTS_QUERY_KEY = ['presents', 'received'] as const;
const PRESENTS_PAGE_SIZE = 100;

/* ── clipboard ─────────────────────────────────────────────────────────────
 * Small reusable copy hook with a transient "copied" flag, mirroring the
 * pattern already used on the referral page. Falls back to execCommand on the
 * (rare) browser without the async clipboard API.
 */
function useCopy(): { copied: boolean; copy: (text: string) => void } {
  const [copied, setCopied] = useState(false);
  function copy(text: string) {
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    };
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => setCopied(false));
        return;
      }
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch {
      setCopied(false);
    }
  }
  return { copied, copy };
}

/* ── tabs ──────────────────────────────────────────────────────────────────*/

type TabId = 'balance' | 'deposit' | 'withdraw' | 'presents';

interface TabDef {
  id: TabId;
  label: string;
  icon: typeof WalletIcon;
}

const TABS: readonly TabDef[] = [
  { id: 'balance', label: 'Баланс', icon: WalletIcon },
  { id: 'deposit', label: 'Пополнение', icon: ArrowDownToLine },
  { id: 'withdraw', label: 'Вывод', icon: ArrowUpFromLine },
  { id: 'presents', label: 'Подарки', icon: Gift },
];

function TabBar({
  active,
  onChange,
  giftCount,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
  giftCount: number;
}) {
  return (
    <div
      role="tablist"
      aria-label="Разделы кошелька"
      className="grid grid-cols-4 gap-1 rounded-xl border border-edge bg-panel p-1"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const selected = tab.id === active;
        const badge = tab.id === 'presents' ? giftCount : 0;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={[
              'relative flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-xs font-medium transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ton',
              selected ? 'bg-ton-deep text-white' : 'text-muted hover:bg-panel-2 hover:text-fg',
            ].join(' ')}
          >
            {badge > 0 && (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-ton-deep px-1 text-[10px] font-bold leading-none text-white ring-2 ring-panel">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
            <Icon size={18} strokeWidth={2} />
            <span className="leading-none">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Section: Баланс ─────────────────────────────────────────────────────────
 * The single place in the app that renders a balance PLAIN — no tier colour.
 */
function BalanceSection() {
  const wallet = useWallet();
  const refreshBalance = useRefreshBalance();

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-muted">
        <WalletIcon size={16} strokeWidth={2} />
        <h2 className="text-sm font-medium">Текущий баланс</h2>
      </div>

      {wallet.isLoading ? (
        <div className="flex justify-center py-3">
          <Spinner size={22} />
        </div>
      ) : wallet.isError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-lose">
            {errorMessage(wallet.error, 'Не удалось загрузить баланс')}
          </p>
          <Button type="button" variant="ghost" onClick={() => wallet.refetch()}>
            Повторить
          </Button>
        </div>
      ) : (
        <>
          <p className="text-3xl font-semibold tracking-tight text-fg tabular-nums sm:text-4xl">
            {formatUsd(wallet.data?.balance)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Баланс хранится в долларах. Пополняйте и выводите средства в {coinName()} (
            {coinTicker()}).
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-4"
            loading={wallet.isFetching}
            onClick={() => refreshBalance()}
          >
            <RefreshCw size={14} strokeWidth={2} />
            Обновить
          </Button>
        </>
      )}
    </Card>
  );
}

/* ── Deposit QR ───────────────────────────────────────────────────────────────
 * The QR is generated entirely on-device with the `qrcode` lib — the address is
 * never sent to any image/QR service. Rendered dark-on-white (the most reliable
 * combination for a phone camera) on a small white tile that pops on the near-
 * black page. Cached per address via TanStack Query so re-renders are free.
 */
function DepositQr({ address }: { address: string }) {
  const qr = useQuery<string>({
    queryKey: ['crypto', 'qr', address],
    queryFn: () =>
      QRCode.toDataURL(address, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 320,
        color: { dark: '#05080eff', light: '#ffffffff' },
      }),
    staleTime: Infinity,
  });

  return (
    <div className="mb-4 flex flex-col items-center">
      <div className="grid size-44 place-items-center rounded-2xl border border-edge bg-white p-3">
        {qr.isSuccess ? (
          <img
            src={qr.data}
            alt={`QR-код адреса ${coinName()}`}
            className="size-full"
            draggable={false}
          />
        ) : qr.isError ? (
          <span className="px-2 text-center text-xs text-ink">
            Не удалось показать QR-код
          </span>
        ) : (
          <Spinner size={22} />
        )}
      </div>
      <p className="mt-2 text-center text-xs text-muted">
        Отсканируйте код в кошельке {coinName()}
      </p>
    </div>
  );
}

/* ── Section: Пополнение ─────────────────────────────────────────────────────*/
function DepositSection() {
  const refreshBalance = useRefreshBalance();
  const qc = useQueryClient();
  const { copied, copy } = useCopy();

  const walletQuery = useQuery<CryptoWallet>({
    queryKey: ['crypto', 'wallet', COIN],
    queryFn: () => api.get<CryptoWallet>(`/wallets/me/crypto/${COIN}`),
    staleTime: Infinity, // the deposit address is stable per user
  });

  const check = useMutation<Deposit[]>({
    mutationFn: () => api.post<Deposit[]>(`/wallets/me/crypto/${COIN}/check-deposits`),
    onSuccess: async () => {
      await refreshBalance();
      qc.invalidateQueries({ queryKey: ['crypto', 'deposits', COIN] });
    },
  });

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-muted">
        <ArrowDownToLine size={16} strokeWidth={2} />
        <h2 className="text-sm font-medium">Пополнение {coinTicker()}</h2>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-muted">
        Отправьте {coinName()} на адрес ниже, затем нажмите «Проверить депозиты» —
        средства зачислятся на баланс.
      </p>

      {walletQuery.isLoading ? (
        <div className="flex justify-center py-3">
          <Spinner size={22} />
        </div>
      ) : walletQuery.isError || !walletQuery.data ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-lose">
            {errorMessage(walletQuery.error, 'Не удалось получить адрес')}
          </p>
          <Button type="button" variant="ghost" onClick={() => walletQuery.refetch()}>
            Повторить
          </Button>
        </div>
      ) : (
        <>
          <DepositQr address={walletQuery.data.address} />

          <label className="mb-1.5 block text-sm text-muted">Адрес {coinName()}</label>
          <div className="flex items-stretch gap-2">
            <code className="min-w-0 flex-1 break-all rounded-xl border border-edge bg-panel-2 px-3 py-2.5 font-mono text-sm text-fg">
              {walletQuery.data.address}
            </code>
            <Button
              type="button"
              variant="ghost"
              onClick={() => copy(walletQuery.data!.address)}
              aria-label="Скопировать адрес"
              className="shrink-0 px-3"
            >
              {copied ? <Check size={16} className="text-win" /> : <Copy size={16} />}
              <span className="hidden sm:inline">{copied ? 'Скопировано' : 'Копировать'}</span>
            </Button>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => check.mutate()}
              loading={check.isPending}
              className="self-start"
            >
              <RefreshCw size={16} strokeWidth={2} />
              Проверить депозиты
            </Button>

            {check.isError && (
              <p className="text-sm text-lose">
                {errorMessage(check.error, 'Не удалось проверить депозиты')}
              </p>
            )}
            {check.isSuccess && <DepositResult deposits={check.data} />}
          </div>
        </>
      )}

      <DepositHistory />
    </Card>
  );
}

function DepositResult({ deposits }: { deposits: Deposit[] }) {
  if (deposits.length === 0) {
    return <p className="text-sm text-muted">Новых депозитов не найдено.</p>;
  }
  return (
    <div className="rounded-xl border border-edge bg-panel-2 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-win">
        <CheckCheck size={15} strokeWidth={2} />
        Зачислено депозитов: {deposits.length}
      </p>
      <ul className="divide-y divide-edge">
        {deposits.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0 truncate font-mono text-xs text-muted">{d.txHash}</span>
            <Amount value={d.amount} className="shrink-0 text-sm font-medium" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Persistent deposit history (GET /{coin}/deposits), cursor-paginated by id. */
function DepositHistory() {
  const deposits = useInfiniteQuery({
    queryKey: ['crypto', 'deposits', COIN],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '100' });
      if (pageParam !== undefined) params.set('before', String(pageParam));
      return api.get<Deposit[]>(`/wallets/me/crypto/${COIN}/deposits?${params}`);
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.length < 20 ? undefined : last[last.length - 1].id),
  });

  const items = deposits.data?.pages.flat() ?? [];

  return (
    <div className="mt-6 border-t border-edge pt-5">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
        История пополнений
      </h3>
      {deposits.isLoading ? (
        <div className="flex justify-center py-2">
          <Spinner size={20} />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">Пополнений пока нет.</p>
      ) : (
        <ul className="divide-y divide-edge rounded-xl border border-edge bg-panel-2">
          {items.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <Amount value={d.amount} className="text-sm font-medium" />
                <p className="truncate font-mono text-[11px] text-muted">{d.txHash}</p>
              </div>
              <span className="shrink-0 text-xs text-muted">
                {formatTime(d.timestamp, 'short')}
              </span>
            </li>
          ))}
        </ul>
      )}
      {deposits.hasNextPage ? (
        <div className="mt-2 flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={deposits.isFetchingNextPage}
            onClick={() => deposits.fetchNextPage()}
          >
            Показать ещё
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ── Section: Вывод ───────────────────────────────────────────────────────── */
function WithdrawSection() {
  const refreshBalance = useRefreshBalance();
  const qc = useQueryClient();
  const wallet = useWallet();

  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');

  const withdraw = useMutation<Withdrawal, ApiError>({
    mutationFn: () =>
      api.post<Withdrawal>(`/wallets/me/crypto/${COIN}/withdraw`, {
        address: address.trim(),
        amount,
      }),
    onSuccess: async () => {
      await refreshBalance();
      qc.invalidateQueries({ queryKey: ['crypto', 'withdrawals', COIN] });
      setAddress('');
      setAmount('');
    },
  });

  // Re-checks every pending withdrawal server-side and refunds any that failed,
  // so we refresh the balance on success. Returns the set that was pending (now
  // with up-to-date statuses) which we summarise below.
  const checkPending = useMutation<Withdrawal[], ApiError>({
    mutationFn: () =>
      api.post<Withdrawal[]>(`/wallets/me/crypto/${COIN}/check-pending-withdrawals`),
    onSuccess: async () => {
      await refreshBalance();
      qc.invalidateQueries({ queryKey: ['crypto', 'withdrawals', COIN] });
    },
  });

  const numericAmount = Number(amount);
  const amountValid = amount.trim() !== '' && Number.isFinite(numericAmount) && numericAmount > 0;
  const canSubmit = address.trim() !== '' && amountValid && !withdraw.isPending;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    withdraw.mutate();
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-muted">
        <ArrowUpFromLine size={16} strokeWidth={2} />
        <h2 className="text-sm font-medium">Вывод {coinTicker()}</h2>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-muted">
        Доступно к выводу:{' '}
        <span className="font-medium text-fg">{formatUsd(wallet.data?.balance)}</span>
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          label={`Адрес ${coinName()}`}
          placeholder="EQ…"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          autoComplete="off"
          {...SUPPRESS_AUTOFILL}
          spellCheck={false}
          disabled={withdraw.isPending}
        />
        <Input
          label="Сумма (USD)"
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoComplete="off"
          {...SUPPRESS_AUTOFILL}
          disabled={withdraw.isPending}
        />

        {withdraw.isError && (
          <p className="text-sm text-lose">
            {errorMessage(withdraw.error, 'Не удалось создать вывод')}
          </p>
        )}
        {withdraw.isSuccess && <WithdrawResult withdrawal={withdraw.data} />}

        <Button type="submit" loading={withdraw.isPending} disabled={!canSubmit} className="self-start">
          <ArrowUpFromLine size={16} strokeWidth={2} />
          Вывести
        </Button>
      </form>

      <div className="mt-6 rounded-xl border border-edge bg-panel-2 p-4">
        <div className="mb-1.5 flex items-center gap-2 text-fg">
          <ShieldCheck size={16} strokeWidth={2} className="text-ton" />
          <h3 className="text-sm font-medium">Статус выводов</h3>
        </div>
        <p className="mb-3 text-sm leading-relaxed text-muted">
          Проверьте выводы в обработке. Если перевод не прошёл, сумма вернётся на
          баланс автоматически.
        </p>

        <Button
          type="button"
          onClick={() => checkPending.mutate()}
          loading={checkPending.isPending}
          className="self-start"
        >
          <RefreshCw size={16} strokeWidth={2} />
          Проверить статус выводов
        </Button>

        {checkPending.isError && (
          <p className="mt-3 text-sm text-lose">
            {errorMessage(checkPending.error, 'Не удалось проверить выводы')}
          </p>
        )}
        {checkPending.isSuccess && (
          <div className="mt-3">
            <CheckPendingResult withdrawals={checkPending.data} />
          </div>
        )}
      </div>

      <WithdrawHistory />
    </Card>
  );
}

/* Persistent withdrawal history (GET /{coin}/withdrawals), cursor-paginated by id. */
function WithdrawHistory() {
  const withdrawals = useInfiniteQuery({
    queryKey: ['crypto', 'withdrawals', COIN],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '100' });
      if (pageParam !== undefined) params.set('before', String(pageParam));
      return api.get<Withdrawal[]>(`/wallets/me/crypto/${COIN}/withdrawals?${params}`);
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.length < 20 ? undefined : last[last.length - 1].id),
  });

  const items = withdrawals.data?.pages.flat() ?? [];

  return (
    <div className="mt-6 border-t border-edge pt-5">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
        История выводов
      </h3>
      {withdrawals.isLoading ? (
        <div className="flex justify-center py-2">
          <Spinner size={20} />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">Выводов пока нет.</p>
      ) : (
        <ul className="divide-y divide-edge rounded-xl border border-edge bg-panel-2">
          {items.map((w) => {
            const status = WITHDRAW_STATUS[w.status];
            return (
              <li key={w.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Amount value={w.amount} className="text-sm font-medium" />
                    <span className={`text-[11px] font-medium ${status?.tone ?? 'text-muted'}`}>
                      {status?.label ?? w.status}
                    </span>
                  </div>
                  <p className="truncate font-mono text-[11px] text-muted">{w.receiver}</p>
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {formatTime(w.timestamp, 'short')}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {withdrawals.hasNextPage ? (
        <div className="mt-2 flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={withdrawals.isFetchingNextPage}
            onClick={() => withdrawals.fetchNextPage()}
          >
            Показать ещё
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* Summary of a check-pending-withdrawals run. The returned list is exactly the
 * set that was PENDING, now carrying fresh statuses: REJECTED ones have just been
 * refunded to the balance, CONFIRMED ones went through, the rest are still on the
 * way. Framed as good/neutral news — never an alarm. */
function CheckPendingResult({ withdrawals }: { withdrawals: Withdrawal[] }) {
  if (withdrawals.length === 0) {
    return <p className="text-sm text-muted">Выводов в обработке нет.</p>;
  }

  const refunded = withdrawals.filter((w) => w.status === 'REJECTED');
  const confirmed = withdrawals.filter((w) => w.status === 'CONFIRMED').length;
  const stillPending = withdrawals.filter((w) => w.status === 'PENDING').length;

  const refundedTotal = refunded.reduce((sum, w) => sum + Number(w.amount), 0);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-edge bg-panel p-3 text-sm">
      {refunded.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-win">
            <CheckCheck size={15} strokeWidth={2} />
            Возвращено на баланс
          </span>
          <Amount value={refundedTotal} className="shrink-0 font-medium" />
        </div>
      )}
      {confirmed > 0 && (
        <div className="flex items-center gap-1.5 text-win">
          <Check size={15} strokeWidth={2} />
          Подтверждено выводов: {confirmed}
        </div>
      )}
      {stillPending > 0 && (
        <div className="flex items-center gap-1.5 text-warn">
          <Hourglass size={15} strokeWidth={2} />
          Ещё в обработке: {stillPending}
        </div>
      )}
    </div>
  );
}

const WITHDRAW_STATUS: Record<TransferStatus, { label: string; tone: string }> = {
  PENDING: { label: 'В обработке', tone: 'text-warn' },
  CONFIRMED: { label: 'Подтверждён', tone: 'text-win' },
  REJECTED: { label: 'Отклонён', tone: 'text-lose' },
};

function WithdrawResult({ withdrawal }: { withdrawal: Withdrawal }) {
  const status = WITHDRAW_STATUS[withdrawal.status];
  return (
    <div className="rounded-xl border border-edge bg-panel-2 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted">Заявка на вывод создана</span>
        <span className={`shrink-0 font-medium ${status?.tone ?? 'text-fg'}`}>
          {status?.label ?? withdrawal.status}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-muted">Сумма</span>
        <Amount value={withdrawal.amount} className="shrink-0 font-medium" />
      </div>
      {withdrawal.hash && (
        <p className="mt-2 min-w-0 break-all font-mono text-xs text-muted">{withdrawal.hash}</p>
      )}
    </div>
  );
}

/* ── Section: Подарки ──────────────────────────────────────────────────────── */
function PresentsSection() {
  return (
    <div className="flex flex-col gap-5">
      <SendPresentCard />
      <ReceivedPresentsCard />
    </div>
  );
}

/* send — gated by SEND_PRESENT */
function SendPresentCard() {
  const { user } = useAuth();
  const refreshBalance = useRefreshBalance();
  const qc = useQueryClient();
  const gate = useFeatureGate('SEND_PRESENT');

  const [receiverInput, setReceiverInput] = useState('');
  const [receiver, setReceiver] = useState<User | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  const send = useMutation<void, ApiError>({
    mutationFn: () =>
      api.post<void>('/presents/send', {
        receiverId: receiver?.id,
        amount,
        anonymous,
        description: description.trim() || undefined,
      }),
    onSuccess: async () => {
      await refreshBalance();
      // The receiver's inbox is theirs, not ours — nothing local to invalidate,
      // but clear the form for the next gift.
      setReceiverInput('');
      setReceiver(null);
      setAmount('');
      setDescription('');
      setAnonymous(false);
      qc.invalidateQueries({ queryKey: ['presents'] });
    },
  });

  const numericAmount = Number(amount);
  const amountValid = amount.trim() !== '' && Number.isFinite(numericAmount) && numericAmount >= 1;
  const canSubmit = !gate.locked && receiver != null && amountValid && !send.isPending;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    send.mutate();
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-muted">
        <Send size={16} strokeWidth={2} />
        <h2 className="text-sm font-medium">Отправить подарок</h2>
      </div>

      {gate.locked ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted">
            Отправка подарков откроется по мере роста вашего ранга.
          </p>
          <FeatureLock feature="SEND_PRESENT" />
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <UserLookup
            value={receiverInput}
            onChange={setReceiverInput}
            onResolve={setReceiver}
            excludeId={user?.id}
            excludeMessage="Нельзя отправить подарок себе"
            label="Получатель"
            placeholder="ID или @username"
            disabled={send.isPending}
          />

          <Input
            label="Сумма (USD)"
            type="number"
            inputMode="decimal"
            min="1"
            step="any"
            placeholder="1.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoComplete="off"
            {...SUPPRESS_AUTOFILL}
            disabled={send.isPending}
          />

          <Input
            label="Сообщение (необязательно)"
            placeholder="С наилучшими пожеланиями"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            autoComplete="off"
            {...SUPPRESS_AUTOFILL}
            disabled={send.isPending}
          />

          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-fg">Анонимно</span>
            <Switch
              checked={anonymous}
              onChange={() => setAnonymous((v) => !v)}
              disabled={send.isPending}
              aria-label="Отправить анонимно"
            />
          </label>

          {send.isError && (
            <p className="text-sm text-lose">
              {errorMessage(send.error, 'Не удалось отправить подарок')}
            </p>
          )}
          {send.isSuccess && (
            <p className="flex items-center gap-1.5 text-sm text-win">
              <Check size={15} strokeWidth={2} />
              Подарок отправлен!
            </p>
          )}

          <Button type="submit" loading={send.isPending} disabled={!canSubmit} className="self-start">
            <Gift size={16} strokeWidth={2} />
            Подарить
          </Button>
        </form>
      )}
    </Card>
  );
}

/* received — list + per-item claim + claim-all */
function ReceivedPresentsCard() {
  const refreshBalance = useRefreshBalance();
  const qc = useQueryClient();

  // Received gifts, newest first, cursor-paginated by present id
  // (GET /api/presents?limit&before). A short page means there are no more.
  const presents = useInfiniteQuery({
    queryKey: PRESENTS_QUERY_KEY,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PRESENTS_PAGE_SIZE) });
      if (pageParam !== undefined) params.set('before', String(pageParam));
      return api.get<Present[]>(`/presents?${params}`);
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) =>
      last.length < PRESENTS_PAGE_SIZE ? undefined : last[last.length - 1].id,
  });

  async function afterClaim() {
    await refreshBalance();
    qc.invalidateQueries({ queryKey: PRESENTS_QUERY_KEY });
  }

  // Order matters: retire the notification (mark read) BEFORE claiming. The
  // notification is a disposable signal; the claim is the truth. If mark-read ran
  // after a successful claim and then failed, the unread notification would survive
  // and resurrect on the next resync drain — a phantom badge for an already-claimed
  // gift that can never be cleared (re-claiming fails). Mark-read-first means a failed
  // claim only leaves the gift unclaimed in the list, fully recoverable.
  const claimOne = useMutation<Present, ApiError, number>({
    mutationFn: async (presentId) => {
      await markPresentRead(presentId);
      return api.post<Present>('/presents/claim', { presentId });
    },
    onSuccess: afterClaim,
  });

  const claimAll = useMutation<{ result: string }, ApiError>({
    mutationFn: async () => {
      await markBucketRead('gift');
      return api.post<{ result: string }>('/presents/claim-all');
    },
    onSuccess: afterClaim,
  });

  const items = presents.data?.pages.flat() ?? [];
  // Batch-load sender ranks so each gift shows the real level, not a ◇ placeholder.
  const senderIds = items
    .map((p) => p.sender?.id)
    .filter((id): id is number => id != null);
  const { data: senderLevels } = useExperienceBatch(senderIds);
  const hasUnclaimed = items.some((p) => !p.claimed);

  // Desync regulator: nothing left to claim → any lingering gift notifications are stale,
  // so mark them read; the badge can't get stuck above the real unclaimed count.
  useEffect(() => {
    if (presents.isSuccess && !hasUnclaimed) void markBucketRead('gift');
  }, [presents.isSuccess, hasUnclaimed]);

  let body: ReactNode;
  if (presents.isLoading) {
    body = (
      <div className="flex justify-center py-3">
        <Spinner size={22} />
      </div>
    );
  } else if (presents.isError) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-lose">
          {errorMessage(presents.error, 'Не удалось загрузить подарки')}
        </p>
        <Button type="button" variant="ghost" onClick={() => presents.refetch()}>
          Повторить
        </Button>
      </div>
    );
  } else if (items.length === 0) {
    body = (
      <div className="flex items-center gap-2 py-1 text-sm text-muted">
        <Gift size={15} strokeWidth={2} />
        Пока нет подарков
      </div>
    );
  } else {
    body = (
      <>
        {claimAll.isError && (
          <p className="mb-3 text-sm text-lose">
            {errorMessage(claimAll.error, 'Не удалось забрать все')}
          </p>
        )}
        <ul className="divide-y divide-edge">
          {items.map((present) => (
            <PresentRow
              key={present.id}
              present={present}
              level={present.sender ? levelFor(senderLevels, present.sender.id) : null}
              onClaim={() => claimOne.mutate(present.id)}
              claiming={claimOne.isPending && claimOne.variables === present.id}
              disabled={claimOne.isPending || claimAll.isPending}
            />
          ))}
        </ul>
        {presents.hasNextPage ? (
          <div className="mt-4 flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={presents.isFetchingNextPage}
              onClick={() => presents.fetchNextPage()}
            >
              Показать ещё
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted">
          <Gift size={16} strokeWidth={2} />
          <h2 className="text-sm font-medium">Подарки</h2>
        </div>
        {hasUnclaimed && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => claimAll.mutate()}
            loading={claimAll.isPending}
            disabled={claimOne.isPending}
          >
            <CheckCheck size={14} strokeWidth={2} />
            Забрать всё
          </Button>
        )}
      </div>
      {body}
    </Card>
  );
}

function PresentRow({
  present,
  level,
  onClaim,
  claiming,
  disabled,
}: {
  present: Present;
  level: LevelName | null;
  onClaim: () => void;
  claiming: boolean;
  disabled: boolean;
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-xl border border-edge bg-panel-2 text-ton"
      >
        <Gift size={18} strokeWidth={2} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Amount value={present.amount} className="text-sm font-semibold" />
          <span className="text-xs text-muted">·</span>
          {present.sender ? (
            <UserChip user={present.sender} level={level} size={20} className="text-xs" />
          ) : (
            <span className="text-xs text-muted">Аноним</span>
          )}
        </div>
        {present.description ? (
          <p className="mt-0.5 truncate text-xs text-muted">{present.description}</p>
        ) : (
          <p className="mt-0.5 text-xs text-muted">{formatTime(present.timestamp, 'relative')}</p>
        )}
      </div>

      {present.claimed ? (
        <span className="flex shrink-0 items-center gap-1 text-xs text-win">
          <Check size={14} strokeWidth={2} />
          Получено
        </span>
      ) : (
        <Button
          type="button"
          size="sm"
          onClick={onClaim}
          loading={claiming}
          disabled={disabled && !claiming}
          className="shrink-0"
        >
          Забрать
        </Button>
      )}
    </li>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────*/
export default function WalletPage() {
  const [tab, setTab] = useState<TabId>('balance');
  const giftCount = useUnreadCount('gift');

  const section = useMemo(() => {
    switch (tab) {
      case 'balance':
        return <BalanceSection />;
      case 'deposit':
        return <DepositSection />;
      case 'withdraw':
        return <WithdrawSection />;
      case 'presents':
        return <PresentsSection />;
    }
  }, [tab]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-ton">
          <WalletIcon size={22} />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Кошелёк</h1>
          <p className="text-sm text-muted">Баланс, пополнение, вывод и подарки</p>
        </div>
      </div>

      <TabBar active={tab} onChange={setTab} giftCount={giftCount} />

      {section}
    </div>
  );
}
