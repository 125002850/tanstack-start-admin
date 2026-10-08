import type { QueryClient } from '@tanstack/react-query';

import { ensureSsoLoginInfo } from '@/lib/api/sso/queries';
import { HTTP_STATUS_FORBIDDEN } from '@/lib/http-status';

import { collectVisibleMenuKeys, normalizeMenuKey } from './nav-permissions';

export interface RouteBeforeLoadContext {
  context: {
    queryClient: QueryClient;
  };
}

export class RouteAccessForbiddenError extends Error {
  readonly status = HTTP_STATUS_FORBIDDEN;
  readonly menuKey: string;

  constructor(menuKey: string, message = '当前账号没有访问该页面的权限') {
    super(message);
    this.name = 'RouteAccessForbiddenError';
    this.menuKey = menuKey;
  }
}

export function isRouteAccessForbiddenError(error: unknown): error is RouteAccessForbiddenError {
  if (error instanceof RouteAccessForbiddenError) return true;
  if (!error || typeof error !== 'object') return false;

  const record = error as Record<string, unknown>;
  return record.name === 'RouteAccessForbiddenError' && record.status === HTTP_STATUS_FORBIDDEN;
}

export async function ensureMenuPermission(queryClient: QueryClient, menuKey: string) {
  const normalizedMenuKey = normalizeMenuKey(menuKey);
  if (!normalizedMenuKey) return;

  const loginUser = await ensureSsoLoginInfo(queryClient);
  const allowedMenuKeys = collectVisibleMenuKeys(loginUser.menuData);

  if (!allowedMenuKeys.has(normalizedMenuKey)) {
    throw new RouteAccessForbiddenError(normalizedMenuKey);
  }
}

export function createMenuPermissionBeforeLoad(menuKey: string) {
  return ({ context }: RouteBeforeLoadContext) =>
    ensureMenuPermission(context.queryClient, menuKey);
}

export function ensureFeatureAvailable(enabled: boolean, featureKey: string) {
  if (!enabled) {
    throw new RouteAccessForbiddenError(`feature:${featureKey}`, '当前功能暂未开放');
  }
}

export function createFeatureAvailabilityBeforeLoad(enabled: boolean, featureKey: string) {
  return (_context: RouteBeforeLoadContext) => ensureFeatureAvailable(enabled, featureKey);
}
