// UploadButton — "Загрузить файл" backed by a hidden <input type=file>, with a real
// upload progress bar (percentage + uploaded/total bytes) and a Cancel button.
//
// Backed by useUpload (XHR-based, streams the File, reports progress, supports abort).
// While uploading, the picker is hidden behind a progress panel; on success a short
// confirmation shows, on error a friendly message with a retry affordance (re-pick).
// The new file appears automatically — useUpload invalidates the list + usage.

import { useRef } from 'react';
import { Upload, Check, X } from 'lucide-react';
import { errorMessage } from '@/shared/api/errors';
import Button from '@/shared/ui/Button';
import { formatBytes, useUpload } from './useDisk';

export default function UploadButton({ disabled }: { disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUpload();
  const uploading = upload.phase === 'uploading';

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Allow re-picking the same file: clear the value so a repeat selection re-fires.
    e.target.value = '';
    if (file) {
      upload.reset();
      upload.start(file);
    }
  }

  const pct = Math.round(upload.progress.fraction * 100);

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={onPick}
        disabled={disabled || uploading}
      />

      {uploading ? (
        <div className="rounded-xl border border-edge bg-panel-2 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-fg" title={upload.fileName ?? undefined}>
              {upload.fileName ?? 'Загрузка…'}
            </p>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-ton">{pct}%</span>
          </div>

          <div
            className="h-2 w-full overflow-hidden rounded-full border border-edge bg-panel"
            role="progressbar"
            aria-label="Прогресс загрузки"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div
              className="h-full rounded-full bg-ton-deep transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs tabular-nums text-muted">
              {formatBytes(upload.progress.loaded)}
              {upload.progress.total > 0 && <> из {formatBytes(upload.progress.total)}</>}
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={upload.cancel}>
              <X size={15} strokeWidth={2} />
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="self-start"
        >
          <Upload size={16} strokeWidth={2} />
          Загрузить файл
        </Button>
      )}

      {upload.phase === 'error' && (
        <p className="text-sm text-lose">
          {errorMessage(upload.error, 'Не удалось загрузить файл')}
        </p>
      )}
      {upload.phase === 'success' && (
        <p className="flex items-center gap-1.5 text-sm text-win">
          <Check size={15} strokeWidth={2} />
          Файл загружен
        </p>
      )}
    </div>
  );
}
