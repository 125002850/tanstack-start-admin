import type { Column, Table } from '@tanstack/react-table';
import * as React from 'react';

import { DataTableDateFilter } from '@/components/ui/table/filters/data-table-date-filter';
import { DataTableFacetedFilter } from '@/components/ui/table/filters/data-table-faceted-filter';
import { DataTableSliderFilter } from '@/components/ui/table/filters/data-table-slider-filter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { getDataTableColumnLabel } from '@/lib/data-table-column-label';
import { cn } from '@/lib/utils';
import { useDebouncedInput } from '@/hooks/use-debounced-input';
import { Icons } from '@/components/icons';
import type { DataTableFacetedFilterLabels } from '@/components/ui/table/filters/data-table-faceted-filter';
import type { DataTableViewOptionsLabels } from '@/components/ui/table/toolbar/data-table-view-options';

export interface DataTableToolbarLabels {
  queryingText?: string;
  resetFiltersAriaLabel?: string;
  resetFiltersText?: string;
  viewOptions?: DataTableViewOptionsLabels;
  facetedFilter?: DataTableFacetedFilterLabels;
}

interface DataTableToolbarProps<TData> extends React.ComponentProps<'div'> {
  table: Table<TData>;
  isQuerying?: boolean;
  labels?: DataTableToolbarLabels;
}

export function DataTableToolbar<TData>({
  table,
  isQuerying = false,
  children,
  className,
  labels,
  ...props
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const columns = table.getAllColumns().filter((column) => column.getCanFilter());

  const onReset = React.useCallback(() => {
    table.resetColumnFilters(true);
  }, [table]);

  return (
    <div
      role='toolbar'
      aria-orientation='horizontal'
      className={cn('flex w-full items-start gap-2 p-1', className)}
      {...props}
    >
      <div className='flex flex-1 flex-wrap items-center gap-2'>
        {columns.map((column) => (
          <DataTableToolbarFilter key={column.id} column={column} table={table} labels={labels} />
        ))}
        {isFiltered && (
          <Button
            aria-label={labels?.resetFiltersAriaLabel ?? '重置筛选条件'}
            aria-busy={isQuerying || undefined}
            variant='outline'
            size='sm'
            className='data-table-filter-control min-w-[6.25rem] border-dashed'
            data-active='true'
            onClick={onReset}
          >
            {isQuerying ? (
              <Spinner data-icon='inline-start' aria-label={labels?.queryingText ?? '查询中'} />
            ) : (
              <Icons.close data-icon='inline-start' className='size-4' />
            )}
            {isQuerying
              ? (labels?.queryingText ?? '查询中')
              : (labels?.resetFiltersText ?? '重置筛选')}
          </Button>
        )}
        {children}
      </div>
    </div>
  );
}
interface DataTableToolbarFilterProps<TData> {
  column: Column<TData>;
  table: Table<TData>;
  labels?: DataTableToolbarLabels;
}

function DataTableToolbarFilter<TData>({
  column,
  table,
  labels
}: DataTableToolbarFilterProps<TData>) {
  {
    const columnMeta = column.columnDef.meta;
    const columnLabel = getDataTableColumnLabel(column, table);

    const onFilterRender = React.useCallback(() => {
      if (!columnMeta?.variant) return null;

      switch (columnMeta.variant) {
        case 'text':
          return (
            <DebouncedFilterInput
              placeholder={columnMeta.placeholder ?? columnLabel}
              value={(column.getFilterValue() as string) ?? ''}
              onChange={(value) => column.setFilterValue(value)}
              className='h-8 w-40 lg:w-56'
            />
          );

        case 'number':
          return (
            <div className='relative'>
              <DebouncedFilterInput
                type='number'
                inputMode='numeric'
                placeholder={columnMeta.placeholder ?? columnLabel}
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(value) => column.setFilterValue(value)}
                className={cn('h-8 w-[120px]', columnMeta.unit && 'pr-8')}
              />
              {columnMeta.unit && (
                <span className='bg-accent text-muted-foreground absolute top-0 right-0 bottom-0 flex items-center rounded-r-md px-2 text-sm'>
                  {columnMeta.unit}
                </span>
              )}
            </div>
          );

        case 'range':
          return <DataTableSliderFilter column={column} title={columnLabel} />;

        case 'date':
        case 'dateRange':
          return (
            <DataTableDateFilter
              column={column}
              title={columnLabel}
              multiple={columnMeta.variant === 'dateRange'}
            />
          );

        case 'select':
        case 'multiSelect':
          return (
            <DataTableFacetedFilter
              column={column}
              title={columnLabel}
              options={columnMeta.options ?? []}
              multiple={columnMeta.variant === 'multiSelect'}
              labels={labels?.facetedFilter}
            />
          );

        default:
          return null;
      }
    }, [column, columnLabel, columnMeta, labels?.facetedFilter]);

    return onFilterRender();
  }
}

interface DebouncedFilterInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  'onChange' | 'value'
> {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
}

function DebouncedFilterInput({
  value: externalValue,
  onChange,
  debounceMs = 300,
  ...inputProps
}: DebouncedFilterInputProps) {
  const inputBindings = useDebouncedInput({
    value: externalValue,
    onChange,
    debounceMs
  });

  return (
    <Input
      {...inputProps}
      {...inputBindings}
      data-active={inputBindings.value.length > 0 ? 'true' : undefined}
      className={cn('data-table-filter-control', inputProps.className)}
    />
  );
}
