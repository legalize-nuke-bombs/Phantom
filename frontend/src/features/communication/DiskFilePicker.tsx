// DiskFilePicker — a modal that lets you attach a file already in your cloud ("Облако")
// to a chat message. It reuses the disk data + UX wholesale:
//   • useDiskFiles      — the same cursor-paginated infinite query DiskPage uses,
//   • useInfiniteScroll — the same sentinel auto-pagination, plus a "Показать ещё" button,
//   • ImagePreview      — the same bomb-guarded thumbnail / type-glyph tile.
// Selecting a tile hands the file back to the composer as the pending attachment.
//
// Presentational over those hooks; it owns nothing but the modal chrome and the click →
// onSelect wiring. Rendered only while open (the parent conditionally mounts it).

import { useEffect } from 'react';
import { HardDrive, X } from 'lucide-react';

import { errorMessage } from '@/shared/api/errors';
import { ImagePreview } from '@/shared/media';
import Button from '@/shared/ui/Button';
import Spinner from '@/shared/ui/Spinner';
import { formatBytes, useDiskFiles, type DiskFile } from '@/features/disk/useDisk';
import { useInfiniteScroll } from '@/features/disk/useInfiniteScroll';

export default function DiskFilePicker({
  onSelect,
  onClose,
}: {
  /** Called with the chosen file; the composer holds it as the pending attachment. */
  onSelect: (file: DiskFile) => void;
  onClose: () => void;
}) {
  const files = useDiskFiles();
  const items = files.data?.pages.flat() ?? [];

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
                {items.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(file)}
                      title={file.name}
                      className="group flex w-full flex-col overflow-hidden rounded-xl border border-edge bg-panel text-left transition-colors hover:border-ton focus:outline-none focus-visible:ring-2 focus-visible:ring-ton"
                    >
                      <span className="block aspect-square w-full border-b border-edge">
                        <ImagePreview file={{ id: file.id, name: file.name, size: file.size }} glyphSize={30} />
                      </span>
                      <span className="min-w-0 px-2 py-1.5">
                        <span className="block truncate text-xs font-medium text-fg">{file.name}</span>
                        <span className="block text-[11px] tabular-nums text-muted">
                          {formatBytes(file.size)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
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
      </div>
    </div>
  );
}
