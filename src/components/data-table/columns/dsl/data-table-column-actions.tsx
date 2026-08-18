import type { Row } from '@tanstack/react-table';

import { DataTableRowActions } from '@/components/data-table/actions/data-table-row-action';
import type { DataTableRowAction } from '@/components/data-table/actions/types';

/**
 * 使用统一的 DataTableRowAction 契约渲染 DSL 操作列。
 * columnDsl.actions 和 useDataTable.rowActions 只负责不同的列装配方式，不再转换业务回调。
 */
export function renderDataTableActionsCell<TData>(
  row: Row<TData>,
  actions: Array<DataTableRowAction<TData>>
) {
  return <DataTableRowActions row={row.original} actions={actions} />;
}
