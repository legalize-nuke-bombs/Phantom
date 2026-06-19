import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Gamepad2 } from 'lucide-react';
import { api } from '@/shared/api/client';
import { GAME_META, LOTTERY_META } from '@/shared/lib/games';
import Amount from '@/shared/ui/Amount';
import CoinGlyph from '@/shared/ui/CoinGlyph';
import { useQuery } from '@tanstack/react-query';

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

/* ── lottery live status ──────────────────────────────────────────────────
   The lottery tile shows the *current* round's pot and a short countdown to the
   draw instead of a static tagline, so the lobby hints at live action. Only the
   essentials from CurrentLotteryRepresentation are typed here. */
interface CurrentLotteryLite {
  timestampEnd: number; // epoch SECONDS — when the draw fires
  costTotal: string; // USD decimal string — the whole pot
}

const LOTTERY_TAGLINE = 'Билеты и общий банк';

/** Compact "до розыгрыша Xм" / "Xс" countdown from seconds-remaining. */
function shortCountdown(secondsRemaining: number): string {
  const s = Math.max(0, Math.floor(secondsRemaining));
  if (s <= 0) return 'розыгрыш…';
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) return `до розыгрыша ${hours}ч ${minutes}м`;
  if (minutes > 0) return `до розыгрыша ${minutes}м ${seconds}с`;
  return `до розыгрыша ${seconds}с`;
}

/** Epoch-seconds "now", ticking once a second while mounted. */
function useNowSeconds(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/**
 * Live secondary line for the lottery tile: current pot + countdown to the draw.
 * Falls back to the static tagline while loading or whenever there is no active
 * round (404 between rounds, or any fetch error) so the tile never looks broken.
 */
function LotteryStatus() {
  const now = useNowSeconds();
  const { data } = useQuery<CurrentLotteryLite>({
    queryKey: ['lottery', 'current'],
    queryFn: () => api.get<CurrentLotteryLite>('/lottery/current'),
    refetchInterval: 15000,
    retry: false, // 404 mid-rotation is expected — don't hammer it
  });

  if (!data) {
    return <span className="truncate text-sm text-muted">{LOTTERY_TAGLINE}</span>;
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5 truncate text-sm text-muted">
      <span className="shrink-0">
        Банк <Amount value={data.costTotal} className="font-semibold" />
      </span>
      <span aria-hidden className="text-edge">
        ·
      </span>
      <span className="truncate text-ton">{shortCountdown(data.timestampEnd - now)}</span>
    </span>
  );
}

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

function LotteryTile() {
  return (
    <TileShell to="/games/lottery" icon={LOTTERY_META.emoji} name={LOTTERY_META.name}>
      <LotteryStatus />
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
          <p className="text-sm text-muted">Выбери игру — все исходы проверяемы</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TILES.map((tile) => (
          <GameTile key={tile.to} tile={tile} />
        ))}
        <LotteryTile />
      </div>
    </div>
  );
}
