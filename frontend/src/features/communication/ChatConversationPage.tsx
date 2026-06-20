// One chat's conversation (route: chat/groups/:chatId). A fixed-height header (back link,
// avatar + title, a members button with the count) sits above the existing ChatRoom core,
// which fills the rest and owns all messaging. ChatRoom is a black box keyed by a string
// chatId — we never touch its internals.

import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessagesSquare, Users } from 'lucide-react';

import ChatRoom from '@/features/communication/ChatRoom';
import ChatMembersPanel from '@/features/communication/ChatMembersPanel';
import { useAuth } from '@/shared/auth/AuthContext';
import { errorMessage } from '@/shared/api/errors';
import { levelFor, useExperienceBatch } from '@/shared/lib/experience';
import RankBadge from '@/shared/ui/RankBadge';
import Spinner from '@/shared/ui/Spinner';
import {
  chatKind,
  chatTitle,
  otherMembers,
  useChatDetail,
  type Chat,
} from '@/shared/chat/chats';

/** The header avatar — other user's rank for a DM, a group glyph otherwise. */
function HeaderAvatar({ chat, myId }: { chat: Chat; myId: number }) {
  const kind = chatKind(chat, myId);
  const otherId = kind === 'dm' ? otherMembers(chat, myId)[0]?.user.id : undefined;
  const exp = useExperienceBatch(otherId != null ? [otherId] : []);

  if (kind === 'dm' && otherId != null) {
    return <RankBadge level={levelFor(exp.data, otherId)} size={26} className="shrink-0" />;
  }
  return (
    <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border border-edge bg-panel-2 text-ice">
      {kind === 'group' ? <Users size={15} strokeWidth={2} /> : <MessagesSquare size={15} strokeWidth={2} />}
    </span>
  );
}

export default function ChatConversationPage() {
  const { chatId: param } = useParams<{ chatId: string }>();
  const { user } = useAuth();
  const myId = user?.id ?? 0;
  const navigate = useNavigate();

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

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* A small, unobtrusive title row — the global chat's heading look, plus a back arrow
          and the chat's avatar. The member count lives in the panel, so it's not repeated. */}
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
      </div>

      {/* Chat (left) + the monolithic members column (right) — stacks on mobile. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
        <div className="min-h-0 flex-1">
          <ChatRoom chatId={chatId} />
        </div>
        <div className="shrink-0 md:w-72">
          <ChatMembersPanel chat={chat} onLeft={() => navigate('/chat/groups')} />
        </div>
      </div>
    </div>
  );
}
