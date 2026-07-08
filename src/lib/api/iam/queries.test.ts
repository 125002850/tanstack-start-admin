// @vitest-environment node

import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IAM_QUERY_KEYS } from './constants';
import type { IamMe } from './types';

const mockIamRequest = vi.hoisted(() => vi.fn());
const mockSession = vi.hoisted(() => ({
  ensureFreshAccessToken: vi.fn<() => Promise<string | null>>(),
  getAuthHeader: vi.fn<() => string | null>(),
  hasRefreshToken: vi.fn<() => boolean>()
}));

vi.mock('./request', () => ({
  iamRequest: mockIamRequest
}));

vi.mock('./session', () => mockSession);

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
}

function makeMe(mustChangePassword: boolean): IamMe {
  return {
    staff: {
      staffId: 1,
      username: 'admin',
      staffName: '超级管理员',
      status: 'ENABLED'
    },
    dept: null,
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
    mustChangePassword
  };
}

describe('IAM me query helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.ensureFreshAccessToken.mockResolvedValue('access-token');
    mockSession.getAuthHeader.mockReturnValue('Bearer access-token');
    mockSession.hasRefreshToken.mockReturnValue(true);
  });

  it('fetches a fresh /me snapshot even when cached data is still within staleTime', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(IAM_QUERY_KEYS.me, makeMe(true));
    mockIamRequest.mockResolvedValue(makeMe(false));

    const { fetchFreshIamMe } = await import('./queries');
    const result = await fetchFreshIamMe(queryClient);

    expect(result.mustChangePassword).toBe(false);
    expect(mockIamRequest).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData<IamMe>(IAM_QUERY_KEYS.me)?.mustChangePassword).toBe(false);
  });
});
