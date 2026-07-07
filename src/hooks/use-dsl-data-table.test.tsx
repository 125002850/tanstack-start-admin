import * as React from 'react';
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEBOUNCE_MS } from '@/hooks/use-data-table/constants';

import { useDslDataTable } from './use-dsl-data-table';
import type {
  DataTableDslPageRequestBase,
  PaginatedResponse,
  QueryOptionsFactory
} from './use-dsl-data-table.dsl';

type DictionaryTypeRow = {
  id?: number;
  dictTypeCode: string;
  dictTypeName: string;
};

type LegacyDictionaryTypeResponse = {
  items?: DictionaryTypeRow[];
  count?: number;
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

describe('useDslDataTable', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('app-data-table-per-page:dictionary-types', '10');
  });

  it('builds request objects from table state and exposes narrowed queryState with default list/total mapping', async () => {
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
        useDslDataTable({
          tableId: 'dictionary-types',
          columns,
          queryOptions: queryFactory
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.queryState.data).toEqual({
        list: [
          {
            id: 1,
            dictTypeCode: 'payment',
            dictTypeName: '付款状态'
          }
        ],
        total: 33
      });
    });

    expect(requests.at(-1)).toMatchObject({
      pageNo: 1,
      pageSize: 10
    });
    expect(result.current.total).toBe(33);
    expect(result.current.debounceMs).toBe(DEBOUNCE_MS);
    expect(result.current.table.getRowModel().rows[0]?.id).toBe('1');
    expect(result.current.queryState.isFetching).toBe(false);
    expect(result.current.queryState.isError).toBe(false);
    expect(typeof result.current.queryState.refetch).toBe('function');
    expect(typeof result.current.refreshProps?.onRefresh).toBe('function');
    expect(result.current.refreshProps?.isRefreshing).toBe(false);
    expect('isSuccess' in result.current.queryState).toBe(false);

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
    const pageTwo = createDeferred<PaginatedResponse<DictionaryTypeRow>>();

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
        useDslDataTable({
          tableId: 'dictionary-types',
          columns,
          queryOptions: queryFactory
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.queryState.data?.list?.[0]?.dictTypeCode).toBe('payment');
    });

    act(() => {
      result.current.table.setPageIndex(1);
    });

    await waitFor(() => {
      expect(queryFactory).toHaveBeenLastCalledWith(
        expect.objectContaining({ pageNo: 2, pageSize: 10 })
      );
    });

    expect(result.current.queryState.isFetching).toBe(true);
    expect(result.current.queryState.data?.list?.[0]?.dictTypeCode).toBe('payment');
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
      expect(result.current.queryState.isFetching).toBe(false);
    });

    expect(result.current.queryState.data?.list?.[0]?.dictTypeCode).toBe('refund');
    expect(result.current.table.getRowModel().rows[0]?.original.dictTypeCode).toBe('refund');
  });

  it('allows custom mapQueryData and falls back to table-local row ids when default row.id is missing', async () => {
    const queryFactory = vi.fn((request) =>
      queryOptions({
        queryKey: ['legacy-dictionary-types', request],
        queryFn: async (): Promise<LegacyDictionaryTypeResponse> => ({
          items: [
            {
              dictTypeCode: 'payment',
              dictTypeName: '付款状态'
            }
          ],
          count: 11
        })
      })
    ) as unknown as QueryOptionsFactory<
      DictionaryTypeRow,
      DataTableDslPageRequestBase,
      LegacyDictionaryTypeResponse
    >;

    const { result } = renderHook(
      () =>
        useDslDataTable<
          DictionaryTypeRow,
          DataTableDslPageRequestBase,
          LegacyDictionaryTypeResponse
        >({
          tableId: 'legacy-dictionary-types',
          columns,
          queryOptions: queryFactory,
          mapQueryData: (data) => ({
            list: data?.items ?? [],
            total: data?.count ?? 0
          })
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.total).toBe(11);
    });

    expect(result.current.queryState.data).toEqual({
      items: [
        {
          dictTypeCode: 'payment',
          dictTypeName: '付款状态'
        }
      ],
      count: 11
    });
    expect(result.current.table.getRowModel().rows[0]?.id).toBe('legacy-dictionary-types-0');
  });

  it('prefers explicit getRowId over the default id resolver', async () => {
    const queryFactory = vi.fn((request) =>
      queryOptions({
        queryKey: ['dictionary-types', request],
        queryFn: async () => ({
          list: [
            {
              id: 42,
              dictTypeCode: 'payment',
              dictTypeName: '付款状态'
            }
          ],
          total: 1
        })
      })
    ) as unknown as QueryOptionsFactory<DictionaryTypeRow>;

    const { result } = renderHook(
      () =>
        useDslDataTable({
          tableId: 'dictionary-types',
          columns,
          queryOptions: queryFactory,
          getRowId: (row) => row.dictTypeCode
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.table.getRowModel().rows[0]?.id).toBe('payment');
    });
  });

  it('passes rowId key through to the underlying table', async () => {
    const queryFactory = vi.fn((request) =>
      queryOptions({
        queryKey: ['dictionary-types', request],
        queryFn: async () => ({
          list: [
            {
              id: 42,
              dictTypeCode: 'payment',
              dictTypeName: '付款状态'
            }
          ],
          total: 1
        })
      })
    ) as unknown as QueryOptionsFactory<DictionaryTypeRow>;

    const { result } = renderHook(
      () =>
        useDslDataTable({
          tableId: 'dictionary-types',
          columns,
          queryOptions: queryFactory,
          rowId: 'dictTypeCode'
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.table.getRowModel().rows[0]?.id).toBe('payment');
    });
  });

  it('warns once when a filterable DSL column uses an unsupported filter variant', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const queryFactory = vi.fn((request) =>
      queryOptions({
        queryKey: ['dictionary-types', request],
        queryFn: async () => ({
          list: [],
          total: 0
        })
      })
    ) as unknown as QueryOptionsFactory<DictionaryTypeRow>;
    const unsupportedColumns: Array<ColumnDef<DictionaryTypeRow>> = [
      ...columns,
      {
        accessorKey: 'id',
        header: 'ID',
        enableColumnFilter: true,
        meta: { variant: 'number', label: 'ID' }
      }
    ];

    const { rerender } = renderHook(
      ({ tableId }) =>
        useDslDataTable({
          tableId,
          columns: unsupportedColumns,
          queryOptions: queryFactory
        }),
      {
        wrapper: createWrapper(),
        initialProps: { tableId: 'dictionary-types' }
      }
    );

    await waitFor(() => {
      expect(warn).toHaveBeenCalledTimes(1);
    });

    expect(warn.mock.calls[0]?.[0]).toContain('[useDslDataTable]');
    expect(warn.mock.calls[0]?.[1]).toMatchObject({
      tableId: 'dictionary-types',
      columnId: 'id',
      variant: 'number'
    });

    rerender({ tableId: 'dictionary-types' });

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('builds refreshProps and dispatches refresh success/error callbacks', async () => {
    let shouldFail = false;
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const queryFactory = vi.fn((request) =>
      queryOptions({
        queryKey: ['dictionary-types', request],
        queryFn: async () => {
          if (shouldFail) {
            throw new Error('refresh failed');
          }

          return {
            list: [
              {
                id: 7,
                dictTypeCode: 'payment',
                dictTypeName: '付款状态'
              }
            ],
            total: 1
          };
        }
      })
    ) as unknown as QueryOptionsFactory<DictionaryTypeRow>;

    const { result } = renderHook(
      () =>
        useDslDataTable({
          tableId: 'dictionary-types',
          columns,
          queryOptions: queryFactory,
          refreshBehavior: {
            onSuccess,
            onError
          }
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.queryState.data?.list?.[0]?.id).toBe(7);
    });

    await act(async () => {
      await result.current.refreshProps?.onRefresh();
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();

    shouldFail = true;

    await act(async () => {
      await result.current.refreshProps?.onRefresh();
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });
});
