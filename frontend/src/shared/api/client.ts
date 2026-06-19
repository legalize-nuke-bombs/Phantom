// Typed fetch wrapper for the Phantom backend.
// Same-origin via the dev proxy: base path /api. Always sends the auth cookie
// (credentials:'include'); also accepts/returns JSON. Backend errors arrive as
// Spring ProblemDetail ({ detail, code, status }) — we normalise those into ApiError.

const BASE = '/api';

export class ApiError extends Error {
  readonly status: number;
  /** Backend ErrorCode name when present (e.g. "NOT_AUTHENTICATED"). */
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
    throw new ApiError(0, 'Сеть недоступна');
  }

  // 204 / empty body: nothing to parse.
  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const obj = (data ?? {}) as Record<string, unknown>;
    const message =
      (typeof obj.detail === 'string' && obj.detail) ||
      (typeof obj.error === 'string' && obj.error) ||
      (typeof obj.message === 'string' && obj.message) ||
      res.statusText ||
      'Ошибка запроса';
    const code = typeof obj.code === 'string' ? obj.code : undefined;
    throw new ApiError(res.status, message, code);
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
