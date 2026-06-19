import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCog,
} from 'lucide-react';
import clsx from 'clsx';

import { api } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { formatTime } from '@/shared/lib/time';
import { RANKS_ASC } from '@/shared/types';
import type { Experience, Level, LevelName, PrivacySetting, Role, User } from '@/shared/types';
import RankBadge from '@/shared/ui/RankBadge';
import Button from '@/shared/ui/Button';
import Input from '@/shared/ui/Input';
import Spinner from '@/shared/ui/Spinner';

/* ── constraints (mirrored from the backend for inline hints) ───────────── */
const USERNAME_MIN = 4;
const USERNAME_MAX = 20;
const DISPLAY_NAME_MIN = 1;
const DISPLAY_NAME_MAX = 40;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 40;
const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

const ROLE_LABELS: Record<Role, string> = {
  USER: 'Игрок',
  CHAT_MODERATOR: 'Модератор чата',
  OWNER: 'Владелец',
};

const PRIVACY_FIELDS: ReadonlyArray<{
  key: 'gameHistoryPrivacySetting' | 'gameStatsPrivacySetting' | 'experiencePrivacySetting' | 'lotteryPrivacySetting';
  label: string;
}> = [
  { key: 'gameHistoryPrivacySetting', label: 'История игр' },
  { key: 'gameStatsPrivacySetting', label: 'Статистика игр' },
  { key: 'experiencePrivacySetting', label: 'Опыт и ранг' },
  { key: 'lotteryPrivacySetting', label: 'Участие в лотерее' },
];

function formatXp(n: number): string {
  return n.toLocaleString('ru-RU');
}

/* ── XP / rank progress (level is a STRING; RANKS_ASC gives the order) ──── */
interface Progress {
  rank: LevelName;
  nextRank: LevelName | null;
  pct: number;
  current: number;
  floor: number;
  ceil: number | null;
}

function resolveRank(experience: Experience | undefined, levels: Level[] | undefined): LevelName {
  const fromApi = experience?.level ?? null;
  if (fromApi && RANKS_ASC.includes(fromApi)) return fromApi;

  // Fallback: derive from XP against the level thresholds.
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
  return RANKS_ASC[0];
}

function computeProgress(experience: Experience | undefined, levels: Level[] | undefined): Progress {
  const rank = resolveRank(experience, levels);
  const amount = experience?.amount ?? 0;
  const idx = RANKS_ASC.indexOf(rank);
  const nextRank = idx >= 0 && idx < RANKS_ASC.length - 1 ? RANKS_ASC[idx + 1] : null;

  const sorted = levels ? [...levels].sort((a, b) => a.amount - b.amount) : [];
  const floor = sorted.find((l) => l.name === rank)?.amount ?? 0;
  const ceil =
    experience?.next ?? (nextRank ? sorted.find((l) => l.name === nextRank)?.amount ?? null : null);

  let pct = 100;
  if (ceil != null && ceil > floor) {
    pct = Math.min(100, Math.max(0, ((amount - floor) / (ceil - floor)) * 100));
  }

  return { rank, nextRank, pct, current: amount, floor, ceil };
}

/* ── small shared bits ─────────────────────────────────────────────────── */
function FieldError({ message }: { message: string }) {
  return <p className="text-sm text-lose">{message}</p>;
}

function FieldSuccess({ message }: { message: string }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-sm text-win">
      <Check size={14} strokeWidth={2.5} />
      {message}
    </p>
  );
}

