import type { Column } from '@tanstack/react-table';

/**
 * 普通表格路径的 colgroup。
 *
 * 在未启用列虚拟化时，列宽交给 colgroup + table-layout: fixed 控制；启用列虚拟化时
 * 中间列脱离完整 colgroup，由 header/cell 自己写入宽度。
 */
interface DataTableColGroupProps<TData> {
  columns: Column<TData, unknown>[];
}

export function DataTableColGroup<TData>({ columns }: DataTableColGroupProps<TData>) {
  return (
    <colgroup>
      {columns.map((column) => (
        <col key={column.id} style={{ width: column.getSize() }} />
      ))}
    </colgroup>
  );
}
