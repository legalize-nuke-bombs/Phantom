// Members panel for one chat — a slide-over sheet listing members (owner marked) with the
// membership actions. Eldest member (members[0]) is the de-facto OWNER: only they can add
// or kick; everyone can leave; the owner can delete the whole chat. After a leave/delete the
// chat is gone for me, so the caller navigates back to the list (onClosed).

import { useEffect, useState } from 'react';
import { Ban, Crown, LogOut, Trash2, UserPlus, X } from 'lucide-react';
import clsx from 'clsx';

import { useAuth } from '@/shared/auth/AuthContext';
import { errorMessage } from '@/shared/api/errors';
import { levelFor, useExperienceBatch } from '@/shared/lib/experience';
import { FeatureLock, useFeatureGate } from '@/shared/lib/levelFeatures';
import { useMyBan } from '@/shared/chat/ban';
import type { User } from '@/shared/types';
import Button from '@/shared/ui/Button';
import UserChip from '@/shared/ui/UserChip';
import UserLookup from '@/shared/ui/UserLookup';
import {
  chatOwnerId,
  useAddMember,
  useDeleteChat,
  useKickMember,
  useLeaveChat,
  type Chat,
  type ChatMember,
} from '@/shared/chat/chats';

/**
 * Inline two-step confirm row for a destructive footer action: a prompt plus a
 * danger-styled confirm and a cancel, replacing the original button in place. Keeps the
 * confirmation in the footer's flow (no separate dialog) — works the same on touch.
 */
function ConfirmRow({
  prompt,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
}: {
  prompt: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-lose/40 bg-lose/5 p-2">
      <p className="px-1 text-xs text-muted">{prompt}</p>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onConfirm}
          loading={loading}
          className="flex-1 border-lose/40 text-lose hover:bg-lose/10"
        >
          {confirmLabel}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading} className="flex-1">
          Отмена
        </Button>
      </div>
    </div>
  );
}

/** One member row: chip + (owner crown | kick button, owner-only for others). */
function MemberRow({
  member,
  level,
  isOwner,
  canManage,
  onKick,
  kicking,
}: {
  member: ChatMember;
  level: ReturnType<typeof levelFor>;
  isOwner: boolean;
  canManage: boolean;
  onKick: () => void;
  kicking: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-2">
      <div className="min-w-0 flex-1">
        <UserChip user={member.user} level={level} size={32} />
      </div>
      {isOwner ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-edge bg-panel-2 px-2 py-0.5 text-[11px] text-ice">
          <Crown size={12} strokeWidth={2} />
          Владелец
        </span>
      ) : canManage ? (
        <Button variant="ghost" size="sm" onClick={onKick} loading={kicking} className="shrink-0">
          Исключить
        </Button>
      ) : null}
    </div>
  );
}

