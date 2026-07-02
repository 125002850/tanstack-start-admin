// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

type RetryError = Error & {
  response?: { status?: number };
  status?: number;
};

const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock
  }
}));

async function loadQueryClientModule() {
  vi.resetModules();

  const [{ getQueryClient }, { BizError, HttpError, NetworkError, TimeoutError }] =
    await Promise.all([import('./query-client'), import('@oig/react-query-generator/core')]);

  return { getQueryClient, BizError, HttpError, NetworkError, TimeoutError };
}

async function loadRetryStrategy() {
  const queryClientModule = await loadQueryClientModule();
  const queryOptions = queryClientModule.getQueryClient().getDefaultOptions().queries;
  const retry = queryOptions?.retry;
  const retryDelay = queryOptions?.retryDelay;

  if (typeof retry !== 'function') {
    throw new Error('Expected query retry strategy to be configured.');
  }
  if (typeof retryDelay !== 'function') {
    throw new Error('Expected query retry delay to be configured.');
  }

  return { ...queryClientModule, retry, retryDelay };
}

function createRetryError(status: number, source: 'status' | 'response' = 'status'): RetryError {
  const error = new Error('request failed') as RetryError;

  if (source === 'response') {
    error.response = { status };
  } else {
    error.status = status;
  }

  return error;
}

function createBizError(
  BizError: new (
    message: string,
    request: { method: string; url: string },
    code: unknown,
    causeBody?: unknown
  ) => Error,
  message: string,
  code: unknown = 500
) {
  return new BizError('request failed', { method: 'GET', url: '/test' }, code, { message });
}

function createHttpError(
  HttpError: new (
    message: string,
    request: { method: string; url: string },
    status: number,
    statusText: string,
    headers: Headers,
    causeBody?: unknown
  ) => Error,
  status: number,
  causeBody: unknown = { message: 'request failed' },
  headers = new Headers()
) {
  return new HttpError(
    'request failed',
    { method: 'GET', url: '/test' },
    status,
    `HTTP ${status}`,
    headers,
    causeBody
  );
}

beforeEach(() => {
  toastErrorMock.mockReset();
});

