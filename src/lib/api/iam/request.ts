import { BizError, DecodeError, HttpError, TimeoutError } from '@oig/react-query-generator/core';
import type { ApiEnvelope } from './types';

const IAM_API_PREFIX = '/api/iam';
const SUCCESS_CODE = 200;
const DEFAULT_TIMEOUT_MS = 30_000;

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type');
  return contentType?.includes('application/json') || contentType?.includes('+json') || false;
}

async function parseBody(response: Response, request: { method: string; url: string }) {
  const text = await response.text();
  if (!text) return undefined;

  if (!isJsonResponse(response)) {
    return text;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new DecodeError('Failed to decode JSON response body.', request, {
      cause: error,
      responseText: text
    });
  }
}

function getBodyMessage(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined;
  const msg = (body as { msg?: unknown; message?: unknown }).msg;
  if (typeof msg === 'string' && msg.trim()) return msg;
  const message = (body as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : undefined;
}

function getBodyCode(body: unknown): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined;
  return (body as { code?: unknown }).code;
}

function resolveIamUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (normalizedPath.startsWith(IAM_API_PREFIX)) return normalizedPath;
  return `${IAM_API_PREFIX}${normalizedPath}`;
}

export async function iamRequest<TData>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<TData> {
  const url = resolveIamUrl(path);
  const method = (options.method ?? 'POST').toUpperCase();
  const request = { method, url };
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error('Request timed out.'));
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type') && options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      method,
      headers,
      signal: options.signal
        ? AbortSignal.any([options.signal, controller.signal])
        : controller.signal
    });
    const body = await parseBody(response, request);

    if (!response.ok) {
      throw new HttpError(
        getBodyMessage(body) ?? `HTTP ${response.status} ${response.statusText}`.trim(),
        request,
        response.status,
        response.statusText,
        response.headers,
        body
      );
    }

    const envelope = body as ApiEnvelope<TData>;
    if (envelope?.code !== SUCCESS_CODE) {
      throw new BizError(
        getBodyMessage(body) ?? 'Business request failed.',
        request,
        getBodyCode(body),
        body
      );
    }

    return envelope.data;
  } catch (error) {
    if (error instanceof HttpError || error instanceof BizError || error instanceof DecodeError) {
      throw error;
    }
    if ((error as { name?: string })?.name === 'AbortError') {
      throw new TimeoutError('Request timed out.', request, error);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
