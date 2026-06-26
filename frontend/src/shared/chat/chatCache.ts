// Chat message cache helpers — shared between the chat hooks (read/scroll/send) and the
// RealtimeProvider (live MESSAGE_RECEIVED / MESSAGE_DELETED). History lives in a TanStack
// useInfiniteQuery (server is the source of truth, we hold a scrolling window); live
// frames are merged straight into that cache, deduped by message id.
//
// Page order mirrors the backend: GET /api/chat/messages returns newest-first (DESC by
// id), and page 0 is the newest page. So a freshly-arrived message prepends to page 0.

import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { ChatMessage } from '@/shared/realtime/types';

export type ChatPages = InfiniteData<ChatMessage[], number | undefined>;

/** Query key for one chat's message history. chatId is the string id (global = the nil-UUID). */
export function chatMessagesKey(chatId: string) {
  return ['chat', chatId, 'messages'] as const;
}

/** Merge a freshly-arrived (or just-sent) message into its chat's cache, deduped by id. */
export function mergeIncomingMessage(qc: QueryClient, message: ChatMessage): void {
  qc.setQueryData<ChatPages>(chatMessagesKey(message.chatId), (old) => {
    if (!old) return old; // chat not open / not loaded — it'll fetch fresh on open
    if (old.pages.some((page) => page.some((m) => m.id === message.id))) return old;
    const pages = old.pages.slice();
    pages[0] = [message, ...(pages[0] ?? [])];
    return { ...old, pages };
  });
}

/** Drop a deleted message from its chat's cache (moderator MESSAGE_DELETED). */
export function removeMessageFromCache(
  qc: QueryClient,
  ref: { id: number; chatId: string },
): void {
  qc.setQueryData<ChatPages>(chatMessagesKey(ref.chatId), (old) => {
    if (!old) return old;
    return { ...old, pages: old.pages.map((page) => page.filter((m) => m.id !== ref.id)) };
  });
}
