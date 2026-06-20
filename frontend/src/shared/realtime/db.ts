// Dexie ledger — the local store of UNREAD notification signals, partitioned by BUCKET.
//
// The server is the source of truth: resync() re-drains the unread set from REST on
// every (re)connect, so this table is a disposable mirror. It exists so each consumer
// (gifts, a chat, the misc inbox) can read ITS bucket's count synchronously, reactively
// (useLiveQuery), and across tabs; dedup is free (id is the primary key). Read items are
// not kept here — marking read deletes the row(s) and POSTs the ids to /notifications/read.
//
// One physical table, partitioned by `bucket` (not one table per consumer) so future
// chats are just another `chat:<id>` bucket — no schema growth.

import Dexie, { type EntityTable } from 'dexie';
import type { ChatMessage, NotificationEnvelope } from './types';

/** Which consumer a notification belongs to: 'gift' | 'chat:<chatId>' | 'misc'. */
export type Bucket = string;

/** One stored unread notification (envelope flattened; `bucket` + `type` indexed). */
export interface StoredNotification {
  id: number; // == NotificationEnvelope.id (primary key → upsert dedup)
  bucket: Bucket;
  type: string;
  timestamp: number;
  payload: unknown;
}

const db = new Dexie('phantom-realtime') as Dexie & {
  notifications: EntityTable<StoredNotification, 'id'>;
};

// v1 — flat ledger (pre-buckets). v2 — partitioned by bucket; the old rows lack the field
// so we clear on upgrade (resync repopulates with buckets on the next connect).
db.version(1).stores({ notifications: 'id, type, timestamp' });
db.version(2)
  .stores({ notifications: 'id, bucket, type, timestamp' })
  .upgrade((tx) => tx.table('notifications').clear());

export { db };

/**
 * The consumer bucket for an envelope, or null for events we don't badge (a deleted
 * message is a cache-remove signal, not a stored notification).
 */
export function bucketFor(env: NotificationEnvelope): Bucket | null {
  switch (env.type) {
    case 'PRESENT_RECEIVED':
      return 'gift';
    case 'MESSAGE_RECEIVED':
      return `chat:${(env.payload as ChatMessage).chatId}`;
    case 'MESSAGE_DELETED':
      return null;
    default:
      return 'misc';
  }
}

/** Upsert envelopes into their buckets (idempotent; non-bucketed types are skipped). */
export async function putNotifications(envelopes: NotificationEnvelope[]): Promise<void> {
  const rows: StoredNotification[] = [];
  for (const n of envelopes) {
    const bucket = bucketFor(n);
    if (bucket) rows.push({ id: n.id, bucket, type: n.type, timestamp: n.timestamp, payload: n.payload });
  }
  if (rows.length === 0) return;
  await db.notifications.bulkPut(rows);
}

/** Drop notifications from the ledger by id (after they're marked read server-side). */
export async function removeNotifications(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.notifications.bulkDelete(ids);
}
