import { type Table as TanstackTable, flexRender } from '@tanstack/react-table';
import type * as React from 'react';
import { useRef } from 'react';

import {
  DataTablePagination,
  type DataTablePaginationLabels
} from '@/components/ui/table/data-table-pagination';
import { Table, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getCommonPinningStyles } from '@/lib/data-table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DataTableBody } from '@/components/ui/table/data-table-body';
import { Separator } from '@/components/ui/separator';
import { DataTableViewOptions } from '@/components/ui/table/data-table-view-options';
import { DataTableColumnResizeHandle } from './data-table-column-resize-handle';
import type { DataTableVirtualizationOptions } from '@/types/data-table';
import { DATA_TABLE_VIRTUAL_PRESET } from '@/config/data-table';
import {
  DataTableActionsBar,
  type DataTableAction
} from '@/components/ui/table/data-table-actions-bar';

interface DataTableProps<TData> extends React.ComponentProps<'div'> {
  table: TanstackTable<TData>;
  tableActions?: DataTableAction<TData>[];
  actionBar?: React.ReactNode;
  scrollTargetId?: string;
  emptyMessage?: string;
  paginationLabels?: DataTablePaginationLabels;
  virtualization?: DataTableVirtualizationOptions | boolean;
}

export function DataTable<TData>({
  table,
  tableActions,
  actionBar,
  children,
  scrollTargetId,
  emptyMessage = '暂无数据',
  paginationLabels,
  virtualization
}: DataTableProps<TData>) {
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  // Support virtualization={true} shorthand → shared preset
  const virtConfig: DataTableVirtualizationOptions | undefined =
    virtualization === true
      ? { enabled: true }
      : virtualization === false || virtualization === undefined
        ? undefined
        : virtualization;

  const shouldVirtualize =
    virtConfig?.enabled === true &&
    table.getRowModel().rows.length >=
      (virtConfig.rowCountThreshold ?? DATA_TABLE_VIRTUAL_PRESET.rowCountThreshold);
  const resolvedTableWidth = table.getTotalSize();
  const orderedLeafColumns = [
    ...table.getLeftVisibleLeafColumns(),
    ...table.getCenterVisibleLeafColumns(),
    ...table.getRightVisibleLeafColumns()
  ];
  const colgroup = (
    <colgroup>
      {orderedLeafColumns.map((col) => (
        <col key={col.id} style={{ width: col.getSize() }} />
      ))}
    </colgroup>
  );

  const ariaRowCount = shouldVirtualize ? table.getRowModel().rows.length + 1 : undefined;
  const hasViewOptions = table
    .getAllColumns()
    .some((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide());

  // Ref to the thead row — DataTableBody measures its children for actual
  // column widths (table-layout:fixed distributes extra space) and uses
  // those measurements for virtualized cells that sit outside the table flow.
  const headerRowRef = useRef<HTMLTableRowElement>(null);

  return (
    <div className='flex flex-1 flex-col space-y-4'>
      {(children || tableActions || hasViewOptions) && (
        <div className='flex flex-col'>
          {children && <div>{children}</div>}
          {children && (tableActions || hasViewOptions) && (
            <Separator className='my-2 ml-[calc(var(--page-container-padding-x,0rem)*-1)] data-[orientation=horizontal]:!w-[calc(100%+var(--page-container-padding-x,0rem)*2)]' />
          )}
          {(tableActions || hasViewOptions) && (
            <div className='flex items-center gap-2 px-1'>
              {tableActions && <DataTableActionsBar table={table} actions={tableActions} />}
              {hasViewOptions && (
                <DataTableViewOptions table={table} iconOnly className='ml-auto' />
              )}
            </div>
          )}
        </div>
      )}
      <div className='relative flex flex-1 min-h-0'>
        <div
          data-table-resize-overlay-root
          className='absolute inset-0 flex overflow-hidden rounded-lg'
        >
          <ScrollArea
            className='h-full'
            viewportRef={scrollViewportRef}
            viewportProps={
              scrollTargetId
                ? {
                    'data-scroll-target-id': scrollTargetId
                  }
                : undefined
            }
          >
            <Table
              aria-rowcount={ariaRowCount}
              style={{ tableLayout: 'fixed', width: resolvedTableWidth }}
            >
              {colgroup}
              <TableHeader className='bg-muted sticky top-0 z-10'>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} ref={headerRowRef}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        style={{
                          ...getCommonPinningStyles({ column: header.column }),
                          // Pinned header cells use --muted to match the bg-muted row.
                          // Body pinned cells keep --background via getCommonPinningStyles.
                          ...(header.column.getIsPinned() ? { background: 'var(--muted)' } : {})
                        }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        <DataTableColumnResizeHandle header={header} />
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <DataTableBody
                table={table}
                emptyMessage={emptyMessage}
                virtualization={virtConfig}
                scrollViewportRef={scrollViewportRef}
                headerRowRef={headerRowRef}
              />
            </Table>
          </ScrollArea>
        </div>
      </div>
      <div className='flex flex-col gap-2.5'>
        <DataTablePagination table={table} labels={paginationLabels} />
        {actionBar && table.getFilteredSelectedRowModel().rows.length > 0 && actionBar}
      </div>
    </div>
  );
}
