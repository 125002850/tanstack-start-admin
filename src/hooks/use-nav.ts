import { useMemo } from 'react';
import type { NavItem, NavGroup } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { getIamMeQueryOptions } from '@/lib/api/iam/queries';
import {
  collectVisibleMenuKeys,
  filterNavGroupsByMenuKeys,
  filterNavItemsByMenuKeys
} from '@/lib/router/nav-permissions';

function useAllowedMenuKeys() {
  const { data: me } = useQuery(getIamMeQueryOptions());

  return useMemo(() => collectVisibleMenuKeys(me?.menus), [me?.menus]);
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
