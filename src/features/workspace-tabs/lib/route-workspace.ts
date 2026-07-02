import type { AppRouteStaticData } from '@/lib/router/app-route-meta';
import { isDashboardHomeHref } from '@/lib/router/dashboard-home';

export interface ResolvedWorkspaceConfig {
  tagEnabled: boolean;
  keepAlive: boolean;
  closable: boolean;
  instanceStrategy: 'global' | 'by-params';
}

function normalizeWorkspaceRoutePath(routePath: string): string {
  if (routePath.length <= 1) return routePath;
  return routePath.endsWith('/') ? routePath.slice(0, -1) : routePath;
}

export function resolveRouteWorkspaceConfig(
  routePath: string,
  staticData?: AppRouteStaticData
): ResolvedWorkspaceConfig {
  const ws = staticData?.workspace;
  const normalizedRoutePath = normalizeWorkspaceRoutePath(routePath);
  const hasPathParam = normalizedRoutePath.includes('$');
  return {
    tagEnabled: ws?.tagEnabled ?? true,
    keepAlive: ws?.keepAlive ?? true,
    closable: ws?.closable ?? !isDashboardHomeHref(normalizedRoutePath),
    instanceStrategy: ws?.instanceStrategy ?? (hasPathParam ? 'by-params' : 'global')
  };
}

export function resolveRouteTagTitle(staticData?: AppRouteStaticData, routeId?: string): string {
  return staticData?.label ?? staticData?.title ?? routeId ?? '';
}
