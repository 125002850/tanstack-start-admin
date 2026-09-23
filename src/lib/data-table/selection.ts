import type { Row, Table } from '@tanstack/react-table';

/** 树表选择覆盖本页已加载且筛选后保留的节点，折叠不改变选择范围。 */
function getPageSelectionRows<TData>(table: Table<TData>): Row<TData>[] {
  return table.options.meta?.dataTableTree
    ? table.getPreExpandedRowModel().flatRows.filter((row) => row.getCanSelect())
    : table.getRowModel().rows;
}

/** 当前页可执行选择的节点；树表包含折叠子节点，平表保持可见行范围。 */
export function getPageSelectableRows<TData>(table: Table<TData>): Row<TData>[] {
  const rows = getPageSelectionRows(table);
  return table.options.meta?.dataTableTree ? rows : rows.filter((row) => row.getCanSelect());
}

/** 选择摘要的分母；平表保留原有本页行数，树表只统计可选择的节点。 */
export function getPageSelectionTotalRowCount<TData>(table: Table<TData>): number {
  return getPageSelectionRows(table).length;
}

function getSelectedPageTableRows<TData>(table: Table<TData>): Row<TData>[] {
  const rowSelection = table.getState().rowSelection ?? {};
  return getPageSelectionRows(table).filter((row) => rowSelection[row.id]);
}

/** 返回本页被选中的业务行；树表中收起节点不会移除已选子行。 */
export function getSelectedPageRows<TData>(table: Table<TData>): TData[] {
  return getSelectedPageTableRows(table).map((row) => row.original);
}

/** 与业务行结果使用相同范围，避免 ID、数量和批量操作对象不一致。 */
export function getSelectedPageRowIds<TData>(table: Table<TData>): string[] {
  return getSelectedPageTableRows(table).map((row) => row.id);
}

/** 忽略其他页、已筛除和不可选树节点的残留选择。 */
export function getSelectedPageRowCount<TData>(table: Table<TData>): number {
  return getSelectedPageTableRows(table).length;
}
