import * as React from 'react';
import type { Column } from '@tanstack/react-table';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Tree, type TreeItem, type TreeSelection } from '@/components/ui/tree';
import type { DataTableTreeSelectionMode, TreeOption } from './types';

import type { DataTableFacetedFilterLabels } from './data-table-faceted-filter';

interface DataTableTreeFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
  title?: string;
  options: readonly TreeOption[];
  /** cascade 会联动父子节点；independent 表示各节点独立选择。 */
  selectionMode?: DataTableTreeSelectionMode;
  labels?: DataTableFacetedFilterLabels;
}

export function dataTableOptionsToTreeItems(options: readonly TreeOption[]): TreeItem[] {
  const roots: TreeItem[] = [];
  const stack: TreeItem[] = [];

  for (const option of options) {
    const depth = Math.min(Math.max(option.depth, 0), stack.length);
    const item: TreeItem = {
      value: option.value,
      label: option.label,
      icon: option.icon,
      endContent:
        option.count == null ? undefined : (
          <span className='ml-auto font-mono text-xs text-muted-foreground'>{option.count}</span>
        ),
      children: []
    };

    if (depth === 0) roots.push(item);
    else stack[depth - 1]!.children?.push(item);

    stack[depth] = item;
    stack.length = depth + 1;
  }

  return roots;
}

export function DataTableTreeFilter<TData, TValue>({
  column,
  title,
  options,
  selectionMode = 'cascade',
  labels
}: DataTableTreeFilterProps<TData, TValue>) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const columnFilterValue = column.getFilterValue();
  const selectedValues = React.useMemo(
    () =>
      Array.isArray(columnFilterValue)
        ? columnFilterValue.filter((value): value is string => typeof value === 'string')
        : [],
    [columnFilterValue]
  );
  const selectedValueSet = React.useMemo(() => new Set(selectedValues), [selectedValues]);
  const treeItems = React.useMemo(() => dataTableOptionsToTreeItems(options), [options]);
  const handleValuesChange = React.useCallback(
    (values: string[]) => column.setFilterValue(values.length > 0 ? values : undefined),
    [column]
  );
  const selection = React.useMemo<TreeSelection>(
    () =>
      selectionMode === 'cascade'
        ? { mode: 'cascade-multiple', values: selectedValues, onValuesChange: handleValuesChange }
        : {
            mode: 'independent-multiple',
            values: selectedValues,
            onValuesChange: handleValuesChange
          },
    [handleValuesChange, selectedValues, selectionMode]
  );

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setSearchQuery('');
  }, []);

  const handleReset = React.useCallback(
    (event?: React.MouseEvent) => {
      event?.preventDefault();
      event?.stopPropagation();
      column.setFilterValue(undefined);
    },
    [column]
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='data-table-filter-control border-dashed'
          data-active={selectedValues.length > 0 ? 'true' : undefined}
        >
          {selectedValues.length > 0 ? (
            <span
              aria-hidden='true'
              data-filter-clear=''
              onClick={handleReset}
              className='rounded-sm opacity-70 transition-opacity hover:opacity-100'
            >
              <Icons.xCircle />
            </span>
          ) : (
            <Icons.plusCircle />
          )}
          {title}
          {selectedValues.length > 0 ? (
            <>
              <Separator
                orientation='vertical'
                className='mx-0.5 data-[orientation=vertical]:h-4'
              />
              <Badge variant='secondary' className='rounded-sm px-1 font-normal lg:hidden'>
                {selectedValues.length}
              </Badge>
              <div className='hidden items-center gap-1 lg:flex'>
                {selectedValues.length > 2 ? (
                  <Badge variant='secondary' className='rounded-sm px-1 font-normal'>
                    {labels?.selectedSummaryText?.(selectedValues.length) ??
                      `已选 ${selectedValues.length} 项`}
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValueSet.has(option.value))
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
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='data-table-filter-popover w-72 p-0' align='start'>
        <div className='flex flex-col gap-2 p-2'>
          <InputGroup>
            <InputGroupAddon>
              <Icons.search aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type='search'
              aria-label={labels?.inputPlaceholder?.(title) ?? `筛选${title ?? ''}`}
              placeholder={labels?.inputPlaceholder?.(title) ?? `筛选${title ?? ''}`}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </InputGroup>
          <div className='max-h-[18.75rem] min-w-0 overflow-x-hidden overflow-y-auto'>
            <Tree
              aria-label={`${title ?? ''}筛选树`}
              items={treeItems}
              searchQuery={searchQuery}
              selection={selection}
              emptyText={labels?.emptyMessage ?? '暂无可选项'}
              searchEmptyText={labels?.emptyMessage ?? '未找到匹配项'}
            />
          </div>
          {selectedValues.length > 0 ? (
            <>
              <Separator />
              <Button type='button' variant='ghost' size='sm' onClick={() => handleReset()}>
                {labels?.clearFiltersText ?? '清除筛选'}
              </Button>
            </>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
