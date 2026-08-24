/**
 * HealPoint - HTTP client.
 *
 * A small typed wrapper around `fetch` that handles the API base URL, JSON
 * serialization, Bearer token injection, timeouts and normalized error
 * creation. Every service module goes through this so all requests share the
 * same behaviour.
 */
import { API_TIMEOUT_MS, API_URL, describeApiEndpoint, isApiUrlConfigured } from '@/lib/env';
import type { ApiErrorCategory } from '@/types';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
export class ApiClientError extends Error {
  status: number;
  category: ApiErrorCategory;
  code: string;
  serverMessage?: string;

  constructor(
    message: string,
    category: ApiErrorCategory,
    status = 0,
    serverMessage?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.category = category;
    this.status = status;
    this.serverMessage = serverMessage;
    this.code = category;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** Send request as multipart/form-data. `body` must be a FormData value. */
  isFormData?: boolean;
  auth?: boolean;
  timeout?: number;
}

type TokenProvider = () => string | null | undefined;

let tokenProvider: TokenProvider | null = null;

/** The auth context registers a token provider once at app startup. */
export function registerAuthTokenProvider(provider: TokenProvider) {
  tokenProvider = provider;
}

export function getAuthToken(): string | null | undefined {
  return tokenProvider ? tokenProvider() : null;
}

/** Safe, diagnostic-only description of the resolved backend base URL. */

function networkErrorMessage(cause: { name?: string; code?: string; message?: string }): {
  message: string;
  category: ApiErrorCategory;
} {
  const category: ApiErrorCategory = cause?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK';

  // Development-only technical diagnostics (never shown to normal users).
  if (__DEV__) {
    console.warn('[api] Request failed', {
      code: cause?.code,
      name: cause?.name,
      detail: cause?.message,
      endpoint: describeApiEndpoint(),
      configured: isApiUrlConfigured(),
    });
  }

  // Backend URL is still the placeholder -> the developer needs to run
  // `npm run detect:ip` (or set EXPO_PUBLIC_API_URL). Only mention that in dev.
  if (!isApiUrlConfigured()) {
    const hint = __DEV__
      ? ' The app does not know your laptop IP yet — run "npm run detect:ip" on the dev machine and restart Expo.'
      : '';
    return {
      message: `Unable to connect to HealPoint right now.${hint} Make sure the phone and computer are on the same Wi-Fi and the backend is running.`,
      category,
    };
  }

  // Timeout (AbortController fired first). This is a *reachability* problem,
  // not a credentials problem — never suggest the password was wrong here.
  if (cause?.name === 'AbortError') {
    return {
      message: 'HealPoint took too long to respond. Please try again.',
      category,
    };
  }

  // Connection refused / host not found / timeout — all boil down to the same
  // user-facing guidance. Technical details stay in the dev log above.
  if (
    cause?.code === 'ECONNREFUSED' ||
    /(refused|ECONNREFUSED)/i.test(cause?.message || '') ||
    cause?.code === 'ENOTFOUND' ||
    /(ENOTFOUND|ERR_NAME_NOT_RESOLVED)/i.test(cause?.message || '') ||
    cause?.code === 'ECONNABORTED' ||
    /(ECONNABORTED|ETIMEDOUT)/i.test(cause?.message || '')
  ) {
    return {
      message: `Can't connect to HealPoint right now. Make sure the phone and computer are on the same Wi-Fi network and that the backend server is running.`,
      category,
    };
  }

  // Anything else — generic network failure.
  return {
    message: `Can't connect to HealPoint right now. Please check your Wi-Fi connection and try again.`,
    category,
  };
}

function containsDuplicateKeyError(data: unknown, message: string): boolean {
  if (/(11000|duplicate key|E11000)/i.test(message)) return true;
  if (!data || typeof data !== 'object') return false;

  const error = (data as { error?: unknown }).error;
  if (typeof error === 'string') return /(11000|duplicate key|E11000)/i.test(error);
  if (!error || typeof error !== 'object') return false;

  const details = error as { code?: unknown; message?: unknown; errmsg?: unknown };
  return (
    details.code === 11000 ||
    details.code === '11000' ||
    (typeof details.message === 'string' && /(11000|duplicate key|E11000)/i.test(details.message)) ||
    (typeof details.errmsg === 'string' && /(11000|duplicate key|E11000)/i.test(details.errmsg))
  );
}

// ---------------------------------------------------------------------------
// Non-JSON / HTML response guard
// ---------------------------------------------------------------------------
// If the backend answers with an HTML page (Express "Cannot GET …" 404, a proxy
// or a reverse-proxy error page) instead of JSON, the app must NEVER surface
// that raw HTML. Detect it here and convert it to a clean, transient error so
// no screen can accidentally render a `<!DOCTYPE html>…` string from the API.
const HTML_SERVER_MARKERS = [
  '<!DOCTYPE',
  '</html>',
  '<pre>',
  '</pre>',
  '<h1>',
  'Cannot GET ',
  'Cannot POST ',
  'Cannot PATCH ',
  'Not Found',
  'ReverseProxy',
];

function isHtmlishServerBody(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return false;
  const upper = v.toUpperCase();
  if (v.startsWith('<') || /<\/?[a-z][\s>]/i.test(v)) return true;
  return HTML_SERVER_MARKERS.some((marker) => upper.includes(marker.toUpperCase()));
}

/** Drop any server-provided message that is actually an HTML page / proxy text. */
function sanitizeServerMessage(message: string | undefined): string | undefined {
  if (!message) return undefined;
  return isHtmlishServerBody(message) ? undefined : message;
}

function throwForStatus(status: number, message: string, data?: unknown): never {
  // Raw HTML / "Cannot GET" pages must never become the user-visible message.
  const serverMessage = sanitizeServerMessage(message) || undefined;

  // MongoDB duplicate-key error bubbling out of register. Most Mongo drivers hit
  // this before a proper HTTP status is set, so map it to a clear validation
  // message here instead of showing the generic server error.
  if (containsDuplicateKeyError(data, message)) {
    throw new ApiClientError(
      'An account with this email already exists. Please try logging in instead.',
      'VALIDATION',
      status,
    );
  }

  let category: ApiErrorCategory = 'UNKNOWN';

  if (status === 401) category = 'UNAUTHORIZED';
  else if (status === 403) category = 'FORBIDDEN';
  else if (status === 404) category = 'NOT_FOUND';
  else if (status === 422) category = 'VALIDATION';
  else if (status === 503) {
    // 503 is an intentional, actionable condition (e.g. Razorpay not
    // configured / temporarily down). The backend includes a meaningful message
    // ("Online payment is temporarily unavailable…"), so it must NOT be
    // swallowed by the generic 5xx handler.
    category = 'VALIDATION';
  } else if (status >= 400 && status < 500) category = 'VALIDATION';
  else if (status >= 500) category = 'SERVER';

  const fallback =
    status === 401
      ? 'Your session has expired. Please login again.'
      : status === 403
        ? 'You do not have permission to perform this action.'
        : status === 404
          ? 'The requested resource was not found.'
          : status >= 500
            ? 'Something went wrong on the server. Please try again later.'
            : 'Your request could not be processed. Please check your details.';

  throw new ApiClientError(fallback, category, status, serverMessage);
}

// ---------------------------------------------------------------------------
// Core request
// ---------------------------------------------------------------------------
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, isFormData = false, auth = false, timeout = API_TIMEOUT_MS } = options;

  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const isSignupRequest = method === 'POST' && path === '/user/register';

  if (__DEV__ && isSignupRequest) {
    console.log('SIGNUP REQUEST:', { method, endpoint: url });
  }

  const requestHeaders: Record<string, string> = { ...headers };

  if (isFormData) {
    // Let fetch set the multipart boundary; do not force Content-Type.
    delete requestHeaders['Content-Type'];
  } else if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = getAuthToken();
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      body:
        body === undefined
          ? undefined
          : isFormData
            ? (body as unknown as FormData)
            : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    const { message, category } = networkErrorMessage(
      (error as { name?: string; code?: string; message?: string }) || {},
    );
    if (__DEV__ && isSignupRequest) {
      console.warn('SIGNUP NETWORK ERROR:', { category, detail: (error as Error)?.message });
    }
    throw new ApiClientError(message, category, 0);
  } finally {
    clearTimeout(timer);
  }

  // 204 etc. — no content
  if (response.status === 204) {
    return undefined as T;
  }

  let data: unknown = null;
  const rawBody = await response.text();
  if (rawBody) {
    try {
      data = JSON.parse(rawBody) as unknown;
    } catch {
      data = rawBody;
    }
  }

  if (__DEV__ && isSignupRequest) {
    console.log('SIGNUP RESPONSE:', { status: response.status, body: redactForLog(data) });
  }

  // If the backend returned an HTML page (missing/old route, proxy error) even
  // when the status line looked OK, this is NOT a valid HealPoint API payload.
  // Convert it into a clean transient error instead of letting the raw HTML
  // string leak into a screen. The technical detail is only logged in dev.
  if (typeof data === 'string' && isHtmlishServerBody(data)) {
    if (__DEV__) {
      console.warn('[api] Backend answered with an HTML page instead of JSON.', {
        status: response.status,
        endpoint: url,
      });
    }
    throw new ApiClientError(
      'The service is temporarily unavailable. Please try again later.',
      response.status === 404 ? 'NOT_FOUND' : 'SERVER',
      response.status,
    );
  }

  if (!response.ok) {
    throwForStatus(response.status, extractServerMessage(data), data);
  }

  return data as T;
}

