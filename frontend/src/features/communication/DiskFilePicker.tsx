// DiskFilePicker — a modal that lets you attach files already in your cloud ("Облако")
// to a chat message. It reuses the disk data + UX wholesale:
//   • useDiskFiles      — the same cursor-paginated infinite query DiskPage uses,
//   • useInfiniteScroll — the same sentinel auto-pagination, plus a "Показать ещё" button,
//   • ImagePreview      — the same bomb-guarded thumbnail / type-glyph tile.
//
// MULTI-SELECT: tiles toggle into a local selection set (a ✓ overlay + ring marks a
// picked tile); a footer "Прикрепить (N)" confirms the whole batch back to the composer
// via onConfirm, which appends them all to its pending list. (The composer fans a
// multi-attachment send out into one message per file — the backend takes a single
// attachment per message.) onClose is the X / backdrop / Esc bail-out.
//
// Presentational over those hooks; it owns the modal chrome + the local selection. Rendered
// only while open (the parent conditionally mounts it).

import { useEffect, useState } from 'react';
import { Check, HardDrive, X } from 'lucide-react';
import clsx from 'clsx';

import { errorMessage } from '@/shared/api/errors';
import { ImagePreview } from '@/shared/media';
import Button from '@/shared/ui/Button';
import Spinner from '@/shared/ui/Spinner';
import { formatBytes, useDiskFiles, type DiskFile } from '@/features/disk/useDisk';
import { useInfiniteScroll } from '@/features/disk/useInfiniteScroll';

export default function DiskFilePicker({
  onConfirm,
  onClose,
}: {
  /** Called with every chosen file; the composer appends them to its pending list. */
  onConfirm: (files: DiskFile[]) => void;
  onClose: () => void;
}) {
  const files = useDiskFiles();
  const items = files.data?.pages.flat() ?? [];

  // Local multi-selection: file id → file. A Map keeps insertion order, so confirming
  // hands the files back in the order they were tapped.
  const [selected, setSelected] = useState<Map<string, DiskFile>>(new Map());

  function toggle(file: DiskFile) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(file.id)) next.delete(file.id);
      else next.set(file.id, file);
      return next;
    });
  }

  function confirm() {
    if (selected.size === 0) return;
    onConfirm([...selected.values()]);
    onClose();
  }

  // Same infinite-scroll wiring as DiskPage: fetch the next page when the sentinel shows.
  const canLoadMore = files.hasNextPage && !files.isFetchingNextPage;
  const sentinelRef = useInfiniteScroll<HTMLDivElement>(() => files.fetchNextPage(), canLoadMore);

  // Esc closes; lock body scroll while the modal is up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-label="Выбрать файл из облака"
      onClick={onClose}
    >
      {/* Stop propagation so clicks inside the panel don't close it. */}
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-edge bg-panel shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-edge px-4">
          <div className="flex items-center gap-2 text-fg">
            <HardDrive size={18} strokeWidth={2} className="text-ton" />
            <h2 className="text-sm font-semibold">Из облака</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="text-muted transition-colors hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ton"
          >
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {files.isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner size={24} />
            </div>
          ) : files.isError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-lose">{errorMessage(files.error, 'Не удалось загрузить файлы')}</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => files.refetch()}>
                Повторить
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <HardDrive size={26} className="text-muted" />
              <p className="text-sm font-medium text-fg">В облаке пока пусто</p>
              <p className="text-xs text-muted">Загрузите файл в облаке, чтобы прикрепить его</p>
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {items.map((file) => {
                  const isSelected = selected.has(file.id);
                  return (
                    <li key={file.id}>
                      <button
                        type="button"
                        onClick={() => toggle(file)}
                        title={file.name}
                        aria-pressed={isSelected}
                        className={clsx(
                          'group relative flex w-full flex-col overflow-hidden rounded-xl border bg-panel text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ton',
                          isSelected ? 'border-ton ring-2 ring-ton' : 'border-edge hover:border-ton',
                        )}
                      >
                        <span className="block aspect-square w-full border-b border-edge">
                          <ImagePreview file={{ id: file.id, name: file.name, size: file.size }} glyphSize={30} />
                        </span>
                        {/* Selection check — a filled badge in the corner of a picked tile. */}
                        <span
                          className={clsx(
                            'absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full border transition-colors',
                            isSelected
                              ? 'border-ton bg-ton-deep text-white'
                              : 'border-edge bg-panel/80 text-transparent',
                          )}
                          aria-hidden
                        >
                          {isSelected ? <Check size={14} strokeWidth={3} /> : null}
                        </span>
                        <span className="min-w-0 px-2 py-1.5">
                          <span className="block truncate text-xs font-medium text-fg">{file.name}</span>
                          <span className="block text-[11px] tabular-nums text-muted">
                            {formatBytes(file.size)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Sentinel + manual fallback — identical to DiskPage's pattern. */}
              {files.hasNextPage ? (
                <div ref={sentinelRef} className="mt-4 flex justify-center">
                  {files.isFetchingNextPage ? (
                    <Spinner size={22} />
                  ) : (
                    <Button type="button" variant="ghost" size="sm" onClick={() => files.fetchNextPage()}>
                      Показать ещё
                    </Button>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Confirm footer — appears once there are tiles to pick. The button carries the
            running count and stays disabled until at least one file is selected. */}
        {!files.isLoading && !files.isError && items.length > 0 ? (
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-edge px-4 py-3">
            <span className="text-xs tabular-nums text-muted">
              {selected.size > 0 ? `Выбрано: ${selected.size}` : 'Выберите файлы'}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Отмена
              </Button>
              <Button type="button" size="sm" onClick={confirm} disabled={selected.size === 0}>
                Прикрепить{selected.size > 0 ? ` (${selected.size})` : ''}
              </Button>
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
