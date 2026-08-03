import * as React from 'react';
import {
  keepPreviousData,
  useQuery,
  type QueryKey,
  type UseQueryResult
} from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';

import type { ExtendedColumnSort } from '@/types/data-table';

import {
  buildDataTableDslRequest,
  isDataTableDslFilterVariantSupported,
  type DataTableDslCondition,
  type DataTableDslPageRequestBase,
  type DataTableDslSortItem,
  type PaginatedResponse,
  type QueryOptionsFactory
} from './dsl';
import { DEBOUNCE_MS } from './constants';
import type { UseDataTableProps } from './types';
import { useDataTable } from './use-data-table';
import { useDataTablePageSize } from './use-data-table-page-size';

/**
 * 基于 DSL 后端查询的 DataTable hook。
 *
 * 在 useDataTable 之上接入 React Query：根据分页、排序和 columnFilters 构建后端请求，
 * 查询结果再映射回 DataTable 所需的 data/total，同时提供刷新按钮所需状态。
 */
export type QueryStateSubset<TQueryData, TError> = Pick<
  UseQueryResult<TQueryData, TError>,
  'data' | 'isFetching' | 'error' | 'isError' | 'refetch'
>;

export type RefreshBehavior<TError> = {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: TError) => void | Promise<void>;
};

export type RefreshProps = {
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
};

export type UseDslDataTableProps<
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
  /** 是否启用 DataTable 斑马纹。默认 `true`。 */
  enableZebraStriping?: boolean;
};

export type UseDslDataTableResult<TData, TQueryData, TError> = ReturnType<
  typeof useDataTable<TData>
> & {
  total: number;
  queryState: QueryStateSubset<TQueryData, TError>;
  refreshProps?: RefreshProps;
};

const warnedUnsupportedFilterVariants = new Set<string>();

type ResolvedDslData<TData> = PaginatedResponse<TData> & {
  pageNo: number;
  scopeKey: string;
};

function stableSerializeScope(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerializeScope).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .toSorted()
      .map((key) => `${JSON.stringify(key)}:${stableSerializeScope(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function getDslEditingScopeKey(request: unknown) {
  if (!request || typeof request !== 'object') return stableSerializeScope(request);
  const { pageNo: _pageNo, ...scope } = request as Record<string, unknown>;
  return stableSerializeScope(scope);
}

/** 默认假定后端返回 `{ list, total }`，缺失时回退为空列表和 0。 */
function defaultMapQueryData<TData, TQueryData>(
  data: TQueryData | undefined
): PaginatedResponse<TData> {
  const page = data as PaginatedResponse<TData> | undefined;

  return {
    list: page?.list ?? [],
    total: page?.total ?? 0
  };
}

/** 解析 ColumnDef 的稳定 ID，优先 id，其次 accessorKey。 */
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

/** 开发环境提示 DSL 无法自动序列化的筛选类型，避免筛选 UI 看似生效但请求无条件。 */
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
  enableZebraStriping = true,
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
  // pageSize 有本地偏好，isReady 前不发起 query，避免先用默认值请求再立刻改 pageSize。
  const { isReady, pageSize, setPageSize } = useDataTablePageSize({ tableId });
  const [resolvedData, setResolvedData] = React.useState<ResolvedDslData<TData>>({
    list: [],
    total: 0,
    pageNo: 1,
    scopeKey: `${tableId}:initial`
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
    editingPageNo: resolvedData.pageNo,
    editingScopeKey: resolvedData.scopeKey,
    requireExplicitEditingRowId: true,
    debounceMs: debounceMs ?? DEBOUNCE_MS,
    showSelectColumn: showSelectColumn ?? true,
    showRowNumberColumn: showRowNumberColumn ?? true,
    meta: {
      ...tableProps.meta,
      enableZebraStriping
    },
    initialState:
      defaultSort.length > 0
        ? {
            // defaultSort 只在 initialState 没有 sorting 时生效，避免覆盖调用方显式排序。
            ...initialState,
            sorting: initialState?.sorting ?? defaultSort
          }
        : initialState
  });

  const pagination = table.getState().pagination;
  const sorting = table.getState().sorting;
  const columnFilters = table.getState().columnFilters;

  const request = React.useMemo(
    // request 是 queryKey/queryFn 的输入，必须只由可序列化表格状态和列 meta 推导。
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
  const currentEditingScopeKey = React.useMemo(() => getDslEditingScopeKey(request), [request]);

  const query = useQuery({
    ...options,
    enabled: isReady && (options.enabled ?? true),
    placeholderData: options.placeholderData ?? keepPreviousData
  });
  const canRefresh = isReady && (options.enabled ?? true);

  const resolvedMapQueryData = React.useMemo(
    // mapQueryData 允许适配非标准后端结构，例如 data.records/data.total。
    () => mapQueryData ?? defaultMapQueryData<TData, TQueryData>,
    [mapQueryData]
  );

  const mappedData = React.useMemo(
    () => resolvedMapQueryData(query.data),
    [query.data, resolvedMapQueryData]
  );

  React.useEffect(() => {
    if (query.data === undefined || query.isPlaceholderData) {
      return;
    }

    // 只有 query 真正有数据时才更新 resolvedData，placeholderData 期间保留上一批表格数据。
    setResolvedData((current) => {
      const pageNo = pagination.pageIndex + 1;
      return current.total === mappedData.total &&
        current.list === mappedData.list &&
        current.pageNo === pageNo &&
        current.scopeKey === currentEditingScopeKey
        ? current
        : {
            ...mappedData,
            pageNo,
            scopeKey: currentEditingScopeKey
          };
    });
  }, [
    currentEditingScopeKey,
    mappedData,
    pagination.pageIndex,
    query.data,
    query.isPlaceholderData
  ]);

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

  const refetchQuery = query.refetch;
  const onRefreshSuccess = refreshBehavior?.onSuccess;
  const onRefreshError = refreshBehavior?.onError;
  const handleRefresh = React.useCallback(async () => {
    const result = await refetchQuery();

    if (result.error) {
      await onRefreshError?.(result.error as TError);
      return;
    }

    await onRefreshSuccess?.();
  }, [onRefreshError, onRefreshSuccess, refetchQuery]);

  const refreshProps = React.useMemo<RefreshProps | undefined>(() => {
    if (!canRefresh) {
      return undefined;
    }

    return {
      isRefreshing: !isReady || query.isFetching,
      onRefresh: handleRefresh
    };
  }, [canRefresh, handleRefresh, isReady, query.isFetching]);

  return {
    table,
    ...tableState,
    total: mappedData.total ?? resolvedData.total ?? 0,
    queryState,
    refreshProps
  };
}
