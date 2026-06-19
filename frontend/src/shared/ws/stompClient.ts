import { Client } from '@stomp/stompjs';
import type { IMessage, StompSubscription } from '@stomp/stompjs';

// Native-WebSocket STOMP client pointed at the backend /ws endpoint.
// Same origin as the page, http(s) → ws(s). Wired now, lightly used for now.

function wsUrl(): string {
  const origin = window.location.origin; // e.g. http://host:5173
  return origin.replace(/^http/, 'ws') + '/ws';
}

/**
 * Build (and activate) a STOMP client. Reconnects automatically.
 * Callers own the lifecycle: keep the returned client and call
 * `client.deactivate()` on teardown.
 */
export function connectStomp(): Client {
  const client = new Client({
    brokerURL: wsUrl(),
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
  });
  client.activate();
  return client;
}

/**
 * Subscribe to a destination, parsing each frame body as JSON.
 * Returns the underlying subscription so the caller can unsubscribe.
 */
export function subscribe<T>(
  client: Client,
  destination: string,
  handler: (payload: T) => void,
): StompSubscription {
  return client.subscribe(destination, (message: IMessage) => {
    try {
      handler(JSON.parse(message.body) as T);
    } catch {
      // Non-JSON frame — ignore.
    }
  });
}
