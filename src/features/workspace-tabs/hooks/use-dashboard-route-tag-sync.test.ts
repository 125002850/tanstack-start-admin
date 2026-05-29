import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { useDashboardRouteTagSync, findDeepestRouteMatch } from './use-dashboard-route-tag-sync'
import { useWorkspaceTagStore } from '../utils/store'

// Mutable state that tests control to simulate URL changes
let mockPathname = '/dashboard/overview'
let mockSearch = ''

const mockRoutesByPath = {
  '/': {},
  '/dashboard': {
    options: {
      staticData: { label: '控制台', workspace: { tagEnabled: false, keepAlive: false } },
    },
  },
  '/dashboard/overview': {
    options: {
      staticData: { label: '仪表盘', title: '仪表盘', workspace: { tagEnabled: true, keepAlive: false } },
    },
  },
  '/dashboard/product/': {
    options: {
      staticData: { label: '产品管理', title: '产品管理', workspace: { tagEnabled: true, keepAlive: true } },
    },
  },
  '/dashboard/product/$productId': {
    options: {
      staticData: { label: '产品详情', title: '产品详情', workspace: { tagEnabled: true, keepAlive: true } },
    },
  },
  '/dashboard/users': {
    options: {
      staticData: { label: '用户管理', title: '用户管理', workspace: { tagEnabled: true, keepAlive: true } },
    },
  },
}

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ routesByPath: mockRoutesByPath }),
  useRouterState: ({
    select,
  }: {
    select?: (state: {
      location: { pathname: string; searchStr: string; search: Record<string, never> }
    }) => unknown
  }) => {
    const state = { location: { pathname: mockPathname, searchStr: mockSearch, search: {} } }
    return select ? select(state) : state
  },
}))

function SyncHarness() {
  useDashboardRouteTagSync()
  return null
}

function resetStore() {
  useWorkspaceTagStore.setState({ tabs: {}, activeId: null, openedOrder: [] })
}

describe('findDeepestRouteMatch', () => {
  it('matches a static route', () => {
    const match = findDeepestRouteMatch('/dashboard/product', mockRoutesByPath)
    expect(match).toBeDefined()
    expect(match!.staticData.label).toBe('产品管理')
  })

  it('matches a dynamic route with $param', () => {
    const match = findDeepestRouteMatch('/dashboard/product/123', mockRoutesByPath)
    expect(match).toBeDefined()
    expect(match!.staticData.label).toBe('产品详情')
    expect(match!.pattern).toBe('/dashboard/product/$productId')
  })

  it('prefers the deepest matching route', () => {
    const match = findDeepestRouteMatch('/dashboard/product/456', mockRoutesByPath)
    expect(match).toBeDefined()
    expect(match!.staticData.label).toBe('产品详情')
  })

  it('returns undefined for non-matching paths', () => {
    const match = findDeepestRouteMatch('/dashboard/nonexistent', mockRoutesByPath)
    expect(match).toBeUndefined()
  })

  it('matches dashboard home route', () => {
    const match = findDeepestRouteMatch('/dashboard/overview', mockRoutesByPath)
    expect(match).toBeDefined()
    expect(match!.staticData.label).toBe('仪表盘')
  })
})

