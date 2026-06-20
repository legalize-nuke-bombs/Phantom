// QuotaBar — a compact "used / total" storage meter for the disk page.
//
// `total` may be undefined (settings not yet loaded / unavailable), in which case
// we degrade to showing just the used size with no bar — DiskPage decides the copy.
// The bar tints toward `text-lose` as the user approaches the ceiling so a near-full
// disk reads as a warning without being alarming.

import clsx from 'clsx';
import { HardDrive } from 'lucide-react';
import { formatBytes } from './useDisk';

export default function QuotaBar({
  used,
  total,
  files,
  maxFiles,
}: {
  used: number;
  total: number | undefined;
  files: number;
  maxFiles?: number;
}) {
  const hasTotal = total != null && total > 0;
  const pct = hasTotal ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;

  // Colour the fill by fullness: calm under 75%, amber 75–90%, red above.
  const fill =
    pct >= 90 ? 'bg-lose' : pct >= 75 ? 'bg-warn' : 'bg-ton-deep';

  return (
    <div className="rounded-xl border border-edge bg-panel-2 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted">
          <HardDrive size={15} strokeWidth={2} />
          <span className="text-xs font-medium uppercase tracking-wide">Хранилище</span>
        </div>
        <span className="text-xs text-muted">
          {maxFiles != null ? `${files} / ${maxFiles} файлов` : `${files} файлов`}
        </span>
      </div>

      <p className="text-sm text-fg">
        <span className="font-semibold tabular-nums">{formatBytes(used)}</span>
        {hasTotal && (
          <span className="text-muted"> из {formatBytes(total)}</span>
        )}
      </p>

      {hasTotal && (
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-panel border border-edge"
          role="progressbar"
          aria-label="Использование хранилища"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
        >
          <div
            className={clsx('h-full rounded-full transition-[width] duration-500', fill)}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
