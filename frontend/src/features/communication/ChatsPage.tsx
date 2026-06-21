// Chats hub — lists MY personal & group chats and lets me start a new one. A 1:1 DM and a
// group are the SAME entity (a Chat), so one list shows both; the row's look adapts to its
// kind. "Новый чат" creates an EMPTY chat (just me) and drops me into its conversation,
// where I add members. Opening a row routes to chat/groups/:chatId (the conversation page).
//
// Reuses the chat-entity layer in shared/chat/chats.ts; messaging itself lives in ChatRoom.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, MessagesSquare, Plus, Users } from 'lucide-react';
import clsx from 'clsx';

import { useAuth } from '@/shared/auth/AuthContext';
import { errorMessage } from '@/shared/api/errors';
import { reconcileChatBadges, useUnreadCount } from '@/shared/realtime/badges';
import { levelFor, useExperienceBatch } from '@/shared/lib/experience';
import { FeatureLock, useFeatureGate } from '@/shared/lib/levelFeatures';
import { useMyBan } from '@/shared/chat/ban';
import Button from '@/shared/ui/Button';
import RankBadge from '@/shared/ui/RankBadge';
import Spinner from '@/shared/ui/Spinner';
import {
  chatKind,
  chatTitle,
  otherMembers,
  useMyChats,
  type Chat,
} from '@/shared/chat/chats';
import { useConsumesNotifications } from '@/shared/realtime/activeViews';
import CreateChatModal from './CreateChatModal';

/** The unread pill for one chat row — reads the per-chat bucket, hidden at zero. */
function RowBadge({ chatId }: { chatId: string }) {
  const count = useUnreadCount(`chat:${chatId}`);
  if (count <= 0) return null;
  return (
    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-ton-deep px-1.5 text-[11px] font-bold leading-none text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** Avatar for a row: the other user's RankBadge for a DM, a group glyph otherwise. */
function RowAvatar({ chat, myId, level }: { chat: Chat; myId: number; level: ReturnType<typeof levelFor> }) {
  const kind = chatKind(chat, myId);
  if (kind === 'dm') {
    return <RankBadge level={level} size={44} className="shrink-0" />;
  }
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-edge bg-panel-2 text-ice">
      {kind === 'group' ? <Users size={20} strokeWidth={2} /> : <MessagesSquare size={20} strokeWidth={2} />}
    </span>
  );
}

/** One chat row — avatar, title, a member-count / kind subline, unread badge. */
function ChatRow({ chat, myId, level }: { chat: Chat; myId: number; level: ReturnType<typeof levelFor> }) {
  const navigate = useNavigate();
  const kind = chatKind(chat, myId);

  const subline =
    kind === 'group'
      ? `${chat.members.length} участников`
      : kind === 'dm'
        ? 'Личный чат'
        : 'Добавьте участников';

  return (
    <button
      type="button"
      onClick={() => navigate(`/chat/groups/${chat.id}`)}
      className={clsx(
        'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
        'hover:bg-panel-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ton',
      )}
    >
      <RowAvatar chat={chat} myId={myId} level={level} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{chatTitle(chat, myId)}</p>
        <p className="truncate text-xs text-muted">{subline}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* Just the unread pill — the chat's creation time isn't useful here, so it's
            been dropped from the row. */}
        <RowBadge chatId={chat.id} />
      </div>
    </button>
  );
}

/** Each row needs the OTHER user's rank for the DM avatar; batch-load the whole page's. */
function ChatList({ chats, myId }: { chats: Chat[]; myId: number }) {
  // Collect every "other" user id across DMs so we resolve ranks in one batched request.
  const otherIds = chats
    .map((c) => (chatKind(c, myId) === 'dm' ? otherMembers(c, myId)[0]?.user.id : undefined))
    .filter((id): id is number => id != null);
  const exp = useExperienceBatch(otherIds);

  return (
    <div className="flex flex-col p-1.5">
      {chats.map((chat) => {
        const otherId = chatKind(chat, myId) === 'dm' ? otherMembers(chat, myId)[0]?.user.id : undefined;
        const level = otherId != null ? levelFor(exp.data, otherId) : null;
        return <ChatRow key={chat.id} chat={chat} myId={myId} level={level} />;
      })}
    </div>
  );
}

