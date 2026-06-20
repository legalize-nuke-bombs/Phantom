import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Gamepad2 } from 'lucide-react';
import { GAME_META } from '@/shared/lib/games';
import CoinGlyph from '@/shared/ui/CoinGlyph';
import LotteryStatusCard from '@/features/lottery/LotteryStatusCard';

/**
 * A lobby tile: a game's emoji + Russian name (from the shared presentation
 * source so it stays consistent app-wide) paired with its route and a short
 * Russian tagline. Routes live here because navigation is this page's concern —
 * adding a backend game is one new entry, and the `to` targets must match the
 * lazy child routes registered in app/router.tsx.
 */
interface LobbyTile {
  to: string;
  emoji: string;
  name: string;
  tagline: string;
  /** Optional custom icon node — overrides the emoji (e.g. the blue coinflip coin). */
  icon?: ReactNode;
}

const TILES: ReadonlyArray<LobbyTile> = [
  { to: '/games/cases', ...GAME_META.CASES, tagline: 'Открывай кейсы на приз' },
  { to: '/games/slots', ...GAME_META.FRUITS, tagline: 'Крути барабаны' },
  {
    to: '/games/coinflip',
    ...GAME_META.COINFLIP,
    icon: <CoinGlyph size={30} />,
    tagline: 'Герб или цифра ×1.8',
  },
  { to: '/games/upgrader', ...GAME_META.UPGRADER, tagline: 'Рискни и приумножь' },
];

/** The visual shell shared by every tile (icon, title, secondary line, arrow). */
function TileShell({
  to,
  icon,
  name,
  children,
}: {
  to: string;
  icon: ReactNode;
  name: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group relative flex items-center gap-4 overflow-hidden rounded-xl border border-edge bg-panel p-4 transition-colors hover:border-ton/50 hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ton/60"
    >
      {/* spectral glow that warms on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-ton/10 opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
      />

      <span
        aria-hidden
        className="relative grid size-14 shrink-0 place-items-center rounded-xl border border-edge bg-panel-2 text-3xl transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105"
      >
        {icon}
      </span>

      <div className="relative min-w-0 flex-1">
        <p className="truncate text-base font-semibold tracking-tight text-fg">{name}</p>
        {children}
      </div>

      <ArrowUpRight
        size={18}
        aria-hidden
        className="relative shrink-0 text-muted transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ton"
      />
    </Link>
  );
}

function GameTile({ tile }: { tile: LobbyTile }) {
  return (
    <TileShell to={tile.to} icon={tile.icon ?? tile.emoji} name={tile.name}>
      <p className="truncate text-sm text-muted">{tile.tagline}</p>
    </TileShell>
  );
}

export default function GamesPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-ton">
          <Gamepad2 size={22} />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            Игры
          </h1>
          <p className="text-sm text-muted">Выбери игру</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TILES.map((tile) => (
          <GameTile key={tile.to} tile={tile} />
        ))}
      </div>

      <LotteryStatusCard />
    </div>
  );
}
