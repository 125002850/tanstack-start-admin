import type { Option } from '@/types/data-table';
import type { Column } from '@tanstack/react-table';
import { Icons } from '@/components/icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import * as React from 'react';

export interface DataTableFacetedFilterLabels {
  clearFilterAriaLabel?: (title?: string) => string;
  selectedSummaryText?: (count: number) => string;
  inputPlaceholder?: (title?: string) => string;
  emptyMessage?: string;
  clearFiltersText?: string;
}

interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
  options: Option[];
  multiple?: boolean;
  labels?: DataTableFacetedFilterLabels;
}

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
  multiple,
  labels
}: DataTableFacetedFilterProps<TData, TValue>) {
  const [open, setOpen] = React.useState(false);

  const columnFilterValue = column?.getFilterValue();
  const selectedValues = React.useMemo(
    () => new Set(Array.isArray(columnFilterValue) ? columnFilterValue : []),
    [columnFilterValue]
  );

  const onItemSelect = React.useCallback(
    (option: Option, isSelected: boolean) => {
      if (!column) return;

      if (multiple) {
        const newSelectedValues = new Set(selectedValues);
        if (isSelected) {
          newSelectedValues.delete(option.value);
        } else {
          newSelectedValues.add(option.value);
        }
        const filterValues = Array.from(newSelectedValues);
        column.setFilterValue(filterValues.length ? filterValues : undefined);
      } else {
        column.setFilterValue(isSelected ? undefined : [option.value]);
        setOpen(false);
      }
    },
    [column, multiple, selectedValues]
  );

  const onReset = React.useCallback(
    (event?: React.MouseEvent) => {
      event?.preventDefault();
      event?.stopPropagation();
      column?.setFilterValue(undefined);
    },
    [column]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='data-table-filter-control border-dashed'
          data-active={selectedValues.size > 0 ? 'true' : undefined}
        >
          {selectedValues?.size > 0 ? (
            <span
              aria-hidden='true'
              data-filter-clear=''
              onClick={onReset}
              className='rounded-sm opacity-70 transition-opacity hover:opacity-100'
            >
              <Icons.xCircle />
            </span>
          ) : (
            <Icons.plusCircle />
          )}
          {title}
          {selectedValues?.size > 0 && (
            <>
              <Separator
                orientation='vertical'
                className='mx-0.5 data-[orientation=vertical]:h-4'
              />
              <Badge variant='secondary' className='rounded-sm px-1 font-normal lg:hidden'>
                {selectedValues.size}
              </Badge>
              <div className='hidden items-center gap-1 lg:flex'>
                {selectedValues.size > 2 ? (
                  <Badge variant='secondary' className='rounded-sm px-1 font-normal'>
                    {labels?.selectedSummaryText?.(selectedValues.size) ??
                      `已选 ${selectedValues.size} 项`}
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => (
                      <Badge
                        variant='secondary'
                        key={option.value}
                        className='rounded-sm px-1 font-normal'
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='data-table-filter-popover w-[12.5rem] p-0' align='start'>
        <Command>
          <CommandInput placeholder={labels?.inputPlaceholder?.(title) ?? `筛选${title ?? ''}`} />
          <CommandList className='max-h-full'>
            <CommandEmpty>{labels?.emptyMessage ?? '未找到匹配项'}</CommandEmpty>
            <CommandGroup className='max-h-[18.75rem] overflow-x-hidden overflow-y-auto'>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value);

                return (
                  <CommandItem key={option.value} onSelect={() => onItemSelect(option, isSelected)}>
                    <div
                      className={cn(
                        'border-primary flex size-4 items-center justify-center rounded-sm border',
                        isSelected ? 'bg-primary' : 'opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <Icons.check className='size-4' />
                    </div>
                    {option.icon && <option.icon />}
                    <span className='truncate'>{option.label}</span>
                    {option.count && (
                      <span className='ml-auto font-mono text-xs'>{option.count}</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => onReset()} className='justify-center text-center'>
                    {labels?.clearFiltersText ?? '清除筛选'}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
