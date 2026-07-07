import type { QueryClient } from '@tanstack/react-query';
import { queryOptions } from '@tanstack/react-query';

import { bootstrapRequest, collectSsoRedirectUrls } from './bootstrap';
import { LoginForbiddenError } from './errors';
import { setLoginUserId, setLogoutUrl } from './session';
import type { LoginUserData, LoginUserRsp } from './type';
import { HTTP_STATUS_FORBIDDEN } from '../../http-status';
import { transportProfile } from '../clients/service/generated/runtime';

export const getLoginInfoQueryKey = ['sso', 'login-info'] as const;
const LOGIN_INFO_STALE_TIME_MINUTES = 5;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const LOGIN_INFO_STALE_TIME_MS =
  LOGIN_INFO_STALE_TIME_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

function joinApiPath(basePath: string, path: `/${string}`): string {
  const normalizedBasePath = basePath === '/' ? '' : basePath.replace(/\/+$/, '');
  return `${normalizedBasePath}${path}`;
}

type LoginInfoResponseBody = Partial<LoginUserRsp> & {
  code?: number | string;
  message?: string;
};

function getResponseCode(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function getBodyStatus(body: LoginInfoResponseBody): number | null {
  return getResponseCode(body.code) ?? getResponseCode(body.rspCode);
}

function getBodyMessage(body: LoginInfoResponseBody): string | undefined {
  return body.message || body.msg;
}

async function readJsonBody(response: Response): Promise<LoginInfoResponseBody | null> {
  try {
    return (await response.json()) as LoginInfoResponseBody;
  } catch {
    return null;
  }
}

function throwLoginForbidden(body: LoginInfoResponseBody | null): never {
  const redirectUrls = collectSsoRedirectUrls(body);

  if (redirectUrls.logoutUrl) {
    setLogoutUrl(redirectUrls.logoutUrl);
  }

  throw new LoginForbiddenError({
    message: body ? getBodyMessage(body) : undefined,
    loginUrl: redirectUrls.loginUrl,
    logoutUrl: redirectUrls.logoutUrl
  });
}

export const getLoginInfoQueryOptions = () =>
  queryOptions<LoginUserData>({
    queryKey: getLoginInfoQueryKey,
    queryFn: async ({ signal }) => {
      const resp = await bootstrapRequest(
        joinApiPath(transportProfile.basePath, '/api/getLoginInfo'),
        { signal }
      );

      if (resp.status === HTTP_STATUS_FORBIDDEN) {
        throwLoginForbidden(await readJsonBody(resp));
      }

      if (!resp.ok) {
        const error = Object.assign(new Error(`Failed to fetch login info: ${resp.status}`), {
          status: resp.status
        });
        throw error;
      }

      const json = (await resp.json()) as LoginInfoResponseBody;

      if (getBodyStatus(json) === HTTP_STATUS_FORBIDDEN) {
        throwLoginForbidden(json);
      }

      if (!json.success) {
        throw new Error(getBodyMessage(json) || 'Failed to fetch login info');
      }

      const data = json.data as LoginUserData;

      setLogoutUrl(data.logoutUrl);
      setLoginUserId(data.userId);
      return data;
    },
    staleTime: LOGIN_INFO_STALE_TIME_MS
  });

export function ensureSsoLoginInfo(queryClient: QueryClient) {
  return queryClient.ensureQueryData(getLoginInfoQueryOptions());
}
