// Reusable chat room — windowed history (load older up top), live messages (merged into
// the TanStack cache by the RealtimeProvider as MESSAGE_RECEIVED arrives), and a composer.
// Everything keys off chatId, so the same component serves the global chat now and 1:1 /
// group chats later.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { MessagesSquare, Send } from 'lucide-react';
import clsx from 'clsx';

import { useAuth } from '@/shared/auth/AuthContext';
import { errorMessage } from '@/shared/api/errors';
import { MAX_MESSAGE_LENGTH, useChatMessages, useSendMessage } from '@/shared/chat/useChat';
import { markBucketRead, useUnreadCount } from '@/shared/realtime/badges';
import { levelFor, useExperienceBatch } from '@/shared/lib/experience';
import { FeatureLock, useFeatureGate } from '@/shared/lib/levelFeatures';
import { formatTime, fromEpoch } from '@/shared/lib/time';
import Button from '@/shared/ui/Button';
import Spinner from '@/shared/ui/Spinner';
import MessageBubble from './MessageBubble';

// Local "Сегодня / Вчера / <date>" labeller — formatTime has no relative-day style, so
// we day-bucket here. Comparing local midnights (not raw epoch diffs) keeps the boundary
// on the user's calendar day regardless of how many hours apart two messages are.
function dayLabel(seconds: number, now: Date): string {
  const date = fromEpoch(seconds);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days === 0) return 'Сегодня';
  if (days === 1) return 'Вчера';
  return formatTime(seconds, 'date');
}

// Two timestamps fall on the same calendar day? (drives the day-divider breaks)
function sameDay(a: number, b: number): boolean {
  const x = fromEpoch(a);
  const y = fromEpoch(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

export default function ChatRoom({ chatId }: { chatId: string }) {
  const { user } = useAuth();
  const query = useChatMessages(chatId);
  const send = useSendMessage(chatId);
  // The backend refuses to send in ANY chat without SEND_MESSAGE, so gate the composer
  // itself (covers global + group). When locked we swap the input for the lock banner.
  const composer = useFeatureGate('SEND_MESSAGE');
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

  // Precompute display grouping once per message change (keeps the map() below pure and
  // calls `new Date()` once, not per row): a divider when the calendar day changes, and
  // a run-start when the sender changes from the previous message.
  const rows = useMemo(() => {
    const now = new Date();
    return messages.map((m, i) => {
      const prev = i > 0 ? messages[i - 1] : null;
      const divider =
        !prev || !sameDay(prev.timestamp, m.timestamp) ? dayLabel(m.timestamp, now) : null;
      return {
        message: m,
        divider,
        // First of a sender-run: a fresh sender, or the first row after a day divider
        // (a divider visually splits the column, so the next message re-shows its header).
        runStart: !prev || prev.user.id !== m.user.id || divider !== null,
      };
    });
  }, [messages]);

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
    if (!content || send.isPending || composer.locked) return;
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
          // Spacing lives on each row (not a uniform list gap) so a run reads as one
          // tight cluster: small gap inside a run, a roomier gap when the sender changes.
          <ul className="flex flex-col">
            {rows.map(({ message: m, divider, runStart }, i) => (
              <li key={m.id} className={clsx(i > 0 && (runStart ? 'mt-3' : 'mt-0.5'))}>
                {divider ? (
                  <div className="flex justify-center py-2">
                    <span className="rounded-full bg-panel-2 px-2.5 py-0.5 text-[11px] text-muted">
                      {divider}
                    </span>
                  </div>
                ) : null}
                <MessageBubble
                  message={m}
                  chatId={chatId}
                  myId={user?.id}
                  own={m.user.id === user?.id}
                  level={levelFor(levels, m.user.id)}
                  showHeader={runStart}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {composer.locked ? (
        // Locked: replace the whole composer with the lock banner (mirrors how gifts
        // gate SEND_PRESENT). The backend would reject a send anyway.
        <div className="border-t border-edge p-4">
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted">
              Отправка сообщений откроется по мере роста вашего ранга.
            </p>
            <FeatureLock feature="SEND_MESSAGE" />
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
