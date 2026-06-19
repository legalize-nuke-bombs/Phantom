// Reusable profile surface for ANY user — own or someone else's.
//
//   <ProfileView userId={id} isOwn />        // full profile + settings + logout
//   <ProfileView userId={id} isOwn={false} /> // public profile, no settings
//
// Everything a profile shows (identity, rank, stats, history) is privacy-gated on
// the backend: a hidden section answers 403 (ErrorCode.INFO_HIDDEN). We model that
// as a first-class "hidden" state rather than an error, so each card renders one
// of: loading · hidden · error · data. The per-section query hooks below collapse
// a 403 into a typed HIDDEN sentinel, mirroring shared/lib/experience#useMyExperience.

import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Gamepad2,
  History,
  KeyRound,
  LogOut,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCog,
} from 'lucide-react';
import clsx from 'clsx';

import { api, ApiError } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { useMyExperience } from '@/shared/lib/experience';
import { formatTime } from '@/shared/lib/time';
import { RANKS_ASC } from '@/shared/types';
import type {
  Experience,
  GameHistoryEntry,
  GameType,
  Level,
  LevelName,
  PrivacySetting,
  Role,
  User,
} from '@/shared/types';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import Input from '@/shared/ui/Input';
import RankBadge from '@/shared/ui/RankBadge';
import Spinner from '@/shared/ui/Spinner';
import Amount from '@/shared/ui/Amount';

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

const GAME_LABELS: Record<GameType, string> = {
  CASES: '🎁 Кейсы',
  FRUITS: '🎰 Слоты',
  COINFLIP: '🪙 Коинфлип',
  UPGRADER: '📈 Апгрейдер',
};

function gameLabel(type: GameType): string {
  return GAME_LABELS[type] ?? type;
}

