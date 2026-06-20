// Presentational message row for ChatRoom. Pure view — all data/behaviour stays in
// ChatRoom; this only decides how a single message looks given its grouping flags.
//
// Grouping: a "run" is consecutive messages from the same sender. The avatar + name
// render only on the run's first message (`showHeader`); later rows omit them but keep
// the avatar gutter reserved (AVATAR + gap) so bubbles stay aligned under the header.
//
// Deletion lives here because the affordance hangs off the row: a message may be
// deleted by its own author (any chat) or, in the GLOBAL chat only, by a chat-moderator
// when the author isn't themselves a moderator. We mirror that backend rule on the
// client so we don't show a trash button that the server would reject.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import clsx from 'clsx';

import { errorMessage } from '@/shared/api/errors';
import { GLOBAL_CHAT_ID, useDeleteMessage } from '@/shared/chat/useChat';
import { capabilitiesOf, useMyCapabilities, useRoles } from '@/shared/lib/roles';
import { formatTime } from '@/shared/lib/time';
import type { ChatMessage } from '@/shared/realtime/types';
import type { LevelName } from '@/shared/types';
import RankBadge from '@/shared/ui/RankBadge';

import AttachmentView from './AttachmentView';
import { linkify } from './linkify';

const AVATAR = 32; // RankBadge diameter; also the gutter reserved for grouped rows.

export default function MessageBubble({
  message,
  chatId,
  myId,
  own,
  level,
  showHeader,
}: {
  message: ChatMessage;
  // ChatRoom owns the chatId; the bubble needs it to target the delete cache and to
  // apply the global-chat-only moderator rule.
  chatId: string;
  // The signed-in user's id (own-message check). May be undefined while auth loads.
  myId: number | undefined;
  own: boolean;
  level: LevelName | null;
  // First message of a sender-run: render avatar + name. Otherwise reserve the gutter.
  showHeader: boolean;
}) {
  const del = useDeleteMessage(chatId);
  // Two-step inline confirm so a stray tap can't nuke a message (the trash hit-target
  // is small and lives on a dense list).
  const [confirming, setConfirming] = useState(false);

  // Moderator gating: my own capability + the AUTHOR's capability, both resolved from
  // the cached role table (capabilitiesOf is the only place that maps a role → flags).
  const myCaps = useMyCapabilities();
  const { data: roles } = useRoles();
  const authorIsModerator = capabilitiesOf(roles, message.user.role).isChatModerator;

  // Mirror the backend exactly: delete is allowed iff it's my own message (any chat),
  // OR this is the global chat AND I'm a chat-moderator AND the author is not one.
  const canDelete =
    (myId != null && message.user.id === myId) ||
    (chatId === GLOBAL_CHAT_ID && myCaps.isChatModerator && !authorIsModerator);

  // An attachment-only message carries content === '' (the backend allows it); skip the
  // empty text line so such a bubble shows just the attachment + timestamp.
  const hasText = message.content.trim() !== '';

  function onConfirmDelete() {
    del.mutate(message.id, { onSuccess: () => setConfirming(false) });
  }

  return (
    // `group` so the desktop hover reveal can target the trash control. Row wrapper is
    // a <div>: ChatRoom owns the <li> so it can hang day-dividers + spacing off the same
    // list item without nesting <li> elements.
    <div className="group flex gap-2.5">
      {/* Avatar gutter — the badge on a run's first row, an empty spacer otherwise. */}
      {showHeader ? (
        <Link to={`/u/${message.user.id}`} className="mt-0.5 shrink-0">
          <RankBadge level={level} size={AVATAR} />
        </Link>
      ) : (
        <span aria-hidden className="shrink-0" style={{ width: AVATAR }} />
      )}

      <div className="flex min-w-0 max-w-[40rem] flex-col">
        {/* Sender name opens a run — shown for EVERYONE, since own messages are left-aligned
            too now (Telegram-ish feed: all messages start at the left). */}
        {showHeader ? (
          <Link
            to={`/u/${message.user.id}`}
            className="mb-0.5 truncate px-1 text-xs font-medium text-muted hover:underline"
          >
            {message.user.displayName}
          </Link>
        ) : null}

        {/* Bubble + delete control share a row; the control sits to the right of the bubble. */}
        <div className="flex items-end gap-1">
          {/* Message stack: the text bubble, then any attachment on its OWN line below.
              Attachments are NOT boxed inside the bubble — they sit free underneath it. */}
          <div className="flex min-w-0 flex-col gap-1">
            {hasText ? (
              <div
                className={clsx(
                  'rounded-2xl px-3 py-2',
                  // Everyone is left-aligned; own vs others is told by COLOUR — own gets the
                  // TON-blue tint, others the neutral panel.
                  own ? 'bg-ton-deep/15 text-fg' : 'bg-panel-2 text-fg',
                )}
              >
                {/* linkify keeps content as escaped React children — URLs become <a>,
                    @mentions become profile <Link>s, the rest stays plain text. */}
                <p className="whitespace-pre-wrap break-words text-sm">{linkify(message.content)}</p>
                <span className="mt-0.5 block text-[10px] leading-none text-muted">
                  {formatTime(message.timestamp, 'time')}
                </span>
              </div>
            ) : null}

            {message.attachment ? (
              <div className="flex flex-col">
                {/* The send time lives INSIDE the attachment (a corner), so an attachment-only
                    message needs no separate timestamp line. With text, the bubble shows it. */}
                <AttachmentView
                  file={message.attachment}
                  time={!hasText ? formatTime(message.timestamp, 'time') : undefined}
                />
              </div>
            ) : null}
          </div>

          {canDelete ? (
            confirming ? (
              // Inline confirm — "Удалить?" yes/no. Both targets are ≥32px so it works
              // on touch without a hover.
              <span className="flex shrink-0 items-center gap-1 text-[11px]">
                <span className="text-muted">Удалить?</span>
                <button
                  type="button"
                  onClick={onConfirmDelete}
                  disabled={del.isPending}
                  className="grid h-8 min-w-8 place-items-center rounded-lg px-1.5 font-medium text-lose transition-colors hover:bg-lose/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ton disabled:opacity-50"
                >
                  Да
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={del.isPending}
                  className="grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-muted transition-colors hover:bg-panel-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ton disabled:opacity-50"
                >
                  Нет
                </button>
              </span>
            ) : (
              // Trash trigger: hidden until row-hover on desktop (pointer:fine), but kept
              // faintly visible on touch (no hover) so it's always reachable. 32px target.
              <button
                type="button"
                onClick={() => setConfirming(true)}
                aria-label="Удалить сообщение"
                className={clsx(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors',
                  'hover:bg-panel-2 hover:text-lose focus:outline-none focus-visible:ring-2 focus-visible:ring-ton',
                  // Touch: always faintly visible. Fine pointer: fade in on row hover /
                  // keyboard focus, so it doesn't clutter the column at rest.
                  'opacity-40 [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-hover:opacity-100 [@media(pointer:fine)]:focus-visible:opacity-100',
                )}
              >
                <Trash2 size={15} strokeWidth={2} />
              </button>
            )
          ) : null}
        </div>

        {del.isError ? (
          <span className="mt-0.5 px-1 text-[10px] text-lose">
            {errorMessage(del.error, 'Не удалось удалить')}
          </span>
        ) : null}
      </div>
    </div>
  );
}
