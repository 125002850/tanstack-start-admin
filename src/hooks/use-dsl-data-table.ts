import * as React from 'react';
import {
  keepPreviousData,
  useQuery,
  type QueryKey,
  type UseQueryResult
} from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { useDataTable } from '@/hooks/use-data-table';
import { DEBOUNCE_MS } from '@/hooks/use-data-table/constants';
import type { UseDataTableProps } from '@/hooks/use-data-table/types';
import { useDataTablePageSize } from '@/hooks/use-data-table/use-data-table-page-size';
import type { ExtendedColumnSort } from '@/types/data-table';

import {
  buildDataTableDslRequest,
  isDataTableDslFilterVariantSupported,
  type DataTableDslCondition,
  type DataTableDslPageRequestBase,
  type DataTableDslSortItem,
  type PaginatedResponse,
  type QueryOptionsFactory
} from './use-dsl-data-table.dsl';

type QueryStateSubset<TQueryData, TError> = Pick<
  UseQueryResult<TQueryData, TError>,
  'data' | 'isFetching' | 'error' | 'isError' | 'refetch'
>;

type RefreshBehavior<TError> = {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: TError) => void | Promise<void>;
};

export function createDefaultRefreshBehavior<TError = Error>(options?: {
  successMessage?: string;
  errorMessage?: string;
}): RefreshBehavior<TError> {
  return {
    onSuccess: () => {
      toast.success(options?.successMessage ?? '列表已刷新');
    },
    onError: () => {
      toast.error(options?.errorMessage ?? '列表刷新失败');
    }
  };
}

type RefreshProps = {
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
};

type UseDslDataTableProps<
  TData,
  TRequest = DataTableDslPageRequestBase,
  TQueryData = PaginatedResponse<TData>,
  TError = unknown,
  TQueryKey extends QueryKey = QueryKey
> = Omit<
  UseDataTableProps<TData>,
  'data' | 'columns' | 'totalCount' | 'tableId' | 'pageSize' | 'onPageSizeChange'
> & {
  tableId: string;
  columns: Array<ColumnDef<TData>>;
  queryOptions: QueryOptionsFactory<TData, TRequest, TQueryData, TError, TQueryKey>;
  baseCondition?: DataTableDslCondition;
  defaultRequestSort?: Array<DataTableDslSortItem>;
  defaultSort?: ExtendedColumnSort<TData>[];
  mapQueryData?: (data: TQueryData | undefined) => PaginatedResponse<TData>;
  refreshBehavior?: RefreshBehavior<TError>;
};

type UseDslDataTableResult<TData, TQueryData, TError> = ReturnType<typeof useDataTable<TData>> & {
  total: number;
  queryState: QueryStateSubset<TQueryData, TError>;
  refreshProps?: RefreshProps;
};

const warnedUnsupportedFilterVariants = new Set<string>();

function defaultMapQueryData<TData, TQueryData>(
  data: TQueryData | undefined
): PaginatedResponse<TData> {
  const page = data as PaginatedResponse<TData> | undefined;

  return {
    list: page?.list ?? [],
    total: page?.total ?? 0
  };
}

function getColumnId<TData>(column: ColumnDef<TData>): string | null {
  if (typeof column.id === 'string' && column.id.length > 0) {
    return column.id;
  }

  if (
    'accessorKey' in column &&
    typeof column.accessorKey === 'string' &&
    column.accessorKey.length > 0
  ) {
    return column.accessorKey;
  }

  return null;
}

function warnUnsupportedDslFilterVariants<TData>({
  tableId,
  columns
}: {
  tableId: string;
  columns: Array<ColumnDef<TData>>;
}) {
  if (!import.meta.env.DEV) {
    return;
  }

  for (const column of columns) {
    if (column.enableColumnFilter === false) {
      continue;
    }

    const variant = column.meta?.variant;
    if (!variant || isDataTableDslFilterVariantSupported(variant)) {
      continue;
    }

    const columnId = getColumnId(column);
    if (!columnId) {
      continue;
    }

    const warningKey = `${tableId}:${columnId}:${variant}`;
    if (warnedUnsupportedFilterVariants.has(warningKey)) {
      continue;
    }

    warnedUnsupportedFilterVariants.add(warningKey);
    console.warn('[useDslDataTable] Unsupported filter variant for automatic DSL serialization.', {
      tableId,
      columnId,
      variant
    });
  }
}

