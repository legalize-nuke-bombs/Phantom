// UploadButton — "Загрузить файлы" backed by a hidden <input type=file multiple>, a
// drag-and-drop zone, and a live upload QUEUE.
//
// Multi-select (or multi-drop) enqueues files; they upload STRICTLY SEQUENTIALLY — one
// request in flight at a time (the backend takes a single file per request). Each queue
// row shows name, size, and status: в очереди / загрузка с % + отмена / готово / ошибка.
// A failed file does not stop the rest. The current upload can be cancelled and the
// remaining queued items cleared.
//
// Backed by useBatchUpload (sequential XHR uploader; multipart, useImageCompression=false).
// After each successful upload the list + usage are invalidated, so the grid fills in as
// the queue drains.

import { useRef, useState } from 'react';
import { Upload, Check, X, AlertCircle, Clock } from 'lucide-react';
import clsx from 'clsx';
import { errorMessage } from '@/shared/api/errors';
import Button from '@/shared/ui/Button';
import Spinner from '@/shared/ui/Spinner';
import {
  formatBytes,
  useBatchUpload,
  type BatchUploadItem,
} from './useDisk';

/* ── one queue row ─────────────────────────────────────────────────────────── */
function QueueRow({
  item,
  onCancel,
}: {
  item: BatchUploadItem;
  onCancel: () => void;
}) {
  const pct = Math.round(item.progress.fraction * 100);
  const uploading = item.status === 'uploading';
  const queued = item.status === 'queued';

  return (
    <li className="rounded-xl border border-edge bg-panel-2 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* status glyph */}
          {item.status === 'done' && <Check size={15} strokeWidth={2.25} className="shrink-0 text-win" />}
          {item.status === 'error' && (
            <AlertCircle size={15} strokeWidth={2.25} className="shrink-0 text-lose" />
          )}
          {item.status === 'cancelled' && <X size={15} strokeWidth={2.25} className="shrink-0 text-muted" />}
          {queued && <Clock size={15} strokeWidth={2.25} className="shrink-0 text-muted" />}
          {uploading && <Spinner size={15} className="shrink-0 text-ton" />}

          <p className="min-w-0 flex-1 truncate text-sm font-medium text-fg" title={item.name}>
            {item.name}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {uploading && (
            <span className="text-sm font-semibold tabular-nums text-ton">{pct}%</span>
          )}
          {(uploading || queued) && (
            <button
              type="button"
              onClick={onCancel}
              aria-label={`Отменить ${item.name}`}
              title="Отмена"
              className="grid size-7 place-items-center rounded-lg text-muted transition-colors hover:bg-panel hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ton"
            >
              <X size={15} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* progress bar — only while uploading */}
      {uploading && (
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full border border-edge bg-panel"
          role="progressbar"
          aria-label={`Прогресс загрузки ${item.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div
            className="h-full rounded-full bg-ton-deep transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* footer line: size / progress bytes / status text */}
      <div className="mt-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="tabular-nums text-muted">
          {uploading ? (
            <>
              {formatBytes(item.progress.loaded)}
              {item.progress.total > 0 && <> из {formatBytes(item.progress.total)}</>}
            </>
          ) : (
            formatBytes(item.size)
          )}
        </span>
        <span
          className={clsx(
            'shrink-0 font-medium',
            item.status === 'done' && 'text-win',
            item.status === 'error' && 'text-lose',
            (queued || item.status === 'cancelled') && 'text-muted',
            uploading && 'text-ton',
          )}
        >
          {queued && 'В очереди'}
          {uploading && 'Загрузка…'}
          {item.status === 'done' && 'Готово'}
          {item.status === 'cancelled' && 'Отменено'}
          {item.status === 'error' && errorMessage(item.error, 'Ошибка')}
        </span>
      </div>
    </li>
  );
}

/* ── button + queue panel ──────────────────────────────────────────────────── */
export default function UploadButton({ disabled }: { disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const batch = useBatchUpload();
  const [dragOver, setDragOver] = useState(false);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    // Snapshot into a real array BEFORE clearing the input: e.target.files is a LIVE FileList,
    // and setting value='' empties it — so reading it afterwards yields nothing (which is why
    // picking files silently did nothing). Copy first, THEN reset so re-picking the same files
    // still re-fires onChange.
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length > 0) batch.enqueue(files);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) batch.enqueue(files);
  }

  function onDragOver(e: React.DragEvent) {
    // Required to allow a drop; also flag the hover state.
    e.preventDefault();
    if (!disabled) setDragOver(true);
  }

  const { items, counts, isUploading } = batch;
  const hasFinished = items.some(
    (it) => it.status === 'done' || it.status === 'error' || it.status === 'cancelled',
  );
  const hasQueued = counts.queued > 0;

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onPick}
        disabled={disabled}
      />

      {/* drop zone + pick button */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setDragOver(false)}
        className={clsx(
          'flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center transition-colors',
          dragOver ? 'border-ton bg-ton/5' : 'border-edge bg-panel-2/40',
          disabled && 'opacity-50',
        )}
      >
        <Upload size={22} className={dragOver ? 'text-ton' : 'text-muted'} strokeWidth={2} />
        <p className="text-sm text-muted">
          Перетащите файлы сюда или выберите несколько за раз
        </p>
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <Upload size={16} strokeWidth={2} />
          Загрузить файлы
        </Button>
      </div>

      {/* queue */}
      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Очередь · {counts.done}/{counts.total}
              {counts.error > 0 && (
                <span className="text-lose"> · ошибок: {counts.error}</span>
              )}
            </p>
            <div className="flex items-center gap-1.5">
              {hasQueued && (
                <Button type="button" size="sm" variant="ghost" onClick={batch.clearQueued}>
                  Очистить очередь
                </Button>
              )}
              {hasFinished && !isUploading && !hasQueued && (
                <Button type="button" size="sm" variant="ghost" onClick={batch.reset}>
                  Скрыть
                </Button>
              )}
              {hasFinished && (isUploading || hasQueued) && (
                <Button type="button" size="sm" variant="ghost" onClick={batch.clearFinished}>
                  Убрать завершённые
                </Button>
              )}
            </div>
          </div>

          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <QueueRow
                key={item.id}
                item={item}
                onCancel={() => batch.cancelItem(item.id)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
