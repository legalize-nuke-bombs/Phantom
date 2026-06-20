// ImagePreview — a square media tile that shows a real image thumbnail when the file
// is a safe, previewable image, and a file-type glyph otherwise.
//
// It is purely presentational over useImagePreview: it never decides previewability
// itself, it just renders the three states (probing → spinner, ok → <img>, fallback →
// glyph). The bytes URL is the cookie-authed, browser-cached /api/disk/files/{id}.
//
// REUSE SEAM: props are a generic MediaDescriptor + an optional glyph, so chat
// attachment bubbles can drop this in with their FileRef as the descriptor.

import clsx from 'clsx';
import Spinner from '@/shared/ui/Spinner';
import { type MediaDescriptor } from './media';
import { fileTypeGlyph } from './fileTypeIcon';
import { useImagePreview } from './useImagePreview';

export interface ImagePreviewProps {
  /** The file to preview (generic descriptor — disk or chat). */
  file: MediaDescriptor;
  /** Glyph icon px size in the fallback state. Default 24. */
  glyphSize?: number;
  /** Extra classes for the outer tile (it is `relative` + clipped by default). */
  className?: string;
}

/**
 * A self-contained square preview tile. Fills its container (give the parent a fixed
 * box or aspect ratio). Shows: a spinner while probing, the cached thumbnail when the
 * image is safe, or a centered file-type glyph otherwise.
 */
export default function ImagePreview({ file, glyphSize = 24, className }: ImagePreviewProps) {
  const { status, url } = useImagePreview(file);

  return (
    <div
      className={clsx(
        'relative grid h-full w-full place-items-center overflow-hidden bg-panel-2 text-muted',
        className,
      )}
    >
      {status === 'ok' && url ? (
        <img
          src={url}
          alt={file.name}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-full w-full object-cover"
        />
      ) : status === 'probing' ? (
        <Spinner size={Math.min(22, glyphSize)} />
      ) : (
        fileTypeGlyph(file.name, glyphSize)
      )}
    </div>
  );
}
