const DASHBOARD_HOME_HREF = '/dashboard/overview'

export function resolveDashboardHomeHref(): string {
  return DASHBOARD_HOME_HREF
}

export function isDashboardHomeHref(href: string): boolean {
  return href === DASHBOARD_HOME_HREF
}
