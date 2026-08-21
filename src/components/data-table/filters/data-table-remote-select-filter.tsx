import { queryOptions } from '@tanstack/react-query';
import type { Column } from '@tanstack/react-table';
import * as React from 'react';

import { DataTableFilterTrigger } from '@/components/data-table/filters/data-table-filter-trigger';
import type {
  DataTableFilterOption,
  DataTableRemoteFilterOptions,
  DataTableRemoteFilterPage
} from '@/components/data-table/filters/types';
import { SingleChoiceCombobox } from '@/components/ui/choice-combobox';
import { useRemoteComboboxState } from '@/hooks/use-remote-combobox-state';

interface RemoteFilterRequest {
  keyword: string;
  pageNo: number;
  pageSize: number;
}

interface DataTableRemoteSelectFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  remoteOptions: DataTableRemoteFilterOptions;
  tableId: string;
}

function getSelectedValue(filterValue: unknown): string | null {
  if (!Array.isArray(filterValue)) return null;
  const selectedValue = filterValue.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  );
  return selectedValue?.trim() ?? null;
}

/** 统一样式的服务端远程单选筛选器，业务只负责提供 loadOptions。 */
export function DataTableRemoteSelectFilter<TData, TValue>({
  column,
  title,
  remoteOptions,
  tableId
}: DataTableRemoteSelectFilterProps<TData, TValue>) {
  const [open, setOpen] = React.useState(false);
  const [selectedOption, setSelectedOption] = React.useState<DataTableFilterOption | null>(null);
  const selectedValue = getSelectedValue(column.getFilterValue());
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
    const matchingSelectedOption =
      selectedOption?.value === selectedValue
        ? selectedOption
        : remoteState.items.find((option) => option.value === selectedValue);
    if (selectedValue) {
      optionByValue.set(
        selectedValue,
        matchingSelectedOption ?? { value: selectedValue, label: selectedValue }
      );
    }
    for (const option of remoteState.items) optionByValue.set(option.value, option);
    return [...optionByValue.values()];
  }, [remoteState.items, selectedOption, selectedValue]);
  const activeOption = selectedValue
    ? (options.find((option) => option.value === selectedValue) ?? null)
    : null;

  const handleValueChange = React.useCallback(
    (nextValue: string | null) => {
      if (!nextValue) {
        setSelectedOption(null);
        column.setFilterValue(undefined);
        return;
      }

      setSelectedOption(options.find((option) => option.value === nextValue) ?? null);
      column.setFilterValue([nextValue]);
    },
    [column, options]
  );
  const handleClear = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      handleValueChange(null);
    },
    [handleValueChange]
  );
  const labels = remoteOptions.labels;

  return (
    <SingleChoiceCombobox
      open={open}
      onOpenChange={setOpen}
      value={selectedValue}
      onValueChange={handleValueChange}
      options={options}
      triggerLabel={title}
      placeholder={title}
      searchMode='remote'
      searchPlaceholder={labels?.searchPlaceholder ?? `搜索${title}`}
      emptyText={labels?.emptyText ?? '暂无匹配项'}
      loadingText={labels?.loadingText ?? '正在加载'}
      errorText={labels?.errorText ?? '加载失败，请重试'}
      clearLabel={labels?.clearLabel ?? '清除筛选'}
      inputValue={remoteState.inputValue}
      onInputValueChange={remoteState.setInputValue}
      isLoading={remoteState.isFetching}
      isError={remoteState.query.isError}
      loadMore={{
        visible: remoteState.hasMore,
        disabled: remoteState.isFetching,
        isLoading: remoteState.isFetching,
        label: labels?.loadMoreLabel ?? '正在加载更多',
        onClick: remoteState.loadMore
      }}
      contentClassName='w-72'
      renderTrigger={(triggerProps) => (
        <DataTableFilterTrigger
          {...triggerProps}
          title={title}
          state={
            selectedValue && activeOption
              ? {
                  status: 'active',
                  onClear: handleClear,
                  selection: {
                    kind: 'labels',
                    count: 1,
                    items: [{ key: activeOption.value, label: activeOption.label }]
                  }
                }
              : { status: 'idle' }
          }
        />
      )}
    />
  );
}
