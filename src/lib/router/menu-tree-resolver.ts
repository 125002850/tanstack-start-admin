import type { IamMenuNode } from '@/lib/api/iam/types';

export interface ResolvedMenuNode {
  menuCode: string;
  menuKey: string;
  label: string;
  icon?: string;
  sortOrder: number;
  hidden: boolean;
  cached: boolean;
  permissionCode?: string;
  menuType: 'DIR' | 'MENU' | 'BUTTON';
  status: 'ENABLED' | 'DISABLED';
  parentMenuKey?: string;
  parentMenuCode?: string;
  children: ResolvedMenuNode[];
}

function flattenTree(
  nodes: IamMenuNode[],
  parent?: ResolvedMenuNode,
  map?: Map<string, ResolvedMenuNode>
): Map<string, ResolvedMenuNode> {
  const lookup = map ?? new Map<string, ResolvedMenuNode>();

  for (const node of nodes) {
    const key = node.menuKey ?? node.menuCode;
    if (!key) continue;

    const resolved: ResolvedMenuNode = {
      menuCode: node.menuCode,
      menuKey: key,
      label: node.menuName,
      icon: node.icon ?? undefined,
      sortOrder: node.sortOrder ?? 0,
      hidden: node.hidden,
      cached: node.cached,
      permissionCode: node.permissionCode ?? undefined,
      menuType: node.menuType,
      status: node.status,
      parentMenuKey: parent?.menuKey,
      parentMenuCode: parent?.menuCode,
      children: []
    };

    lookup.set(key, resolved);

    if (node.children) {
      const childLookup = flattenTree(node.children, resolved, lookup);
      resolved.children = node.children
        .map((c) => {
          const k = c.menuKey ?? c.menuCode;
          return k ? lookup.get(k) : undefined;
        })
        .filter((c): c is ResolvedMenuNode => !!c);
      void childLookup;
    }
  }

  return lookup;
}

export function buildMenuTreeLookup(nodes: IamMenuNode[]): Map<string, ResolvedMenuNode> {
  return flattenTree(nodes);
}

export function resolveMenuNode(
  lookup: Map<string, ResolvedMenuNode>,
  menuKey: string
): ResolvedMenuNode | undefined {
  return lookup.get(menuKey);
}

export interface ResolvedGroupInfo {
  label: string;
  order: number;
}

export function resolveGroupFromTree(
  lookup: Map<string, ResolvedMenuNode>,
  menuKey: string
): ResolvedGroupInfo | undefined {
  const node = resolveMenuNode(lookup, menuKey);
  if (!node) return undefined;

  if (node.menuType === 'DIR' || node.menuType === 'BUTTON') {
    return undefined;
  }

  const parentKey = node.parentMenuKey ?? node.parentMenuCode;
  if (!parentKey) return undefined;

  const parent = resolveMenuNode(lookup, parentKey);
  if (!parent || parent.menuType !== 'DIR') return undefined;

  return {
    label: parent.label,
    order: parent.sortOrder
  };
}

export function resolveBreadcrumbChain(
  lookup: Map<string, ResolvedMenuNode>,
  menuKey: string
): Array<{ label: string; menuKey: string }> {
  const chain: Array<{ label: string; menuKey: string }> = [];
  let current = resolveMenuNode(lookup, menuKey);

  while (current) {
    chain.unshift({ label: current.label, menuKey: current.menuKey });
    const parentKey = current.parentMenuKey ?? current.parentMenuCode;
    current = parentKey ? resolveMenuNode(lookup, parentKey) : undefined;
  }

  return chain;
}

export function resolveTreeLabel(
  lookup: Map<string, ResolvedMenuNode>,
  menuKey: string
): string | undefined {
  return resolveMenuNode(lookup, menuKey)?.label;
}

export function resolveTreeIcon(
  lookup: Map<string, ResolvedMenuNode>,
  menuKey: string
): string | undefined {
  return resolveMenuNode(lookup, menuKey)?.icon;
}

export function resolveTreeOrder(
  lookup: Map<string, ResolvedMenuNode>,
  menuKey: string
): number | undefined {
  return resolveMenuNode(lookup, menuKey)?.sortOrder;
}

export function resolveTreeCached(
  lookup: Map<string, ResolvedMenuNode>,
  menuKey: string
): boolean | undefined {
  return resolveMenuNode(lookup, menuKey)?.cached;
}

export function resolveTreePermissionCode(
  lookup: Map<string, ResolvedMenuNode>,
  menuKey: string
): string | undefined {
  return resolveMenuNode(lookup, menuKey)?.permissionCode;
}

export function isTreeHidden(
  lookup: Map<string, ResolvedMenuNode>,
  menuKey: string
): boolean | undefined {
  return resolveMenuNode(lookup, menuKey)?.hidden;
}

export function isTreeDir(lookup: Map<string, ResolvedMenuNode>, menuKey: string): boolean {
  return resolveMenuNode(lookup, menuKey)?.menuType === 'DIR';
}