describe('query client retry strategy', () => {
  it('does not retry business errors regardless of business code', async () => {
    const { BizError, retry } = await loadRetryStrategy();

    expect(retry(0, createBizError(BizError, 'bad request', 400))).toBe(false);
    expect(retry(0, createBizError(BizError, 'server rejected request', 500))).toBe(false);
  });

  it('retries only transient HTTP statuses up to three times', async () => {
    const { HttpError, retry } = await loadRetryStrategy();

    for (const status of [408, 425, 429, 500, 502, 503, 504]) {
      expect(retry(0, createHttpError(HttpError, status))).toBe(true);
    }

    for (const status of [400, 401, 403, 404, 409, 422, 501]) {
      expect(retry(0, createHttpError(HttpError, status))).toBe(false);
    }

    expect(retry(2, createHttpError(HttpError, 503))).toBe(true);
    expect(retry(3, createHttpError(HttpError, 503))).toBe(false);
  });

  it('does not retry an HTTP error when the response body contains non-retryable business code 404', async () => {
    const { HttpError, retry } = await loadRetryStrategy();

    expect(
      retry(
        0,
        createHttpError(HttpError, 503, {
          code: 404,
          message: 'url转发规则为空',
          success: false
        })
      )
    ).toBe(false);
  });

  it('applies the HTTP status policy to compatible non-library errors', async () => {
    const { retry } = await loadRetryStrategy();

    expect(retry(0, createRetryError(503))).toBe(true);
    expect(retry(0, createRetryError(429, 'response'))).toBe(true);
    expect(retry(0, createRetryError(422))).toBe(false);
    expect(retry(0, createRetryError(404, 'response'))).toBe(false);
  });

  it('retries network and timeout errors', async () => {
    const { NetworkError, TimeoutError, retry } = await loadRetryStrategy();
    const request = { method: 'GET', url: '/test' };

    expect(retry(0, new NetworkError('network failed', request))).toBe(true);
    expect(retry(0, new TimeoutError('request timed out', request))).toBe(true);
  });

  it('honors Retry-After and otherwise uses capped exponential backoff', async () => {
    const { HttpError, retryDelay } = await loadRetryStrategy();
    const retryAfterHeaders = new Headers({ 'Retry-After': '2' });

    expect(retryDelay(0, createHttpError(HttpError, 429, undefined, retryAfterHeaders))).toBe(2000);
    expect(retryDelay(0, new Error('request failed'))).toBe(1000);
    expect(retryDelay(3, new Error('request failed'))).toBe(8000);
    expect(retryDelay(10, new Error('request failed'))).toBe(30_000);
  });

  it('does not retry a business error and shows one query toast', async () => {
    const { BizError, getQueryClient } = await loadQueryClientModule();
    const queryFn = vi.fn(async () => {
      throw createBizError(BizError, 'query toast');
    });

    await expect(
      getQueryClient().fetchQuery({
        queryKey: ['query-toast'],
        queryFn,
        retryDelay: 0
      })
    ).rejects.toThrow('request failed');

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).toHaveBeenCalledWith('query toast');
  });

  it('retries a transient HTTP query and shows one toast after exhaustion', async () => {
    const { HttpError, getQueryClient } = await loadQueryClientModule();
    const queryFn = vi.fn(async () => {
      throw createHttpError(HttpError, 503, { message: 'service unavailable' });
    });

    await expect(
      getQueryClient().fetchQuery({
        queryKey: ['http-query-toast'],
        queryFn,
        retryDelay: 0
      })
    ).rejects.toThrow('request failed');

    expect(queryFn).toHaveBeenCalledTimes(4);
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).toHaveBeenCalledWith('service unavailable');
  });

  it('shows one toast without retrying an HTTP query rejected by business code 404', async () => {
    const { HttpError, getQueryClient } = await loadQueryClientModule();
    const queryFn = vi.fn(async () => {
      throw createHttpError(HttpError, 503, {
        code: 404,
        message: 'url转发规则为空',
        success: false
      });
    });

    await expect(
      getQueryClient().fetchQuery({
        queryKey: ['business-code-404-query-toast'],
        queryFn,
        retryDelay: 0
      })
    ).rejects.toThrow('request failed');

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).toHaveBeenCalledWith('url转发规则为空');
  });

  it('does not retry mutations by default', async () => {
    const { BizError, getQueryClient } = await loadQueryClientModule();
    const mutationFn = vi.fn(async () => {
      throw createBizError(BizError, 'mutation toast');
    });
    const queryClient = getQueryClient();
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: ['mutation-default'],
      mutationFn,
      retryDelay: 0
    });

    await expect(mutation.execute(undefined)).rejects.toThrow('request failed');

    expect(mutationFn).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).toHaveBeenCalledWith('mutation toast');
  });

  it('lets a local mutation onError own error notification', async () => {
    const { BizError, getQueryClient } = await loadQueryClientModule();
    const localOnError = vi.fn();
    const mutationFn = vi.fn(async () => {
      throw createBizError(BizError, 'locally handled mutation');
    });
    const queryClient = getQueryClient();
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: ['local-mutation-error'],
      mutationFn,
      onError: localOnError
    });

    await expect(mutation.execute(undefined)).rejects.toThrow('request failed');

    expect(localOnError).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('shows business msg for a globally handled mutation error', async () => {
    const { BizError, getQueryClient } = await loadQueryClientModule();
    const mutationFn = vi.fn(async () => {
      throw new BizError('mutation biz msg', { method: 'POST', url: '/test' }, 500, {
        msg: 'mutation biz msg'
      });
    });
    const queryClient = getQueryClient();
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: ['mutation-biz-msg'],
      mutationFn,
      retryDelay: 0
    });

    await expect(mutation.execute(undefined)).rejects.toThrow('mutation biz msg');

    expect(mutationFn).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).toHaveBeenCalledWith('mutation biz msg');
  });
});
