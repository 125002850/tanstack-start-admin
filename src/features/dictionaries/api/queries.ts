import { queryOptions } from '@tanstack/react-query';

import { listGlobalItemsByType, listGlobalTypes } from '@/lib/api/clients/dict';

import { normalizeDictionaryItems, normalizeDictionaryTypeList } from './adapters';

export const dictionaryTypeKeys = {
  all: ['dictionary-types'] as const,
  list: () => [...dictionaryTypeKeys.all, 'list'] as const
};

export const dictionaryItemKeys = {
  all: ['dictionary-items'] as const,
  list: (dictTypeCode: string) => [...dictionaryItemKeys.all, dictTypeCode] as const
};

export const dictionaryTypesQueryOptions = () =>
  queryOptions({
    queryKey: dictionaryTypeKeys.list(),
    queryFn: async () =>
      normalizeDictionaryTypeList(
        await listGlobalTypes({
          pageNo: 1,
          pageSize: 200
        })
      )
  });

export const dictionaryItemsQueryOptions = (dictTypeCode: string) =>
  queryOptions({
    queryKey: dictionaryItemKeys.list(dictTypeCode),
    queryFn: async () =>
      normalizeDictionaryItems(
        await listGlobalItemsByType({
          dictTypeCode
        })
      )
  });
