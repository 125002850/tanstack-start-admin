/**
 * @deprecated inventory-only — superseded by V2 internal-state useDataTable default mode.
 * Kept as archival reference. Not used by flag-on or flag-off main paths.
 * DO NOT import in new route or feature code.
 */
import * as React from 'react'
import type { DataTableSearchAdapter, WorkspaceRouteDefinition } from '../types'

/**
 * Creates a stable DataTableSearchAdapter that bridges between workspace route state
 * and the table's search-driven hook. External state changes (back/forward navigation,
 * perPage seeding) are synced into the adapter AND broadcast to subscribers so that
 * consumers like useDataTable can re-read the latest search via getSearch().
 */
export function useBridgedSearchAdapter<TState>(
  state: TState,
  updateState: (updater: (prev: TState) => TState) => void,
  definition: WorkspaceRouteDefinition<TState>,
): DataTableSearchAdapter {
  const searchRef = React.useRef<Record<string, unknown>>(definition.stringify(state as never))
  const listenersRef = React.useRef(new Set<() => void>())
  const bridgeRef = React.useRef({ updateState, definition })
  bridgeRef.current = { updateState, definition }

  // Sync external state changes into the ref and notify subscribers so that
  // consumers (e.g. useDataTable's subscribed listener) can refresh localSearch.
  React.useEffect(() => {
    searchRef.current = definition.stringify(state as never)
    for (const l of listenersRef.current) l()
  }, [state, definition])

  return React.useMemo(
    () => ({
      getSearch: () => searchRef.current,
      setSearch: (reducer) => {
        searchRef.current = reducer(searchRef.current)
        const parsed = bridgeRef.current.definition.parse(searchRef.current)
        bridgeRef.current.updateState(() => parsed as TState)
        for (const l of listenersRef.current) l()
      },
      subscribe: (l) => {
        listenersRef.current.add(l)
        return () => {
          listenersRef.current.delete(l)
        }
      },
    }),
    [],
  )
}