function Section({
  icon,
  title,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx('bg-panel border border-edge rounded-xl p-5 sm:p-6', className)}>
      <div className="mb-4 flex items-center gap-2 text-muted">
        {icon}
        <h2 className="text-sm font-medium">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/** Collapsible settings block — keeps the page short on mobile. */
function Accordion({
  icon,
  title,
  danger,
  children,
}: {
  icon: ReactNode;
  title: string;
  danger?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-panel border border-edge rounded-xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={clsx(
          'flex w-full items-center gap-2.5 rounded-xl px-5 py-4 text-left transition-colors hover:bg-panel-2',
          danger ? 'text-lose' : 'text-fg',
        )}
      >
        <span className={danger ? 'text-lose' : 'text-muted'}>{icon}</span>
        <span className="flex-1 text-sm font-medium">{title}</span>
        <ChevronDown
          size={18}
          className={clsx('shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <div className="border-t border-edge px-5 pb-5 pt-4">{children}</div>}
    </div>
  );
}

function CopyButton({ value, className }: { value: string; className?: string }) {
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
    <Button
      type="button"
      variant="ghost"
      onClick={copy}
      aria-label="Скопировать"
      className={clsx('shrink-0 px-3', className)}
    >
      {copied ? <Check size={16} className="text-win" /> : <Copy size={16} />}
      <span className="hidden sm:inline">{copied ? 'Скопировано' : 'Копировать'}</span>
    </Button>
  );
}

/** Password input with a show/hide toggle, built on the shared Input. */
function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        label={label}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="pr-11"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
        className="absolute bottom-0 right-0 grid h-11 w-11 place-items-center text-muted hover:text-fg"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

/* ── header ────────────────────────────────────────────────────────────── */
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
        <p
          className="mt-2 text-xs text-muted"
          title={`Зарегистрирован ${formatTime(user.registeredAt, 'relative')}`}
        >
          На платформе с {formatTime(user.registeredAt, 'date')}
        </p>
      </div>
    </div>
  );
}

/* ── XP card ───────────────────────────────────────────────────────────── */
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
    <Section icon={<Sparkles size={16} strokeWidth={2} />} title="Опыт и ранг">
      {loading && !error ? (
        <div className="flex justify-center py-2">
          <Spinner size={20} />
        </div>
      ) : error ? (
        <FieldError message={errorMessage(error, 'Не удалось загрузить опыт')} />
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
            ) : null}
          </div>
        </div>
      )}
    </Section>
  );
}

