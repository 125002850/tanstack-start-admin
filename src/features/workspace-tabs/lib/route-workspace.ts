import type { AppRouteStaticData } from '@/lib/router/app-route-meta';
import type { ResolvedMenuNode } from '@/lib/router/menu-tree-resolver';
import { resolveTreeCached, resolveTreeLabel } from '@/lib/router/menu-tree-resolver';
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
  staticData?: AppRouteStaticData,
  treeLookup?: Map<string, ResolvedMenuNode>
): ResolvedWorkspaceConfig {
  const ws = staticData?.workspace;
  const normalizedRoutePath = normalizeWorkspaceRoutePath(routePath);
  const hasPathParam = normalizedRoutePath.includes('$');

  const menuKey = staticData?.nav?.menuKey;
  let treeCached: boolean | undefined;
  if (menuKey && treeLookup) {
    treeCached = resolveTreeCached(treeLookup, menuKey);
  }

  return {
    tagEnabled: ws?.tagEnabled ?? true,
    keepAlive: treeCached ?? ws?.keepAlive ?? true,
    closable: ws?.closable ?? !isDashboardHomeHref(normalizedRoutePath),
    instanceStrategy: ws?.instanceStrategy ?? (hasPathParam ? 'by-params' : 'global')
  };
}

export function resolveRouteTagTitle(
  staticData?: AppRouteStaticData,
  routeId?: string,
  treeLookup?: Map<string, ResolvedMenuNode>
): string {
  const menuKey = staticData?.nav?.menuKey;
  if (menuKey && treeLookup) {
    const treeLabel = resolveTreeLabel(treeLookup, menuKey);
    if (treeLabel) return treeLabel;
  }
  return staticData?.label ?? staticData?.title ?? routeId ?? '';
}
