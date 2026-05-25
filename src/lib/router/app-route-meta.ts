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
  title?: string
  description?: string
  infoContent?: InfobarContent
}

export interface AppRouteStaticData {
  label: string
  documentTitle?: string
  breadcrumb?: AppBreadcrumbData
  nav?: AppNavStaticData
  page?: AppPageData
}

export function defineAppRouteStaticData<T extends AppRouteStaticData>(data: T): T {
  return data
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
  const data = route.options?.staticData ?? route.staticData
  if (isAppRouteStaticData(data)) {
    return data
  }
  return undefined
}