/* ── settings: profile (display name + privacy) ────────────────────────── */
function ProfileSettingsForm({ user }: { user: User }) {
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [privacy, setPrivacy] = useState<Record<string, PrivacySetting>>({
    gameHistoryPrivacySetting: user.gameHistoryPrivacySetting,
    gameStatsPrivacySetting: user.gameStatsPrivacySetting,
    experiencePrivacySetting: user.experiencePrivacySetting,
    lotteryPrivacySetting: user.lotteryPrivacySetting,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.patch<{ message: string }>('/users/me', {
        displayName: displayName.trim(),
        ...privacy,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'me'] });
      qc.invalidateQueries({ queryKey: ['experience', user.id] });
    },
  });

  const trimmed = displayName.trim();
  const nameInvalid =
    trimmed.length < DISPLAY_NAME_MIN || trimmed.length > DISPLAY_NAME_MAX;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (nameInvalid || mutation.isPending) return;
    mutation.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Input
        label="Отображаемое имя"
        value={displayName}
        onChange={(e) => {
          setDisplayName(e.target.value);
          mutation.reset();
        }}
        maxLength={DISPLAY_NAME_MAX}
        autoComplete="nickname"
        error={
          nameInvalid && trimmed.length === 0
            ? 'Имя не может быть пустым'
            : nameInvalid
              ? `Не длиннее ${DISPLAY_NAME_MAX} символов`
              : undefined
        }
      />

      <div className="flex flex-col gap-3">
        <span className="text-sm text-muted">Кто видит мой профиль</span>
        {PRIVACY_FIELDS.map(({ key, label }) => {
          const everyone = privacy[key] === 'EVERYONE';
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-xl bg-panel-2 border border-edge px-3 py-2.5"
            >
              <span className="text-sm text-fg">{label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={everyone}
                aria-label={`${label}: ${everyone ? 'все' : 'только я'}`}
                onClick={() => {
                  setPrivacy((p) => ({ ...p, [key]: everyone ? 'ONLY_YOU' : 'EVERYONE' }));
                  mutation.reset();
                }}
                className="inline-flex items-center gap-2"
              >
                <span className={clsx('text-xs', everyone ? 'text-ton' : 'text-muted')}>
                  {everyone ? 'Все' : 'Только я'}
                </span>
                <span
                  className={clsx(
                    'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                    everyone ? 'bg-ton-deep' : 'bg-panel border border-edge',
                  )}
                >
                  <span
                    className={clsx(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                      everyone ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
                    )}
                  />
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {mutation.isError && (
        <FieldError message={errorMessage(mutation.error, 'Не удалось сохранить')} />
      )}
      {mutation.isSuccess && <FieldSuccess message="Профиль сохранён" />}

      <Button type="submit" loading={mutation.isPending} disabled={nameInvalid} className="self-start">
        Сохранить
      </Button>
    </form>
  );
}

/* ── settings: security (username / password) ──────────────────────────── */
function SecuritySettingsForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      const body: { currentPassword: string; username?: string; password?: string } = {
        currentPassword,
      };
      if (username.trim()) body.username = username.trim();
      if (password) body.password = password;
      return api.patch<{ message: string }>('/users/me/secure', body);
    },
    onSuccess: () => {
      setCurrentPassword('');
      setUsername('');
      setPassword('');
    },
  });

  const u = username.trim();
  const usernameInvalid =
    u.length > 0 && (u.length < USERNAME_MIN || u.length > USERNAME_MAX || !USERNAME_RE.test(u));
  const passwordTooShort = password.length > 0 && password.length < PASSWORD_MIN;
  const nothingToChange = u.length === 0 && password.length === 0;
  const blocked =
    !currentPassword || nothingToChange || usernameInvalid || passwordTooShort || mutation.isPending;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (blocked) return;
    mutation.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="text-xs text-muted">
        Измените имя пользователя и/или пароль. Текущий пароль обязателен.
      </p>

      <Input
        label="Новое имя пользователя"
        value={username}
        onChange={(e) => {
          setUsername(e.target.value);
          mutation.reset();
        }}
        autoComplete="username"
        placeholder="необязательно"
        maxLength={USERNAME_MAX}
        error={usernameInvalid ? `${USERNAME_MIN}–${USERNAME_MAX}, латиница, цифры, _` : undefined}
      />

      <PasswordInput
        label="Новый пароль"
        value={password}
        onChange={(v) => {
          setPassword(v);
          mutation.reset();
        }}
        autoComplete="new-password"
        placeholder="необязательно"
      />
      {passwordTooShort ? (
        <p className="-mt-2 text-xs text-lose">Минимум {PASSWORD_MIN} символов</p>
      ) : password.length > 0 ? (
        <p className="-mt-2 text-xs text-muted">
          {PASSWORD_MIN}–{PASSWORD_MAX} символов: заглавная, строчная и цифра
        </p>
      ) : null}

      <div className="border-t border-edge pt-4">
        <PasswordInput
          label="Текущий пароль"
          value={currentPassword}
          onChange={(v) => {
            setCurrentPassword(v);
            mutation.reset();
          }}
          autoComplete="current-password"
        />
      </div>

      {mutation.isError && (
        <FieldError message={errorMessage(mutation.error, 'Не удалось обновить данные')} />
      )}
      {mutation.isSuccess && <FieldSuccess message="Данные обновлены" />}

      <Button type="submit" loading={mutation.isPending} disabled={blocked} className="self-start">
        Обновить
      </Button>
    </form>
  );
}

