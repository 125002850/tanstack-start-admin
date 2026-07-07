import type { DataTableColumnResolvedDefaults } from '@/components/ui/table/columns/data-table-column-options';

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
