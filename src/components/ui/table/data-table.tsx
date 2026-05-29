import { type Table as TanstackTable, flexRender } from '@tanstack/react-table';
import type * as React from 'react';
import { useRef } from 'react';

import {
  DataTablePagination,
  type DataTablePaginationLabels
} from '@/components/ui/table/data-table-pagination';
import {
  Table,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { getCommonPinningStyles } from '@/lib/data-table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DataTableBody } from '@/components/ui/table/data-table-body';
import { DataTableColumnResizeHandle } from './data-table-column-resize-handle';
import type { DataTableVirtualizationOptions } from '@/types/data-table';
import { DATA_TABLE_VIRTUAL_PRESET } from '@/config/data-table';
import {
  DataTableActionsBar,
  type DataTableAction,
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
  virtualization,
}: DataTableProps<TData>) {
  const scrollViewportRef = useRef<HTMLDivElement>(null)

  // Support virtualization={true} shorthand → shared preset
  const virtConfig: DataTableVirtualizationOptions | undefined =
    virtualization === true
      ? { enabled: true }
      : virtualization === false || virtualization === undefined
        ? undefined
        : virtualization

  const shouldVirtualize =
    virtConfig?.enabled === true &&
    table.getRowModel().rows.length >= (virtConfig.rowCountThreshold ?? DATA_TABLE_VIRTUAL_PRESET.rowCountThreshold)

  const colgroup = (
    <colgroup>
      {table.getAllLeafColumns().map((col) => (
        <col key={col.id} style={{ width: col.getSize() }} />
      ))}
    </colgroup>
  )

  const ariaRowCount =
    shouldVirtualize ? table.getRowModel().rows.length + 1 : undefined

  // Ref to the thead row — DataTableBody measures its children for actual
  // column widths (table-layout:fixed distributes extra space) and uses
  // those measurements for virtualized cells that sit outside the table flow.
  const headerRowRef = useRef<HTMLTableRowElement>(null)

  return (
    <div className='flex flex-1 flex-col space-y-4'>
      {children}
      {tableActions && <DataTableActionsBar table={table} actions={tableActions} />}
      <div className='relative flex flex-1 min-h-0'>
        <div className='absolute inset-0 flex overflow-hidden rounded-lg border'>
          <ScrollArea
            className='h-full w-full'
            viewportRef={scrollViewportRef}
            viewportProps={
              scrollTargetId
                ? {
                    'data-scroll-target-id': scrollTargetId
                  }
                : undefined
            }
          >
            <Table aria-rowcount={ariaRowCount} style={{ tableLayout: 'fixed' }}>
              {colgroup}
              <TableHeader className='bg-muted sticky top-0 z-10'>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} ref={headerRowRef}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        style={{
                          ...getCommonPinningStyles({ column: header.column })
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