/* ── settings: new recovery key ────────────────────────────────────────── */
function RecoveryKeyForm() {
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ recoveryKey: string }>('/users/me/new-recovery-key', { password }),
    onSuccess: () => setPassword(''),
  });

  const key = mutation.data?.recoveryKey;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password || mutation.isPending) return;
    mutation.mutate();
  }

  if (key) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 rounded-xl bg-warn/10 border border-warn/40 px-3 py-2.5 text-warn">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" strokeWidth={2} />
          <p className="text-xs leading-relaxed">
            Сохраните ключ — он показывается <span className="font-semibold">один раз</span>. Старый
            ключ восстановления больше не действует.
          </p>
        </div>
        <div className="flex items-stretch gap-2">
          <code className="min-w-0 flex-1 break-all rounded-xl bg-panel-2 border border-edge px-3 py-2.5 font-mono text-sm text-fg">
            {key}
          </code>
          <CopyButton value={key} />
        </div>
        <Button type="button" variant="ghost" onClick={() => mutation.reset()} className="self-start">
          Готово
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="text-xs text-muted">
        Сгенерируйте новый ключ восстановления. Подтвердите паролем — прежний ключ перестанет
        работать.
      </p>
      <PasswordInput
        label="Текущий пароль"
        value={password}
        onChange={(v) => {
          setPassword(v);
          mutation.reset();
        }}
        autoComplete="current-password"
      />
      {mutation.isError && (
        <FieldError message={errorMessage(mutation.error, 'Не удалось создать ключ')} />
      )}
      <Button type="submit" loading={mutation.isPending} disabled={!password} className="self-start">
        Сгенерировать ключ
      </Button>
    </form>
  );
}

/* ── settings: delete account ──────────────────────────────────────────── */
function DeleteAccountForm() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.del<void>('/users/me', { password }),
    onSuccess: async () => {
      await logout();
      navigate('/login');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password || mutation.isPending) return;
    mutation.mutate();
  }

  if (!confirming) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted">
          Аккаунт и весь прогресс будут удалены безвозвратно. Это действие нельзя отменить.
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirming(true)}
          className="self-start text-lose hover:bg-lose/10 hover:border-lose/50"
        >
          <Trash2 size={16} strokeWidth={2} />
          Удалить аккаунт
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-xl bg-lose/10 border border-lose/40 px-3 py-2.5 text-lose">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" strokeWidth={2} />
        <p className="text-xs leading-relaxed">
          Подтвердите удаление паролем. Восстановить аккаунт после этого будет невозможно.
        </p>
      </div>
      <PasswordInput
        label="Пароль для подтверждения"
        value={password}
        onChange={(v) => {
          setPassword(v);
          mutation.reset();
        }}
        autoComplete="current-password"
      />
      {mutation.isError && (
        <FieldError message={errorMessage(mutation.error, 'Не удалось удалить аккаунт')} />
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          loading={mutation.isPending}
          disabled={!password}
          className="bg-lose text-white hover:bg-lose/90 active:bg-lose"
        >
          <Trash2 size={16} strokeWidth={2} />
          Удалить навсегда
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setConfirming(false);
            setPassword('');
            mutation.reset();
          }}
          disabled={mutation.isPending}
        >
          Отмена
        </Button>
      </div>
    </form>
  );
}

/* ── page ──────────────────────────────────────────────────────────────── */
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

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate('/login');
    }
  }

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
            {errorMessage(meQuery.error, 'Не удалось загрузить профиль')}
          </p>
          <Button variant="ghost" className="mt-4" onClick={() => meQuery.refetch()}>
            Повторить
          </Button>
        </div>
      </main>
    );
  }

  const progress = computeProgress(experienceQuery.data, levelsQuery.data);

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

        <div className="flex items-center gap-2 px-1 pt-1 text-muted">
          <Settings size={16} strokeWidth={2} />
          <h2 className="text-sm font-medium">Настройки</h2>
        </div>

        <div className="flex flex-col gap-3">
          <Accordion icon={<UserCog size={18} strokeWidth={2} />} title="Профиль">
            <ProfileSettingsForm user={user} />
          </Accordion>

          <Accordion icon={<ShieldCheck size={18} strokeWidth={2} />} title="Безопасность">
            <SecuritySettingsForm />
          </Accordion>

          <Accordion icon={<KeyRound size={18} strokeWidth={2} />} title="Ключ восстановления">
            <RecoveryKeyForm />
          </Accordion>

          <Accordion icon={<Trash2 size={18} strokeWidth={2} />} title="Удаление аккаунта" danger>
            <DeleteAccountForm />
          </Accordion>
        </div>

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
