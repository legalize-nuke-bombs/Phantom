// FileCard — one stored file as a grid card: an image thumbnail (via the shared,
// bomb-guarded ImagePreview) for images or a type glyph otherwise, then the name,
// human size, date, and the two per-file actions (download / inline-confirm delete).
//
// Delete uses a two-step inline confirm (the footer swaps to "Удалить? · Да / Отмена")
// instead of a modal — lighter on mobile, keeps the destructive tap deliberate. Both
// actions are owned by the parent via callbacks; this component is presentational +
// local confirm state.

import { useState } from 'react';
import { Download, Trash2, Paperclip } from 'lucide-react';
import clsx from 'clsx';
import Spinner from '@/shared/ui/Spinner';
import { formatTime } from '@/shared/lib/time';
import { ImagePreview } from '@/shared/media';
import { formatBytes, type DiskFile } from './useDisk';

export default function FileCard({
  file,
  refs,
  onDownload,
  onDelete,
  downloading,
  deleting,
  busy,
}: {
  file: DiskFile;
  /** How many chat messages reference this file — shown so deleting it is an informed choice. */
  refs?: number;
  onDownload: () => void;
  onDelete: () => void;
  /** This card's download is in flight. */
  downloading: boolean;
  /** This card's delete is in flight. */
  deleting: boolean;
  /** Some other card's action is in flight — disable this card's buttons. */
  busy: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const disabled = busy || downloading || deleting;

  return (
    <li className="group flex flex-col overflow-hidden rounded-xl border border-edge bg-panel">
      {/* preview — fixed square; ImagePreview shows the thumbnail or a type glyph */}
      <div className="aspect-square w-full border-b border-edge">
        <ImagePreview file={{ id: file.id, name: file.name, size: file.size }} glyphSize={34} />
      </div>

      {/* meta */}
      <div className="min-w-0 px-3 pt-2.5">
        <p className="truncate text-sm font-medium text-fg" title={file.name}>
          {file.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          <span className="tabular-nums">{formatBytes(file.size)}</span>
          <span className="px-1.5">·</span>
          {formatTime(file.timestamp, 'short')}
        </p>
        {refs != null && refs > 0 && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
            <Paperclip size={11} strokeWidth={2} className="shrink-0" />в {refs}{' '}
            {refs === 1 ? 'сообщении' : 'сообщениях'}
          </p>
        )}
      </div>

      {/* actions */}
      <div className="mt-2 px-3 pb-3">
        {confirming ? (
          <div className="flex flex-col gap-1.5">
            {refs != null && refs > 0 && (
              <p className="text-xs leading-snug text-warn">
                Файл в {refs} {refs === 1 ? 'сообщении' : 'сообщениях'} — при удалении пропадёт{' '}
                {refs === 1 ? 'из него' : 'из них'}.
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
              <span className="mr-auto truncate text-xs text-muted">Удалить?</span>
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className={clsx(
                  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-lose/30 bg-lose/15 px-2.5 text-xs font-medium text-lose',
                  'transition-colors hover:bg-lose/25 disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                {deleting ? <Spinner size={13} /> : null}
                Да
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="inline-flex h-8 items-center rounded-lg border border-edge px-2.5 text-xs font-medium text-fg transition-colors hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={onDownload}
              disabled={disabled}
              aria-label={`Скачать ${file.name}`}
              title="Скачать"
              className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ton disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloading ? <Spinner size={15} /> : <Download size={16} strokeWidth={2} />}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={disabled}
              aria-label={`Удалить ${file.name}`}
              title="Удалить"
              className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-lose/15 hover:text-lose focus:outline-none focus-visible:ring-2 focus-visible:ring-lose disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={16} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
