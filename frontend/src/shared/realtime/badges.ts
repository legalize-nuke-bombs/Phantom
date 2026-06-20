// Per-type unread badges, derived live from the Dexie ledger (resync's drain + live
// dispatch keep it current; useLiveQuery re-renders on every ledger change, across tabs).
// markTypeRead clears a type when the user views it: tell the server (POST /read), then
// drop the rows locally so the badge falls to 0 instantly without waiting for a resync.

import { useLiveQuery } from 'dexie-react-hooks';
import { api } from '@/shared/api/client';
import { db, removeNotifications } from './db';
import type { NotificationType } from './types';

/** Live count of unread notifications of one type (0 when type is null). */
export function useUnreadCount(type: NotificationType | null): number {
  return (
    useLiveQuery(
      () => (type ? db.notifications.where('type').equals(type).count() : 0),
      [type],
      0,
    ) ?? 0
  );
}

/** Mark every unread notification of a type read — server first, then the local ledger. */
export async function markTypeRead(type: NotificationType): Promise<void> {
  const ids = (await db.notifications.where('type').equals(type).primaryKeys()) as number[];
  if (ids.length === 0) return;
  await api.post('/notifications/read', { ids });
  await removeNotifications(ids);
}
