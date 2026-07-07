import {
  createApiClientCustomInstanceFactory,
  createTransport,
  HttpError
} from '@oig/react-query-generator/core';

import { handleUnauthorized } from './sso/session';
import { createAuthHeaders, refreshTokenFromResponse } from './sso/set-headers';
import { HTTP_STATUS_UNAUTHORIZED } from '../http-status';

const transport = createTransport({ defaultCredentials: 'same-origin' });

transport.registerMiddleware(async (context, next) => {
  return next({
    ...context,
    options: {
      ...context.options,
      headers: createAuthHeaders(context.options.headers)
    }
  });
});

transport.registerMiddleware(async (context, next) => {
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
});

export const createApiClientCustomInstance = createApiClientCustomInstanceFactory(transport);
