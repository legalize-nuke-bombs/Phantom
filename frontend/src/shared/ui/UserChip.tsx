import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { LevelName, ShortUser, User } from '@/shared/types';
import RankBadge from '@/shared/ui/RankBadge';

interface UserChipProps {
  /** Either the short or full user shape — both carry id + displayName. */
  user: ShortUser | User;
  /**
   * The user's rank, supplied by the caller (e.g. from useExperienceBatch +
   * levelFor). null/undefined renders the fallback glyph on the badge.
   */
  level?: LevelName | null;
  /** Avatar diameter in px. Defaults to 24 — compact for inline use in lists/feeds. */
  size?: number;
  /** Link the avatar + name to the user's profile. Defaults to true. */
  link?: boolean;
  className?: string;
}

/**
 * THE standard way to render a user inline anywhere — feeds, lists, chat, game
 * rows. Avatar (RankBadge) + display name, compact and optionally linked to the
 * profile at /u/{id}.
 */
export default function UserChip({
  user,
  level,
  size = 24,
  link = true,
  className,
}: UserChipProps) {
  const badge = <RankBadge level={level} size={size} />;
  const name = <span className="truncate">{user.displayName}</span>;

  if (link === false) {
    return (
      <span className={clsx('inline-flex min-w-0 items-center gap-2 text-fg', className)}>
        {badge}
        {name}
      </span>
    );
  }

  return (
    <Link
      to={`/u/${user.id}`}
      className={clsx('group inline-flex min-w-0 items-center gap-2', className)}
    >
      {badge}
      <span className="truncate text-muted transition-colors group-hover:text-fg">
        {user.displayName}
      </span>
    </Link>
  );
}
