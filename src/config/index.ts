export { env } from './env';
export {
  DATA_TABLE_VIRTUAL_PRESET,
  dataTableConfig,
  isBrowserSupportedForVirtualization,
  isProductTableVirtualizationEnabled
} from './data-table';
export type { DataTableConfig } from './data-table';
export { isWorkspaceTabsEnabled, MAX_KEEPALIVE_TABS } from './workspace-tabs';

export const baseConfig = {
  projectName: '业务跟进工作台'
} as const;
