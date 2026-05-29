import { useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import {
  getAppRouteStaticData,
  type AppRouteStaticData,
} from '@/lib/router/app-route-meta'
import { resolveDashboardHomeHref, isDashboardHomeHref } from '@/lib/router/dashboard-home'
import { resolveRouteWorkspaceConfig, resolveRouteTagTitle } from '../lib/route-workspace'
import type { WorkspaceTagId } from '../types'
import { useWorkspaceTagStore } from '../utils/store'

function tagIdFromPathname(pathname: string): WorkspaceTagId {
  return normalizeRoutePath(pathname)
}

export function normalizeRoutePath(path: string): string {
  if (path.length <= 1) return path
  return path.endsWith('/') ? path.slice(0, -1) : path
}

/**
 * Convert a TanStack Router route path (e.g. "/dashboard/product/$productId")
 * into a regex for matching against actual pathnames (e.g. "/dashboard/product/123").
 */
function compileRoutePattern(routePath: string): RegExp {
  const normalizedRoutePath = normalizeRoutePath(routePath)
  let escaped = ''
  for (let i = 0; i < normalizedRoutePath.length; i++) {
    if (
      normalizedRoutePath[i] === '$' &&
      i + 1 < normalizedRoutePath.length &&
      normalizedRoutePath[i + 1] !== '/'
    ) {
      escaped += '[^/]+'
      while (
        i + 1 < normalizedRoutePath.length &&
        normalizedRoutePath[i + 1] !== '/'
      ) {
        i++
      }
    } else {
      const c = normalizedRoutePath[i]
      if (c === '.' || c === '+' || c === '*' || c === '?' || c === '^' || c === '(' || c === ')' || c === '[' || c === ']' || c === '{' || c === '}' || c === '|' || c === '\\') {
        escaped += '\\' + c
      } else {
        escaped += c
      }
    }
  }
  return new RegExp(`^${escaped}$`)
}

export interface DeepestRouteMatch {
  staticData: AppRouteStaticData
  pattern: string
}

type RouteStaticDataCarrier = {
  options?: { staticData?: unknown }
  staticData?: unknown
}

/**
 * Find the deepest matching route for a given pathname by converting
 * route patterns with $param placeholders into regexes.
 */
export function findDeepestRouteMatch(
  pathname: string,
  routesByPath: Record<string, unknown>,
): DeepestRouteMatch | undefined {
  const normalizedPathname = normalizeRoutePath(pathname)
  let best: DeepestRouteMatch | undefined
  let bestSegments = 0

  for (const [pattern, route] of Object.entries(routesByPath)) {
    const regex = compileRoutePattern(pattern)
    if (!regex.test(normalizedPathname)) continue

    if (typeof route !== 'object' || route === null) continue

    const data = getAppRouteStaticData(route as RouteStaticDataCarrier)
    if (!data) continue

    const segments = pattern.split('/').length
    if (segments > bestSegments) {
      best = { staticData: data, pattern }
      bestSegments = segments
    }
  }
  return best
}

export function useDashboardRouteTagSync(enabled = true) {
  const router = useRouter()
  const location = useRouterState({ select: (s) => s.location })
  const prevHref = useRef<string | null>(null)

  // Seed the home tag once on mount (idempotent via store check)
  useEffect(() => {
    if (!enabled) return

    const homeHref = resolveDashboardHomeHref()
    const store = useWorkspaceTagStore.getState()
    if (!store.tabs[tagIdFromPathname(homeHref)]) {
      store.openOrActivate({
        id: tagIdFromPathname(homeHref),
        href: homeHref,
        title: '仪表盘',
        closable: false,
        keepAlive: false,
      })
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    const pathname = location.pathname
    const normalizedPathname = normalizeRoutePath(pathname)
    const searchStr = location.searchStr || ''
    const fullHref = normalizedPathname + searchStr

    if (fullHref === prevHref.current) return
    prevHref.current = fullHref

    // Only track dashboard sub-routes
    if (!normalizedPathname.startsWith('/dashboard')) return

    // Skip the layout route itself
    if (normalizedPathname === '/dashboard') return

    const match = findDeepestRouteMatch(
      normalizedPathname,
      router.routesByPath as unknown as Record<string, unknown>,
    )

    const wsConfig = resolveRouteWorkspaceConfig(normalizedPathname, match?.staticData)
    if (!wsConfig.tagEnabled) return

    const title = resolveRouteTagTitle(match?.staticData, normalizedPathname)
    const id = tagIdFromPathname(normalizedPathname)
    const closable = !isDashboardHomeHref(normalizedPathname)

    useWorkspaceTagStore.getState().openOrActivate({
      id,
      href: fullHref,
      title: title || normalizedPathname,
      closable,
      keepAlive: wsConfig.keepAlive,
    })
  }, [location.pathname, location.searchStr, router.routesByPath, enabled])
}
