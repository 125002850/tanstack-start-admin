import * as React from 'react';
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useDataTableQuery } from './use-data-table-query';
import type { QueryOptionsFactory } from './use-data-table-query.dsl';

type DictionaryTypeRow = {
  id: number;
  dictTypeCode: string;
  dictTypeName: string;
};

const columns: Array<ColumnDef<DictionaryTypeRow>> = [
  {
    accessorKey: 'dictTypeCode',
    header: '字典类型编码',
    enableColumnFilter: true,
    enableSorting: true,
    meta: { variant: 'text', label: '字典类型编码' }
  },
  {
    accessorKey: 'dictTypeName',
    header: '字典类型名称',
    enableColumnFilter: true,
    enableSorting: true,
    meta: { variant: 'text', label: '字典类型名称' }
  }
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0
      }
    }
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe('useDataTableQuery', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('builds request objects from the table state and exposes raw query data', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const queryFactory = vi.fn((request) => {
      requests.push(request as Record<string, unknown>);

      return queryOptions({
        queryKey: ['dictionary-types', request],
        queryFn: async () => ({
          list: [
            {
              id: 1,
              dictTypeCode: 'payment',
              dictTypeName: '付款状态'
            }
          ],
          total: 33
        })
      });
    }) as unknown as QueryOptionsFactory<DictionaryTypeRow>;

    const { result } = renderHook(
      () =>
        useDataTableQuery({
          tableId: 'dictionary-types',
          columns,
          queryOptions: queryFactory
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.query.isSuccess).toBe(true);
    });

    expect(requests[0]).toMatchObject({
      pageNo: 1,
      pageSize: 10,
      dslVersion: 1
    });
    expect(result.current.total).toBe(33);
    expect(result.current.query.data).toEqual({
      list: [
        {
          id: 1,
          dictTypeCode: 'payment',
          dictTypeName: '付款状态'
        }
      ],
      total: 33
    });

    act(() => {
      result.current.table.setPageIndex(1);
    });

    await waitFor(() => {
      expect(requests.at(-1)).toMatchObject({ pageNo: 2, pageSize: 10 });
    });

    act(() => {
      result.current.table.getColumn('dictTypeCode')?.setFilterValue(' payment ');
    });

    await waitFor(() => {
      expect(requests.at(-1)).toMatchObject({
        condition: {
          nodeType: 'compose',
          logic: 'AND',
          children: [
            {
              nodeType: 'text',
              field: 'dictTypeCode',
              op: 'CONTAINS',
              value: 'payment'
            }
          ]
        }
      });
    });
  });

  it('keeps previous query data while the next page is loading', async () => {
    const pageTwo = createDeferred<{ list: DictionaryTypeRow[]; total: number }>();

    const queryFactory = vi.fn((request: { pageNo: number }) =>
      queryOptions({
        queryKey: ['dictionary-types', request],
        queryFn: async () => {
          if (request.pageNo === 1) {
            return {
              list: [
                {
                  id: 1,
                  dictTypeCode: 'payment',
                  dictTypeName: '付款状态'
                }
              ],
              total: 25
            };
          }

          return pageTwo.promise;
        }
      })
    ) as unknown as QueryOptionsFactory<DictionaryTypeRow>;

    const { result } = renderHook(
      () =>
        useDataTableQuery({
          tableId: 'dictionary-types',
          columns,
          queryOptions: queryFactory
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.query.data?.list?.[0]?.dictTypeCode).toBe('payment');
    });

    act(() => {
      result.current.table.setPageIndex(1);
    });

    await waitFor(() => {
      expect(queryFactory).toHaveBeenLastCalledWith(
        expect.objectContaining({ pageNo: 2, pageSize: 10 })
      );
    });

    expect(result.current.query.isFetching).toBe(true);
    expect(result.current.query.data?.list?.[0]?.dictTypeCode).toBe('payment');
    expect(result.current.table.getRowModel().rows[0]?.original.dictTypeCode).toBe('payment');

    pageTwo.resolve({
      list: [
        {
          id: 2,
          dictTypeCode: 'refund',
          dictTypeName: '退款状态'
        }
      ],
      total: 25
    });

    await waitFor(() => {
      expect(result.current.query.isFetching).toBe(false);
    });

    expect(result.current.query.data?.list?.[0]?.dictTypeCode).toBe('refund');
    expect(result.current.table.getRowModel().rows[0]?.original.dictTypeCode).toBe('refund');
  });
});
