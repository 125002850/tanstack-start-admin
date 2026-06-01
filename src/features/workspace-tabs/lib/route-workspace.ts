import type { AppRouteStaticData } from '@/lib/router/app-route-meta';

export interface ResolvedWorkspaceConfig {
  tagEnabled: boolean;
  keepAlive: boolean;
  instanceStrategy: 'global' | 'by-params';
}

export function resolveRouteWorkspaceConfig(
  routePath: string,
  staticData?: AppRouteStaticData
): ResolvedWorkspaceConfig {
  const ws = staticData?.workspace;
  const hasPathParam = routePath.includes('$');
  return {
    tagEnabled: ws?.tagEnabled ?? true,
    keepAlive: ws?.keepAlive ?? true,
    instanceStrategy: ws?.instanceStrategy ?? (hasPathParam ? 'by-params' : 'global')
  };
}

export function resolveRouteTagTitle(staticData?: AppRouteStaticData, routeId?: string): string {
  return staticData?.label ?? staticData?.title ?? staticData?.page?.title ?? routeId ?? '';
}
