import { QueryClient } from '@tanstack/react-query';
import { setQueryClient as setCoreQueryClient } from '@oig/react-query-generator/core';

// Singleton query client for use in mutation options and other non-component code.
// In TanStack Start, the primary queryClient lives in the router context,
// but mutations defined outside components need a reference too.
let queryClient: QueryClient | undefined;
const nonRetryableStatusCodes = [401, 404];

export function getQueryClient() {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          // oxlint-disable-next-line typescript/no-explicit-any
          retry(failureCount, error: any) {
            const status = error?.response?.status ?? error?.status;

            if (nonRetryableStatusCodes.includes(status)) {
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
