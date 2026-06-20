// Reusable profile surface for ANY user — own or someone else's.
//
//   <ProfileView userId={id} isOwn />        // profile + nav to settings/referrals
//   <ProfileView userId={id} isOwn={false} /> // public profile only
//
// Everything a profile shows (identity, rank, stats, history) is privacy-gated on
// the backend: a hidden section answers 403 (ErrorCode.INFO_HIDDEN). We model that
// as a first-class "hidden" state rather than an error, so each card renders one
// of: loading · hidden · error · data. The per-section query hooks below collapse
// a 403 into a typed HIDDEN sentinel, mirroring shared/lib/experience#useMyExperience.
//
// The OWN profile stays deliberately COMPACT for mobile: the header card itself
// carries the two nav links (Settings / Referrals) so they're impossible to miss,
// instead of inlining those flows or burying them at the bottom.

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  EyeOff,
  Gamepad2,
  Gift,
  History,
  MessageCircle,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import clsx from 'clsx';

import { api, ApiError } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { useStartDirectChat } from '@/shared/chat/chats';
import { useMyExperience } from '@/shared/lib/experience';
import { FeatureLock, useFeatureGate, useLevels } from '@/shared/lib/levelFeatures';
import { formatTime } from '@/shared/lib/time';
import { RANKS_ASC } from '@/shared/types';
import type {
  Experience,
  GameHistoryEntry,
  Level,
  LevelName,
  Role,
  User,
} from '@/shared/types';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import RankBadge from '@/shared/ui/RankBadge';
import Spinner from '@/shared/ui/Spinner';
import Amount from '@/shared/ui/Amount';
import GameHistoryRow from '@/shared/ui/GameHistoryRow';
import UserLookup from '@/shared/ui/UserLookup';

const ROLE_LABELS: Record<Role, string> = {
  USER: 'Игрок',
  CHAT_MODERATOR: 'Модератор чата',
  OWNER: 'Владелец',
};

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

const HISTORY_PAGE_SIZE = 20;

/**
 * One user's games, cursor-paginated (GET /api/games/history/{id}?limit&before).
 * The backend orders by game id DESC and filters `id < before`, so the cursor for
 * the next page is the LAST (smallest) id we hold; a short page means the end.
 * A 403 (INFO_HIDDEN) on the first page resolves to the HIDDEN sentinel — never an
 * error — so privacy stays a first-class state; later pages can't 403 once access
 * is granted, but typing each page as Gated keeps getNextPageParam sound.
 */
