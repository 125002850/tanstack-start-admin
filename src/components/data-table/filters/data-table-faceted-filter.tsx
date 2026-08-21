import type { Option } from './types';
import type { Column } from '@tanstack/react-table';
import { Icons } from '@/components/icons';

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
import { cn } from '@/lib/utils';
import * as React from 'react';

import { DataTableFilterTrigger } from './data-table-filter-trigger';

/**
 * 枚举/多选筛选控件。
 *
 * column filter value 统一保存为字符串数组：单选也使用 `[value]`，这样 toolbar、DSL
 * 序列化和 Badge 摘要可以共用同一种数据形态。
 */
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
  options: readonly Option[];
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
  // Set 只作为渲染和切换时的本地结构，写回 column 时仍转换为数组。
  const selectedValues = React.useMemo(
    () => new Set(Array.isArray(columnFilterValue) ? columnFilterValue : []),
    [columnFilterValue]
  );

  const onItemSelect = React.useCallback(
    (option: Option, isSelected: boolean) => {
      if (!column) return;

      if (multiple) {
        // 多选：切换当前 option，并在没有任何值时清空 filter。
        const newSelectedValues = new Set(selectedValues);
        if (isSelected) {
          newSelectedValues.delete(option.value);
        } else {
          newSelectedValues.add(option.value);
        }
        const filterValues = Array.from(newSelectedValues);
        column.setFilterValue(filterValues.length ? filterValues : undefined);
      } else {
        // 单选：再次点击已选项表示清空；选择新值后立即关闭 popover。
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
        <DataTableFilterTrigger
          title={title}
          state={
            selectedValues.size > 0
              ? {
                  status: 'active',
                  onClear: onReset,
                  selection: {
                    kind: 'labels',
                    count: selectedValues.size,
                    items: options
                      .filter((option) => selectedValues.has(option.value))
                      .map((option) => ({ key: option.value, label: option.label })),
                    summaryText: labels?.selectedSummaryText?.(selectedValues.size)
                  }
                }
              : { status: 'idle' }
          }
        />
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
                  <CommandItem
                    key={option.value}
                    keywords={option.keywords ? [...option.keywords] : undefined}
                    onSelect={() => onItemSelect(option, isSelected)}
                  >
                    <div
                      className={cn(
                        'border-primary flex size-4 items-center justify-center rounded-sm border',
                        isSelected ? 'bg-primary' : 'opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <Icons.check className='size-4 text-primary-foreground' />
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
