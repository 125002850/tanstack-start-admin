import type { QueryClient } from '@tanstack/react-query';
import { PermissionDeniedError } from '@/lib/api/iam/errors';
import { hasAnyIamPermission, hasIamPermission } from '@/lib/api/iam/permissions';
import { ensureIamMe } from '@/lib/api/iam/queries';
import type { IamMe } from '@/lib/api/iam/types';
import { getAppRouteStaticData, type AppRouteStaticData } from './app-route-meta';
import { buildMenuTreeLookup, resolveMenuNode } from './menu-tree-resolver';

export interface DashboardRouteGuardMatch {
  options?: { staticData?: unknown };
  staticData?: unknown;
}

export interface DashboardRouteAccessOptions {
  queryClient: QueryClient;
  matches: readonly DashboardRouteGuardMatch[];
}

function getMatchedRouteStaticData(
  matches: readonly DashboardRouteGuardMatch[]
): AppRouteStaticData[] {
  return matches.flatMap((match) => {
    const staticData = getAppRouteStaticData(match);
    return staticData ? [staticData] : [];
  });
}

function resolvePermissionFromTree(me: IamMe, staticData: AppRouteStaticData): string | undefined {
  const menuKey = staticData.nav?.menuKey;
  if (!menuKey) return undefined;

  const lookup = buildMenuTreeLookup(me.menus);
  const menuNode = resolveMenuNode(lookup, menuKey);
  if (!menuNode || menuNode.hidden || menuNode.status !== 'ENABLED') {
    throw new PermissionDeniedError();
  }

  return menuNode.permissionCode;
}

function ensureRouteStaticDataAccess(me: IamMe, staticData: AppRouteStaticData): void {
  const treePermission = resolvePermissionFromTree(me, staticData);

  if (treePermission && !hasIamPermission(me, treePermission)) {
    throw new PermissionDeniedError();
  }

  if (
    !treePermission &&
    staticData.requiredPermission &&
    !hasIamPermission(me, staticData.requiredPermission)
  ) {
    throw new PermissionDeniedError();
  }

  if (
    staticData.requiredAnyPermissions?.length &&
    !hasAnyIamPermission(me, staticData.requiredAnyPermissions)
  ) {
    throw new PermissionDeniedError();
  }
}

export async function ensureDashboardRouteAccess({
  queryClient,
  matches
}: DashboardRouteAccessOptions): Promise<IamMe> {
  const me = await ensureIamMe(queryClient);

  for (const staticData of getMatchedRouteStaticData(matches)) {
    ensureRouteStaticDataAccess(me, staticData);
  }

  return me;
}
