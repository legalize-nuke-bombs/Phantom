// CreateChatModal — start a new chat by picking its members up front, instead of the old
// "create an empty chat, get dropped into it, then add people" flow. The frontend doesn't have
// to mirror the backend's create-then-add steps: we collect members in one dialog, then create
// the (empty) chat and fan out one add/{id} request per picked member before navigating in.
//
// A 1:1 and a group are the SAME entity, so "no members picked" just makes an empty chat (you
// can add people later inside it); one member → a DM; several → a group. Adds are best-effort:
// if some fail, the chat still exists, so we keep the modal open and offer to jump in anyway.

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserPlus, X } from 'lucide-react';

import { api, ApiError } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import { chatsListKey, type Chat } from '@/shared/chat/chats';
import type { User } from '@/shared/types';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import UserChip from '@/shared/ui/UserChip';
import UserLookup from '@/shared/ui/UserLookup';

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
  const qc = useQueryClient();
  const [members, setMembers] = useState<User[]>([]);
  const [lookup, setLookup] = useState('');
  const [resolved, setResolved] = useState<User | null>(null);

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

  // Create the empty chat, then add each picked member one request at a time. A failed add is
  // collected (not thrown) so one bad member can't sink the whole chat; the result carries the
  // new chat id plus whoever didn't make it in.
  const create = useMutation<{ chatId: string; failed: User[] }, ApiError, User[]>({
    mutationFn: async (toAdd) => {
      const chat = await api.post<Chat>('/chat/chats');
      const failed: User[] = [];
      for (const m of toAdd) {
        try {
          await api.post(`/chat/chats/${chat.id}/add/${m.id}`);
        } catch {
          failed.push(m);
        }
      }
      return { chatId: chat.id, failed };
    },
    onSuccess: ({ chatId, failed }) => {
      void qc.invalidateQueries({ queryKey: chatsListKey });
      // Clean run → jump straight in. If some adds failed, stay open and let them decide
      // (the failed list is shown below with a "go in anyway" button).
      if (failed.length === 0) onCreated(chatId);
    },
  });

  const failed = create.data?.failed ?? [];
  const createdId = create.data?.chatId ?? null;

  // People routinely type a username and hit "Создать" without pressing "Добавить" first,
  // expecting a chat WITH that person — so fold a resolved-but-unadded lookup into the members
  // we create with, instead of silently making an empty chat.
  const effectiveMembers =
    resolved && !members.some((m) => m.id === resolved.id) ? [...members, resolved] : members;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Новый чат"
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
          <h2 className="text-lg font-semibold tracking-tight text-fg">Новый чат</h2>
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

        <p className="mb-3 text-sm text-muted">
          Добавьте участников по ID или @username. Можно создать и пустой чат — добавите людей позже.
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
          <p className="mt-3 text-sm text-lose">{errorMessage(create.error, 'Не удалось создать чат')}</p>
        ) : null}

        {failed.length > 0 && createdId ? (
          <div className="mt-3 flex flex-col items-start gap-2 rounded-xl border border-warn/40 bg-warn/10 p-3">
            <p className="text-sm text-warn">
              Чат создан, но не удалось добавить: {failed.map((f) => f.displayName).join(', ')}. Их можно
              добавить уже внутри чата.
            </p>
            <Button type="button" size="sm" onClick={() => onCreated(createdId)}>
              Перейти в чат
            </Button>
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={create.isPending}>
            Отмена
          </Button>
          {/* Hidden once a chat was made but adds failed — the "Перейти в чат" button above
              takes over so we don't create a second chat. */}
          {createdId && failed.length > 0 ? null : (
            <Button type="button" onClick={() => create.mutate(effectiveMembers)} loading={create.isPending}>
              {effectiveMembers.length > 0 ? `Создать · ${effectiveMembers.length}` : 'Создать'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
