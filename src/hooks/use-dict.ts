import * as React from 'react';
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

export interface DictionaryContextValue {
  batch: DictBatchData;
  declaredTypes: ReadonlySet<string>;
  error: Error | null;
  isError: boolean;
  isFetching: boolean;
  isPending: boolean;
  refetch: () => void;
}

const EMPTY_DICT_DATA: DictData = {
  codeMap: new Map(),
  labelMap: new Map(),
  options: []
};

export const EMPTY_DICT_BATCH: DictBatchData = { byType: new Map() };

export const DictionaryContext = React.createContext<DictionaryContextValue>({
  batch: EMPTY_DICT_BATCH,
  declaredTypes: new Set(),
  error: null,
  isError: false,
  isFetching: false,
  isPending: false,
  refetch: () => undefined
});

export function normalizeDictTypes(typeCodes: readonly string[]): string[] {
  return [...new Set(typeCodes.map((code) => code.trim()).filter(Boolean))].toSorted();
}

export function dictionaryOptionsWithCodeFallback<const TCode extends string>(
  options: readonly Option[],
  codes: readonly TCode[]
): readonly { value: TCode; label: string }[] {
  const allowedCodes = new Set<string>(codes);
  const matchingOptions = options.filter((option): option is Option & { value: TCode } =>
    allowedCodes.has(String(option.value))
  );
  return matchingOptions.length > 0
    ? matchingOptions
    : codes.map((value) => ({ value, label: value }));
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
  const scope = React.useContext(DictionaryContext);
  const isProvidedByScope = scope.declaredTypes.has(typeCode);
  const query = useDicts(isProvidedByScope || !typeCode ? [] : [typeCode]);
  const data =
    (isProvidedByScope ? scope.batch : query.data)?.byType.get(typeCode) ?? EMPTY_DICT_DATA;
  const error = isProvidedByScope ? scope.error : query.error;
  const isError = isProvidedByScope ? scope.isError : query.isError;
  const isFetching = isProvidedByScope ? scope.isFetching : query.isFetching;
  const isPending = isProvidedByScope ? scope.isPending : query.isPending;
  const { refetch: scopeRefetch } = scope;
  const { refetch: queryRefetch } = query;

  const getLabel = React.useCallback(
    (code: string): string => data.codeMap.get(code) ?? code,
    [data]
  );
  const getCode = React.useCallback(
    (label: string): string | undefined => data.labelMap.get(label),
    [data]
  );
  const refresh = React.useCallback(() => {
    if (isProvidedByScope) {
      scopeRefetch();
      return;
    }
    void queryRefetch();
  }, [isProvidedByScope, queryRefetch, scopeRefetch]);

  return {
    options: data.options,
    getLabel,
    getCode,
    refresh,
    error,
    isError,
    isFetching,
    isPending,
    loading: isPending,
    isEmpty: !isPending && !isError && data.options.length === 0
  };
}
