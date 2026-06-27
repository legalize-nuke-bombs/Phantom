/// <reference lib="webworker" />
// Proof-of-work solver. Runs off the main thread. Finds a nonce such that
// sha256(`salt:nonce`) has at least `difficulty` leading zero BITS — must match the
// backend's PowService.leadingZeroBits check exactly.
import { sha256 } from 'js-sha256';

function leadingZeroBits(bytes: number[]): number {
  let bits = 0;
  for (const b of bytes) {
    if (b === 0) {
      bits += 8;
      continue;
    }
    bits += Math.clz32(b) - 24;
    break;
  }
  return bits;
}

self.onmessage = (e: MessageEvent<{ salt: string; difficulty: number }>) => {
  const { salt, difficulty } = e.data;
  let nonce = 0;
  for (;;) {
    if (leadingZeroBits(sha256.array(`${salt}:${nonce}`)) >= difficulty) {
      postMessage({ nonce: String(nonce) });
      return;
    }
    nonce++;
  }
};