const PRIVACY_FIELDS: ReadonlyArray<{
  key:
    | 'gameHistoryPrivacySetting'
    | 'gameStatsPrivacySetting'
    | 'experiencePrivacySetting'
    | 'lotteryPrivacySetting';
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

/* ── privacy-gated section fetch ────────────────────────────────────────────
   A 403 (INFO_HIDDEN) is not an error here — it's "the owner hid this". We map
   it to a HIDDEN sentinel so cards can branch cleanly. Every other failure still
   surfaces as a real error. */
const HIDDEN = Symbol('hidden');
type Gated<T> = T | typeof HIDDEN;

function isHidden<T>(value: Gated<T> | undefined): value is typeof HIDDEN {
  return value === HIDDEN;
}

interface UserGameStats {
  totalGames: number;
  maxWin: string;
}

/** One user's game stats; resolves to HIDDEN on 403, never throws for privacy. */
function useUserStats(userId: number) {
  return useQuery<Gated<UserGameStats>>({
    queryKey: ['games', 'stats', userId],
    queryFn: async () => {
      try {
        return await api.get<UserGameStats>(`/games/stats/${userId}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) return HIDDEN;
        throw err;
      }
    },
  });
}

/** One user's recent games; resolves to HIDDEN on 403, never throws for privacy. */
function useUserHistory(userId: number) {
  return useQuery<Gated<GameHistoryEntry[]>>({
    queryKey: ['games', 'history', 'user', userId],
    queryFn: async () => {
      try {
        return await api.get<GameHistoryEntry[]>(`/games/history/${userId}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) return HIDDEN;
        throw err;
      }
    },
  });
}

/** Level thresholds — forever-cached; used only to derive the XP-bar floor. */
function useLevels() {
  return useQuery<Level[]>({
    queryKey: ['experience', 'levels'],
    queryFn: () => api.get<Level[]>('/experience/levels'),
    staleTime: Infinity,
  });
}

/* ── XP / rank progress (level is a STRING; RANKS_ASC gives the order) ──── */
interface Progress {
  rank: LevelName;
  nextRank: LevelName | null;
  pct: number;
  current: number;
  ceil: number | null;
}

function resolveRank(experience: Experience | null | undefined, levels: Level[] | undefined): LevelName {
  const fromApi = experience?.level ?? null;
  if (fromApi && RANKS_ASC.includes(fromApi)) return fromApi;

  // Fallback: derive the rank from raw XP against the thresholds.
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

function computeProgress(experience: Experience | null | undefined, levels: Level[] | undefined): Progress {
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

  return { rank, nextRank, pct, current: amount, ceil };
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

/** A titled card section. */
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
    <Card className={clsx('p-5 sm:p-6', className)}>
      <div className="mb-4 flex items-center gap-2 text-muted">
        {icon}
        <h2 className="text-sm font-medium">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

/** Neutral "this section is private" placeholder, shown for hidden cards. */
function HiddenNote({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <EyeOff size={15} strokeWidth={2} />
      {message}
    </div>
  );
}

/**
 * Render the body of a privacy-gated section through its four states. Keeps every
 * card's loading/hidden/error/data branching in one place.
 */
function GatedBody<T>({
  loading,
  error,
  data,
  hiddenMessage,
  errorFallback,
  children,
}: {
  loading: boolean;
  error: unknown;
  data: Gated<T> | undefined;
  hiddenMessage: string;
  errorFallback: string;
  children: (data: T) => ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-2">
        <Spinner size={20} />
      </div>
    );
  }
  if (error) return <FieldError message={errorMessage(error, errorFallback)} />;
  if (data === undefined || isHidden(data)) return <HiddenNote message={hiddenMessage} />;
  return <>{children(data)}</>;
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

/** Aligned label-left / switch-right row used for each privacy toggle. */
function ToggleRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex h-12 items-center justify-between gap-3 rounded-xl bg-panel-2 border border-edge px-3.5">
      <span className="min-w-0 truncate text-sm text-fg">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${label}: ${checked ? 'все' : 'только я'}`}
        onClick={onToggle}
        className="flex shrink-0 items-center gap-2.5"
      >
        <span
          className={clsx(
            'w-16 text-right text-xs tabular-nums',
            checked ? 'text-ton' : 'text-muted',
          )}
        >
          {checked ? 'Все' : 'Только я'}
        </span>
        <span
          className={clsx(
            'relative h-6 w-11 shrink-0 rounded-full transition-colors',
            checked ? 'bg-ton-deep' : 'bg-panel border border-edge',
          )}
        >
          <span
            className={clsx(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
              checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
            )}
          />
        </span>
      </button>
    </div>
  );
}

/* ── header ────────────────────────────────────────────────────────────── */
function ProfileHeader({ user, level }: { user: User; level: LevelName | null }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
      <RankBadge level={level} size={96} className="shrink-0 ring-2 ring-ton/40" />
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight text-fg">{user.displayName}</h1>
        <p className="mt-0.5 truncate text-sm text-muted">@{user.username}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          {level ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-panel-2 border border-edge px-2.5 py-1 text-xs text-ice">
              <Sparkles size={13} strokeWidth={2} />
              {level}
            </span>
          ) : null}
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

/* ── XP / rank card ────────────────────────────────────────────────────── */
function XpCard({
  experience,
  levels,
  loading,
  error,
  hidden,
}: {
  experience: Experience | null | undefined;
  levels: Level[] | undefined;
  loading: boolean;
  error: unknown;
  hidden: boolean;
}) {
  let body: ReactNode;
  if (loading) {
    body = (
      <div className="flex justify-center py-2">
        <Spinner size={20} />
      </div>
    );
  } else if (error) {
    body = <FieldError message={errorMessage(error, 'Не удалось загрузить опыт')} />;
  } else if (hidden || experience == null) {
    body = <HiddenNote message="Опыт скрыт" />;
  } else {
    const progress = computeProgress(experience, levels);
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <RankBadge level={progress.rank} size={28} />
            <span className="text-base font-semibold text-fg">{progress.rank}</span>
          </div>
          {progress.nextRank ? (
            <div className="flex items-center gap-2 text-muted">
              <span className="text-xs">{progress.nextRank}</span>
              <RankBadge level={progress.nextRank} size={20} className="opacity-60" />
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
    );
  }

  return <Section icon={<Sparkles size={16} strokeWidth={2} />} title="Опыт и ранг">{body}</Section>;
}

/* ── personal stats card ───────────────────────────────────────────────── */
function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-panel-2 border border-edge px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tracking-tight text-fg">{value}</p>
    </div>
  );
}

function StatsCard({ userId }: { userId: number }) {
  const query = useUserStats(userId);
  return (
    <Section icon={<BarChart3 size={16} strokeWidth={2} />} title="Статистика">
      <GatedBody
        loading={query.isLoading}
        error={query.error}
        data={query.data}
        hiddenMessage="Статистика скрыта"
        errorFallback="Не удалось загрузить статистику"
      >
        {(stats) => (
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Сыграно игр" value={stats.totalGames.toLocaleString('ru-RU')} />
            <StatTile label="Крупнейший выигрыш" value={<Amount value={stats.maxWin} />} />
          </div>
        )}
      </GatedBody>
    </Section>
  );
}

/* ── personal game history ─────────────────────────────────────────────── */
function HistoryRow({ entry }: { entry: GameHistoryEntry }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-fg">{gameLabel(entry.gameType)}</p>
        <p className="text-xs text-muted">{formatTime(entry.timestamp, 'relative')}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-sm font-medium">
        <Amount value={entry.bet} className="text-muted" />
        <span aria-hidden className="text-muted">
          →
        </span>
        <Amount value={entry.result} className="font-semibold" />
      </div>
    </li>
  );
}

function HistoryCard({ userId }: { userId: number }) {
  const query = useUserHistory(userId);
  return (
    <Section icon={<History size={16} strokeWidth={2} />} title="История игр">
      <GatedBody
        loading={query.isLoading}
        error={query.error}
        data={query.data}
        hiddenMessage="История игр скрыта"
        errorFallback="Не удалось загрузить историю"
      >
        {(history) =>
          history.length === 0 ? (
            <div className="flex items-center gap-2 py-1 text-sm text-muted">
              <Gamepad2 size={15} strokeWidth={2} />
              Пока нет сыгранных игр
            </div>
          ) : (
            <ul className="divide-y divide-edge">
              {history.map((entry) => (
                <HistoryRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )
        }
      </GatedBody>
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
  const nameInvalid = trimmed.length < DISPLAY_NAME_MIN || trimmed.length > DISPLAY_NAME_MAX;

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

      <div className="flex flex-col gap-2.5">
        <span className="text-sm text-muted">Кто видит мой профиль</span>
        {PRIVACY_FIELDS.map(({ key, label }) => (
          <ToggleRow
            key={key}
            label={label}
            checked={privacy[key] === 'EVERYONE'}
            onToggle={() => {
              setPrivacy((p) => ({
                ...p,
                [key]: p[key] === 'EVERYONE' ? 'ONLY_YOU' : 'EVERYONE',
              }));
              mutation.reset();
            }}
          />
        ))}
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

/* ── settings: security (current password FIRST, then username / password) ─ */
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
        Подтвердите текущим паролем, затем измените имя пользователя и/или пароль.
      </p>

      <PasswordInput
        label="Текущий пароль"
        value={currentPassword}
        onChange={(v) => {
          setCurrentPassword(v);
          mutation.reset();
        }}
        autoComplete="current-password"
      />

      <div className="flex flex-col gap-4 border-t border-edge pt-4">
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

        <div>
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
            <p className="mt-1.5 text-xs text-lose">Минимум {PASSWORD_MIN} символов</p>
          ) : password.length > 0 ? (
            <p className="mt-1.5 text-xs text-muted">
              {PASSWORD_MIN}–{PASSWORD_MAX} символов: заглавная, строчная и цифра
            </p>
          ) : null}
        </div>
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
    mutationFn: () => api.post<{ recoveryKey: string }>('/users/me/new-recovery-key', { password }),
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

/* ── settings: delete account (password shown inline) ──────────────────── */
function DeleteAccountForm() {
  const { logout } = useAuth();
  const navigate = useNavigate();
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

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-xl bg-lose/10 border border-lose/40 px-3 py-2.5 text-lose">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" strokeWidth={2} />
        <p className="text-xs leading-relaxed">
          Аккаунт и весь прогресс будут удалены безвозвратно. Подтвердите паролем — восстановить
          аккаунт после этого будет невозможно.
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
      <Button
        type="submit"
        loading={mutation.isPending}
        disabled={!password}
        className="self-start bg-lose text-white hover:bg-lose/90 active:bg-lose"
      >
        <Trash2 size={16} strokeWidth={2} />
        Удалить навсегда
      </Button>
    </form>
  );
}

/* ── settings group (own only) ─────────────────────────────────────────── */
function SettingsGroup({ user }: { user: User }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate('/login');
    }
  }

  return (
    <>
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
        className="w-full text-lose hover:bg-lose/10 hover:border-lose/50"
      >
        <LogOut size={18} strokeWidth={2} />
        Выйти из аккаунта
      </Button>
    </>
  );
}

/* ── public-facing profile (header + read-only cards) ──────────────────── */
function ProfileBody({ userId, isOwn }: { userId: number; isOwn: boolean }) {
  // The full user record. Own → /me (kept warm by AuthContext); else → /by-id.
  const userQuery = useQuery<User>({
    queryKey: isOwn ? ['users', 'me'] : ['users', 'by-id', userId],
    queryFn: () => api.get<User>(isOwn ? '/users/me' : `/users/by-id/${userId}`),
  });

  // Experience: useMyExperience swallows 403 → null (hidden). For others we also
  // know up front from the privacy flag, so we skip the request when it's private.
  const user = userQuery.data;
  const experienceVisible = isOwn || user == null || user.experiencePrivacySetting === 'EVERYONE';
  const experienceQuery = useMyExperience(experienceVisible ? userId : undefined);
  const levelsQuery = useLevels();

  if (userQuery.isLoading && !user) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <Card className="grid place-items-center p-10 text-center">
        <div className="max-w-sm">
          <p className="text-sm text-lose">
            {errorMessage(userQuery.error, 'Не удалось загрузить профиль')}
          </p>
          <Button variant="ghost" className="mt-4" onClick={() => userQuery.refetch()}>
            Повторить
          </Button>
        </div>
      </Card>
    );
  }

  // Hidden when the privacy flag forbids it, or the (swallowed-403) query yielded null.
  const experienceHidden =
    !experienceVisible || (experienceQuery.data == null && !experienceQuery.isError);
  const level: LevelName | null = experienceQuery.data?.level ?? null;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <Card className="p-5 sm:p-6">
        <ProfileHeader user={user} level={level} />
      </Card>

      <XpCard
        experience={experienceQuery.data}
        levels={levelsQuery.data}
        loading={experienceVisible && experienceQuery.isLoading}
        error={experienceQuery.error}
        hidden={experienceHidden}
      />

      <StatsCard userId={user.id} />
      <HistoryCard userId={user.id} />

      {isOwn ? <SettingsGroup user={user} /> : null}
    </div>
  );
}

/* ── public API ────────────────────────────────────────────────────────── */
export interface ProfileViewProps {
  /** Whose profile to render. */
  userId: number;
  /** Own profile → adds editable settings + logout, and reads via /users/me. */
  isOwn: boolean;
}

/**
 * The single profile surface used by both the own-profile page and the public
 * /u/:userId page. Pass isOwn to toggle the settings + logout sections.
 */
export default function ProfileView({ userId, isOwn }: ProfileViewProps) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <ProfileBody userId={userId} isOwn={isOwn} />
    </div>
  );
}
