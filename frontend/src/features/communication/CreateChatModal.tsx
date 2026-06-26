// CreateChatModal — start a new GROUP chat: a required name plus the members to seed it with,
// all in one dialog. The backend now creates the group and adds every picked member in a single
// atomic request (POST /chat/chats {type:'GROUP', name, userIds}), so there's no "create empty,
// then add one-by-one" dance and no partial-success state — it all lands or it errors as a whole.
//
// 1:1 chats are NOT made here: they're opened from a user's profile, where the deterministic P2
// id makes "Написать" duplicate-safe. This dialog is groups only.

import { useState } from 'react';
import { Plus, UserPlus, X } from 'lucide-react';

import { errorMessage } from '@/shared/api/errors';
import { useCreateGroupChat } from '@/shared/chat/chats';
import type { User } from '@/shared/types';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import UserChip from '@/shared/ui/UserChip';
import UserLookup from '@/shared/ui/UserLookup';

const MAX_NAME_LENGTH = 255; // mirrors PostChatRequest @Size(max = 255)

export default function CreateChatModal({
  myId,
  onClose,
  onCreated,
}: {
  myId: number;
  onClose: () => void;
  /** Navigate into the freshly-created chat (by string id). */
  onCreated: (chatId: string) => void;
}) {
  const [name, setName] = useState('');
  const [members, setMembers] = useState<User[]>([]);
  const [lookup, setLookup] = useState('');
  const [resolved, setResolved] = useState<User | null>(null);

  const create = useCreateGroupChat();

  const alreadyPicked = resolved != null && members.some((m) => m.id === resolved.id);
  const canAdd = resolved != null && !alreadyPicked;

  function addMember() {
    if (!resolved || alreadyPicked) return;
    setMembers((prev) => [...prev, resolved]);
    setLookup('');
    setResolved(null);
  }

  function removeMember(id: number) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  // People routinely type a username and hit "Создать" without pressing "Добавить" first,
  // expecting a group WITH that person — so fold a resolved-but-unadded lookup into the
  // members we create with, instead of silently dropping them.
  const effectiveMembers =
    resolved && !members.some((m) => m.id === resolved.id) ? [...members, resolved] : members;

  const trimmedName = name.trim();
  const canCreate = trimmedName.length > 0 && !create.isPending;

  function submit() {
    if (!canCreate) return;
    create.mutate(
      { name: trimmedName, userIds: effectiveMembers.map((m) => m.id) },
      { onSuccess: (chat) => onCreated(chat.id) },
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Новая группа"
    >
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 bg-black/60"
        onClick={() => {
          if (!create.isPending) onClose();
        }}
      />
      <Card className="relative z-10 w-full max-w-md rounded-b-none p-5 sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl border border-edge bg-panel-2 text-ton">
            <UserPlus size={18} />
          </span>
          <h2 className="text-lg font-semibold tracking-tight text-fg">Новая группа</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={create.isPending}
            aria-label="Закрыть"
            className="ml-auto grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-fg disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Group name — required. */}
        <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor="group-name">
          Название группы
        </label>
        <input
          id="group-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          disabled={create.isPending}
          placeholder="Например, «Хайроллеры»"
          className="mb-4 w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ton disabled:opacity-50"
          autoFocus
        />

        <p className="mb-3 text-sm text-muted">
          Добавьте участников по ID или @username. Можно создать группу и без них — добавите позже внутри.
        </p>

        {/* Member picker: resolve one user, then "Добавить" pushes them to the list. */}
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <UserLookup
              value={lookup}
              onChange={setLookup}
              onResolve={setResolved}
              excludeId={myId}
              excludeMessage="Это вы"
              placeholder="ID или @username"
              disabled={create.isPending}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={addMember}
            disabled={!canAdd || create.isPending}
            className="shrink-0 px-3"
          >
            <Plus size={16} />
            Добавить
          </Button>
        </div>
        {alreadyPicked ? <p className="mt-1 text-xs text-muted">Уже добавлен</p> : null}

        {/* Picked members — removable rows. */}
        {members.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-xl border border-edge bg-panel-2 px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <UserChip user={m} level={null} size={28} />
                </div>
                <button
                  type="button"
                  onClick={() => removeMember(m.id)}
                  disabled={create.isPending}
                  aria-label={`Убрать ${m.displayName}`}
                  className="grid size-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-panel hover:text-fg disabled:opacity-50"
                >
                  <X size={15} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {create.isError ? (
          <p className="mt-3 text-sm text-lose">{errorMessage(create.error, 'Не удалось создать группу')}</p>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={create.isPending}>
            Отмена
          </Button>
          <Button type="button" onClick={submit} disabled={!canCreate} loading={create.isPending}>
            {effectiveMembers.length > 0 ? `Создать · ${effectiveMembers.length}` : 'Создать'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
