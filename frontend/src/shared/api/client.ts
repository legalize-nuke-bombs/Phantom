// Typed fetch wrapper for the Phantom backend.
// Same-origin via the dev proxy: base path /api. Always sends the httpOnly auth
// cookie (credentials:'include'). Backend errors are Spring ProblemDetail with an
// extra `code` property carrying the ErrorCode enum name — we surface both
// `status` and `code` so the UI can map them to friendly messages (see errors.ts).

const BASE = '/api';

export class ApiError extends Error {
  readonly status: number;
  /** Backend ErrorCode enum name, e.g. "INVALID_PASSWORD" (when present). */
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'include',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Нет соединения с сервером');
  }

  // The edge (Caddy ALTCHA gate) 302-redirects un-verified requests to the /captcha
  // interstitial. fetch follows that silently and hands back the captcha HTML, so an
  // expired PoW cookie would otherwise surface as a JSON parse error mid-session.
  // Detect the redirect and send the whole tab through the challenge, returning here.
  if (res.redirected && new URL(res.url).pathname.startsWith('/captcha')) {
    const back = location.pathname + location.search;
    location.href = '/captcha?return=' + encodeURIComponent(back);
    return new Promise<T>(() => {}); // navigation is taking over; this never resolves
  }

  // 204 / empty body: nothing to parse.
  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let data: unknown;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const obj = (data ?? {}) as Record<string, unknown>;
    const code = typeof obj.code === 'string' ? obj.code : undefined;
    // ProblemDetail carries human text in `detail`; many ApiExceptions ship only
    // a code (no detail) — those resolve to a friendly message via the code map.
    const detail =
      (typeof obj.detail === 'string' && obj.detail) ||
      (typeof obj.message === 'string' && obj.message) ||
      undefined;
    throw new ApiError(res.status, detail ?? res.statusText ?? 'Ошибка запроса', code);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};

export const { get, post, patch, del } = api;
