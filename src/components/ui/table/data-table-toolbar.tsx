import type { Column, Table } from '@tanstack/react-table';
import * as React from 'react';

import { DataTableDateFilter } from '@/components/ui/table/data-table-date-filter';
import { DataTableFacetedFilter } from '@/components/ui/table/data-table-faceted-filter';
import { DataTableSliderFilter } from '@/components/ui/table/data-table-slider-filter';
import { DataTableViewOptions } from '@/components/ui/table/data-table-view-options';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { Cross2Icon } from '@radix-ui/react-icons';
import type { DataTableFacetedFilterLabels } from '@/components/ui/table/data-table-faceted-filter';
import type { DataTableViewOptionsLabels } from '@/components/ui/table/data-table-view-options';

export interface DataTableToolbarLabels {
  resetFiltersAriaLabel?: string;
  resetFiltersText?: string;
  viewOptions?: DataTableViewOptionsLabels;
  facetedFilter?: DataTableFacetedFilterLabels;
}

interface DataTableToolbarProps<TData> extends React.ComponentProps<'div'> {
  table: Table<TData>;
  labels?: DataTableToolbarLabels;
}

export function DataTableToolbar<TData>({
  table,
  children,
  className,
  labels,
  ...props
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const columns = React.useMemo(
    () => table.getAllColumns().filter((column) => column.getCanFilter()),
    [table]
  );

  const onReset = React.useCallback(() => {
    table.resetColumnFilters();
  }, [table]);

  return (
    <div
      role='toolbar'
      aria-orientation='horizontal'
      className={cn('flex w-full items-start justify-between gap-2 p-1', className)}
      {...props}
    >
      <div className='flex flex-1 flex-wrap items-center gap-2'>
        {columns.map((column) => (
          <DataTableToolbarFilter key={column.id} column={column} labels={labels} />
        ))}
        {isFiltered && (
          <Button
            aria-label={labels?.resetFiltersAriaLabel ?? '重置筛选条件'}
            variant='outline'
            size='sm'
            className='border-dashed'
            onClick={onReset}
          >
            <Cross2Icon />
            {labels?.resetFiltersText ?? '重置筛选'}
          </Button>
        )}
      </div>
      <div className='flex items-center gap-2'>
        {children}
        <DataTableViewOptions table={table} labels={labels?.viewOptions} />
      </div>
    </div>
  );
}
interface DataTableToolbarFilterProps<TData> {
  column: Column<TData>;
  labels?: DataTableToolbarLabels;
}

function DataTableToolbarFilter<TData>({ column, labels }: DataTableToolbarFilterProps<TData>) {
  {
    const columnMeta = column.columnDef.meta;

    const onFilterRender = React.useCallback(() => {
      if (!columnMeta?.variant) return null;

      switch (columnMeta.variant) {
        case 'text':
          return (
            <DebouncedFilterInput
              placeholder={columnMeta.placeholder ?? columnMeta.label}
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
                placeholder={columnMeta.placeholder ?? columnMeta.label}
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
          return <DataTableSliderFilter column={column} title={columnMeta.label ?? column.id} />;

        case 'date':
        case 'dateRange':
          return (
            <DataTableDateFilter
              column={column}
              title={columnMeta.label ?? column.id}
              multiple={columnMeta.variant === 'dateRange'}
            />
          );

        case 'select':
        case 'multiSelect':
          return (
            <DataTableFacetedFilter
              column={column}
              title={columnMeta.label ?? column.id}
              options={columnMeta.options ?? []}
              multiple={columnMeta.variant === 'multiSelect'}
              labels={labels?.facetedFilter}
            />
          );

        default:
          return null;
      }
    }, [column, columnMeta, labels?.facetedFilter]);

    return onFilterRender();
  }
}

interface DebouncedFilterInputProps
  extends Omit<React.ComponentProps<typeof Input>, 'onChange' | 'value'> {
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
  const [localValue, setLocalValue] = React.useState(externalValue);
  const debouncedOnChange = useDebouncedCallback(onChange, debounceMs);

  React.useEffect(() => {
    setLocalValue(externalValue);
  }, [externalValue]);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setLocalValue(next);
      debouncedOnChange(next);
    },
    [debouncedOnChange],
  );

  return <Input {...inputProps} value={localValue} onChange={handleChange} />;
}
