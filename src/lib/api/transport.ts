import {
  createApiClientCustomInstanceFactory,
  createTransport,
  HttpError
} from '@oig/react-query-generator/core';

import { handleUnauthorized } from './sso/session';
import { createAuthHeaders, refreshTokenFromResponse } from './sso/set-headers';

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
    if (error instanceof HttpError && error.status === 401) {
      handleUnauthorized();
    }
    throw error;
  }
});

export const createApiClientCustomInstance = createApiClientCustomInstanceFactory(transport);
