import { Gamepad2 } from 'lucide-react';
import { GAME_META, LOTTERY_META } from '@/shared/lib/games';
import type { GameMeta } from '@/shared/lib/games';
import Card from '@/shared/ui/Card';

// Everything playable on the platform, drawn from the shared presentation source so
// emoji/labels stay consistent app-wide (Кейсы → 📦). The lottery is appended
// because it lives outside GAME_META (it is not a GameType on the backend).
const GAMES: ReadonlyArray<GameMeta> = [...Object.values(GAME_META), LOTTERY_META];

function GameCard({ game }: { game: GameMeta }) {
  return (
    <Card
      aria-disabled="true"
      className="flex cursor-not-allowed items-center gap-3 p-4 opacity-70"
    >
      <span
        aria-hidden
        className="grid size-12 shrink-0 place-items-center rounded-xl border border-edge bg-panel-2 text-2xl"
      >
        {game.emoji}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-fg">{game.name}</p>
        <span className="text-[10px] uppercase tracking-wide text-muted">скоро</span>
      </div>
    </Card>
  );
}

export default function GamesPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-ton">
          <Gamepad2 size={22} />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            Игры
          </h1>
          <p className="text-sm text-muted">Скоро здесь можно будет играть</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {GAMES.map((game) => (
          <GameCard key={game.name} game={game} />
        ))}
      </div>
    </div>
  );
}
