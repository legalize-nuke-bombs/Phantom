// AttachmentView — a chat message's attachment, rendered to BREATHE (it sits on its own
// line under the message, the bubble doesn't box it in):
//   • a safe, decoded image → an unframed, natural-aspect preview (capped, rounded); tap
//     opens a full-screen lightbox with a native download.
//   • anything else (or an image that failed / tripped the bomb-guard) → a clean download
//     chip: type glyph + name + size, the whole chip a native <a download> (no fetch/Blob,
//     so a multi-GB attachment streams straight to disk via the browser's own UI).
//
// The bytes URL (fileBytesUrl) is cookie-authed and any authenticated user may fetch any
// file by id, so a recipient can always load the sender's attachment. Purely presentational
// over a FileRef — no message/chat coupling. Reuses the disk/media preview decision
// (useImagePreview: previewability + decompression-bomb guard, memoized per id).

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import clsx from 'clsx';

import { fileBytesUrl, fileTypeGlyph } from '@/shared/media';
import { useImagePreview } from '@/shared/media/useImagePreview';
import { formatBytes } from '@/features/disk/useDisk';
import type { FileRef } from '@/shared/realtime/types';

/** A full-screen image lightbox: dimmed backdrop, the image, a close + download control. */
function Lightbox({ file, onClose }: { file: FileRef; onClose: () => void }) {
  // Esc closes; lock body scroll while open (mirrors ChatMembersPanel's sheet).
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
    // Backdrop closes on click; the image + controls stop propagation so they don't.
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-label={file.name}
      onClick={onClose}
    >
      <div className="absolute right-3 top-3 flex items-center gap-1">
        {/* Native download — Content-Disposition from the backend names the file. */}
        <a
          href={fileBytesUrl(file.id)}
          download={file.name}
          rel="noopener"
          onClick={(e) => e.stopPropagation()}
          aria-label="Скачать"
          title="Скачать"
          className="grid size-10 place-items-center rounded-lg bg-black/40 text-white/90 transition-colors hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ton"
        >
          <Download size={20} strokeWidth={2} />
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="grid size-10 place-items-center rounded-lg bg-black/40 text-white/90 transition-colors hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ton"
        >
          <X size={20} strokeWidth={2} />
        </button>
      </div>
      <img
        src={fileBytesUrl(file.id)}
        alt={file.name}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain"
      />
    </div>
  );
}

/** `time` (a formatted send-time) is shown INSIDE the attachment, tucked into a corner. */
export default function AttachmentView({ file, time }: { file: FileRef; time?: string }) {
  const [lightbox, setLightbox] = useState(false);
  const { status, url } = useImagePreview({ id: file.id, name: file.name, size: file.size });

  // A decoded, bomb-guarded image → an UNFRAMED, natural-aspect preview. No border, no
  // fixed box: capped by max-width / max-height and left to keep its own aspect ratio.
  if (status === 'ok' && url) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightbox(true)}
          title={file.name}
          className="relative block overflow-hidden rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ton"
        >
          <img
            src={url}
            alt={file.name}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="block max-h-[22rem] max-w-[18rem] rounded-2xl sm:max-w-[20rem]"
          />
          {time ? (
            <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white/90">
              {time}
            </span>
          ) : null}
        </button>
        {lightbox ? <Lightbox file={file} onClose={() => setLightbox(false)} /> : null}
      </>
    );
  }

  // An image still decoding → a slim placeholder so the row doesn't jump when it lands.
  if (status === 'probing') {
    return <span className="block h-44 w-44 animate-pulse rounded-2xl bg-panel-2" />;
  }

  // Non-image (or a rejected/failed image) → a clean download chip; the whole chip is the
  // native download anchor (streams straight to disk, no JS buffering).
  return (
    <a
      href={fileBytesUrl(file.id)}
      download={file.name}
      rel="noopener"
      title={`Скачать ${file.name}`}
      className={clsx(
        'relative flex max-w-[18rem] items-center gap-2.5 rounded-xl bg-panel-2 px-3 py-2.5',
        time && 'pb-4', // room for the time tucked into the bottom-right corner
        'transition-colors hover:bg-panel focus:outline-none focus-visible:ring-2 focus-visible:ring-ton',
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-panel text-ton">
        {fileTypeGlyph(file.name, 22)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg">{file.name}</span>
        <span className="block text-xs tabular-nums text-muted">{formatBytes(file.size)}</span>
      </span>
      <Download size={16} strokeWidth={2} className="shrink-0 self-start text-muted" />
      {time ? (
        <span className="absolute bottom-1 right-2.5 text-[10px] leading-none text-muted">{time}</span>
      ) : null}
    </a>
  );
}
