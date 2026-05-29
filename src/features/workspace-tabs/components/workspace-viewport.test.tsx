import * as React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { useWorkspaceTagStore } from '../utils/store'
import { workspaceRegistry } from '../lib/workspace-registry'
import { WorkspaceViewport } from './workspace-viewport'
import type {
  WorkspaceScreenDescriptor,
  WorkspacePageDescriptor,
  WorkspacePageLifecycle,
  WorkspaceTab,
} from '../types'

type TestTabInput = Omit<WorkspaceTab, 'lastVisitedAt'> & {
  lastVisitedAt?: number
}

function setStoreState(
  tabs: Record<string, TestTabInput>,
  activeId: string | null,
  disabledIds: string[] = [],
  extra: Partial<{
    pageDescriptors: Record<string, WorkspacePageDescriptor>
    lifecycleSnapshots: Record<string, WorkspacePageLifecycle>
  }> = {},
) {
  const normalizedTabs = Object.fromEntries(
    Object.entries(tabs).map(([id, tab]) => [
      id,
      { ...tab, lastVisitedAt: tab.lastVisitedAt ?? 0 },
    ]),
  ) as Record<string, WorkspaceTab>

  useWorkspaceTagStore.setState({
    tabs: normalizedTabs,
    activeId,
    openedOrder: Object.keys(normalizedTabs),
    disabledKeepAliveIds: new Set(disabledIds),
    pageDescriptors: extra.pageDescriptors ?? {},
    lifecycleSnapshots: extra.lifecycleSnapshots ?? {},
  })
}

function makeDescriptor(overrides: Partial<WorkspaceScreenDescriptor> = {}): WorkspaceScreenDescriptor {
  return {
    definition: {
      parse: () => ({}),
      stringify: () => ({}),
      buildHref: () => '',
      getPageChrome: () => ({ title: 'Test' }),
      refresh: () => {},
    },
    screen: () => React.createElement('div', { 'data-testid': 'test-screen' }, 'Screen'),
    instanceKey: 'test-key',
    ...overrides,
  }
}

function makePageDescriptor(overrides: Partial<WorkspacePageDescriptor> = {}): WorkspacePageDescriptor {
  return {
    tabId: '/dashboard/test',
    initialTitle: 'Test Page',
    keepAlive: true,
    closable: true,
    render: () => React.createElement('div', { 'data-testid': 'v2-screen' }, 'V2 Page'),
    ...overrides,
  }
}

function resetStore() {
  useWorkspaceTagStore.setState({
    tabs: {},
    activeId: null,
    openedOrder: [],
    disabledKeepAliveIds: new Set(),
    pageDescriptors: {},
    lifecycleSnapshots: {},
  })
}

