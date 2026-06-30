// Blacklist state. A block is PERSONAL and DIRECTIONAL: I block someone, they don't know.
// A block in EITHER direction forbids the same P2 actions — writing in the 1:1 chat,
// creating that chat, inviting — while everything else stays open. The backend enforces it
// (403 YOU_BLOCKED_THIS_USER / YOU_HAVE_BEEN_BLOCKED); we mirror it in the UI so the user
// sees a banner + reason instead of firing requests that just bounce, and so a profile shows
// Block / Unblock instead of a dead "Написать".
//
// Backend (verified — /api/chat/blacklist):
//   POST   /{targetId}              -> block, returns BlackRepresentation
//   DELETE /{targetId}             -> unblock (204, idempotent)
//   GET    ?before=&limit=20        -> MY blocked list (BlackRepresentation[], id DESC keyset)
//   GET    /is-blocked/{targetId}   -> did I block them?  BlackRepresentation | empty
//   GET    /am-i-blocked/{targetId} -> did they block me? BlackRepresentation | empty
// The two probe endpoints answer an empty body (→ undefined) when there's no block, so a
// non-null result == blocked.

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api, ApiError } from '@/shared/api/client';
import type { ShortUser } from '@/shared/types';

/** BlackRepresentation — one blacklist entry: `author` blocked `target` at `timestamp`. */
export interface BlackRepresentation {
  id: number;
  author: ShortUser;
  target: ShortUser;
  timestamp: number; // epoch seconds the block was created
}

export const blacklistListKey = ['blacklist', 'list'] as const;
export const isBlockedKey = (id: number) => ['blacklist', 'is-blocked', id] as const;
export const amIBlockedKey = (id: number) => ['blacklist', 'am-i-blocked', id] as const;

/** My blocked list is keyset-paginated by id DESC; a short page means the end. */
const PAGE_SIZE = 20;

/**
 * Probe a directional block, mapping an empty body to null — the common, not-an-error case.
 * The backend returns undefined (204 / empty) when there's no block; null is "not blocked".
 */
async function fetchBlock(path: string): Promise<BlackRepresentation | null> {
  return (await api.get<BlackRepresentation | undefined>(path)) ?? null;
}

/**
 * MY blacklist, cursor-paginated (GET /api/chat/blacklist?limit&before). The backend orders
 * by id DESC and filters `id < before`, so the cursor for the next page is the LAST (smallest)
 * id we hold; a page shorter than PAGE_SIZE means we've reached the end.
 */
export function useMyBlacklist() {
  return useInfiniteQuery({
    queryKey: blacklistListKey,
    queryFn: ({ pageParam }): Promise<BlackRepresentation[]> => {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (pageParam != null) qs.set('before', String(pageParam));
      return api.get<BlackRepresentation[]>(`/chat/blacklist?${qs.toString()}`);
    },
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage): number | null | undefined => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1].id;
    },
  });
}

/** Did I block `targetId`? The entry if so, else null. Idle until a targetId is set. */
export function useIsBlocked(targetId: number | undefined) {
  return useQuery<BlackRepresentation | null>({
    queryKey: isBlockedKey(targetId ?? 0),
    queryFn: () => fetchBlock(`/chat/blacklist/is-blocked/${targetId}`),
    enabled: targetId != null && targetId > 0,
  });
}

/** Did `targetId` block ME? The entry if so, else null. Idle until a targetId is set. */
export function useAmIBlocked(targetId: number | undefined) {
  return useQuery<BlackRepresentation | null>({
    queryKey: amIBlockedKey(targetId ?? 0),
    queryFn: () => fetchBlock(`/chat/blacklist/am-i-blocked/${targetId}`),
    enabled: targetId != null && targetId > 0,
  });
}

/**
 * Block a user. Invalidates both probes for the target, my list, and the chats list (a block
 * can hide / lock the 1:1), so every dependent view refetches the authoritative state.
 */
export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation<BlackRepresentation, ApiError, number>({
    mutationFn: (targetId) => api.post<BlackRepresentation>(`/chat/blacklist/${targetId}`),
    onSuccess: (_data, targetId) => {
      void qc.invalidateQueries({ queryKey: isBlockedKey(targetId) });
      void qc.invalidateQueries({ queryKey: amIBlockedKey(targetId) });
      void qc.invalidateQueries({ queryKey: blacklistListKey });
      void qc.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

/** Unblock a user (idempotent — DELETE answers 204 even if they weren't blocked). */
export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, number>({
    mutationFn: (targetId) => api.del<void>(`/chat/blacklist/${targetId}`),
    onSuccess: (_data, targetId) => {
      void qc.invalidateQueries({ queryKey: isBlockedKey(targetId) });
      void qc.invalidateQueries({ queryKey: amIBlockedKey(targetId) });
      void qc.invalidateQueries({ queryKey: blacklistListKey });
      void qc.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}
