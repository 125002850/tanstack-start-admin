import type { Column, Table } from '@tanstack/react-table';
import { Icons } from '@/components/icons';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { DataTableOverflowTooltipText } from '@/components/ui/table/cells/data-table-overflow-tooltip-text';
import { DataTableLocalFilter } from '@/components/ui/table/filters/data-table-local-filter';
import { cn } from '@/lib/utils';

/**
 * 标准 DataTable 列头。
 *
 * 当列可排序或可隐藏时渲染 DropdownMenu；否则只渲染带溢出 Tooltip 的纯文本表头。
 * 排序状态直接调用 TanStack column API，隐藏列通过列面板/列头菜单共用同一状态。
 */
export interface DataTableColumnHeaderLabels {
  ascText?: string;
  descText?: string;
  resetText?: string;
  hideText?: string;
}

interface DataTableColumnHeaderProps<TData, TValue> extends React.ComponentProps<
  typeof DropdownMenuTrigger
> {
  column: Column<TData, TValue>;
  table?: Table<TData>;
  title: string;
  labels?: DataTableColumnHeaderLabels;
}

function renderSortIcon(sortDirection: false | 'asc' | 'desc') {
  if (sortDirection === 'desc') {
    return <Icons.chevronDown />;
  }

  if (sortDirection === 'asc') {
    return <Icons.chevronUp />;
  }

  return <Icons.chevronsUpDown />;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  table,
  title,
  className,
  labels,
  ...props
}: DataTableColumnHeaderProps<TData, TValue>) {
  const localFiltering = table?.options.meta?.dataTableLocalFiltering;
  const canFilterCurrentPage = Boolean(localFiltering && column.columnDef.meta?.localFilter);

  if (!column.getCanSort() && !column.getCanHide()) {
    // 没有排序/隐藏菜单时保持轻量标题结构，本地筛选入口仍按列配置显示。
    return (
      <div className={cn('flex w-full min-w-0 items-center gap-1', className)}>
        <DataTableOverflowTooltipText value={title}>{title}</DataTableOverflowTooltipText>
        {canFilterCurrentPage && localFiltering ? (
          <DataTableLocalFilter column={column} runtime={localFiltering} title={title} />
        ) : null}
      </div>
    );
  }

  return (
    <div className='flex w-full min-w-0 items-center gap-0.5'>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'focus:ring-ring data-[state=open]:bg-accent [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground -ml-1.5 flex h-8 max-w-full min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 focus:ring-1 focus:outline-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-colors',
            className
          )}
          {...props}
        >
          {/* 表头标题可能很长，始终用统一的溢出 Tooltip 包裹。 */}
          <DataTableOverflowTooltipText value={title} className='min-w-0 flex-1'>
            {title}
          </DataTableOverflowTooltipText>
          {column.getCanSort() && renderSortIcon(column.getIsSorted())}
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start' className='w-28'>
          {column.getCanSort() && (
            <>
              <DropdownMenuCheckboxItem
                className='[&_svg]:text-muted-foreground relative pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto'
                checked={column.getIsSorted() === 'asc'}
                onClick={() => column.toggleSorting(false)}
              >
                <Icons.chevronUp />
                {labels?.ascText ?? '升序'}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                className='[&_svg]:text-muted-foreground relative pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto'
                checked={column.getIsSorted() === 'desc'}
                onClick={() => column.toggleSorting(true)}
              >
                <Icons.chevronDown />
                {labels?.descText ?? '降序'}
              </DropdownMenuCheckboxItem>
              {column.getIsSorted() && (
                <DropdownMenuItem
                  className='[&_svg]:text-muted-foreground pl-2'
                  onClick={() => column.clearSorting()}
                >
                  <Icons.close />
                  {labels?.resetText ?? '重置排序'}
                </DropdownMenuItem>
              )}
            </>
          )}
          {column.getCanHide() && (
            <DropdownMenuCheckboxItem
              className='[&_svg]:text-muted-foreground relative pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto'
              checked={!column.getIsVisible()}
              onClick={() => column.toggleVisibility(false)}
            >
              <Icons.eyeOff />
              {labels?.hideText ?? '隐藏列'}
            </DropdownMenuCheckboxItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canFilterCurrentPage && localFiltering ? (
        <DataTableLocalFilter column={column} runtime={localFiltering} title={title} />
      ) : null}
    </div>
  );
}
