import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, LogOut, ShieldCheck, Sparkles, Wallet as WalletIcon } from 'lucide-react';
import clsx from 'clsx';

import { api, ApiError } from '@/shared/api/client';
import { useAuth } from '@/shared/auth/AuthContext';
import type { Experience, Level, LevelName, Role, User, Wallet } from '@/shared/types';
import RankBadge from '@/shared/ui/RankBadge';
import Button from '@/shared/ui/Button';
import Spinner from '@/shared/ui/Spinner';

/** Ranks low → high. Kept locally so the progress bar is independent of API ordering. */
const RANK_ORDER: LevelName[] = [
  'Whisper',
  'Echo',
  'Shade',
  'Wisp',
  'Spectre',
  'Phantom',
  'Revenant',
  'Reaper',
];

const ROLE_LABELS: Record<Role, string> = {
  USER: 'Игрок',
  CHAT_MODERATOR: 'Модератор чата',
  OWNER: 'Владелец',
};

/** Жётко форматируем десятичный баланс (строка) до 2 знаков, с разделителями. */
function formatBalance(raw: string | undefined): string {
  if (!raw) return '0.00';
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatXp(n: number): string {
  return n.toLocaleString('ru-RU');
}

/** Имя ранга может прийти как строка-enum или как объект Level — нормализуем. */
function levelNameOf(level: Experience['level']): LevelName | null {
  if (!level) return null;
  if (typeof level === 'string') return level as LevelName;
  return level.name;
}

/** Текущий ранг по количеству XP (надёжнее, чем доверять сериализации enum). */
function resolveRank(
  experience: Experience | undefined,
  levels: Level[] | undefined,
): LevelName {
  const fromApi = levelNameOf(experience?.level ?? null);
  if (fromApi && RANK_ORDER.includes(fromApi)) return fromApi;

  const amount = experience?.amount ?? 0;
  if (levels && levels.length > 0) {
    const sorted = [...levels].sort((a, b) => a.amount - b.amount);
    let current: LevelName = sorted[0].name;
    for (const lvl of sorted) {
      if (amount >= lvl.amount) current = lvl.name;
      else break;
    }
    return current;
  }
  return RANK_ORDER[0];
}

interface Progress {
  rank: LevelName;
  nextRank: LevelName | null;
  pct: number;
  current: number;
  floor: number;
  ceil: number | null;
}

function computeProgress(
  experience: Experience | undefined,
  levels: Level[] | undefined,
): Progress {
  const rank = resolveRank(experience, levels);
  const amount = experience?.amount ?? 0;
  const idx = RANK_ORDER.indexOf(rank);
  const nextRank = idx >= 0 && idx < RANK_ORDER.length - 1 ? RANK_ORDER[idx + 1] : null;

  // Порог текущего ранга.
  const sorted = levels ? [...levels].sort((a, b) => a.amount - b.amount) : [];
  const floor = sorted.find((l) => l.name === rank)?.amount ?? 0;
  // Порог следующего ранга: из experience.next, иначе из списка уровней.
  const ceil =
    experience?.next ?? (nextRank ? sorted.find((l) => l.name === nextRank)?.amount ?? null : null);

  let pct = 100;
  if (ceil != null && ceil > floor) {
    pct = Math.min(100, Math.max(0, ((amount - floor) / (ceil - floor)) * 100));
  }

  return { rank, nextRank, pct, current: amount, floor, ceil };
}

function SectionError({ message }: { message: string }) {
  return <p className="text-sm text-lose">{message}</p>;
}

function errMessage(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex items-stretch gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl bg-panel-2 border border-edge px-3 py-2.5 font-mono text-sm text-fg">
          {value}
        </code>
        <Button
          type="button"
          variant="ghost"
          onClick={copy}
          aria-label="Скопировать"
          className="shrink-0 px-3"
        >
          {copied ? (
            <Check size={16} className="text-win" />
          ) : (
            <Copy size={16} />
          )}
          <span className="hidden sm:inline">{copied ? 'Скопировано' : 'Копировать'}</span>
        </Button>
      </div>
    </div>
  );
}

function ProfileHeader({ user, rank }: { user: User; rank: LevelName }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
      <RankBadge rank={rank} size={96} className="shrink-0 ring-2 ring-ton/40" />
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight text-fg">
          {user.displayName}
        </h1>
        <p className="mt-0.5 truncate text-sm text-muted">@{user.username}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-panel-2 border border-edge px-2.5 py-1 text-xs text-ice">
            <Sparkles size={13} strokeWidth={2} />
            {rank}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-panel-2 border border-edge px-2.5 py-1 text-xs text-muted">
            <ShieldCheck size={13} strokeWidth={2} />
            {ROLE_LABELS[user.role]}
          </span>
        </div>
      </div>
    </div>
  );
}

