import type { Column } from '@tanstack/react-table';
import { Icons } from '@/components/icons';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { DataTableOverflowTooltipText } from '@/components/ui/table/cells/data-table-overflow-tooltip-text';
import { cn } from '@/lib/utils';

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
  title,
  className,
  labels,
  ...props
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort() && !column.getCanHide()) {
    return (
      <div className={cn('min-w-0 max-w-full', className)}>
        <DataTableOverflowTooltipText value={title}>{title}</DataTableOverflowTooltipText>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'hover:bg-accent focus:ring-ring data-[state=open]:bg-accent [&_svg]:text-muted-foreground -ml-1.5 flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 focus:ring-1 focus:outline-none [&_svg]:size-4 [&_svg]:shrink-0',
          className
        )}
        {...props}
      >
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
  );
}
