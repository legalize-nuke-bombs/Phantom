// UploadButton — "Загрузить файлы" backed by a hidden <input type=file multiple> and a
// drag-and-drop zone. Multi-select (or multi-drop) uploads files STRICTLY SEQUENTIALLY —
// one request at a time (the backend takes a single file per request).
//
// Built for LARGE batches (1000+ files): there is NO per-file list. While a run is active we
// show ONE temporary widget — the file currently streaming + an overall "Загружено X из Y"
// counter — and nothing lingers for finished files. A failed file doesn't stop the rest; if
// any failed, a small dismissible note shows the count once the run ends.

import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import clsx from 'clsx';
import Button from '@/shared/ui/Button';
import Spinner from '@/shared/ui/Spinner';
import { useBatchUpload } from './useDisk';

export default function UploadButton({ disabled }: { disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const batch = useBatchUpload();
  const [dragOver, setDragOver] = useState(false);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    // Snapshot before clearing: e.target.files is a LIVE FileList, and value='' empties it.
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
    e.preventDefault();
    if (!disabled) setDragOver(true);
  }

  const { current, total, done, errors, isUploading } = batch;
  const pct = current ? Math.round(current.progress.fraction * 100) : 0;

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

      {isUploading ? (
        // ONE temporary widget: the file currently streaming + the overall counter. No
        // per-file list, nothing kept for finished files — this is all the run ever shows.
        <div className="rounded-xl border border-edge bg-panel-2 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Spinner size={16} className="shrink-0 text-ton" />
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-fg" title={current?.name}>
              {current?.name ?? 'Загрузка…'}
            </p>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-ton">{pct}%</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full border border-edge bg-panel"
            role="progressbar"
            aria-label="Прогресс текущего файла"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div
              className="h-full rounded-full bg-ton-deep transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs">
            <span className="tabular-nums text-muted">
              Загружено {done} из {total}
              {errors > 0 ? <span className="text-lose"> · ошибок: {errors}</span> : null}
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={batch.cancelAll}>
              <X size={15} strokeWidth={2} />
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        // Idle: the drop zone + pick button.
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
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={disabled}>
            <Upload size={16} strokeWidth={2} />
            Загрузить файлы
          </Button>
        </div>
      )}

      {/* After a finished run: a small dismissible note ONLY if something failed. Successful
          uploads leave no trace (no per-file "Готово" rows). */}
      {!isUploading && errors > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-lose/40 bg-lose/10 p-3">
          <p className="text-sm text-lose">
            Не удалось загрузить {errors} из {total}
          </p>
          <Button type="button" size="sm" variant="ghost" onClick={batch.dismiss}>
            Скрыть
          </Button>
        </div>
      ) : null}
    </div>
  );
}
