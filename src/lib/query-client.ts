import { QueryClient } from '@tanstack/react-query';
import { setQueryClient as setCoreQueryClient } from '@oig/react-query-generator/core';

// Singleton query client for use in mutation options and other non-component code.
// In TanStack Start, the primary queryClient lives in the router context,
// but mutations defined outside components need a reference too.
let queryClient: QueryClient | undefined;

export function getQueryClient() {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          // oxlint-disable-next-line typescript/no-explicit-any
          retry(failureCount, error: any) {
            if (error?.response?.status === 404 || error?.status === 404) {
              return false;
            }

            return failureCount < 3;
          }
        }
      }
    });
    setCoreQueryClient(queryClient);
  }
  return queryClient;
}

export function setQueryClient(client: QueryClient) {
  queryClient = client;
  setCoreQueryClient(client);
}
