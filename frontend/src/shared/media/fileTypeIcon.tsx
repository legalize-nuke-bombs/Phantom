// fileTypeIcon — map a filename's extension to a distinct lucide file-type icon (plus
// a subtle per-family tint), so non-image files read as recognisably different types
// instead of one generic glyph.
//
// REUSE SEAM: keyed off the bare extension (via extensionOf), with no disk-specific
// coupling — ImagePreview's fallback face uses it today; chat attachment bubbles can
// reuse it for the same "what kind of file is this?" affordance.
//
// The tint classes are restrained Tailwind text-* tokens from the theme (index.css):
// the icon stays muted-grey for the default/unknown case and only borrows an accent
// for families where the colour genuinely aids recognition.

import type { ComponentType, ReactNode } from 'react';
import {
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileTerminal,
  FileText,
  FileVideo,
  Presentation,
  type LucideProps,
} from 'lucide-react';
import { extensionOf } from './media';

/** A resolved file-type face: the lucide icon component + a Tailwind text-colour class. */
export interface FileTypeIcon {
  /** The lucide icon component for this family. */
  Icon: ComponentType<LucideProps>;
  /** Tailwind text-* class that tints the glyph for its family (subtle, theme tokens). */
  tint: string;
}

/**
 * Extension → family. Each family maps to a (lucide icon, tint) pair. Extensions are
 * lowercase, dot-less. Order is irrelevant — every extension maps to exactly one family.
 * Anything not listed falls through to the generic File glyph (see DEFAULT).
 */
const FAMILIES: ReadonlyArray<{ exts: readonly string[]; icon: FileTypeIcon }> = [
  {
    // Images: real images preview; this is just the fallback face (e.g. SVG, or a photo
    // too big to thumbnail).
    exts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp', 'heic'],
    icon: { Icon: FileImage, tint: 'text-ton' },
  },
  {
    exts: ['mp4', 'mov', 'mkv', 'webm', 'avi'],
    icon: { Icon: FileVideo, tint: 'text-tier-purple' },
  },
  {
    exts: ['mp3', 'wav', 'flac', 'ogg', 'm4a'],
    icon: { Icon: FileAudio, tint: 'text-tier-pink' },
  },
  {
    exts: ['zip', 'rar', '7z', 'tar', 'gz'],
    icon: { Icon: FileArchive, tint: 'text-warn' },
  },
  {
    // PDF + word-processor docs share the document glyph; PDF gets a distinct red tint.
    exts: ['pdf'],
    icon: { Icon: FileText, tint: 'text-lose' },
  },
  {
    exts: ['doc', 'docx', 'odt', 'rtf', 'txt', 'md'],
    icon: { Icon: FileText, tint: 'text-tier-blue' },
  },
  {
    exts: ['xls', 'xlsx', 'csv'],
    icon: { Icon: FileSpreadsheet, tint: 'text-win' },
  },
  {
    exts: ['ppt', 'pptx'],
    icon: { Icon: Presentation, tint: 'text-warn' },
  },
  {
    // Source code: a code glyph, with JSON/shell as part of the same family.
    exts: [
      'js', 'ts', 'tsx', 'jsx', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'rb', 'php',
      'html', 'css', 'json', 'xml', 'yml', 'yaml', 'sh',
    ],
    icon: { Icon: FileCode, tint: 'text-ice' },
  },
  {
    // Executables / installers — a terminal glyph reads as "runnable".
    exts: ['exe', 'msi', 'apk', 'dmg'],
    icon: { Icon: FileTerminal, tint: 'text-fg' },
  },
];

/** The face for an unrecognised extension: the generic file glyph, muted. */
const DEFAULT: FileTypeIcon = { Icon: FileIcon, tint: 'text-muted' };

/** id → resolved icon, built once from FAMILIES for O(1) lookup. */
const BY_EXT: ReadonlyMap<string, FileTypeIcon> = new Map(
  FAMILIES.flatMap(({ exts, icon }) => exts.map((ext) => [ext, icon] as const)),
);

/**
 * Resolve the (icon, tint) face for a filename by its extension. Always returns a face —
 * unknown/extension-less names get the generic File glyph.
 */
export function fileTypeIcon(name: string): FileTypeIcon {
  return BY_EXT.get(extensionOf(name)) ?? DEFAULT;
}

/**
 * Render the file-type glyph element for a filename, sized to `size`. Returns a
 * ReactNode so it slots straight into JSX (e.g. ImagePreview's fallback face). The
 * family tint is applied unless `tinted` is false, in which case it inherits colour.
 */
export function fileTypeGlyph(name: string, size: number, tinted = true): ReactNode {
  const { Icon, tint } = fileTypeIcon(name);
  return <Icon size={size} strokeWidth={1.75} className={tinted ? tint : undefined} />;
}
