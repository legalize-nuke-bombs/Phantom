// One chat's conversation (route: chat/groups/:chatId). A fixed-height header (back link,
// avatar + title, a members button with the count) sits above the existing ChatRoom core,
// which fills the rest and owns all messaging. ChatRoom is a black box keyed by a string
// chatId — we never touch its internals.

import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, Users, X } from 'lucide-react';

import ChatRoom from '@/features/communication/ChatRoom';
import ChatMembersPanel from '@/features/communication/ChatMembersPanel';
import { useAuth } from '@/shared/auth/AuthContext';
import { errorMessage } from '@/shared/api/errors';
import { levelFor, useExperienceBatch } from '@/shared/lib/experience';
import RankBadge from '@/shared/ui/RankBadge';
import Spinner from '@/shared/ui/Spinner';
import {
  chatTitle,
  otherMembers,
  useChatDetail,
  type Chat,
} from '@/shared/chat/chats';

/** The header avatar — other user's rank for a P2, a group / favourites glyph otherwise. */
function HeaderAvatar({ chat, myId }: { chat: Chat; myId: number }) {
  const otherId = chat.type === 'P2' ? otherMembers(chat, myId)[0]?.user.id : undefined;
  const exp = useExperienceBatch(otherId != null ? [otherId] : []);

  if (chat.type === 'P2' && otherId != null) {
    return <RankBadge level={levelFor(exp.data, otherId)} size={26} className="shrink-0" />;
  }
  return (
    <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border border-edge bg-panel-2 text-ice">
      {chat.type === 'GROUP' ? <Users size={15} strokeWidth={2} /> : <Bookmark size={15} strokeWidth={2} />}
    </span>
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

  const memberCount = chat.members.length;
  // FAVORITES is a private one-person chat — there's no membership to manage, so no panel.
  const showMembers = chat.type !== 'FAVORITES';

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* A small, unobtrusive title row — the global chat's heading look + a back arrow and
          the chat avatar. On mobile, a participants button opens the members sheet. */}
      <div className="flex shrink-0 items-center gap-2">
        <Link
          to="/chat/groups"
          aria-label="Назад к чатам"
          className="-ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ton"
        >
          <ArrowLeft size={20} />
        </Link>
        <HeaderAvatar chat={chat} myId={myId} />
        <h1 className="truncate text-lg font-semibold tracking-tight text-fg sm:text-xl">
          {chatTitle(chat, myId)}
        </h1>
        {/* Members open as a slide-over drawer (same on mobile AND desktop) so the chat always
            keeps full width — the panel is never a permanent column. Hidden for FAVORITES
            (a one-person chat); shown for P2 and groups. */}
        {showMembers ? (
          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            aria-label="Участники"
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-panel-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ton"
          >
            <Users size={18} />
            {memberCount}
          </button>
        ) : null}
      </div>

      {/* Chat fills the whole row — members live in the drawer below, never a fixed column. */}
      <div className="min-h-0 flex-1">
        <ChatRoom chatId={chatId} />
      </div>

      {/* Members drawer — slides in from the right over the chat, identical on every breakpoint. */}
      {showMembers && membersOpen ? (
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
