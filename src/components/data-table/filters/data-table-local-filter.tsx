import type { Column } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { createDataTableLocalSetFilterValue } from '@/hooks/use-data-table/use-data-table-local-filtering';
import { cn } from '@/lib/utils';
import type { DataTableLocalFilterOption, DataTableLocalFilteringRuntime } from './types';

interface DataTableLocalFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
  runtime: DataTableLocalFilteringRuntime;
  title: string;
}

interface LocalFilterOptionRowProps {
  option: DataTableLocalFilterOption;
  selected: boolean;
  onToggle: (key: string) => void;
}

const SET_FILTER_OPTION_HEIGHT = 32;
const EMPTY_FILTER_OPTIONS: DataTableLocalFilterOption[] = [];

function LocalFilterOptionRow({ option, selected, onToggle }: LocalFilterOptionRowProps) {
  const checkboxId = React.useId();

  return (
    <label
      htmlFor={checkboxId}
      role='listitem'
      className='hover:bg-accent flex h-8 cursor-default items-center gap-2 rounded-sm px-1.5 text-sm'
    >
      <Checkbox
        id={checkboxId}
        checked={selected}
        aria-label={option.label}
        onCheckedChange={() => onToggle(option.key)}
      />
      <span className='min-w-0 flex-1 truncate'>{option.label}</span>
    </label>
  );
}

function VirtualLocalFilterOptions({
  options,
  selectedKeys,
  onToggle
}: {
  options: readonly DataTableLocalFilterOption[];
  selectedKeys: ReadonlySet<string>;
  onToggle: (key: string) => void;
}) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: options.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => SET_FILTER_OPTION_HEIGHT,
    overscan: 6
  });
  const virtualItems = rowVirtualizer.getVirtualItems();

  if (options.length === 0) {
    return (
      <div className='text-muted-foreground flex h-24 items-center justify-center text-xs'>
        未找到匹配项
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      role='list'
      aria-label='筛选值'
      className='h-48 overflow-y-auto overscroll-contain'
    >
      <div className='relative w-full' style={{ height: rowVirtualizer.getTotalSize() }}>
        {virtualItems.map((virtualItem) => {
          const option = options[virtualItem.index];
          if (!option) return null;

          return (
            <div
              key={option.key}
              className='absolute top-0 left-0 w-full'
              style={{ transform: `translateY(${virtualItem.start}px)` }}
            >
              <LocalFilterOptionRow
                option={option}
                selected={selectedKeys.has(option.key)}
                onToggle={onToggle}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 标准列头的“当前页 Set Filter”入口；搜索只收窄候选项，勾选立即筛选表格。 */
export function DataTableLocalFilter<TData, TValue>({
  column,
  runtime,
  title
}: DataTableLocalFilterProps<TData, TValue>) {
  const [open, setOpen] = React.useState(false);
  const [keyword, setKeyword] = React.useState('');
  const selectAllId = React.useId();
  const deferredKeyword = React.useDeferredValue(keyword);
  const value = runtime.getFilterValue(column.id);
  const options = open ? runtime.getFilterOptions(column.id) : EMPTY_FILTER_OPTIONS;
  const active = value !== undefined;
  const selectedKeys = React.useMemo(
    () => new Set(value?.selectedKeys ?? options.map((option) => option.key)),
    [options, value]
  );
  const normalizedKeyword = deferredKeyword.trim().toLocaleLowerCase();
  const visibleOptions = React.useMemo(
    () =>
      normalizedKeyword.length === 0
        ? options
        : options.filter((option) => option.label.toLocaleLowerCase().includes(normalizedKeyword)),
    [normalizedKeyword, options]
  );
  const allVisibleSelected =
    visibleOptions.length > 0 && visibleOptions.every((option) => selectedKeys.has(option.key));
  const someVisibleSelected = visibleOptions.some((option) => selectedKeys.has(option.key));

  const commitSelectedKeys = React.useCallback(
    (nextSelectedKeys: Set<string>) => {
      const allOptionsSelected =
        options.length > 0 && options.every((option) => nextSelectedKeys.has(option.key));
      runtime.setFilterValue(
        column.id,
        allOptionsSelected ? undefined : createDataTableLocalSetFilterValue(nextSelectedKeys)
      );
    },
    [column.id, options, runtime]
  );

  const toggleOption = React.useCallback(
    (key: string) => {
      const nextSelectedKeys = new Set(selectedKeys);
      if (nextSelectedKeys.has(key)) {
        nextSelectedKeys.delete(key);
      } else {
        nextSelectedKeys.add(key);
      }
      commitSelectedKeys(nextSelectedKeys);
    },
    [commitSelectedKeys, selectedKeys]
  );

  const toggleVisibleOptions = () => {
    if (visibleOptions.length === 0) return;
    const nextSelectedKeys = new Set(selectedKeys);
    visibleOptions.forEach((option) => {
      if (allVisibleSelected) {
        nextSelectedKeys.delete(option.key);
      } else {
        nextSelectedKeys.add(option.key);
      }
    });
    commitSelectedKeys(nextSelectedKeys);
  };

  const selectVisibleOptionsExclusively = () => {
    if (visibleOptions.length === 0) return;
    commitSelectedKeys(new Set(visibleOptions.map((option) => option.key)));
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) setKeyword('');
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className={cn(
            'relative z-20 size-6 shrink-0',
            active && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
          )}
          aria-label={`筛选当前页：${title}`}
          aria-pressed={active}
          data-active={active ? 'true' : undefined}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <Icons.filter />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='end'
        aria-label={`筛选当前页：${title}`}
        className='flex w-60 flex-col gap-2 p-2'
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            selectVisibleOptionsExclusively();
          }}
          placeholder={`搜索${title}`}
          aria-label={`搜索${title}筛选值`}
          className='h-8 px-2'
        />
        <label
          htmlFor={selectAllId}
          className='hover:bg-accent flex h-8 cursor-default items-center gap-2 rounded-sm px-1.5 text-sm'
        >
          <Checkbox
            id={selectAllId}
            checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
            disabled={visibleOptions.length === 0}
            aria-label={`全选${title}筛选值`}
            onCheckedChange={toggleVisibleOptions}
          />
          <span>全选</span>
        </label>
        <Separator />
        <VirtualLocalFilterOptions
          options={visibleOptions}
          selectedKeys={selectedKeys}
          onToggle={toggleOption}
        />
      </PopoverContent>
    </Popover>
  );
}
