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
  rank: LevelName;
  /** Pixel diameter of the avatar. Defaults to 32. */
  size?: number;
  className?: string;
}

export default function RankBadge({ rank, size = 32, className }: RankBadgeProps) {
  return (
    <img
      src={PORTRAITS[rank]}
      alt={rank}
      title={rank}
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
