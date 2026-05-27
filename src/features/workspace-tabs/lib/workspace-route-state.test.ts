/**
 * @deprecated inventory-only — tests legacy v1 workspace route state utilities.
 * Superseded by V2 internal-state DataTable (Task V2-02A).
 * DO NOT import in new test or feature code.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  asSearchReducer,
  createStaticAdapter,
  withDefaultState,
  buildSearchHref,
  buildPaginationSearch,
  buildSortSearch,
  buildFilterSearch,
} from './workspace-route-state'

const testReducer = (prev: Record<string, unknown>) => ({ ...prev, page: 2 })

describe('asSearchReducer', () => {
  it('returns the reducer cast to never (type-level helper)', () => {
    const result = asSearchReducer(testReducer)
    expect(typeof result).toBe('function')
  })
})

describe('createStaticAdapter', () => {
  it('getSearch returns initial search values', () => {
    const adapter = createStaticAdapter({ page: 1, perPage: 10 })
    expect(adapter.getSearch()).toEqual({ page: 1, perPage: 10 })
  })

  it('setSearch updates the stored search state', () => {
    const adapter = createStaticAdapter({ page: 1 })
    adapter.setSearch((prev) => ({ ...prev, page: 2 }))
    expect(adapter.getSearch()).toEqual({ page: 2 })
  })

  it('setSearch receives the current state', () => {
    const adapter = createStaticAdapter({ count: 0 })
    adapter.setSearch((prev) => ({ count: (prev.count as number) + 1 }))
    adapter.setSearch((prev) => ({ count: (prev.count as number) + 1 }))
    expect(adapter.getSearch()).toEqual({ count: 2 })
  })

  it('defaults to empty object when no initial search provided', () => {
    const adapter = createStaticAdapter()
    expect(adapter.getSearch()).toEqual({})
  })

  it('does not mutate the initial search object', () => {
    const initial = { page: 1 }
    const adapter = createStaticAdapter(initial)
    adapter.setSearch((prev) => ({ ...prev, page: 2 }))
    expect(initial).toEqual({ page: 1 })
  })

  it('subscribe fires when setSearch is called', () => {
    const adapter = createStaticAdapter({ page: 1 })
    const listener = vi.fn()
    adapter.subscribe?.(listener)
    adapter.setSearch((prev) => ({ ...prev, page: 2 }))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('subscribe returns unsubscribe function', () => {
    const adapter = createStaticAdapter({ page: 1 })
    const listener = vi.fn()
    const unsub = adapter.subscribe?.(listener)
    unsub?.()
    adapter.setSearch((prev) => ({ ...prev, page: 2 }))
    expect(listener).not.toHaveBeenCalled()
  })

  it('multiple subscribers are all notified', () => {
    const adapter = createStaticAdapter({ page: 1 })
    const a = vi.fn()
    const b = vi.fn()
    adapter.subscribe?.(a)
    adapter.subscribe?.(b)
    adapter.setSearch((prev) => ({ ...prev, page: 2 }))
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })
})

describe('withDefaultState', () => {
  it('returns a function that merges partial state with defaults', () => {
    const apply = withDefaultState({ page: 1, perPage: 10, sort: '' })
    expect(apply({ page: 3 })).toEqual({ page: 3, perPage: 10, sort: '' })
  })

  it('returns full defaults when called with no arguments', () => {
    const apply = withDefaultState({ page: 1, perPage: 10 })
    expect(apply()).toEqual({ page: 1, perPage: 10 })
  })

  it('returns full defaults when called with empty object', () => {
    const apply = withDefaultState({ page: 1, perPage: 10 })
    expect(apply({})).toEqual({ page: 1, perPage: 10 })
  })

  it('overrides nested objects (shallow merge)', () => {
    const apply = withDefaultState<Record<string, number>>({ a: 1, b: 2 })
    expect(apply({ b: 3, c: 4 })).toEqual({ a: 1, b: 3, c: 4 })
  })
})

describe('buildSearchHref', () => {
  it('returns basePath when search is empty', () => {
    expect(buildSearchHref('/dashboard/users', {})).toBe('/dashboard/users')
  })

  it('builds query string from search params', () => {
    const href = buildSearchHref('/dashboard/users', { page: 2, perPage: 50 })
    expect(href).toMatch(/^\/dashboard\/users\?/)
    expect(href).toContain('page=2')
    expect(href).toContain('perPage=50')
  })

  it('joins array values with comma', () => {
    const href = buildSearchHref('/dashboard/users', { role: ['admin', 'user'] })
    expect(href).toContain('role=admin%2Cuser')
  })

  it('skips null and undefined values', () => {
    const href = buildSearchHref('/dashboard/users', {
      page: 1,
      sort: null,
      name: undefined,
    })
    expect(href).toContain('page=1')
    expect(href).not.toContain('sort')
    expect(href).not.toContain('name')
  })
})

describe('buildPaginationSearch', () => {
  it('writes page without perPage when page size is unchanged', () => {
    const result = buildPaginationSearch({ page: 1, perPage: 10 }, 1, 10, 10)
    expect(result).toEqual({ page: 2, perPage: 10 })
  })

  it('writes both page and perPage when page size changes', () => {
    const result = buildPaginationSearch({ page: 1, perPage: 10 }, 0, 50, 10)
    expect(result).toEqual({ page: 1, perPage: 50 })
  })

  it('preserves unrelated keys during pagination', () => {
    const result = buildPaginationSearch(
      { page: 1, perPage: 10, name: 'Bob', role: 'admin' },
      1, 10, 10,
    )
    expect(result.name).toBe('Bob')
    expect(result.role).toBe('admin')
  })
})

describe('buildSortSearch', () => {
  it('writes serialized sort to search', () => {
    const sort = JSON.stringify([{ id: 'name', desc: true }])
    const result = buildSortSearch({ page: 1, perPage: 10 }, sort)
    expect(result.sort).toBe(sort)
  })

  it('deletes sort key when value is undefined', () => {
    const result = buildSortSearch(
      { page: 1, perPage: 10, sort: 'existing' },
      undefined,
    )
    expect(result.sort).toBeUndefined()
    expect(result).not.toHaveProperty('sort')
  })

  it('preserves JSON sort with commas intact (no comma-split corruption)', () => {
    const sort = JSON.stringify([
      { id: 'name', desc: true },
      { id: 'role', desc: false },
    ])
    const result = buildSortSearch({ page: 1 }, sort)
    expect(result.sort).toBe(sort)
    // Verify commas are preserved intact in the serialized JSON
    expect((result.sort as string).includes(',')).toBe(true)
  })
})

describe('buildFilterSearch', () => {
  it('resets page to 1', () => {
    const result = buildFilterSearch({ page: 5, perPage: 10 }, { name: 'Alice' })
    expect(result.page).toBe(1)
    expect(result.name).toBe('Alice')
  })

  it('serializes array values as comma-joined strings', () => {
    const result = buildFilterSearch({ page: 1, perPage: 10 }, { role: ['admin', 'user'] })
    expect(result.role).toBe('admin,user')
  })

  it('removes key when value is null', () => {
    const result = buildFilterSearch(
      { page: 1, perPage: 10, name: 'Alice' },
      { name: null },
    )
    expect(result.page).toBe(1)
    expect(result).not.toHaveProperty('name')
  })

  it('preserves unrelated keys during filter update', () => {
    const result = buildFilterSearch(
      { page: 1, perPage: 10, sort: 'sorted' },
      { name: 'Bob' },
    )
    expect(result.sort).toBe('sorted')
  })
})
