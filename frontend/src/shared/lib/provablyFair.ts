// Provably-fair primitives, mirrored exactly to the backend
// (com.example.phantom.provablyfair.ProvablyFairService).
//
// The contract, verified against source:
//   • A seed is 64 lowercase hex chars = 32 raw bytes (SEED_LENGTH = 2 * 32).
//   • serverHash = hex( SHA-256( rawBytes(serverSeed) ) ) — the digest is taken
//     over the DECODED bytes of the seed, NOT over its hex string. We must decode
//     before hashing or verification will never match.
//
// The client commits a fresh clientSeed per round; after the run the server reveals
// the serverSeed and we re-derive its hash to confirm it equals the committed
// serverHash. Equality proves the server fixed the seed before seeing our seed.

/** Seed length in hex chars (= backend ProvablyFairService.SEED_LENGTH). */
export const SEED_LENGTH = 64;

/** Hex-encode a byte array as lowercase, two chars per byte. */
function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/**
 * A fresh client seed: 64 lowercase hex chars from 32 CSPRNG bytes
 * (crypto.getRandomValues). Exactly the length the backend's GameRunRequest
 * validates (@Size min=max=64).
 */
export function generateClientSeed(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/**
 * Decode a hex string to bytes; returns null if it is not valid even-length hex.
 * The result is backed by a plain ArrayBuffer (not SharedArrayBuffer) so it is a
 * valid BufferSource for crypto.subtle.digest under TS's strict lib.dom typings.
 */
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length === 0 || hex.length % 2 !== 0) return null;
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Verify a revealed serverSeed against the committed serverHash.
 *
 * Recomputes hex(SHA-256(rawBytes(serverSeed))) via Web Crypto and strict-equals
 * it (case-insensitively) to serverHash. Resolves false on malformed input rather
 * than throwing, so callers can render a plain "not verified" badge.
 */
export async function verifyServerHash(
  serverSeed: string,
  serverHash: string,
): Promise<boolean> {
  const raw = hexToBytes(serverSeed);
  if (!raw) return false;
  const digest = await crypto.subtle.digest('SHA-256', raw);
  const computed = toHex(new Uint8Array(digest));
  return computed === serverHash.toLowerCase();
}
