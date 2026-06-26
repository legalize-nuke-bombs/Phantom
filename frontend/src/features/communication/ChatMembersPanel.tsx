// Members panel for one chat — a slide-over sheet listing members with the membership actions
// that are legal FOR THIS CHAT TYPE:
//   • GROUP — eldest member (members[0]) is the de-facto OWNER: only they add / kick / delete;
//             everyone else can leave.
//   • P2    — a 1:1: no add / kick / leave (the backend forbids them); either side can delete
//             the conversation (it's wiped for both).
//   • FAVORITES never opens this panel (handled by ChatConversationPage), but if it ever did,
//     only delete is offered.
// After a leave/delete the chat is gone for me, so the caller navigates back to the list (onLeft).

import { useState } from 'react';
import { Ban, Crown, LogOut, Trash2, UserPlus } from 'lucide-react';

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
  /** Called after a successful leave/delete — the chat no longer exists for me. */
  onLeft: () => void;
}

/**
 * The members panel, rendered in a slide-over drawer. Lists members and offers exactly the
 * actions legal for the chat's type (see file header). After a leave/delete the chat is gone
 * for me, so the caller navigates away (onLeft).
 */
export default function ChatMembersPanel({ chat, onLeft }: ChatMembersPanelProps) {
  const { user } = useAuth();
  const myId = user?.id ?? 0;
  const chatId = chat.id;

  const isGroup = chat.type === 'GROUP';
  const ownerId = chatOwnerId(chat);
  const amOwner = ownerId != null && ownerId === myId;

  // Group: owner manages members, anyone can leave. P2/FAVORITES: no add/kick/leave; either
  // member can delete (a P2 delete wipes the conversation for BOTH sides).
  const canManageMembers = isGroup && amOwner;
  const canLeave = isGroup;
  const canDelete = isGroup ? amOwner : true;

  const deleteLabel =
    chat.type === 'GROUP' ? 'Удалить чат' : chat.type === 'P2' ? 'Удалить переписку' : 'Удалить избранное';
  const deletePrompt =
    chat.type === 'GROUP'
      ? 'Удалить чат безвозвратно?'
      : chat.type === 'P2'
        ? 'Удалить переписку? Сообщения исчезнут у обоих участников.'
        : 'Удалить избранное безвозвратно?';

  const exp = useExperienceBatch(chat.members.map((m) => m.user.id));

  const kickMember = useKickMember(chatId);
  const leaveChat = useLeaveChat(chatId);
  const deleteChat = useDeleteChat(chatId);

  // Leaving / deleting is irreversible (and a delete wipes the chat for everyone), so both
  // ask first via a two-step inline confirm. `confirm` tracks which action is armed.
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null);

  function handleLeave() {
    leaveChat.mutate(undefined, { onSuccess: onLeft });
  }
  function handleDelete() {
    deleteChat.mutate(undefined, { onSuccess: onLeft });
  }

  return (
    <aside
      className="flex h-full flex-col overflow-hidden rounded-xl border border-edge bg-panel"
      aria-label="Участники чата"
    >
      <header className="flex h-11 shrink-0 items-center border-b border-edge px-4">
        <h2 className="text-sm font-semibold text-fg">Участники · {chat.members.length}</h2>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {/* Owner-only (group): add a member */}
        {canManageMembers ? <AddMemberField chatId={chatId} myId={myId} /> : null}

        {/* Member list */}
        <div className="divide-y divide-edge">
          {chat.members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              level={levelFor(exp.data, member.user.id)}
              isOwner={isGroup && member.user.id === ownerId}
              canManage={canManageMembers && member.user.id !== myId}
              onKick={() => kickMember.mutate(member.user.id)}
              kicking={kickMember.isPending && kickMember.variables === member.user.id}
            />
          ))}
        </div>

        {kickMember.isError ? (
          <p className="text-xs text-lose">{errorMessage(kickMember.error, 'Не удалось исключить участника')}</p>
        ) : null}
      </div>

      {/* Footer actions: delete (per type), and leave (groups only). Both are two-step — the
          first click arms an inline "точно?" confirm row in place. */}
      <footer className="flex shrink-0 flex-col gap-2 border-t border-edge p-4">
        {canDelete ? (
          confirm === 'delete' ? (
            <ConfirmRow
              prompt={deletePrompt}
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
              {deleteLabel}
            </Button>
          )
        ) : null}

        {canLeave ? (
          confirm === 'leave' ? (
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
          )
        ) : null}

        {leaveChat.isError ? (
          <p className="text-xs text-lose">{errorMessage(leaveChat.error, 'Не удалось выйти из чата')}</p>
        ) : null}
        {deleteChat.isError ? (
          <p className="text-xs text-lose">{errorMessage(deleteChat.error, 'Не удалось удалить чат')}</p>
        ) : null}
      </footer>
    </aside>
  );
}
