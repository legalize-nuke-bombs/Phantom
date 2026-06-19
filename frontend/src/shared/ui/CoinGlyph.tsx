// CoinGlyph — a small blue coin token that matches the in-game coinflip coin, so
// the coinflip icon reads blue (in keeping with the app) instead of a gold emoji.
// Scalable; the diamond emblem scales with the disc.

import clsx from 'clsx';

export default function CoinGlyph({
  size = 28,
  className,
}: {
  /** Diameter in px. */
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={clsx('grid shrink-0 place-items-center rounded-full', className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.5),
        lineHeight: 1,
        background:
          'radial-gradient(circle at 34% 28%, #aef0ff 0%, #4cc4ff 30%, #149bf0 62%, #0a73c4 100%)',
        boxShadow:
          'inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -2px 4px rgba(0,0,0,0.45)',
      }}
    >
      💎
    </span>
  );
}
