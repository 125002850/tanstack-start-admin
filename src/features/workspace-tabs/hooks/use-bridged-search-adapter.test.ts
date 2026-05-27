/**
 * @deprecated inventory-only — tests legacy v1 bridged search adapter.
 * Superseded by V2 internal-state useDataTable (Task V2-02A).
 * DO NOT import in new test or feature code.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBridgedSearchAdapter } from './use-bridged-search-adapter'
import type { WorkspaceRouteDefinition } from '../types'

type TestState = { page: number; perPage: number; name?: string }

function makeDefinition(): WorkspaceRouteDefinition<TestState> {
  return {
    parse(search) {
      return {
        page: (search.page as number) ?? 1,
        perPage: (search.perPage as number) ?? 10,
        ...(typeof search.name === 'string' ? { name: search.name } : {}),
      }
    },
    stringify(state) {
      const s: Record<string, unknown> = { page: state.page, perPage: state.perPage }
      if (state.name) s.name = state.name
      return s
    },
    buildHref(state) {
      const p = new URLSearchParams()
      p.set('page', String(state.page))
      p.set('perPage', String(state.perPage))
      if (state.name) p.set('name', state.name)
      return `/test?${p.toString()}`
    },
    getPageChrome: () => ({ title: 'Test' }),
    refresh: vi.fn(),
  }
}

describe('useBridgedSearchAdapter', () => {
  it('getSearch returns initial state', () => {
    const def = makeDefinition()
    const updateState = vi.fn()
    const { result } = renderHook(() =>
      useBridgedSearchAdapter({ page: 1, perPage: 10 }, updateState, def),
    )
    expect(result.current.getSearch()).toEqual({ page: 1, perPage: 10 })
  })

  it('setSearch updates internal state and calls updateState', () => {
    const def = makeDefinition()
    const updateState = vi.fn()
    const { result } = renderHook(() =>
      useBridgedSearchAdapter({ page: 1, perPage: 10 }, updateState, def),
    )

    act(() => {
      result.current.setSearch((prev) => ({ ...prev, page: 3 }))
    })

    expect(result.current.getSearch().page).toBe(3)
    expect(updateState).toHaveBeenCalledTimes(1)
    const updater = updateState.mock.calls[0][0]
    expect(updater({ page: 1, perPage: 10 })).toEqual({ page: 3, perPage: 10 })
  })

  it('notifies subscribers when setSearch is called', () => {
    const def = makeDefinition()
    const updateState = vi.fn()
    const { result } = renderHook(() =>
      useBridgedSearchAdapter({ page: 1, perPage: 10 }, updateState, def),
    )

    const listener = vi.fn()
    result.current.subscribe?.(listener)

    act(() => {
      result.current.setSearch((prev) => ({ ...prev, page: 5 }))
    })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(result.current.getSearch().page).toBe(5)
  })

  it('notifies subscribers when external state changes (back/forward, perPage seeding)', () => {
    const def = makeDefinition()
    const updateState = vi.fn()
    const { result, rerender } = renderHook(
      ({ state }) => useBridgedSearchAdapter(state, updateState, def),
      { initialProps: { state: { page: 1, perPage: 10 } as TestState } },
    )

    const listener = vi.fn()
    result.current.subscribe?.(listener)

    // Simulate external state change (e.g. browser back/forward or perPage seed)
    rerender({ state: { page: 2, perPage: 50, name: 'Alice' } })

    // The subscriber must be notified so it can re-read getSearch()
    expect(listener).toHaveBeenCalledTimes(1)
    // After notification, consumer calling getSearch() must see the new state
    expect(result.current.getSearch()).toEqual({ page: 2, perPage: 50, name: 'Alice' })
  })

  it('adapter identity is stable across re-renders', () => {
    const def = makeDefinition()
    const updateState = vi.fn()
    const { result, rerender } = renderHook(
      ({ state }) => useBridgedSearchAdapter(state, updateState, def),
      { initialProps: { state: { page: 1, perPage: 10 } as TestState } },
    )

    const first = result.current
    rerender({ state: { page: 3, perPage: 30 } })
    const second = result.current

    expect(first).toBe(second)
  })

  it('unsubscribe removes listener', () => {
    const def = makeDefinition()
    const updateState = vi.fn()
    const { result, rerender } = renderHook(
      ({ state }) => useBridgedSearchAdapter(state, updateState, def),
      { initialProps: { state: { page: 1, perPage: 10 } as TestState } },
    )

    const listener = vi.fn()
    const unsub = result.current.subscribe?.(listener)
    unsub?.()

    rerender({ state: { page: 2, perPage: 20 } })

    expect(listener).not.toHaveBeenCalled()
  })

  it('consumer can read latest search after external state sync via subscriber notification', () => {
    const def = makeDefinition()
    const updateState = vi.fn()
    const { result, rerender } = renderHook(
      ({ state }) => useBridgedSearchAdapter(state, updateState, def),
      { initialProps: { state: { page: 1, perPage: 10 } as TestState } },
    )

    // Simulates useDataTable's subscribe pattern
    const consumerStates: Record<string, unknown>[] = []
    result.current.subscribe?.(() => {
      consumerStates.push({ ...result.current.getSearch() })
    })

    rerender({ state: { page: 5, perPage: 100 } })

    expect(consumerStates).toHaveLength(1)
    expect(consumerStates[0]).toEqual({ page: 5, perPage: 100 })
  })

  it('multiple rapid external state changes all notify subscribers', () => {
    const def = makeDefinition()
    const updateState = vi.fn()
    const { result, rerender } = renderHook(
      ({ state }) => useBridgedSearchAdapter(state, updateState, def),
      { initialProps: { state: { page: 1, perPage: 10 } as TestState } },
    )

    const snapshots: Record<string, unknown>[] = []
    result.current.subscribe?.(() => {
      snapshots.push({ ...result.current.getSearch() })
    })

    rerender({ state: { page: 2, perPage: 10 } })
    rerender({ state: { page: 2, perPage: 50 } })
    rerender({ state: { page: 3, perPage: 50, name: 'Bob' } })

    expect(snapshots).toHaveLength(3)
    expect(snapshots[2]).toEqual({ page: 3, perPage: 50, name: 'Bob' })
  })
})
