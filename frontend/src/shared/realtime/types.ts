// Realtime contract — mirrors the backend notification/chat *Representation classes
// (com.example.phantom.notification.*, com.example.phantom.chat.message.*). Verified
// from source, not ENDPOINTS.md. Everything the server pushes over STOMP AND every
// item the REST notification feed returns is a NotificationEnvelope: a typed wrapper
// whose `payload` shape depends on `type`.

import type { Role, ShortUser } from '@/shared/types';

/** NotificationType enum (com.example.phantom.notification.NotificationType). */
export type NotificationType =
  | 'PRESENT_RECEIVED'
  | 'BANNED'
  | 'UNBANNED'
  | 'YOUR_MESSAGE_DELETED'
  | 'MESSAGE_RECEIVED'
  | 'MESSAGE_DELETED'
  | 'NEW_CHAT'
  // The chat I'm in was deleted, or I was kicked out of it — payload is the gone Chat.
  // A pure cache-eviction signal (like MESSAGE_DELETED): drop the chat's cache, refresh
  // the list, never bucket it.
  | 'CHAT_DELETED'
  | 'ROLE_CLAIMED'
  | 'WELCOME'
  | 'LEVEL_UP'
  // Another USER blocked / unblocked ME (NOT a chat ban — that's BANNED/UNBANNED). Payload
  // is the BlackRepresentation of the relationship (author = them, target = me). Informational
  // (→ misc inbox) but also flips my write-rights, so the handler reinvalidates blacklist+chats.
  | 'YOU_HAVE_BEEN_BLOCKED'
  | 'YOU_HAVE_BEEN_UNBLOCKED'
  | 'BROADCAST'
  | 'LOTTERY_IS_ENDING'
  | 'LOTTERY_ENDED'
  | 'YOU_WON_LOTTERY'
  | 'MASTER_WALLET_SET'
  | 'SWEEP_SCHEDULE_SET'
  | 'NEW_SWEEP'
  | 'NEW_WITHDRAWAL'
  | 'WITHDRAWAL_FAILED';

/**
 * NotificationRepresentation — the envelope for every pushed/persisted notification.
 * Same shape over WS and over GET /api/notifications. `payload` is type-dependent
 * (e.g. a ChatMessage for MESSAGE_RECEIVED, a PresentPayload for PRESENT_RECEIVED).
 */
export interface NotificationEnvelope<P = unknown> {
  id: number;
  timestamp: number; // epoch seconds
  type: NotificationType;
  payload: P;
}

/** FileRepresentation — a message attachment (no attachment support in v1). */
export interface FileRef {
  id: string; // UUID
  timestamp: number;
  user: ShortUser;
  name: string;
  size: number;
}

/**
 * MessageRepresentation — payload of MESSAGE_RECEIVED / MESSAGE_DELETED, and the item
 * shape of GET /api/chat/messages. NOTE: chatId is a STRING server-side (the global
 * chat's numeric id 1 arrives as "1").
 */
export interface ChatMessage {
  id: number;
  chatId: string;
  user: ShortUser;
  timestamp: number; // epoch seconds
  content: string;
  attachment: FileRef | null;
}

/** PresentRepresentation — payload of PRESENT_RECEIVED. */
export interface PresentPayload {
  id: number;
  claimed: boolean;
  timestamp: number;
  amount: string; // decimal
  description: string | null;
  sender: ShortUser | null;
}

/** RoleClaimedPayload — payload of ROLE_CLAIMED. `user` = who changed it; `role` = the new role. */
export interface RoleClaimedPayload {
  user: ShortUser;
  role: Role;
}

/** BroadcastPayload — payload of BROADCAST. `user` = the moderator/owner who sent it. */
export interface BroadcastPayload {
  user: ShortUser;
  content: string;
}

/**
 * BlackRepresentation — payload of YOU_HAVE_BEEN_BLOCKED / YOU_HAVE_BEEN_UNBLOCKED: one
 * block relationship. `author` is who (un)blocked me, `target` is me. Declared INDEPENDENTLY
 * here (not imported from shared/chat/blacklist.ts) so the realtime layer owns its own wire
 * contract and doesn't take a dependency on the blacklist feature — minimal by design.
 */
export interface BlackRepresentation {
  id: number;
  author: ShortUser;
  target: ShortUser;
  timestamp: number; // epoch seconds
}
