import type { TransportInstance } from '@oig/react-query-generator/core';

import { apiRequestMiddleware, apiResponseMiddleware } from './middlewares';

const API_CLIENT_MIDDLEWARES = [apiRequestMiddleware, apiResponseMiddleware] as const;

export function registerApiClientMiddlewares(transport: TransportInstance) {
  transport.setMiddlewares(API_CLIENT_MIDDLEWARES);
}
