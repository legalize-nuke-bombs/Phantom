// Disk / Cloud ("Облако") — personal file storage (route: /disk).
//
// Gated on the DISK_BASE level feature (unlocks at rank Echo): while locked, the file
// UI is replaced by a lock hint. When unlocked the page shows, top to bottom:
//   • a storage meter (used / total) — total is the user's tier limit from
//     GET /api/disk/settings (plusRule if DISK_PLUS is unlocked, else baseRule),
//   • an upload button (multipart, useImageCompression=false),
//   • the file list — name · size · uploaded date, with per-file download + delete,
//     cursor-paginated ("Показать ещё").
//
// All wiring lives in ./useDisk (TanStack Query + raw XHR for the multipart upload; the
// download is a native browser navigation). The total quota is derived from the unlocked tier, so the
// bar always has a ceiling even though usage/personal only returns used bytes.

import type { ReactNode } from 'react';
import { HardDrive } from 'lucide-react';

import { errorMessage } from '@/shared/api/errors';
import { FeatureLock, useFeatureGate, useMyFeatures } from '@/shared/lib/levelFeatures';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import Spinner from '@/shared/ui/Spinner';

import FileCard from './FileCard';
import QuotaBar from './QuotaBar';
import UploadButton from './UploadButton';
import { useInfiniteScroll } from './useInfiniteScroll';
import {
  useDeleteFile,
  useDiskFiles,
  useDiskSettings,
  useDiskUsage,
  useDownloadFile,
  type DiskQuota,
} from './useDisk';

/* ── header ───────────────────────────────────────────────────────────────── */
function PageHeader() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-ton">
        <HardDrive size={22} />
      </span>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Облако</h1>
        <p className="text-sm text-muted">Личное хранилище файлов</p>
      </div>
    </div>
  );
}

/* ── usage meter ──────────────────────────────────────────────────────────────
 * Total quota comes from the user's unlocked tier: plusRule when DISK_PLUS, else
 * baseRule. Usage (used bytes + file count) is its own query; if settings haven't
 * loaded the bar degrades to "used only" (QuotaBar handles the missing total). */
function UsageSection() {
  const usage = useDiskUsage();
  const settings = useDiskSettings();
  const { has } = useMyFeatures();

  const tier: DiskQuota | undefined = settings.data
    ? has('DISK_PLUS')
      ? settings.data.plusRule
      : settings.data.baseRule
    : undefined;

  if (usage.isLoading) {
    return (
      <div className="flex justify-center rounded-xl border border-edge bg-panel-2 py-5">
        <Spinner size={20} />
      </div>
    );
  }

  // A usage error is non-blocking — the rest of the page still works, so we show a
  // quiet line instead of taking over the screen.
  if (usage.isError) {
    return (
      <div className="rounded-xl border border-edge bg-panel-2 p-4 text-sm text-muted">
        {errorMessage(usage.error, 'Не удалось загрузить использование хранилища')}
      </div>
    );
  }

  const used = usage.data ?? { size: 0, files: 0 };
  return (
    <QuotaBar used={used.size} total={tier?.size} files={used.files} maxFiles={tier?.files} />
  );
}

/* ── file list ──────────────────────────────────────────────────────────────*/
function FileList() {
  const files = useDiskFiles();
  const download = useDownloadFile();
  const del = useDeleteFile();

  const items = files.data?.pages.flat() ?? [];
  const anyBusy = download.isPending || del.isPending;

  // Infinite scroll: fetch the next page when the end sentinel scrolls into view.
  const canLoadMore = files.hasNextPage && !files.isFetchingNextPage;
  const sentinelRef = useInfiniteScroll<HTMLDivElement>(
    () => files.fetchNextPage(),
    canLoadMore,
  );

  let body: ReactNode;
  if (files.isLoading) {
    body = (
      <div className="flex justify-center py-6">
        <Spinner size={24} />
      </div>
    );
  } else if (files.isError) {
    body = (
      <div className="flex flex-col items-start gap-3 py-2">
        <p className="text-sm text-lose">
          {errorMessage(files.error, 'Не удалось загрузить файлы')}
        </p>
        <Button type="button" variant="ghost" onClick={() => files.refetch()}>
          Повторить
        </Button>
      </div>
    );
  } else if (items.length === 0) {
    body = (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <HardDrive size={28} className="text-muted" />
        <p className="text-sm font-medium text-fg">Здесь пока пусто</p>
        <p className="text-xs text-muted">Загрузите первый файл, чтобы он появился тут</p>
      </div>
    );
  } else {
    body = (
      <>
        {(download.isError || del.isError) && (
          <p className="mb-3 text-sm text-lose">
            {errorMessage(
              download.error ?? del.error,
              'Не удалось выполнить действие с файлом',
            )}
          </p>
        )}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onDownload={() => download.mutate(file)}
              onDelete={() => del.mutate(file)}
              downloading={download.isPending && download.variables?.id === file.id}
              deleting={del.isPending && del.variables?.id === file.id}
              busy={anyBusy}
            />
          ))}
        </ul>

        {/* Infinite-scroll sentinel + a manual fallback (also covers no-IO edge cases). */}
        {files.hasNextPage && (
          <div ref={sentinelRef} className="mt-4 flex justify-center">
            {files.isFetchingNextPage ? (
              <Spinner size={22} />
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => files.fetchNextPage()}
              >
                Показать ещё
              </Button>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-muted">
        <HardDrive size={16} strokeWidth={2} />
        <h2 className="text-sm font-medium">Мои файлы</h2>
      </div>
      {body}
    </Card>
  );
}

/* ── page ─────────────────────────────────────────────────────────────────── */
export default function DiskPage() {
  const gate = useFeatureGate('DISK_BASE');

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHeader />

      {gate.locked ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <span className="grid size-12 place-items-center rounded-2xl border border-edge bg-panel-2 text-muted">
            <HardDrive size={24} />
          </span>
          <div>
            <p className="text-sm font-medium text-fg">Облако пока недоступно</p>
            <p className="mt-1 text-sm text-muted">
              Личное хранилище откроется по мере роста вашего ранга.
            </p>
          </div>
          <FeatureLock feature="DISK_BASE" />
        </Card>
      ) : (
        <>
          <UsageSection />
          <Card className="p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2 text-muted">
              <HardDrive size={16} strokeWidth={2} />
              <h2 className="text-sm font-medium">Загрузка</h2>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-muted">
              Выберите один или несколько файлов — они загрузятся по очереди и сохранятся
              в вашем личном облаке, доступном только вам.
            </p>
            <UploadButton />
          </Card>
          <FileList />
        </>
      )}
    </div>
  );
}
