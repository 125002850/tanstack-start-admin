import {
  createTransport,
  type InferTransportResult,
  type TransportOptions
} from '@oig/react-query-generator/core';

import { registerApiClientMiddlewares } from '../interceptors';

const sharedTransport = createTransport({ defaultCredentials: 'same-origin' });

registerApiClientMiddlewares(sharedTransport);

export function createApiClientCustomInstance(basePath: string) {
  return <T>(
    url: string,
    options: TransportOptions = {}
  ): Promise<InferTransportResult<T>> => {
    const normalizedBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
    const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
    const prefixedUrl =
      normalizedUrl === normalizedBasePath ||
      normalizedUrl.startsWith(`${normalizedBasePath}/`) ||
      url.startsWith('http')
        ? url
        : `${normalizedBasePath}${normalizedUrl}`;

    return sharedTransport.customInstance<T>(prefixedUrl, {
      ...options,
      headers: options.headers
    });
  };
}
