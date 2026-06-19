import { useQuery } from '@tanstack/react-query';
import {
  Package,
  Cherry,
  Coins,
  ArrowUpNarrowWide,
  Ticket,
  Wallet as WalletIcon,
  Sparkles,
  History,
} from 'lucide-react';
import { api } from '@/shared/api/client';
import { useAuth } from '@/shared/auth/AuthContext';
import type { Experience, Wallet, LevelName } from '@/shared/types';
import Card from '@/shared/ui/Card';
import RankBadge from '@/shared/ui/RankBadge';
import Spinner from '@/shared/ui/Spinner';

function formatBalance(balance: string | undefined): string {
  if (balance == null) return '—';
  const n = Number(balance);
  if (Number.isNaN(n)) return balance;
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

function Greeting({
  displayName,
  rank,
}: {
  displayName: string;
  rank: LevelName | null;
}) {
  return (
    <section className="flex items-center gap-3">
      {rank ? (
        <RankBadge rank={rank} size={48} />
      ) : (
        <span className="grid h-12 w-12 place-items-center rounded-full border border-edge bg-panel-2 text-ice">
          <Sparkles size={22} strokeWidth={1.75} />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm text-muted">С возвращением,</p>
        <h1 className="truncate text-xl font-semibold tracking-tight text-fg sm:text-2xl">
          {displayName || 'игрок'}
        </h1>
      </div>
    </section>
  );
}

function BalanceCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['wallet', 'me'],
    queryFn: () => api.get<Wallet>('/wallets/me'),
    staleTime: 30_000,
  });

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-2 text-muted">
        <WalletIcon size={16} />
        <span className="text-sm">Баланс</span>
      </div>

      <div className="mt-3 min-h-[2.5rem]">
        {isLoading ? (
          <Spinner size={22} />
        ) : isError ? (
          <p className="text-sm text-muted">Не удалось загрузить баланс</p>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-fg">
              {formatBalance(data?.balance)}
            </span>
            <span className="text-sm font-medium text-ton">TON</span>
          </div>
        )}
      </div>
    </Card>
  );
}

interface GameTile {
  name: string;
  icon: typeof Package;
}

const GAMES: GameTile[] = [
  { name: 'Кейсы', icon: Package },
  { name: 'Слоты', icon: Cherry },
  { name: 'Коинфлип', icon: Coins },
  { name: 'Апгрейдер', icon: ArrowUpNarrowWide },
  { name: 'Лотерея', icon: Ticket },
];

function GameCard({ game }: { game: GameTile }) {
  const Icon = game.icon;
  return (
    <Card
      aria-disabled="true"
      className="flex cursor-not-allowed flex-col items-center gap-3 p-6 text-center opacity-70"
    >
      <span className="grid h-12 w-12 place-items-center rounded-xl border border-edge bg-panel-2 text-ton">
        <Icon size={24} strokeWidth={1.75} />
      </span>
      <span className="text-sm font-medium text-fg">{game.name}</span>
      <span className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
        скоро
      </span>
    </Card>
  );
}

function GamesGrid() {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted">Игры</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((game) => (
          <GameCard key={game.name} game={game} />
        ))}
      </div>
    </section>
  );
}

function RecentActivity() {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted">Последние действия</h2>
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-edge bg-panel-2 text-muted">
          <History size={20} />
        </span>
        <p className="text-sm text-muted">Здесь появится история ваших игр</p>
      </Card>
    </section>
  );
}

export default function HomePage() {
  const { user } = useAuth();

  const experience = useQuery({
    queryKey: ['experience', user?.id],
    queryFn: () => api.get<Experience>(`/experience/${user!.id}`),
    enabled: user?.id != null,
    staleTime: 30_000,
  });

  const rank: LevelName | null = experience.data?.level?.name ?? null;

  return (
    <div className="space-y-8">
      <Greeting displayName={user?.displayName ?? ''} rank={rank} />
      <BalanceCard />
      <GamesGrid />
      <RecentActivity />
    </div>
  );
}
