// PlatformCloudCard — a home-page widget showing the platform-wide cloud totals
// (total files + total bytes stored across all users), from GET /api/disk/usage/platform.
// Clicking it navigates to /disk. Styled to match the lottery widget on the home page
// (section heading + a single linked card with a glyph, primary metric, and a sub line).

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Cloud, Database } from 'lucide-react';
import { errorMessage } from '@/shared/api/errors';
import Card from '@/shared/ui/Card';
import Spinner from '@/shared/ui/Spinner';
import { formatBytes, usePlatformUsage } from './useDisk';

const ru = (n: number): string => n.toLocaleString('ru-RU');

function CloudCardInner({ size, files }: { size: number; files: number }) {
  return (
    <Link
      to="/disk"
      className="group relative flex items-center gap-4 overflow-hidden rounded-xl border border-edge bg-panel p-4 transition-colors hover:border-ton/50 hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ton/60"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-ton/10 opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
      />
      <span
        aria-hidden
        className="relative grid size-12 shrink-0 place-items-center rounded-xl border border-edge bg-panel-2 text-ton"
      >
        <Cloud size={24} strokeWidth={2} />
      </span>
      <div className="relative min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted">
          <Database size={12} strokeWidth={2} />
          Хранится на платформе
        </p>
        <p className="mt-0.5 truncate text-xl font-bold tracking-tight text-fg">
          {formatBytes(size)}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {ru(files)} {files === 1 ? 'файл' : 'файлов'}
        </p>
      </div>
      <ArrowUpRight
        size={16}
        aria-hidden
        className="relative shrink-0 text-muted transition-colors group-hover:text-ton"
      />
    </Link>
  );
}

/** The "Облако платформы" home section: heading + the totals card (soft fallbacks). */
export default function PlatformCloudCard() {
  const query = usePlatformUsage();

  let body: ReactNode;
  if (query.isPending) {
    body = (
      <Card className="flex items-center gap-3 p-4 text-sm text-muted">
        <Spinner size={20} />
        Загружаем облако…
      </Card>
    );
  } else if (query.isError) {
    body = (
      <Link
        to="/disk"
        className="group flex items-center gap-3 rounded-xl border border-edge bg-panel p-4 transition-colors hover:border-ton/50 hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ton/60"
      >
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-edge bg-panel-2 text-ton"
        >
          <Cloud size={20} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1 text-sm text-muted">
          {errorMessage(query.error, 'Не удалось загрузить облако')}
        </span>
        <ArrowUpRight
          size={16}
          aria-hidden
          className="shrink-0 text-muted transition-colors group-hover:text-ton"
        />
      </Link>
    );
  } else {
    body = <CloudCardInner size={query.data.size} files={query.data.files} />;
  }

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted">
        <Cloud size={14} strokeWidth={2} />
        Облако платформы
      </h2>
      {body}
    </section>
  );
}
