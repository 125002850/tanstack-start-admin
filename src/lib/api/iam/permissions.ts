import type { QueryClient } from '@tanstack/react-query';
import { ensureIamMe } from './queries';
import { PermissionDeniedError } from './errors';
import type { IamMe } from './types';

export const SUPER_ADMIN_ROLE_CODE = 'SUPER_ADMIN';

type IamRoleHolder = {
  roles?: ReadonlyArray<{ roleCode?: string | null }> | null;
};

export function isIamSuperAdmin(me: IamRoleHolder | null | undefined): boolean {
  return (me?.roles ?? []).some((role) => role.roleCode === SUPER_ADMIN_ROLE_CODE);
}

export function hasIamPermission(
  me: Pick<IamMe, 'roles' | 'permissions'> | null | undefined,
  permission?: string | null
): boolean {
  if (!permission) return true;
  if (isIamSuperAdmin(me)) return true;
  return (me?.permissions ?? []).includes(permission);
}

export function hasAnyIamPermission(
  me: Pick<IamMe, 'roles' | 'permissions'> | null | undefined,
  permissions?: readonly string[] | null
): boolean {
  if (!permissions?.length) return true;
  if (isIamSuperAdmin(me)) return true;
  return permissions.some((permission) => hasIamPermission(me, permission));
}

export async function ensureIamPermission(
  queryClient: QueryClient,
  permission?: string | null
): Promise<IamMe> {
  const me = await ensureIamMe(queryClient);
  if (!hasIamPermission(me, permission)) {
    throw new PermissionDeniedError();
  }
  return me;
}

export async function ensureAnyIamPermission(
  queryClient: QueryClient,
  permissions?: readonly string[] | null
): Promise<IamMe> {
  const me = await ensureIamMe(queryClient);
  if (!hasAnyIamPermission(me, permissions)) {
    throw new PermissionDeniedError();
  }
  return me;
}
