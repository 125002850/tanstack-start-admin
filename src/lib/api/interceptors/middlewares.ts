import type {
  TransportMiddleware,
  TransportRequestContext,
  TransportResult
} from '@oig/react-query-generator/core';

import { setHeader } from './set-header';

export const apiRequestMiddleware: TransportMiddleware = async (context, next) => {
  return next({
    ...context,
    options: {
      ...context.options,
      headers: setHeader(context.options.headers)
    }
  });
};

function handleResponseHeaders(_context: TransportRequestContext, result: TransportResult<unknown>) {
  void result.headers;
  return result;
}

export const apiResponseMiddleware: TransportMiddleware = async (context, next) => {
  const result = await next(context);
  return handleResponseHeaders(context, result);
};
