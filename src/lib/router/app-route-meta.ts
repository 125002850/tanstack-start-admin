import type { Icons } from '@/components/icons';
import type { InfobarContent } from '@/components/ui/infobar';

export interface AppNavStaticData {
  menuKey?: string;
  /**
   * Explicit nav group. Takes precedence over the backend menu-tree ancestor;
   * routes without a group derive it from the backend tree.
   */
  group?: string;
  /**
   * Used by non-IAM routes (no menuKey) for static nav ordering.
   * IAM-managed routes derive order from the backend tree (sortOrder).
   */
  order?: number;
  /**
   * Used by non-IAM routes (no menuKey) for static nav visibility.
   * IAM-managed routes derive visibility from the backend tree (hidden).
   */
  visible?: boolean;
  /**
   * Used by non-IAM routes (no menuKey) for static nav icon.
   * IAM-managed routes derive icon from the backend tree.
   */
  icon?: keyof typeof Icons;
  /**
   * Used by non-IAM routes (no menuKey) for static parent-child nesting.
   * IAM-managed routes derive hierarchy from the backend tree.
   */
  kind?: 'container';
  /**
   * Used by non-IAM routes (no menuKey) for static parent-child nesting.
   */
  parentId?: string;
  /** Marks structural container routes (index routes) that should not appear in sidebar nav. */
  isContainer?: true;
  shortcut?: [string, string];
  linkable?: boolean;
}

export interface AppBreadcrumbData {
  label: string;
  to?: string;
}

export interface AppPageData {
  title?: string;
  description?: string;
  infoContent?: InfobarContent;
}

export interface AppRouteWorkspaceData {
  tagEnabled?: boolean;
  keepAlive?: boolean;
  closable?: boolean;
  instanceStrategy?: 'global' | 'by-params';
  refreshPolicy?: 'query-invalidate';
}

export interface AppRouteStaticData {
  label?: string;
  title?: string;
  breadcrumb?: AppBreadcrumbData;
  nav?: AppNavStaticData;
  requiredPermission?: string;
  requiredAnyPermissions?: string[];
  page?: AppPageData;
  workspace?: AppRouteWorkspaceData;
}

export function defineRouteMeta<T extends AppRouteStaticData>(data: T) {
  return {
    staticData: data,
    head: (): { meta: [{ title: string }] } => ({
      meta: [{ title: data.title ?? data.label ?? '' }]
    })
  };
}

export function isAppRouteStaticData(data: unknown): data is AppRouteStaticData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  if (d.label !== undefined && typeof d.label !== 'string') return false;
  if (d.nav !== undefined) {
    if (typeof d.nav !== 'object' || d.nav === null) return false;
  }
  return true;
}

export function getAppRouteStaticData(route: {
  options?: { staticData?: unknown };
  staticData?: unknown;
}): AppRouteStaticData | undefined {
  const data = route.options?.staticData ?? route.staticData;
  if (isAppRouteStaticData(data)) {
    return data;
  }
  return undefined;
}
