import type { Table } from '@tanstack/react-table';
import * as React from 'react';
import { Icons } from '@/components/icons';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { getPageSelectionTotalRowCount, getSelectedPageRowCount } from '@/lib/data-table/selection';
import { DATA_TABLE_PAGE_SIZE_OPTIONS } from '@/lib/data-table/state-persistence';
import { cn } from '@/lib/utils';

/**
 * DataTable 底部分页栏。
 *
 * 该组件直接操作 TanStack table 的 pagination API，并把“当前页选择数”和“总条数”
 * 分开处理，避免服务端分页场景下把当前页 rows.length 误当作全量总数。
 */
export interface DataTablePaginationLabels {
  selectedRowsText?: (selectedCount: number, totalCount: number) => string;
  totalRowsText?: (totalCount: number) => string;
  rowsPerPage?: string;
  pageText?: (page: number, totalPages: number) => string;
  goToPage?: string;
  pageInputHint?: string;
  goToFirstPage?: string;
  goToPreviousPage?: string;
  goToNextPage?: string;
  goToLastPage?: string;
}

interface DataTablePaginationProps<TData> extends React.ComponentProps<'div'> {
  table: Table<TData>;
  getSelectedRows?: () => TData[];
  selectedRowCount?: number;
  selectedTotalRowCount?: number;
  pageSizeOptions?: readonly number[];
  labels?: DataTablePaginationLabels;
}

export function DataTablePagination<TData>({
  table,
  getSelectedRows,
  selectedRowCount,
  selectedTotalRowCount,
  pageSizeOptions = DATA_TABLE_PAGE_SIZE_OPTIONS,
  labels,
  className,
  ...props
}: DataTablePaginationProps<TData>) {
  // 文案全部支持外部覆盖，默认值保持中文后台语境。
  const selectedRowsText =
    labels?.selectedRowsText ??
    ((selectedCount: number, totalCount: number) => `已选择 ${selectedCount} / ${totalCount} 行`);
  const totalRowsText =
    labels?.totalRowsText ?? ((totalCount: number) => `共 ${totalCount} 条数据`);
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const currentPage = pageCount === 0 ? 0 : pageIndex + 1;
  const [editingPage, setEditingPage] = React.useState(false);
  const focusPageInput = React.useCallback((input: HTMLInputElement | null) => {
    input?.focus();
    input?.select();
  }, []);
  const [pageInput, setPageInput] = React.useState(String(currentPage));

  React.useEffect(() => {
    setPageInput(String(currentPage));
    setEditingPage(false);
  }, [currentPage, pageCount, pageSize]);

  const resetPageInput = () => {
    setPageInput(String(currentPage));
    setEditingPage(false);
  };
  const submitPageInput = () => {
    const value = pageInput.trim();
    const page = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(page) || pageCount <= 1) {
      resetPageInput();
      return;
    }
    const nextPage = Math.min(pageCount, Math.max(1, page));
    setPageInput(String(nextPage));
    setEditingPage(false);
    if (nextPage !== currentPage) table.setPageIndex(nextPage - 1);
  };
  // selectedRowCount 一旦受控，选择分母使用 table 持有的全量 rowCount。
  const isSelectedRowCountControlled = selectedRowCount !== undefined;
  const resolvedSelectedRowCount =
    selectedRowCount ??
    (getSelectedRows ? getSelectedRows().length : getSelectedPageRowCount(table));
  const resolvedSelectedTotalRowCount =
    selectedTotalRowCount ??
    (table.options.meta?.dataTableTree
      ? getPageSelectionTotalRowCount(table)
      : isSelectedRowCountControlled
        ? table.getRowCount()
        : table.getRowModel().rows.length);
  const resolvedTotalRowCount = table.getRowCount();

  return (
    <div
      className={cn(
        'flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-8',
        className
      )}
      {...props}
    >
      <div className='text-muted-foreground flex-1 text-sm whitespace-nowrap'>
        {resolvedSelectedRowCount > 0 ? (
          <>{selectedRowsText(resolvedSelectedRowCount, resolvedSelectedTotalRowCount)}</>
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
              // pageSize 变化会通过 useDataTable/useTableState 同步到持久化层。
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
        <div className='flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap'>
          {editingPage && pageCount > 1 ? (
            <>
              <span>第</span>
              <Input
                ref={focusPageInput}
                aria-label={labels?.goToPage ?? '跳转页码'}
                title={labels?.pageInputHint ?? '输入页码，失焦或 Enter 跳转，Esc 取消'}
                className='h-8 w-14 px-1 text-center tabular-nums'
                inputMode='numeric'
                autoComplete='off'
                disabled={pageCount <= 1}
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                onBlur={submitPageInput}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    event.stopPropagation();
                    submitPageInput();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    resetPageInput();
                  }
                }}
              />
              <span>/ {pageCount} 页</span>
            </>
          ) : pageCount > 1 ? (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='h-8 tabular-nums'
              aria-label={labels?.goToPage ?? '跳转页码'}
              onClick={() => {
                setPageInput(String(currentPage));
                setEditingPage(true);
              }}
            >
              {labels?.pageText?.(currentPage, pageCount) ?? `第 ${currentPage} / ${pageCount} 页`}
            </Button>
          ) : (
            <span className='flex h-8 items-center tabular-nums'>
              {labels?.pageText?.(currentPage, pageCount) ?? `第 ${currentPage} / ${pageCount} 页`}
            </span>
          )}
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
            <Icons.chevronLeft />
          </Button>
          <Button
            aria-label={labels?.goToNextPage ?? '前往下一页'}
            variant='outline'
            size='icon'
            className='size-8'
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <Icons.chevronRight />
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
