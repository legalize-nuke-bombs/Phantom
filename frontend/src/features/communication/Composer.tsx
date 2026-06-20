// Composer — the chat message input row: a textarea, an attach affordance (paperclip →
// "from computer" / "from disk"), a pending-attachment chip, an inline upload progress
// panel, and the send button. Lifted out of ChatRoom so all the attach/upload/ban state
// lives in one place; ChatRoom keeps the message list.
//
// Attaching has two sources:
//   1. From computer — a hidden <input type=file>; the pick uploads via the disk XHR
//      uploader (useUpload: streams huge files, live progress, cancel). The send button
//      stays DISABLED until the upload completes; on success its returned DiskFile becomes
//      the pending attachment (its id == the message attachmentId).
//   2. From disk — DiskFilePicker (reuses the disk file list); the picked file becomes the
//      pending attachment directly (no upload — it already lives in the cloud).
//
// Send is enabled when (draft has text OR there's a pending attachment) AND nothing blocks
// it (not uploading, not locked, not already sending). An attachment-only send posts
// content: '' + attachmentId — the backend accepts that.
//
// Locking: a chat BAN blocks sending in every chat; the existing global-only feature lock
// blocks sending in the global chat. `locked` (the feature lock — the parent passes
// featureLocked && global) and the ban are combined here: the composer is locked when
// banned OR locked. Banner precedence is banned → ban banner, else locked → feature-lock
// banner, else the input. The textarea/buttons disable whenever either applies.

import { useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
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
import { formatBytes, useUpload, type DiskFile } from '@/features/disk/useDisk';

import DiskFilePicker from './DiskFilePicker';

/** The send mutation shape (from useSendMessage) — kept generic so ChatRoom owns the hook. */
type SendMutation = UseMutationResult<ChatMessage, ApiError, SendMessageArgs>;

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

export default function Composer({ send, locked }: { send: SendMutation; locked: boolean }) {
  const [draft, setDraft] = useState('');
  // The pending attachment — a file (uploaded from computer OR picked from disk) that will
  // ride along with the next send. Null when there's nothing attached.
  const [pending, setPending] = useState<DiskFile | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useUpload();
  const uploading = upload.phase === 'uploading';

  // A chat ban blocks sending everywhere. The feature lock (`locked`) only applies in the
  // global chat (decided by the parent). Both render an early-return banner below, so by
  // the time the form renders neither lock is active — hence `canSend` need not re-check.
  const banned = useMyBan().data;

  const canSend =
    (draft.trim() !== '' || pending != null) && !uploading && !send.isPending;

  function onPickFromComputer(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    setMenuOpen(false);
    if (!file) return;
    upload.reset();
    // On success the uploader hands back the created DiskFile: promote it to the pending
    // attachment and reset the uploader so its success panel doesn't linger. Driven by the
    // completion callback (a promise resolution, not render) — no state-watching effect.
    upload.start(file, (created) => {
      setPending(created);
      upload.reset();
    });
  }

  function pickFromDisk(file: DiskFile) {
    setPending(file);
    setPickerOpen(false);
  }

  function clearPending() {
    setPending(null);
  }

  function submit() {
    if (!canSend) return;
    // Attachment-only sends post content: '' (backend accepts content+attachment).
    send.mutate(
      { content: draft.trim(), attachmentId: pending?.id },
      {
        onSuccess: () => {
          setDraft('');
          setPending(null);
        },
      },
    );
  }
  function onFormSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
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

      {/* Pending attachment chip (when one is set and not mid-upload). */}
      {pending && !uploading ? <PendingChip file={pending} onRemove={clearPending} /> : null}

      {/* Live upload progress (from-computer source). */}
      {uploading ? (
        <UploadProgressPanel
          fileName={upload.fileName}
          pct={Math.round(upload.progress.fraction * 100)}
          loaded={upload.progress.loaded}
          total={upload.progress.total}
          onCancel={upload.cancel}
        />
      ) : null}

      <input ref={fileInputRef} type="file" className="hidden" onChange={onPickFromComputer} />

      <div className="flex items-end gap-2">
        {/* Attach affordance: a paperclip that toggles a tiny two-source menu. */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={uploading || send.isPending}
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
          disabled={send.isPending}
          className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-edge bg-panel-2 px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-ton focus:outline-none disabled:opacity-50"
        />
        <Button type="submit" loading={send.isPending} disabled={!canSend} className="h-11 shrink-0 px-4">
          {/* While an upload blocks send, hint why with the upload glyph. */}
          {uploading ? <FileUp size={16} strokeWidth={2} /> : <Send size={16} strokeWidth={2} />}
        </Button>
      </div>

      {pickerOpen ? (
        <DiskFilePicker onSelect={pickFromDisk} onClose={() => setPickerOpen(false)} />
      ) : null}
    </form>
  );
}
