import type { Table } from '@tanstack/react-table';
import { Icons } from '@/components/icons';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { DATA_TABLE_PAGE_SIZE_OPTIONS } from '@/lib/data-table-page-size';
import { cn } from '@/lib/utils';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';

export interface DataTablePaginationLabels {
  selectedRowsText?: (selectedCount: number, totalCount: number) => string;
  totalRowsText?: (totalCount: number) => string;
  rowsPerPage?: string;
  pageText?: (page: number, totalPages: number) => string;
  goToFirstPage?: string;
  goToPreviousPage?: string;
  goToNextPage?: string;
  goToLastPage?: string;
}

interface DataTablePaginationProps<TData> extends React.ComponentProps<'div'> {
  table: Table<TData>;
  getSelectedRows?: () => TData[];
  pageSizeOptions?: readonly number[];
  totalRowCount?: number;
  labels?: DataTablePaginationLabels;
}

export function DataTablePagination<TData>({
  table,
  getSelectedRows,
  pageSizeOptions = DATA_TABLE_PAGE_SIZE_OPTIONS,
  totalRowCount,
  labels,
  className,
  ...props
}: DataTablePaginationProps<TData>) {
  const selectedRowsText =
    labels?.selectedRowsText ??
    ((selectedCount: number, totalCount: number) => `已选择 ${selectedCount} / ${totalCount} 行`);
  const totalRowsText =
    labels?.totalRowsText ?? ((totalCount: number) => `共 ${totalCount} 条数据`);
  const pageText =
    labels?.pageText ?? ((page: number, totalPages: number) => `第 ${page} / ${totalPages} 页`);
  const selectedRowCount = getSelectedRows
    ? getSelectedRows().length
    : table.getFilteredSelectedRowModel().rows.length;
  const resolvedTotalRowCount = totalRowCount ?? table.getFilteredRowModel().rows.length;

  return (
    <div
      className={cn(
        'flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-8',
        className
      )}
      {...props}
    >
      <div className='text-muted-foreground flex-1 text-sm whitespace-nowrap'>
        {selectedRowCount > 0 ? (
          <>{selectedRowsText(selectedRowCount, resolvedTotalRowCount)}</>
        ) : (
          <>{totalRowsText(resolvedTotalRowCount)}</>
        )}
      </div>
      <div className='flex flex-col-reverse items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8'>
        <div className='flex items-center space-x-2'>
          <p className='text-sm font-medium whitespace-nowrap'>
            {labels?.rowsPerPage ?? '每页条数'}
          </p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className='h-8 min-w-[4.5rem] [&[data-size]]:h-8'>
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side='top'>
              {pageSizeOptions.map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='flex items-center justify-center text-sm font-medium'>
          {pageText(table.getState().pagination.pageIndex + 1, table.getPageCount())}
        </div>
        <div className='flex items-center space-x-2'>
          <Button
            aria-label={labels?.goToFirstPage ?? '前往第一页'}
            variant='outline'
            size='icon'
            className='hidden size-8 lg:flex'
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <Icons.chevronsLeft />
          </Button>
          <Button
            aria-label={labels?.goToPreviousPage ?? '前往上一页'}
            variant='outline'
            size='icon'
            className='size-8'
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            aria-label={labels?.goToNextPage ?? '前往下一页'}
            variant='outline'
            size='icon'
            className='size-8'
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            aria-label={labels?.goToLastPage ?? '前往最后一页'}
            variant='outline'
            size='icon'
            className='hidden size-8 lg:flex'
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <Icons.chevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
