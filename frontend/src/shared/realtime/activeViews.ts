// activeViews.ts — the "active view" registry behind consume-on-dispatch.
//
// Nikita's rule: a notification that arrives while you are ALREADY looking at the surface
// which marks it read should be retired on the server IMMEDIATELY and never enter the store
// (no badge, no flicker). Being on a page is NOT the same as having read its contents — the
// chats LIST does not mark messages read (only opening a specific chat does) — so this is
// deliberately NOT "suppress badges while page X is mounted". Instead every consumer view
// registers a PREDICATE over the notification envelope: "right now, do I consume THIS exact
// event?". RealtimeProvider's live dispatch asks the registry; if any active view consumes the
// event it POSTs /read and skips the store, otherwise it stores it (and may chime).
//
// Predicates inspect the event, not just the bucket: the chats list consumes NEW_CHAT events
// (the new chat is right there in the list) but NOT MESSAGE_RECEIVED (the list never opens the
// chat), so a per-bucket flag would be too coarse — hence a full envelope predicate.

import { useEffect, useRef } from 'react';
import type { NotificationEnvelope } from './types';

export type NotificationMatcher = (env: NotificationEnvelope) => boolean;

const matchers = new Set<NotificationMatcher>();

/** True if any currently-mounted consumer view marks this envelope read on sight. */
export function isConsumedByActiveView(env: NotificationEnvelope): boolean {
  for (const match of matchers) {
    try {
      if (match(env)) return true;
    } catch {
      /* a misbehaving predicate must never break notification dispatch */
    }
  }
  return false;
}

/**
 * Register, for the lifetime of the calling component, that it consumes (marks read on sight)
 * any notification its `predicate` returns true for. The predicate is read live from a ref, so
 * an inline arrow recreated every render is fine — we register ONE stable wrapper on mount and
 * remove it on unmount, never churning the set.
 */
export function useConsumesNotifications(predicate: NotificationMatcher): void {
  const ref = useRef(predicate);
  ref.current = predicate;
  useEffect(() => {
    const wrapper: NotificationMatcher = (env) => ref.current(env);
    matchers.add(wrapper);
    return () => {
      matchers.delete(wrapper);
    };
  }, []);
}
