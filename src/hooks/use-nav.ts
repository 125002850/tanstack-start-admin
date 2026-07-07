import { useMemo } from 'react';
import type { NavItem, NavGroup } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { getLoginInfoQueryOptions } from '@/lib/api/sso/queries';
import {
  collectVisibleMenuKeys,
  filterNavGroupsByMenuKeys,
  filterNavItemsByMenuKeys
} from '@/lib/router/nav-permissions';

function useAllowedMenuKeys() {
  const { data: loginUser } = useQuery(getLoginInfoQueryOptions());

  return useMemo(() => collectVisibleMenuKeys(loginUser?.menuData), [loginUser?.menuData]);
}

export function useFilteredNavItems(items: NavItem[]) {
  const allowedMenuKeys = useAllowedMenuKeys();

  return useMemo(() => filterNavItemsByMenuKeys(items, allowedMenuKeys), [items, allowedMenuKeys]);
}

export function useFilteredNavGroups(groups: NavGroup[]) {
  const allowedMenuKeys = useAllowedMenuKeys();

  return useMemo(
    () => filterNavGroupsByMenuKeys(groups, allowedMenuKeys),
    [groups, allowedMenuKeys]
  );
}