export default function ChatsPage() {
  const { user } = useAuth();
  const myId = user?.id ?? 0;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const list = useMyChats();
  const [createOpen, setCreateOpen] = useState(false);
  // Creating a chat needs the chat feature (backend refuses otherwise), so gate the
  // "Новый чат" action on SEND_MESSAGE — same feature that gates messaging.
  const createGate = useFeatureGate('SEND_MESSAGE');
  // A ban blocks creating chats too (backend refuses), so fold it into the same lock.
  const banned = useMyBan().data != null;
  const createLocked = createGate.locked || banned;

  // Being on the chats list shows new chats the moment they appear, so the "вас добавили в
  // чат" signal (NEW_CHAT) is consumed here — marked read on arrival, no badge. Incoming
  // MESSAGE_RECEIVED is NOT consumed (the list never opens the chat), so rows still badge.
  useConsumesNotifications((env) => env.type === 'NEW_CHAT');

  const chats = list.data ?? [];

  // On open we load the COMPLETE chat list; once it's in, reconcile chat badges — any unread
  // for a chat no longer in the list (deleted / kicked / left) is stranded and can never be
  // opened to clear, so mark it read. Runs on each fresh load (keyed on the data identity).
  useEffect(() => {
    if (!list.data) return;
    void reconcileChatBadges(new Set<string>(['1', ...list.data.map((c) => c.id)]));
  }, [list.data]);

  function openCreate() {
    if (createLocked) return;
    setCreateOpen(true);
  }

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <header className="flex shrink-0 items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Чаты</h1>
        <div className="ml-auto flex items-center gap-2">
          {/* The lock hint sits beside the disabled button while the chat feature is
              still locked; FeatureLock renders nothing once unlocked. */}
          {banned ? (
            <span className="inline-flex items-center gap-1 text-xs text-lose">
              <Ban size={12} /> Вы заблокированы
            </span>
          ) : (
            <FeatureLock feature="SEND_MESSAGE" />
          )}
          <Button size="sm" onClick={openCreate} disabled={createLocked}>
            <Plus size={16} />
            Новый чат
          </Button>
        </div>
      </header>

      {/* One full-height block; the list scrolls INSIDE it, the page itself never scrolls. */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-edge bg-panel">
        <div className="h-full overflow-y-auto">
          {list.isLoading ? (
            <div className="grid h-full place-items-center">
              <Spinner size={28} />
            </div>
          ) : list.isError ? (
            <div className="grid h-full place-items-center p-10 text-center">
              <div className="max-w-sm">
                <p className="text-sm text-lose">{errorMessage(list.error, 'Не удалось загрузить чаты')}</p>
                <Button
                  variant="ghost"
                  className="mt-4"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['chats', 'list'] })}
                >
                  Повторить
                </Button>
              </div>
            </div>
          ) : chats.length === 0 ? (
            <div className="grid h-full place-items-center p-6 text-center">
              <div className="flex flex-col items-center gap-2">
                <MessagesSquare size={28} className="text-muted" />
                <p className="text-sm font-medium text-fg">Пока нет чатов</p>
                <p className="text-xs text-muted">Создайте чат кнопкой «Новый чат» вверху справа</p>
              </div>
            </div>
          ) : (
            <ChatList chats={chats} myId={myId} />
          )}
        </div>
      </div>

      {createOpen ? (
        <CreateChatModal
          myId={myId}
          onClose={() => setCreateOpen(false)}
          onCreated={(chatId) => {
            setCreateOpen(false);
            navigate(`/chat/groups/${chatId}`);
          }}
        />
      ) : null}
    </div>
  );
}
