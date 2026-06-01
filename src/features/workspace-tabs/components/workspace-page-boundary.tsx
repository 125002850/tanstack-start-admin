import * as React from 'react'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { findDeepestRouteMatch, normalizeRoutePath } from '../hooks/use-dashboard-route-tag-sync'
import { useWorkspaceTabStore } from '../utils/store'
import { isWorkspaceTabsEnabled } from '@/config/workspace-tabs'
import { resolveRouteTagTitle } from '../lib/route-workspace'
import type { WorkspacePageBoundaryProps, WorkspacePageDescriptor } from '../types'

/**
 * WorkspacePageBoundary is the single registration point for a page instance
 * into the workspace shell.
 *
 * Flag-off: renders the page directly with zero side effects — no descriptor
 * registration, no store writes. Callers may optionally provide a dedicated
 * renderWhenDisabled tree when flag-off should bypass the workspace screen.
 *
 * Host Ownership Contract (flag-on):
 * 1. Registers a WorkspacePageDescriptor in the store during render
 * 2. Returns null — the actual page instance is mounted exclusively by ActivityHost
 * 3. Unmount does NOT cleanup the descriptor; only tab close or shell reset does
 */
export function WorkspacePageBoundary({
  tabId,
  initialTitle,
  keepAlive = true,
  closable = true,
  render,
  renderWhenDisabled,
  errorFallback,
}: WorkspacePageBoundaryProps) {
  const enabled = isWorkspaceTabsEnabled()
  const router = useRouter()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const normalizedPathname = normalizeRoutePath(pathname)
  const resolvedTabId = tabId ?? normalizedPathname
  const staticData = React.useMemo(
    () =>
      findDeepestRouteMatch(
        resolvedTabId,
        router.routesByPath as unknown as Record<string, unknown>,
      )?.staticData,
    [resolvedTabId, router.routesByPath],
  )
  const resolvedInitialTitle =
    initialTitle ?? resolveRouteTagTitle(staticData, resolvedTabId)
  const isCurrentRouteInstance = normalizedPathname === resolvedTabId

  if (!enabled) {
    return <>{(renderWhenDisabled ?? render)()}</>
  }

  if (!isCurrentRouteInstance) {
    return null
  }

  return (
    <WorkspacePageBoundaryRegistration
      key={resolvedTabId}
      tabId={resolvedTabId}
      initialTitle={resolvedInitialTitle}
      keepAlive={keepAlive}
      closable={closable}
      render={render}
      errorFallback={errorFallback}
    />
  )
}

function WorkspacePageBoundaryRegistration({
  tabId,
  initialTitle,
  keepAlive,
  closable,
  render,
  errorFallback,
}: {
  tabId: string
  initialTitle: string
  keepAlive: boolean
  closable: boolean
  render: () => React.ReactNode
  errorFallback?: React.ReactNode
}) {
  const descriptor = React.useMemo<WorkspacePageDescriptor>(
    () => ({
      tabId,
      initialTitle,
      keepAlive,
      closable,
      render,
      errorFallback,
    }),
    [closable, errorFallback, initialTitle, keepAlive, render, tabId],
  )

  const useIsomorphicLayoutEffect =
    typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect

  useIsomorphicLayoutEffect(() => {
    useWorkspaceTabStore.getState().registerPageDescriptor(tabId, descriptor)
  }, [descriptor, tabId])

  return null
}
