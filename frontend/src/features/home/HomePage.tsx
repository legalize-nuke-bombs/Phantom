import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  Users,
  Gamepad2,
  Trophy,
  Flame,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { coinName } from '@/shared/lib/coin';
import { useExperienceBatch, levelFor } from '@/shared/lib/experience';
import { GAME_META } from '@/shared/lib/games';
import type {
  UserStats,
  PlatformGameStats,
  GameHistoryEntry,
} from '@/shared/types';
import LotteryStatusCard from '@/features/lottery/LotteryStatusCard';
import PlatformCloudCard from '@/features/disk/PlatformCloudCard';
import Amount from '@/shared/ui/Amount';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import CoinGlyph from '@/shared/ui/CoinGlyph';
import GameHistoryRow from '@/shared/ui/GameHistoryRow';
import Spinner from '@/shared/ui/Spinner';

const ru = (n: number): string => n.toLocaleString('ru-RU');

/* ── Hero ──────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-xl border border-edge bg-panel p-6 sm:p-10">
      {/* spectral glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-ton/15 blur-3xl"
      />
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-edge bg-panel-2 px-3 py-1 text-xs font-medium text-ice">
          <ShieldCheck size={14} />
          Provably fair
        </span>

        <h1 className="mt-4 flex items-center gap-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          <span aria-hidden>💎</span>
          Phantom
        </h1>

        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
          Крипто-казино с мгновенными депозитами в {coinName()}.
        </p>
      </div>
    </section>
  );
}

/* ── Platform stats ────────────────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2 text-muted">
        <span className="text-ton">{icon}</span>
        <span className="text-xs sm:text-sm">{label}</span>
      </div>
      <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-fg">
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-win">{sub}</p> : null}
    </Card>
  );
}

function PlatformStats() {
  const users = useQuery({
    queryKey: ['stats', 'users'],
    queryFn: () => api.get<UserStats>('/users/stats'),
    staleTime: 60_000,
  });
  const games = useQuery({
    queryKey: ['stats', 'games'],
    queryFn: () => api.get<PlatformGameStats>('/games/stats'),
    staleTime: 60_000,
  });

  const loading = users.isLoading || games.isLoading;
  const failed = users.isError && games.isError;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted">Статистика платформы</h2>

      {loading ? (
        <Card className="grid place-items-center p-10">
          <Spinner size={26} />
        </Card>
      ) : failed ? (
        <Card className="p-6 text-center text-sm text-muted">
          {errorMessage(users.error ?? games.error)}
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={<Users size={16} />}
            label="Игроков"
            value={users.data ? ru(users.data.totalUsers) : '—'}
            sub={
              users.data ? `+${ru(users.data.totalUsers24h)} за 24ч` : undefined
            }
          />
          <StatCard
            icon={<Gamepad2 size={16} />}
            label="Сыграно игр"
            value={games.data ? ru(games.data.totalGames) : '—'}
            sub={
              games.data ? `+${ru(games.data.totalGames24h)} за 24ч` : undefined
            }
          />
          <StatCard
            icon={<Trophy size={16} />}
            label="Крупнейший выигрыш"
            value={
              <Amount value={games.data?.maxWin} />
            }
          />
          <StatCard
            icon={<Flame size={16} />}
            label="Лучший за 24ч"
            value={
              <Amount value={games.data?.maxWin24h} />
            }
          />
        </div>
      )}
    </section>
  );
}

/* ── Recent games feed ─────────────────────────────────────────────────── */
/* Rows use the shared <GameHistoryRow>; this is the cross-player feed, so we pass
   `withUser` to lead each row with the player's name. Cursor-paginated by game id
   (GET /api/games/history?limit&before, newest first): a modest page keeps it a
   tasteful home widget, with a "Показать ещё" button to pull in older games. */

const RECENT_GAMES_PAGE_SIZE = 8;

function RecentGames() {
  const { user } = useAuth();

  const history = useInfiniteQuery({
    queryKey: ['games', 'history', 'platform'],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(RECENT_GAMES_PAGE_SIZE) });
      if (pageParam !== undefined) params.set('before', String(pageParam));
      return api.get<GameHistoryEntry[]>(`/games/history?${params}`);
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) =>
      last.length < RECENT_GAMES_PAGE_SIZE ? undefined : last[last.length - 1].id,
    enabled: user != null,
    staleTime: 15_000,
  });

  const entries = history.data?.pages.flat() ?? [];

  // Batch the players' ranks so each feed row shows the real rank avatar, not a fallback.
  const { data: levels } = useExperienceBatch(entries.map((e) => e.user.id));

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted">Последние игры</h2>

      {user == null ? (
        <Card className="p-6 text-center text-sm text-muted">
          Войдите, чтобы видеть ленту последних игр
        </Card>
      ) : history.isLoading ? (
        <Card className="grid place-items-center p-10">
          <Spinner size={26} />
        </Card>
      ) : history.isError ? (
        <Card className="p-6 text-center text-sm text-muted">
          {errorMessage(history.error)}
        </Card>
      ) : entries.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">
          Пока нет сыгранных игр
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-edge px-4">
            {entries.map((entry) => (
              <GameHistoryRow
                key={entry.id}
                entry={entry}
                withUser
                level={levelFor(levels, entry.user.id)}
              />
            ))}
          </ul>
          {history.hasNextPage ? (
            <div className="border-t border-edge p-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                loading={history.isFetchingNextPage}
                onClick={() => history.fetchNextPage()}
              >
                Показать ещё
              </Button>
            </div>
          ) : null}
        </Card>
      )}
    </section>
  );
}

/* ── Games grid ────────────────────────────────────────────────────────── */

// The four real games, with their routes. Emoji/labels come from the shared
// presentation source so they stay consistent app-wide (Ящики → 📦, never 🎁); the
// `to` targets must match the lazy child routes registered in app/router.tsx.
// Coinflip overrides the emoji with the blue brand coin (CoinGlyph). The lottery is
// NOT a game — it lives in its own <LotteryStatusCard /> section below the grid.
interface GameLink {
  to: string;
  emoji: string;
  name: string;
  /** Optional custom icon node — overrides the emoji (e.g. the blue coinflip coin). */
  icon?: ReactNode;
}

const GAMES: ReadonlyArray<GameLink> = [
  { to: '/games/cases', ...GAME_META.CASES },
  { to: '/games/slots', ...GAME_META.FRUITS },
  { to: '/games/coinflip', ...GAME_META.COINFLIP, icon: <CoinGlyph size={26} /> },
  { to: '/games/upgrader', ...GAME_META.UPGRADER },
];

function GameTile({ game }: { game: GameLink }) {
  return (
    <Link
      to={game.to}
      className="group flex flex-col items-center gap-2 rounded-xl border border-edge bg-panel p-4 text-center transition-colors hover:border-ton/50 hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ton/60"
    >
      <span
        aria-hidden
        className="grid size-12 place-items-center rounded-xl border border-edge bg-panel-2 text-2xl transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105"
      >
        {game.icon ?? game.emoji}
      </span>
      <span className="text-sm font-medium text-fg">{game.name}</span>
    </Link>
  );
}

function GamesGrid() {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted">Игры</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {GAMES.map((game) => (
          <GameTile key={game.to} game={game} />
        ))}
      </div>
    </section>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <div className="space-y-8">
      <Hero />
      <PlatformStats />
      <GamesGrid />
      <LotteryStatusCard />
      <PlatformCloudCard />
      <RecentGames />
    </div>
  );
}
