import {
  HttpError,
  setTransportMiddlewares,
  type TransportMiddleware
} from '@oig/react-query-generator/core';

import {
  ensureFreshAccessToken,
  getAuthHeader,
  handleUnauthorized,
  refreshIamSession
} from './iam/session';
import { HTTP_STATUS_UNAUTHORIZED } from '../http-status';

function isIamAuthEndpoint(url: string): boolean {
  return /\/api\/iam\/auth\/(?:login|refresh|logout|password\/change)(?:[?#]|$)/.test(url);
}

function withAuthHeader(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const authHeader = getAuthHeader();
  if (authHeader) {
    headers.set('Authorization', authHeader);
  }
  return headers;
}

const authMiddleware: TransportMiddleware = async (context, next) => {
  if (!isIamAuthEndpoint(context.url)) {
    await ensureFreshAccessToken();
  }

  return next({
    ...context,
    options: {
      ...context.options,
      headers: withAuthHeader(context.options.headers)
    }
  });
};

const refreshMiddleware: TransportMiddleware = async (context, next) => {
  try {
    return await next(context);
  } catch (error) {
    if (
      error instanceof HttpError &&
      error.status === HTTP_STATUS_UNAUTHORIZED &&
      !isIamAuthEndpoint(context.url)
    ) {
      try {
        await refreshIamSession();
        return await next({
          ...context,
          options: {
            ...context.options,
            headers: withAuthHeader(context.options.headers)
          }
        });
      } catch (refreshError) {
        handleUnauthorized();
        throw refreshError;
      }
    } else if (error instanceof HttpError && error.status === HTTP_STATUS_UNAUTHORIZED) {
      handleUnauthorized();
    }
    throw error;
  }
};

export function configureApiTransport() {
  setTransportMiddlewares([authMiddleware, refreshMiddleware]);
}
