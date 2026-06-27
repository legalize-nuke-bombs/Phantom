/// <reference lib="webworker" />
// Proof-of-work solver. Runs off the main thread so the UI stays responsive while
// grinding. Finds a nonce such that sha256(`salt:nonce`) has `difficulty` leading
// zero hex chars — must match the backend's PowService check byte-for-byte.
import { sha256 } from 'js-sha256';

self.onmessage = (e: MessageEvent<{ salt: string; difficulty: number }>) => {
  const { salt, difficulty } = e.data;
  const prefix = '0'.repeat(difficulty);
  let nonce = 0;
  for (;;) {
    if (sha256(`${salt}:${nonce}`).startsWith(prefix)) {
      postMessage({ nonce: String(nonce) });
      return;
    }
    nonce++;
  }
};