/** Keep development diagnostics useful without logging credentials or tokens. */
function redactForLog(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redactForLog);

  const redacted: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (/(password|token|secret|authorization|api[-_]?key)/i.test(key)) {
      redacted[key] = '[redacted]';
    } else {
      redacted[key] = redactForLog(nested);
    }
  }
  return redacted;
}

function extractServerMessage(data: unknown): string {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return '';

  const response = data as { message?: unknown; error?: unknown };
  if (typeof response.message === 'string') return response.message;
  if (typeof response.error === 'string') return response.error;
  if (response.error && typeof response.error === 'object') {
    const error = response.error as { message?: unknown; errmsg?: unknown };
    if (typeof error.message === 'string') return error.message;
    if (typeof error.errmsg === 'string') return error.errmsg;
  }
  return '';
}

export const api = {
  get<T>(path: string, options?: RequestOptions) {
    return request<T>(path, { ...options, method: 'GET' });
  },
  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>(path, { ...options, method: 'POST', body });
  },
  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>(path, { ...options, method: 'PATCH', body });
  },
  put<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>(path, { ...options, method: 'PUT', body });
  },
  delete<T>(path: string, options?: RequestOptions) {
    return request<T>(path, { ...options, method: 'DELETE' });
  },
};

/**
 * Extract a human friendly message from any thrown error.
 *
 * Categories are mapped to the message the prompt/user actually needs to see:
 *   NETWORK      → "Can't connect to HealPoint right now…"
 *   UNAUTHORIZED → "Your session has expired…"
 *   SERVER       → "HealPoint server is temporarily unavailable…"
 *   VALIDATION   → the server's message (e.g. "Invalid credentials")
 * Raw technical details are never shown to users; devs can read them in the
 * console (see `networkErrorMessage`).
 */
