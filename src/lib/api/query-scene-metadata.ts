import { queryOptions } from '@tanstack/react-query';

import { getQuerySceneMetadataQueryOptions } from '@/lib/api/clients/service';

export const QUERY_SCENE_METADATA_STALE_TIME = 300_000;
const QUERY_SCENE_METADATA_GC_TIME = 1_800_000;

/** 所有场景共享一个查询键；页面订阅此缓存，轮询只在应用初始化组件挂载。 */
export function querySceneMetadataQueryOptions() {
  return queryOptions({
    ...getQuerySceneMetadataQueryOptions(),
    staleTime: QUERY_SCENE_METADATA_STALE_TIME,
    gcTime: QUERY_SCENE_METADATA_GC_TIME,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });
}
