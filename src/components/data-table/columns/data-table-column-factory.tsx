/**
 * DataTable 列 DSL 的对外聚合入口。
 *
 * 业务代码统一从本文件导入；DataTable 内部实现再按 dsl、header、editing 分层路径导入，
 * 避免 feature 穿透到不稳定的实现模块。
 */
export { createDataTableColumnDsl } from '@/components/data-table/columns/dsl/data-table-column-builders';
export { percentPoints } from '@/components/data-table/editing/data-table-edit-adapters';
export { dataTableTextCell } from '@/components/data-table/cells/data-table-text-cell';
export {
  dataTableColumnFormatters,
  type DataTableFieldFormatterRule
} from '@/components/data-table/columns/dsl/data-table-column-formatters';
export {
  dataTableHeader,
  dataTableHeaderFactory
} from '@/components/data-table/columns/dsl/data-table-column-rendering';
