export { env } from './env';
export {
  DATA_TABLE_DATE_DISPLAY_FORMAT,
  DATA_TABLE_DATE_TIME_DISPLAY_FORMAT,
  DATA_TABLE_ROW_HEIGHT_PX,
  DATA_TABLE_VIRTUAL_PRESET,
  dataTableColumnSizes,
  dataTableConfig,
  isBrowserSupportedForVirtualization,
  isDataTableVirtualizationEnabled,
  resolveDataTableColumnSize,
  resolveDataTableVirtualizationOptions
} from './data-table';
export type { DataTableColumnSize, DataTableColumnSizePreset, DataTableConfig } from './data-table';
export {
  dataTableMessages,
  dataTableZhCnMessages,
  type DataTableMessageCatalog
} from './data-table-messages';
export { isWorkspaceTabsEnabled, MAX_KEEPALIVE_TABS } from './workspace-tabs';

export const baseConfig = {
  projectName: '后台管理框架'
} as const;
