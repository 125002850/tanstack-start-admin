import * as React from 'react';
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DataTableDslPageRequestBase, QueryOptionsFactory } from './dsl';
import { useDslDataTable } from './use-dsl-data-table';

type Row = { id: number; name: string; amount: number };

const columns: Array<ColumnDef<Row>> = [
  {
    accessorKey: 'name',
    enableColumnFilter: true,
    meta: {
      label: '名称',
      variant: 'text'
    }
  },
  {
    accessorKey: 'amount',
    meta: {
      label: '金额'
    }
  }
];

const metadata = {
  'test.scene.page': {
    fields: {
      name: { label: '名称', conditionType: 'text', operators: ['CONTAINS'], valueLabels: {} },
      amount: { label: '金额', conditionType: 'number', operators: ['BETWEEN'], valueLabels: {} }
    },
    limits: { maxDepth: 4, maxNodes: 20, maxInSize: 1000, maxComplexityScore: 100 }
  }
};
let loadMetadata: () => Promise<unknown>;

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  });
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useDslDataTable query scheme hydration', () => {
  beforeEach(() => {
    loadMetadata = async () => metadata;
    localStorage.clear();
    localStorage.setItem('app-data-table-per-page:scheme-table', '20');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/query-scene/metadata')) {
          return new Response(JSON.stringify({ code: 200, data: await loadMetadata() }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          });
        }
        return new Response(
          JSON.stringify({
            code: 200,
            msg: 'ok',
            data: [
              {
                id: 9,
                sceneCode: 'test.scene.page',
                schemeName: '默认方案',
                contentJson: JSON.stringify({
                  schemaVersion: 1,
                  quickConditions: [
                    {
                      columnId: 'name',
                      condition: {
                        nodeType: 'text',
                        field: 'name',
                        op: 'CONTAINS',
                        value: '海运'
                      }
                    }
                  ],
                  advancedCondition: {
                    nodeType: 'number',
                    field: 'amount',
                    op: 'BETWEEN',
                    start: 100,
                    end: 500
                  }
                }),
                schemaVersion: 1,
                defaultScheme: true,
                version: 0
              }
            ]
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('restores the default scheme before issuing the first business request', async () => {
    const builtRequests: DataTableDslPageRequestBase[] = [];
    const executedRequests: DataTableDslPageRequestBase[] = [];
    const queryFactory = vi.fn((request: DataTableDslPageRequestBase) => {
      builtRequests.push(request);
      return queryOptions({
        queryKey: ['scheme-business-list', request],
        queryFn: async () => {
          executedRequests.push(request);
          return { list: [], total: 0 };
        }
      });
    }) as unknown as QueryOptionsFactory<Row>;

    const { result } = renderHook(
      () =>
        useDslDataTable({
          tableId: 'scheme-table',
          sceneCode: 'test.scene.page',
          columns,
          queryOptions: queryFactory
        }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.queryState.isFetching).toBe(false));

    expect(builtRequests).toHaveLength(2);
    expect(executedRequests).toHaveLength(1);
    expect(executedRequests[0]?.condition).toEqual({
      nodeType: 'compose',
      logic: 'AND',
      children: [
        { nodeType: 'text', field: 'name', op: 'CONTAINS', value: '海运' },
        { nodeType: 'number', field: 'amount', op: 'BETWEEN', start: 100, end: 500 }
      ]
    });
    expect(result.current.table.options.meta?.dataTableAdvancedSearch?.selectedSchemeId).toBe(9);
    expect(result.current.table.options.meta?.dataTableAdvancedSearch?.dirty).toBe(false);
  });
  it('waits for delayed metadata before restoring the default scheme', async () => {
    let resolveMetadata!: (value: unknown) => void;
    loadMetadata = () =>
      new Promise((resolve) => {
        resolveMetadata = resolve;
      });
    const execute = vi.fn(async (_request: DataTableDslPageRequestBase) => ({
      list: [],
      total: 0
    }));
    const { result } = renderHook(
      () =>
        useDslDataTable({
          tableId: 'scheme-table',
          sceneCode: 'test.scene.page',
          columns,
          queryOptions: (request) =>
            queryOptions({
              queryKey: ['delayed-metadata', request],
              queryFn: () => execute(request)
            })
        }),
      { wrapper: wrapper() }
    );
    await waitFor(() => expect(resolveMetadata).toBeDefined());
    expect(execute).not.toHaveBeenCalled();
    await act(async () => {
      resolveMetadata(metadata);
    });
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(result.current.table.options.meta?.dataTableAdvancedSearch?.selectedSchemeId).toBe(9);
    expect(execute.mock.calls[0]?.[0].condition).toMatchObject({ nodeType: 'compose' });
  });

  it('exposes a recoverable metadata error without issuing an unfiltered business request', async () => {
    loadMetadata = async () => {
      throw new Error('metadata unavailable');
    };
    const execute = vi.fn(async () => ({ list: [], total: 0 }));
    const { result } = renderHook(
      () =>
        useDslDataTable({
          tableId: 'scheme-table',
          sceneCode: 'test.scene.page',
          columns,
          queryOptions: (request) =>
            queryOptions({ queryKey: ['metadata-failure', request], queryFn: execute })
        }),
      { wrapper: wrapper() }
    );
    await waitFor(() => expect(result.current.queryState.isError).toBe(true));
    expect(result.current.queryState.isFetching).toBe(false);
    expect(execute).not.toHaveBeenCalled();
    loadMetadata = async () => metadata;
    await act(async () => {
      await result.current.queryState.refetch();
    });
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(result.current.queryState.isError).toBe(false);
    expect(result.current.table.options.meta?.dataTableAdvancedSearch?.selectedSchemeId).toBe(9);
  });
});
