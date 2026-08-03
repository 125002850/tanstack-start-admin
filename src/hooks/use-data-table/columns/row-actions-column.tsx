import type { ColumnDef } from '@tanstack/react-table';

import {
  DATA_TABLE_ROW_ACTIONS_MAX_VISIBLE,
  getDataTableRowActionsColumnWidth
} from '@/lib/data-table/row-actions';
import type { DataTableRowAction } from '@/types/data-table';

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
    // 行操作 UI 由 DataTableBody 根据 table meta 渲染，hook 层只负责列状态装配。
    cell: () => null,
    size: actionColumnWidth,
    minSize: actionColumnWidth,
    maxSize: actionColumnWidth,
    enableSorting: false,
    enableResizing: false
  };
}
