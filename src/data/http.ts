/** The only place that calls `fetch`. JSON GET with an AbortController timeout (SPEC §6). */
export const FETCH_TIMEOUT_MS = 8000;

/** Minimal fetch signature so tests can pass plain mocks; the real `fetch` satisfies it. */
export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

export type FetchErrorKind = 'timeout' | 'http' | 'network' | 'shape';

export class FetchError extends Error {
  readonly kind: FetchErrorKind;
  readonly url: string;

  constructor(kind: FetchErrorKind, url: string, message: string) {
    super(message);
    this.name = 'FetchError';
    this.kind = kind;
    this.url = url;
  }
}

/** Calls the global fetch as a plain function (never as a method, which would break `this`). */
export const defaultFetch: FetchLike = (url, init) => fetch(url, init);

export async function fetchJson<T = unknown>(
  url: string,
  {
    timeoutMs = FETCH_TIMEOUT_MS,
    fetchImpl = defaultFetch,
  }: { timeoutMs?: number; fetchImpl?: FetchLike } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeoutError = () => new FetchError('timeout', url, `Timed out after ${timeoutMs} ms`);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Reject first so the race settles as a timeout, then abort the request.
      reject(timeoutError());
      controller.abort();
    }, timeoutMs);
  });

  try {
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await Promise.race([fetchImpl(url, { signal: controller.signal }), timeout]);
    } catch (err) {
      if (err instanceof FetchError) throw err;
      if (controller.signal.aborted) throw timeoutError();
      throw new FetchError('network', url, errorMessage(err) || 'Network error');
    }
    if (!response.ok) throw new FetchError('http', url, `HTTP ${response.status}`);
    try {
      return (await Promise.race([response.json(), timeout])) as T;
    } catch (err) {
      if (err instanceof FetchError) throw err;
      throw new FetchError('shape', url, 'Invalid JSON');
    }
  } finally {
    clearTimeout(timer);
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export const errorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { message?: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  return String(err);
};
