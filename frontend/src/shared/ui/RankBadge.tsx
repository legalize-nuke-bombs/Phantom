import clsx from 'clsx';
import type { LevelName } from '@/shared/types';

import wisp from '@/assets/levels/Wisp.jpg';
import whisper from '@/assets/levels/Whisper.jpg';
import echo from '@/assets/levels/Echo.jpg';
import shade from '@/assets/levels/Shade.jpg';
import spectre from '@/assets/levels/Spectre.jpg';
import phantom from '@/assets/levels/Phantom.jpg';
import revenant from '@/assets/levels/Revenant.jpg';
import reaper from '@/assets/levels/Reaper.jpg';

const PORTRAITS: Record<LevelName, string> = {
  Wisp: wisp,
  Whisper: whisper,
  Echo: echo,
  Shade: shade,
  Spectre: spectre,
  Phantom: phantom,
  Revenant: revenant,
  Reaper: reaper,
};

interface RankBadgeProps {
  /**
   * The user's rank. A known LevelName shows its portrait; null/undefined (the
   * level is unknown — e.g. the user hid their experience) shows a fallback glyph.
   */
  level: LevelName | null | undefined;
  /** Pixel diameter of the avatar. Defaults to 32. */
  size?: number;
  className?: string;
}

export default function RankBadge({ level, size = 32, className }: RankBadgeProps) {
  if (level == null) {
    // Unknown rank — hidden experience or no record. Neutral hollow-diamond chip.
    return (
      <span
        title="Ранг скрыт"
        aria-label="Ранг скрыт"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
        className={clsx(
          'inline-grid shrink-0 place-items-center rounded-full bg-panel-2',
          'border border-edge ring-1 ring-ton/30 text-muted leading-none',
          className,
        )}
      >
        ◇
      </span>
    );
  }

  return (
    <img
      src={PORTRAITS[level]}
      alt={level}
      title={level}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={clsx(
        'rounded-full object-cover border border-edge ring-1 ring-ton/30',
        className,
      )}
    />
  );
}
