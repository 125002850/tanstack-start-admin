import type { Column } from '@tanstack/react-table';
import { zhCN } from 'date-fns/locale';
import { Icons } from '@/components/icons';
import * as React from 'react';
import type { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { formatDateOnly } from '@/lib/format';

/**
 * 日期/日期范围筛选控件。
 *
 * 单日期在 column filter 中保存为毫秒时间戳；范围筛选保存为 `[from, to]`，其中任意一端
 * 可以为空。useDslDataTable 会在后端请求阶段再把这些时间戳转换为日开始/日结束。
 */
type DateSelection = Date[] | DateRange;

/** react-day-picker 的 range 值是对象，single/multiple 日期值是数组。 */
function getIsDateRange(value: DateSelection): value is DateRange {
  return value && typeof value === 'object' && !Array.isArray(value);
}

/** 兼容字符串和数字时间戳，非法值返回 undefined 而不是 Invalid Date。 */
function parseAsDate(timestamp: number | string | undefined): Date | undefined {
  if (!timestamp) return undefined;
  const numericTimestamp = typeof timestamp === 'string' ? Number(timestamp) : timestamp;
  const date = new Date(numericTimestamp);
  return !Number.isNaN(date.getTime()) ? date : undefined;
}

/** TanStack column filter value 可能来自 URL/缓存/手写代码，这里统一收敛为数组。 */
function parseColumnFilterValue(value: unknown) {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'number' || typeof item === 'string') {
        return item;
      }
      return undefined;
    });
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return [value];
  }

  return [];
}

interface DataTableDateFilterProps<TData> {
  column: Column<TData, unknown>;
  title?: string;
  multiple?: boolean;
}

export function DataTableDateFilter<TData>({
  column,
  title,
  multiple
}: DataTableDateFilterProps<TData>) {
  const columnFilterValue = column.getFilterValue();

  const selectedDates = React.useMemo<DateSelection>(() => {
    // multiple=true 表示日期范围；false 表示单日期。
    if (!columnFilterValue) {
      return multiple ? { from: undefined, to: undefined } : [];
    }

    if (multiple) {
      const timestamps = parseColumnFilterValue(columnFilterValue);
      return {
        from: parseAsDate(timestamps[0]),
        to: parseAsDate(timestamps[1])
      };
    }

    const timestamps = parseColumnFilterValue(columnFilterValue);
    const date = parseAsDate(timestamps[0]);
    return date ? [date] : [];
  }, [columnFilterValue, multiple]);

  const onSelect = React.useCallback(
    (date: Date | DateRange | undefined) => {
      if (!date) {
        column.setFilterValue(undefined);
        return;
      }

      if (multiple && !('getTime' in date)) {
        // 范围筛选写入 [from, to]，缺失端保持 undefined，方便后续序列化为 GTE/LTE。
        const from = date.from?.getTime();
        const to = date.to?.getTime();
        column.setFilterValue(from || to ? [from, to] : undefined);
      } else if (!multiple && 'getTime' in date) {
        // 单日期直接保存当天时间戳，DSL 层负责扩展为整天 BETWEEN。
        column.setFilterValue(date.getTime());
      }
    },
    [column, multiple]
  );

  const onReset = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      column.setFilterValue(undefined);
    },
    [column]
  );

  const hasValue = React.useMemo(() => {
    // Button 的 data-active 只在真正有日期值时打开，空范围不算有效筛选。
    if (multiple) {
      if (!getIsDateRange(selectedDates)) return false;
      return selectedDates.from || selectedDates.to;
    }
    if (!Array.isArray(selectedDates)) return false;
    return selectedDates.length > 0;
  }, [multiple, selectedDates]);

  const formatDateOnlyRange = React.useCallback((range: DateRange) => {
    if (!range.from && !range.to) return '';
    if (range.from && range.to) {
      return `${formatDateOnly(range.from)} - ${formatDateOnly(range.to)}`;
    }
    return formatDateOnly(range.from ?? range.to);
  }, []);

  const label = React.useMemo(() => {
    if (multiple) {
      if (!getIsDateRange(selectedDates)) return null;

      const hasSelectedDates = selectedDates.from || selectedDates.to;
      const dateText = hasSelectedDates ? formatDateOnlyRange(selectedDates) : '选择日期范围';

      return (
        <span className='flex items-center gap-2'>
          <span>{title}</span>
          {hasSelectedDates && (
            <>
              <Separator
                orientation='vertical'
                className='mx-0.5 data-[orientation=vertical]:h-4'
              />
              <span>{dateText}</span>
            </>
          )}
        </span>
      );
    }

    if (getIsDateRange(selectedDates)) return null;

    const hasSelectedDate = selectedDates.length > 0;
    const dateText = hasSelectedDate ? formatDateOnly(selectedDates[0]) : '选择日期';

    return (
      <span className='flex items-center gap-2'>
        <span>{title}</span>
        {hasSelectedDate && (
          <>
            <Separator orientation='vertical' className='mx-0.5 data-[orientation=vertical]:h-4' />
            <span>{dateText}</span>
          </>
        )}
      </span>
    );
  }, [selectedDates, multiple, formatDateOnlyRange, title]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='data-table-filter-control border-dashed'
          data-active={hasValue ? 'true' : undefined}
        >
          {hasValue ? (
            <span
              aria-hidden='true'
              data-filter-clear=''
              onClick={onReset}
              className='rounded-sm opacity-70 transition-opacity hover:opacity-100'
            >
              <Icons.xCircle />
            </span>
          ) : (
            <Icons.calendar />
          )}
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='data-table-filter-popover w-auto p-0' align='start'>
        {multiple ? (
          <Calendar
            mode='range'
            locale={zhCN}
            selected={
              getIsDateRange(selectedDates) ? selectedDates : { from: undefined, to: undefined }
            }
            onSelect={onSelect}
          />
        ) : (
          <Calendar
            mode='single'
            locale={zhCN}
            selected={!getIsDateRange(selectedDates) ? selectedDates[0] : undefined}
            onSelect={onSelect}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
