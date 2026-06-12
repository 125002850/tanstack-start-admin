import {
  createApiClientCustomInstanceFactory,
  createTransport,
  HttpError
} from '@oig/react-query-generator/core';

import { setHeader } from './sso/set-headers';
import { getAuthHeader, setAuthHeader, handleUnauthorized } from './sso/session';

function extractAuthHeader(response: unknown): string | null {
  const headers = (response as Record<string, unknown>)?.headers;
  if (!headers) return null;

  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get('authorization');
  }

  const obj = headers as Record<string, string>;
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === 'authorization') {
      return obj[key];
    }
  }
  return null;
}

const transport = createTransport({ defaultCredentials: 'same-origin' });

transport.registerMiddleware(async (context, next) => {
  const headers = setHeader(context.options.headers);
  const token = getAuthHeader();
  if (token) {
    headers.set('Authorization', token);
  }
  return next({
    ...context,
    options: {
      ...context.options,
      headers
    }
  });
});

transport.registerMiddleware(async (context, next) => {
  try {
    const response = await next(context);

    const newToken = extractAuthHeader(response);
    if (newToken) {
      setAuthHeader(newToken);
    }

    return response;
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      handleUnauthorized();
    }
    throw error;
  }
});

export const createApiClientCustomInstance = createApiClientCustomInstanceFactory(transport);