export function toErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiClientError) {
    // Never surface a raw MongoDB duplicate-key error — convert it to the same
    // friendly message the register screen expects.
    const serverMessage = error.serverMessage || '';
    if (/(11000|duplicate key|E11000)/i.test(serverMessage)) {
      return 'An account with this email already exists. Please try logging in instead.';
    }

    switch (error.category) {
      case 'NETWORK':
      case 'TIMEOUT':
        return error.message || "Can't connect to HealPoint right now. Please check your Wi-Fi connection and try again.";
      case 'UNAUTHORIZED':
        return 'Your session has expired. Please login again.';
      case 'FORBIDDEN':
        return 'You do not have permission to perform this action.';
      case 'SERVER':
        // Only fall back to the generic message when the backend did not send a
        // concrete explanation. A known server error (doctor not found, slot
        // taken, Razorpay unavailable, …) is always more useful than the
        // generic "server temporarily unavailable" placeholder.
        return serverMessage || 'HealPoint server is temporarily unavailable. Please try again later.';
      case 'VALIDATION':
      case 'NOT_FOUND':
        return serverMessage || error.message || fallback;
      default:
        return serverMessage || error.message || fallback;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

/** Health probe used by the development connection diagnostic. */
export interface HealthCheckResult {
  ok: boolean;
  message: string;
}

export async function checkServerHealth(): Promise<HealthCheckResult> {
  if (!isApiUrlConfigured()) {
    return {
      ok: false,
      message: 'Backend URL is not configured. Run "npm run detect:ip" on the dev machine and restart Expo.',
    };
  }
  try {
    const data = await request<{
      ok?: boolean;
      service?: string;
      server?: string;
      database?: string;
      environment?: string;
    }>('/health', {
      timeout: 6000,
    });
    const reachable = data?.ok === true || data?.server === 'ok';
    const database = data?.database === 'connected' ? 'Database connected.' : 'Database unavailable.';
    return {
      ok: reachable,
      message: data?.service ? `${data.service} is reachable. ${database}` : `Backend is reachable. ${database}`,
    };
  } catch (error) {
    return { ok: false, message: toErrorMessage(error, 'Backend is not reachable.') };
  }
}
