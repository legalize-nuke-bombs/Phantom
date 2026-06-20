// RealtimeProvider — the single STOMP connection + the resync routine that the whole
// app's realtime (notifications, badges, chat) rides on.
//
// Governing rule (Nikita's design): notifications are transient SIGNALS, not a source
// of truth. The truth lives in each feature's REST endpoint; a notification at most
// says "something changed, refresh / count me". So losing or doubling a frame can't
// corrupt anything — every handler is idempotent and dedups by notification id.
//
// Lifecycle, per connect (onConnect → resync):
//   1. subscribe to our own /topic/users/{userId} (always allowed),
//   2. paginate /api/notifications/topics → subscribe to every topic we may read,
//      diffing against live subscriptions (new → subscribe, gone → unsubscribe; that
//      diff IS the eviction mechanism — the backend drops the socket on access change,
//      we reconnect, the revoked topic is no longer in the list, we don't resub),
//   3. drain ALL unread notifications to the end into the Dexie ledger.
// SUBSCRIBE happens BEFORE the drain so nothing slips through the gap; id-dedup covers
// the overlap. resync also re-runs on NEW_CHAT / ROLE_CLAIMED (topology changed).

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Client, ReconnectionTimeMode } from '@stomp/stompjs';
import type { IMessage, StompSubscription } from '@stomp/stompjs';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthContext';
import { api } from '@/shared/api/client';
import { sfx } from '@/shared/lib/sound';
import { mergeIncomingMessage, removeMessageFromCache } from '@/shared/chat/chatCache';
import { db, putNotifications } from './db';
import type { ChatMessage, NotificationEnvelope } from './types';

type RealtimeStatus = 'idle' | 'connecting' | 'connected';

const RealtimeContext = createContext<RealtimeStatus>('idle');

/** Connection status, for an optional "reconnecting…" cue in the UI. */
export function useRealtimeStatus(): RealtimeStatus {
  return useContext(RealtimeContext);
}

// ── destinations ────────────────────────────────────────────────────────────
const userDestination = (userId: number) => `/topic/users/${userId}`;
const topicDestination = (topicId: string) => `/topic/${topicId}`;

// ── REST helpers (cursor pagination by `before` id) ───────────────────────────

/** Every topic id we may read, paginated to the end (cursor = last topic id). */
async function fetchAllTopicIds(): Promise<string[]> {
  const out: string[] = [];
  const limit = 50;
  let before: string | undefined;
  for (;;) {
    const q = new URLSearchParams({ limit: String(limit) });
    if (before !== undefined) q.set('before', before);
    const page = await api.get<string[]>(`/notifications/topics?${q}`);
    out.push(...page);
    if (page.length < limit) break;
    before = page[page.length - 1];
  }
  return out;
}

/** All unread notifications, paginated to the end (cursor = last, smallest id). */
async function drainUnread(): Promise<NotificationEnvelope[]> {
  const out: NotificationEnvelope[] = [];
  const limit = 50;
  let before: number | undefined;
  for (;;) {
    const q = new URLSearchParams({ notReadOnly: 'true', limit: String(limit) });
    if (before !== undefined) q.set('before', String(before));
    const page = await api.get<NotificationEnvelope[]>(`/notifications?${q}`);
    out.push(...page);
    if (page.length < limit) break;
    before = page[page.length - 1].id;
    if (out.length >= 5000) {
      // Steady-state unread is small (the user marks things read); this only trips for
      // a pathological backlog. Cap + log rather than drain forever or hide it.
      console.warn('[realtime] unread drain hit the 5000 safety cap');
      break;
    }
  }
  return out;
}

/** The session JWT, read back from the httpOnly cookie, for the STOMP CONNECT header. */
async function fetchWsToken(): Promise<string> {
  const { token } = await api.get<{ token: string }>('/jwt');
  return token;
}

