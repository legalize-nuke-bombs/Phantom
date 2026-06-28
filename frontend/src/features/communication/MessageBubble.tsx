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
//
// The delete affordance is a Telegram-style actions menu (MessageActionsMenu), opened two
// ways — both surfacing the SAME popover: a right-click on the bubble (desktop) and a
// long-press on the bubble (touch). No always-visible trigger and no hover-reveal (a
// hover ⋯ stuck "on" in Safari), so nothing is glued to the row.

import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

import { errorMessage } from '@/shared/api/errors';
import { GLOBAL_CHAT_ID, useDeleteMessage } from '@/shared/chat/useChat';
import { capabilitiesOf, useMyCapabilities, useRoles } from '@/shared/lib/roles';
import { formatTime } from '@/shared/lib/time';
import type { ChatMessage } from '@/shared/realtime/types';
import type { LevelName } from '@/shared/types';
import RankBadge from '@/shared/ui/RankBadge';

import AttachmentView from './AttachmentView';
import MessageActionsMenu, { type MenuAnchor } from './MessageActionsMenu';
import { AnimatedEmoji, emojiOnlyCount, splitEmojis } from './AnimatedEmoji';
import MessageMarkdown from './Markdown';

const AVATAR = 32; // RankBadge diameter; also the gutter reserved for grouped rows.

// How long a touch must rest on the bubble before it counts as a long-press (Telegram
// uses ~0.5s). Short enough to feel intentional, long enough not to fire on a tap/scroll.
const LONG_PRESS_MS = 480;
// If the finger drifts past this many px before the timer fires, it's a scroll, not a
// press — cancel so long-press never hijacks list scrolling.
const LONG_PRESS_SLOP = 10;

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

  // The actions popover. `anchor` records how it was opened so the panel can flip to a
  // sensible corner near the message; null anchor === closed.
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const open = anchor != null;

  // Long-press bookkeeping (touch only): the pending timer + the press origin so we can
  // cancel on drift/scroll. Refs, not state — they never need to trigger a re-render.
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);

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
  // An emoji-only message (1–3 emoji, nothing else) renders big + animated, Telegram-style,
  // on no bubble. 4+ emoji or any mixed text falls through to the normal bubble.
  const emojiCount = hasText ? emojiOnlyCount(message.content) : 0;
  const bigEmoji = emojiCount >= 1 && emojiCount <= 3;

  function closeMenu() {
    setAnchor(null);
  }

  function onConfirmDelete() {
    del.mutate(message.id, { onSuccess: closeMenu });
  }

  // Right-click anywhere on the bubble (desktop): open the menu instead of the browser's
  // native context menu. Anchored above-right of the bubble so it doesn't cover the text.
  function onContextMenu(e: React.MouseEvent) {
    if (!canDelete) return;
    e.preventDefault();
    setAnchor({ side: 'top', align: own ? 'left' : 'right' });
  }

  // ---- Long-press (touch). Mouse presses are ignored here so they don't double up with
  // hover-trigger / right-click; we gate on pointerType === 'touch'.
  function clearPress() {
    if (pressTimer.current != null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressStart.current = null;
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (!canDelete || e.pointerType !== 'touch') return;
    pressStart.current = { x: e.clientX, y: e.clientY };
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      setAnchor({ side: 'top', align: own ? 'left' : 'right' });
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e: ReactPointerEvent) {
    const start = pressStart.current;
    if (start == null) return;
    // Past the slop radius → treat as a scroll/drag and abandon the press.
    if (Math.abs(e.clientX - start.x) > LONG_PRESS_SLOP || Math.abs(e.clientY - start.y) > LONG_PRESS_SLOP) {
      clearPress();
    }
  }

  return (
    // Row wrapper is a <div>: ChatRoom owns the <li> so it can hang day-dividers + spacing off
    // the same list item without nesting <li>s.
    <div className="flex gap-2.5">
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

        {/* Bubble + the (hover) ⋯ trigger share a row; the trigger sits to the right. */}
        <div className="flex items-end gap-1">
          {/* `relative` so the actions popover anchors to this message stack and rides the
              scrolling list. Right-click / long-press handlers live on it (the bubble),
              not the trigger, so the whole message is the gesture target. */}
          <div
            className="relative flex min-w-0 flex-col gap-1"
            onContextMenu={canDelete ? onContextMenu : undefined}
            onPointerDown={canDelete ? onPointerDown : undefined}
            onPointerMove={canDelete ? onPointerMove : undefined}
            onPointerUp={canDelete ? clearPress : undefined}
            onPointerCancel={canDelete ? clearPress : undefined}
            // Don't let the OS text-selection callout pre-empt our long-press on touch.
            style={canDelete ? { WebkitTouchCallout: 'none' } : undefined}
          >
            {hasText ? (
              bigEmoji ? (
                // Emoji-only → big animated emoji, no bubble chrome (Telegram-style).
                <div className="px-1 pb-0.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {splitEmojis(message.content).map((e, i) => (
                      <AnimatedEmoji key={`${e}-${i}`} emoji={e} size={emojiCount === 1 ? 80 : 48} />
                    ))}
                  </div>
                  <span className="mt-0.5 block text-[10px] leading-none text-muted">
                    {formatTime(message.timestamp, 'time')}
                  </span>
                </div>
              ) : (
                <div
                  className={clsx(
                    'rounded-2xl px-3 py-2',
                    // Everyone is left-aligned; own vs others is told by COLOUR — own gets the
                    // TON-blue tint, others the neutral panel.
                    own ? 'bg-ton-deep/15 text-fg' : 'bg-panel-2 text-fg',
                  )}
                >
                  {/* Markdown render (GFM + single-newline breaks + @mention links). XSS-safe:
                      no raw HTML, so user text can't inject nodes. See Markdown.tsx. */}
                  <MessageMarkdown content={message.content} />
                  <span className="mt-0.5 block text-[10px] leading-none text-muted">
                    {formatTime(message.timestamp, 'time')}
                  </span>
                </div>
              )
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

            {/* The popover itself — anchored within this `relative` stack. Mounted only
                while open, so its internal confirm state resets each time. */}
            {canDelete && open ? (
              <MessageActionsMenu
                anchor={anchor}
                onDelete={onConfirmDelete}
                deleting={del.isPending}
                onClose={closeMenu}
              />
            ) : null}
          </div>

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
