import * as React from 'react';

import type { DictTypes } from '@/constants/dictTypes';
import { EMPTY_DICT_BATCH, useDicts, type DictBatchData } from '@/hooks/use-dict';

const DictionaryContext = React.createContext<DictBatchData>(EMPTY_DICT_BATCH);

interface DictionaryScopeProps {
  typeCodes: readonly DictTypes[];
  children: React.ReactNode;
}

/**
 * Page-level dictionary scope. Tables fetch dictionary types once here; cell
 * renderers only read context and can never produce per-cell network calls.
 */
export function DictionaryScope({ typeCodes, children }: DictionaryScopeProps) {
  const dictionaries = useDicts(typeCodes);
  return (
    <DictionaryContext.Provider value={dictionaries.data ?? EMPTY_DICT_BATCH}>
      {children}
    </DictionaryContext.Provider>
  );
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
  return dictionaries.byType.get(typeCode)?.codeMap.get(code) ?? code;
}
