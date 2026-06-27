import { api } from '@/shared/api/client';

interface Challenge {
  salt: string;
  ts: number;
  sig: string;
  difficulty: number;
}

export interface PowProof {
  salt: string;
  ts: number;
  sig: string;
  nonce: string;
}

/**
 * Fetch a single-use PoW challenge, solve it off-thread, and return the proof to put in
 * the request body. Every register/login/recover call gets a FRESH challenge (the backend
 * consumes the salt on verify), so a solved proof can't be replayed.
 */
export async function solveAuthPow(): Promise<PowProof> {
  const ch = await api.get<Challenge>('/pow/challenge');
  const nonce = await solve(ch.salt, ch.difficulty);
  return { salt: ch.salt, ts: ch.ts, sig: ch.sig, nonce };
}

function solve(salt: string, difficulty: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./pow.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<{ nonce: string }>) => {
      resolve(e.data.nonce);
      worker.terminate();
    };
    worker.onerror = (err) => {
      reject(err);
      worker.terminate();
    };
    worker.postMessage({ salt, difficulty });
  });
}