function XpCard({
  progress,
  loading,
  error,
}: {
  progress: Progress;
  loading: boolean;
  error: unknown;
}) {
  return (
    <section className="bg-panel border border-edge rounded-xl p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">Опыт и ранг</h2>
        {loading && <Spinner size={16} />}
      </div>

      {error ? (
        <SectionError message={errMessage(error, 'Не удалось загрузить опыт')} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div className="flex items-center gap-2">
              <RankBadge rank={progress.rank} size={28} />
              <span className="text-base font-semibold text-fg">{progress.rank}</span>
            </div>
            {progress.nextRank ? (
              <div className="flex items-center gap-2 text-muted">
                <span className="text-xs">{progress.nextRank}</span>
                <RankBadge rank={progress.nextRank} size={20} className="opacity-60" />
              </div>
            ) : (
              <span className="text-xs text-ice">Максимальный ранг</span>
            )}
          </div>

          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-panel-2 border border-edge"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.pct)}
          >
            <div
              className="h-full rounded-full bg-ton-deep transition-[width] duration-500"
              style={{ width: `${progress.pct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              <span className="font-mono text-fg">{formatXp(progress.current)}</span> XP
            </span>
            {progress.ceil != null ? (
              <span>
                до следующего:{' '}
                <span className="font-mono text-fg">
                  {formatXp(Math.max(0, progress.ceil - progress.current))}
                </span>{' '}
                XP
              </span>
            ) : (
              <span className="font-mono text-fg">{formatXp(progress.current)} XP</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function BalanceCard({
  wallet,
  loading,
  error,
}: {
  wallet: Wallet | undefined;
  loading: boolean;
  error: unknown;
}) {
  return (
    <section className="bg-panel border border-edge rounded-xl p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-2 text-muted">
        <WalletIcon size={16} strokeWidth={2} />
        <h2 className="text-sm font-medium">Баланс</h2>
        {loading && <Spinner size={16} className="ml-auto" />}
      </div>
      {error ? (
        <SectionError message={errMessage(error, 'Не удалось загрузить баланс')} />
      ) : (
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-semibold text-fg">
            {formatBalance(wallet?.balance)}
          </span>
          <span className="text-sm font-medium text-ton">TON</span>
        </p>
      )}
    </section>
  );
}

function ReferralCard({
  userId,
  refError,
}: {
  userId: number;
  refError: unknown;
}) {
  const link = useMemo(() => {
    const origin =
      typeof window !== 'undefined' && window.location ? window.location.origin : '';
    return `${origin}/register?refId=${userId}`;
  }, [userId]);

  return (
    <section className="bg-panel border border-edge rounded-xl p-5 sm:p-6">
      <h2 className="mb-4 text-sm font-medium text-muted">Реферальная программа</h2>
      <div className="flex flex-col gap-4">
        <CopyField label="Ваш реферальный код" value={String(userId)} />
        <CopyField label="Ссылка для приглашения" value={link} />
        {refError ? (
          <SectionError message={errMessage(refError, 'Не удалось загрузить реферальные данные')} />
        ) : (
          <p className="text-xs text-muted">
            Делитесь ссылкой — получайте вознаграждение за приглашённых игроков.
          </p>
        )}
      </div>
    </section>
  );
}

export default function ProfilePage() {
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const meQuery = useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => api.get<User>('/users/me'),
    initialData: authUser ?? undefined,
  });

  const user = meQuery.data;
  const userId = user?.id;

  const levelsQuery = useQuery({
    queryKey: ['experience', 'levels'],
    queryFn: () => api.get<Level[]>('/experience/levels'),
    staleTime: Infinity,
  });

  const experienceQuery = useQuery({
    queryKey: ['experience', userId],
    queryFn: () => api.get<Experience>(`/experience/${userId}`),
    enabled: userId != null,
  });

  const walletQuery = useQuery({
    queryKey: ['wallets', 'me'],
    queryFn: () => api.get<Wallet>('/wallets/me'),
  });

  // Реферальные данные грузим, чтобы убедиться в наличии хранилища; ошибку показываем мягко.
  const refQuery = useQuery({
    queryKey: ['ref'],
    queryFn: () => api.get<{ id: number; amount: string; total: string }>('/ref'),
  });

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate('/login');
    }
  }

  const progress = computeProgress(experienceQuery.data, levelsQuery.data);

  // Первичная загрузка профиля: без пользователя показать нечего.
  if (meQuery.isLoading && !user) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-4">
        <Spinner size={32} />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-4 text-center">
        <div className="max-w-sm">
          <p className="text-sm text-lose">
            {errMessage(meQuery.error, 'Не удалось загрузить профиль')}
          </p>
          <Button variant="ghost" className="mt-4" onClick={() => meQuery.refetch()}>
            Повторить
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      <div className="flex flex-col gap-5 sm:gap-6">
        <section className="bg-panel border border-edge rounded-xl p-5 sm:p-6">
          <ProfileHeader user={user} rank={progress.rank} />
        </section>

        <XpCard
          progress={progress}
          loading={experienceQuery.isLoading || levelsQuery.isLoading}
          error={experienceQuery.error ?? levelsQuery.error}
        />

        <BalanceCard
          wallet={walletQuery.data}
          loading={walletQuery.isLoading}
          error={walletQuery.error}
        />

        <ReferralCard userId={user.id} refError={refQuery.error} />

        <Button
          variant="ghost"
          size="lg"
          onClick={handleLogout}
          loading={loggingOut}
          className={clsx('w-full text-lose', 'hover:bg-lose/10 hover:border-lose/50')}
        >
          <LogOut size={18} strokeWidth={2} />
          Выйти из аккаунта
        </Button>
      </div>
    </main>
  );
}
