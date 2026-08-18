import type { Column, Table } from '@tanstack/react-table';
import * as React from 'react';
import { Icons } from '@/components/icons';

import { DataTableOverflowTooltipText } from '@/components/data-table/cells/data-table-overflow-tooltip-text';
import { DataTableLocalFilter } from '@/components/data-table/filters/data-table-local-filter';
import { cn } from '@/lib/utils';
import type { DataTableColumnAlign } from '@/types/data-table';

/**
 * 标准 DataTable 列头。
 *
 * 可排序列的标题区域直接推进 TanStack sorting state；列显隐统一由 DataTableViewOptions
 * 承担。本地列值筛选使用独立固定槽位，避免排序、筛选和列管理共享同一点击目标。
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
  /** 表头文字对齐方式，默认居中。 */
  align?: DataTableColumnAlign;
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

function getHeaderAlignmentClassName(align: DataTableColumnAlign) {
  switch (align) {
    case 'left':
      return 'justify-start text-left';
    case 'right':
      return 'justify-end text-right';
    case 'center':
      return 'justify-center text-center';
  }
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  table,
  title,
  align = 'center',
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
  const alignmentClassName = getHeaderAlignmentClassName(align);

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
      <div data-slot='data-table-column-header' className='flex h-8 w-full min-w-0 items-center'>
        <div
          data-slot='data-table-column-header-content'
          className={cn(
            'flex h-full min-w-0 flex-1 items-center px-2',
            alignmentClassName,
            className
          )}
        >
          <DataTableOverflowTooltipText value={title} className='min-w-0'>
            {title}
          </DataTableOverflowTooltipText>
        </div>
        {canFilterCurrentPage && localFiltering ? (
          <DataTableLocalFilter column={column} runtime={localFiltering} title={title} />
        ) : null}
      </div>
    );
  }

  return (
    <div data-slot='data-table-column-header' className='flex h-8 w-full min-w-0 items-center'>
      <button
        type='button'
        data-slot='data-table-column-header-content'
        data-column-header-drag-surface
        aria-label={ariaLabel ?? `${title}：${getNextSortActionText(nextSortDirection, labels)}`}
        className={cn(
          'focus-visible:ring-ring [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground flex h-8 max-w-full min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1.5 focus-visible:ring-1 focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-colors',
          alignmentClassName,
          className
        )}
        {...buttonProps}
        onClick={handleSortClick}
      >
        {/* 表头标题可能很长，始终用统一的溢出 Tooltip 包裹。 */}
        <DataTableOverflowTooltipText value={title} className='min-w-0'>
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
