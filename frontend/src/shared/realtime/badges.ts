// Per-bucket unread badges, derived live from the Dexie ledger (resync's drain + live
// dispatch keep it current; useLiveQuery re-renders on every change, across tabs).
//
// markBucketRead / markPresentRead are the ONLY place a consumer "reads" a notification:
// they POST the ids to the server, then drop the rows locally so the badge falls to 0
// immediately. Consumers (the wallet, a chat, the misc inbox) call these — they never
// touch REST themselves; this module is the seam between them and the backend.

import { useLiveQuery } from 'dexie-react-hooks';
import { api } from '@/shared/api/client';
import { db, removeNotifications } from './db';
import type { Bucket } from './db';
import type { PresentPayload } from './types';

/** Live unread count for one bucket (0 when bucket is null). */
export function useUnreadCount(bucket: Bucket | null): number {
  return (
    useLiveQuery(
      () => (bucket ? db.notifications.where('bucket').equals(bucket).count() : 0),
      [bucket],
      0,
    ) ?? 0
  );
}

/** Mark every unread notification in a bucket read — server first, then the local ledger. */
export async function markBucketRead(bucket: Bucket): Promise<void> {
  const ids = (await db.notifications.where('bucket').equals(bucket).primaryKeys()) as number[];
  if (ids.length === 0) return;
  await api.post('/notifications/read', { ids });
  await removeNotifications(ids);
}

/**
 * Mark the PRESENT_RECEIVED notification for one claimed gift read — found by matching
 * the gift id inside the stored PresentRepresentation payload. No-op if that gift has
 * no notification (e.g. an old gift predating the realtime layer).
 */
export async function markPresentRead(presentId: number): Promise<void> {
  const rows = await db.notifications.where('bucket').equals('gift').toArray();
  const match = rows.find((r) => (r.payload as PresentPayload | null)?.id === presentId);
  if (!match) return;
  await api.post('/notifications/read', { ids: [match.id] });
  await removeNotifications([match.id]);
}
