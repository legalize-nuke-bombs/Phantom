// Dexie ledger — the local store of UNREAD notification signals.
//
// The server is the source of truth: resync() re-drains the unread set from REST on
// every (re)connect, so this table is a disposable mirror, never authoritative. It
// exists so the UI can read per-domain counts/badges synchronously and reactively
// (useLiveQuery), survive a reload without a 0→N flash, and dedup by id for free (id
// is the primary key → bulkPut upserts). Read notifications are NOT kept here: marking
// something read deletes its row locally and POSTs the id to /api/notifications/read.

import Dexie, { type EntityTable } from 'dexie';
import type { NotificationEnvelope, NotificationType } from './types';

/** One stored unread notification (the envelope, flattened so `type` is indexable). */
export interface StoredNotification {
  id: number; // == NotificationEnvelope.id (primary key → upsert dedup)
  type: NotificationType;
  timestamp: number;
  payload: unknown;
}

const db = new Dexie('phantom-realtime') as Dexie & {
  notifications: EntityTable<StoredNotification, 'id'>;
};

// v1 — unread ledger, indexed by `type` for per-domain badge counts.
db.version(1).stores({
  notifications: 'id, type, timestamp',
});

export { db };

/** Upsert envelopes into the ledger (idempotent — same id overwrites, no dup). */
export async function putNotifications(envelopes: NotificationEnvelope[]): Promise<void> {
  if (envelopes.length === 0) return;
  await db.notifications.bulkPut(
    envelopes.map((n) => ({
      id: n.id,
      type: n.type,
      timestamp: n.timestamp,
      payload: n.payload,
    })),
  );
}

/** Drop notifications from the ledger by id (after they're marked read server-side). */
export async function removeNotifications(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.notifications.bulkDelete(ids);
}
