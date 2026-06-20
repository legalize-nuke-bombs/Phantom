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
import { chatMessagesKey, mergeIncomingMessage } from './chatCache';

/** The global chat is a fixed backend entity (GlobalChatConstants.ID). */
export const GLOBAL_CHAT_ID = 1;

/** Max message length the backend accepts (MessageConstants.MAX_MESSAGE_CONTENT_LENGTH). */
export const MAX_MESSAGE_LENGTH = 1000;

const PAGE_SIZE = 30;

function fetchMessages(chatId: number, before: number | undefined): Promise<ChatMessage[]> {
  const params = new URLSearchParams({ chatId: String(chatId), limit: String(PAGE_SIZE) });
  if (before !== undefined) params.set('before', String(before));
  return api.get<ChatMessage[]>(`/chat/messages?${params}`);
}

export function useChatMessages(chatId: number) {
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

export function useSendMessage(chatId: number) {
  const qc = useQueryClient();
  return useMutation<ChatMessage, ApiError, string>({
    mutationFn: (content) => api.post<ChatMessage>('/chat/messages', { chatId, content }),
    // Show it immediately; the WS echo of our own message dedups by id in the cache.
    onSuccess: (message) => mergeIncomingMessage(qc, message),
  });
}
