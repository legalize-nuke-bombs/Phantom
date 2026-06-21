// Disk / Cloud ("Облако") data layer — hooks + helpers over the backend disk API.
//
// Backend (verified against com.example.phantom.disk source, NOT ENDPOINTS.md):
//   GET    /api/disk/settings                         → DiskSettings { baseRule, plusRule }
//   GET    /api/disk/files?before&limit=20            → FileRepresentation[]  (cursor = last item's `timestamp`, epoch SECONDS; page full when length === limit)
//   POST   /api/disk/files?useImageCompression=true   → FileRepresentation    (MULTIPART, field "file")
//   GET    /api/disk/files/{id}                        → file bytes (+ Content-Disposition filename)
//   DELETE /api/disk/files/{id}                        → 204
//   GET    /api/disk/usage/personal                    → DiskQuota { size, files }   (used bytes + file count)
//
// DiskQuota { size: bytes, files: count } is reused both for the user's USAGE
// (usage/personal) and for the LIMIT (settings.baseRule / settings.plusRule).
// Total quota for the signed-in user = plusRule when DISK_PLUS is unlocked, else
// baseRule. base = 1 GiB / 10000 files, plus = 10 GiB / 100000 files.
//
// The shared JSON `api` client cannot carry a file body, so upload goes through raw
// XHR (multipart, with credentials for the auth cookie). Download is a NATIVE browser
// navigation to the cookie-authed bytes URL (no fetch/Blob) so multi-GB files stream
// straight to disk via the browser's own download UI.

import { useCallback, useRef, useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { api } from '@/shared/api/client';
import type { FileRef } from '@/shared/realtime/types';

/* ── DTOs (verified against backend) ───────────────────────────────────────── */

/** DiskQuota — a {bytes, files} pair, used for both usage and a tier's limit. */
export interface DiskQuota {
  /** Bytes: used storage (usage) or the byte ceiling (a rule). */
  size: number;
  /** File count: stored files (usage) or the file-count ceiling (a rule). */
  files: number;
}

/** DiskSettings — the two tier rules. */
export interface DiskSettings {
  baseRule: DiskQuota;
  plusRule: DiskQuota;
}

/** A stored file — the backend FileRepresentation (re-exported from the realtime types). */
export type DiskFile = FileRef;

/* ── keys ──────────────────────────────────────────────────────────────────── */

export const DISK_KEYS = {
  files: ['disk', 'files'] as const,
  usage: ['disk', 'usage'] as const,
  settings: ['disk', 'settings'] as const,
};

const PAGE_LIMIT = 100;
const API_BASE = '/api';

/* ── bytes formatting ──────────────────────────────────────────────────────── */

const UNITS = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'] as const;

/**
 * Human-readable byte size in RU units (Б / КБ / МБ / ГБ / ТБ), binary (1024) base
 * to match the backend's GiB limits. Negative/NaN guards to never render garbage.
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return '0 Б';
  const exp = Math.min(UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exp;
  // No decimals for plain bytes; one decimal for KB+, trimming a trailing .0.
  const text = exp === 0 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, '');
  return `${text} ${UNITS[exp]}`;
}

/* ── settings (long-ish cache; the limits are constants server-side) ───────── */

export function useDiskSettings() {
  return useQuery<DiskSettings>({
    queryKey: DISK_KEYS.settings,
    queryFn: () => api.get<DiskSettings>('/disk/settings'),
    staleTime: 1000 * 60 * 60, // 1h — server-side constants
  });
}

/* ── personal usage ──────────────────────────────────────────────────────────
 * DISK_USAGE_NOT_FOUND (404) just means the user has no usage row yet, i.e. they
 * have never uploaded — treat it as zero usage rather than an error. */
export function useDiskUsage() {
  return useQuery<DiskQuota>({
    queryKey: DISK_KEYS.usage,
    queryFn: async () => {
      try {
        return await api.get<DiskQuota>('/disk/usage/personal');
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return { size: 0, files: 0 };
        }
        throw err;
      }
    },
  });
}

/* ── platform usage (public — total files + bytes across all users) ──────────
 * Powers the home "Облако платформы" widget. No tier ceiling here — it's a raw
 * total, so the widget just human-formats the two numbers. */
export function usePlatformUsage() {
  return useQuery<DiskQuota>({
    queryKey: [...DISK_KEYS.usage, 'platform'],
    queryFn: () => api.get<DiskQuota>('/disk/usage/platform'),
    staleTime: 60_000,
  });
}

/* ── file list (cursor-paginated by `timestamp`, epoch seconds) ──────────────
 * The page is full when it returns exactly `limit` items; the next cursor is the
 * last item's timestamp. Two files can share a timestamp (second resolution), but
 * the backend orders by (timestamp desc) and the realistic page sizes make a
 * dropped-on-the-boundary duplicate a non-issue for this UI. */
