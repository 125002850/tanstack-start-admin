import {
  createApiClientCustomInstanceFactory,
  createTransport
} from '@oig/react-query-generator/core';

import { setHeader } from './sso/set-headers';

const transport = createTransport({ defaultCredentials: 'same-origin' });

transport.registerMiddleware(async (context, next) => {
  return next({
    ...context,
    options: {
      ...context.options,
      headers: setHeader(context.options.headers)
    }
  });
});

export const createApiClientCustomInstance = createApiClientCustomInstanceFactory(transport);
