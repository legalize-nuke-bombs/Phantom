// Chat-ENTITY layer — favourites, 1:1 (P2) and group chats. A Chat is a topic + members;
// its `type` (fixed at creation) decides its identity, its title, and which membership
// actions are legal. The MESSAGE layer (useChat.ts, chatCache.ts) is separate and serves
// any chatId once you have one.
//
// Backend (verified — PersonalChatController / PersonalChatService):
//   POST   /api/chat/chats          {type, name?, userIds?}  → create a chat, returns it
//   GET    /api/chat/chats                                   → ALL my chats, lastEdit DESC
//   GET    /api/chat/chats/{chatId}                          → one chat (+ members)
//   GET    /api/chat/chats/favourite                         → my favourites chat
//   GET    /api/chat/chats/p2/{targetId}                     → my 1:1 with targetId
//   POST   /api/chat/chats/{chatId}/leave                    → leave (GROUP only)
//   DELETE /api/chat/chats/{chatId}                          → delete the chat
//   POST   /api/chat/chats/{chatId}/kick/{targetId}          → kick a member (GROUP, eldest)
//   POST   /api/chat/chats/{chatId}/add/{targetId}           → add a member  (GROUP, eldest)
//
// Create bodies, per type:
//   FAVORITES → { type:'FAVORITES' }                 — no name, no userIds (id = UUID(me,me))
//   P2        → { type:'P2', userIds:[targetId] }     — no name        (id derived from the pair)
//   GROUP     → { type:'GROUP', name, userIds? }      — name REQUIRED  (id = random UUID)
//
// `id` is now a backend UUID — a STRING, and MUST stay one end-to-end (a UUID is not a number,
// so never Number() it). FAVORITES and P2 ids are DETERMINISTIC (derived from the user / the
// pair), so their "create" is idempotent: the backend 409s if the chat already exists, which
// is exactly what makes the get-or-create helpers below race-safe — one pair maps to ONE chat,
// so a profile "Написать" button can never spawn duplicates. members arrive sorted by member
// id ASC, so members[0] is the ELDEST = the GROUP's de-facto owner (add/kick/delete powers).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/shared/api/client';
import { markBucketRead } from '@/shared/realtime/badges';
import type { ShortUser } from '@/shared/types';

/* ── types (mirror the backend representations) ─────────────────────────────── */

/** ChatType (com.example.phantom.chat.chat.ChatType) — fixed at creation. */
export type ChatType = 'FAVORITES' | 'P2' | 'GROUP';

/** TopicMemberRepresentation — one member of a chat. */
export interface ChatMember {
  id: number;
  user: ShortUser;
  timestamp: number; // epoch seconds — when they joined
}

/** ChatRepresentation — a chat entity (a topic + its members). `id` is a UUID STRING. */
export interface Chat {
  id: string;
  topicId: string;
  timestamp: number; // topic.timestamp (epoch seconds)
  members: ChatMember[]; // SORTED ascending by member id; members[0] = eldest/owner
  type: ChatType;
  name: string | null; // GROUP only — null for FAVORITES / P2
  lastEdit: number; // epoch seconds of the last message — drives list ordering
}

/* ── query keys (one home; mutations invalidate these) ──────────────────────── */
export const chatsListKey = ['chats', 'list'] as const;
export const chatDetailKey = (chatId: string) => ['chats', 'detail', chatId] as const;

/* ── REST ───────────────────────────────────────────────────────────────────── */

function fetchMyChats(): Promise<Chat[]> {
  return api.get<Chat[]>('/chat/chats');
}

function fetchChat(chatId: string): Promise<Chat> {
  return api.get<Chat>(`/chat/chats/${chatId}`);
}

/* ── reads ──────────────────────────────────────────────────────────────────── */

/**
 * ALL my chats, already ordered by last activity (lastEdit DESC) server-side. There's no
 * paging anymore — chats are few, and loading the COMPLETE set also lets the hub reconcile
 * stale unread badges (a chat I was removed from / that was deleted can't be opened to clear
 * its notifications, so the hub marks those read once it sees the full list).
 *
 * The list is membership/activity state that drifts the moment anyone adds/kicks/leaves or
 * sends a message (lastEdit moves the row) — caching it was the source of stale-row bugs — so
 * staleTime/gcTime are 0 and it always refetches on mount.
 */