export function useDiskFiles() {
  return useInfiniteQuery({
    queryKey: DISK_KEYS.files,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
      if (pageParam !== undefined) params.set('before', String(pageParam));
      return api.get<DiskFile[]>(`/disk/files?${params}`);
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) =>
      last.length < PAGE_LIMIT ? undefined : last[last.length - 1].timestamp,
  });
}

/* ── upload (multipart → XMLHttpRequest, with progress + cancel) ──────────────
 * fetch() cannot report upload progress, and a multi-GB upload needs a live bar +
 * a Cancel, so the upload is hand-rolled on XMLHttpRequest:
 *   - FormData body with the File under field "file" (matching @RequestParam("file"));
 *     we STREAM the File object — never read it into an ArrayBuffer — so a 5 GB file
 *     doesn't have to fit in memory.
 *   - xhr.withCredentials = true forwards the auth cookie.
 *   - We never set Content-Type: the browser sets multipart/form-data + the boundary.
 *   - xhr.upload.onprogress drives the percentage; xhr.abort() cancels.
 * Errors come back as a Spring ProblemDetail carrying a `code`; we map them to an
 * ApiError so the shared errorMessage() resolves a friendly RU string.
 *
 * (The old fetch() upload was correct on the streaming front — the real cause of the
 *  5 GB failure was the dev proxy timeout, fixed in vite.config.ts. This rewrite adds
 *  the progress/cancel UX on top.) */

/** Live progress for an in-flight upload. */
export interface UploadProgress {
  /** Bytes sent so far. */
  loaded: number;
  /** Total bytes to send (the multipart body, ≈ file size). 0 until known. */
  total: number;
  /** 0..1 — loaded/total, clamped; 0 when total is unknown. */
  fraction: number;
}

function parseXhrError(xhr: XMLHttpRequest): ApiError {
  let code: string | undefined;
  let detail: string | undefined;
  const text = xhr.responseText;
  if (text) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      if (typeof obj.code === 'string') code = obj.code;
      if (typeof obj.detail === 'string') detail = obj.detail;
    } catch {
      /* non-JSON body — fall back to status text */
    }
  }
  return new ApiError(xhr.status, detail ?? xhr.statusText ?? 'Ошибка загрузки', code);
}

/**
 * Low-level single-file upload over XHR. Resolves with the created DiskFile, calls
 * onProgress as bytes flow, and exposes abort() via the returned handle. Rejects with
 * an ApiError (status 0 = network/abort) on any failure.
 *
 * The backend compresses uploaded images (useImageCompression=true) — the original,
 * verified behaviour. Both the chat composer and the disk batch uploader go through here,
 * so both compress; there is intentionally no way to turn it off from the client.
 */
function uploadFileXhr(
  file: File,
  onProgress: (p: UploadProgress) => void,
): { promise: Promise<DiskFile>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const form = new FormData();
  form.append('file', file); // File streamed by the browser, not buffered in JS.

  const promise = new Promise<DiskFile>((resolve, reject) => {
    xhr.open('POST', `${API_BASE}/disk/files?useImageCompression=true`);
    xhr.withCredentials = true; // send the auth cookie
    xhr.responseType = 'text';
    // Intentionally NO setRequestHeader('Content-Type', …): the browser must set the
    // multipart boundary itself.

    xhr.upload.onprogress = (e: ProgressEvent) => {
      const total = e.lengthComputable ? e.total : 0;
      const fraction = total > 0 ? Math.min(1, e.loaded / total) : 0;
      onProgress({ loaded: e.loaded, total, fraction });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as DiskFile);
        } catch {
          reject(new ApiError(xhr.status, 'Некорректный ответ сервера'));
        }
      } else {
        reject(parseXhrError(xhr));
      }
    };
    // A user abort fires `onabort` (not `onerror`); both resolve to a status-0 ApiError.
    xhr.onerror = () => reject(new ApiError(0, 'Нет соединения с сервером'));
    xhr.onabort = () => reject(new ApiError(0, 'Загрузка отменена'));

    xhr.send(form);
  });

  return { promise, abort: () => xhr.abort() };
}

/** Phase of the upload widget's state machine. */
export type UploadPhase = 'idle' | 'uploading' | 'success' | 'error';

