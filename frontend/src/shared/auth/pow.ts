import { api } from '@/shared/api/client';

interface Challenge {
  salt: string;
  ts: number;
  sig: string;
  difficulty: number;
}

/**
 * Fetch a single-use PoW challenge, solve it off-thread, and return the headers to
 * attach to the auth request. Every register/login/recover call gets a FRESH challenge
 * (the backend consumes the salt on verify), so a solved token can't be replayed.
 */
export async function solveAuthPow(): Promise<Record<string, string>> {
  const ch = await api.get<Challenge>('/auth/challenge');
  const nonce = await solve(ch.salt, ch.difficulty);
  return {
    'X-Pow-Salt': ch.salt,
    'X-Pow-Ts': String(ch.ts),
    'X-Pow-Sig': ch.sig,
    'X-Pow-Nonce': nonce,
  };
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
