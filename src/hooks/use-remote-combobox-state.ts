import * as React from 'react';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

type UseRemoteComboboxStateOptions<TItem, TRequest, TData> = {
  open: boolean;
  disabled?: boolean;
  debounceMs: number;
  pageSize: number;
  buildRequest: (params: { keyword: string; pageNo: number; pageSize: number }) => TRequest;
  queryOptionsFactory: (request: TRequest) => object;
  getItems: (data: TData) => TItem[];
  getTotal?: (data: TData, items: TItem[]) => number;
  getItemKey: (item: TItem) => React.Key | null | undefined;
};

type UseRemoteComboboxStateResult<TItem, TData> = {
  hasMore: boolean;
  inputValue: string;
  isFetching: boolean;
  items: TItem[];
  loadMore: () => void;
  query: UseQueryResult<TData, unknown>;
  setInputValue: (value: string) => void;
};

function mergeByKey<TItem>(
  current: TItem[],
  incoming: TItem[],
  getItemKey: (item: TItem) => React.Key | null | undefined
) {
  const seen = new Set(
    current
      .map((item) => getItemKey(item))
      .filter((key): key is React.Key => key !== null && key !== undefined)
  );
  const next = [...current];

  for (const item of incoming) {
    const key = getItemKey(item);
    if (key === null || key === undefined || seen.has(key)) continue;
    seen.add(key);
    next.push(item);
  }

  return next;
}

export function useRemoteComboboxState<TItem, TRequest, TData>({
  open,
  disabled = false,
  debounceMs,
  pageSize,
  buildRequest,
  queryOptionsFactory,
  getItems,
  getTotal,
  getItemKey
}: UseRemoteComboboxStateOptions<TItem, TRequest, TData>): UseRemoteComboboxStateResult<
  TItem,
  TData
> {
  const [pageNo, setPageNo] = React.useState(1);
  const [inputValue, setInputValue] = React.useState('');
  const [debouncedKeyword, setDebouncedKeyword] = React.useState('');
  const [items, setItems] = React.useState<TItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const appliedPageRef = React.useRef(0);
  const requestedPageRef = React.useRef(1);
  const getItemsRef = React.useRef(getItems);
  const getTotalRef = React.useRef(getTotal);
  const getItemKeyRef = React.useRef(getItemKey);

  getItemsRef.current = getItems;
  getTotalRef.current = getTotal;
  getItemKeyRef.current = getItemKey;

  React.useEffect(() => {
    if (!open) return;
    const nextKeyword = inputValue.trim();
    if (nextKeyword === debouncedKeyword) return;

    const timer = window.setTimeout(() => {
      appliedPageRef.current = 0;
      requestedPageRef.current = 1;
      setPageNo(1);
      setItems([]);
      setTotal(0);
      setDebouncedKeyword(nextKeyword);
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [debounceMs, debouncedKeyword, inputValue, open]);

  React.useEffect(() => {
    if (open) return;

    setInputValue('');
    setDebouncedKeyword('');
    appliedPageRef.current = 0;
    requestedPageRef.current = 1;
    setPageNo(1);
    setItems([]);
    setTotal(0);
  }, [open]);

  const request = React.useMemo(
    () =>
      buildRequest({
        keyword: debouncedKeyword,
        pageNo,
        pageSize
      }),
    [buildRequest, debouncedKeyword, pageNo, pageSize]
  );
  const baseQueryOptions = React.useMemo(
    () => queryOptionsFactory(request) as Record<string, unknown>,
    [queryOptionsFactory, request]
  );

  const query = useQuery({
    ...baseQueryOptions,
    enabled: open && !disabled,
    placeholderData: keepPreviousData
  } as never) as UseQueryResult<TData, unknown>;

  React.useEffect(() => {
    if (!query.data || query.isPlaceholderData) return;

    const nextItems = getItemsRef.current(query.data);
    appliedPageRef.current = pageNo;
    setTotal(getTotalRef.current?.(query.data, nextItems) ?? nextItems.length);
    setItems((current) =>
      pageNo === 1 ? nextItems : mergeByKey(current, nextItems, getItemKeyRef.current)
    );
  }, [pageNo, query.data, query.isPlaceholderData]);

  const isError = query.isError;
  const isFetching = query.isFetching;
  const refetch = query.refetch;
  const loadMore = React.useCallback(() => {
    if (!open || disabled || isFetching || items.length >= total) return;

    if (isError) {
      void refetch();
      return;
    }

    if (appliedPageRef.current !== pageNo || requestedPageRef.current !== pageNo) return;

    const nextPage = pageNo + 1;
    requestedPageRef.current = nextPage;
    setPageNo(nextPage);
  }, [disabled, isError, isFetching, items.length, open, pageNo, refetch, total]);

  return {
    hasMore: items.length < total,
    inputValue,
    isFetching: query.isFetching,
    items,
    loadMore,
    query,
    setInputValue
  };
}
