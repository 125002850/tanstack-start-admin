/**
 * 兼容旧的物理导入路径。
 * 运行中的 Vite dev server 可能仍会请求 `/src/hooks/use-data-table.ts`，
 * 这里保留一层薄转发，避免目录重构后出现 404。
 */
export { useDataTable, makeApiFilters } from './use-data-table/index';
export type { UseDataTableProps, ApiFilters } from './use-data-table/types';
