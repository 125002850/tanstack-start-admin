import { queryOptions } from '@tanstack/react-query';
import type { GetQuerySceneMetadataResponse } from '@/lib/api/clients/service';
import metadata from './fixtures/query-scene-metadata.json';

// QuerySceneMetadataTests 导出响应的精简样本，保留页面测试使用的字段；不参与生产配置。
export const querySceneMetadataFixture = metadata as GetQuerySceneMetadataResponse;

export function mockQuerySceneMetadataQueryOptions() {
  return queryOptions({
    queryKey: ['test-query-scene-metadata'],
    queryFn: async () => querySceneMetadataFixture
  });
}

export function mockQuerySchemesQueryOptions(request: { sceneCode: string }) {
  return queryOptions({
    queryKey: ['test-query-schemes', request],
    queryFn: async () => []
  });
}
