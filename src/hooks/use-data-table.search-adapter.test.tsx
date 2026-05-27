/**
 * DEPRECATED COMPATIBILITY PATH — searchAdapter mode tests.
 *
 * These tests validate the legacy searchAdapter code path in useDataTable.
 * The default (internal-state) path is tested in use-data-table.internal-state.test.tsx.
 * Once all consumers migrate off searchAdapter, this file can be removed.
 *
 * @deprecated
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import * as React from 'react'
import type { ColumnDef } from '@tanstack/react-table'

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}))

import { useDataTable } from '@/hooks/use-data-table'
import {
  buildPaginationSearch,
  buildSortSearch,
  buildFilterSearch,
  createStaticAdapter,
} from '@/features/workspace-tabs/lib/workspace-route-state'
import type { DataTableSearchAdapter } from '@/features/workspace-tabs/types'

// ── test data ─────────────────────────────────────────────

type TestRow = { id: number; name: string }

const columns: ColumnDef<TestRow>[] = [
  { id: 'id', header: 'ID', accessorKey: 'id' },
  { id: 'name', header: 'Name', accessorKey: 'name', enableColumnFilter: true },
]

const data: TestRow[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
]

afterEach(cleanup)

// ── test component ────────────────────────────────────────

function TableTester({ adapter }: { adapter: DataTableSearchAdapter }) {
  const { table } = useDataTable({
    columns,
    data,
    pageCount: 2,
    searchAdapter: adapter,
  })

  const state = table.getState()

  return (
    <div>
      <span data-testid="page">{state.pagination.pageIndex + 1}</span>
      <span data-testid="pageSize">{state.pagination.pageSize}</span>
      <span data-testid="sort">{JSON.stringify(state.sorting)}</span>
    </div>
  )
}

// ── production helper tests ─────────────────────────────────

describe('useDataTable search adapter — production helpers', () => {
  it('pagination change writes page without perPage when page size is unchanged', () => {
    const result = buildPaginationSearch({ page: 1, perPage: 10 }, 1, 10, 10)
    expect(result.page).toBe(2)
    expect(result.perPage).toBe(10)
  })

  it('pagination change writes both page and perPage when page size changes', () => {
    const result = buildPaginationSearch({ page: 1, perPage: 10 }, 0, 50, 10)
    expect(result.page).toBe(1)
    expect(result.perPage).toBe(50)
  })

  it('sort change writes serialized JSON via buildSortSearch', () => {
    const sort = JSON.stringify([{ id: 'name', desc: true }])
    const result = buildSortSearch({ page: 1, perPage: 10 }, sort)
    expect(result.sort).toBe(sort)
  })

  it('sort change clears sort key when sorting is empty', () => {
    const result = buildSortSearch(
      { page: 1, perPage: 10, sort: 'old-sort' },
      undefined,
    )
    expect(result.sort).toBeUndefined()
  })

  it('filter change resets page to 1 via buildFilterSearch', () => {
    const result = buildFilterSearch({ page: 5, perPage: 10 }, { name: 'Alice' })
    expect(result.page).toBe(1)
    expect(result.name).toBe('Alice')
  })

  it('filter change serializes array values as comma-joined strings', () => {
    const result = buildFilterSearch(
      { page: 1, perPage: 10 },
      { role: ['admin', 'user'] },
    )
    expect(result.role).toBe('admin,user')
  })

  it('filter change with null value removes the key', () => {
    const result = buildFilterSearch(
      { page: 1, perPage: 10, name: 'Alice' },
      { name: null },
    )
    expect(result.page).toBe(1)
    expect(result).not.toHaveProperty('name')
  })

  it('preserves unrelated keys during pagination update', () => {
    const result = buildPaginationSearch(
      { page: 1, perPage: 10, name: 'Bob', role: 'admin,user' },
      1,
      10,
      10,
    )
    expect(result.page).toBe(2)
    expect(result.name).toBe('Bob')
    expect(result.role).toBe('admin,user')
  })
})

// ── real hook component tests ──────────────────────────────

describe('useDataTable with searchAdapter — hook component', () => {
  it('reads initial pagination from adapter', () => {
    const adapter = createStaticAdapter({ page: 2, perPage: 25 })
    render(<TableTester adapter={adapter} />)
    expect(screen.getByTestId('page').textContent).toBe('2')
    expect(screen.getByTestId('pageSize').textContent).toBe('25')
  })

  it('syncs pagination immediately on adapter identity change without prior notification', () => {
    const adapterA = createStaticAdapter({ page: 2, perPage: 25 })
    const { rerender } = render(<TableTester adapter={adapterA} />)
    expect(screen.getByTestId('page').textContent).toBe('2')

    const adapterB = createStaticAdapter({ page: 5, perPage: 100 })
    rerender(<TableTester adapter={adapterB} />)

    expect(screen.getByTestId('page').textContent).toBe('5')
    expect(screen.getByTestId('pageSize').textContent).toBe('100')
  })

  it('external adapter.setSearch updates table pagination', () => {
    const adapter = createStaticAdapter({ page: 1, perPage: 10 })
    render(<TableTester adapter={adapter} />)

    act(() => {
      adapter.setSearch((prev) => ({ ...prev, page: 3, perPage: 50 }))
    })

    expect(screen.getByTestId('page').textContent).toBe('3')
    expect(screen.getByTestId('pageSize').textContent).toBe('50')
  })

  it('external adapter.setSearch updates table sort state', () => {
    const adapter = createStaticAdapter({ page: 1, perPage: 10 })
    render(<TableTester adapter={adapter} />)

    const sort = JSON.stringify([{ id: 'name', desc: true }])
    act(() => {
      adapter.setSearch((prev) => ({ ...prev, sort }))
    })

    expect(screen.getByTestId('sort').textContent).toBe(
      JSON.stringify([{ id: 'name', desc: true }]),
    )
  })
})

// ── adapter sync cycle (simulates useDataTable useEffect pattern) ──

describe('adapter sync cycle — useDataTable integration', () => {
  it('on adapter switch, consumer immediately reads state from new adapter', () => {
    const newAdapter = createStaticAdapter({ page: 5, perPage: 100 })
    const consumerState = { ...newAdapter.getSearch() }
    expect(consumerState.page).toBe(5)
    expect(consumerState.perPage).toBe(100)
  })

  it('subscribe callback delivers latest adapter state to consumer', () => {
    const adapter = createStaticAdapter({ page: 1, perPage: 10 })
    const consumerStates: Record<string, unknown>[] = []

    adapter.subscribe?.(() => {
      consumerStates.push({ ...adapter.getSearch() })
    })

    adapter.setSearch((prev) => ({ ...prev, page: 3, perPage: 50 }))

    expect(consumerStates).toHaveLength(1)
    expect(consumerStates[0]).toEqual({ page: 3, perPage: 50 })
  })

  it('unsubscribe from old adapter prevents stale callbacks on switch', () => {
    const adapter1 = createStaticAdapter({ page: 1 })
    const adapter2 = createStaticAdapter({ page: 10 })

    const updates: number[] = []
    const unsub1 = adapter1.subscribe?.(() => {
      updates.push(adapter1.getSearch().page as number)
    })
    const unsub2 = adapter2.subscribe?.(() => {
      updates.push(adapter2.getSearch().page as number)
    })

    unsub1?.()

    adapter1.setSearch((prev) => ({ ...prev, page: 2 }))
    adapter2.setSearch((prev) => ({ ...prev, page: 20 }))

    expect(updates).toEqual([20])
    unsub2?.()
  })

  it('user interaction round-trip: write → adapter state → subscribe → consumer', () => {
    const adapter = createStaticAdapter({ page: 1, perPage: 10 })

    const consumerPages: number[] = []
    adapter.subscribe?.(() => {
      consumerPages.push(adapter.getSearch().page as number)
    })

    const newPageIndex = 1
    const next = buildPaginationSearch(
      adapter.getSearch(),
      newPageIndex,
      10,
      10,
    )
    adapter.setSearch(() => next)

    expect(adapter.getSearch().page).toBe(2)
    expect(consumerPages).toEqual([2])
  })

  it('sort round-trip: buildSortSearch → adapter.setSearch → consumer reads sort', () => {
    const adapter = createStaticAdapter({ page: 1, perPage: 10 })

    const consumerSorts: string[] = []
    adapter.subscribe?.(() => {
      consumerSorts.push(adapter.getSearch().sort as string)
    })

    const serialized = JSON.stringify([{ id: 'name', desc: true }])
    const next = buildSortSearch(adapter.getSearch(), serialized)
    adapter.setSearch(() => next)

    expect(adapter.getSearch().sort).toBe(serialized)
    expect(consumerSorts).toEqual([serialized])
  })

  it('filter round-trip: buildFilterSearch → adapter.setSearch → page reset to 1', () => {
    const adapter = createStaticAdapter({ page: 5, perPage: 10 })

    const consumerFilters: Record<string, unknown>[] = []
    adapter.subscribe?.(() => {
      consumerFilters.push({ ...adapter.getSearch() })
    })

    const next = buildFilterSearch(adapter.getSearch(), { name: 'Bob' })
    adapter.setSearch(() => next)

    expect(adapter.getSearch().page).toBe(1)
    expect(adapter.getSearch().name).toBe('Bob')
    expect(consumerFilters).toHaveLength(1)
    expect(consumerFilters[0]).toEqual({ page: 1, perPage: 10, name: 'Bob' })
  })

  it('multiple rapid adapter updates all reach consumer in order', () => {
    const adapter = createStaticAdapter({ page: 1, clicks: 0 })

    const history: number[] = []
    adapter.subscribe?.(() => {
      history.push(adapter.getSearch().clicks as number)
    })

    for (let i = 0; i < 5; i++) {
      const current = adapter.getSearch()
      const next = buildPaginationSearch(current, i + 1, 10, 10)
      adapter.setSearch(() => ({ ...next, clicks: (current.clicks as number) + 1 }))
    }

    expect(history).toEqual([1, 2, 3, 4, 5])
    expect(adapter.getSearch().page).toBe(6)
  })
})

// ── subscribe external sync tests ────────────────────────────

describe('createStaticAdapter subscribe — external sync support', () => {
  it('adapter subscribe fires when setSearch is called', () => {
    const adapter = createStaticAdapter({ page: 1 })
    const listener = vi.fn()
    adapter.subscribe?.(listener)

    adapter.setSearch((prev) => ({ ...prev, page: 2 }))

    expect(listener).toHaveBeenCalledTimes(1)
    expect(adapter.getSearch().page).toBe(2)
  })

  it('adapter subscribe returns unsubscribe that stops notifications', () => {
    const adapter = createStaticAdapter({ page: 1 })
    const listener = vi.fn()
    const unsub = adapter.subscribe?.(listener)
    unsub?.()

    adapter.setSearch((prev) => ({ ...prev, page: 2 }))

    expect(listener).not.toHaveBeenCalled()
  })

  it('external update via setSearch triggers subscriber with updated state', () => {
    const adapter = createStaticAdapter({ page: 1, perPage: 10 })
    const captured: Record<string, unknown>[] = []
    adapter.subscribe?.(() => {
      captured.push({ ...adapter.getSearch() })
    })

    adapter.setSearch((prev) => ({ ...prev, page: 3 }))

    expect(captured).toHaveLength(1)
    expect(captured[0]).toEqual({ page: 3, perPage: 10 })
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Regression: single interaction → single adapter write, no render-phase
// setState, no side effects inside state updaters.
// ═══════════════════════════════════════════════════════════════════════

function InteractionTester({ adapter }: { adapter: DataTableSearchAdapter }) {
  const { table } = useDataTable({
    columns,
    data,
    pageCount: 2,
    searchAdapter: adapter,
  })

  const tableRef = React.useRef(table)
  tableRef.current = table

  const state = table.getState()

  return React.createElement('div', null, [
    React.createElement('span', { key: 'page', 'data-testid': 'page' }, String(state.pagination.pageIndex + 1)),
    React.createElement('span', { key: 'size', 'data-testid': 'pageSize' }, String(state.pagination.pageSize)),
    React.createElement('span', { key: 'sort', 'data-testid': 'sort' }, JSON.stringify(state.sorting)),
    React.createElement('button', {
      key: 'sort-btn',
      'data-testid': 'sort-name',
      onClick: () => table.setSorting([{ id: 'name', desc: true }]),
    }, 'Sort'),
    React.createElement('button', {
      key: 'filter-btn',
      'data-testid': 'filter-name',
      onClick: () => table.setColumnFilters([{ id: 'name', value: 'Alice' }]),
    }, 'Filter'),
  ])
}

describe('adapter write purity', () => {
  afterEach(cleanup)

  it('single table.setSorting triggers exactly one adapter.setSearch call', () => {
    const adapter = createStaticAdapter({ page: 1, perPage: 10 })
    const setSearchSpy = vi.spyOn(adapter, 'setSearch')

    render(React.createElement(InteractionTester, { adapter }))
    act(() => {
      screen.getByTestId('sort-name').click()
    })

    // Exactly one adapter write per user interaction
    expect(setSearchSpy).toHaveBeenCalledTimes(1)

    // Verify the adapter received the sort
    const sort = JSON.parse(screen.getByTestId('sort').textContent!)
    expect(sort).toEqual([{ id: 'name', desc: true }])
  })

  it('single table.setColumnFilters triggers exactly one adapter.setSearch call', () => {
    vi.useFakeTimers()
    const adapter = createStaticAdapter({ page: 1, perPage: 10 })
    const setSearchSpy = vi.spyOn(adapter, 'setSearch')

    render(React.createElement(InteractionTester, { adapter }))
    act(() => {
      screen.getByTestId('filter-name').click()
    })

    // Advance past the 300ms debounce
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(setSearchSpy).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('adapter identity switch: first render shows new snapshot values, not old adapter stale state', () => {
    const adapterA = createStaticAdapter({ page: 2, perPage: 25 })
    const adapterB = createStaticAdapter({ page: 5, perPage: 100 })

    const getSearchB = vi.spyOn(adapterB, 'getSearch')

    const { rerender } = render(React.createElement(InteractionTester, { adapter: adapterA }))
    // Verify adapterA's values are displayed
    expect(screen.getByTestId('page').textContent).toBe('2')
    expect(screen.getByTestId('pageSize').textContent).toBe('25')

    // Switch adapter identity
    rerender(React.createElement(InteractionTester, { adapter: adapterB }))

    // getSnapshot called during render to supply first-frame values
    expect(getSearchB).toHaveBeenCalled()

    // Rendered values MUST be adapterB's, not adapterA's.
    // With useEffect-based sync, the first frame would still show
    // page=2 perPage=25 (adapterA's stale state).
    expect(screen.getByTestId('page').textContent).toBe('5')
    expect(screen.getByTestId('pageSize').textContent).toBe('100')
  })

  it('subscribe notification fires exactly once per external adapter update', () => {
    const adapter = createStaticAdapter({ page: 1, perPage: 10 })
    const listener = vi.fn()
    adapter.subscribe?.(listener)

    adapter.setSearch((prev) => ({ ...prev, page: 3 }))

    // External adapter.setSearch should notify subscribers exactly once
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
