import type { ColumnDef, ColumnSizingState } from '@tanstack/react-table';

import {
  DATA_TABLE_ACTIONS_COLUMN_ID,
  DATA_TABLE_ROW_NUMBER_COLUMN_ID,
  DATA_TABLE_SELECT_COLUMN_ID
} from './constants';

function getColumnDefId<TData>(column: ColumnDef<TData>): string | undefined {
  if (typeof column.id === 'string') {
    return column.id;
  }

  if ('accessorKey' in column && typeof column.accessorKey === 'string') {
    return column.accessorKey;
  }

  return undefined;
}

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
