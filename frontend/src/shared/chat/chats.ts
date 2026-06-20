// Chat-ENTITY layer — 1:1 DMs and group chats are the SAME backend object (a Chat = a
// topic + members). This module owns the chat list / detail / membership; the MESSAGE
// layer (useChat.ts, chatCache.ts) is separate and serves any chatId once you have one.
//
// Backend (verified — PersonalChatController / PersonalChatService):
//   POST   /api/chat/chats                                   → create an EMPTY chat (me only)
//   GET    /api/chat/chats?limit&beforeTimestamp&beforeId    → MY chats, topic.timestamp DESC, id DESC
//   GET    /api/chat/chats/{chatId}                          → one chat (+ members)
//   POST   /api/chat/chats/{chatId}/leave                    → leave (last member → chat deleted)
//   DELETE /api/chat/chats/{chatId}                          → delete the chat (ELDEST only)
//   POST   /api/chat/chats/{chatId}/kick/{targetId}          → kick a member (ELDEST only)
//   POST   /api/chat/chats/{chatId}/add/{targetId}           → add a member (ELDEST only, max 1000)
//
// ChatRepresentation: { id:string; topicId:string; timestamp:number; members:ChatMember[] }.
// `id` is a STRING and MUST stay one end-to-end: chat ids are Java longs up to 2^63, far
// past JS's safe-integer range (2^53), so Number(chat.id) silently corrupts large ids and
// the backend then 404s the wrong chat. members come SORTED ascending by (timestamp,id), so
// members[0] is the ELDEST = the de-facto owner: only members[0] can add / kick / delete;
// everyone can leave.

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/shared/api/client';
import type { ShortUser, User } from '@/shared/types';

/* ── types (mirror the backend representations) ─────────────────────────────── */

/** TopicMemberRepresentation — one member of a chat. */
export interface ChatMember {
  id: number;
  user: ShortUser;
  timestamp: number; // epoch seconds — when they joined
}

/** ChatRepresentation — a chat entity (a topic + its members). `id` is a STRING. */
export interface Chat {
  id: string;
  topicId: string;
  timestamp: number; // topic.timestamp (epoch seconds) — drives list ordering
  members: ChatMember[]; // SORTED ascending by (timestamp, id); members[0] = eldest/owner
}

/** What kind of chat this is, from the signed-in user's point of view. */
export type ChatKind = 'empty' | 'dm' | 'group';

const PAGE_SIZE = 20;
/** A sane cap on how many list pages useStartDirectChat scans for an existing DM. */
const DM_SCAN_PAGE_CAP = 5;

/* ── query keys (one home; mutations invalidate these) ──────────────────────── */
export const chatsListKey = ['chats', 'list'] as const;
export const chatDetailKey = (chatId: string) => ['chats', 'detail', chatId] as const;

/* ── REST ───────────────────────────────────────────────────────────────────── */

interface ChatsCursor {
  beforeTimestamp: number;
  beforeId: string; // a chat id (Java long) — kept as a string to preserve precision
}

function fetchMyChats(cursor: ChatsCursor | undefined): Promise<Chat[]> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) {
    params.set('beforeTimestamp', String(cursor.beforeTimestamp));
    params.set('beforeId', String(cursor.beforeId));
  }
  return api.get<Chat[]>(`/chat/chats?${params}`);
}

function fetchChat(chatId: string): Promise<Chat> {
  return api.get<Chat>(`/chat/chats/${chatId}`);
}

/* ── reads ──────────────────────────────────────────────────────────────────── */

/**
 * My chats, newest activity first (topic.timestamp DESC, then id DESC). Paged with
 * the (beforeTimestamp, beforeId) cursor = the last row of the page just loaded; a
 * short page means we reached the end.
 */
export function useMyChats() {
  return useInfiniteQuery({
    queryKey: chatsListKey,
    queryFn: ({ pageParam }) => fetchMyChats(pageParam),
    initialPageParam: undefined as ChatsCursor | undefined,
    getNextPageParam: (lastPage): ChatsCursor | undefined => {
      if (lastPage.length < PAGE_SIZE) return undefined; // reached the end
      const last = lastPage[lastPage.length - 1];
      return { beforeTimestamp: last.timestamp, beforeId: last.id };
    },
    // The list is membership/activity state that drifts the moment anyone adds, kicks,
    // leaves or messages — caching it was the source of stale-row bugs. Always refetch
    // fresh on mount and never serve a cached copy (staleTime/gcTime 0) so the hub
    // mirrors the server every time it's opened.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

/** One chat with its members. */
export function useChatDetail(chatId: string) {
  return useQuery<Chat>({
    queryKey: chatDetailKey(chatId),
    queryFn: () => fetchChat(chatId),
    enabled: chatId.length > 0,
  });
}

/* ── mutations ──────────────────────────────────────────────────────────────── */

/**
 * Drop the list cache so it refetches. We deliberately do NOT seed list/detail caches
 * from mutation results anymore: those optimistic writes drifted out of sync with the
 * server (member order, timestamps, sibling edits) and caused stale rows. Mutations
 * now invalidate and let the queries refetch the authoritative copy instead.
 */
function invalidateList(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({ queryKey: chatsListKey });
}

/** Refetch one chat's detail (members) after a membership change, instead of seeding it. */
function invalidateDetail(qc: QueryClient, chatId: string): Promise<void> {
  return qc.invalidateQueries({ queryKey: chatDetailKey(chatId) });
}

/** Create an EMPTY chat (just me). Returns the new chat — caller navigates to it. */
export function useCreateChat() {
  const qc = useQueryClient();
  return useMutation<Chat, ApiError, void>({
    mutationFn: () => api.post<Chat>('/chat/chats'),
    onSuccess: () => {
      void invalidateList(qc);
    },
  });
}

/** Add a member by user id (eldest only). Returns the updated chat. */
export function useAddMember(chatId: string) {
  const qc = useQueryClient();
  return useMutation<Chat, ApiError, number>({
    mutationFn: (targetId) => api.post<Chat>(`/chat/chats/${chatId}/add/${targetId}`),
    onSuccess: () => {
      void invalidateDetail(qc, chatId);
      void invalidateList(qc);
    },
  });
}

/** Kick a member by user id (eldest only). Returns the updated chat. */
export function useKickMember(chatId: string) {
  const qc = useQueryClient();
  return useMutation<Chat, ApiError, number>({
    mutationFn: (targetId) => api.post<Chat>(`/chat/chats/${chatId}/kick/${targetId}`),
    onSuccess: () => {
      void invalidateDetail(qc, chatId);
      void invalidateList(qc);
    },
  });
}

/** Leave the chat (anyone). If I was the last member the backend deletes it. */
export function useLeaveChat(chatId: string) {
  const qc = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: () => api.post<void>(`/chat/chats/${chatId}/leave`),
    onSuccess: () => {
      qc.removeQueries({ queryKey: chatDetailKey(chatId) });
      void invalidateList(qc);
    },
  });
}

/** Delete the chat (eldest only). */
export function useDeleteChat(chatId: string) {
  const qc = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: () => api.del<void>(`/chat/chats/${chatId}`),
    onSuccess: () => {
      qc.removeQueries({ queryKey: chatDetailKey(chatId) });
      void invalidateList(qc);
    },
  });
}

