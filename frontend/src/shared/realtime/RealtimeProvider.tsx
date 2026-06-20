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
//   3. drain ALL unread notifications to the end into the session store.
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
import { bucketFor, putNotifications, removeNotifications, allIds, ensureOwner, clearStore } from './store';
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

/**
 * All unread notifications, paginated to the end (cursor = last, smallest id).
 * `complete` is false only when the safety cap trips — then the result is a PREFIX of the
 * unread set, not the whole truth, so the caller must not reconcile (prune) against it.
 */
async function drainUnread(): Promise<{ items: NotificationEnvelope[]; complete: boolean }> {
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
      return { items: out, complete: false };
    }
  }
  return { items: out, complete: true };
}

/** The session JWT, read back from the httpOnly cookie, for the STOMP CONNECT header. */
async function fetchWsToken(): Promise<string> {
  const { token } = await api.get<{ token: string }>('/jwt');
  return token;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>('idle');

  useEffect(() => {
    // While auth is still resolving (user momentarily null on every reload), do nothing —
    // clearing here would wipe the store on every F5 and defeat the no-flash hydrate. Only
    // act once we actually know: connected user, or logged out.
    if (loading) return;
    if (userId == null) {
      setStatus('idle');
      clearStore(); // genuinely logged out
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

    // A LIVE frame: record it in the store (unread, dedup by id) then run any type-specific
    // side effect. Drained-backlog notifications skip this — they only populate the store
    // (no re-toasting / no recursive resync).
    async function dispatchLive(env: NotificationEnvelope) {
      if (env.type === 'MESSAGE_DELETED') {
        removeMessageFromCache(queryClient, env.payload as ChatMessage);
        return;
      }
      if (env.type === 'MESSAGE_RECEIVED') {
        const msg = env.payload as ChatMessage;
        // Show it live regardless of author, but stay SILENT — a chiming global chat is a
        // nuisance.
        mergeIncomingMessage(queryClient, msg);
        // Our OWN message, echoed back because we're connected on another device too: never
        // badge it. Retire the signal server-side and don't store it — otherwise the chat
        // badge flickers on every message we send (and lingers cross-device).
        if (msg.user.id === userId) {
          void api.post('/notifications/read', { ids: [env.id] });
          return;
        }
        putNotifications([env]); // someone else's → badge the chat:<id> bucket
        return;
      }
      // NEW_CHAT: a topology change handled like a chat signal — badge the new chat's
      // bucket SILENTLY (mirrors MESSAGE_RECEIVED, so the "Чаты" aggregate ticks),
      // re-subscribe to its topic, and refresh the (uncached) chats list. No chime, never
      // the misc inbox.
      if (env.type === 'NEW_CHAT') {
        putNotifications([env]); // bucketFor → chat:<newChatId>
        void runResync();
        void queryClient.invalidateQueries({ queryKey: ['chats'] });
        return;
      }

      // Everything else is stored; it chimes UNLESS it routes to the quiet owner stream
      // (owner ops live under "Владелец" and are read on entry there, never chiming).
      putNotifications([env]); // routes into the gift / owner / misc bucket
      if (bucketFor(env) !== 'owner') sfx.notify();
      if (env.type === 'PRESENT_RECEIVED') {
        void queryClient.invalidateQueries({ queryKey: ['presents'] });
      } else if (env.type === 'ROLE_CLAIMED') {
        void runResync(); // our capabilities changed → re-subscribe + re-evaluate access
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
      // Snapshot the store BEFORE we (re)subscribe. Anything that arrives live during this
      // resync lands in the store but NOT in this set, so the reconcile below can't prune
      // it — only rows we already knew going in are eligible to be dropped as stale.
      const knownIds = new Set<number>(allIds());

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

      // Drain the authoritative unread set → buckets (putNotifications routes gift/chat/owner/misc).
      const { items, complete } = await drainUnread();
      putNotifications(items);

      // A role change usually arrives while we were briefly disconnected (the access change
      // kicks the socket), so it lands in this drain rather than live dispatch. Chime ONCE
      // if a newly-seen ROLE_CLAIMED showed up, so the user still hears their role change.
      if (items.some((n) => n.type === 'ROLE_CLAIMED' && !knownIds.has(n.id))) {
        sfx.notify();
      }

      // Reconcile the store DOWN to the server truth. The drain is the full unread set, so
      // a row we knew before this resync that it no longer reports — read on another device,
      // or reaped by the backend's retention sweep — is stale and must go, or its badge would
      // outlive the notification. Skipped when the drain was capped (a prefix, not the truth).
      if (complete && !cancelled) {
        const live = new Set(items.map((n) => n.id));
        removeNotifications([...knownIds].filter((id) => !live.has(id)));
      }
    }

    setStatus('connecting');
    ensureOwner(userId);
    client.activate();

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
