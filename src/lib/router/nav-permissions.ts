import type { NavGroup, NavItem } from '@/types';

export interface MenuPermissionNode {
  code?: string | null;
  menuCode?: string | null;
  menuKey?: string | null;
  hidden?: boolean | null;
  hiddenFlag?: string | null;
  status?: string | null;
  children?: readonly MenuPermissionNode[] | null;
}

export function normalizeMenuKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  return (trimmed.split(':').at(-1) ?? trimmed).trim();
}

function isVisibleMenuNode(node: MenuPermissionNode): boolean {
  if (node.hidden === true) return false;
  if (node.hiddenFlag?.trim().toUpperCase() === 'Y') return false;
  if (node.status?.trim().toUpperCase() === 'DISABLED') return false;
  return true;
}

function getMenuNodeKey(node: MenuPermissionNode): string {
  return node.menuKey ?? node.menuCode ?? node.code ?? '';
}

export function collectVisibleMenuKeys(
  menuData: readonly MenuPermissionNode[] | null | undefined
): Set<string> {
  const keys = new Set<string>();

  function visit(nodes: readonly MenuPermissionNode[] | null | undefined) {
    if (!nodes) return;

    for (const node of nodes) {
      if (isVisibleMenuNode(node)) {
        const key = normalizeMenuKey(getMenuNodeKey(node));
        if (key) keys.add(key);
      }

      visit(node.children);
    }
  }

  visit(menuData);
  return keys;
}

function isNavItemAllowed(item: NavItem, allowedMenuKeys: ReadonlySet<string>): boolean {
  const menuKey = normalizeMenuKey(item.menuKey ?? '');
  return !menuKey || allowedMenuKeys.has(menuKey);
}

export function filterNavItemsByMenuKeys(
  items: readonly NavItem[],
  allowedMenuKeys: ReadonlySet<string>
): NavItem[] {
  return items.flatMap((item) => {
    if (!isNavItemAllowed(item, allowedMenuKeys)) {
      return [];
    }

    if (!item.items?.length) {
      return [item];
    }

    const filteredChildren = filterNavItemsByMenuKeys(item.items, allowedMenuKeys);
    if (filteredChildren.length > 0 || item.linkable !== false) {
      return [{ ...item, items: filteredChildren }];
    }

    return [];
  });
}

export function filterNavGroupsByMenuKeys(
  groups: readonly NavGroup[],
  allowedMenuKeys: ReadonlySet<string>
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: filterNavItemsByMenuKeys(group.items, allowedMenuKeys)
    }))
    .filter((group) => group.items.length > 0);
}
