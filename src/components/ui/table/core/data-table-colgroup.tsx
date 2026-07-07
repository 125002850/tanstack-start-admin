import type { Column } from '@tanstack/react-table';

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
