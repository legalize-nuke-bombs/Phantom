// Per-bucket unread badges + the two "mark read" seams.
//
// markBucketRead / markPresentRead are the ONLY place a consumer retires a notification:
// they POST the ids to the server, then drop the rows from the session store so the badge
// falls to 0 immediately. Consumers (the wallet, a chat, the misc inbox) call these — they
// never touch the notification REST or the store directly. useUnreadCount (re-exported from
// the store) is the read side.

import { api } from '@/shared/api/client';
import { bucketIds, bucketRows, orphanChatNotificationIds, removeNotifications } from './store';
import type { Bucket } from './store';
import type { PresentPayload } from './types';

export { useUnreadCount, usePersonalChatsUnread } from './store';

/** Mark every unread notification in a bucket read — server first, then the local store. */
export async function markBucketRead(bucket: Bucket): Promise<void> {
  const ids = bucketIds(bucket);
  if (ids.length === 0) return;
  await api.post('/notifications/read', { ids });
  removeNotifications(ids);
}

/**
 * Reconcile chat badges against the COMPLETE set of chats I'm in (`validChatIds`, including
 * the global chat). Any chat-bucket notification for a chat NOT in that set is stranded — the
 * chat was deleted, or I was kicked / left, so it can never be opened to clear its unread —
 * so we mark those read server-side and drop them. The caller (the chats hub) passes the full
 * list it just loaded; calling with a PARTIAL set would wrongly clear chats not yet loaded.
 */
export async function reconcileChatBadges(validChatIds: ReadonlySet<string>): Promise<void> {
  const ids = orphanChatNotificationIds(validChatIds);
  if (ids.length === 0) return;
  await api.post('/notifications/read', { ids });
  removeNotifications(ids);
}

/**
 * Mark the PRESENT_RECEIVED notification for one claimed gift read — found by matching the
 * gift id inside the stored PresentRepresentation payload. No-op if that gift has no
 * notification (e.g. an old gift predating the realtime layer).
 */
export async function markPresentRead(presentId: number): Promise<void> {
  const match = bucketRows('gift').find(
    (r) => (r.payload as PresentPayload | null)?.id === presentId,
  );
  if (!match) return;
  await api.post('/notifications/read', { ids: [match.id] });
  removeNotifications([match.id]);
}
