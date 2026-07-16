import type { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSso = vi.hoisted(() => ({
  ensureSsoLoginInfo: vi.fn()
}));

vi.mock('@/lib/api/sso/queries', () => ({
  ensureSsoLoginInfo: mockSso.ensureSsoLoginInfo
}));

import {
  createMenuPermissionBeforeLoad,
  ensureMenuPermission,
  isRouteAccessForbiddenError,
  RouteAccessForbiddenError
} from './route-access';

const queryClient = {} as QueryClient;

describe('route access', () => {
  beforeEach(() => {
    mockSso.ensureSsoLoginInfo.mockReset();
  });

  it('allows a route when SSO menuData contains its normalized menu key', async () => {
    mockSso.ensureSsoLoginInfo.mockResolvedValue({
      menuData: [
        {
          code: 'track-bench:dict-management',
          hiddenFlag: 'N',
          children: []
        }
      ]
    });

    await expect(ensureMenuPermission(queryClient, 'dict-management')).resolves.toBeUndefined();
  });

  it('throws a route-specific 403 when the menu key is absent', async () => {
    mockSso.ensureSsoLoginInfo.mockResolvedValue({
      menuData: [
        {
          code: 'track-bench:track-owner-rel',
          hiddenFlag: 'N',
          children: []
        }
      ]
    });

    const promise = ensureMenuPermission(queryClient, 'dict-management');

    await expect(promise).rejects.toBeInstanceOf(RouteAccessForbiddenError);
    await expect(promise).rejects.toMatchObject({
      status: 403,
      menuKey: 'dict-management'
    });
  });

  it('does not grant access from a hidden menu node', async () => {
    mockSso.ensureSsoLoginInfo.mockResolvedValue({
      menuData: [
        {
          code: 'track-bench:dict-management',
          hiddenFlag: 'Y',
          children: []
        }
      ]
    });

    await expect(ensureMenuPermission(queryClient, 'dict-management')).rejects.toMatchObject({
      name: 'RouteAccessForbiddenError',
      status: 403
    });
  });

  it('creates a beforeLoad guard that checks the router query client', async () => {
    mockSso.ensureSsoLoginInfo.mockResolvedValue({ menuData: [] });
    const beforeLoad = createMenuPermissionBeforeLoad('dict-management');

    await expect(beforeLoad({ context: { queryClient } })).rejects.toMatchObject({
      menuKey: 'dict-management'
    });
    expect(mockSso.ensureSsoLoginInfo).toHaveBeenCalledWith(queryClient);
  });

  it('recognizes structurally equivalent route access errors', () => {
    expect(isRouteAccessForbiddenError({ name: 'RouteAccessForbiddenError', status: 403 })).toBe(
      true
    );
    expect(isRouteAccessForbiddenError({ name: 'Error', status: 403 })).toBe(false);
  });
});
