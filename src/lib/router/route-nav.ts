import type { NavGroup, NavItem } from '@/types';
import { Icons } from '@/components/icons';
import type { ResolvedMenuNode } from './menu-tree-resolver';
import {
  isTreeHidden,
  resolveGroupFromTree,
  resolveTreeLabel,
  resolveTreeOrder
} from './menu-tree-resolver';
import { getAppRouteStaticData } from './app-route-meta';

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[route-nav] ${message}`);
}

function normalizePath(path: string): string {
  if (path === '/') return path;
  return path.replace(/\/$/, '');
}

interface RouteEntry {
  fullPath: string;
  normalizedPath: string;
  id: string;
  meta: ReturnType<typeof getAppRouteStaticData> & {};
}

interface RouteNavSource {
  id: string;
  fullPath?: string;
  options?: { staticData?: unknown };
  staticData?: unknown;
}

const NAV_GROUP_META_STATIC: Record<string, { label: string; order: number }> = {
  overview: { label: '概览', order: 10 },
  components: { label: '组件', order: 20 },
  basicSettings: { label: '基础设置', order: 30 },
  systemManagement: { label: '系统管理', order: 40 },
  logManagement: { label: '日志管理', order: 50 },
  account: { label: '账户', order: 60 }
};

function resolveGroupLabel(
  meta: RouteEntry['meta'],
  treeLookup?: Map<string, ResolvedMenuNode>
): string {
  const nav = meta.nav;
  if (!nav) return '';

  const staticGroup = nav.group ? NAV_GROUP_META_STATIC[nav.group] : undefined;
  if (staticGroup) return staticGroup.label;

  if (nav.menuKey && treeLookup) {
    const treeGroup = resolveGroupFromTree(treeLookup, nav.menuKey);
    if (treeGroup) return treeGroup.label;
  }

  return nav.group ?? '';
}

function resolveGroupOrder(
  meta: RouteEntry['meta'],
  treeLookup?: Map<string, ResolvedMenuNode>
): number {
  const nav = meta.nav;
  if (!nav) return 0;

  const staticGroup = nav.group ? NAV_GROUP_META_STATIC[nav.group] : undefined;
  if (staticGroup) return staticGroup.order;

  if (nav.menuKey && treeLookup) {
    const treeGroup = resolveGroupFromTree(treeLookup, nav.menuKey);
    if (treeGroup) return treeGroup.order;
  }

  return 0;
}

function resolveItemOrder(
  meta: RouteEntry['meta'],
  treeLookup?: Map<string, ResolvedMenuNode>
): number {
  const nav = meta.nav;
  if (!nav) return 0;

  if (nav.menuKey && treeLookup) {
    return resolveTreeOrder(treeLookup, nav.menuKey) ?? nav.order ?? 0;
  }

  return nav.order ?? 0;
}

function isIconKey(value: string | undefined): value is keyof typeof Icons {
  return value !== undefined && Object.hasOwn(Icons, value);
}

function resolveItemIcon(meta: RouteEntry['meta']): keyof typeof Icons | undefined {
  const nav = meta.nav;
  if (!nav) return undefined;

  return isIconKey(nav.icon) ? nav.icon : undefined;
}

function resolveItemLabel(
  meta: RouteEntry['meta'],
  treeLookup?: Map<string, ResolvedMenuNode>
): string {
  if (meta.nav?.menuKey && treeLookup) {
    return resolveTreeLabel(treeLookup, meta.nav.menuKey) ?? meta.label ?? '';
  }
  return meta.label ?? '';
}

function isItemVisible(
  meta: RouteEntry['meta'],
  treeLookup?: Map<string, ResolvedMenuNode>
): boolean {
  const nav = meta.nav;
  if (!nav) return false;

  if (nav.isContainer) return false;

  if (nav.menuKey && treeLookup) {
    const hidden = isTreeHidden(treeLookup, nav.menuKey);
    if (hidden) return false;
  }

  if (nav.visible !== undefined) return nav.visible;
  return true;
}

export function buildNavGroupsFromRoutes<TRoutes extends object>(
  routesById: TRoutes,
  treeLookup?: Map<string, ResolvedMenuNode>
): NavGroup[] {
  const entries: RouteEntry[] = [];
  const entriesByFullPath = new Map<string, RouteEntry>();

  for (const route of Object.values(routesById) as RouteNavSource[]) {
    const { fullPath, id } = route;
    if (!fullPath || !fullPath.startsWith('/dashboard')) continue;

    const meta = getAppRouteStaticData(route);
    if (!meta?.nav) continue;

    if (!isItemVisible(meta, treeLookup)) continue;

    const normalizedPath = normalizePath(fullPath);
    const entry: RouteEntry = {
      fullPath,
      normalizedPath,
      id,
      meta
    };
    entries.push(entry);
    entriesByFullPath.set(normalizedPath, entry);
  }

  const topLevelEntries: RouteEntry[] = [];
  const childrenByParentPath = new Map<string, RouteEntry[]>();

  for (const entry of entries) {
    const parentId = entry.meta.nav!.parentId;

    if (parentId) {
      const normalizedParentId = normalizePath(parentId);
      const parent = entriesByFullPath.get(normalizedParentId);
      invariant(
        parent,
        `parentId "${parentId}" not found among visible /dashboard routes (from "${entry.fullPath}")`
      );
      invariant(
        parent.meta.nav?.kind === 'container',
        `parentId "${parentId}" resolved but is not a container route (kind=${parent.meta.nav?.kind}, from "${entry.fullPath}")`
      );

      const siblings = childrenByParentPath.get(normalizedParentId) ?? [];
      siblings.push(entry);
      childrenByParentPath.set(normalizedParentId, siblings);
    } else {
      topLevelEntries.push(entry);
    }
  }

  function entryToNavItem(entry: RouteEntry): NavItem {
    const { meta, fullPath, id } = entry;
    const nav = meta.nav!;

    return {
      id,
      title: resolveItemLabel(meta, treeLookup),
      url: fullPath,
      linkable: nav.linkable ?? nav.kind !== 'container',
      shortcut: nav.shortcut,
      menuKey: nav.menuKey,
      icon: resolveItemIcon(meta),
      items: (childrenByParentPath.get(entry.normalizedPath) ?? [])
        .toSorted(
          (a, b) => resolveItemOrder(a.meta, treeLookup) - resolveItemOrder(b.meta, treeLookup)
        )
        .map(entryToNavItem)
    };
  }

  const grouped = new Map<string, RouteEntry[]>();
  for (const entry of topLevelEntries) {
    const group = resolveGroupLabel(entry.meta, treeLookup);
    if (!group) continue;
    const items = grouped.get(group) ?? [];
    items.push(entry);
    grouped.set(group, items);
  }

  const result: NavGroup[] = [];
  const sortedGroupKeys = [...grouped.keys()].toSorted((a, b) => {
    const orderA = topLevelEntries
      .filter((e) => resolveGroupLabel(e.meta, treeLookup) === a)
      .reduce((min, e) => Math.min(min, resolveGroupOrder(e.meta, treeLookup)), Infinity);
    const orderB = topLevelEntries
      .filter((e) => resolveGroupLabel(e.meta, treeLookup) === b)
      .reduce((min, e) => Math.min(min, resolveGroupOrder(e.meta, treeLookup)), Infinity);
    return orderA - orderB;
  });

  for (const key of sortedGroupKeys) {
    const items = grouped
      .get(key)!
      .toSorted(
        (a, b) => resolveItemOrder(a.meta, treeLookup) - resolveItemOrder(b.meta, treeLookup)
      )
      .map(entryToNavItem);
    result.push({
      label: key,
      items
    });
  }

  return result;
}
