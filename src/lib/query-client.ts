import { QueryCache, QueryClient, MutationCache } from '@tanstack/react-query';
import {
  BizError,
  HttpError,
  NetworkError,
  TimeoutError,
  setQueryClient as setCoreQueryClient
} from '@oig/react-query-generator/core';
import { toast } from 'sonner';

import {
  HTTP_STATUS_BAD_GATEWAY,
  HTTP_STATUS_GATEWAY_TIMEOUT,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_REQUEST_TIMEOUT,
  HTTP_STATUS_SERVICE_UNAVAILABLE,
  HTTP_STATUS_TOO_EARLY,
  HTTP_STATUS_TOO_MANY_REQUESTS
} from './http-status';

import { isApiRequestAbort, normalizeApiError } from './api/error-normalizer';

export const SILENT_QUERY_META = { suppressGlobalErrorToast: true } as const;

let queryClient: QueryClient | undefined;

const RETRYABLE_HTTP_STATUS = new Set([
  HTTP_STATUS_REQUEST_TIMEOUT,
  HTTP_STATUS_TOO_EARLY,
  HTTP_STATUS_TOO_MANY_REQUESTS,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_BAD_GATEWAY,
  HTTP_STATUS_SERVICE_UNAVAILABLE,
  HTTP_STATUS_GATEWAY_TIMEOUT
]);
const MAX_QUERY_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30_000;
const NON_RETRYABLE_BUSINESS_CODES = new Set([HTTP_STATUS_NOT_FOUND]);
const DEFAULT_STALE_TIME_SECONDS = 60;
const MILLISECONDS_PER_SECOND = 1000;
const DEFAULT_QUERY_STALE_TIME_MS = DEFAULT_STALE_TIME_SECONDS * MILLISECONDS_PER_SECOND;

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const statusError = error as {
    status?: unknown;
    response?: { status?: unknown };
  };
  const status = statusError.response?.status ?? statusError.status;

  return typeof status === 'number' ? status : undefined;
}

function getErrorCauseBody(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) return undefined;

  return (error as { causeBody?: unknown }).causeBody;
}

function getBusinessCodeFromBody(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined;

  const code = (body as { code?: unknown }).code;
  if (typeof code === 'number' && Number.isFinite(code)) return code;
  if (typeof code === 'string' && code.trim().length > 0) {
    const parsed = Number(code);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function hasNonRetryableBusinessCode(error: unknown): boolean {
  const code = getBusinessCodeFromBody(getErrorCauseBody(error));
  return code !== undefined && NON_RETRYABLE_BUSINESS_CODES.has(code);
}

function isRetryableError(error: unknown): boolean {
  if (isApiRequestAbort(error)) return false;
  if (hasNonRetryableBusinessCode(error)) {
    return false;
  }

  if (error instanceof HttpError) {
    return RETRYABLE_HTTP_STATUS.has(error.status);
  }
  if (error instanceof BizError) {
    return false;
  }
  if (error instanceof NetworkError || error instanceof TimeoutError) {
    return true;
  }

  const status = getErrorStatus(error);
  if (status !== undefined) {
    return RETRYABLE_HTTP_STATUS.has(status);
  }

  return true;
}

function getRetryAfterDelay(error: unknown): number | undefined {
  if (!(error instanceof HttpError)) return undefined;

  const retryAfter = error.headers.get('retry-after')?.trim();
  if (!retryAfter) return undefined;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * MILLISECONDS_PER_SECOND;
  }

  const retryAt = Date.parse(retryAfter);
  if (!Number.isNaN(retryAt)) {
    return Math.max(0, retryAt - Date.now());
  }

  return undefined;
}

function getQueryRetryDelay(attemptIndex: number, error: unknown): number {
  return (
    getRetryAfterDelay(error) ??
    Math.min(BASE_RETRY_DELAY_MS * 2 ** attemptIndex, MAX_RETRY_DELAY_MS)
  );
}

function showErrorToast(error: unknown) {
  if (isApiRequestAbort(error)) return;
  toast.error(normalizeApiError(error).message);
}

export function getQueryClient() {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: DEFAULT_QUERY_STALE_TIME_MS,
          retry(failureCount, error) {
            if (!isRetryableError(error)) return false;
            return failureCount < MAX_QUERY_RETRIES;
          },
          retryDelay: getQueryRetryDelay
        },
        mutations: {
          // Mutations may be non-idempotent; retry must be enabled per operation.
          retry: false
        }
      },
      queryCache: new QueryCache({
        onError: (error, query) => {
          if (query.meta?.suppressGlobalErrorToast === true) return;
          showErrorToast(error);
        }
      }),
      mutationCache: new MutationCache({
        onError: (error, _variables, _context, mutation) => {
          if (mutation.options.onError) return;
          showErrorToast(error);
        }
      })
    });
    setCoreQueryClient(queryClient);
  }
  return queryClient;
}
