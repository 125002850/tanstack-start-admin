import { queryOptions } from '@tanstack/react-query';
import type { Column } from '@tanstack/react-table';
import * as React from 'react';

import { DataTableFilterTrigger } from '@/components/data-table/filters/data-table-filter-trigger';
import type {
  DataTableFilterOption,
  DataTableRemoteFilterOptions,
  DataTableRemoteFilterPage
} from '@/components/data-table/filters/types';
import { MultipleChoiceCombobox, SingleChoiceCombobox } from '@/components/ui/choice-combobox';
import { useRemoteComboboxState } from '@/hooks/use-remote-combobox-state';

interface RemoteFilterRequest {
  keyword: string;
  pageNo: number;
  pageSize: number;
}

interface DataTableRemoteSelectFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
  multiple?: boolean;
  title: string;
  remoteOptions: DataTableRemoteFilterOptions;
  tableId: string;
}

function getSelectedValues(filterValue: unknown, multiple: boolean): string[] {
  if (!Array.isArray(filterValue)) return [];
  const values = filterValue.flatMap((value) => {
    if (typeof value !== 'string') return [];
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  });
  const uniqueValues = [...new Set(values)];
  return multiple ? uniqueValues : uniqueValues.slice(0, 1);
}

/** 统一样式的服务端远程单/多选筛选器，业务只负责提供 loadOptions。 */
export function DataTableRemoteSelectFilter<TData, TValue>({
  column,
  multiple = false,
  title,
  remoteOptions,
  tableId
}: DataTableRemoteSelectFilterProps<TData, TValue>) {
  const [open, setOpen] = React.useState(false);
  const [knownSelectedOptions, setKnownSelectedOptions] = React.useState<
    Map<string, DataTableFilterOption>
  >(() => new Map());
  const filterValue = column.getFilterValue();
  const selectedValues = React.useMemo(
    () => getSelectedValues(filterValue, multiple),
    [filterValue, multiple]
  );
  const pageSize = remoteOptions.pageSize ?? 20;
  const debounceMs = remoteOptions.debounceMs ?? 250;

  const buildRequest = React.useCallback((request: RemoteFilterRequest) => request, []);
  const queryOptionsFactory = React.useCallback(
    (request: RemoteFilterRequest) =>
      queryOptions({
        queryKey: [
          'data-table-remote-filter',
          tableId,
          column.id,
          request.keyword,
          request.pageNo,
          request.pageSize
        ],
        queryFn: ({ signal }) => remoteOptions.loadOptions({ ...request, signal })
      }),
    [column.id, remoteOptions, tableId]
  );
  const remoteState = useRemoteComboboxState<
    DataTableFilterOption,
    RemoteFilterRequest,
    DataTableRemoteFilterPage
  >({
    open,
    debounceMs,
    pageSize,
    buildRequest,
    queryOptionsFactory,
    getItems: (page) => page.items,
    getTotal: (page, items) => page.total ?? items.length,
    getItemKey: (option) => option.value
  });

  const options = React.useMemo(() => {
    const optionByValue = new Map<string, DataTableFilterOption>();
    for (const selectedValue of selectedValues) {
      const matchingSelectedOption =
        knownSelectedOptions.get(selectedValue) ??
        remoteState.items.find((option) => option.value === selectedValue);
      optionByValue.set(
        selectedValue,
        matchingSelectedOption ?? { value: selectedValue, label: selectedValue }
      );
    }
    for (const option of remoteState.items) optionByValue.set(option.value, option);
    return [...optionByValue.values()];
  }, [knownSelectedOptions, remoteState.items, selectedValues]);
  const activeOptions = React.useMemo(
    () => selectedValues.flatMap((value) => options.find((option) => option.value === value) ?? []),
    [options, selectedValues]
  );

  const handleValuesChange = React.useCallback(
    (nextValues: string[]) => {
      const normalizedValues = getSelectedValues(nextValues, multiple);
      setKnownSelectedOptions((current) => {
        const next = new Map(current);
        for (const value of normalizedValues) {
          const option = options.find((candidate) => candidate.value === value);
          if (option) next.set(value, option);
        }
        return next;
      });
      if (normalizedValues.length === 0) {
        column.setFilterValue(undefined);
      } else {
        column.setFilterValue(normalizedValues);
      }
    },
    [column, multiple, options]
  );
  const handleClear = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      handleValuesChange([]);
    },
    [handleValuesChange]
  );
  const labels = remoteOptions.labels;
  const commonProps = {
    open,
    onOpenChange: setOpen,
    options,
    triggerLabel: title,
    placeholder: title,
    searchMode: 'remote' as const,
    searchPlaceholder: labels?.searchPlaceholder ?? `搜索${title}`,
    emptyText: labels?.emptyText ?? '暂无匹配项',
    loadingText: labels?.loadingText ?? '正在加载',
    errorText: labels?.errorText ?? '加载失败，请重试',
    clearLabel: labels?.clearLabel ?? '清除筛选',
    inputValue: remoteState.inputValue,
    onInputValueChange: remoteState.setInputValue,
    isLoading: remoteState.isFetching,
    isError: remoteState.query.isError,
    loadMore: {
      visible: remoteState.hasMore,
      disabled: remoteState.isFetching,
      isLoading: remoteState.isFetching,
      label: labels?.loadMoreLabel ?? '正在加载更多',
      onClick: remoteState.loadMore
    },
    contentClassName: 'data-table-filter-popover w-72',
    renderTrigger: (triggerProps: React.ComponentProps<typeof DataTableFilterTrigger>) => (
      <DataTableFilterTrigger
        {...triggerProps}
        title={title}
        state={
          activeOptions.length > 0
            ? {
                status: 'active' as const,
                onClear: handleClear,
                selection: {
                  kind: 'labels' as const,
                  count: activeOptions.length,
                  items: activeOptions.map((option) => ({
                    key: option.value,
                    label: option.label
                  }))
                }
              }
            : { status: 'idle' as const }
        }
      />
    )
  };

  return multiple ? (
    <MultipleChoiceCombobox
      {...commonProps}
      value={selectedValues}
      onValueChange={handleValuesChange}
      maxSelected={remoteOptions.maxSelected}
    />
  ) : (
    <SingleChoiceCombobox
      {...commonProps}
      value={selectedValues[0] ?? null}
      onValueChange={(value) => handleValuesChange(value ? [value] : [])}
    />
  );
}
