// The XP leaderboard — GET /api/experience/leaderboard, ranked by XP desc.
//
// Design: the top three are a "podium" of accented cards (gold/silver/bronze, #1
// glowing), and everyone below is a clean numbered list. Pagination is cursor-based:
// the backend takes (beforeAmount, beforeUserId) from the LAST row we hold, so we
// drive it with useInfiniteQuery and a "Показать ещё" button. Mobile-first.

import { useInfiniteQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import clsx from 'clsx';

import { api } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import type { Experience, ShortUser } from '@/shared/types';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import Spinner from '@/shared/ui/Spinner';
import UserChip from '@/shared/ui/UserChip';

/**
 * LeaderboardEntryRepresentation — one row of GET /api/experience/leaderboard.
 * Composed from the shared ShortUser + Experience DTOs (verified against the
 * backend representation classes); kept local since shared/types doesn't export it.
 */
interface LeaderboardEntry {
  user: ShortUser;
  experience: Experience;
}

const PAGE_SIZE = 100;

/** Format an XP value with thin RU grouping (e.g. 12 500). */
function formatXp(n: number): string {
  return n.toLocaleString('ru-RU');
}

/* ── data ─────────────────────────────────────────────────────────────────
   The cursor is the (amount, userId) of the last row we already have — a stable
   tiebreaker for equal XP. A page shorter than PAGE_SIZE means we've hit the end. */
interface Cursor {
  beforeAmount: number;
  beforeUserId: number;
}

function fetchPage(cursor: Cursor | undefined) {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) {
    params.set('beforeAmount', String(cursor.beforeAmount));
    params.set('beforeUserId', String(cursor.beforeUserId));
  }
  return api.get<LeaderboardEntry[]>(`/experience/leaderboard?${params}`);
}

function useLeaderboard() {
  return useInfiniteQuery({
    queryKey: ['experience', 'leaderboard'],
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined as Cursor | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined; // no more rows
      const last = lastPage[lastPage.length - 1];
      return { beforeAmount: last.experience.amount, beforeUserId: last.user.id };
    },
  });
}

/* ── podium (top 3) ───────────────────────────────────────────────────────
   Position-keyed accents. #1 gets the strongest treatment: a gold ring, an outer
   glow and a larger badge. The medal + colour communicate rank at a glance. */
const PODIUM = [
  {
    medal: '🥇',
    ring: 'ring-2 ring-warn/70',
    glow: 'shadow-[0_0_28px_-4px_rgba(245,183,61,0.55)]',
    accent: 'text-warn',
    badge: 56,
  },
  {
    medal: '🥈',
    ring: 'ring-2 ring-muted/60',
    glow: '',
    accent: 'text-fg',
    badge: 48,
  },
  {
    medal: '🥉',
    ring: 'ring-2 ring-[#cd7f32]/60',
    glow: '',
    accent: 'text-[#cd7f32]',
    badge: 48,
  },
] as const;

function PodiumCard({
  entry,
  position,
}: {
  entry: LeaderboardEntry;
  position: 0 | 1 | 2;
}) {
  const style = PODIUM[position];
  return (
    <Card
      className={clsx(
        'relative flex items-center gap-3 overflow-hidden p-4',
        position === 0 && 'border-warn/40',
        style.glow,
      )}
    >
      {/* faint spectral wash behind the leader */}
      {position === 0 ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-warn/10 blur-2xl"
        />
      ) : null}

      <span aria-hidden className="text-2xl leading-none">
        {style.medal}
      </span>

      <UserChip
        user={entry.user}
        level={entry.experience.level}
        size={style.badge}
        className={clsx('min-w-0 flex-1 text-base font-semibold', style.accent)}
      />

      <span className="shrink-0 text-right">
        <span className="block font-mono text-lg font-semibold tabular-nums text-fg">
          {formatXp(entry.experience.amount)}
        </span>
        <span className="text-[11px] uppercase tracking-wide text-muted">XP</span>
      </span>
    </Card>
  );
}

/* ── list rows (4th place onward) ─────────────────────────────────────────── */
function ListRow({
  entry,
  position,
}: {
  entry: LeaderboardEntry;
  position: number;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="w-6 shrink-0 text-center text-sm font-medium tabular-nums text-muted">
        {position}
      </span>
      <UserChip
        user={entry.user}
        level={entry.experience.level}
        size={32}
        className="min-w-0 flex-1 text-sm font-medium"
      />
      <span className="shrink-0 font-mono text-sm tabular-nums text-fg">
        {formatXp(entry.experience.amount)}
        <span className="ml-1 text-xs text-muted">XP</span>
      </span>
    </li>
  );
}

/* ── page ─────────────────────────────────────────────────────────────────── */
export default function LeaderboardPage() {
  const {
    data,
    error,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useLeaderboard();

  if (isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="p-8 text-center text-sm text-lose">
        {errorMessage(error, 'Не удалось загрузить лидерборд')}
      </Card>
    );
  }

  const entries = data?.pages.flat() ?? [];

  if (entries.length === 0) {
    return (
      <Card className="grid place-items-center gap-3 p-10 text-center">
        <Trophy size={28} className="text-muted" />
        <p className="text-sm text-muted">В рейтинге пока никого нет</p>
      </Card>
    );
  }

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        {podium.map((entry, i) => (
          <PodiumCard key={entry.user.id} entry={entry} position={i as 0 | 1 | 2} />
        ))}
      </section>

      {rest.length > 0 ? (
        <Card className="divide-y divide-edge overflow-hidden p-0">
          <ul>
            {rest.map((entry, i) => (
              <ListRow key={entry.user.id} entry={entry} position={i + 4} />
            ))}
          </ul>
        </Card>
      ) : null}

      {hasNextPage ? (
        <div className="flex justify-center pt-1">
          <Button
            variant="ghost"
            loading={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            Показать ещё
          </Button>
        </div>
      ) : null}
    </div>
  );
}
