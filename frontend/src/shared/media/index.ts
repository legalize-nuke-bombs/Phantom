// Reusable image-preview system (decompression-bomb-guarded, browser-cached).
// See media.ts for the reuse seam — disk cards use it now; chat attachments can later.
export { default as ImagePreview } from './ImagePreview';
export type { ImagePreviewProps } from './ImagePreview';
export { useImagePreview, clearPreviewCache } from './useImagePreview';
export type { PreviewStatus } from './useImagePreview';
export {
  isPreviewableImage,
  fileBytesUrl,
  extensionOf,
  PREVIEW_MAX_BYTES,
  MAX_PIXELS,
  MAX_SIDE,
  type MediaDescriptor,
} from './media';
export { fileTypeIcon, fileTypeGlyph, type FileTypeIcon } from './fileTypeIcon';
