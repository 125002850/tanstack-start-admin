import type { FilterOperator, FilterVariant } from '@/types/data-table';
import type { Column, Table } from '@tanstack/react-table';

import { dataTableConfig } from '@/config/data-table';

function getColumnPinningShadow<TData>({
  column,
  isPinned,
  isLastLeftPinnedColumn,
  isFirstRightPinnedColumn
}: {
  column: Column<TData>;
  isPinned: 'left' | 'right';
  isLastLeftPinnedColumn: boolean;
  isFirstRightPinnedColumn: boolean;
}): string | undefined {
  const customShadow = column.columnDef.meta?.pinningShadow?.[isPinned];
  if (customShadow) {
    return customShadow;
  }

  if (isLastLeftPinnedColumn) {
    return '-5px 0 5px -5px var(--border) inset';
  }

  if (isFirstRightPinnedColumn) {
    return '5px 0 5px -5px var(--border) inset';
  }

  return undefined;
}

export function getCommonPinningStyles<TData>({
  column
}: {
  column: Column<TData>;
}): React.CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn = isPinned === 'left' && column.getIsLastColumn('left');
  const isFirstRightPinnedColumn = isPinned === 'right' && column.getIsFirstColumn('right');

  // Pinned columns need explicit width + sticky positioning for the pinning
  // offset calculations. Non-pinned cells rely on <colgroup> + table-layout:fixed
  // for column widths — setting width here would conflict with border-box sizing.
  if (isPinned) {
    return {
      boxShadow: getColumnPinningShadow({
        column,
        isPinned,
        isLastLeftPinnedColumn,
        isFirstRightPinnedColumn
      }),
      left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
      right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
      position: 'sticky',
      pointerEvents: 'auto',
      width: column.getSize(),
      zIndex: 2
    };
  }

  return {};
}

export function getFilterOperators(filterVariant: FilterVariant) {
  const operatorMap: Record<FilterVariant, { label: string; value: FilterOperator }[]> = {
    text: dataTableConfig.textOperators,
    number: dataTableConfig.numericOperators,
    range: dataTableConfig.numericOperators,
    date: dataTableConfig.dateOperators,
    dateRange: dataTableConfig.dateOperators,
    boolean: dataTableConfig.booleanOperators,
    select: dataTableConfig.selectOperators,
    multiSelect: dataTableConfig.multiSelectOperators
  };

  return operatorMap[filterVariant] ?? dataTableConfig.textOperators;
}

export function getSelectedPageRows<TData>(table: Table<TData>): TData[] {
  const rowSelection = table.getState().rowSelection ?? {};
  const rows = table.getRowModel().rows;

  if (rows.length === 0) {
    return [];
  }

  const selectedRows: TData[] = [];

  for (const row of rows) {
    if (rowSelection[row.id]) {
      selectedRows.push(row.original);
    }
  }

  return selectedRows;
}

export function getSelectedPageRowCount<TData>(table: Table<TData>): number {
  const rowSelection = table.getState().rowSelection ?? {};
  const rows = table.getRowModel().rows;
  let count = 0;

  for (const row of rows) {
    if (rowSelection[row.id]) {
      count += 1;
    }
  }

  return count;
}
