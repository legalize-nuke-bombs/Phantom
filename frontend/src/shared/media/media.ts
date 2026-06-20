// Shared media helpers — the previewability rules and thresholds for image previews.
//
// REUSE SEAM: everything here is keyed off a plain MediaDescriptor {id,name,size,mime?}
// and the cookie-authed bytes URL /api/disk/files/{id}. Disk cards use it today; chat
// attachments (FileRef has the same {id,name,size} shape) can reuse it unchanged by
// passing their attachment as the descriptor — no disk-specific coupling lives here.

/** Minimal file descriptor a preview needs. Matches both DiskFile and chat FileRef. */
export interface MediaDescriptor {
  /** File id (UUID) — used to build the bytes URL. */
  id: string;
  /** Original filename — drives the extension sniff + the alt text. */
  name: string;
  /** Size in bytes — we never fetch huge files just to thumbnail them. */
  size: number;
  /** Optional MIME type, if the caller knows it (the backend list DTO does not). */
  mime?: string;
}

/* ── thresholds ────────────────────────────────────────────────────────────── */

/**
 * Max byte size we will fetch for a thumbnail. Above this a file gets the type glyph
 * even if it is an image — pulling a 50 MB photo over the wire for a 64px tile is
 * wasteful, and the decompression-bomb guard would likely reject it anyway.
 */
export const PREVIEW_MAX_BYTES = 8 * 1024 * 1024; // 8 MiB

/**
 * Decompression-bomb guard. After the image decodes we read its natural dimensions
 * and reject anything whose pixel count or any single side is implausibly large, so a
 * tiny-on-disk but enormous-when-decoded image can't blow up the renderer/memory.
 */
export const MAX_PIXELS = 40_000_000; // ~40 MP (e.g. 8000×5000)
export const MAX_SIDE = 12_000; // hard cap on width or height

/* ── extension / mime sniff ────────────────────────────────────────────────── */

/** Raster image extensions we attempt to preview (SVG is intentionally excluded). */
const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'avif',
]);

/** The bytes URL for a stored file — cookie-authed; the browser caches it 365d. */
export function fileBytesUrl(id: string): string {
  return `/api/disk/files/${id}`;
}

/** Lowercased extension without the dot, or '' when there is none. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/**
 * Does this descriptor look like a previewable raster image? Cheap, synchronous:
 * extension OR mime says image AND it is small enough to fetch. This only gates the
 * fetch — the bomb guard still runs after decode before anything is shown.
 */
export function isPreviewableImage(file: MediaDescriptor): boolean {
  if (file.size > PREVIEW_MAX_BYTES || file.size <= 0) return false;
  if (file.mime && file.mime.startsWith('image/') && file.mime !== 'image/svg+xml') {
    return true;
  }
  return IMAGE_EXTENSIONS.has(extensionOf(file.name));
}
