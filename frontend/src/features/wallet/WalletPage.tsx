// Wallet + Gifts (route: /wallet). Four sections behind a tab bar:
//
//   • Баланс    — the plain USD balance (the ONE place money is shown uncoloured).
//   • Пополнение — the on-chain deposit address for GRAM (CoinType TON) with copy +
//                  a "Проверить депозиты" action that scans the chain and refreshes
//                  the balance.
//   • Вывод      — { address, amount } → withdraw, then refresh; shows the resulting
//                  withdrawal status.
//   • Подарки    — send a present (gated by SEND_PRESENT) and the inbox of received
//                  presents with per-item claim + claim-all.
//
// Backend (verified against source, NOT ENDPOINTS.md):
//   GET  /api/wallets/me                        → Wallet { id, balance }            (useWallet)
//   GET  /api/wallets/me/crypto/{coin}          → { coin, address }
//   POST /api/wallets/me/crypto/{coin}/check-deposits → DepositRepresentation[]
//   POST /api/wallets/me/crypto/{coin}/withdraw → WithdrawalRepresentation
//   GET  /api/presents?claimed&limit&before     → PresentRepresentation[]
//   GET  /api/presents/count?claimed            → { result }
//   POST /api/presents/send  { receiverId, amount, anonymous, description? } → 200
//   POST /api/presents/claim { presentId }      → PresentRepresentation
//   POST /api/presents/claim-all                → { result } (sum claimed)
//
// Balances/amounts are internal USD; the deposit coin is Gram/GRAM (coin enum TON).

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
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
  RefreshCw,
  Send,
  Wallet as WalletIcon,
} from 'lucide-react';

import { api, ApiError } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { coinName, coinTicker } from '@/shared/lib/coin';
import type { CoinType } from '@/shared/lib/coin';
import { useMyExperience } from '@/shared/lib/experience';
import { FeatureLock, useFeatureGate } from '@/shared/lib/levelFeatures';
import { formatUsd } from '@/shared/lib/money';
import { formatTime } from '@/shared/lib/time';
import { useRefreshBalance, useWallet } from '@/shared/lib/wallet';
import type { LevelName, ShortUser, User } from '@/shared/types';
import Amount from '@/shared/ui/Amount';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import Input from '@/shared/ui/Input';
import Spinner from '@/shared/ui/Spinner';
import Switch from '@/shared/ui/Switch';
import UserChip from '@/shared/ui/UserChip';

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
const PRESENTS_COUNT_KEY = ['presents', 'count', 'unclaimed'] as const;
const PRESENTS_LIMIT = 50;

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

