import type { ColumnDef } from '@tanstack/react-table';
import * as React from 'react';

import {
  DataTableRowActions,
  DATA_TABLE_ROW_ACTIONS_MAX_VISIBLE,
  getDataTableRowActionsColumnWidth,
  type DataTableRowAction
} from '@/components/ui/table/actions/data-table-row-action';
import { DATA_TABLE_PINNED_SHADOWS } from '@/lib/data-table';

import { DATA_TABLE_ACTIONS_COLUMN_ID } from '../constants';

/**
 * 根据 rowActions 自动生成固定宽度操作列。
 *
 * 宽度由操作数量推导，并把 min/max/size 设为同一个值，确保用户列宽缓存不会改变操作列。
 */
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
    enableResizing: false,
    meta: {
      // 操作列通常固定在右侧，显式给出 pinned shadow，保证滚动边界清晰。
      pinningShadow: DATA_TABLE_PINNED_SHADOWS
    }
  };
}
