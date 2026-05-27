/**
 * @deprecated inventory-only — superseded by WorkspacePageBoundary (V2).
 * Kept as archival reference. Not used by flag-on or flag-off main paths.
 * DO NOT import in new route or feature code.
 */
import { useParams, useSearch, useRouter } from '@tanstack/react-router'
import * as React from 'react'
import type { WorkspaceRoutePageProps, WorkspaceScreenProps, WorkspaceScreenDescriptor } from '../types'
import { workspaceRegistry } from '../lib/workspace-registry'
import { useDataTablePageSize } from '@/lib/data-table-page-size'

export function WorkspaceRoutePage<TState = unknown>({
  definition,
  screen: Screen,
  instanceKey,
  fallback = null,
}: WorkspaceRoutePageProps<TState>) {
  const router = useRouter()
  const rawSearch = useSearch({ strict: false }) as Record<string, unknown>
  const rawParams = useParams({ strict: false }) as Record<string, string>
  const { isReady } = useDataTablePageSize({})

  const [state, setState] = React.useState<TState>(() =>
    definition.parse(rawSearch, rawParams),
  )

  // Re-seed state once page-size storage is ready so the initial fetch
  // always carries the correct perPage value.
  const didSeed = React.useRef(false)
  React.useEffect(() => {
    if (isReady && !didSeed.current) {
      didSeed.current = true
      setState(definition.parse(rawSearch, rawParams))
    }
  }, [isReady, rawSearch, rawParams, definition])

  // Derive the tag id from the current pathname (same contract as useDashboardRouteTagSync).
  const pathname = router.state.location.pathname

  // Resolve instance key: explicit override > route-meta strategy.
  const resolvedKey = React.useMemo(() => {
    if (instanceKey) return instanceKey
    return pathname
  }, [instanceKey, pathname])

  // Register the descriptor so the viewport can host this screen as an
  // inactive keep-alive slot when the user switches to another tab.
  React.useEffect(() => {
    workspaceRegistry.register(pathname, {
      definition: definition as WorkspaceScreenDescriptor['definition'],
      screen: Screen as React.ComponentType<WorkspaceScreenProps>,
      instanceKey: resolvedKey,
    })
    return () => {
      workspaceRegistry.unregister(pathname)
    }
  }, [pathname, definition, Screen, resolvedKey])

  const updateState = React.useCallback(
    (updater: (prev: TState) => TState) => {
      setState((prev) => {
        const next = updater(prev)
        const nextSearch = definition.stringify(next)
        const href = definition.buildHref(next)
        void router.navigate({ to: href, search: nextSearch as never, replace: true })
        return next
      })
    },
    [definition, router],
  )

  if (!isReady) {
    return <>{fallback}</>
  }

  // TypeScript struggles with the generic TState flowing through JSX here.
  // The runtime types are correct — Screen receives WorkspaceScreenProps<TState>.
  const ScreenAny = Screen as React.ComponentType<any>

  return (
    <ScreenAny
      state={state}
      updateState={updateState}
      definition={definition}
    />
  )
}
