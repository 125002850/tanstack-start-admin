import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * DataTable 加载骨架屏。
 *
 * 外形尽量贴近真实 DataTable：筛选区、显示列按钮、表头、表体和分页栏都可按需开启。
 * DataTable 主组件会根据真实列数/筛选数自动推导参数，调用方也可显式覆盖。
 */
export interface DataTableSkeletonProps extends React.ComponentProps<'div'> {
  columnCount: number;
  rowCount?: number;
  filterCount?: number;
  cellWidths?: string[];
  withViewOptions?: boolean;
  withPagination?: boolean;
  shrinkZero?: boolean;
}

export function DataTableSkeleton({
  columnCount,
  rowCount = 10,
  filterCount = 0,
  cellWidths = ['auto'],
  withViewOptions = true,
  withPagination = true,
  shrinkZero = false,
  className,
  ...props
}: DataTableSkeletonProps) {
  // cellWidths 可传少量模板宽度，这里按列数循环展开，便于制造更自然的占位宽度。
  const cozyCellWidths = Array.from(
    { length: columnCount },
    (_, index) => cellWidths[index % cellWidths.length] ?? 'auto'
  );

  return (
    <div
      data-slot='data-table-skeleton'
      className={cn('flex flex-1 flex-col gap-4', className)}
      {...props}
    >
      <div className='flex w-full items-center justify-between gap-2 overflow-auto p-1'>
        <div className='flex flex-1 items-center gap-2'>
          {filterCount > 0
            ? Array.from({ length: filterCount }).map((_, i) => (
                <Skeleton
                  key={i}
                  data-slot='data-table-skeleton-filter'
                  className='h-7 w-[4.5rem] border-dashed'
                />
              ))
            : null}
        </div>
        {withViewOptions ? (
          <Skeleton
            data-slot='data-table-skeleton-view-options'
            className='ml-auto hidden h-7 w-[4.5rem] lg:flex'
          />
        ) : null}
      </div>

      <div data-slot='data-table-skeleton-table' className='flex-1 rounded-md border'>
        <Table>
          <TableHeader>
            {Array.from({ length: 1 }).map((_, i) => (
              <TableRow key={i} className='hover:bg-transparent'>
                {Array.from({ length: columnCount }).map((_, j) => (
                  <TableHead
                    key={j}
                    style={{
                      width: cozyCellWidths[j],
                      minWidth: shrinkZero ? cozyCellWidths[j] : 'auto'
                    }}
                  >
                    <Skeleton className='h-6 w-full' />
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {Array.from({ length: rowCount }).map((_, i) => (
              <TableRow key={i} className='hover:bg-transparent'>
                {Array.from({ length: columnCount }).map((_, j) => (
                  <TableCell
                    key={j}
                    style={{
                      width: cozyCellWidths[j],
                      minWidth: shrinkZero ? cozyCellWidths[j] : 'auto'
                    }}
                  >
                    <Skeleton className='h-6 w-full' />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {withPagination ? (
        <div
          data-slot='data-table-skeleton-pagination'
          className='flex w-full items-center justify-between gap-4 overflow-auto p-1 sm:gap-8'
        >
          <Skeleton className='h-7 w-40 shrink-0' />
          <div className='flex items-center gap-4 sm:gap-6 lg:gap-8'>
            <div className='flex items-center gap-2'>
              <Skeleton className='h-7 w-24' />
              <Skeleton className='h-7 w-[4.5rem]' />
            </div>
            <div className='flex items-center justify-center text-sm font-medium'>
              <Skeleton className='h-7 w-20' />
            </div>
            <div className='flex items-center gap-2'>
              <Skeleton className='hidden size-7 lg:block' />
              <Skeleton className='size-7' />
              <Skeleton className='size-7' />
              <Skeleton className='hidden size-7 lg:block' />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
