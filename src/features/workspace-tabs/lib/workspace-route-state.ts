/**
 * @deprecated inventory-only — superseded by V2 internal-state useDataTable default mode.
 * Kept as archival reference. Not used by flag-on or flag-off main paths.
 * DO NOT import in new route or feature code.
 */
import type { DataTableSearchAdapter } from '../types'

export function asSearchReducer(
  reducer: (prev: Record<string, unknown>) => Record<string, unknown>,
) {
  return reducer as never
}

export function createStaticAdapter(
  initialSearch: Record<string, unknown> = {},
): DataTableSearchAdapter {
  let search = { ...initialSearch }
  const listeners = new Set<() => void>()
  return {
    getSearch: () => search,
    setSearch: (reducer) => {
      search = reducer(search)
      for (const listener of listeners) {
        listener()
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export function withDefaultState<T extends Record<string, unknown>>(
  defaults: T,
): (partial?: Partial<T>) => T {
  return (partial) => ({ ...defaults, ...partial })
}

export function buildSearchHref(
  basePath: string,
  search: Record<string, unknown>,
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      params.set(key, value.join(','))
    } else {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export function buildPaginationSearch(
  prev: Record<string, unknown>,
  pageIndex: number,
  pageSize: number,
  prevPageSize: number,
): Record<string, unknown> {
  const hasPageSizeChanged = pageSize !== prevPageSize
  return {
    ...prev,
    page: pageIndex + 1,
    ...(hasPageSizeChanged ? { perPage: pageSize } : {}),
  }
}

export function buildSortSearch(
  prev: Record<string, unknown>,
  serializedSort: string | undefined,
): Record<string, unknown> {
  if (serializedSort) {
    return { ...prev, sort: serializedSort }
  }
  const next = { ...prev }
  delete next.sort
  return next
}

export function buildFilterSearch(
  prev: Record<string, unknown>,
  filterUpdates: Record<string, string | string[] | null>,
  arraySeparator = ',',
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...prev, page: 1 }
  for (const [key, value] of Object.entries(filterUpdates)) {
    if (value === null || value === undefined) {
      delete next[key]
    } else if (Array.isArray(value)) {
      next[key] = value.join(arraySeparator)
    } else {
      next[key] = value
    }
  }
  return next
}