function AddMemberField({ chatId, myId }: { chatId: string; myId: number }) {
  const [value, setValue] = useState('');
  const [resolved, setResolved] = useState<User | null>(null);
  const addMember = useAddMember(chatId);
  // Adding a member needs the chat feature (backend refuses otherwise) — gate the
  // action on SEND_MESSAGE, the same feature that gates messaging/creating chats. A ban
  // blocks it too, so fold both into one lock.
  const gate = useFeatureGate('SEND_MESSAGE');
  const banned = useMyBan().data != null;
  const addLocked = gate.locked || banned;

  function handleAdd() {
    if (!resolved || addLocked) return;
    addMember.mutate(resolved.id, {
      onSuccess: () => {
        setValue('');
        setResolved(null);
      },
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <UserLookup
        value={value}
        onChange={setValue}
        onResolve={setResolved}
        excludeId={myId}
        excludeMessage="Это вы"
        placeholder="ID или @username"
      />
      <div className="flex items-center gap-2">
        <Button
          onClick={handleAdd}
          disabled={!resolved || addLocked}
          loading={addMember.isPending}
          className="flex-1"
        >
          <UserPlus size={16} />
          Добавить
        </Button>
        {/* Lock hint beside the disabled button; renders nothing once unlocked. */}
        {banned ? (
          <span className="inline-flex items-center gap-1 text-xs text-lose">
            <Ban size={12} /> Заблокированы
          </span>
        ) : (
          <FeatureLock feature="SEND_MESSAGE" />
        )}
      </div>
      {addMember.isError ? (
        <p className="text-xs text-lose">{errorMessage(addMember.error, 'Не удалось добавить участника')}</p>
      ) : null}
    </div>
  );
}

export interface ChatMembersPanelProps {
  chat: Chat;
  open: boolean;
  onClose: () => void;
  /** Called after a successful leave/delete — the chat no longer exists for me. */
  onClosed: () => void;
}

export default function ChatMembersPanel({ chat, open, onClose, onClosed }: ChatMembersPanelProps) {
  const { user } = useAuth();
  const myId = user?.id ?? 0;
  const chatId = chat.id;

  const ownerId = chatOwnerId(chat);
  const amOwner = ownerId != null && ownerId === myId;

  const exp = useExperienceBatch(chat.members.map((m) => m.user.id));

  const kickMember = useKickMember(chatId);
  const leaveChat = useLeaveChat(chatId);
  const deleteChat = useDeleteChat(chatId);

  // Leaving / deleting is irreversible (and a delete wipes the chat for everyone), so
  // both ask first via a two-step inline confirm. `confirm` tracks which destructive
  // action is armed; null = the normal footer.
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null);

  // Lock body scroll while the sheet is open (it overlays the conversation).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset any armed confirmation whenever the sheet closes, so reopening starts clean.
  useEffect(() => {
    if (!open) setConfirm(null);
  }, [open]);

  function handleLeave() {
    leaveChat.mutate(undefined, { onSuccess: onClosed });
  }
  function handleDelete() {
    deleteChat.mutate(undefined, { onSuccess: onClosed });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={clsx(
          'fixed inset-0 z-40 bg-black/60 transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden
      />
      {/* Right-side sheet */}
      <aside
        className={clsx(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-edge bg-panel shadow-xl transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        role="dialog"
        aria-label="Участники чата"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-edge px-4">
          <h2 className="text-sm font-semibold text-fg">
            Участники · {chat.members.length}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="text-muted transition-colors hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ton"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {/* Owner-only: add a member */}
          {amOwner ? <AddMemberField chatId={chatId} myId={myId} /> : null}

          {/* Member list */}
          <div className="divide-y divide-edge">
            {chat.members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                level={levelFor(exp.data, member.user.id)}
                isOwner={member.user.id === ownerId}
                canManage={amOwner && member.user.id !== myId}
                onKick={() => kickMember.mutate(member.user.id)}
                kicking={kickMember.isPending && kickMember.variables === member.user.id}
              />
            ))}
          </div>

          {kickMember.isError ? (
            <p className="text-xs text-lose">{errorMessage(kickMember.error, 'Не удалось исключить участника')}</p>
          ) : null}
        </div>

        {/* Footer actions: leave (anyone), delete (owner). Both destructive actions are
            two-step — the first click arms an inline "точно?" confirm row in place. */}
        <footer className="flex shrink-0 flex-col gap-2 border-t border-edge p-4">
          {amOwner ? (
            confirm === 'delete' ? (
              <ConfirmRow
                prompt="Удалить чат безвозвратно?"
                confirmLabel="Удалить"
                onConfirm={handleDelete}
                onCancel={() => setConfirm(null)}
                loading={deleteChat.isPending}
              />
            ) : (
              <Button
                variant="ghost"
                onClick={() => setConfirm('delete')}
                className="border-lose/40 text-lose hover:bg-lose/10"
              >
                <Trash2 size={16} />
                Удалить чат
              </Button>
            )
          ) : null}

          {confirm === 'leave' ? (
            <ConfirmRow
              prompt="Выйти из чата?"
              confirmLabel="Выйти"
              onConfirm={handleLeave}
              onCancel={() => setConfirm(null)}
              loading={leaveChat.isPending}
            />
          ) : (
            <Button variant="ghost" onClick={() => setConfirm('leave')}>
              <LogOut size={16} />
              Выйти из чата
            </Button>
          )}

          {leaveChat.isError ? (
            <p className="text-xs text-lose">{errorMessage(leaveChat.error, 'Не удалось выйти из чата')}</p>
          ) : null}
          {deleteChat.isError ? (
            <p className="text-xs text-lose">{errorMessage(deleteChat.error, 'Не удалось удалить чат')}</p>
          ) : null}
        </footer>
      </aside>
    </>
  );
}