export function useMyChats() {
  return useQuery<Chat[]>({
    queryKey: chatsListKey,
    queryFn: fetchMyChats,
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
 * Drop the list cache so it refetches. We deliberately do NOT seed list/detail caches from
 * mutation results: those optimistic writes drifted out of sync with the server (member
 * order, timestamps, sibling edits) and caused stale rows. Mutations invalidate and let the
 * queries refetch the authoritative copy instead.
 */
function invalidateList(qc: QueryClient): Promise<void> {
  return qc.invalidateQueries({ queryKey: chatsListKey });
}

/** Refetch one chat's detail (members) after a membership change, instead of seeding it. */
function invalidateDetail(qc: QueryClient, chatId: string): Promise<void> {
  return qc.invalidateQueries({ queryKey: chatDetailKey(chatId) });
}

/** Arguments for creating a GROUP chat — a required name plus the members to seed it with. */
export interface CreateGroupArgs {
  name: string;
  userIds: number[];
}

/** Create a GROUP chat (name required; seeded with `userIds`). Returns the new chat. */
export function useCreateGroupChat() {
  const qc = useQueryClient();
  return useMutation<Chat, ApiError, CreateGroupArgs>({
    mutationFn: ({ name, userIds }) =>
      api.post<Chat>('/chat/chats', { type: 'GROUP', name, userIds }),
    onSuccess: () => {
      void invalidateList(qc);
    },
  });
}

/** Add a member by user id (GROUP, eldest only). Returns the updated chat. */
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

/** Kick a member by user id (GROUP, eldest only). Returns the updated chat. */
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

/** Leave the chat (GROUP only — backend refuses FAVORITES/P2). Last member out → deleted. */
export function useLeaveChat(chatId: string) {
  const qc = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: () => api.post<void>(`/chat/chats/${chatId}/leave`),
    onSuccess: () => {
      qc.removeQueries({ queryKey: chatDetailKey(chatId) });
      // Clear any unread badge for a chat I'm leaving NOW — once I'm out I can never open
      // it to mark its notifications read, so it would otherwise badge forever.
      void markBucketRead(`chat:${chatId}`);
      void invalidateList(qc);
    },
  });
}

/** Delete the chat (GROUP: eldest only; FAVORITES/P2: any member — wipes the conversation). */
export function useDeleteChat(chatId: string) {
  const qc = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: () => api.del<void>(`/chat/chats/${chatId}`),
    onSuccess: () => {
      qc.removeQueries({ queryKey: chatDetailKey(chatId) });
      // The chat is gone — clear its unread badge now, since it can never be opened to
      // mark those notifications read.
      void markBucketRead(`chat:${chatId}`);
      void invalidateList(qc);
    },
  });
}

/**
 * Open (or start) the 1:1 (P2) chat with `targetId`, returning its id so the caller can
 * route to it. P2 ids are deterministic, so this is a race-safe get-or-create: GET the
 * existing chat; on 404 create it; if the create loses a race (409 — our other device or a
 * near-simultaneous open already made it) the chat now exists, so GET it. Every branch yields
 * the SAME id — the pair maps to one chat — so the caller can never produce duplicate DMs.
 */
export function useStartDirectChat() {
  const qc = useQueryClient();
  return useMutation<string, ApiError, number>({
    mutationFn: (targetId) => openOrCreateP2(targetId),
    onSuccess: () => {
      void invalidateList(qc);
    },
  });
}

async function openOrCreateP2(targetId: number): Promise<string> {
  try {
    return (await api.get<Chat>(`/chat/chats/p2/${targetId}`)).id;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) throw err;
  }
  try {
    return (await api.post<Chat>('/chat/chats', { type: 'P2', userIds: [targetId] })).id;
  } catch (err) {
    // Lost the create race — the deterministic id already exists; fetch the winner's copy.
    if (err instanceof ApiError && err.status === 409) {
      return (await api.get<Chat>(`/chat/chats/p2/${targetId}`)).id;
    }
    throw err;
  }
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
 * A display title for the chat:
 *   • FAVORITES → "Избранное",
 *   • P2        → the other member's displayName,
 *   • GROUP     → its name (falls back to "Группа · N" if somehow unnamed).
 */
export function chatTitle(chat: Chat, myId: number): string {
  switch (chat.type) {
    case 'FAVORITES':
      return 'Избранное';
    case 'P2': {
      const other = otherMembers(chat, myId)[0];
      return other?.user.displayName ?? 'Диалог';
    }
    case 'GROUP':
      return chat.name?.trim() || `Группа · ${chat.members.length}`;
  }
}
