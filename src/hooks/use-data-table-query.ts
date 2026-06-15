import * as React from 'react';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';

import { useDataTable } from '@/hooks/use-data-table';
import { useDataTablePageSize } from '@/lib/data-table-page-size';
import type { DataTableRowAction } from '@/components/ui/table/data-table-row-action';
import type { ExtendedColumnSort } from '@/types/data-table';

import {
  buildDataTableDslRequest,
  type DataTableDslCondition,
  type DataTableDslPageRequestBase,
  type PaginatedResponse,
  type QueryOptionsFactory
} from './use-data-table-query.dsl';

type UseDataTableQueryProps<
  TData,
  TRequest = DataTableDslPageRequestBase,
> = {
  tableId: string;
  columns: Array<ColumnDef<TData>>;
  queryOptions: QueryOptionsFactory<TData, TRequest>;
  rowActions?: DataTableRowAction<TData>[];
  baseCondition?: DataTableDslCondition;
  defaultSort?: ExtendedColumnSort<TData>[];
};

type UseDataTableQueryResult<TData> = {
  table: ReturnType<typeof useDataTable<TData>>['table'];
  total: number;
  query: UseQueryResult<PaginatedResponse<TData>, unknown>;
};

function getPageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize) || 1);
}

export function useDataTableQuery<
  TData,
  TRequest = DataTableDslPageRequestBase,
>({
  tableId,
  columns,
  queryOptions,
  rowActions,
  baseCondition,
  defaultSort = [],
}: UseDataTableQueryProps<TData, TRequest>): UseDataTableQueryResult<TData> {
  const { isReady, pageSize, setPageSize } = useDataTablePageSize({ tableId });
  const [resolvedData, setResolvedData] = React.useState<PaginatedResponse<TData>>({
    list: [],
    total: 0
  });

  const total = resolvedData.total ?? 0;

  const { table } = useDataTable({
    tableId,
    columns,
    data: resolvedData.list ?? [],
    pageCount: getPageCount(total, pageSize),
    pageSize,
    onPageSizeChange: setPageSize,
    rowActions,
    initialState: defaultSort.length > 0 ? { sorting: defaultSort } : undefined
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
        baseCondition
      }) as TRequest,
    [baseCondition, columnFilters, columns, pagination, sorting]
  );

  const options = React.useMemo(() => queryOptions(request), [queryOptions, request]);

  const query = useQuery({
    ...options,
    enabled: isReady && (options.enabled ?? true),
    placeholderData: options.placeholderData ?? keepPreviousData
  });

  React.useEffect(() => {
    if (!query.data) {
      return;
    }

    setResolvedData((current) =>
      current === query.data ||
      (current.total === query.data.total && current.list === query.data.list)
        ? current
        : query.data
    );
  }, [query.data]);

  return {
    table,
    total: query.data?.total ?? resolvedData.total ?? 0,
    query
  };
}
