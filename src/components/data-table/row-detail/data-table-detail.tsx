import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useDataTable } from '@/hooks/use-data-table';
import type { DataTableRowId } from '@/hooks/use-data-table/types';
import type { DataTableRowAction } from '../actions/types';
import { DataTableContent } from '../core/data-table-content';

/** 明细沿用列 DSL，只保留展示、复制和行操作，不携带主表查询与列管理能力。 */
export function DataTableDetail<TData>({
  tableId,
  data,
  columns,
  rowId,
  rowActions,
  label
}: {
  tableId: string;
  data: TData[];
  columns: ColumnDef<TData>[];
  rowId: DataTableRowId<TData>;
  rowActions?: DataTableRowAction<TData>[];
  label: string;
}) {
  const detailColumns = useMemo(() => {
    const simplify = (column: ColumnDef<TData>): ColumnDef<TData> => ({
      ...column,
      enableSorting: false,
      enableColumnFilter: false,
      enableResizing: false,
      enableHiding: false,
      meta: { ...column.meta, localFilter: undefined },
      ...('columns' in column && column.columns ? { columns: column.columns.map(simplify) } : {})
    });
    return columns.map(simplify);
  }, [columns]);
  const { table } = useDataTable({
    tableId,
    data,
    columns: detailColumns,
    rowId,
    rowActions,
    showRowNumberColumn: false,
    enableSorting: false,
    columnResizeStorage: false,
    columnOrderStorage: false,
    sortingStorage: false
  });
  return (
    <div data-slot='data-table-detail' className='min-w-0 border-l-2 border-border/60 pl-3'>
      <DataTableContent table={table} label={label} />
    </div>
  );
}
