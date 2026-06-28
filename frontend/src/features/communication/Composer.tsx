// Composer — the chat message input row: a textarea, an attach affordance (paperclip →
// "from computer" / "from disk"), pending-attachment chips, an inline upload progress
// panel, and the send button. Lifted out of ChatRoom so all the attach/upload/ban state
// lives in one place; ChatRoom keeps the message list.
//
// MULTI-ATTACHMENT: the backend takes STRICTLY ONE attachment per message, but the user may
// queue MANY files. We hold them in a `pending` LIST (one removable chip each) and, on send,
// fan them out into separate messages — message #1 carries the typed text + the first file,
// and each remaining file rides its own text-less message (like a Telegram album, but each
// file is its own message). Messages are sent SEQUENTIALLY (awaited in order) so they land in
// order; a mid-batch failure stops the run and keeps whatever hasn't been sent yet for retry.
//
// Attaching has two sources, both APPENDING to the pending list:
//   1. From computer — a hidden <input type=file multiple>; picks upload via the disk XHR
//      uploader (useUpload: streams huge files, live progress, cancel) ONE AT A TIME in a
//      sequential loop. Each completed upload's DiskFile (its id == the message attachmentId)
//      is pushed to the list; the send button stays DISABLED until the whole queue is done.
//   2. From disk — DiskFilePicker (reuses the disk file list) with multi-select; every picked
//      file is appended directly (no upload — they already live in the cloud).
//
// Send is enabled when (draft has text OR there's at least one pending attachment) AND nothing
// blocks it (not uploading, not locked, not already sending). An attachment-only message posts
// content: '' + attachmentId — the backend accepts that.
//
// Locking: a chat BAN blocks sending in every chat; the existing global-only feature lock
// blocks sending in the global chat. `locked` (the feature lock — the parent passes
// featureLocked && global) and the ban are combined here: the composer is locked when
// banned OR locked. Banner precedence is banned → ban banner, else locked → feature-lock
// banner, else the input. The textarea/buttons disable whenever either applies.

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import { Paperclip, Send, Upload, X, HardDrive, FileUp } from 'lucide-react';

import { errorMessage } from '@/shared/api/errors';
import { banExpiry, useMyBan } from '@/shared/chat/ban';
import { MAX_MESSAGE_LENGTH, type SendMessageArgs } from '@/shared/chat/useChat';
import { FeatureLock } from '@/shared/lib/levelFeatures';
import { formatTime } from '@/shared/lib/time';
import { ImagePreview } from '@/shared/media';
import type { ChatMessage } from '@/shared/realtime/types';
import type { ApiError } from '@/shared/api/client';
import type { UseMutationResult } from '@tanstack/react-query';
import Button from '@/shared/ui/Button';
import { SUPPRESS_AUTOFILL } from '@/shared/ui/Input';
import { formatBytes, useUpload, type DiskFile } from '@/features/disk/useDisk';

import DiskFilePicker from './DiskFilePicker';

/** The send mutation shape (from useSendMessage) — kept generic so ChatRoom owns the hook. */
type SendMutation = UseMutationResult<ChatMessage, ApiError, SendMessageArgs>;

/** Result of one from-computer upload: the created file, or a terminal-failure reason. */
type UploadOutcome = DiskFile | 'error' | 'cancel';

/** A small thumbnail/glyph + name + size + remove ✕ for the currently pending attachment. */
function PendingChip({ file, onRemove }: { file: DiskFile; onRemove: () => void }) {
  return (
    <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-xl border border-edge bg-panel-2 py-1.5 pl-1.5 pr-2">
      <span className="size-9 shrink-0 overflow-hidden rounded-lg">
        <ImagePreview file={{ id: file.id, name: file.name, size: file.size }} glyphSize={18} />
      </span>
      <span className="min-w-0">
        <span className="block max-w-[12rem] truncate text-sm font-medium text-fg" title={file.name}>
          {file.name}
        </span>
        <span className="block text-xs tabular-nums text-muted">{formatBytes(file.size)}</span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Убрать вложение"
        className="grid size-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-panel hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ton"
      >
        <X size={15} strokeWidth={2} />
      </button>
    </div>
  );
}

