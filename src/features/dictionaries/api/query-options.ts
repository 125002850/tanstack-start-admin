import { queryOptions } from '@tanstack/react-query';
import type { ApiClientError } from '@oig/react-query-generator/core';

import {
  mdmDictGlobalItemsByType,
  type MdmDictGlobalItemsByTypeRequest,
  type MdmDictGlobalItemsByTypeResponse
} from '@/lib/api/clients/service';

export type DictionaryItemsQueryRequest = Omit<
  MdmDictGlobalItemsByTypeRequest,
  'condition' | 'sort'
> & {
  condition?: unknown;
  sort?: unknown;
};

export const DICTIONARY_ITEMS_BY_TYPE_QUERY_KEY_PREFIX = [
  'service',
  'mdm-dict-global-items-by-type'
] as const;

export const dictionaryItemsByTypeQueryKey = (request: DictionaryItemsQueryRequest) =>
  [...DICTIONARY_ITEMS_BY_TYPE_QUERY_KEY_PREFIX, request] as const;

export const dictionaryItemsByTypeQueryOptions = (request: DictionaryItemsQueryRequest) =>
  queryOptions<
    MdmDictGlobalItemsByTypeResponse,
    ApiClientError,
    MdmDictGlobalItemsByTypeResponse,
    ReturnType<typeof dictionaryItemsByTypeQueryKey>
  >({
    queryKey: dictionaryItemsByTypeQueryKey(request),
    queryFn: ({ signal }) =>
      mdmDictGlobalItemsByType(request as MdmDictGlobalItemsByTypeRequest, { signal })
  });
