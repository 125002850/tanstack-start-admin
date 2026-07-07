/**
 * DataTable 列 DSL 的对外聚合入口。
 *
 * 新代码优先从分层路径导入；该文件保留统一入口，方便业务模块一次性拿到
 * createDataTableColumnDsl、内置 formatter 和 header/text cell 工具。
 */
export { createDataTableColumnDsl } from '@/components/ui/table/columns/data-table-column-builders';
export {
  dataTableColumnFormatters,
  type DataTableFieldFormatterRule
} from '@/components/ui/table/columns/data-table-column-formatters';
export {
  dataTableHeader,
  dataTableHeaderFactory,
  dataTableTextCell
} from '@/components/ui/table/columns/data-table-column-rendering';
