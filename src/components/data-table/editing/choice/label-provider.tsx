import { keepPreviousData, queryOptions, useQueries } from '@tanstack/react-query';
import type { Column, Row, Table as TanstackTable } from '@tanstack/react-table';
import * as React from 'react';

import type {
  DataTableChoiceOption,
  DataTableChoiceValue,
  DataTableEditableChoiceColumnMeta
} from '../types';

import { getDataTableChoiceValues } from './model';

export type DataTableRemoteChoiceLabelState = {
  isError: boolean;
  isPending: boolean;
  optionByValue: ReadonlyMap<DataTableChoiceValue, DataTableChoiceOption>;
};

const EMPTY_REMOTE_LABEL_STATE: DataTableRemoteChoiceLabelState = {
  isError: false,
  isPending: false,
  optionByValue: new Map()
};

const DataTableRemoteChoiceLabelContext = React.createContext<
  ReadonlyMap<string, DataTableRemoteChoiceLabelState>
>(new Map());

type RemoteLabelRequest<TData> = {
  columnId: string;
  remoteOptions: NonNullable<DataTableEditableChoiceColumnMeta<TData>['remoteOptions']>;
  values: DataTableChoiceValue[];
};

function collectRemoteLabelRequests<TData>(
  rows: readonly Row<TData>[],
  columns: readonly Column<TData>[]
): RemoteLabelRequest<TData>[] {
  const requests: RemoteLabelRequest<TData>[] = [];

  for (const column of columns) {
    const editableChoice = column.columnDef.meta?.editableChoice;
    const remoteOptions = editableChoice?.remoteOptions;
    if (
      editableChoice?.type !== 'remoteSelect' ||
      !remoteOptions ||
      !remoteOptions.resolveOptions
    ) {
      continue;
    }

    const values = [
      ...new Set(
        rows.flatMap((row) => getDataTableChoiceValues(row.original[editableChoice.field]))
      )
    ];
    if (values.length === 0) continue;
    requests.push({
      columnId: column.id,
      remoteOptions,
      values
    });
  }
  return requests;
}

/** 当前页 remoteSelect label 批量解析器；每列聚合为一个查询，避免 N+1。 */
export function DataTableRemoteChoiceLabelProvider<TData>({
  table,
  children
}: {
  table: TanstackTable<TData>;
  children: React.ReactNode;
}) {
  const rows = table.getRowModel().rows;
  const columns = table.getAllLeafColumns();
  const requests = React.useMemo(() => collectRemoteLabelRequests(rows, columns), [columns, rows]);
  const tableId = table.options.meta?.dataTableId ?? 'data-table';
  const results = useQueries({
    queries: requests.map((request) =>
      queryOptions({
        queryKey: ['data-table-choice-resolve', tableId, request.columnId, request.values],
        queryFn: ({ signal }) =>
          request.remoteOptions.resolveOptions!({
            values: request.values,
            signal
          }),
        placeholderData: keepPreviousData
      })
    )
  });
  const stateByColumn = React.useMemo(() => {
    const next = new Map<string, DataTableRemoteChoiceLabelState>();
    requests.forEach((request, index) => {
      const result = results[index];
      const options = result?.data ?? [];
      next.set(request.columnId, {
        isError: result?.isError ?? false,
        isPending: (result?.isPending ?? false) && options.length === 0,
        optionByValue: new Map(options.map((option) => [option.value, option]))
      });
    });
    return next;
  }, [requests, results]);

  return (
    <DataTableRemoteChoiceLabelContext.Provider value={stateByColumn}>
      {children}
    </DataTableRemoteChoiceLabelContext.Provider>
  );
}

export function useDataTableRemoteChoiceLabelState(
  columnId: string
): DataTableRemoteChoiceLabelState {
  return (
    React.useContext(DataTableRemoteChoiceLabelContext).get(columnId) ?? EMPTY_REMOTE_LABEL_STATE
  );
}

export function hasDataTableRemoteChoiceLabelResolvers<TData>(table: TanstackTable<TData>) {
  return table
    .getAllLeafColumns()
    .some(
      (column) =>
        column.columnDef.meta?.editableChoice?.type === 'remoteSelect' &&
        Boolean(column.columnDef.meta.editableChoice.remoteOptions?.resolveOptions)
    );
}
