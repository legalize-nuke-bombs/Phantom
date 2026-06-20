// Chat hooks — windowed history (load older as you scroll up) + send. Reusable per
// chatId so the same core serves the global chat now and 1:1 / group chats later.
//
// Backend (verified): GET /api/chat/messages?chatId&limit&before -> MessageRepresentation[]
// (newest-first, cursor = oldest id we hold); POST /api/chat/messages {chatId, content}
// -> the created message. Live copies arrive over WS as MESSAGE_RECEIVED and are merged
// into this same cache by the RealtimeProvider, so the sender's POST result + the WS echo
// dedup by id.

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/shared/api/client';
import type { ChatMessage } from '@/shared/realtime/types';
import { chatMessagesKey, mergeIncomingMessage, removeMessageFromCache } from './chatCache';

/** The global chat is a fixed backend entity (GlobalChatConstants.ID). */
export const GLOBAL_CHAT_ID = '1';

/** Max message length the backend accepts (MessageConstants.MAX_MESSAGE_CONTENT_LENGTH). */
export const MAX_MESSAGE_LENGTH = 1000;

const PAGE_SIZE = 100;

function fetchMessages(chatId: string, before: number | undefined): Promise<ChatMessage[]> {
  const params = new URLSearchParams({ chatId: String(chatId), limit: String(PAGE_SIZE) });
  if (before !== undefined) params.set('before', String(before));
  return api.get<ChatMessage[]>(`/chat/messages?${params}`);
}

export function useChatMessages(chatId: string) {
  return useInfiniteQuery({
    queryKey: chatMessagesKey(chatId),
    queryFn: ({ pageParam }) => fetchMessages(chatId, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined; // reached the start of history
      return lastPage[lastPage.length - 1].id; // oldest id in this page → fetch older
    },
  });
}

/**
 * Arguments for sending a message. `content` may be '' when there's an attachment —
 * the backend rejects only when BOTH content is blank AND no attachment is present.
 * `attachmentId` is the UUID of an already-uploaded disk file (its file id == the
 * attachmentId); the backend resolves it to the message's FileRef.
 */
export interface SendMessageArgs {
  content: string;
  attachmentId?: string;
}

export function useSendMessage(chatId: string) {
  const qc = useQueryClient();
  return useMutation<ChatMessage, ApiError, SendMessageArgs>({
    // attachmentId is only included when present, so a plain text send keeps the same
    // body it always had ({ chatId, content }).
    mutationFn: ({ content, attachmentId }) =>
      api.post<ChatMessage>('/chat/messages', { chatId, content, attachmentId }),
    // Show it immediately; the WS echo of our own message dedups by id in the cache.
    onSuccess: (message) => mergeIncomingMessage(qc, message),
  });
}

/**
 * Delete a message (DELETE /api/chat/messages/{id} → 204). The realtime layer already
 * drops the message from every client's cache on the MESSAGE_DELETED frame; we still
 * remove it locally on success so the author sees it vanish instantly without waiting
 * for the round-trip (removeMessageFromCache is id-keyed, so the later WS frame is a
 * harmless no-op). Caller passes the chatId so we can target the right cache.
 */
export function useDeleteMessage(chatId: string) {
  const qc = useQueryClient();
  return useMutation<void, ApiError, number>({
    mutationFn: (id) => api.del<void>(`/chat/messages/${id}`),
    onSuccess: (_void, id) => removeMessageFromCache(qc, { id, chatId }),
  });
}
