import type { Column, Table } from '@tanstack/react-table';
import * as React from 'react';
import { Icons } from '@/components/icons';

import { DataTableOverflowTooltipText } from '@/components/data-table/cells/data-table-overflow-tooltip-text';
import { DataTableLocalFilter } from '@/components/data-table/filters/data-table-local-filter';
import { cn } from '@/lib/utils';

/**
 * 标准 DataTable 列头。
 *
 * 可排序列的标题区域直接推进 TanStack sorting state；列显隐统一由 DataTableViewOptions
 * 承担。本地列值筛选保留为独立按钮，避免排序、筛选和列管理共享同一点击目标。
 */
export interface DataTableColumnHeaderLabels {
  ascText?: string;
  descText?: string;
  resetText?: string;
  /** @deprecated 列显隐已统一收敛到 DataTableViewOptions。 */
  hideText?: string;
}

interface DataTableColumnHeaderProps<TData, TValue> extends Omit<
  React.ComponentProps<'button'>,
  'title'
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

/** 描述 TanStack Table 根据当前配置计算出的下一次排序动作。 */
function getNextSortActionText(
  nextSortDirection: false | 'asc' | 'desc',
  labels?: DataTableColumnHeaderLabels
) {
  if (nextSortDirection === 'desc') {
    return labels?.descText ?? '降序';
  }

  if (nextSortDirection === false) {
    return labels?.resetText ?? '重置排序';
  }

  return labels?.ascText ?? '升序';
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  table,
  title,
  className,
  labels,
  onClick,
  'aria-label': ariaLabel,
  ...buttonProps
}: DataTableColumnHeaderProps<TData, TValue>) {
  const localFiltering = table?.options.meta?.dataTableLocalFiltering;
  const canFilterCurrentPage = Boolean(localFiltering && column.columnDef.meta?.localFilter);
  const sortDirection = column.getIsSorted();
  const nextSortDirection = column.getNextSortingOrder();

  const handleSortClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    // 与 AG Grid 的 progressSortFromEvent 职责一致：由表格排序运行时推进状态，
    // 保留 Shift 多列排序及 TanStack Table 的排序顺序配置。
    column.getToggleSortingHandler()?.(event);
  };

  if (!column.getCanSort()) {
    // 不可排序列保持轻量标题结构；列是否可隐藏不改变表头点击语义。
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
      <button
        type='button'
        data-column-header-drag-surface
        aria-label={ariaLabel ?? `${title}：${getNextSortActionText(nextSortDirection, labels)}`}
        className={cn(
          'focus-visible:ring-ring [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground -ml-1.5 flex h-8 max-w-full min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 focus-visible:ring-1 focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-colors',
          className
        )}
        {...buttonProps}
        onClick={handleSortClick}
      >
        {/* 表头标题可能很长，始终用统一的溢出 Tooltip 包裹。 */}
        <DataTableOverflowTooltipText value={title} className='min-w-0 flex-1'>
          {title}
        </DataTableOverflowTooltipText>
        {renderSortIcon(sortDirection)}
      </button>
      {canFilterCurrentPage && localFiltering ? (
        <DataTableLocalFilter column={column} runtime={localFiltering} title={title} />
      ) : null}
    </div>
  );
}
