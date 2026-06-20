// Reusable chat room — windowed history (load older up top), live messages (merged into
// the TanStack cache by the RealtimeProvider as MESSAGE_RECEIVED arrives), and a composer.
// Everything keys off chatId, so the same component serves the global chat now and 1:1 /
// group chats later.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { MessagesSquare, Send } from 'lucide-react';
import clsx from 'clsx';

import { useAuth } from '@/shared/auth/AuthContext';
import { errorMessage } from '@/shared/api/errors';
import { MAX_MESSAGE_LENGTH, useChatMessages, useSendMessage } from '@/shared/chat/useChat';
import { markBucketRead, useUnreadCount } from '@/shared/realtime/badges';
import { levelFor, useExperienceBatch } from '@/shared/lib/experience';
import { formatTime } from '@/shared/lib/time';
import type { ChatMessage } from '@/shared/realtime/types';
import type { LevelName } from '@/shared/types';
import Button from '@/shared/ui/Button';
import RankBadge from '@/shared/ui/RankBadge';
import Spinner from '@/shared/ui/Spinner';

function MessageRow({
  message,
  own,
  level,
}: {
  message: ChatMessage;
  own: boolean;
  level: LevelName | null;
}) {
  return (
    <li className="flex gap-2.5">
      <Link to={`/u/${message.user.id}`} className="mt-0.5 shrink-0">
        <RankBadge level={level} size={32} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <Link
            to={`/u/${message.user.id}`}
            className={clsx(
              'truncate text-sm font-medium hover:underline',
              own ? 'text-ton' : 'text-fg',
            )}
          >
            {message.user.displayName}
          </Link>
          <span className="shrink-0 text-[11px] text-muted">
            {formatTime(message.timestamp, 'time')}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm text-fg">{message.content}</p>
      </div>
    </li>
  );
}

export default function ChatRoom({ chatId }: { chatId: number }) {
  const { user } = useAuth();
  const query = useChatMessages(chatId);
  const send = useSendMessage(chatId);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Oldest → newest for display (the API and cache hold newest-first).
  const messages = useMemo(
    () => (query.data?.pages.flat() ?? []).slice().reverse(),
    [query.data],
  );

  // Rank-ghost avatars: batch the senders' levels (privacy-hidden users fall back to ◇).
  const senderIds = useMemo(() => [...new Set(messages.map((m) => m.user.id))], [messages]);
  const { data: levels } = useExperienceBatch(senderIds);

  // Stick to the bottom when the newest message changes (first load + new arrivals).
  // Loading older history leaves the newest id unchanged, so the view isn't yanked down.
  const newestId = messages.length ? messages[messages.length - 1].id : undefined;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [newestId]);

  // Viewing a chat = reading it: clear its unread bucket on open and as new messages
  // land, so this chat's sidebar badge stays at 0 while it's open.
  const chatBucket = `chat:${chatId}`;
  const unreadHere = useUnreadCount(chatBucket);
  useEffect(() => {
    if (unreadHere > 0) void markBucketRead(chatBucket);
  }, [unreadHere, chatBucket]);

  function submit() {
    const content = draft.trim();
    if (!content || send.isPending) return;
    send.mutate(content, { onSuccess: () => setDraft('') });
  }
  function onFormSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  if (query.isLoading) {
    return (
      <div className="grid h-full place-items-center rounded-xl border border-edge bg-panel">
        <Spinner size={28} />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="grid h-full place-items-center rounded-xl border border-edge bg-panel px-6 text-center">
        <p className="text-sm text-lose">{errorMessage(query.error, 'Не удалось загрузить чат')}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-edge bg-panel">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {query.hasNextPage ? (
          <div className="flex justify-center pb-3">
            <Button
              variant="ghost"
              size="sm"
              loading={query.isFetchingNextPage}
              onClick={() => query.fetchNextPage()}
            >
              Загрузить ещё
            </Button>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <MessagesSquare size={26} className="text-muted" />
            <p className="text-sm text-muted">Сообщений пока нет — будьте первым</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m) => (
              <MessageRow
                key={m.id}
                message={m}
                own={m.user.id === user?.id}
                level={levelFor(levels, m.user.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={onFormSubmit} className="border-t border-edge p-3">
        {send.isError ? (
          <p className="mb-2 text-xs text-lose">
            {errorMessage(send.error, 'Не удалось отправить сообщение')}
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={1}
            placeholder="Сообщение…"
            disabled={send.isPending}
            className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-edge bg-panel-2 px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-ton focus:outline-none disabled:opacity-50"
          />
          <Button
            type="submit"
            loading={send.isPending}
            disabled={draft.trim() === ''}
            className="h-11 shrink-0 px-4"
          >
            <Send size={16} strokeWidth={2} />
          </Button>
        </div>
      </form>
    </div>
  );
}
