/**
 * The one place the browser talks to the Worker.
 *
 * Every service beside this file is a list of endpoints; this is the only thing
 * that knows about `fetch`, cookies, query strings or the response envelope. It
 * unwraps `{ success, data, code, msg }` so a caller receives the payload and
 * nothing else — a component should never be reading `.data.data`.
 *
 * There is no token handling here, and that is the design rather than an
 * omission. veyra_admin's equivalent carries a bearer token in `localStorage`
 * and refreshes it on 401; this admin's session is an HttpOnly cookie the
 * browser attaches on its own, which is why `credentials: 'same-origin'` is the
 * whole of the auth story and why nothing worth stealing is reachable from JS.
 */
import type { ApiResponse } from './types';
import type { Problem } from '../../shared/content/validate';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Present when the server rejected the content field by field. */
    readonly problems?: Problem[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Query = Record<string, string | number | undefined>;
const REQUEST_TIMEOUT_MS = 30_000;

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Serialised as JSON, with the header set to match. */
  body?: unknown;
  /** Sent as-is. Photographs go up this way; base64 would cost a third again. */
  raw?: BodyInit;
  query?: Query;
}

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return search === '' ? path : `${path}?${search}`;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, raw, query, headers, signal, ...init } = options;
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const requestSignal = signal == null ? timeout : AbortSignal.any([signal, timeout]);

  const response = await fetch(buildUrl(path, query), {
    ...init,
    signal: requestSignal,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : raw,
  });

  let envelope: ApiResponse<unknown> | undefined;
  try {
    const answered: unknown = await response.json();
    if (isApiResponse(answered)) envelope = answered;
  } catch {
    // A gateway error, or a response that never reached the Worker at all.
  }

  if (!response.ok || envelope?.success !== true) {
    throw new ApiError(
      response.status,
      envelope?.msg ?? `Request failed (${response.status}).`,
      envelope?.problems,
    );
  }

  if (envelope.data === null) {
    throw new ApiError(response.status, envelope.msg || 'The server returned no data.');
  }

  return envelope.data as T;
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.success === 'boolean' &&
    Object.hasOwn(record, 'data') &&
    typeof record.code === 'number' &&
    typeof record.msg === 'string' &&
    (record.problems === undefined || Array.isArray(record.problems))
  );
}
