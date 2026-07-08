import { useQuery } from '@tanstack/react-query';
import type * as React from 'react';
import { getIamMeQueryOptions } from '@/lib/api/iam/queries';
import { hasAnyIamPermission, hasIamPermission } from '@/lib/api/iam/permissions';

type PermissionGateProps = {
  permission?: string;
  anyOf?: readonly string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

export function PermissionGate({ permission, anyOf, fallback = null, children }: PermissionGateProps) {
  const { data: me } = useQuery(getIamMeQueryOptions());
  const allowed =
    permission != null ? hasIamPermission(me, permission) : hasAnyIamPermission(me, anyOf);

  return allowed ? children : fallback;
}
