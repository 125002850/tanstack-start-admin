import type { NavGroup, NavItem } from '@/types';
import { getAppRouteStaticData, NAV_GROUP_META, type AppNavGroupKey } from './app-route-meta';

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

export function buildNavGroupsFromRoutes<TRoutes extends object>(routesById: TRoutes): NavGroup[] {
  const entries: RouteEntry[] = [];
  const entriesByFullPath = new Map<string, RouteEntry>();

  for (const route of Object.values(routesById) as RouteNavSource[]) {
    const { fullPath, id } = route;
    if (!fullPath || !fullPath.startsWith('/dashboard')) continue;

    const meta = getAppRouteStaticData(route);
    if (!meta?.nav?.visible) continue;

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
      title: meta.label,
      url: fullPath,
      linkable: nav.linkable ?? nav.kind !== 'container',
      shortcut: nav.shortcut,
      icon: nav.icon,
      items: (childrenByParentPath.get(entry.normalizedPath) ?? [])
        .toSorted((a, b) => (a.meta.nav?.order ?? 0) - (b.meta.nav?.order ?? 0))
        .map(entryToNavItem)
    };
  }

  const grouped = new Map<AppNavGroupKey, RouteEntry[]>();
  for (const entry of topLevelEntries) {
    const group = entry.meta.nav!.group;
    const items = grouped.get(group) ?? [];
    items.push(entry);
    grouped.set(group, items);
  }

  const result: NavGroup[] = [];
  const sortedGroupKeys = [...grouped.keys()].toSorted(
    (a, b) => (NAV_GROUP_META[a]?.order ?? 0) - (NAV_GROUP_META[b]?.order ?? 0)
  );

  for (const key of sortedGroupKeys) {
    const items = grouped
      .get(key)!
      .toSorted((a, b) => (a.meta.nav?.order ?? 0) - (b.meta.nav?.order ?? 0))
      .map(entryToNavItem);
    result.push({
      label: NAV_GROUP_META[key]?.label ?? '',
      items
    });
  }

  return result;
}
