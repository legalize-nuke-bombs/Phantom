// useImagePreview — decide whether a file can be shown as an image thumbnail, and
// probe it safely before we ever paint it.
//
// Flow per file id:
//   1. Not an image / too big on disk  → 'fallback' immediately (no network).
//   2. Looks previewable → load /api/disk/files/{id} into an Image() (cookie-authed,
//      browser-cached 365d). On load we read natural dimensions and run the
//      decompression-bomb guard (MAX_PIXELS / MAX_SIDE) → 'ok' or 'fallback'.
//   3. Any load error → 'fallback'.
//
// The decision is memoized in a module-level Map (id → status) so re-scrolling a grid
// never re-probes a file we've already judged. The hook only fetches when the id is
// still 'pending'; an already-decided id resolves synchronously on mount.
//
// REUSE SEAM: takes a MediaDescriptor, so chat attachments can use it too (see media.ts).

import { useEffect, useState } from 'react';
import {
  fileBytesUrl,
  isPreviewableImage,
  MAX_PIXELS,
  MAX_SIDE,
  type MediaDescriptor,
} from './media';

/** Resolved preview state for a file. 'probing' means a decode is in flight. */
export type PreviewStatus = 'probing' | 'ok' | 'fallback';

/** Internal cached decision per file id. 'pending' = not yet probed this session. */
type CachedDecision = 'pending' | 'ok' | 'rejected';

/** id → decision. Lives for the page session; keyed by id so it survives unmount. */
const decisionCache = new Map<string, CachedDecision>();

/** Test seam / safety valve — clear the memoized decisions (e.g. after a re-upload). */
export function clearPreviewCache(): void {
  decisionCache.clear();
}

interface PreviewResult {
  /** Current state: probing → ok (show <img src=url>) | fallback (show a glyph). */
  status: PreviewStatus;
  /** The cookie-authed bytes URL when status === 'ok', else null. */
  url: string | null;
}

/** The synchronous answer for an id from cache + previewability, or 'probing'. */
function decideSync(file: MediaDescriptor, previewable: boolean): PreviewStatus {
  if (!previewable) return 'fallback';
  const cached = decisionCache.get(file.id);
  if (cached === 'ok') return 'ok';
  if (cached === 'rejected') return 'fallback';
  return 'probing';
}

/**
 * Decide+probe a single file's image preview. Returns 'ok' with the bytes URL only
 * after the image has decoded AND passed the decompression-bomb guard; otherwise
 * 'fallback'. While a never-before-seen image is decoding the state is 'probing'.
 */
export function useImagePreview(file: MediaDescriptor): PreviewResult {
  const previewable = isPreviewableImage(file);

  // The synchronous decision, recomputed every render (cheap Map lookup). For a
  // non-image or an already-judged id this is the final answer with no network at all.
  const sync = decideSync(file, previewable);

  // The async probe's outcome ('ok' | 'fallback'), set only from image load/error
  // callbacks — never synchronously inside the effect.
  //
  // NB: callers MUST mount one instance per file id (key by id) — the disk grid and
  // chat bubbles both do. That makes file.id stable for the life of this hook, so we
  // never need to reset `probed` on an id change (no in-render setState / ref reads).
  const [probed, setProbed] = useState<'ok' | 'fallback' | null>(null);

  // Displayed status: the async result wins once resolved, else the sync decision.
  const status: PreviewStatus = probed ?? sync;

  const fileId = file.id;
  useEffect(() => {
    // Only the genuinely-unknown case needs a probe; everything else is already decided.
    // (Re-checked here against primitives so the effect depends only on id + previewable.)
    if (!previewable) return;
    const cached = decisionCache.get(fileId);
    if (cached === 'ok' || cached === 'rejected') return;

    // First time we see this id: mark pending and probe natural dimensions.
    decisionCache.set(fileId, 'pending');

    let cancelled = false;
    const img = new Image();

    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const bomb = w <= 0 || h <= 0 || w > MAX_SIDE || h > MAX_SIDE || w * h > MAX_PIXELS;
      decisionCache.set(fileId, bomb ? 'rejected' : 'ok');
      setProbed(bomb ? 'fallback' : 'ok');
    };
    img.onerror = () => {
      if (cancelled) return;
      decisionCache.set(fileId, 'rejected');
      setProbed('fallback');
    };

    // The probe request carries the auth cookie (same-origin); the response is the
    // immutable cached blob the backend marks max-age=365d, so the later <img> reuses it.
    img.src = fileBytesUrl(fileId);

    return () => {
      cancelled = true;
      // Drop handlers so a late load/error on an unmounted probe is a no-op. We do NOT
      // reset the cache entry: leaving it 'pending' lets a remount re-probe, while an
      // already-resolved 'ok'/'rejected' decision sticks.
      img.onload = null;
      img.onerror = null;
    };
  }, [fileId, previewable]);

  return {
    status,
    url: status === 'ok' ? fileBytesUrl(file.id) : null,
  };
}