function useUserHistory(userId: number) {
  return useInfiniteQuery({
    queryKey: ['games', 'history', 'user', userId],
    queryFn: async ({ pageParam }): Promise<Gated<GameHistoryEntry[]>> => {
      const qs = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE) });
      if (pageParam != null) qs.set('before', String(pageParam));
      try {
        return await api.get<GameHistoryEntry[]>(`/games/history/${userId}?${qs.toString()}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) return HIDDEN;
        throw err;
      }
    },
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage): number | null | undefined => {
      if (isHidden(lastPage) || lastPage.length < HISTORY_PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1].id;
    },
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
          <span className="inline-flex items-center gap-1 rounded-full bg-panel-2 border border-edge px-2.5 py-1 font-mono text-xs text-muted">
            ID {user.id}
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
/* Rows use the shared <GameHistoryRow>; here it's a single user's own history, so
   we omit `withUser` and the game name leads each row. */
function HistoryCard({ userId }: { userId: number }) {
  const query = useUserHistory(userId);

  // Collapse the pages back to a single Gated value: a hidden first page keeps the
  // section hidden; otherwise flatten the array pages into one list for GatedBody.
  const history = useMemo<Gated<GameHistoryEntry[]> | undefined>(() => {
    const pages = query.data?.pages;
    if (!pages || pages.length === 0) return undefined;
    if (isHidden(pages[0])) return HIDDEN;
    return pages.flatMap((page) => (isHidden(page) ? [] : page));
  }, [query.data]);

  return (
    <Section icon={<History size={16} strokeWidth={2} />} title="История игр">
      <GatedBody
        loading={query.isLoading}
        error={query.error}
        data={history}
        hiddenMessage="История игр скрыта"
        errorFallback="Не удалось загрузить историю"
      >
        {(entries) =>
          entries.length === 0 ? (
            <div className="flex items-center gap-2 py-1 text-sm text-muted">
              <Gamepad2 size={15} strokeWidth={2} />
              Пока нет сыгранных игр
            </div>
          ) : (
            <>
              <ul className="divide-y divide-edge">
                {entries.map((entry) => (
                  <GameHistoryRow key={entry.id} entry={entry} />
                ))}
              </ul>
              {query.hasNextPage ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => query.fetchNextPage()}
                  loading={query.isFetchingNextPage}
                  className="mt-4 w-full"
                >
                  Показать ещё
                </Button>
              ) : null}
            </>
          )
        }
      </GatedBody>
    </Section>
  );
}

/* ── own-profile navigation (settings / referrals) ─────────────────────── */
/* Lives INSIDE the header card so it's the first thing on the own profile. A Link
   styled like a ghost Button — anchors can't be nested in <button>, so we reuse the
   button look here rather than wrapping the shared Button. */
function NavLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className={clsx(
        'flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium',
        'bg-panel-2 text-fg border border-edge transition-colors hover:bg-panel-2/60 hover:border-ton/40',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ton',
      )}
    >
      <span className="text-muted">{icon}</span>
      {label}
    </Link>
  );
}

/** The two own-profile nav links, side by side — rendered within the header card. */
function OwnNav() {
  return (
    <div className="mt-5 flex items-center gap-3 border-t border-edge pt-4">
      <NavLink to="/profile/settings" icon={<Settings size={17} strokeWidth={2} />} label="Настройки" />
      <NavLink to="/profile/referrals" icon={<Gift size={17} strokeWidth={2} />} label="Рефералы" />
    </div>
  );
}

/* ── find another player (by id) → their profile ───────────────────────────── */
function PlayerSearch() {
  const [value, setValue] = useState('');
  return (
    <Section icon={<Search size={16} strokeWidth={2} />} title="Найти игрока">
      {/* The resolved player shows as a clickable chip below the field — that IS the
          navigation, so no separate button is needed. */}
      <UserLookup
        value={value}
        onChange={setValue}
        placeholder="ID или @username"
        linkChip
      />
    </Section>
  );
}

/* ── "Написать" — start/open a 1:1 DM with this user (non-own profiles) ────────
   Gated on SEND_MESSAGE: locked → disabled + a FeatureLock hint. Finds an existing
   DM with this user or creates one (shared/chat/chats#useStartDirectChat), then
   routes to its conversation. */
function WriteButton({ targetId }: { targetId: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { locked } = useFeatureGate('SEND_MESSAGE');
  const startChat = useStartDirectChat();

  function handleWrite() {
    if (locked || user == null) return;
    startChat.mutate(
      { target: { id: targetId }, myId: user.id },
      { onSuccess: (chatId) => navigate(`/chat/groups/${chatId}`) },
    );
  }

  return (
    <div className="mt-5 flex flex-col gap-2 border-t border-edge pt-4">
      <Button onClick={handleWrite} disabled={locked} loading={startChat.isPending}>
        <MessageCircle size={17} strokeWidth={2} />
        Написать
      </Button>
      {locked ? <FeatureLock feature="SEND_MESSAGE" /> : null}
      {startChat.isError ? (
        <p className="text-sm text-lose">{errorMessage(startChat.error, 'Не удалось открыть чат')}</p>
      ) : null}
    </div>
  );
}

/* ── profile body (header + cards [+ own nav]) ─────────────────────────── */
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
        {isOwn ? <OwnNav /> : <WriteButton targetId={user.id} />}
      </Card>

      {isOwn ? <PlayerSearch /> : null}

      <XpCard
        experience={experienceQuery.data}
        levels={levelsQuery.data}
        loading={experienceVisible && experienceQuery.isLoading}
        error={experienceQuery.error}
        hidden={experienceHidden}
      />

      <StatsCard userId={user.id} />
      <HistoryCard userId={user.id} />
    </div>
  );
}

/* ── public API ────────────────────────────────────────────────────────── */
export interface ProfileViewProps {
  /** Whose profile to render. */
  userId: number;
  /** Own profile → adds nav buttons to settings/referrals, and reads via /users/me. */
  isOwn: boolean;
}

/**
 * The single profile surface used by both the own-profile page and the public
 * /u/:userId page. Pass isOwn to add the own-profile nav buttons.
 */
export default function ProfileView({ userId, isOwn }: ProfileViewProps) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <ProfileBody userId={userId} isOwn={isOwn} />
    </div>
  );
}
