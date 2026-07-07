import type { DataTableColumnResolvedDefaults } from '@/components/ui/table/columns/data-table-column-options';

/**
 * DataTable DSL 各类列的默认行为。
 *
 * 这些默认值最终会被 resolveDataTableColumnOptions 合并进 TanStack ColumnDef；
 * 业务列默认可在列面板显示/排序，操作列默认固定尺寸且不参与筛选、隐藏或拖拽。
 */
export const FIELD_COLUMN_DEFAULTS = {
  enableSorting: false,
  columnPanelVisible: true,
  columnPanelReorder: true
} satisfies DataTableColumnResolvedDefaults;

export const BADGE_COLUMN_DEFAULTS = {
  size: 120,
  minSize: 96,
  enableSorting: false,
  columnPanelVisible: true,
  columnPanelReorder: true
} satisfies DataTableColumnResolvedDefaults;

export const CUSTOM_COLUMN_DEFAULTS = {
  size: 160,
  minSize: 80,
  enableSorting: false,
  columnPanelVisible: true,
  columnPanelReorder: true
} satisfies DataTableColumnResolvedDefaults;

export const ACTIONS_COLUMN_DEFAULTS = {
  size: 96,
  minSize: 72,
  maxSize: 160,
  enableSorting: false,
  enableHiding: false,
  enableResizing: false,
  enableColumnFilter: false,
  columnPanelVisible: false,
  columnPanelReorder: false
} satisfies DataTableColumnResolvedDefaults;
