import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import { systemDictGlobalItemsOptions } from '@/lib/api/clients/service';
import type { DictOptionGroupRspDTO } from '@/lib/api/clients/service';
import type { Option } from '@/types';
import type { DictTypes } from '@/constants/dictTypes';

export interface DictData {
  codeMap: ReadonlyMap<string, string>;
  labelMap: ReadonlyMap<string, string>;
  /** Only enabled items are selectable; disabled items remain in codeMap for historic rows. */
  options: readonly Option[];
}

export interface DictBatchData {
  byType: ReadonlyMap<string, DictData>;
}

const EMPTY_DICT_DATA: DictData = {
  codeMap: new Map(),
  labelMap: new Map(),
  options: []
};

export const EMPTY_DICT_BATCH: DictBatchData = { byType: new Map() };

export function normalizeDictTypes(typeCodes: readonly string[]): string[] {
  return [...new Set(typeCodes.map((code) => code.trim()).filter(Boolean))].toSorted();
}

export function buildDictBatch(groups: readonly DictOptionGroupRspDTO[]): DictBatchData {
  const byType = new Map<string, DictData>();

  for (const group of groups) {
    if (!group.dictTypeCode) continue;

    const codeMap = new Map<string, string>();
    const labelMap = new Map<string, string>();
    const options: Option[] = [];
    const items = [...(group.items ?? [])].toSorted(
      (left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
    );

    for (const item of items) {
      if (!item.code || !item.name) continue;
      codeMap.set(item.code, item.name);
      labelMap.set(item.name, item.code);
      if (item.status === 'enable') {
        options.push({ value: item.code, label: item.name });
      }
    }

    byType.set(group.dictTypeCode, { codeMap, labelMap, options });
  }

  return { byType };
}

/** Fetches all requested dictionaries with one generated-client request and one query-cache entry. */
export function useDicts(typeCodes: readonly DictTypes[]) {
  const normalizedTypeCodes = normalizeDictTypes(typeCodes);
  const queryKey = ['service', 'system-dict-global-items-options', normalizedTypeCodes] as const;

  return useQuery({
    queryKey,
    queryFn: async ({ signal }) =>
      (await systemDictGlobalItemsOptions({ dictTypeCodes: normalizedTypeCodes }, { signal })) ??
      [],
    enabled: normalizedTypeCodes.length > 0,
    staleTime: 5 * 60 * 1000,
    select: buildDictBatch
  });
}

export function useDict(typeCode: DictTypes) {
  const query = useDicts(typeCode ? [typeCode] : []);
  const data = query.data?.byType.get(typeCode) ?? EMPTY_DICT_DATA;
  const { refetch } = query;

  const getLabel = useCallback((code: string): string => data.codeMap.get(code) ?? code, [data]);
  const getCode = useCallback(
    (label: string): string | undefined => data.labelMap.get(label),
    [data]
  );
  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    options: data.options,
    getLabel,
    getCode,
    refresh,
    error: query.error,
    isError: query.isError,
    isFetching: query.isFetching,
    isPending: query.isPending,
    loading: query.isPending,
    isEmpty: !query.isPending && !query.isError && data.options.length === 0
  };
}
