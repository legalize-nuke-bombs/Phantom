// CreateChatModal — "Новый чат": pick a type (личный / группа / избранное), fill the form for
// that type, create, and jump in. Every type funnels into the chat-entity layer:
//   • Личный   → useStartDirectChat (deterministic P2 — duplicate-safe get-or-create)
//   • Группа   → useCreateGroupChat (required name + members, one atomic create)
//   • Избранное → useOpenFavorites (the single private saved-messages chat; get-or-create)
// onCreated(chatId) navigates into the resulting chat.

import { useState } from 'react';
import { Bookmark, MessageSquare, Plus, User as UserIcon, Users, X } from 'lucide-react';

import { errorMessage } from '@/shared/api/errors';
import {
  useCreateGroupChat,
  useOpenFavorites,
  useStartDirectChat,
} from '@/shared/chat/chats';
import type { User } from '@/shared/types';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import UserChip from '@/shared/ui/UserChip';
import UserLookup from '@/shared/ui/UserLookup';
import clsx from 'clsx';

const MAX_NAME_LENGTH = 255; // mirrors PostChatRequest @Size(max = 255)

type Tab = 'p2' | 'group' | 'favorites';

const TABS: { key: Tab; label: string; icon: typeof UserIcon }[] = [
  { key: 'p2', label: 'Личный', icon: UserIcon },
  { key: 'group', label: 'Группа', icon: Users },
  { key: 'favorites', label: 'Избранное', icon: Bookmark },
];

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
  const [tab, setTab] = useState<Tab>('p2');

  // Shared lookup state (used by both личный + группа member pickers).
  const [lookup, setLookup] = useState('');
  const [resolved, setResolved] = useState<User | null>(null);

  // Группа-specific state.
  const [name, setName] = useState('');
  const [members, setMembers] = useState<User[]>([]);

  const startChat = useStartDirectChat();
  const createGroup = useCreateGroupChat();
  const openFavorites = useOpenFavorites();
  const pending = startChat.isPending || createGroup.isPending || openFavorites.isPending;

  function switchTab(next: Tab) {
    if (pending) return;
    setTab(next);
    setLookup('');
    setResolved(null);
  }

  /* ── личный ── */
  function createP2() {
    if (!resolved) return;
    startChat.mutate(resolved.id, { onSuccess: onCreated });
  }

  /* ── группа ── */
  const alreadyPicked = resolved != null && members.some((m) => m.id === resolved.id);
  function addMember() {
    if (!resolved || alreadyPicked) return;
    setMembers((prev) => [...prev, resolved]);
    setLookup('');
    setResolved(null);
  }
  function removeMember(id: number) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }
  // Fold a resolved-but-unadded lookup into the members we create with, so typing a name and
  // hitting "Создать" doesn't silently drop that person.
  const effectiveMembers =
    resolved && !members.some((m) => m.id === resolved.id) ? [...members, resolved] : members;
  const trimmedName = name.trim();
  function createGroupChat() {
    if (trimmedName.length === 0) return;
    createGroup.mutate(
      { name: trimmedName, userIds: effectiveMembers.map((m) => m.id) },
      { onSuccess: (chat) => onCreated(chat.id) },
    );
  }

  /* ── избранное ── */
  function openFav() {
    openFavorites.mutate(undefined, { onSuccess: onCreated });
  }

  const error = startChat.error || createGroup.error || openFavorites.error;

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
          if (!pending) onClose();
        }}
      />
      <Card className="relative z-10 w-full max-w-md rounded-b-none p-5 sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl border border-edge bg-panel-2 text-ton">
            <MessageSquare size={18} />
          </span>
          <h2 className="text-lg font-semibold tracking-tight text-fg">Новый чат</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Закрыть"
            className="ml-auto grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-fg disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Type switch */}
        <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-edge bg-panel-2 p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => switchTab(key)}
              disabled={pending}
              className={clsx(
                'flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
                tab === key ? 'bg-ton-deep text-white' : 'text-muted hover:text-fg',
              )}
            >
              <Icon size={15} strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>

        {/* ── ЛИЧНЫЙ ── */}
        {tab === 'p2' ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">Найдите игрока по ID или @username — откроется личный чат.</p>
            <UserLookup
              value={lookup}
              onChange={setLookup}
              onResolve={setResolved}
              excludeId={myId}
              excludeMessage="Это вы"
              placeholder="ID или @username"
              disabled={pending}
            />
            <Button onClick={createP2} disabled={!resolved} loading={startChat.isPending} className="w-full">
              <MessageSquare size={16} />
              Написать
            </Button>
          </div>
        ) : null}

        {/* ── ГРУППА ── */}
        {tab === 'group' ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor="group-name">
                Название группы
              </label>
              <input
                id="group-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_NAME_LENGTH}
                disabled={pending}
                placeholder="Например, «Хайроллеры»"
                className="w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ton disabled:opacity-50"
              />
            </div>

            <p className="text-sm text-muted">Добавьте участников (необязательно — можно позже внутри).</p>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <UserLookup
                  value={lookup}
                  onChange={setLookup}
                  onResolve={setResolved}
                  excludeId={myId}
                  excludeMessage="Это вы"
                  placeholder="ID или @username"
                  disabled={pending}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={addMember}
                disabled={!resolved || alreadyPicked || pending}
                className="shrink-0 px-3"
              >
                <Plus size={16} />
                Добавить
              </Button>
            </div>
            {alreadyPicked ? <p className="-mt-1 text-xs text-muted">Уже добавлен</p> : null}

            {members.length > 0 ? (
              <ul className="flex flex-col gap-2">
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
                      disabled={pending}
                      aria-label={`Убрать ${m.displayName}`}
                      className="grid size-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-panel hover:text-fg disabled:opacity-50"
                    >
                      <X size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <Button
              onClick={createGroupChat}
              disabled={trimmedName.length === 0}
              loading={createGroup.isPending}
              className="w-full"
            >
              {effectiveMembers.length > 0 ? `Создать · ${effectiveMembers.length}` : 'Создать группу'}
            </Button>
          </div>
        ) : null}

        {/* ── ИЗБРАННОЕ ── */}
        {tab === 'favorites' ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3 rounded-xl border border-edge bg-panel-2 p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-edge bg-panel text-ice">
                <Bookmark size={18} strokeWidth={2} />
              </span>
              <p className="text-sm text-muted">
                Личное пространство для заметок, ссылок и файлов — видно только вам. У вас оно одно.
              </p>
            </div>
            <Button onClick={openFav} loading={openFavorites.isPending} className="w-full">
              <Bookmark size={16} />
              Открыть избранное
            </Button>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm text-lose">{errorMessage(error, 'Не удалось создать чат')}</p>
        ) : null}
      </Card>
    </div>
  );
}
