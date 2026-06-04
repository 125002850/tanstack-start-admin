import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table';

import {
  DATA_TABLE_ACTIONS_COLUMN_ID,
  DATA_TABLE_ROW_NUMBER_COLUMN_ID,
  DATA_TABLE_SELECT_COLUMN_ID
} from '../constants';
import type { DataTablePinnedSide } from '../types';

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

export function hasActionsColumn<TData>(columns: Array<ColumnDef<TData>>): boolean {
  return columns.some((column) => column.id === DATA_TABLE_ACTIONS_COLUMN_ID);
}

export function normalizeActionColumn<TData>(column: ColumnDef<TData>): ColumnDef<TData> {
  if (column.id !== DATA_TABLE_ACTIONS_COLUMN_ID) {
    return column;
  }

  return {
    ...column,
    enableResizing: false
  };
}

export function resolveUtilityColumnPinning(
  columnPinning: ColumnPinningState | undefined,
  options: {
    hasPinnedActionsColumn: boolean;
    actionColumnPin: DataTablePinnedSide;
    showRowNumberColumn: boolean;
    hasSelectColumn: boolean;
  }
): ColumnPinningState | undefined {
  const { hasPinnedActionsColumn, actionColumnPin, showRowNumberColumn, hasSelectColumn } =
    options;

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
