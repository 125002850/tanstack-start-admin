import type { Option } from './types';
import type { Column } from '@tanstack/react-table';
import * as React from 'react';
import {
  MultipleChoiceCombobox,
  SingleChoiceCombobox,
  type ChoiceComboboxTriggerProps
} from '@/components/ui/choice-combobox';
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
  /** 非 column 筛选器通过 value/onValueChange 管理查询范围。 */
  value?: readonly string[];
  onValueChange?: (value: string[] | undefined) => void;
  clearable?: boolean;
  labels?: DataTableFacetedFilterLabels;
}

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
  multiple,
  value,
  onValueChange,
  clearable = true,
  labels
}: DataTableFacetedFilterProps<TData, TValue>) {
  const [open, setOpen] = React.useState(false);

  const columnFilterValue = value ?? column?.getFilterValue();
  const setFilterValue = React.useCallback(
    (next: string[] | undefined) => {
      if (onValueChange) onValueChange(next);
      else column?.setFilterValue(next);
    },
    [column, onValueChange]
  );
  const selectedValues = React.useMemo(
    () => new Set(Array.isArray(columnFilterValue) ? columnFilterValue : []),
    [columnFilterValue]
  );

  const onReset = React.useCallback(
    (event?: React.MouseEvent) => {
      event?.preventDefault();
      event?.stopPropagation();
      if (clearable) setFilterValue(undefined);
    },
    [clearable, setFilterValue]
  );

  const commonProps = {
    open,
    onOpenChange: setOpen,
    options,
    triggerLabel: title ?? '筛选',
    placeholder: title ?? '筛选',
    searchMode: 'local' as const,
    searchPlaceholder: labels?.inputPlaceholder?.(title) ?? `筛选${title ?? ''}`,
    emptyText: labels?.emptyMessage ?? '未找到匹配项',
    clearLabel: labels?.clearFiltersText ?? '清除筛选',
    allowEmpty: clearable,
    contentClassName: 'data-table-filter-popover w-72',
    renderTrigger: (triggerProps: ChoiceComboboxTriggerProps) => (
      <DataTableFilterTrigger
        {...triggerProps}
        title={title}
        state={
          selectedValues.size > 0
            ? {
                status: 'active',
                onClear: clearable ? onReset : undefined,
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
    )
  };
  return multiple ? (
    <MultipleChoiceCombobox
      {...commonProps}
      value={Array.from(selectedValues)}
      onValueChange={(next) => setFilterValue(next.length ? next : undefined)}
    />
  ) : (
    <SingleChoiceCombobox
      {...commonProps}
      value={Array.from(selectedValues)[0] ?? null}
      onValueChange={(next) => setFilterValue(next == null ? undefined : [next])}
    />
  );
}
