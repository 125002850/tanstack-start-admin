import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionDeniedError } from '@/lib/api/iam/errors';
import type { IamMe } from '@/lib/api/iam/types';
import { ensureDashboardRouteAccess, type DashboardRouteGuardMatch } from './dashboard-route-guard';

const mockEnsureIamMe = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/iam/queries', () => ({
  ensureIamMe: mockEnsureIamMe
}));

function createMe(overrides: Partial<IamMe> = {}): IamMe {
  return {
    staff: {
      staffId: '1',
      username: 'admin',
      staffName: '管理员',
      status: 'ENABLED'
    },
    roles: [],
    permissions: [],
    menus: [],
    dataScopeSummary: {
      effectiveType: 'ALL',
      includeSelf: true,
      description: '全部数据'
    },
    dataScope: {
      effectiveType: 'ALL',
      includeSelf: true,
      description: '全部数据'
    },
    mustChangePassword: false,
    ...overrides
  };
}

function createMatch(staticData: Record<string, unknown>): DashboardRouteGuardMatch {
  return { staticData };
}

describe('ensureDashboardRouteAccess', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    mockEnsureIamMe.mockReset();
  });

  it('allows dashboard routes without explicit permission metadata', async () => {
    const me = createMe();
    mockEnsureIamMe.mockResolvedValue(me);

    await expect(
      ensureDashboardRouteAccess({
        queryClient,
        matches: [createMatch({ label: '工作台' })]
      })
    ).resolves.toBe(me);
  });

  it('allows routes when the current account owns requiredPermission', async () => {
    const me = createMe({ permissions: ['system:staff:query'] });
    mockEnsureIamMe.mockResolvedValue(me);

    await expect(
      ensureDashboardRouteAccess({
        queryClient,
        matches: [
          createMatch({ label: '工作台' }),
          createMatch({ label: '员工管理', requiredPermission: 'system:staff:query' })
        ]
      })
    ).resolves.toBe(me);
  });

  it('allows routes when any required permission matches', async () => {
    const me = createMe({ permissions: ['system:role:query'] });
    mockEnsureIamMe.mockResolvedValue(me);

    await expect(
      ensureDashboardRouteAccess({
        queryClient,
        matches: [
          createMatch({
            label: '角色管理',
            requiredAnyPermissions: ['system:role:create', 'system:role:query']
          })
        ]
      })
    ).resolves.toBe(me);
  });

  it('denies routes when permission metadata is not satisfied', async () => {
    mockEnsureIamMe.mockResolvedValue(createMe({ permissions: ['system:staff:query'] }));

    await expect(
      ensureDashboardRouteAccess({
        queryClient,
        matches: [createMatch({ label: '角色管理', requiredPermission: 'system:role:manage' })]
      })
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
