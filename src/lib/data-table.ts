import type { FilterOperator, FilterVariant } from '@/types/data-table';
import type { Column, Table } from '@tanstack/react-table';

import { dataTableConfig } from '@/config/data-table';

const DATA_TABLE_PINNED_SHADOW_COLOR =
  'var(--data-table-pinned-shadow-color, color-mix(in oklch, var(--foreground) 8%, transparent))';
const DATA_TABLE_PINNED_SHADOW_SOFT_COLOR =
  'var(--data-table-pinned-shadow-soft-color, color-mix(in oklch, var(--foreground) 3%, transparent))';
const DATA_TABLE_PINNED_SHADOW_GRADIENT_COLOR =
  'var(--data-table-pinned-shadow-gradient-color, color-mix(in oklch, var(--foreground) 3.5%, transparent))';
const DATA_TABLE_PINNED_SHADOW_LAYER_WIDTH = 18;

export const DATA_TABLE_PINNED_SHADOWS = {
  left: `8px 0 16px -15px ${DATA_TABLE_PINNED_SHADOW_COLOR}, 18px 0 28px -26px ${DATA_TABLE_PINNED_SHADOW_SOFT_COLOR}`,
  right: `-8px 0 16px -15px ${DATA_TABLE_PINNED_SHADOW_COLOR}, -18px 0 28px -26px ${DATA_TABLE_PINNED_SHADOW_SOFT_COLOR}`
} as const;

export function getColumnPinningShadowOverlayStyle(edge: 'left' | 'right'): React.CSSProperties {
  return edge === 'right'
    ? {
        right: -DATA_TABLE_PINNED_SHADOW_LAYER_WIDTH,
        width: DATA_TABLE_PINNED_SHADOW_LAYER_WIDTH,
        background: `linear-gradient(to right, ${DATA_TABLE_PINNED_SHADOW_GRADIENT_COLOR} 0%, transparent 78%)`
      }
    : {
        left: -DATA_TABLE_PINNED_SHADOW_LAYER_WIDTH,
        width: DATA_TABLE_PINNED_SHADOW_LAYER_WIDTH,
        background: `linear-gradient(to left, ${DATA_TABLE_PINNED_SHADOW_GRADIENT_COLOR} 0%, transparent 78%)`
      };
}

export function getColumnPinningShadow<TData>({
  column
}: {
  column: Column<TData>;
}): string | undefined {
  const isPinned = column.getIsPinned();
  if (!isPinned) {
    return undefined;
  }

  const customShadow = column.columnDef.meta?.pinningShadow?.[isPinned];
  if (customShadow) {
    return customShadow;
  }

  if (isPinned === 'left' && column.getIsLastColumn('left')) {
    return DATA_TABLE_PINNED_SHADOWS.left;
  }

  if (isPinned === 'right' && column.getIsFirstColumn('right')) {
    return DATA_TABLE_PINNED_SHADOWS.right;
  }

  return undefined;
}

export function getCommonPinningStyles<TData>({
  column
}: {
  column: Column<TData>;
}): React.CSSProperties {
  const isPinned = column.getIsPinned();

  // Pinned columns need explicit width + sticky positioning for the pinning
  // offset calculations. Non-pinned cells rely on <colgroup> + table-layout:fixed
  // for column widths — setting width here would conflict with border-box sizing.
  if (isPinned) {
    return {
      boxShadow: getColumnPinningShadow({ column }),
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
