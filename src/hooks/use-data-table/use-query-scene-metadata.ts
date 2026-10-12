import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';

import { querySceneMetadataQueryOptions } from '@/lib/api/query-scene-metadata';
import type { DataTableAdvancedSearchConfig } from '@/types/data-table';
import { resolveAdvancedSearchFields } from '@/lib/data-table/advanced-search';

export function useQuerySceneMetadata<TData>({
  sceneCode,
  columns,
  advancedSearchFields
}: {
  sceneCode?: string;
  columns: ColumnDef<TData>[];
  advancedSearchFields?: Readonly<Record<string, DataTableAdvancedSearchConfig>>;
}) {
  const { data, error, refetch } = useQuery({
    ...querySceneMetadataQueryOptions(),
    enabled: Boolean(sceneCode)
  });
  const sceneMetadata = sceneCode ? data?.[sceneCode] : undefined;
  const metadataReady = !sceneCode || Boolean(sceneMetadata);
  const metadataError = useMemo(() => {
    if (metadataReady) return null;
    return error ?? (data ? new Error(`未找到查询场景：${sceneCode}`) : null);
  }, [metadataReady, error, data, sceneCode]);
  const advancedFields = useMemo(
    () =>
      resolveAdvancedSearchFields(
        columns,
        advancedSearchFields,
        sceneCode ? (sceneMetadata?.fields ?? {}) : undefined
      ),
    [columns, advancedSearchFields, sceneCode, sceneMetadata]
  );

  return { sceneMetadata, metadataReady, metadataError, advancedFields, refetchMetadata: refetch };
}
