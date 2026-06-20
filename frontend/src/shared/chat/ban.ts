// Chat ban state. A ban blocks the SAME actions as the chat feature gate — sending
// messages, creating chats, adding members — while reading stays allowed. The backend
// enforces it (BanlistService.validateChatPermission → 403 BANNED); we mirror it in the UI
// so a banned user sees a lock + reason instead of firing requests that just bounce.
//
// Backend (verified — BanlistController, /api/chat/banlist):
//   GET    /me              -> BanRepresentation (200) | 404 NOT_BANNED   (am I banned?)
//   GET    /{userId}        -> BanRepresentation (200) | 404 NOT_BANNED   (moderator lookup)
//   POST   /{targetId}      {reason, duration}  -> ban (chat-moderator only)
//   DELETE /{targetId}                          -> unban (chat-moderator only)
// The GET endpoints only return a ban while it is ACTIVE, so a non-null result == banned.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/shared/api/client';
import type { ShortUser } from '@/shared/types';

/** BanRepresentation. `duration` is seconds; the ban lifts at timestamp + duration. */
export interface Ban {
  id: number; // the banned user's id
  timestamp: number; // epoch seconds the ban was issued
  moderator: ShortUser | null;
  duration: number; // seconds
  reason: string;
}

export const myBanKey = ['banlist', 'me'] as const;
export const userBanKey = (userId: number) => ['banlist', userId] as const;

/** Fetch a ban, mapping the expected 404 NOT_BANNED to null (the common, not-an-error case). */
async function fetchBan(path: string): Promise<Ban | null> {
  try {
    return await api.get<Ban>(path);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.code === 'NOT_BANNED')) return null;
    throw e;
  }
}

/** My active ban, or null. Non-null ⇒ I'm banned (the endpoint only returns active bans). */
export function useMyBan() {
  return useQuery<Ban | null>({
    queryKey: myBanKey,
    queryFn: () => fetchBan('/chat/banlist/me'),
    staleTime: 60_000, // a ban doesn't change second-to-second
  });
}

/** A specific user's active ban, or null — the moderator lookup. Idle until a userId is set. */
export function useUserBan(userId: number | undefined) {
  return useQuery<Ban | null>({
    queryKey: userBanKey(userId ?? 0),
    queryFn: () => fetchBan(`/chat/banlist/${userId}`),
    enabled: userId != null && userId > 0,
  });
}

/** Ban a user (chat-moderator only). `duration` is seconds. */
export function useBanUser() {
  const qc = useQueryClient();
  return useMutation<unknown, ApiError, { targetId: number; reason: string; duration: number }>({
    mutationFn: ({ targetId, reason, duration }) =>
      api.post(`/chat/banlist/${targetId}`, { reason, duration }),
    onSuccess: (_data, { targetId }) =>
      void qc.invalidateQueries({ queryKey: userBanKey(targetId) }),
  });
}

/** Lift a user's ban (chat-moderator only). */
export function useUnbanUser() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, number>({
    mutationFn: (targetId) => api.del<void>(`/chat/banlist/${targetId}`),
    onSuccess: (_data, targetId) => void qc.invalidateQueries({ queryKey: userBanKey(targetId) }),
  });
}

/** Epoch seconds when the ban lifts (timestamp + duration). */
export function banExpiry(ban: Ban): number {
  return ban.timestamp + ban.duration;
}