export function useDslDataTable<
  TData,
  TRequest = DataTableDslPageRequestBase,
  TQueryData = PaginatedResponse<TData>,
  TError = unknown,
  TQueryKey extends QueryKey = QueryKey
>({
  tableId,
  columns,
  queryOptions,
  baseCondition,
  defaultRequestSort,
  defaultSort = [],
  mapQueryData,
  refreshBehavior,
  showSelectColumn,
  showRowNumberColumn,
  debounceMs,
  initialState,
  ...tableProps
}: UseDslDataTableProps<TData, TRequest, TQueryData, TError, TQueryKey>): UseDslDataTableResult<
  TData,
  TQueryData,
  TError
> {
  const { isReady, pageSize, setPageSize } = useDataTablePageSize({ tableId });
  const [resolvedData, setResolvedData] = React.useState<PaginatedResponse<TData>>({
    list: [],
    total: 0
  });

  React.useEffect(() => {
    warnUnsupportedDslFilterVariants({ tableId, columns });
  }, [columns, tableId]);

  const total = resolvedData.total ?? 0;

  const { table, ...tableState } = useDataTable({
    ...tableProps,
    tableId,
    columns,
    data: resolvedData.list ?? [],
    totalCount: total,
    pageSize,
    onPageSizeChange: setPageSize,
    debounceMs: debounceMs ?? DEBOUNCE_MS,
    showSelectColumn: showSelectColumn ?? true,
    showRowNumberColumn: showRowNumberColumn ?? true,
    initialState:
      defaultSort.length > 0
        ? {
            ...initialState,
            sorting: initialState?.sorting ?? defaultSort
          }
        : initialState
  });

  const pagination = table.getState().pagination;
  const sorting = table.getState().sorting;
  const columnFilters = table.getState().columnFilters;

  const request = React.useMemo(
    () =>
      buildDataTableDslRequest({
        columns,
        pagination,
        sorting,
        columnFilters,
        baseCondition,
        defaultRequestSort
      }) as TRequest,
    [baseCondition, columnFilters, columns, defaultRequestSort, pagination, sorting]
  );

  const options = React.useMemo(() => queryOptions(request), [queryOptions, request]);

  const query = useQuery({
    ...options,
    enabled: isReady && (options.enabled ?? true),
    placeholderData: options.placeholderData ?? keepPreviousData
  });
  const canRefresh = isReady && (options.enabled ?? true);

  const resolvedMapQueryData = React.useMemo(
    () => mapQueryData ?? defaultMapQueryData<TData, TQueryData>,
    [mapQueryData]
  );

  const mappedData = React.useMemo(
    () => resolvedMapQueryData(query.data),
    [query.data, resolvedMapQueryData]
  );

  React.useEffect(() => {
    if (query.data === undefined) {
      return;
    }

    setResolvedData((current) =>
      current === mappedData ||
      (current.total === mappedData.total && current.list === mappedData.list)
        ? current
        : mappedData
    );
  }, [mappedData, query.data]);

  const queryState = React.useMemo<QueryStateSubset<TQueryData, TError>>(
    () => ({
      data: query.data,
      isFetching: !isReady || query.isFetching,
      error: query.error,
      isError: query.isError,
      refetch: query.refetch
    }),
    [isReady, query.data, query.error, query.isError, query.isFetching, query.refetch]
  );

  const refreshProps = React.useMemo<RefreshProps | undefined>(() => {
    if (!canRefresh) {
      return undefined;
    }

    return {
      isRefreshing: !isReady || query.isFetching,
      onRefresh: async () => {
        const result = await query.refetch();

        if (result.error) {
          await refreshBehavior?.onError?.(result.error as TError);
          return;
        }

        await refreshBehavior?.onSuccess?.();
      }
    };
  }, [canRefresh, isReady, query, refreshBehavior]);

  return {
    table,
    ...tableState,
    total: mappedData.total ?? resolvedData.total ?? 0,
    queryState,
    refreshProps
  };
}
