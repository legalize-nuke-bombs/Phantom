// One chat's conversation (route: chat/groups/:chatId). A fixed-height header sits above the
// ChatRoom core (a black box keyed by a string chatId — we never touch its internals). The
// header adapts to the chat TYPE:
//   • P2        — the other user's avatar + name is a link to their profile, plus a "⋯" menu
//                 whose only action is "Удалить переписку". No members panel — it's a 1:1.
//   • FAVORITES — a bookmark glyph + "Избранное". Nothing to manage, so no menu / no panel.
//   • GROUP     — avatar + name + a "Участники" button that opens the members drawer (add/kick/
//                 leave/delete live there).

import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, MoreVertical, Trash2, Users, X } from 'lucide-react';

import ChatRoom from '@/features/communication/ChatRoom';
import ChatMembersPanel from '@/features/communication/ChatMembersPanel';
import { useAuth } from '@/shared/auth/AuthContext';
import { errorMessage } from '@/shared/api/errors';
import { levelFor, useExperienceBatch } from '@/shared/lib/experience';
import RankBadge from '@/shared/ui/RankBadge';
import Spinner from '@/shared/ui/Spinner';
import {
  otherMembers,
  useChatDetail,
  useDeleteChat,
  type Chat,
} from '@/shared/chat/chats';

/** P2 header — the other user's rank avatar + name, the whole thing a link to their profile. */
function P2Header({ chat, myId }: { chat: Chat; myId: number }) {
  const other = otherMembers(chat, myId)[0];
  const otherId = other?.user.id;
  const exp = useExperienceBatch(otherId != null ? [otherId] : []);
  return (
    <Link
      to={otherId != null ? `/u/${otherId}` : '/chat/groups'}
      className="group flex min-w-0 items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ton"
    >
      <RankBadge level={levelFor(exp.data, otherId ?? 0)} size={26} className="shrink-0" />
      <h1 className="truncate text-lg font-semibold tracking-tight text-fg group-hover:underline sm:text-xl">
        {other?.user.displayName ?? 'Диалог'}
      </h1>
    </Link>
  );
}

/** FAVORITES header — a bookmark glyph + "Избранное". */
function FavoritesHeader() {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border border-edge bg-panel-2 text-ice">
        <Bookmark size={15} strokeWidth={2} />
      </span>
      <h1 className="truncate text-lg font-semibold tracking-tight text-fg sm:text-xl">Избранное</h1>
    </div>
  );
}

/** GROUP header — a group glyph + the group's name. */
function GroupHeader({ chat }: { chat: Chat }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border border-edge bg-panel-2 text-ice">
        <Users size={15} strokeWidth={2} />
      </span>
      <h1 className="truncate text-lg font-semibold tracking-tight text-fg sm:text-xl">
        {chat.name?.trim() || `Группа · ${chat.members.length}`}
      </h1>
    </div>
  );
}

/** The "⋯" menu for a P2 chat — its only action is a two-step "Удалить переписку". */
function P2Menu({ chatId, onDeleted }: { chatId: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const del = useDeleteChat(chatId);

  function close() {
    setOpen(false);
    setConfirming(false);
  }

  return (
    <div className="relative ml-auto shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Ещё"
        className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ton"
      >
        <MoreVertical size={18} />
      </button>
      {open ? (
        <>
          {/* invisible backdrop — a click anywhere outside closes the menu */}
          <button type="button" aria-label="Закрыть меню" className="fixed inset-0 z-40 cursor-default" onClick={close} />
          <div className="absolute right-0 top-9 z-50 w-56 overflow-hidden rounded-xl border border-edge bg-panel p-1 shadow-xl">
            {confirming ? (
              <div className="flex flex-col gap-2 p-1.5">
                <p className="px-1 text-xs text-muted">Удалить переписку? Сообщения исчезнут у обоих.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => del.mutate(undefined, { onSuccess: onDeleted })}
                    disabled={del.isPending}
                    className="flex-1 rounded-lg border border-lose/40 px-2 py-1.5 text-sm text-lose transition-colors hover:bg-lose/10 disabled:opacity-50"
                  >
                    Удалить
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={del.isPending}
                    className="flex-1 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-panel-2 hover:text-fg"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-lose transition-colors hover:bg-lose/10"
              >
                <Trash2 size={16} />
                Удалить переписку
              </button>
            )}
            {del.isError ? (
              <p className="px-2.5 py-1 text-xs text-lose">{errorMessage(del.error, 'Не удалось удалить')}</p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function ChatConversationPage() {
  const { chatId: param } = useParams<{ chatId: string }>();
  const { user } = useAuth();
  const myId = user?.id ?? 0;
  const navigate = useNavigate();
  const [membersOpen, setMembersOpen] = useState(false);

  const chatId = param ?? '';
  const detail = useChatDetail(chatId);
  const chat = detail.data;

  if (!chatId) {
    return <Navigate to="/chat/groups" replace />;
  }

  if (detail.isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner size={28} />
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 py-10 text-center">
        <p className="text-sm text-lose">{errorMessage(detail.error, 'Не удалось загрузить чат')}</p>
        <Link to="/chat/groups" className="text-sm text-ton hover:underline">
          ← Ко всем чатам
        </Link>
      </div>
    );
  }

  const isGroup = chat.type === 'GROUP';

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Header — back arrow + a type-specific title row. */}
      <div className="flex shrink-0 items-center gap-2">
        <Link
          to="/chat/groups"
          aria-label="Назад к чатам"
          className="-ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ton"
        >
          <ArrowLeft size={20} />
        </Link>

        {chat.type === 'P2' ? (
          <>
            <P2Header chat={chat} myId={myId} />
            <P2Menu chatId={chatId} onDeleted={() => navigate('/chat/groups')} />
          </>
        ) : chat.type === 'FAVORITES' ? (
          <FavoritesHeader />
        ) : (
          <>
            <GroupHeader chat={chat} />
            {/* Members open as a slide-over drawer (same on mobile AND desktop) so the chat
                always keeps full width — the panel is never a permanent column. */}
            <button
              type="button"
              onClick={() => setMembersOpen(true)}
              aria-label="Участники"
              className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-panel-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ton"
            >
              <Users size={18} />
              {chat.members.length}
            </button>
          </>
        )}
      </div>

      {/* Chat fills the whole row. */}
      <div className="min-h-0 flex-1">
        <ChatRoom chatId={chatId} />
      </div>

      {/* Members drawer — groups only. */}
      {isGroup && membersOpen ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            className="flex-1 bg-black/60"
            onClick={() => setMembersOpen(false)}
            aria-label="Закрыть"
          />
          <div className="relative w-full max-w-[19rem]">
            <button
              type="button"
              onClick={() => setMembersOpen(false)}
              aria-label="Закрыть"
              className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-fg"
            >
              <X size={18} />
            </button>
            <ChatMembersPanel
              chat={chat}
              onLeft={() => {
                setMembersOpen(false);
                navigate('/chat/groups');
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
