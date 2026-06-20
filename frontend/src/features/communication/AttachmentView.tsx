// AttachmentView — renders a chat message's attachment inside its bubble.
//
// Two faces, decided by the SAME previewability rule the disk grid uses
// (isPreviewableImage over the {id,name,size} descriptor):
//   • image → a bounded ImagePreview thumbnail; tapping it opens a full-screen
//     lightbox (the cookie-authed bytes URL) with a native download link.
//   • anything else → a compact file chip: type glyph + name + human size, the whole
//     chip being a native <a href="/api/disk/files/{id}" download> (no fetch/Blob, so a
//     multi-GB attachment streams straight to disk via the browser's own UI).
//
// The bytes URL (fileBytesUrl) is cookie-authed and any authenticated user may fetch any
// file by id, so a recipient can always load the sender's attachment. Purely presentational
// over a FileRef — no message/chat coupling.

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import clsx from 'clsx';

import { ImagePreview, fileBytesUrl, fileTypeGlyph, isPreviewableImage } from '@/shared/media';
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

export default function AttachmentView({ file }: { file: FileRef }) {
  const [lightbox, setLightbox] = useState(false);
  const image = isPreviewableImage({ id: file.id, name: file.name, size: file.size });

  if (image) {
    return (
      <>
        {/* Bounded thumbnail — capped so it never dominates the bubble; tap → lightbox. */}
        <button
          type="button"
          onClick={() => setLightbox(true)}
          title={file.name}
          className="block overflow-hidden rounded-lg border border-edge focus:outline-none focus-visible:ring-2 focus-visible:ring-ton"
        >
          <span className="block h-40 w-40 max-w-full sm:h-48 sm:w-48">
            <ImagePreview file={{ id: file.id, name: file.name, size: file.size }} glyphSize={30} />
          </span>
        </button>
        {lightbox ? <Lightbox file={file} onClose={() => setLightbox(false)} /> : null}
      </>
    );
  }

  // Non-image: a compact download chip (the whole chip is the native download anchor).
  return (
    <a
      href={fileBytesUrl(file.id)}
      download={file.name}
      rel="noopener"
      title={`Скачать ${file.name}`}
      className={clsx(
        'flex max-w-[16rem] items-center gap-2.5 rounded-lg border border-edge bg-panel px-2.5 py-2',
        'transition-colors hover:bg-panel-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ton',
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-panel-2">
        {fileTypeGlyph(file.name, 20)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg">{file.name}</span>
        <span className="block text-xs tabular-nums text-muted">{formatBytes(file.size)}</span>
      </span>
      <Download size={16} strokeWidth={2} className="shrink-0 text-muted" />
    </a>
  );
}