/** Inline upload progress panel (percentage + bytes + cancel) — mirrors UploadButton. */
function UploadProgressPanel({
  fileName,
  pct,
  loaded,
  total,
  onCancel,
}: {
  fileName: string | null;
  pct: number;
  loaded: number;
  total: number;
  onCancel: () => void;
}) {
  return (
    <div className="mb-2 rounded-xl border border-edge bg-panel-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-fg" title={fileName ?? undefined}>
          {fileName ?? 'Загрузка…'}
        </p>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-ton">{pct}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full border border-edge bg-panel"
        role="progressbar"
        aria-label="Прогресс загрузки"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className="h-full rounded-full bg-ton-deep transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs tabular-nums text-muted">
          {formatBytes(loaded)}
          {total > 0 ? <> из {formatBytes(total)}</> : null}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          <X size={15} strokeWidth={2} />
          Отмена
        </Button>
      </div>
    </div>
  );
}

/** A tiny "M↓" affordance that opens a compact Markdown cheatsheet — so the formatting isn't a
 *  hidden feature. Click/tap (not hover) so it works on touch too. */
function MarkdownHint() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Подсказка по Markdown"
        title="Поддерживается Markdown"
        className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 font-mono text-xs font-bold text-muted transition-colors hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ton"
      >
        M↓
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute bottom-12 left-0 z-20 w-56 rounded-xl border border-edge bg-panel p-3 text-xs shadow-xl">
            <p className="mb-1.5 font-medium text-fg">Поддерживается Markdown</p>
            <ul className="space-y-1 text-muted">
              <li><code className="text-fg">**жирный**</code></li>
              <li><code className="text-fg">*курсив*</code></li>
              <li><code className="text-fg">`моноширинный`</code></li>
              <li><code className="text-fg">~~зачёркнутый~~</code></li>
              <li><code className="text-fg">- список</code></li>
              <li><code className="text-fg">&gt; цитата</code></li>
              <li><code className="text-fg">[текст](ссылка)</code></li>
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function Composer({ send, locked }: { send: SendMutation; locked: boolean }) {
  const [draft, setDraft] = useState('');
  // The pending attachments — files (uploaded from computer OR picked from disk) that will
  // ride along with the next send, one per message. Empty when nothing is attached.
  const [pending, setPending] = useState<DiskFile[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // True while the sequential from-computer upload loop is running (covers the gaps between
  // individual uploads, where upload.phase briefly leaves 'uploading'). Keeps send disabled
  // across the whole batch.
  const [uploadingBatch, setUploadingBatch] = useState(false);
  // True for the WHOLE multi-message send fan-out. send.isPending toggles per individual
  // mutateAsync, going false in the gaps between messages; this stays true across all of them
  // so the input/button don't briefly re-enable (and a second submit can't interleave).
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useUpload();
  const uploading = upload.phase === 'uploading' || uploadingBatch;
  const busy = sending || send.isPending;

  // A chat ban blocks sending everywhere. The feature lock (`locked`) only applies in the
  // global chat (decided by the parent). Both render an early-return banner below, so by
  // the time the form renders neither lock is active — hence `canSend` need not re-check.
  const banned = useMyBan().data;

  const canSend =
    (draft.trim() !== '' || pending.length > 0) && !uploading && !busy;

  // One pending upload's settler. `start`'s onDone resolves it with the created file on
  // SUCCESS; the phase-watching effect below resolves it with a failure reason on a terminal
  // FAILURE ('error', or 'cancel' = idle after a user abort) — useUpload's onDone fires only
  // on success, so the sequential loop would otherwise hang on a failed/cancelled file. Held
  // in a ref so the effect reaches the live resolver without re-subscribing, and the effect's
  // FRESH read of upload.phase (not the loop's stale render snapshot) decides the reason.
  const uploadResolveRef = useRef<((outcome: UploadOutcome) => void) | null>(null);
  // Previous upload phase, to fire the terminal resolver ONLY on a real uploading→terminal
  // transition — not on the idle blip that uploadOne's own reset() causes before start().
  const prevPhaseRef = useRef(upload.phase);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = upload.phase;
    // Resolve the in-flight uploadOne only when the controller leaves 'uploading' for a
    // terminal FAILURE: 'error', or 'idle' (the controller drops to idle on a user cancel).
    // Success is delivered by onDone (which clears the ref first), so it never reaches here.
    if (prev === 'uploading' && (upload.phase === 'error' || upload.phase === 'idle')) {
      const resolve = uploadResolveRef.current;
      if (resolve) {
        uploadResolveRef.current = null;
        resolve(upload.phase === 'error' ? 'error' : 'cancel');
      }
    }
  }, [upload.phase]);

  /**
   * Upload a single file via the existing single-flight useUpload, resolving with its DiskFile
   * on success or a reason ('error' | 'cancel') on a terminal failure. Success arrives through
   * start's onDone; failure arrives through the phase-watching effect.
   */
  function uploadOne(file: File): Promise<UploadOutcome> {
    return new Promise((resolve) => {
      uploadResolveRef.current = resolve;
      upload.reset();
      upload.start(file, (created) => {
        // Success: clear the ref BEFORE the effect can see the 'success' phase, then resolve.
        uploadResolveRef.current = null;
        resolve(created);
      });
    });
  }

  async function onPickFromComputer(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = ''; // allow re-picking the same files
    setMenuOpen(false);
    if (files.length === 0) return;

    // Upload ONE AT A TIME (useUpload is single-flight), pushing each result onto the pending
    // list as it lands. Stop on the first failure/cancel (its own error/idle UI explains why)
    // so the remaining files aren't silently dropped. uploadingBatch keeps send disabled across
    // the gaps between individual uploads where upload.phase momentarily isn't 'uploading'.
    setUploadingBatch(true);
    let errored = false;
    try {
      for (const file of files) {
        const outcome = await uploadOne(file);
        if (outcome === 'error' || outcome === 'cancel') {
          errored = outcome === 'error';
          break; // leave the remaining files for a retry
        }
        setPending((prev) => [...prev, outcome]);
      }
    } finally {
      setUploadingBatch(false);
      // Clear the trailing SUCCESS/idle panel, but keep an ERROR panel so the user sees why the
      // batch stopped. (reset() is a no-op mid-flight; here the controller has settled.)
      if (!errored) upload.reset();
    }
  }

  function pickFromDisk(files: DiskFile[]) {
    // Append picked cloud files, de-duped by id against what's already pending.
    setPending((prev) => {
      const have = new Set(prev.map((f) => f.id));
      return [...prev, ...files.filter((f) => !have.has(f.id))];
    });
    setPickerOpen(false);
  }

  function removePending(id: string) {
    setPending((prev) => prev.filter((f) => f.id !== id));
  }

  async function submit() {
    if (!canSend) return;
    const text = draft.trim();
    setSending(true);
    try {
      // No attachments → the original single text-message path.
      if (pending.length === 0) {
        await send.mutateAsync({ content: text });
        setDraft('');
        return;
      }

      // Fan-out: message #1 = text + first attachment; each remaining file = its own text-less
      // message. SEQUENTIAL (await each in order) so they arrive in order. On a mid-batch
      // failure we STOP and keep the not-yet-sent files (and, if message #1 failed, the text)
      // so the user can retry. `remaining` always holds exactly the attachments still to send;
      // `textSent` tracks whether message #1 (which carried the text) has gone through.
      let remaining = [...pending];
      let textSent = false;
      try {
        while (remaining.length > 0) {
          // Only the first message carries the typed text; the rest are text-less.
          const content = textSent ? '' : text;
          await send.mutateAsync({ content, attachmentId: remaining[0].id });
          textSent = true;
          remaining = remaining.slice(1);
          setPending(remaining); // shrink the chip row as each message lands
        }
        // Full success: clear the draft (pending is already []).
        setDraft('');
      } catch {
        // Stop on the first error. Keep the unsent attachments (already reflected in `pending`);
        // clear the text only once message #1 carried it through, so a retry can't double-post it.
        setPending(remaining);
        if (textSent) setDraft('');
        // The error itself is shown via send.isError above.
      }
    } catch {
      // The no-attachment path's mutateAsync rejected — surfaced via send.isError; keep the
      // draft for a retry.
    } finally {
      setSending(false);
    }
  }
  function onFormSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  // Banned: replace the input with a banner (reason + optional expiry). A ban blocks
  // sending in EVERY chat, so it wins over the feature lock.
  if (banned != null) {
    return (
      <div className="border-t border-edge p-4">
        <div className="flex flex-col items-start gap-1 rounded-xl border border-lose/40 bg-lose/5 p-3">
          <p className="text-sm font-medium text-lose">Вы заблокированы в чате</p>
          {banned.reason ? <p className="text-sm text-muted">Причина: {banned.reason}</p> : null}
          {banned.duration > 0 ? (
            <p className="text-xs text-muted">До {formatTime(banExpiry(banned), 'datetime')}</p>
          ) : null}
        </div>
      </div>
    );
  }

  // Not banned but feature-locked (global chat only — the parent decides): the same lock
  // banner the disk/gifts gates use. Unchanged behaviour, just relocated so the ban banner
  // can take precedence above.
  if (locked) {
    return (
      <div className="border-t border-edge p-4">
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted">
            Отправка сообщений откроется по мере роста вашего ранга.
          </p>
          <FeatureLock feature="SEND_MESSAGE" />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onFormSubmit} className="border-t border-edge p-3">
      {send.isError ? (
        <p className="mb-2 text-xs text-lose">
          {errorMessage(send.error, 'Не удалось отправить сообщение')}
        </p>
      ) : null}
      {upload.phase === 'error' ? (
        <p className="mb-2 text-xs text-lose">
          {errorMessage(upload.error, 'Не удалось загрузить файл')}
        </p>
      ) : null}

      {/* Pending attachment chips — one removable chip per queued file, wrapping across rows.
          They stay visible during a from-computer upload so already-queued files remain shown
          while the next one streams in below. */}
      {pending.length > 0 ? (
        <div className="-mb-0.5 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
          {pending.map((file) => (
            <PendingChip key={file.id} file={file} onRemove={() => removePending(file.id)} />
          ))}
        </div>
      ) : null}

      {/* Live upload progress (from-computer source) — the file currently streaming. */}
      {upload.phase === 'uploading' ? (
        <UploadProgressPanel
          fileName={upload.fileName}
          pct={Math.round(upload.progress.fraction * 100)}
          loaded={upload.progress.loaded}
          total={upload.progress.total}
          onCancel={upload.cancel}
        />
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onPickFromComputer}
      />

      <div className="flex items-end gap-2">
        <MarkdownHint />
        {/* Attach affordance: a paperclip that toggles a tiny two-source menu. */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={uploading || busy}
            aria-label="Прикрепить файл"
            title="Прикрепить файл"
            className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-muted transition-colors hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ton disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Paperclip size={18} strokeWidth={2} />
          </button>

          {menuOpen ? (
            <>
              {/* Click-away catcher under the menu. */}
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setMenuOpen(false)} />
              <div className="absolute bottom-12 left-0 z-20 w-48 overflow-hidden rounded-xl border border-edge bg-panel shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-fg transition-colors hover:bg-panel-2 focus:outline-none focus-visible:bg-panel-2"
                >
                  <Upload size={16} strokeWidth={2} className="text-muted" />
                  С устройства
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setPickerOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 border-t border-edge px-3 py-2.5 text-left text-sm text-fg transition-colors hover:bg-panel-2 focus:outline-none focus-visible:bg-panel-2"
                >
                  <HardDrive size={16} strokeWidth={2} className="text-muted" />
                  Из облака
                </button>
              </div>
            </>
          ) : null}
        </div>

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={1}
          placeholder="Сообщение…"
          disabled={busy}
          autoComplete="off"
          {...SUPPRESS_AUTOFILL}
          className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-edge bg-panel-2 px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-ton focus:outline-none disabled:opacity-50"
        />
        <Button type="submit" loading={busy} disabled={!canSend} className="h-11 shrink-0 px-4">
          {/* While an upload blocks send, hint why with the upload glyph. */}
          {uploading ? <FileUp size={16} strokeWidth={2} /> : <Send size={16} strokeWidth={2} />}
        </Button>
      </div>

      {pickerOpen ? (
        <DiskFilePicker onConfirm={pickFromDisk} onClose={() => setPickerOpen(false)} />
      ) : null}
    </form>
  );
}
