import type { Icons } from '@/components/icons'
import type { InfobarContent } from '@/components/ui/infobar'

export const NAV_GROUP_META = {
  overview: { label: '概览', order: 10 },
  components: { label: '组件', order: 20 },
  account: { label: '账户', order: 30 },
} as const

export type AppNavGroupKey = keyof typeof NAV_GROUP_META

export interface AppNavStaticData {
  visible: boolean
  group: AppNavGroupKey
  order: number
  kind?: 'container'
  parentId?: string
  icon?: keyof typeof Icons
  shortcut?: [string, string]
  linkable?: boolean
}

export interface AppBreadcrumbData {
  label: string
  to?: string
}

export interface AppPageData {
  // Rendered by PageContainer as the in-page heading, distinct from the document title.
  title?: string
  description?: string
  infoContent?: InfobarContent
}

export interface AppRouteWorkspaceData {
  tagEnabled?: boolean
  keepAlive?: boolean
  instanceStrategy?: 'global' | 'by-params'
  refreshPolicy?: 'query-invalidate'
}

export interface AppRouteStaticData {
  // Human-readable route label used by navigation and as the PageContainer title fallback.
  label: string
  // Browser document title generated through defineRouteMeta(). Falls back to label when omitted.
  title?: string
  breadcrumb?: AppBreadcrumbData
  nav?: AppNavStaticData
  page?: AppPageData
  workspace?: AppRouteWorkspaceData
}

export function defineRouteMeta<T extends AppRouteStaticData>(data: T) {
  return {
    staticData: data,
    // Keep the common case declarative: route-local metadata plus a default document title.
    head: (): { meta: [{ title: string }] } => ({
      meta: [{ title: data.title ?? data.label }],
    }),
  }
}

export function isAppRouteStaticData(data: unknown): data is AppRouteStaticData {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  if (typeof d.label !== 'string') return false
  if (d.nav !== undefined) {
    if (typeof d.nav !== 'object' || d.nav === null) return false
    const n = d.nav as Record<string, unknown>
    if (typeof n.visible !== 'boolean') return false
    if (typeof n.group !== 'string') return false
    if (typeof n.order !== 'number') return false
  }
  return true
}

export function getAppRouteStaticData(
  route: { options?: { staticData?: unknown }; staticData?: unknown }
): AppRouteStaticData | undefined {
  // TanStack Router keeps runtime static data on route.options.staticData.
  const data = route.options?.staticData ?? route.staticData
  if (isAppRouteStaticData(data)) {
    return data
  }
  return undefined
}
