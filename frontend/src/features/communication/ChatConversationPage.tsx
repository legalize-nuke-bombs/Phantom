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
    return <RankBadge level={levelFor(exp.data, otherId)} size={36} className="shrink-0" />;
  }
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-edge bg-panel-2 text-ice">
      {kind === 'group' ? <Users size={18} strokeWidth={2} /> : <MessagesSquare size={18} strokeWidth={2} />}
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

  const memberCount = chat.members.length;

  // The back-arrow + chat title/avatar (the chat's identity) — folded into the TOP of the
  // members panel on desktop so the conversation has NO header row eating vertical height,
  // and shown as a compact top bar on mobile (where the members panel stacks below).
  const identity = (
    <>
      <Link
        to="/chat/groups"
        aria-label="Назад к чатам"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ton"
      >
        <ArrowLeft size={18} />
      </Link>
      <HeaderAvatar chat={chat} myId={myId} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-fg">{chatTitle(chat, myId)}</p>
        <p className="truncate text-xs text-muted">{memberCount} участников</p>
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Mobile: a compact header (on desktop this same identity folds into the panel top). */}
      <div className="flex shrink-0 items-center gap-3 md:hidden">{identity}</div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
        {/* Members panel: the LEFT column on desktop (back-arrow + title folded into its top),
            stacked below the chat on mobile. */}
        <div className="order-2 shrink-0 md:order-1 md:w-72">
          <ChatMembersPanel
            chat={chat}
            onLeft={() => navigate('/chat/groups')}
            topSlot={<div className="hidden items-center gap-2.5 p-3 md:flex">{identity}</div>}
          />
        </div>
        {/* Chat fills the rest, full height — no top header row stealing space. */}
        <div className="order-1 min-h-0 flex-1 md:order-2">
          <ChatRoom chatId={chatId} />
        </div>
      </div>
    </div>
  );
}
