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
// Pass `withUser` to lead with the player (the home feed, across many players): the
// leading icon is the player's rank avatar (RankBadge, via `level`) and the primary
// line their name, with the game name on the metadata line. Omit it for a single user's
// own history, where the game glyph leads (the blue brand coin for coinflip, its emoji
// otherwise) and the game name is the primary line.

import { Link } from 'react-router-dom';

import { gameMeta } from '@/shared/lib/games';
import { formatTime } from '@/shared/lib/time';
import { formatUsd } from '@/shared/lib/money';
import type { GameHistoryEntry, LevelName } from '@/shared/types';
import Amount from '@/shared/ui/Amount';
import CoinGlyph from '@/shared/ui/CoinGlyph';
import RankBadge from '@/shared/ui/RankBadge';

interface GameHistoryRowProps {
  entry: GameHistoryEntry;
  /**
   * Lead the row with the player (the platform feed): the leading icon is the player's
   * rank avatar and the primary line their name, with the game name on the metadata line.
   * Omit on an own-profile history, where the game glyph leads and its name is primary.
   */
  withUser?: boolean;
  /** The player's rank — drives the feed avatar (withUser). Omit on own-history. */
  level?: LevelName | null;
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

export default function GameHistoryRow({ entry, withUser = false, level }: GameHistoryRowProps) {
  const meta = gameMeta(entry.gameType);
  const time = formatTime(entry.timestamp, 'relative');

  return (
    <li className="flex items-center gap-3 py-3">
      {/* Leading icon: the player's rank avatar on the feed, the game glyph on own-history. */}
      {withUser ? (
        <Link to={`/u/${entry.user.id}`} className="shrink-0">
          <RankBadge level={level} size={36} />
        </Link>
      ) : (
        <GameGlyph entry={entry} />
      )}

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
