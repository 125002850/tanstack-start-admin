import * as React from 'react';

import type { DictTypes } from '@/constants/dictTypes';
import {
  DictionaryContext,
  EMPTY_DICT_BATCH,
  normalizeDictTypes,
  useDicts
} from '@/hooks/use-dict';

interface DictionaryScopeProps {
  typeCodes: readonly DictTypes[];
  children: React.ReactNode;
}

/**
 * Page-level dictionary scope. Tables fetch dictionary types once here; cell
 * renderers only read context and can never produce per-cell network calls.
 */
export function DictionaryScope({ typeCodes, children }: DictionaryScopeProps) {
  const normalizedTypeCodes = React.useMemo(() => normalizeDictTypes(typeCodes), [typeCodes]);
  const dictionaries = useDicts(typeCodes);
  const {
    data,
    error,
    isError,
    isFetching,
    isPending,
    refetch: refetchDictionaries
  } = dictionaries;
  const refetch = React.useCallback(() => {
    void refetchDictionaries();
  }, [refetchDictionaries]);
  const value = React.useMemo(
    () => ({
      batch: data ?? EMPTY_DICT_BATCH,
      declaredTypes: new Set(normalizedTypeCodes),
      error,
      isError,
      isFetching,
      isPending,
      refetch
    }),
    [data, error, isError, isFetching, isPending, normalizedTypeCodes, refetch]
  );
  return <DictionaryContext.Provider value={value}>{children}</DictionaryContext.Provider>;
}

interface DictTextProps {
  typeCode: DictTypes;
  value: string | number | null | undefined;
  emptyText?: React.ReactNode;
}

export function DictText({ typeCode, value, emptyText = '-' }: DictTextProps) {
  const dictionaries = React.useContext(DictionaryContext);
  if (value === null || value === undefined || value === '') return emptyText;
  const code = String(value);
  return dictionaries.batch.byType.get(typeCode)?.codeMap.get(code) ?? code;
}
