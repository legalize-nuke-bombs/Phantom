// GameHistoryRow — THE single row for a played game, shared by the platform feed
// (home) and a user's own history (profile), so the two never drift apart.
//
// Design: ONE number does the talking. The payout is the big, magnitude-coloured
// <Amount>; the stake rides under it as a faint caption, present but unobtrusive —
// never a second number competing for attention. The left side is a calm icon +
// primary line + muted metadata, not a crammed cluster:
//
//   ┌──┐  Primary line              $123.45   ← payout, colour-by-size
//   │🎮│  muted metadata · time     ставка $5 ← faint, tucked beneath
//   └──┘
//
// The icon is the game's emoji, EXCEPT coinflip, which renders the blue brand coin
// (CoinGlyph) so it reads blue app-wide instead of the gold 🪙.
//
// Pass `user` to lead with the player (the home feed, across many players); omit it
// for a single user's own history, where the game name becomes the primary line. The
// player's name links to their profile but carries NO rank avatar here — the game
// glyph is the row's only icon, which keeps the line uncluttered.

import { Link } from 'react-router-dom';

import { gameMeta } from '@/shared/lib/games';
import { formatTime } from '@/shared/lib/time';
import { formatUsd } from '@/shared/lib/money';
import type { GameHistoryEntry } from '@/shared/types';
import Amount from '@/shared/ui/Amount';
import CoinGlyph from '@/shared/ui/CoinGlyph';

interface GameHistoryRowProps {
  entry: GameHistoryEntry;
  /**
   * Lead the row with the player (the platform feed). The primary line becomes the
   * player's name and the game name drops to the metadata line. Omit on an own-profile
   * history, where the game name is the primary line and there's no player to show.
   */
  withUser?: boolean;
}

/** The game's glyph — the blue brand coin for coinflip, its emoji otherwise. */
function GameGlyph({ entry }: { entry: GameHistoryEntry }) {
  const meta = gameMeta(entry.gameType);
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-panel-2 border border-edge">
      {entry.gameType === 'COINFLIP' ? (
        <CoinGlyph size={20} />
      ) : (
        <span aria-hidden className="text-base leading-none">
          {meta.emoji}
        </span>
      )}
    </span>
  );
}

export default function GameHistoryRow({ entry, withUser = false }: GameHistoryRowProps) {
  const meta = gameMeta(entry.gameType);
  const time = formatTime(entry.timestamp, 'relative');

  return (
    <li className="flex items-center gap-3 py-3">
      <GameGlyph entry={entry} />

      {/* Primary line + muted metadata. The player leads on the feed; otherwise the
          game name does. The secondary line stays quiet — that's the decluttering. */}
      <div className="min-w-0 flex-1">
        {withUser ? (
          <>
            <Link
              to={`/u/${entry.user.id}`}
              className="block truncate text-sm font-medium text-fg transition-colors hover:text-ton"
            >
              {entry.user.displayName}
            </Link>
            <p className="mt-0.5 truncate text-xs text-muted">
              {meta.name} · {time}
            </p>
          </>
        ) : (
          <>
            <p className="truncate text-sm font-medium text-fg">{meta.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted">{time}</p>
          </>
        )}
      </div>

      {/* The one number that matters — big and colour-coded by size — with the stake
          tucked beneath it as a faint caption, deliberately almost invisible. */}
      <div className="flex shrink-0 flex-col items-end leading-tight">
        <Amount value={entry.result} className="text-base font-semibold tabular-nums" />
        <span className="text-[11px] tabular-nums text-muted/50">
          ставка {formatUsd(entry.bet)}
        </span>
      </div>
    </li>
  );
}
