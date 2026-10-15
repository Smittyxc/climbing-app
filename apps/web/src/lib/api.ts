import { auth } from '@/lib/firebase';
import { API_BASE_URL } from '@/config';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: BodyInit;
  headers?: HeadersInit;
  /** Attach the Firebase ID token (default true). */
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.auth !== false) {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body,
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ?? body.title ?? detail;
    } catch {
      // no JSON body
    }
    throw new ApiError(response.status, detail || `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function jsonBody(body: unknown): BodyInit {
  return JSON.stringify(body);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : jsonBody(body),
      headers: { 'Content-Type': 'application/json' },
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body === undefined ? undefined : jsonBody(body),
      headers: { 'Content-Type': 'application/json' },
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : jsonBody(body),
      headers: { 'Content-Type': 'application/json' },
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form }),
};