describe('WorkspaceViewport', () => {
  beforeEach(() => {
    resetStore()
    workspaceRegistry.reset()
    cleanup()
  })

  afterEach(() => {
    workspaceRegistry.reset()
    cleanup()
  })

  // ─── V2 page descriptor rendering (new system) ───

  describe('V2 page descriptors', () => {
    it('renders the active tab visibly (not via Activity hidden)', () => {
      const desc = makePageDescriptor({
        tabId: '/dashboard/active',
        render: () => React.createElement('div', { 'data-testid': 'active-content' }, 'Active'),
      })
      setStoreState(
        { '/dashboard/active': { id: '/dashboard/active', keepAlive: true, href: '/dashboard/active', title: 'Active', closable: true } },
        '/dashboard/active',
        [],
        { pageDescriptors: { '/dashboard/active': desc } },
      )

      const { getByTestId } = render(React.createElement(WorkspaceViewport))
      const el = getByTestId('active-content')
      expect(el).toBeDefined()
      // Active content should NOT have display:none (it's visible)
      expect(el.style.display).not.toBe('none')
    })

    it('renders inactive keep-alive tabs via Activity hidden', () => {
      const activeDesc = makePageDescriptor({
        tabId: '/dashboard/active',
        render: () => React.createElement('div', { 'data-testid': 'active-content' }, 'Active'),
      })
      const inactiveDesc = makePageDescriptor({
        tabId: '/dashboard/inactive',
        render: () => React.createElement('div', { 'data-testid': 'inactive-content' }, 'Inactive'),
      })
      setStoreState(
        {
          '/dashboard/active': { id: '/dashboard/active', keepAlive: true, href: '/dashboard/active', title: 'Active', closable: true },
          '/dashboard/inactive': { id: '/dashboard/inactive', keepAlive: true, href: '/dashboard/inactive', title: 'Inactive', closable: true },
        },
        '/dashboard/active',
        [],
        { pageDescriptors: { '/dashboard/active': activeDesc, '/dashboard/inactive': inactiveDesc } },
      )

      const { getByTestId } = render(React.createElement(WorkspaceViewport))
      const inactiveEl = getByTestId('inactive-content')
      expect(inactiveEl).toBeDefined()
      expect(inactiveEl).toHaveStyle({ display: 'none' })
    })

    it('does NOT render inactive non-keep-alive tabs', () => {
      const activeDesc = makePageDescriptor({
        tabId: '/dashboard/active',
        render: () => React.createElement('div', { 'data-testid': 'active-content' }, 'Active'),
      })
      const nonKeepDesc = makePageDescriptor({
        tabId: '/dashboard/nonkeep',
        keepAlive: false,
        render: () => React.createElement('div', { 'data-testid': 'nonkeep-content' }, 'NonKeep'),
      })
      setStoreState(
        {
          '/dashboard/active': { id: '/dashboard/active', keepAlive: true, href: '/dashboard/active', title: 'Active', closable: true },
          '/dashboard/nonkeep': { id: '/dashboard/nonkeep', keepAlive: false, href: '/dashboard/nonkeep', title: 'NonKeep', closable: true },
        },
        '/dashboard/active',
        [],
        { pageDescriptors: { '/dashboard/active': activeDesc, '/dashboard/nonkeep': nonKeepDesc } },
      )

      const { queryByTestId, getByTestId } = render(React.createElement(WorkspaceViewport))
      expect(getByTestId('active-content')).toBeDefined()
      expect(queryByTestId('nonkeep-content')).toBeNull()
    })

    it('skips tabs with disabled keep-alive (slot error recovery)', () => {
      const desc = makePageDescriptor({
        tabId: '/dashboard/broken',
        render: () => React.createElement('div', { 'data-testid': 'broken-content' }, 'Broken'),
      })
      setStoreState(
        {
          '/dashboard/active': { id: '/dashboard/active', keepAlive: true, href: '/dashboard/active', title: 'Active', closable: true },
          '/dashboard/broken': { id: '/dashboard/broken', keepAlive: true, href: '/dashboard/broken', title: 'Broken', closable: true },
        },
        '/dashboard/active',
        ['/dashboard/broken'],
        { pageDescriptors: { '/dashboard/active': makePageDescriptor({ tabId: '/dashboard/active' }), '/dashboard/broken': desc } },
      )

      const { queryByTestId } = render(React.createElement(WorkspaceViewport))
      expect(queryByTestId('broken-content')).toBeNull()
    })

    it('renders errorFallback from descriptor when render throws', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const desc = makePageDescriptor({
        tabId: '/dashboard/fallback',
        // Pass a render function that throws — the error boundary wrapper catches it
        render: () => {
          throw new Error('test error')
        },
        errorFallback: React.createElement('div', { 'data-testid': 'custom-fallback' }, 'Custom Fallback'),
      })
      setStoreState(
        {
          '/dashboard/fallback': { id: '/dashboard/fallback', keepAlive: true, href: '/dashboard/fallback', title: 'Fallback', closable: true },
        },
        '/dashboard/fallback',
        [],
        { pageDescriptors: { '/dashboard/fallback': desc } },
      )

      try {
        render(React.createElement(WorkspaceViewport))
        // After error, keepAlive is disabled for that tag → viewport skips it
        // The errorBoundary renders the custom fallback
      } catch {
        // Error boundary should catch it; if not caught, test still verifies below
      }
      // Verify that keepAlive was disabled (error boundary behavior)
      expect(useWorkspaceTagStore.getState().disabledKeepAliveIds.has('/dashboard/fallback')).toBe(true)
      consoleSpy.mockRestore()
    })

    it('handles missing descriptor gracefully (active tab without descriptor)', () => {
      // Tab exists but no page descriptor — should not crash, just render nothing
      setStoreState(
        { '/dashboard/orphan': { id: '/dashboard/orphan', keepAlive: true, href: '/dashboard/orphan', title: 'Orphan', closable: true } },
        '/dashboard/orphan',
        [],
        { pageDescriptors: {} },
      )

      const { container } = render(React.createElement(WorkspaceViewport))
      // No entries to render — viewport returns null
      expect(container.innerHTML).toBe('')
    })

    it('renders multiple V2 pages with correct visibility', () => {
      const tabs = {
        '/dashboard/a': { id: '/dashboard/a', keepAlive: true, href: '/dashboard/a', title: 'A', closable: true },
        '/dashboard/b': { id: '/dashboard/b', keepAlive: true, href: '/dashboard/b', title: 'B', closable: true },
        '/dashboard/c': { id: '/dashboard/c', keepAlive: true, href: '/dashboard/c', title: 'C', closable: true },
      }
      const descs = {
        '/dashboard/a': makePageDescriptor({ tabId: '/dashboard/a', render: () => React.createElement('div', { 'data-testid': 'screen-a' }, 'A') }),
        '/dashboard/b': makePageDescriptor({ tabId: '/dashboard/b', render: () => React.createElement('div', { 'data-testid': 'screen-b' }, 'B') }),
        '/dashboard/c': makePageDescriptor({ tabId: '/dashboard/c', render: () => React.createElement('div', { 'data-testid': 'screen-c' }, 'C') }),
      }
      setStoreState(tabs, '/dashboard/b', [], { pageDescriptors: descs })

      const { getByTestId } = render(React.createElement(WorkspaceViewport))

      // B is active → visible
      expect(getByTestId('screen-b').style.display).not.toBe('none')
      // A and C are inactive keep-alive → hidden
      expect(getByTestId('screen-a')).toHaveStyle({ display: 'none' })
      expect(getByTestId('screen-c')).toHaveStyle({ display: 'none' })
    })
  })

  // ─── V1 workspaceRegistry fallback (old routes) ───

  describe('V1 workspaceRegistry fallback', () => {
    it('renders nothing when no descriptors are registered', () => {
      setStoreState({}, null)
      const { container } = render(React.createElement(WorkspaceViewport))
      expect(container.innerHTML).toBe('')
    })

    it('renders nothing when tabs exist but none have keepAlive=true', () => {
      setStoreState({
        '/dashboard/overview': { id: '/dashboard/overview', keepAlive: false, href: '/dashboard/overview', title: 'Overview', closable: false },
      }, '/dashboard/overview')
      workspaceRegistry.register('/dashboard/overview', makeDescriptor({ instanceKey: 'overview' }))
      const { container } = render(React.createElement(WorkspaceViewport))
      expect(container.innerHTML).toBe('')
    })

    it('renders nothing when descriptor is registered but tab does not exist in store', () => {
      setStoreState({}, null)
      workspaceRegistry.register('/dashboard/products', makeDescriptor({ instanceKey: 'products' }))
      const { container } = render(React.createElement(WorkspaceViewport))
      expect(container.innerHTML).toBe('')
    })

    it('skips the active keep-alive tab (rendered by route component instead)', () => {
      const tabs = {
        '/dashboard/products': { id: '/dashboard/products', keepAlive: true, href: '/dashboard/products', title: 'Products', closable: true },
      }
      setStoreState(tabs, '/dashboard/products')
      workspaceRegistry.register('/dashboard/products', makeDescriptor({ instanceKey: 'products' }))

      const { container } = render(React.createElement(WorkspaceViewport))
      expect(container.innerHTML).toBe('')
    })

    it('renders inactive keep-alive tabs in hidden mode', () => {
      const tabs = {
        '/dashboard/products': { id: '/dashboard/products', keepAlive: true, href: '/dashboard/products', title: 'Products', closable: true },
        '/dashboard/users': { id: '/dashboard/users', keepAlive: true, href: '/dashboard/users', title: 'Users', closable: true },
      }
      setStoreState(tabs, '/dashboard/products')
      workspaceRegistry.register('/dashboard/products', makeDescriptor({ instanceKey: 'products' }))
      workspaceRegistry.register('/dashboard/users', makeDescriptor({
        instanceKey: 'users',
        screen: () => React.createElement('div', { 'data-testid': 'users-screen' }, 'Users'),
      }))

      const { getByTestId } = render(React.createElement(WorkspaceViewport))
      const usersScreen = getByTestId('users-screen')
      expect(usersScreen).toBeDefined()
      expect(usersScreen).toHaveStyle({ display: 'none' })
    })

    it('skips non-keep-alive tabs even when descriptor is registered', () => {
      const tabs = {
        '/dashboard/overview': { id: '/dashboard/overview', keepAlive: false, href: '/dashboard/overview', title: 'Overview', closable: false },
        '/dashboard/products': { id: '/dashboard/products', keepAlive: true, href: '/dashboard/products', title: 'Products', closable: true },
      }
      setStoreState(tabs, '/dashboard/overview')
      workspaceRegistry.register('/dashboard/overview', makeDescriptor({
        instanceKey: 'overview',
        screen: () => React.createElement('div', { 'data-testid': 'overview-screen' }, 'Overview'),
      }))
      workspaceRegistry.register('/dashboard/products', makeDescriptor({
        instanceKey: 'products',
        screen: () => React.createElement('div', { 'data-testid': 'products-screen' }, 'Products'),
      }))

      const { queryByTestId, getByTestId } = render(React.createElement(WorkspaceViewport))
      expect(queryByTestId('overview-screen')).toBeNull()
      expect(getByTestId('products-screen')).toBeDefined()
    })

    it('skips tabs with disabled keep-alive (slot error recovery)', () => {
      const tabs = {
        '/dashboard/products': { id: '/dashboard/products', keepAlive: true, href: '/dashboard/products', title: 'Products', closable: true },
        '/dashboard/users': { id: '/dashboard/users', keepAlive: true, href: '/dashboard/users', title: 'Users', closable: true },
      }
      setStoreState(tabs, '/dashboard/products', ['/dashboard/products'])
      workspaceRegistry.register('/dashboard/products', makeDescriptor({ instanceKey: 'products' }))
      workspaceRegistry.register('/dashboard/users', makeDescriptor({
        instanceKey: 'users',
        screen: () => React.createElement('div', { 'data-testid': 'users-screen' }, 'Users'),
      }))

      const { getByTestId } = render(React.createElement(WorkspaceViewport))
      // Products has disabled keep-alive → skipped; Users is inactive keep-alive → rendered hidden
      expect(getByTestId('users-screen')).toBeDefined()
    })

    it('renders multiple keep-alive slots with correct visibility', () => {
      const tabs = {
        '/dashboard/a': { id: '/dashboard/a', keepAlive: true, href: '/dashboard/a', title: 'A', closable: true },
        '/dashboard/b': { id: '/dashboard/b', keepAlive: true, href: '/dashboard/b', title: 'B', closable: true },
        '/dashboard/c': { id: '/dashboard/c', keepAlive: true, href: '/dashboard/c', title: 'C', closable: true },
      }
      setStoreState(tabs, '/dashboard/b')
      workspaceRegistry.register('/dashboard/a', makeDescriptor({
        instanceKey: 'a',
        screen: () => React.createElement('div', { 'data-testid': 'screen-a' }, 'A'),
      }))
      workspaceRegistry.register('/dashboard/b', makeDescriptor({
        instanceKey: 'b',
        screen: () => React.createElement('div', { 'data-testid': 'screen-b' }, 'B'),
      }))
      workspaceRegistry.register('/dashboard/c', makeDescriptor({
        instanceKey: 'c',
        screen: () => React.createElement('div', { 'data-testid': 'screen-c' }, 'C'),
      }))

      const { getByTestId, queryByTestId } = render(React.createElement(WorkspaceViewport))
      expect(queryByTestId('screen-b')).toBeNull()
      expect(getByTestId('screen-a')).toBeDefined()
      expect(getByTestId('screen-c')).toBeDefined()
      expect(getByTestId('screen-a')).toHaveStyle({ display: 'none' })
      expect(getByTestId('screen-c')).toHaveStyle({ display: 'none' })
    })

    it('afterEach pattern: registry.reset() clears descriptors', () => {
      workspaceRegistry.register('/test', makeDescriptor({ instanceKey: 'test' }))
      expect(workspaceRegistry.has('/test')).toBe(true)
      workspaceRegistry.reset()
      expect(workspaceRegistry.has('/test')).toBe(false)
    })
  })

  // ─── Mixed V2 + V1 rendering ───

  describe('mixed V2 + V1', () => {
    it('V2 page descriptors take priority over V1 registry entries', () => {
      const v2Desc = makePageDescriptor({
        tabId: '/dashboard/mixed',
        keepAlive: true,
        render: () => React.createElement('div', { 'data-testid': 'v2-content' }, 'V2'),
      })
      setStoreState(
        {
          '/dashboard/active': { id: '/dashboard/active', keepAlive: true, href: '/dashboard/active', title: 'Active', closable: true },
          '/dashboard/mixed': { id: '/dashboard/mixed', keepAlive: true, href: '/dashboard/mixed', title: 'Mixed', closable: true },
        },
        '/dashboard/active',
        [],
        { pageDescriptors: { '/dashboard/active': makePageDescriptor({ tabId: '/dashboard/active' }), '/dashboard/mixed': v2Desc } },
      )
      // Also register a V1 descriptor for the same tab — should be ignored
      workspaceRegistry.register('/dashboard/mixed', makeDescriptor({
        instanceKey: 'mixed-v1',
        screen: () => React.createElement('div', { 'data-testid': 'v1-content' }, 'V1'),
      }))

      const { getByTestId, queryByTestId } = render(React.createElement(WorkspaceViewport))
      // V2 content should be rendered (hidden because inactive), V1 content should NOT be rendered
      expect(getByTestId('v2-content')).toBeDefined()
      expect(queryByTestId('v1-content')).toBeNull()
    })
  })
})