function TabBar({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Разделы кошелька"
      className="grid grid-cols-4 gap-1 rounded-xl border border-edge bg-panel p-1"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={[
              'flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-xs font-medium transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ton',
              selected ? 'bg-ton-deep text-white' : 'text-muted hover:bg-panel-2 hover:text-fg',
            ].join(' ')}
          >
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

/* ── Section: Пополнение ─────────────────────────────────────────────────────*/
function DepositSection() {
  const refreshBalance = useRefreshBalance();
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

/* ── Section: Вывод ───────────────────────────────────────────────────────── */
function WithdrawSection() {
  const refreshBalance = useRefreshBalance();
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
      setAddress('');
      setAmount('');
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
    </Card>
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

  const [receiverId, setReceiverId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  const receiverIdNum = Number(receiverId);
  const receiverValid =
    receiverId.trim() !== '' &&
    Number.isInteger(receiverIdNum) &&
    receiverIdNum > 0 &&
    receiverIdNum !== user?.id;

  // Preview the receiver so the sender confirms who they're paying. Only fires
  // for a syntactically valid id; a hidden/missing user resolves to an error we
  // surface inline (and which blocks send).
  const receiverQuery = useQuery<User>({
    queryKey: ['user', 'by-id', receiverIdNum],
    enabled: receiverValid,
    queryFn: () => api.get<User>(`/users/by-id/${receiverIdNum}`),
    retry: false,
  });
  const receiverExp = useMyExperience(receiverQuery.data?.id);

  const send = useMutation<void, ApiError>({
    mutationFn: () =>
      api.post<void>('/presents/send', {
        receiverId: receiverIdNum,
        amount,
        anonymous,
        description: description.trim() || undefined,
      }),
    onSuccess: async () => {
      await refreshBalance();
      // The receiver's inbox is theirs, not ours — nothing local to invalidate,
      // but clear the form for the next gift.
      setReceiverId('');
      setAmount('');
      setDescription('');
      setAnonymous(false);
      qc.invalidateQueries({ queryKey: ['presents'] });
    },
  });

  const numericAmount = Number(amount);
  const amountValid = amount.trim() !== '' && Number.isFinite(numericAmount) && numericAmount >= 1;
  const receiverLoaded = receiverValid && receiverQuery.isSuccess;
  const canSubmit =
    !gate.locked && receiverLoaded && amountValid && !send.isPending;

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
          <div>
            <Input
              label="ID получателя"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              placeholder="Например, 1024"
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              disabled={send.isPending}
              error={
                receiverId.trim() !== '' && receiverIdNum === user?.id
                  ? 'Нельзя отправить подарок себе'
                  : undefined
              }
            />
            {receiverValid && receiverIdNum !== user?.id && (
              <ReceiverPreview
                loading={receiverQuery.isLoading}
                error={
                  receiverQuery.isError
                    ? errorMessage(receiverQuery.error, 'Пользователь не найден')
                    : null
                }
                receiver={receiverQuery.data}
                level={receiverExp.data?.level ?? null}
              />
            )}
          </div>

          <Input
            label="Сумма (USD)"
            type="number"
            inputMode="decimal"
            min="1"
            step="any"
            placeholder="1.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={send.isPending}
          />

          <Input
            label="Сообщение (необязательно)"
            placeholder="С наилучшими пожеланиями"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
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

function ReceiverPreview({
  loading,
  error,
  receiver,
  level,
}: {
  loading: boolean;
  error: string | null;
  receiver: User | undefined;
  level: LevelName | null;
}) {
  if (loading) {
    return (
      <p className="mt-2 flex items-center gap-2 text-xs text-muted">
        <Spinner size={14} />
        Проверяем получателя…
      </p>
    );
  }
  if (error) return <p className="mt-2 text-xs text-lose">{error}</p>;
  if (!receiver) return null;
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-edge bg-panel-2 px-2.5 py-2">
      <UserChip user={receiver} level={level} size={24} link={false} />
    </div>
  );
}

/* received — list + per-item claim + claim-all */
function ReceivedPresentsCard() {
  const refreshBalance = useRefreshBalance();
  const qc = useQueryClient();

  const presents = useQuery<Present[]>({
    queryKey: PRESENTS_QUERY_KEY,
    queryFn: () => api.get<Present[]>(`/presents?limit=${PRESENTS_LIMIT}`),
  });

  // Total unclaimed (independent of the page size above) for the header badge.
  const unclaimedCount = useQuery<number>({
    queryKey: PRESENTS_COUNT_KEY,
    queryFn: async () => {
      const res = await api.get<{ result: string }>('/presents/count?claimed=false');
      const n = Number(res.result);
      return Number.isFinite(n) ? n : 0;
    },
  });

  async function afterClaim() {
    await refreshBalance();
    qc.invalidateQueries({ queryKey: PRESENTS_QUERY_KEY });
    qc.invalidateQueries({ queryKey: PRESENTS_COUNT_KEY });
  }

  const claimOne = useMutation<Present, ApiError, number>({
    mutationFn: (presentId) => api.post<Present>('/presents/claim', { presentId }),
    onSuccess: afterClaim,
  });

  const claimAll = useMutation<{ result: string }, ApiError>({
    mutationFn: () => api.post<{ result: string }>('/presents/claim-all'),
    onSuccess: afterClaim,
  });

  const items = presents.data ?? [];
  const hasUnclaimed = items.some((p) => !p.claimed);
  const badge = unclaimedCount.data ?? 0;

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
        Пока нет полученных подарков
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
              onClaim={() => claimOne.mutate(present.id)}
              claiming={claimOne.isPending && claimOne.variables === present.id}
              disabled={claimOne.isPending || claimAll.isPending}
            />
          ))}
        </ul>
      </>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted">
          <Gift size={16} strokeWidth={2} />
          <h2 className="text-sm font-medium">Полученные подарки</h2>
          {badge > 0 && (
            <span className="rounded-md bg-ton-deep px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {badge}
            </span>
          )}
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
  onClaim,
  claiming,
  disabled,
}: {
  present: Present;
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
            <UserChip user={present.sender} size={20} className="text-xs" />
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

      <TabBar active={tab} onChange={setTab} />

      {section}
    </div>
  );
}
