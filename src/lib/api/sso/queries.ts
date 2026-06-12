import type { QueryClient } from '@tanstack/react-query';
import { queryOptions } from '@tanstack/react-query';

import { bootstrapRequest } from './bootstrap';
import { setLogoutUrl } from './session';
import type { LoginUserData, LoginUserRsp } from './type';

export const getLoginInfoQueryKey = ['sso', 'login-info'] as const;

export const getLoginInfoQueryOptions = () =>
  queryOptions<LoginUserData>({
    queryKey: getLoginInfoQueryKey,
    queryFn: async ({ signal }) => {
      const resp = await bootstrapRequest('/api/getLoginInfo', { signal });

      if (!resp.ok) {
        throw new Error(`Failed to fetch login info: ${resp.status}`);
      }

      const json: LoginUserRsp = await resp.json();

      if (!json.success) {
        throw new Error(json.msg || 'Failed to fetch login info');
      }

      setLogoutUrl(json.data.logoutUrl);
      return json.data;
    },
    staleTime: 5 * 60 * 1000
  });

export function ensureSsoLoginInfo(queryClient: QueryClient) {
  return queryClient.ensureQueryData(getLoginInfoQueryOptions());
}