/**
 * Open (or start) a 1:1 DM with `target`. To avoid duplicate DMs we first page my
 * existing chats (up to DM_SCAN_PAGE_CAP pages) looking for one whose members are
 * EXACTLY {me, target}; if found, return its id. Otherwise create an empty chat and
 * add the target, then return the new id. Either way the caller navigates to the id.
 *
 * Returns the chat id as a STRING (matching chat.id) so the caller can route to it.
 */
export function useStartDirectChat() {
  const qc = useQueryClient();

  // The caller passes both the target and their OWN id (myId) — the chats layer is
  // hook-agnostic and doesn't read auth itself, so the page supplies it from useAuth.
  return useMutation<string, ApiError, { target: Pick<User, 'id'> | ShortUser; myId: number }>({
    mutationFn: async ({ target, myId: me }) => {
      const existing = await findDirectChat(me, target.id);
      if (existing) return existing;

      const chat = await api.post<Chat>('/chat/chats');
      const withMember = await api.post<Chat>(`/chat/chats/${chat.id}/add/${target.id}`);
      // No optimistic detail seed — the conversation page fetches the authoritative
      // chat fresh on navigate (same drift fix as the other mutations).
      return withMember.id;
    },
    onSuccess: () => {
      void invalidateList(qc);
    },
  });
}

/** Scan up to DM_SCAN_PAGE_CAP pages for an existing 1:1 chat with exactly {me, target}. */
async function findDirectChat(myId: number, targetId: number): Promise<string | null> {
  let cursor: ChatsCursor | undefined;
  for (let page = 0; page < DM_SCAN_PAGE_CAP; page++) {
    const chats = await fetchMyChats(cursor);
    for (const chat of chats) {
      if (isDirectWith(chat, myId, targetId)) return chat.id;
    }
    if (chats.length < PAGE_SIZE) break; // reached the end
    const last = chats[chats.length - 1];
    cursor = { beforeTimestamp: last.timestamp, beforeId: last.id };
  }
  return null;
}

/** True when `chat` has EXACTLY the two members {myId, targetId} and nothing else. */
function isDirectWith(chat: Chat, myId: number, targetId: number): boolean {
  if (chat.members.length !== 2) return false;
  const ids = new Set(chat.members.map((m) => m.user.id));
  return ids.has(myId) && ids.has(targetId);
}

/* ── pure helpers (no hooks — usable anywhere) ──────────────────────────────── */

/** The eldest member's user id = the de-facto owner (members[0]). null if no members. */
export function chatOwnerId(chat: Chat): number | null {
  return chat.members[0]?.user.id ?? null;
}

/** Every member that isn't me, preserving the eldest-first order. */
export function otherMembers(chat: Chat, myId: number): ChatMember[] {
  return chat.members.filter((m) => m.user.id !== myId);
}

/**
 * What this chat is from my point of view:
 *   • 'empty' — only me (a brand-new chat before I add anyone),
 *   • 'dm'    — exactly two members (me + one other),
 *   • 'group' — three or more.
 */
export function chatKind(chat: Chat, myId: number): ChatKind {
  void myId; // kind is purely a function of member count, but myId keeps the call site honest
  const n = chat.members.length;
  if (n <= 1) return 'empty';
  if (n === 2) return 'dm';
  return 'group';
}

/**
 * A display title for the chat:
 *   • DM    → the other member's displayName,
 *   • group → "Группа · N" (N = member count),
 *   • empty → "Только вы".
 */
export function chatTitle(chat: Chat, myId: number): string {
  switch (chatKind(chat, myId)) {
    case 'dm': {
      const other = otherMembers(chat, myId)[0];
      return other?.user.displayName ?? 'Диалог';
    }
    case 'group':
      return `Группа · ${chat.members.length}`;
    default:
      return 'Только вы';
  }
}
