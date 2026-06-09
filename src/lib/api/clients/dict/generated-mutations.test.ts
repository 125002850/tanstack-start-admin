import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

import { setQueryClient } from '@/lib/query-client';

import { createGlobalTypeMutationOptions } from './generated/mutations';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('dict generated mutations', () => {
  it('imports the query client accessor from manifest configuration', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/lib/api/clients/dict/generated/mutations.ts'),
      'utf8'
    );

    expect(source).toContain("import { getQueryClient } from '@/lib/query-client';");
  });

  it('invalidates the list prefix declared by the manifest', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined as never);

    setQueryClient(queryClient);

    const options = createGlobalTypeMutationOptions();
    await options.onSuccess?.(
      {} as never,
      { dictTypeCode: 'A' } as never,
      undefined as never,
      undefined as never
    );

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['dict', 'global-types', 'list'],
      exact: false
    });
  });
});
