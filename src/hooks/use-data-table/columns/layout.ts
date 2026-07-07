import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';

import {
  DATA_TABLE_ACTIONS_COLUMN_ID,
  DATA_TABLE_ROW_NUMBER_COLUMN_ID,
  DATA_TABLE_SELECT_COLUMN_ID
} from '../constants';
import type { DataTablePinnedSide } from '../types';

/**
 * DataTable 生成列布局规则。
 *
 * 序号列、选择列和操作列由 useDataTable 自动注入或规范化，这里统一处理它们的列顺序、
 * resize 能力和固定方向，避免每个业务表重复写 pinning/order 细节。
 */
export function normalizeGeneratedColumnOrder(
  columnOrder: Array<string> | undefined,
  options: {
    showRowNumberColumn: boolean;
    hasSelectColumn: boolean;
  }
): Array<string> | undefined {
  if (!columnOrder) return columnOrder;

  const leadingIds: Array<string> = [];

  if (options.showRowNumberColumn) {
    leadingIds.push(DATA_TABLE_ROW_NUMBER_COLUMN_ID);
  }

  if (options.hasSelectColumn) {
    leadingIds.push(DATA_TABLE_SELECT_COLUMN_ID);
  }

  if (leadingIds.length === 0) {
    return columnOrder;
  }

  return [...leadingIds, ...columnOrder.filter((columnId) => !leadingIds.includes(columnId))];
}

/** 判断业务列里是否已经包含操作列。 */
export function hasActionsColumn<TData>(columns: Array<ColumnDef<TData>>): boolean {
  return columns.some((column) => column.id === DATA_TABLE_ACTIONS_COLUMN_ID);
}

/** 操作列必须固定宽度，手写 actions 列也统一关闭 resize。 */
export function normalizeActionColumn<TData>(column: ColumnDef<TData>): ColumnDef<TData> {
  if (column.id !== DATA_TABLE_ACTIONS_COLUMN_ID) {
    return column;
  }

  return {
    ...column,
    enableResizing: false
  };
}

/** 解析工具列 pinning：序号/选择列固定左侧，操作列按 actionColumnPin 固定。 */
export function resolveUtilityColumnPinning(
  columnPinning: ColumnPinningState | undefined,
  options: {
    hasPinnedActionsColumn: boolean;
    actionColumnPin: DataTablePinnedSide;
    showRowNumberColumn: boolean;
    hasSelectColumn: boolean;
  }
): ColumnPinningState | undefined {
  const { hasPinnedActionsColumn, actionColumnPin, showRowNumberColumn, hasSelectColumn } = options;

  if (!hasPinnedActionsColumn && !showRowNumberColumn && !hasSelectColumn) {
    return columnPinning;
  }

  const utilityLeftOrder: Array<string> = [];

  if (showRowNumberColumn) {
    utilityLeftOrder.push(DATA_TABLE_ROW_NUMBER_COLUMN_ID);
  }

  if (hasSelectColumn) {
    utilityLeftOrder.push(DATA_TABLE_SELECT_COLUMN_ID);
  }

  const left = (columnPinning?.left ?? []).filter(
    // 先移除旧工具列，再按项目约定重新插入，避免重复和顺序错乱。
    (columnId) =>
      columnId !== DATA_TABLE_ACTIONS_COLUMN_ID &&
      columnId !== DATA_TABLE_ROW_NUMBER_COLUMN_ID &&
      columnId !== DATA_TABLE_SELECT_COLUMN_ID
  );
  const right = (columnPinning?.right ?? []).filter(
    (columnId) =>
      columnId !== DATA_TABLE_ACTIONS_COLUMN_ID &&
      columnId !== DATA_TABLE_ROW_NUMBER_COLUMN_ID &&
      columnId !== DATA_TABLE_SELECT_COLUMN_ID
  );

  const nextLeft = [...utilityLeftOrder];
  if (hasPinnedActionsColumn && actionColumnPin === 'left') {
    nextLeft.push(DATA_TABLE_ACTIONS_COLUMN_ID);
  }

  return {
    left: [...nextLeft, ...left],
    right:
      hasPinnedActionsColumn && actionColumnPin === 'right'
        ? [...right, DATA_TABLE_ACTIONS_COLUMN_ID]
        : right
  };
}