// The ledger belongs to one user. Clear it when a DIFFERENT user owns the session
// (logout, or a switch), but NOT on a reload of the same user — that would defeat the
// persistence (badge flashing 0→N). Keyed in localStorage so it survives reloads.
const LEDGER_OWNER_KEY = 'phantom.realtime.owner';
async function ensureLedgerOwner(userId: number): Promise<void> {
  if (localStorage.getItem(LEDGER_OWNER_KEY) !== String(userId)) {
    await db.notifications.clear();
    localStorage.setItem(LEDGER_OWNER_KEY, String(userId));
  }
}
async function clearLedger(): Promise<void> {
  await db.notifications.clear();
  localStorage.removeItem(LEDGER_OWNER_KEY);
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>('idle');

  useEffect(() => {
    // While auth is still resolving (user momentarily null on every reload), do nothing —
    // clearing here would wipe the persisted ledger on every F5 and defeat the whole
    // point of keeping it. Only act once we actually know: connected user, or logged out.
    if (loading) return;
    if (userId == null) {
      setStatus('idle');
      void clearLedger(); // genuinely logged out
      return;
    }

    const subs = new Map<string, StompSubscription>();
    const resyncState = { running: false, rerun: false };
    let cancelled = false;

    const brokerURL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;

    const client = new Client({
      brokerURL,
      // Near-instant first retry so an eviction-kick recovers fast, but back off
      // exponentially (cap 10s) if the server is genuinely down — no hammering.
      reconnectDelay: 200,
      maxReconnectDelay: 10000,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      beforeConnect: async () => {
        try {
          const token = await fetchWsToken();
          client.connectHeaders = { Authorization: `Bearer ${token}` };
        } catch (e) {
          // No token yet (backend down / session gone): connect will fail and the
          // client retries on reconnectDelay, re-fetching the token next time.
          client.connectHeaders = {};
          console.warn('[realtime] ws token fetch failed', e);
        }
      },
      onConnect: () => {
        setStatus('connected');
        void runResync();
      },
      onWebSocketClose: () => {
        // The socket — and every STOMP subscription on it — is dead. Drop the handles
        // so the next onConnect → resync re-subscribes on the fresh socket instead of
        // seeing a "full" subs map and assuming it's still subscribed (which silently
        // dropped all live messages after a server-side kick until a full reload).
        subs.clear();
        if (!cancelled) setStatus('connecting');
      },
      onStompError: (frame) =>
        console.warn('[realtime] STOMP error:', frame.headers['message'], frame.body),
      onWebSocketError: (e) => console.warn('[realtime] WebSocket error', e),
    });

    const onMessage = (msg: IMessage) => {
      let env: NotificationEnvelope;
      try {
        env = JSON.parse(msg.body) as NotificationEnvelope;
      } catch {
        return;
      }
      void dispatchLive(env);
    };

    // A LIVE frame: record it in the ledger (unread, dedup by id) then run any
    // type-specific side effect. Drained-backlog notifications skip this — they only
    // populate the ledger (no re-toasting / no recursive resync).
    async function dispatchLive(env: NotificationEnvelope) {
      if (env.type === 'MESSAGE_DELETED') {
        removeMessageFromCache(queryClient, env.payload as ChatMessage);
        return;
      }
      await putNotifications([env]); // routes into the gift / chat:<id> / misc bucket
      if (env.type === 'MESSAGE_RECEIVED') {
        // chat: show it live, but stay SILENT — a chiming global chat would be a nuisance.
        mergeIncomingMessage(queryClient, env.payload as ChatMessage);
        return;
      }
      // gift + misc both chime.
      sfx.notify();
      if (env.type === 'PRESENT_RECEIVED') {
        void queryClient.invalidateQueries({ queryKey: ['presents'] });
      } else if (env.type === 'NEW_CHAT' || env.type === 'ROLE_CLAIMED') {
        void runResync(); // topology changed → re-subscribe + re-drain
      }
    }

    async function runResync() {
      if (resyncState.running) {
        resyncState.rerun = true;
        return;
      }
      resyncState.running = true;
      try {
        do {
          resyncState.rerun = false;
          await resyncOnce();
        } while (resyncState.rerun && !cancelled);
      } catch (e) {
        console.warn('[realtime] resync failed', e);
      } finally {
        resyncState.running = false;
      }
    }

    async function resyncOnce() {
      if (cancelled || !client.connected || userId == null) return;
      // Topics we may read = our user topic + everything from /topics. Fetch FIRST (old
      // subs stay live during the network call), then re-subscribe WHOLESALE: drop all,
      // subscribe the full set — no smart diff. Every reconnect/F5 re-subscribes anyway,
      // so diffing what changed buys nothing. Subscribing to exactly the current list IS
      // the eviction: a revoked topic simply isn't in it.
      const dests = [userDestination(userId)];
      for (const tid of await fetchAllTopicIds()) dests.push(topicDestination(tid));
      if (cancelled || !client.connected) return;
      for (const [, sub] of subs) {
        try {
          sub.unsubscribe();
        } catch {
          /* already gone */
        }
      }
      subs.clear();
      for (const dest of dests) {
        try {
          subs.set(dest, client.subscribe(dest, onMessage));
        } catch (e) {
          console.warn('[realtime] subscribe failed', dest, e);
        }
      }
      // Drain all unread → buckets (putNotifications routes gift / chat:<id> / misc).
      await putNotifications(await drainUnread());
    }

    setStatus('connecting');
    void (async () => {
      await ensureLedgerOwner(userId);
      if (!cancelled) client.activate();
    })();

    return () => {
      cancelled = true;
      for (const [, sub] of subs) {
        try {
          sub.unsubscribe();
        } catch {
          /* socket already closing */
        }
      }
      subs.clear();
      void client.deactivate();
    };
  }, [userId, loading, queryClient]);

  return <RealtimeContext.Provider value={status}>{children}</RealtimeContext.Provider>;
}
