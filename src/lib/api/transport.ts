import {
  HttpError,
  setTransportMiddlewares,
  type TransportMiddleware
} from '@oig/react-query-generator/core';

import { handleUnauthorized } from './sso/session';
import { createAuthHeaders, refreshTokenFromResponse } from './sso/set-headers';
import { HTTP_STATUS_UNAUTHORIZED } from '../http-status';

const authHeadersMiddleware: TransportMiddleware = async (context, next) => {
  return next({
    ...context,
    options: {
      ...context.options,
      headers: createAuthHeaders(context.options.headers)
    }
  });
};

const sessionMiddleware: TransportMiddleware = async (context, next) => {
  try {
    const response = await next(context);
    refreshTokenFromResponse(response);
    return response;
  } catch (error) {
    if (error instanceof HttpError && error.status === HTTP_STATUS_UNAUTHORIZED) {
      handleUnauthorized();
    }
    throw error;
  }
};

export function configureApiTransport() {
  setTransportMiddlewares([authHeadersMiddleware, sessionMiddleware]);
}
