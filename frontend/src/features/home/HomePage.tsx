import { useQuery } from '@tanstack/react-query';
import { Users, Gamepad2, Trophy, Flame, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { formatUsd } from '@/shared/lib/money';
import { formatTime } from '@/shared/lib/time';
import type {
  UserStats,
  PlatformGameStats,
  GameHistoryEntry,
  GameType,
} from '@/shared/types';
import Card from '@/shared/ui/Card';
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
          Честное крипто-казино с прозрачными результатами и мгновенными
          депозитами в TON. Каждая игра проверяема — исход нельзя подделать.
        </p>

        <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-panel-2 px-2.5 py-1">
            <Sparkles size={13} className="text-ton" />
            Депозиты в TON
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-panel-2 px-2.5 py-1">
            <ShieldCheck size={13} className="text-ton" />
            Честные исходы
          </span>
        </div>
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
  value: string;
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
      {sub ? <p className="mt-0.5 text-xs text-ice">{sub}</p> : null}
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
            value={formatUsd(games.data?.maxWin)}
          />
          <StatCard
            icon={<Flame size={16} />}
            label="Лучший за 24ч"
            value={formatUsd(games.data?.maxWin24h)}
          />
        </div>
      )}
    </section>
  );
}

/* ── Recent games feed ─────────────────────────────────────────────────── */

const GAME_LABELS: Record<GameType, string> = {
  CASES: '🎁 Кейсы',
  FRUITS: '🎰 Слоты',
  COINFLIP: '🪙 Коинфлип',
  UPGRADER: '📈 Апгрейдер',
};

function gameLabel(type: GameType): string {
  return GAME_LABELS[type] ?? type;
}

function GameRow({ entry }: { entry: GameHistoryEntry }) {
  const win = Number(entry.result) >= Number(entry.bet);
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-fg">
          {entry.user.displayName}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {gameLabel(entry.gameType)} · {formatTime(entry.timestamp, 'relative')}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={`text-sm font-semibold ${win ? 'text-win' : 'text-lose'}`}
        >
          {formatUsd(entry.result)}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          ставка {formatUsd(entry.bet)}
        </p>
      </div>
    </li>
  );
}

function RecentGames() {
  const { user } = useAuth();

  const history = useQuery({
    queryKey: ['games', 'history', 'platform'],
    queryFn: () => api.get<GameHistoryEntry[]>('/games/history'),
    enabled: user != null,
    staleTime: 15_000,
  });

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
      ) : !history.data || history.data.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">
          Пока нет сыгранных игр
        </Card>
      ) : (
        <Card className="divide-y divide-edge overflow-hidden p-0">
          <ul>
            {history.data.map((entry) => (
              <GameRow key={entry.id} entry={entry} />
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

/* ── Games grid ────────────────────────────────────────────────────────── */

const GAMES: ReadonlyArray<{ emoji: string; name: string }> = [
  { emoji: '🎁', name: 'Кейсы' },
  { emoji: '🎰', name: 'Слоты' },
  { emoji: '🪙', name: 'Коинфлип' },
  { emoji: '📈', name: 'Апгрейдер' },
  { emoji: '🎟️', name: 'Лотерея' },
];

function GamesGrid() {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted">Игры</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {GAMES.map((game) => (
          <Card
            key={game.name}
            aria-disabled="true"
            className="flex cursor-not-allowed flex-col items-center gap-2 p-5 text-center opacity-70"
          >
            <span
              aria-hidden
              className="grid h-12 w-12 place-items-center rounded-xl border border-edge bg-panel-2 text-2xl"
            >
              {game.emoji}
            </span>
            <span className="text-sm font-medium text-fg">{game.name}</span>
            <span className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
              скоро
            </span>
          </Card>
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
      <RecentGames />
    </div>
  );
}
