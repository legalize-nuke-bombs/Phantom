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
//   2. paginate /api/topics → subscribe to every topic we may read,
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
import { GLOBAL_CHAT_ID } from '@/shared/chat/useChat';
import { chatsListKey, chatDetailKey } from '@/shared/chat/chats';
import { markBucketRead } from '@/shared/realtime/badges';
import type { Chat } from '@/shared/chat/chats';
import { bucketFor, putNotifications, removeNotifications, orphanChatNotificationIds, allIds, ensureOwner, clearStore } from './store';
import { isConsumedByActiveView } from './activeViews';
import type { ChatMessage, NotificationEnvelope } from './types';

type RealtimeStatus = 'idle' | 'connecting' | 'connected';

/** Live socket state for the UI cue: the status plus, while reconnecting, the epoch-ms time the
 *  next attempt is scheduled — so the indicator can count down to it. */
export interface RealtimeConnection {
  status: RealtimeStatus;
  nextRetryAt: number | null;
}

const RealtimeContext = createContext<RealtimeConnection>({ status: 'idle', nextRetryAt: null });

export function useRealtimeConnection(): RealtimeConnection {
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
    const page = await api.get<string[]>(`/topics?${q}`);
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

/** The global chat bucket (nil-UUID) — the one chat stream that never makes a sound. */
const GLOBAL_CHAT_BUCKET = `chat:${GLOBAL_CHAT_ID}`;

/**
 * Does a freshly-STORED notification make a sound? Everything chimes EXCEPT the global chat
 * (it can run at hundreds of messages a minute) and the silent owner feed (owner financial
 * events live under "Владелец" and are read on entry). Personal + group chats, new-chat
 * invites, gifts and misc account events all chime. Consumed events never reach here.
 */
function isAudible(env: NotificationEnvelope): boolean {
  const bucket = bucketFor(env);
  return bucket !== 'owner' && bucket !== GLOBAL_CHAT_BUCKET;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const [conn, setConn] = useState<RealtimeConnection>({ status: 'idle', nextRetryAt: null });

  useEffect(() => {
    // While auth is still resolving (user momentarily null on every reload), do nothing —
    // clearing here would wipe the store on every F5 and defeat the no-flash hydrate. Only
    // act once we actually know: connected user, or logged out.
    if (loading) return;
    if (userId == null) {
      setConn({ status: 'idle', nextRetryAt: null });
      clearStore(); // genuinely logged out
      return;
    }

    const subs = new Map<string, StompSubscription>();
    const resyncState = { running: false, rerun: false };
    let cancelled = false;
    // Mirror stompjs' EXPONENTIAL backoff (100ms → ×2 → cap 10s) so the indicator can show a
    // countdown to the next attempt — the library doesn't expose "time until next reconnect".
    let reconnectAttempt = 0;

    const brokerURL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;

    const client = new Client({
      brokerURL,
      // Fast first retry so an eviction-kick recovers quickly, then exponential
      // backoff (100ms → ×2 → cap 10s) if the server is genuinely down — no hammering.
      // NB: stompjs treats reconnectDelay:0 as "reconnection DISABLED" (and 0×2 stays 0),
      // so the base MUST be > 0 or EXPONENTIAL/maxReconnectDelay never fire at all.
      reconnectDelay: 100,
      maxReconnectDelay: 10000,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
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
        reconnectAttempt = 0;
        setConn({ status: 'connected', nextRetryAt: null });
        void runResync();
      },
      onWebSocketClose: () => {
        // The socket — and every STOMP subscription on it — is dead. Drop the handles
        // so the next onConnect → resync re-subscribes on the fresh socket instead of
        // seeing a "full" subs map and assuming it's still subscribed (which silently
        // dropped all live messages after a server-side kick until a full reload).
        subs.clear();
        if (!cancelled) {
          const delay = Math.min(100 * 2 ** reconnectAttempt, 10000);
          reconnectAttempt += 1;
          setConn({ status: 'connecting', nextRetryAt: Date.now() + delay });
        }
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

    // A LIVE frame. Three decisions, in order:
    //   1. side effects that must run no matter what (merge a message into its chat cache so it
    //      shows live; resync + refresh the list on a topology change),
    //   2. consume-vs-store (recordOrConsume): if a mounted view is showing the surface that
    //      reads this exact event, retire it server-side NOW and don't store it (no badge, no
    //      flicker); otherwise store it,
    //   3. sound: decided inside recordOrConsume — chime only for a STORED event in an audible
    //      stream (everything except the global chat and the silent owner feed).
    // Drained-backlog notifications skip all this — they only populate the store.
    async function dispatchLive(env: NotificationEnvelope) {
      if (env.type === 'MESSAGE_DELETED') {
        removeMessageFromCache(queryClient, env.payload as ChatMessage);
        // A pure cache-remove signal with no lasting value, never bucketed. Retire it
        // server-side at once — otherwise it sits unread forever (until the backend's
        // retention sweep) and every resync re-drains the whole growing pile. Fire-and-forget.
        void api.post('/notifications/read', { ids: [env.id] });
        return;
      }

      if (env.type === 'CHAT_DELETED') {
        // The chat was deleted, or I was kicked — payload is the now-gone Chat (id = UUID
        // string; NEVER Number() it). Mirror NEW_CHAT's eviction in reverse: drop this chat's
        // detail cache and invalidate the list so the row disappears. An open
        // ChatConversationPage refetches the (now-404) detail and shows "чат не найден" on its
        // own — no navigation here. markBucketRead kills any lingering unread badge for it (the
        // chat can never be opened again to clear it). Pure signal → retire it server-side now
        // so it doesn't sit unread and re-drain every resync. Fire-and-forget; all idempotent.
        const chatId = (env.payload as Chat).id;
        queryClient.removeQueries({ queryKey: chatDetailKey(chatId) });
        void queryClient.invalidateQueries({ queryKey: chatsListKey });
        void markBucketRead(`chat:${chatId}`);
        void api.post('/notifications/read', { ids: [env.id] });
        return;
      }

      if (env.type === 'MESSAGE_RECEIVED') {
        const msg = env.payload as ChatMessage;
        mergeIncomingMessage(queryClient, msg); // show it live regardless of author / where we are
        // Our OWN message, echoed because we're connected on another device too: never badge or
        // chime it — retire it server-side and don't store it.
        if (msg.user.id === userId) {
          void api.post('/notifications/read', { ids: [env.id] });
          return;
        }
        await recordOrConsume(env);
        return;
      }

      if (env.type === 'NEW_CHAT') {
        // A topology change: record-or-consume it (the chats LIST consumes NEW_CHAT — see
        // ChatsPage), then (re)subscribe to the new topic and refresh the (uncached) list.
        await recordOrConsume(env);
        void runResync();
        void queryClient.invalidateQueries({ queryKey: ['chats'] });
        return;
      }

      await recordOrConsume(env); // gift / owner / misc / role / level → its bucket
      if (env.type === 'PRESENT_RECEIVED') {
        void queryClient.invalidateQueries({ queryKey: ['presents'] });
      } else if (env.type === 'YOU_HAVE_BEEN_BLOCKED' || env.type === 'YOU_HAVE_BEEN_UNBLOCKED') {
        // Another user (un)blocked me. It's an informational misc event (recorded above), but it
        // also changes truth two REST surfaces own: who's blocked me (the blacklist) and whether
        // I may write our P2 (the chats list). Invalidate both by broad prefix so any cached
        // query under them refetches. We use the literal ['blacklist'] prefix on purpose — the
        // blacklist feature is authored elsewhere; we only nudge it, never import it.
        void queryClient.invalidateQueries({ queryKey: ['blacklist'] });
        void queryClient.invalidateQueries({ queryKey: ['chats'] });
      } else if (env.type === 'ROLE_CLAIMED') {
        void runResync(); // our capabilities changed → re-subscribe + re-evaluate access
      } else if (env.type === 'LEVEL_UP') {
        // New rank → refetch experience so the level-feature gates (SEND_MESSAGE, presents,
        // disk) re-evaluate and anything just unlocked goes live without a reload.
        void queryClient.invalidateQueries({ queryKey: ['experience'] });
      }
    }

    // Store the envelope and maybe chime — UNLESS a mounted view is already showing the surface
    // that reads it (isConsumedByActiveView), in which case mark it read on the server and skip
    // the store (no badge, no flicker) AND skip the sound (no nudge to something you're looking
    // at). Being on a page is NOT enough — the predicate matches the exact event a view consumes
    // (e.g. the chats list consumes NEW_CHAT but not incoming messages). The chime fires only for
    // a stored event in an audible stream.
    async function recordOrConsume(env: NotificationEnvelope) {
      if (isConsumedByActiveView(env)) {
        try {
          await api.post('/notifications/read', { ids: [env.id] });
          return;
        } catch (e) {
          // Couldn't retire it server-side — fall back to storing it so the signal isn't lost;
          // the next resync reconciles against the server truth anyway.
          console.warn('[realtime] mark-read-on-sight failed; storing instead', e);
        }
      }
      putNotifications([env]);
      if (isAudible(env)) sfx.notify();
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
      const topicIds = await fetchAllTopicIds();
      const dests = [userDestination(userId)];
      for (const tid of topicIds) dests.push(topicDestination(tid));
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

      // Our own messages echo back as MESSAGE_RECEIVED to every chat member, sender included. The
      // live path retires that echo on arrival; on a drain (message sent from another device, or
      // while we were away) it must do the same — otherwise our own message badges its chat. Retire
      // them server-side and keep them out of the store, mirroring the live path exactly.
      const ownMessageIds = items
        .filter((n) => n.type === 'MESSAGE_RECEIVED' && (n.payload as ChatMessage).user.id === userId)
        .map((n) => n.id);
      if (ownMessageIds.length > 0 && !cancelled) {
        void api.post('/notifications/read', { ids: ownMessageIds });
      }
      const ownSet = new Set(ownMessageIds);
      putNotifications(items.filter((n) => !ownSet.has(n.id)));

      // MESSAGE_DELETED is a transient cache-remove signal, never bucketed — so any that piled up
      // while we were away would otherwise stay unread and re-drain on every reconnect. Retire them
      // server-side now (the live path does the same on arrival); each drain shrinks the backlog.
      const staleDeletedIds = items.filter((n) => n.type === 'MESSAGE_DELETED').map((n) => n.id);
      if (staleDeletedIds.length > 0 && !cancelled) {
        void api.post('/notifications/read', { ids: staleDeletedIds });
      }

      // A role change usually arrives while we were briefly disconnected (the access change
      // kicks the socket), so it lands in this drain rather than live dispatch. Chime ONCE for
      // a newly-seen ROLE_CLAIMED so the user still hears it. Everything else stays SILENT on a
      // drain: chiming for every message/gift pulled in on each reconnect made leaving a chat
      // (or any brief socket drop) spam the sound — and the badges already reflect those.
      // A LEVEL_UP slipped in during the gap still refetches experience so feature gates re-eval.
      const freshDrained = items.filter((n) => !knownIds.has(n.id));
      if (freshDrained.some((n) => n.type === 'ROLE_CLAIMED')) {
        sfx.notify();
      }
      if (freshDrained.some((n) => n.type === 'LEVEL_UP')) {
        void queryClient.invalidateQueries({ queryKey: ['experience'] });
      }

      // Reconcile the store DOWN to the server truth. The drain is the full unread set, so
      // a row we knew before this resync that it no longer reports — read on another device,
      // or reaped by the backend's retention sweep — is stale and must go, or its badge would
      // outlive the notification. Skipped when the drain was capped (a prefix, not the truth).
      if (complete && !cancelled) {
        const live = new Set(items.map((n) => n.id));
        removeNotifications([...knownIds].filter((id) => !live.has(id)));
      }

      // Clear notifications stuck in the bucket of a chat we can no longer read (deleted or
      // left) — opening that chat is the only other way they'd be marked read, and it's gone.
      // Valid chats = the global chat + every personal-chat/<id> topic we may read.
      const validChats = new Set<string>([GLOBAL_CHAT_ID]);
      for (const tid of topicIds) {
        const m = /^personal-chat\/(.+)$/.exec(tid);
        if (m) validChats.add(m[1]);
      }
      const orphanIds = orphanChatNotificationIds(validChats);
      if (orphanIds.length > 0 && !cancelled) {
        try {
          await api.post('/notifications/read', { ids: orphanIds });
          removeNotifications(orphanIds);
        } catch (e) {
          console.warn('[realtime] failed to clear orphan chat notifications', e);
        }
      }
    }

    setConn({ status: 'connecting', nextRetryAt: null });
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

  return <RealtimeContext.Provider value={conn}>{children}</RealtimeContext.Provider>;
}
