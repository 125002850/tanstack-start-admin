import type { ColumnDef } from '@tanstack/react-table';

/** 展开入口必须是唯一的业务叶子列，且不能被隐藏。 */
export function resolveRowDetailColumns<TData>(columns: ColumnDef<TData>[], columnId: string) {
  let matches = 0;
  const visit = (column: ColumnDef<TData>): ColumnDef<TData> => {
    if ('columns' in column && column.columns)
      return { ...column, columns: column.columns.map(visit) };
    const id =
      column.id ??
      ('accessorKey' in column ? String(column.accessorKey).replaceAll('.', '_') : undefined);
    if (id !== columnId) return column;
    matches++;
    return { ...column, enableHiding: false };
  };
  const result = columns.map(visit);
  if (matches !== 1 || ['select', 'actions', '__rowNumber'].includes(columnId)) {
    throw new Error('rowDetail.columnId 必须指向唯一业务叶子列');
  }
  return result;
}
