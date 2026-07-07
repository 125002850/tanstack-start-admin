import type { ColumnDef, ColumnSizingState } from '@tanstack/react-table';

import {
  DATA_TABLE_ACTIONS_COLUMN_ID,
  DATA_TABLE_ROW_NUMBER_COLUMN_ID,
  DATA_TABLE_SELECT_COLUMN_ID
} from './constants';

/**
 * DataTable 列宽辅助函数。
 *
 * 工具列（序号、选择、操作）通常是固定宽度，不应该被用户拖拽缓存覆盖；
 * 这些 helper 负责识别固定列宽并从 columnSizing 中剔除对应项。
 */
function getColumnDefId<TData>(column: ColumnDef<TData>): string | undefined {
  if (typeof column.id === 'string') {
    return column.id;
  }

  if ('accessorKey' in column && typeof column.accessorKey === 'string') {
    return column.accessorKey;
  }

  return undefined;
}

/** 找出 min/max/size 完全相同且不可 resize 的固定宽度列。 */
export function getFixedWidthColumnSizing<TData>(
  columns: Array<ColumnDef<TData>>
): ColumnSizingState {
  return columns.reduce<ColumnSizingState>((acc, column) => {
    const columnId = getColumnDefId(column);

    if (
      !columnId ||
      column.enableResizing !== false ||
      typeof column.size !== 'number' ||
      column.minSize !== column.size ||
      column.maxSize !== column.size
    ) {
      return acc;
    }

    acc[columnId] = column.size;
    return acc;
  }, {});
}

/** 从持久化或 state 中移除项目约定的固定工具列宽度。 */
export function omitFixedWidthColumnSizing(
  columnSizing?: ColumnSizingState
): ColumnSizingState | undefined {
  if (!columnSizing) {
    return columnSizing;
  }

  let hasFixedWidthOverride = false;
  const rest: ColumnSizingState = {};

  for (const [columnId, width] of Object.entries(columnSizing)) {
    if (
      columnId === DATA_TABLE_ROW_NUMBER_COLUMN_ID ||
      columnId === DATA_TABLE_SELECT_COLUMN_ID ||
      columnId === DATA_TABLE_ACTIONS_COLUMN_ID
    ) {
      hasFixedWidthOverride = true;
      continue;
    }

    rest[columnId] = width;
  }

  return hasFixedWidthOverride ? rest : columnSizing;
}
