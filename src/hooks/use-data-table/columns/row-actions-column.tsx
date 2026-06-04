import type { ColumnDef } from '@tanstack/react-table';
import * as React from 'react';

import {
  DataTableRowActions,
  DATA_TABLE_ROW_ACTIONS_MAX_VISIBLE,
  getDataTableRowActionsColumnWidth,
  type DataTableRowAction
} from '@/components/ui/table/data-table-row-action';

import { DATA_TABLE_ACTIONS_COLUMN_ID } from '../constants';

export function createRowActionsColumn<TData>(
  rowActions: Array<DataTableRowAction<TData>>
): ColumnDef<TData> {
  const actionColumnWidth = getDataTableRowActionsColumnWidth(
    rowActions.length,
    DATA_TABLE_ROW_ACTIONS_MAX_VISIBLE
  );

  return {
    id: DATA_TABLE_ACTIONS_COLUMN_ID,
    header: '操作',
    cell: ({ row }) =>
      React.createElement(DataTableRowActions<TData>, {
        row: row.original,
        actions: rowActions,
        maxVisible: DATA_TABLE_ROW_ACTIONS_MAX_VISIBLE
      }),
    size: actionColumnWidth,
    minSize: actionColumnWidth,
    maxSize: actionColumnWidth,
    enableSorting: false,
    enableResizing: false
  };
}
