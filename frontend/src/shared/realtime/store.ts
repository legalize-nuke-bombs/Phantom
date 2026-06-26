// store.ts — the session-scoped store of UNREAD notification signals, partitioned by BUCKET.
//
// Design (Nikita's call): notifications are transient signals, and the server is the only
// source of truth — resync() re-drains the unread set on every (re)connect. So this store is
// a pure PROJECTION of that truth, not a second copy to keep alive. We hold it in memory and
// merely MIRROR it to sessionStorage:
//   • survives F5 — sessionStorage hydrates SYNCHRONOUSLY at module load, before first paint,
//     so badges show their real count immediately (no 0→N flash),
//   • but is NOT long-term — it dies with the tab; a different user clears it; and the resync
//     reconcile self-heals drift, so a stale entry lives at most one tab-session.
// That kills the whole class of persistence-drift bugs the old IndexedDB ledger had, while
// keeping the one thing persistence bought us (no reload flash).
//
// One flat record keyed by notification id, partitioned by `bucket` ('gift' | 'chat:<id>' |
// 'misc') — so a future DM is just another bucket, no schema growth. Reactive via
// useSyncExternalStore; counts are primitives, so an unchanged count never re-renders.

import { useSyncExternalStore } from 'react';
import type { ChatMessage, NotificationEnvelope } from './types';

/** Which consumer a notification belongs to: 'gift' | 'chat:<chatId>' | 'misc'. */
export type Bucket = string;

/** One stored unread notification (envelope flattened; partitioned by `bucket`). */
export interface StoredNotification {
  id: number;
  bucket: Bucket;
  type: string;
  timestamp: number;
  payload: unknown;
}

const STORAGE_KEY = 'phantom.unread';

/** sessionStorage shape: the rows plus the user they belong to (guards account switches). */
interface Persisted {
  owner: number;
  rows: StoredNotification[];
}

// ── state ───────────────────────────────────────────────────────────────────────
let rows = new Map<number, StoredNotification>();
let owner: number | null = null;
const listeners = new Set<() => void>();

// Hydrate SYNCHRONOUSLY at module load (before React's first render) — this is what removes
// the F5 badge flash: sessionStorage is synchronous and already populated on a reload.
try {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (raw) {
    const data = JSON.parse(raw) as Persisted;
    owner = data.owner;
    for (const r of data.rows) rows.set(r.id, r);
  }
} catch {
  /* corrupt / unavailable → start empty */
}

function persist(): void {
  try {
    if (owner == null) {
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      const data: Persisted = { owner, rows: [...rows.values()] };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    /* quota / private mode → run memory-only, no big deal */
  }
}

/** Mirror to sessionStorage and notify subscribers. Call after every mutation. */
function changed(): void {
  persist();
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ── routing ─────────────────────────────────────────────────────────────────────
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
    case 'NEW_CHAT':
      // Being added to a chat is a chat signal, not inbox junk — badge that chat's
      // bucket (so the "Чаты" aggregate ticks) exactly like an incoming message.
      return `chat:${(env.payload as { id: string }).id}`;
    case 'MESSAGE_DELETED':
      return null;
    // Owner-only FINANCIAL events: a quiet "Владелец" stream, never the misc inbox. Config
    // changes (master wallet / sweep schedule) are NOT here — they go to the misc inbox
    // with sound like any other notable account event.
    case 'NEW_WITHDRAWAL':
    case 'WITHDRAWAL_FAILED':
    case 'NEW_SWEEP':
      return 'owner';
    default:
      return 'misc';
  }
}

// ── mutations ─────────────────────────────────────────────────────────────────────
/** Upsert envelopes into their buckets (idempotent by id; non-bucketed types skipped). */
export function putNotifications(envelopes: NotificationEnvelope[]): void {
  let mutated = false;
  for (const n of envelopes) {
    const bucket = bucketFor(n);
    if (!bucket) continue;
    rows.set(n.id, { id: n.id, bucket, type: n.type, timestamp: n.timestamp, payload: n.payload });
    mutated = true;
  }
  if (mutated) changed();
}

/** Drop notifications by id (after they're marked read server-side, or reconciled away). */
export function removeNotifications(ids: number[]): void {
  let mutated = false;
  for (const id of ids) if (rows.delete(id)) mutated = true;
  if (mutated) changed();
}

/** Reset to a given owner, clearing if it changed (an account switch in the same tab). */
export function ensureOwner(userId: number): void {
  if (owner === userId) return;
  rows = new Map();
  owner = userId;
  changed();
}

/** Wipe the store (a genuine logout). */
export function clearStore(): void {
  if (owner == null && rows.size === 0) return;
  rows = new Map();
  owner = null;
  changed();
}

// ── reads ─────────────────────────────────────────────────────────────────────────
/** Every stored id — the resync reconcile diffs this against the fresh drain. */
export function allIds(): number[] {
  return [...rows.keys()];
}

/** Unread ids in one bucket (markBucketRead posts these, then drops them). */
export function bucketIds(bucket: Bucket): number[] {
  const out: number[] = [];
  for (const r of rows.values()) if (r.bucket === bucket) out.push(r.id);
  return out;
}

/**
 * Ids of chat-bucket notifications whose chat id is NOT in `validChatIds` — orphans left by a
 * chat that was deleted or that I left. They can never be cleared by opening the chat (it's
 * gone), so they'd badge forever; the resync marks them read directly. The global chat (the
 * nil-UUID GLOBAL_CHAT_ID) is always valid.
 */
export function orphanChatNotificationIds(validChatIds: ReadonlySet<string>): number[] {
  const out: number[] = [];
  for (const r of rows.values()) {
    if (!r.bucket.startsWith('chat:')) continue;
    if (!validChatIds.has(r.bucket.slice('chat:'.length))) out.push(r.id);
  }
  return out;
}

/** Rows in one bucket, oldest→newest (the misc inbox snapshot; the gift payload lookup). */
export function bucketRows(bucket: Bucket): StoredNotification[] {
  return [...rows.values()].filter((r) => r.bucket === bucket).sort((a, b) => a.id - b.id);
}

function countBucket(bucket: Bucket): number {
  let n = 0;
  for (const r of rows.values()) if (r.bucket === bucket) n++;
  return n;
}

/** The global chat's bucket — the one personal-chat aggregates exclude. */
const GLOBAL_CHAT_BUCKET: Bucket = 'chat:1';

/**
 * Unread rows across ALL personal/group chats: every `chat:<id>` bucket EXCEPT the
 * global chat. A primitive number so useSyncExternalStore stays referentially stable
 * (an unchanged count never re-renders the nav). See usePersonalChatsUnread.
 */
function countPersonalChats(): number {
  let n = 0;
  for (const r of rows.values()) {
    if (r.bucket.startsWith('chat:') && r.bucket !== GLOBAL_CHAT_BUCKET) n++;
  }
  return n;
}

/** Live unread count for one bucket (0 when bucket is null), reactive across the app. */
export function useUnreadCount(bucket: Bucket | null): number {
  return useSyncExternalStore(subscribe, () => (bucket == null ? 0 : countBucket(bucket)));
}

/**
 * Live unread total across every personal/group chat (all `chat:<id>` buckets minus
 * the global chat:1) — for the "Чаты" nav item's aggregate badge. Reactive, returns a
 * primitive so it doesn't churn renders.
 */
export function usePersonalChatsUnread(): number {
  return useSyncExternalStore(subscribe, countPersonalChats);
}
