import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

import { listGlobalTypesQueryOptions } from './generated/queries';
import type { ListGlobalTypesRequest } from './generated/sdk';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('dict generated queries', () => {
  it('returns the unwrapped data payload through TanStack Query options', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 200,
            msg: 'ok',
            data: {
              list: [{ id: 1, dictTypeCode: 'A', dictTypeName: 'Alpha' }],
              total: 1
            }
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        )
      )
    );

    const queryClient = new QueryClient();
    const result = await queryClient.fetchQuery(
      listGlobalTypesQueryOptions({
        pageNo: 1,
        pageSize: 20
      } as ListGlobalTypesRequest)
    );

    expect(result).toEqual({
      list: [{ id: 1, dictTypeCode: 'A', dictTypeName: 'Alpha' }],
      total: 1
    });
  });
});