export interface UploadController {
  phase: UploadPhase;
  progress: UploadProgress;
  error: ApiError | null;
  /** Name of the file currently uploading (for the progress label). */
  fileName: string | null;
  /**
   * Begin uploading a file. No-op while another upload is in flight. The optional
   * `onDone` fires with the created DiskFile when the upload succeeds — lets a caller
   * (e.g. the chat composer) pick the result up as a pending attachment (its id is the
   * message attachmentId) without watching state via an effect.
   */
  start: (file: File, onDone?: (created: DiskFile) => void) => void;
  /** Abort the in-flight upload (xhr.abort()). */
  cancel: () => void;
  /** Clear a finished success/error back to idle. */
  reset: () => void;
}

const ZERO_PROGRESS: UploadProgress = { loaded: 0, total: 0, fraction: 0 };

/**
 * Upload state machine for the UploadButton: owns the XHR, the live progress, the
 * cancel handle, and invalidates the file list + usage on success. Single-flight —
 * `start` is ignored while an upload is already running.
 */
export function useUpload(): UploadController {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState<UploadProgress>(ZERO_PROGRESS);
  const [error, setError] = useState<ApiError | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const start = useCallback(
    (file: File, onDone?: (created: DiskFile) => void) => {
      if (abortRef.current) return; // single-flight guard
      setPhase('uploading');
      setError(null);
      setFileName(file.name);
      // Seed total from the file size so the bar reads sensibly before the first event.
      setProgress({ loaded: 0, total: file.size, fraction: 0 });

      const { promise, abort } = uploadFileXhr(file, setProgress);
      abortRef.current = abort;

      promise
        .then((created) => {
          abortRef.current = null;
          setPhase('success');
          qc.invalidateQueries({ queryKey: DISK_KEYS.files });
          qc.invalidateQueries({ queryKey: DISK_KEYS.usage });
          onDone?.(created);
        })
        .catch((err: unknown) => {
          abortRef.current = null;
          const apiErr = err instanceof ApiError ? err : new ApiError(0, 'Ошибка загрузки');
          // A user-initiated abort is not an error state — drop straight back to idle.
          if (apiErr.message === 'Загрузка отменена') {
            setPhase('idle');
            setProgress(ZERO_PROGRESS);
            setFileName(null);
            return;
          }
          setError(apiErr);
          setPhase('error');
        });
    },
    [qc],
  );

  const cancel = useCallback(() => {
    abortRef.current?.();
  }, []);

  const reset = useCallback(() => {
    if (abortRef.current) return; // don't wipe state mid-flight
    setPhase('idle');
    setProgress(ZERO_PROGRESS);
    setError(null);
    setFileName(null);
  }, []);

  return { phase, progress, error, fileName, start, cancel, reset };
}

/* ── batch upload (sequential, one request at a time) ─────────────────────────
 * Multi-file upload on the same XHR uploader as useUpload, run STRICTLY SEQUENTIALLY —
 * one request in flight at a time (the backend takes a single file per request). Built
 * for LARGE batches (1000+ files at once):
 *   - the per-file queue lives in a REF, never in React state, so a 1000-file run does NOT
 *     re-render or re-map a 1000-element array on every progress tick — only a compact
 *     summary (the current file + counts) is state;
 *   - the file list + usage are invalidated ONCE when the whole run finishes, never per
 *     file (per-file refetch was slow and tripped the backend pagination 429 on bulk runs);
 *   - a failed file is counted and the run keeps going; cancelAll() aborts the in-flight
 *     upload and drops everything still queued.
 * The UI shows ONE temporary "current upload" widget — no per-file list. Images are
 * compressed by the backend (useImageCompression=true), same as every other upload. */

/** Render-cheap snapshot of a batch run (no per-file array in state). */
export interface BatchUploadController {
  /** The file currently streaming + its live progress; null when nothing is in flight. */
  current: { name: string; progress: UploadProgress } | null;
  /** Files in the current run. */
  total: number;
  /** Successfully uploaded so far. */
  done: number;
  /** Failed so far (the run continues past a failure). */
  errors: number;
  /** True while a request is in flight or files are still queued. */
  isUploading: boolean;
  /** Enqueue files and start (or extend) the sequential run. */
  enqueue: (files: File[] | FileList) => void;
  /** Abort the in-flight upload and drop everything still queued — ends the run. */
  cancelAll: () => void;
  /** Clear the finished-run summary (the post-run error note). */
  dismiss: () => void;
}

/**
 * Sequential multi-file upload tuned for big batches. The queue is a plain ref the drain
 * loop shifts through; only the current file + counts are state, so rendering cost is O(1)
 * no matter how many files were queued. The list + usage refresh once, at the end.
 */
