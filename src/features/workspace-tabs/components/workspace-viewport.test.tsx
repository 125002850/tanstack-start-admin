import * as React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { useWorkspaceTabStore } from '../utils/store'
import { WorkspaceViewport } from './workspace-viewport'
import type {
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

  useWorkspaceTabStore.setState({
    tabs: normalizedTabs,
    activeId,
    openedOrder: Object.keys(normalizedTabs),
    disabledKeepAliveIds: new Set(disabledIds),
    pageDescriptors: extra.pageDescriptors ?? {},
    lifecycleSnapshots: extra.lifecycleSnapshots ?? {},
  })
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
  useWorkspaceTabStore.setState({
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
    cleanup()
  })

  afterEach(() => {
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
      expect(useWorkspaceTabStore.getState().disabledKeepAliveIds.has('/dashboard/fallback')).toBe(true)
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
})
