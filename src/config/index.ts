export { env } from './env';
export {
  DATA_TABLE_VIRTUAL_PRESET,
  dataTableColumnSizes,
  dataTableConfig,
  isBrowserSupportedForVirtualization,
  isDataTableVirtualizationEnabled,
  resolveDataTableColumnSize,
  resolveDataTableVirtualizationOptions,
  isProductTableVirtualizationEnabled
} from './data-table';
export type { DataTableColumnSize, DataTableColumnSizePreset, DataTableConfig } from './data-table';
export { isWorkspaceTabsEnabled, MAX_KEEPALIVE_TABS } from './workspace-tabs';

export const baseConfig = {
  projectName: '后台管理框架'
} as const;
