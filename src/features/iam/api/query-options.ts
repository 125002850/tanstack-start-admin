import { queryOptions } from '@tanstack/react-query';
import type { ApiClientError } from '@oig/react-query-generator/core';
import {
  iamDeptTree,
  iamMenuTree,
  iamRolePage,
  type DeptRspDTO,
  type DeptTreeReqDTO,
  type IamRolePageResponse,
  type MenuRspDTO,
  type MenuTreeReqDTO,
  type RoleRspDTO
} from '@/lib/api/clients/service';

export const IAM_MANAGEMENT_QUERY_KEYS = {
  deptTree: (request: DeptTreeReqDTO = {}) => ['service', 'iam-dept', 'tree', request] as const,
  menuTree: (request: MenuTreeReqDTO = {}) => ['service', 'iam-menu', 'tree', request] as const,
  roleOptions: ['service', 'iam-role', 'options'] as const
};

export function iamDeptTreeQueryOptions(request: DeptTreeReqDTO = {}) {
  return queryOptions<DeptRspDTO[], ApiClientError>({
    queryKey: IAM_MANAGEMENT_QUERY_KEYS.deptTree(request),
    queryFn: ({ signal }) => iamDeptTree(request, { signal })
  });
}

export function iamMenuTreeQueryOptions(request: MenuTreeReqDTO = {}) {
  return queryOptions<MenuRspDTO[], ApiClientError>({
    queryKey: IAM_MANAGEMENT_QUERY_KEYS.menuTree(request),
    queryFn: ({ signal }) => iamMenuTree(request, { signal })
  });
}

export function iamRoleOptionsQueryOptions() {
  return queryOptions<IamRolePageResponse, ApiClientError, RoleRspDTO[]>({
    queryKey: IAM_MANAGEMENT_QUERY_KEYS.roleOptions,
    queryFn: ({ signal }) => iamRolePage({ pageNo: 1, pageSize: 500 }, { signal }),
    select: (data) => data.list ?? []
  });
}