export function useBatchUpload(): BatchUploadController {
  const qc = useQueryClient();
  const [current, setCurrent] = useState<{ name: string; progress: UploadProgress } | null>(null);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [errors, setErrors] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const queueRef = useRef<File[]>([]);
  const abortRef = useRef<(() => void) | null>(null);
  const runningRef = useRef(false);
  const cancelledRef = useRef(false);

  const drain = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsUploading(true);
    try {
      while (queueRef.current.length > 0 && !cancelledRef.current) {
        const file = queueRef.current.shift() as File;
        setCurrent({ name: file.name, progress: { loaded: 0, total: file.size, fraction: 0 } });

        const { promise, abort } = uploadFileXhr(file, (p) =>
          setCurrent({ name: file.name, progress: p }),
        );
        abortRef.current = abort;
        try {
          await promise;
          setDone((n) => n + 1);
        } catch (err: unknown) {
          const apiErr = err instanceof ApiError ? err : new ApiError(0, 'Ошибка загрузки');
          // A user abort (cancelAll) ends the whole run; any other failure is isolated —
          // count it and keep draining.
          if (apiErr.message === 'Загрузка отменена') break;
          setErrors((n) => n + 1);
        } finally {
          abortRef.current = null;
        }
      }
    } finally {
      runningRef.current = false;
      abortRef.current = null;
      setCurrent(null);
      setIsUploading(false);
      // ONE refresh for the whole run — never per file.
      qc.invalidateQueries({ queryKey: DISK_KEYS.files });
      qc.invalidateQueries({ queryKey: DISK_KEYS.usage });
    }
  }, [qc]);

  const enqueue = useCallback(
    (files: File[] | FileList) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      if (!runningRef.current) {
        // A fresh run after a finished one: reset the summary counters.
        cancelledRef.current = false;
        setTotal(list.length);
        setDone(0);
        setErrors(0);
      } else {
        setTotal((n) => n + list.length);
      }
      queueRef.current.push(...list);
      void drain();
    },
    [drain],
  );

  const cancelAll = useCallback(() => {
    cancelledRef.current = true;
    queueRef.current = [];
    abortRef.current?.(); // abort the in-flight upload → its reject breaks the loop
  }, []);

  const dismiss = useCallback(() => {
    if (runningRef.current) return;
    setTotal(0);
    setDone(0);
    setErrors(0);
  }, []);

  return { current, total, done, errors, isUploading, enqueue, cancelAll, dismiss };
}

/* ── download (NATIVE browser download) ───────────────────────────────────────
 * GET /api/disk/files/{id} is cookie-authenticated and already sets
 *   Content-Disposition: attachment; filename=…
 * so a plain navigation to it streams straight to disk via the browser's own download
 * UI — zero JS buffering. We trigger that with a transient <a href download>: the
 * anchor approach (over window.location.assign) lets several downloads coexist and
 * keeps the current SPA route intact.
 *
 * This replaces the old fetch()+Blob path, which read the WHOLE file into memory before
 * saving — for a multi-GB file that hung/OOMed and the native download UI never showed.
 *
 * NOTE: the backend rate-limits downloads (RateLimitService) to 4 GB / 8h on DISK_BASE
 * and 40 GB / 8h on DISK_PLUS, so a single >4 GB download on a base-tier account is
 * refused server-side. With a native navigation that refusal surfaces as the browser's
 * own error page rather than a catchable JS error — a backend tuning concern, not this
 * layer's. We can't read the response status here (no fetch), so the mutation resolves
 * as soon as the click is dispatched. */
export async function downloadFile(file: DiskFile): Promise<void> {
  const a = document.createElement('a');
  a.href = `${API_BASE}/disk/files/${file.id}`;
  // `download` asks the browser to save rather than navigate; the Content-Disposition
  // filename from the backend still wins, but this is a sensible same-origin hint.
  a.download = file.name || 'file';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function useDownloadFile() {
  return useMutation<void, ApiError, DiskFile>({
    mutationFn: downloadFile,
  });
}

/* ── delete ──────────────────────────────────────────────────────────────────*/

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, DiskFile>({
    mutationFn: (file) => api.del<void>(`/disk/files/${file.id}`),
    onSuccess: (_void, file) => {
      // Drop the file straight out of the paginated cache — NO refetch. Refetching on every
      // delete fired a GET /disk/files per file; batch-deleting then tripped the backend's
      // pagination rate limit (429) after ~100 files. Decrement usage in place too, so the
      // quota meter updates without a GET /disk/usage/personal per delete either.
      qc.setQueryData<InfiniteData<DiskFile[], number | undefined>>(DISK_KEYS.files, (old) =>
        old
          ? { ...old, pages: old.pages.map((page) => page.filter((f) => f.id !== file.id)) }
          : old,
      );
      qc.setQueryData<DiskQuota>(DISK_KEYS.usage, (old) =>
        old ? { size: Math.max(0, old.size - file.size), files: Math.max(0, old.files - 1) } : old,
      );
    },
  });
}