describe('useDashboardRouteTagSync (hook integration)', () => {
  beforeEach(() => {
    resetStore()
    mockPathname = '/dashboard/overview'
    mockSearch = ''
    cleanup()
  })

  afterEach(cleanup)

  it('seeds home tag as non-closable on mount', () => {
    render(React.createElement(SyncHarness))
    const state = useWorkspaceTagStore.getState()
    const homeTab = state.tabs['/dashboard/overview']
    expect(homeTab).toBeDefined()
    expect(homeTab.closable).toBe(false)
    expect(homeTab.title).toBe('仪表盘')
  })

  it('syncs a non-home route as a closable tag', () => {
    mockPathname = '/dashboard/product'
    render(React.createElement(SyncHarness))
    const state = useWorkspaceTagStore.getState()
    const productTab = state.tabs['/dashboard/product']
    expect(productTab).toBeDefined()
    expect(productTab.closable).toBe(true)
    expect(productTab.keepAlive).toBe(true)
  })

  it('normalizes a trailing-slash pathname to the canonical tab id', () => {
    mockPathname = '/dashboard/product/'
    render(React.createElement(SyncHarness))
    const state = useWorkspaceTagStore.getState()
    expect(state.tabs['/dashboard/product']).toBeDefined()
    expect(state.tabs['/dashboard/product/']).toBeUndefined()
    expect(state.tabs['/dashboard/product']?.href).toBe('/dashboard/product')
  })

  it('does not duplicate tabs when only the trailing slash changes', () => {
    mockPathname = '/dashboard/product'
    const { rerender } = render(React.createElement(SyncHarness))

    mockPathname = '/dashboard/product/'
    rerender(React.createElement(SyncHarness))

    const state = useWorkspaceTagStore.getState()
    expect(state.openedOrder.filter((id) => id === '/dashboard/product')).toHaveLength(1)
    expect(state.tabs['/dashboard/product/']).toBeUndefined()
  })

  it('sets the synced route as the active tab', () => {
    mockPathname = '/dashboard/users'
    render(React.createElement(SyncHarness))
    const state = useWorkspaceTagStore.getState()
    expect(state.activeId).toBe('/dashboard/users')
    expect(state.tabs['/dashboard/users']).toBeDefined()
  })

  it('skips the layout route /dashboard', () => {
    mockPathname = '/dashboard'
    render(React.createElement(SyncHarness))
    const state = useWorkspaceTagStore.getState()
    // Only the home tab should exist (seeded)
    expect(Object.keys(state.tabs)).toHaveLength(1)
    expect(state.tabs['/dashboard/overview']).toBeDefined()
  })

  it('preserves search params in the tag href', () => {
    mockPathname = '/dashboard/product'
    mockSearch = '?page=2&sort=name'
    render(React.createElement(SyncHarness))
    const state = useWorkspaceTagStore.getState()
    const productTab = state.tabs['/dashboard/product']
    expect(productTab).toBeDefined()
    expect(productTab.href).toBe('/dashboard/product?page=2&sort=name')
  })

  it('updates href when search params change', () => {
    mockPathname = '/dashboard/product'
    mockSearch = '?page=1'
    const { rerender } = render(React.createElement(SyncHarness))
    // Change search params and re-render
    mockSearch = '?page=2'
    rerender(React.createElement(SyncHarness))
    const state = useWorkspaceTagStore.getState()
    expect(state.tabs['/dashboard/product'].href).toBe('/dashboard/product?page=2')
  })

  it('does not re-seed home tab if it already exists', () => {
    // Pre-seed the home tab
    useWorkspaceTagStore.getState().openOrActivate({
      id: '/dashboard/overview',
      href: '/dashboard/overview',
      title: '仪表盘',
      closable: false,
      keepAlive: false,
    })
    render(React.createElement(SyncHarness))
    const state = useWorkspaceTagStore.getState()
    const homeEntries = state.openedOrder.filter((id) => id === '/dashboard/overview')
    expect(homeEntries).toHaveLength(1)
  })

  it('matches dynamic route and creates tag with correct title', () => {
    mockPathname = '/dashboard/product/789'
    render(React.createElement(SyncHarness))
    const state = useWorkspaceTagStore.getState()
    const detailTab = state.tabs['/dashboard/product/789']
    expect(detailTab).toBeDefined()
    expect(detailTab.title).toBe('产品详情')
    expect(detailTab.closable).toBe(true)
    expect(detailTab.keepAlive).toBe(true)
  })

  it('uses pathname as title when no staticData matches', () => {
    mockPathname = '/dashboard/unknown-page'
    render(React.createElement(SyncHarness))
    const state = useWorkspaceTagStore.getState()
    const tab = state.tabs['/dashboard/unknown-page']
    expect(tab).toBeDefined()
    expect(tab.title).toBe('/dashboard/unknown-page')
  })
})
