// Moderation data layer. Today there is a single capability — broadcasting a global
// announcement — gated on chatModeratorAccess (NOT ownerAccess), so moderators and
// owners alike reach it.
//
// Backend (verified against com.example.phantom.broadcast.*):
//   POST /api/broadcast { content }   → 200   (content ≤ BROADCAST_MAX chars)
//
// The notification it fans out (BroadcastRepresentation { user, content }) already
// carries the sender, so the realtime layer can attribute it — nothing for us to add.

import { useMutation } from '@tanstack/react-query';

import { api, ApiError } from '@/shared/api/client';

/** Mirrors the backend BroadcastRequest content constraint. */
export const BROADCAST_MAX = 1000;

export function useBroadcast() {
  return useMutation<void, ApiError, { content: string }>({
    mutationFn: ({ content }) => api.post<void>('/broadcast', { content }),
  });
}
