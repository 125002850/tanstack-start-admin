import { queryOptions } from '@tanstack/react-query';
import * as React from 'react';

import type { ChoiceComboboxLoadMoreProps } from '@/components/ui/choice-combobox';
import { useRemoteComboboxState } from '@/hooks/use-remote-combobox-state';
import type {
  DataTableChoiceOption,
  DataTableChoiceValue,
  DataTableEditableChoiceColumnMeta,
  DataTableRemoteOptionPage
} from '../types';

import { getDataTableChoiceValues, mergeDataTableChoiceOptions } from './model';
import type { DataTableRemoteChoiceLabelState } from './label-provider';

type RemoteChoiceRequest = {
  keyword: string;
  pageNo: number;
  pageSize: number;
};

export type DataTableRemoteChoiceOptionsState = {
  options: DataTableChoiceOption[];
  inputValue: string;
  setInputValue(value: string): void;
  isLoading: boolean;
  isError: boolean;
  loadMore: ChoiceComboboxLoadMoreProps;
};

/** 管理 remoteSelect 搜索、分页和已选项保留；UI 不直接依赖 React Query。 */
export function useDataTableRemoteChoiceOptions<TData>({
  config,
  columnId,
  tableId,
  remoteLabelState,
  open,
  value
}: {
  config: DataTableEditableChoiceColumnMeta<TData>;
  columnId: string;
  tableId: string;
  remoteLabelState: DataTableRemoteChoiceLabelState;
  open: boolean;
  value: unknown;
}): DataTableRemoteChoiceOptionsState {
  const remoteOptions = config.remoteOptions!;
  const buildRequest = React.useCallback((params: RemoteChoiceRequest) => params, []);
  const queryOptionsFactory = React.useCallback(
    (request: RemoteChoiceRequest) =>
      queryOptions({
        queryKey: [
          'data-table-choice-options',
          tableId,
          columnId,
          request.keyword,
          request.pageNo,
          request.pageSize
        ],
        queryFn: ({ signal }) => remoteOptions.loadOptions({ ...request, signal })
      }),
    [columnId, remoteOptions, tableId]
  );
  const remoteState = useRemoteComboboxState<
    DataTableChoiceOption,
    RemoteChoiceRequest,
    DataTableRemoteOptionPage<DataTableChoiceValue>
  >({
    open,
    debounceMs: remoteOptions.debounceMs ?? 250,
    pageSize: remoteOptions.pageSize ?? 20,
    buildRequest,
    queryOptionsFactory,
    getItems: (page) => page.items,
    getTotal: (page, items) => page.total ?? items.length,
    getItemKey: (option) => option.value
  });
  const resolvedOptions = getDataTableChoiceValues(value).flatMap((selectedValue) => {
    const option = remoteLabelState.optionByValue.get(selectedValue);
    return option ? [option] : [];
  });
  const options = mergeDataTableChoiceOptions(resolvedOptions, remoteState.items);
  const loadMore = {
    visible: remoteState.hasMore,
    disabled: remoteState.isFetching,
    isLoading: remoteState.isFetching,
    label: remoteState.isFetching ? '正在加载更多' : '加载更多',
    onClick: remoteState.loadMore
  };

  return {
    options,
    inputValue: remoteState.inputValue,
    setInputValue: remoteState.setInputValue,
    isLoading: remoteState.isFetching,
    isError: remoteState.query.isError,
    loadMore
  };
}
