import { useCallback, useMemo, useRef } from 'react';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { mdmDictGlobalItemsByType, type MdmDictGlobalItemsByTypeRequest } from '@/lib/api/clients/service';
import type { Option } from '@/types';
import { DictTypes } from '@/constants/dictTypes';

interface DictData {
  codeMap: Map<string, string>;
  labelMap: Map<string, string>;
  options: Option[];
}

const EMPTY_OPTIONS: Option[] = [];

function buildDictData(response: { list?: Array<{ dictItemCode?: string; dictItemName?: string; sortOrder?: number }> }): DictData {
  const items = response?.list ?? [];
  const sorted = items.toSorted((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const codeMap = new Map<string, string>();
  const labelMap = new Map<string, string>();
  const options: Option[] = [];

  for (const item of sorted) {
    if (item.dictItemCode && item.dictItemName) {
      codeMap.set(item.dictItemCode, item.dictItemName);
      labelMap.set(item.dictItemName, item.dictItemCode);
      options.push({ value: item.dictItemCode, label: item.dictItemName });
    }
  }

  return { codeMap, labelMap, options };
}

export function useDict(typeCode: DictTypes) {
  const request = useMemo(
    () => ({
      pageNo: 1,
      pageSize: 200,
      condition: {
        nodeType: 'text' as const,
        field: 'dictTypeCode',
        op: 'EQ' as const,
        value: typeCode
      }
    }),
    [typeCode]
  );

  const codeMapRef = useRef<Map<string, string>>(new Map());
  const optionsRef = useRef<Option[]>(EMPTY_OPTIONS);

  const selectFn = useCallback(buildDictData, []);

  const { data, error, isError, isFetching, isPending, refetch } = useQuery({
    ...queryOptions({
      queryKey: ['service', 'mdm-dict-global-items-by-type', request] as const,
      queryFn: ({ signal }) => mdmDictGlobalItemsByType(request as MdmDictGlobalItemsByTypeRequest, { signal })
    }),
    enabled: !!typeCode,
    staleTime: 5 * 60 * 1000,
    select: selectFn
  });

  if (data) {
    codeMapRef.current = data.codeMap;
    optionsRef.current = data.options.length > 0 ? data.options : EMPTY_OPTIONS;
  }

  const getLabel = useCallback(
    (code: string): string => codeMapRef.current.get(code) ?? code,
    []
  );

  const getCode = useCallback(
    (label: string): string | undefined => {
      if (!data) return undefined;
      return data.labelMap.get(label);
    },
    [data]
  );

  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    options: optionsRef.current,
    getLabel,
    getCode,
    refresh,
    error,
    isError,
    isFetching,
    isPending,
    loading: isPending,
    isEmpty: !isPending && !isError && optionsRef.current.length === 0
  };
}
