import type { Table } from '@tanstack/react-table';

/** 返回当前 rowModel 中被选中的业务行；服务端分页下只代表当前已加载页。 */
export function getSelectedPageRows<TData>(table: Table<TData>): TData[] {
  const rowSelection = table.getState().rowSelection ?? {};
  const rows = table.getRowModel().rows;

  if (rows.length === 0) {
    return [];
  }

  const selectedRows: TData[] = [];

  for (const row of rows) {
    if (rowSelection[row.id]) {
      selectedRows.push(row.original);
    }
  }

  return selectedRows;
}

/** 只统计当前 rowModel 的选中数量，避免 rowSelection 中残留跨页/旧页 id 影响展示。 */
export function getSelectedPageRowCount<TData>(table: Table<TData>): number {
  const rowSelection = table.getState().rowSelection ?? {};
  const rows = table.getRowModel().rows;
  let count = 0;

  for (const row of rows) {
    if (rowSelection[row.id]) {
      count += 1;
    }
  }

  return count;
}
