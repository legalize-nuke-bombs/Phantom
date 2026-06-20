// ImagePreview — a square media tile that shows a real image thumbnail when the file
// is a safe, previewable image, and a file-type glyph otherwise.
//
// It is purely presentational over useImagePreview: it never decides previewability
// itself, it just renders the three states (probing → spinner, ok → <img>, fallback →
// glyph). The bytes URL is the cookie-authed, browser-cached /api/disk/files/{id}.
//
// REUSE SEAM: props are a generic MediaDescriptor + an optional glyph, so chat
// attachment bubbles can drop this in with their FileRef as the descriptor.

import type { ReactNode } from 'react';
import {
  File as FileIcon,
  FileArchive,
  FileText,
  FileVideo,
  FileAudio,
  Image as ImageIcon,
} from 'lucide-react';
import clsx from 'clsx';
import Spinner from '@/shared/ui/Spinner';
import { extensionOf, type MediaDescriptor } from './media';
import { useImagePreview } from './useImagePreview';

/**
 * Render a file-type glyph element from the extension — the non-image fallback face.
 * Returns a ReactNode (not a component type) so it slots straight into JSX.
 */
function glyphFor(name: string, size: number): ReactNode {
  const ext = extensionOf(name);
  const props = { size, strokeWidth: 1.75 } as const;
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic', 'avif'].includes(ext)) {
    return <ImageIcon {...props} />;
  }
  if (['zip', 'rar', '7z', 'gz', 'tar'].includes(ext)) return <FileArchive {...props} />;
  if (['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(ext)) return <FileVideo {...props} />;
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) return <FileAudio {...props} />;
  if (['txt', 'md', 'pdf', 'doc', 'docx', 'rtf', 'csv'].includes(ext)) return <FileText {...props} />;
  return <FileIcon {...props} />;
}

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
        glyphFor(file.name, glyphSize)
      )}
    </div>
  );
}
