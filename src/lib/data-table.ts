import type { FilterOperator, FilterVariant } from '@/types/data-table';
import type { Column, Table } from '@tanstack/react-table';

import { dataTableConfig } from '@/config/data-table';

/**
 * DataTable UI 层通用工具。
 *
 * 包含固定列阴影、sticky 样式、筛选操作符映射和“当前页选中行”读取。
 */
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

/** 固定列边界阴影的伪层样式，覆盖在单元格边缘外侧。 */
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

/** 只在固定区域边界列绘制阴影；内部固定列不重复绘制。 */
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

/** 固定列的公共 sticky 样式；普通列不写 width，交给 colgroup/table-layout 控制。 */
export function getCommonPinningStyles<TData>({
  column
}: {
  column: Column<TData>;
}): React.CSSProperties {
  const isPinned = column.getIsPinned();

  // 固定列需要显式 width + sticky，TanStack 才能正确计算左右偏移。
  // 非固定列依赖 <colgroup> + table-layout: fixed；这里写 width 会和 border-box 计算冲突。
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

/** 根据筛选控件类型返回高级筛选操作符集合。 */
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

/** 返回当前 rowModel 中被选中的业务行；服务端分页下只代表当前已加载页。 */
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

/** 只统计当前 rowModel 的选中数量，避免 rowSelection 中残留跨页/旧页 id 影响展示。 */
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
