import { useQuery } from '@tanstack/react-query';

import {
  QUERY_SCENE_METADATA_STALE_TIME,
  querySceneMetadataQueryOptions
} from '@/lib/api/query-scene-metadata';

/** 登录后常驻，避免每个保活页面各自启动刷新定时器。 */
export function QuerySceneMetadataBootstrap() {
  useQuery({
    ...querySceneMetadataQueryOptions(),
    refetchInterval: QUERY_SCENE_METADATA_STALE_TIME
  });
  return null;
}
