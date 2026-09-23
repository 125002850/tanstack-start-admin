import type { Row, Table } from '@tanstack/react-table';
import { TableCell, TableRow } from '@/components/ui/table';
import { rowDetailId } from './data-table-row-detail-trigger';

export function DataTableRowDetail<TData>({
  row,
  table
}: {
  row: Row<TData>;
  table: Table<TData>;
}) {
  const config = table.options.meta?.dataTableRowDetail;
  if (!config || !row.getCanExpand() || !row.getIsExpanded()) return null;
  return (
    <TableRow data-slot='data-table-row-detail' className='hover:bg-transparent'>
      <TableCell colSpan={table.getVisibleLeafColumns().length} className='whitespace-normal p-0'>
        <div
          className='sticky left-0 box-border min-w-0 py-2 pr-3 pl-8'
          style={{ width: 'var(--data-table-detail-viewport-width, 100%)', maxWidth: '100%' }}
          id={rowDetailId(table.options.meta?.dataTableInstanceId ?? '', row.id)}
        >
          {config.render({ row })}
        </div>
      </TableCell>
    </TableRow>
  );
}
