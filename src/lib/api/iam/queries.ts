import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { HttpError } from '@oig/react-query-generator/core';
import { HTTP_STATUS_UNAUTHORIZED } from '@/lib/http-status';
import { iamRequest } from './request';
import { AuthRequiredError } from './errors';
import { IAM_QUERY_KEYS } from './constants';
import { ensureFreshAccessToken, getAuthHeader, hasRefreshToken } from './session';
import type { IamMe } from './types';

export function normalizeIamMe(
  data: Omit<IamMe, 'dataScope'> & { dataScope?: IamMe['dataScope'] }
): IamMe {
  return {
    ...data,
    roles: data.roles ?? [],
    permissions: data.permissions ?? [],
    menus: data.menus ?? [],
    dataScopeSummary: data.dataScopeSummary,
    dataScope: data.dataScope ?? data.dataScopeSummary
  };
}

export async function fetchIamMe(): Promise<IamMe> {
  await ensureFreshAccessToken();
  const authHeader = getAuthHeader();
  if (!authHeader && !hasRefreshToken()) {
    throw new AuthRequiredError();
  }

  try {
    const data = await iamRequest<Omit<IamMe, 'dataScope'> & { dataScope?: IamMe['dataScope'] }>(
      '/auth/me',
      {
        method: 'POST',
        headers: authHeader ? { Authorization: authHeader } : undefined
      }
    );
    return normalizeIamMe(data);
  } catch (error) {
    if (error instanceof HttpError && error.status === HTTP_STATUS_UNAUTHORIZED) {
      throw new AuthRequiredError();
    }
    throw error;
  }
}

export const getIamMeQueryOptions = () =>
  queryOptions<IamMe>({
    queryKey: IAM_QUERY_KEYS.me,
    queryFn: fetchIamMe,
    staleTime: 60_000,
    retry: false
  });

export function fetchFreshIamMe(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: IAM_QUERY_KEYS.me });
  return queryClient.fetchQuery(getIamMeQueryOptions());
}

export function ensureIamMe(queryClient: QueryClient) {
  return queryClient.ensureQueryData(getIamMeQueryOptions());
}
