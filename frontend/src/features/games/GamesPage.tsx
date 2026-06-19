import { Link } from 'react-router-dom';
import { ArrowUpRight, Gamepad2 } from 'lucide-react';
import { GAME_META, LOTTERY_META } from '@/shared/lib/games';

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
}

const TILES: ReadonlyArray<LobbyTile> = [
  { to: '/games/cases', ...GAME_META.CASES, tagline: 'Открывай кейсы на приз' },
  { to: '/games/slots', ...GAME_META.FRUITS, tagline: 'Крути барабаны' },
  { to: '/games/coinflip', ...GAME_META.COINFLIP, tagline: 'Орёл или решка ×2' },
  { to: '/games/upgrader', ...GAME_META.UPGRADER, tagline: 'Рискни и приумножь' },
  { to: '/games/lottery', ...LOTTERY_META, tagline: 'Билеты и общий банк' },
];

function GameTile({ tile }: { tile: LobbyTile }) {
  return (
    <Link
      to={tile.to}
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
        {tile.emoji}
      </span>

      <div className="relative min-w-0 flex-1">
        <p className="truncate text-base font-semibold tracking-tight text-fg">
          {tile.name}
        </p>
        <p className="truncate text-sm text-muted">{tile.tagline}</p>
      </div>

      <ArrowUpRight
        size={18}
        aria-hidden
        className="relative shrink-0 text-muted transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ton"
      />
    </Link>
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
          <p className="text-sm text-muted">Выбери игру — все исходы проверяемы</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TILES.map((tile) => (
          <GameTile key={tile.to} tile={tile} />
        ))}
      </div>
    </div>
  );
}
