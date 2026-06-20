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

/* ── pure-JS SHA-256 ──────────────────────────────────────────────────────────
   crypto.subtle exists ONLY in a secure context (https / localhost). Phantom is
   reached over plain http on the LAN IP and .onion, where crypto.subtle is
   undefined — so we keep a tiny self-contained SHA-256 as a fallback. That way the
   provably-fair check works everywhere, and a missing Web Crypto can never break a
   game round. (32-byte input, once per round → speed is irrelevant.) */

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;

/** SHA-256 of a byte array → lowercase hex. Self-contained (no Web Crypto). */
function sha256Hex(bytes: Uint8Array): string {
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const ml = bytes.length;
  const total = (((ml + 8) >> 6) + 1) * 64; // padded length, multiple of 64
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[ml] = 0x80; // append the '1' bit
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, Math.floor(ml / 0x20000000), false); // bit-length hi
  dv.setUint32(total - 4, (ml * 8) >>> 0, false); // bit-length lo

  const w = new Uint32Array(64);
  for (let off = 0; off < total; off += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(off + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, hh = h7;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + SHA256_K[t] + w[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + hh) >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((x) => (x >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Verify a revealed serverSeed against the committed serverHash.
 *
 * Recomputes hex(SHA-256(rawBytes(serverSeed))) — via Web Crypto when available,
 * else the JS fallback above — and strict-equals it (case-insensitively) to
 * serverHash. NEVER throws (returns false on malformed input / any failure) so a
 * verification problem can never break a game round.
 */
export async function verifyServerHash(
  serverSeed: string,
  serverHash: string,
): Promise<boolean> {
  const raw = hexToBytes(serverSeed);
  if (!raw) return false;
  const target = serverHash.toLowerCase();
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', raw);
      return toHex(new Uint8Array(digest)) === target;
    }
    return sha256Hex(raw) === target;
  } catch {
    try {
      return sha256Hex(raw) === target;
    } catch {
      return false;
    }
  }
}
