import * as React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { useWorkspaceTabStore } from '../utils/store'
import { useDashboardRouteTagSync } from '../hooks/use-dashboard-route-tag-sync'
import { useWorkspaceTags } from '../hooks/use-workspace-tags'
import { WorkspacePageBoundary } from './workspace-page-boundary'
import { WorkspaceViewport } from './workspace-viewport'
import { isWorkspaceTabsEnabled } from '@/config/workspace-tabs'

// ---- Mutable router state controlled by each test case ----
let mockPathname = '/dashboard/overview'
let mockSearch = ''
const mockNavigate = vi.fn()

const mockRoutesByPath: Record<string, unknown> = {
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
  '/dashboard/products': {
    options: {
      staticData: { label: '产品管理', title: '产品管理', workspace: { tagEnabled: true, keepAlive: true } },
    },
  },
  '/dashboard/product': {
    options: {
      staticData: { label: '产品', title: '产品', workspace: { tagEnabled: true, keepAlive: true } },
    },
  },
  '/dashboard/users': {
    options: {
      staticData: { label: '用户管理', title: '用户管理', workspace: { tagEnabled: true, keepAlive: true } },
    },
  },
  '/dashboard/chat': {
    options: {
      staticData: { label: '聊天', title: '聊天', workspace: { tagEnabled: true, keepAlive: true } },
    },
  },
  '/dashboard/settings': {
    options: {
      staticData: { label: '设置', title: '设置', workspace: { tagEnabled: true, keepAlive: false } },
    },
  },
}

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ routesByPath: mockRoutesByPath, navigate: mockNavigate }),
  useRouterState: ({
    select,
  }: {
    select?: (state: {
      location: { pathname: string; search: string }
      matches: unknown[]
    }) => unknown
  }) => {
    const leafMatch = mockRoutesByPath[mockPathname] ?? {}
    const state = {
      location: { pathname: mockPathname, search: mockSearch },
      matches: [leafMatch],
    }
    return select ? select(state) : state
  },
  useMatches: ({
    select,
  }: {
    select?: (matches: unknown[]) => unknown
  }) => {
    const leafMatch = mockRoutesByPath[mockPathname] ?? {}
    const matches = [leafMatch]
    return select ? select(matches) : matches
  },
  useParams: () => ({}),
  useSearch: () => ({}),
}))

// Mock isWorkspaceTabsEnabled — defaults to true, overridable per test
vi.mock('@/config/workspace-tabs', () => ({
  isWorkspaceTabsEnabled: vi.fn(() => true),
  MAX_KEEPALIVE_TABS: 15,
}))

// ---- V2 Harness (new WorkspacePageBoundary behavior) ----
function V2RoutingHarness({
  pathname,
  title,
  keepAlive,
  testId,
  passTabId = true,
}: {
  pathname: string
  title: string
  keepAlive: boolean
  testId: string
  passTabId?: boolean
}) {
  mockPathname = pathname
  mockSearch = ''

  useDashboardRouteTagSync(isWorkspaceTabsEnabled())

  return React.createElement(WorkspacePageBoundary, {
    ...(passTabId ? { tabId: pathname } : {}),
    initialTitle: title,
    keepAlive,
    closable: pathname !== '/dashboard/overview',
    render: () => React.createElement('div', { 'data-testid': testId }, title),
    errorFallback: React.createElement('div', { 'data-testid': `fallback-${testId}` }, 'Error'),
  })
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

describe('Workspace Routing Integration', () => {
  beforeEach(() => {
    resetStore()
    mockPathname = '/dashboard/overview'
    mockSearch = ''
    mockNavigate.mockClear()
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(true)
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  // ─── V2 host ownership ───

  describe('V2 host ownership', () => {
    it('WorkspacePageBoundary returns null when flag-on', () => {
      mockPathname = '/dashboard/users'

      const { container } = render(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/users',
          title: 'Users',
          keepAlive: true,
          testId: 'v2-users',
        }),
      )

      // Boundary returns null — no DOM output from the route
      expect(container.innerHTML).toBe('')
    })

    it('WorkspacePageBoundary registers page descriptor in store', () => {
      mockPathname = '/dashboard/users'

      render(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/users',
          title: 'Users',
          keepAlive: true,
          testId: 'v2-users',
        }),
      )

      const state = useWorkspaceTabStore.getState()
      expect(state.pageDescriptors['/dashboard/users']).toBeDefined()
      expect(state.tabs['/dashboard/users']).toBeDefined()
      expect(state.activeId).toBe('/dashboard/users')
    })

    it('WorkspacePageBoundary defaults tabId to pathname when omitted', () => {
      mockPathname = '/dashboard/users'

      render(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/users',
          title: 'Users',
          keepAlive: true,
          testId: 'v2-users',
          passTabId: false,
        }),
      )

      const state = useWorkspaceTabStore.getState()
      expect(state.pageDescriptors['/dashboard/users']).toBeDefined()
      expect(state.pageDescriptors['/dashboard/users']?.tabId).toBe('/dashboard/users')
      expect(state.tabs['/dashboard/users']).toBeDefined()
    })

    it('Viewport renders active V2 page visibly and inactive V2 page hidden', () => {
      mockPathname = '/dashboard/products'

      // Register two V2 pages (products active, users inactive keep-alive)
      const { rerender } = render(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/products',
          title: 'Products',
          keepAlive: true,
          testId: 'v2-products',
        }),
      )

      // Navigate to users, making products inactive
      mockPathname = '/dashboard/users'
      rerender(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/users',
          title: 'Users',
          keepAlive: true,
          testId: 'v2-users',
        }),
      )

      // Now render the viewport — it should show users (active) and products (inactive hidden)
      // But viewport reads from store, not from route props, so render separately
      cleanup()

      const { getByTestId } = render(React.createElement(WorkspaceViewport))

      // Users is active → visible
      const usersEl = getByTestId('v2-users')
      expect(usersEl).toBeDefined()
      expect(usersEl.style.display).not.toBe('none')

      // Products is inactive keep-alive → hidden
      const productsEl = getByTestId('v2-products')
      expect(productsEl).toBeDefined()
      expect(productsEl).toHaveStyle({ display: 'none' })
    })

    it('route unmount does NOT cleanup page descriptor', () => {
      mockPathname = '/dashboard/users'

      const { unmount } = render(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/users',
          title: 'Users',
          keepAlive: true,
          testId: 'v2-users',
        }),
      )

      // Descriptor is registered
      expect(useWorkspaceTabStore.getState().pageDescriptors['/dashboard/users']).toBeDefined()

      // Unmount the boundary (simulating route navigation away)
      unmount()

      // Descriptor should STILL be registered (shell store owns it now)
      expect(useWorkspaceTabStore.getState().pageDescriptors['/dashboard/users']).toBeDefined()
    })

    it('tab close cleans up descriptor and lifecycle', () => {
      const store = useWorkspaceTabStore.getState()
      store.registerPageDescriptor('/dashboard/users', {
        tabId: '/dashboard/users',
        initialTitle: 'Users',
        keepAlive: true,
        closable: true,
        render: () => null,
      })
      store.updateLifecycle('/dashboard/users', { dirty: true })

      store.close('/dashboard/users')

      expect(store.pageDescriptors['/dashboard/users']).toBeUndefined()
      expect(store.lifecycleSnapshots['/dashboard/users']).toBeUndefined()
    })

    it('shell resetAll cleans up all descriptors', () => {
      const store = useWorkspaceTabStore.getState()
      store.registerPageDescriptor('/dashboard/users', {
        tabId: '/dashboard/users', initialTitle: 'Users', keepAlive: true, closable: true, render: () => null,
      })
      store.registerPageDescriptor('/dashboard/products', {
        tabId: '/dashboard/products', initialTitle: 'Products', keepAlive: true, closable: true, render: () => null,
      })

      store.resetAll()

      expect(Object.keys(store.pageDescriptors)).toHaveLength(0)
      expect(Object.keys(store.lifecycleSnapshots)).toHaveLength(0)
    })
  })

  // ─── V2 lifecycle (title, dirty, closeGuard) ───

  describe('V2 lifecycle', () => {
    function getState() {
      return useWorkspaceTabStore.getState()
    }

    it('title can be updated via updateLifecycle', () => {
      getState().registerPageDescriptor('/dashboard/users', {
        tabId: '/dashboard/users',
        initialTitle: 'Users',
        keepAlive: true,
        closable: true,
        render: () => null,
      })

      getState().updateLifecycle('/dashboard/users', { title: 'Users (99)' })
      expect(getState().lifecycleSnapshots['/dashboard/users']?.title).toBe('Users (99)')
      expect(getState().tabs['/dashboard/users']?.title).toBe('Users (99)')
    })

    it('dirty flag can be toggled', () => {
      getState().registerPageDescriptor('/dashboard/users', {
        tabId: '/dashboard/users', initialTitle: 'Users', keepAlive: true, closable: true, render: () => null,
      })

      getState().updateLifecycle('/dashboard/users', { dirty: true })
      expect(getState().lifecycleSnapshots['/dashboard/users']?.dirty).toBe(true)

      getState().updateLifecycle('/dashboard/users', { dirty: false })
      expect(getState().lifecycleSnapshots['/dashboard/users']?.dirty).toBe(false)
    })

    it('closeGuard can be set and is preserved in lifecycle snapshot', () => {
      const guard = vi.fn(() => true)
      getState().registerPageDescriptor('/dashboard/users', {
        tabId: '/dashboard/users', initialTitle: 'Users', keepAlive: true, closable: true, render: () => null,
      })

      getState().updateLifecycle('/dashboard/users', { closeGuard: guard })
      expect(getState().lifecycleSnapshots['/dashboard/users']?.closeGuard).toBe(guard)
    })
  })

  // ─── V2 keepAlive=false owner model ───

  describe('V2 keepAlive=false', () => {
    function getState() {
      return useWorkspaceTabStore.getState()
    }

    it('non-keep-alive page descriptor is still owned by ActivityHost', () => {
      getState().registerPageDescriptor('/dashboard/settings', {
        tabId: '/dashboard/settings',
        initialTitle: 'Settings',
        keepAlive: false,
        closable: true,
        render: () => null,
      })

      expect(getState().pageDescriptors['/dashboard/settings']).toBeDefined()
    })

    it('inactive non-keep-alive page is NOT rendered by viewport', () => {
      // Register products first (will be active), then settings (makes settings active, products inactive)
      // We want products(keepAlive=true) active + settings(keepAlive=false) inactive
      // So: register products, then explicitly set activeId back to products
      getState().registerPageDescriptor('/dashboard/products', {
        tabId: '/dashboard/products', initialTitle: 'Products', keepAlive: true, closable: true,
        render: () => React.createElement('div', { 'data-testid': 'v2-products' }, 'Products'),
      })
      getState().registerPageDescriptor('/dashboard/settings', {
        tabId: '/dashboard/settings', initialTitle: 'Settings', keepAlive: false, closable: true,
        render: () => React.createElement('div', { 'data-testid': 'v2-settings' }, 'Settings'),
      })

      // Set products as active so settings is inactive (and non-keep-alive → should not render)
      useWorkspaceTabStore.setState({ activeId: '/dashboard/products' })

      const { queryByTestId, getByTestId } = render(React.createElement(WorkspaceViewport))
      // Products is active → visible
      expect(getByTestId('v2-products')).toBeDefined()
      // Settings is inactive non-keep-alive → NOT rendered
      expect(queryByTestId('v2-settings')).toBeNull()
    })
  })

  // ─── V2 first render no-blank-viewport ───

  describe('V2 first render no blank viewport', () => {
    it('viewport renders active page content in the same render cycle as registration', () => {
      // Simulate a full render where boundary registers during the same render cycle
      mockPathname = '/dashboard/users'

      // Render boundary + viewport together (simulating real app layout)
      const { getByTestId } = render(
        React.createElement('div', null, [
          React.createElement(V2RoutingHarness, {
            key: 'route',
            pathname: '/dashboard/users',
            title: 'Users',
            keepAlive: true,
            testId: 'v2-users',
          }),
          React.createElement(WorkspaceViewport, { key: 'viewport' }),
        ]),
      )

      // The viewport should have rendered the active page content
      const usersEl = getByTestId('v2-users')
      expect(usersEl).toBeDefined()
      // Active content should be visible (not hidden)
      expect(usersEl.style.display).not.toBe('none')
    })

    it('viewport renders non-null content for first-opened tag', () => {
      const store = useWorkspaceTabStore.getState()
      // Pre-register a descriptor (simulating first tag open)
      store.registerPageDescriptor('/dashboard/products', {
        tabId: '/dashboard/products',
        initialTitle: 'Products',
        keepAlive: true,
        closable: true,
        render: () => React.createElement('div', { 'data-testid': 'first-tag' }, 'First Tag Content'),
      })

      const { getByTestId, container } = render(React.createElement(WorkspaceViewport))
      expect(getByTestId('first-tag')).toBeDefined()
      // Viewport should not be empty
      expect(container.innerHTML).not.toBe('')
    })
  })

  // ─── V2 descriptor missing / error fallback ───

  describe('V2 descriptor missing / error fallback', () => {
    it('ActivityHost handles descriptor missing gracefully', () => {
      // Tab exists in store but no page descriptor — viewport returns null
      useWorkspaceTabStore.setState({
        tabs: { '/dashboard/orphan': { id: '/dashboard/orphan', keepAlive: true, href: '/dashboard/orphan', title: 'Orphan', closable: true, lastVisitedAt: Date.now() } },
        activeId: '/dashboard/orphan',
        openedOrder: ['/dashboard/orphan'],
      })

      const { container } = render(React.createElement(WorkspaceViewport))
      // No descriptor → no entries → null (but not a crash)
      expect(container.innerHTML).toBe('')
    })
  })

  // ─── V2 flag-off: zero side effect ───

  describe('V2 flag-off — WorkspacePageBoundary direct render', () => {
    function getState() {
      return useWorkspaceTabStore.getState()
    }

    it('renders page directly when feature flag is off', () => {
      vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(false)

      mockPathname = '/dashboard/users'
      const { getByTestId } = render(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/users',
          title: 'Users',
          keepAlive: true,
          testId: 'v2-users',
        }),
      )

      // Flag-off: boundary renders content directly, not null
      expect(getByTestId('v2-users')).toBeDefined()
      expect(getByTestId('v2-users').textContent).toBe('Users')
    })

    it('does NOT register page descriptor when flag-off', () => {
      vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(false)

      mockPathname = '/dashboard/users'
      render(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/users',
          title: 'Users',
          keepAlive: true,
          testId: 'v2-users',
        }),
      )

      // No descriptor registered, no tab created
      expect(getState().pageDescriptors['/dashboard/users']).toBeUndefined()
      expect(getState().tabs['/dashboard/users']).toBeUndefined()
    })

    it('does NOT write to workspace store at all when flag-off', () => {
      vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(false)

      mockPathname = '/dashboard/users'
      render(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/users',
          title: 'Users',
          keepAlive: true,
          testId: 'v2-users',
        }),
      )

      // Store should be completely untouched
      const state = getState()
      expect(Object.keys(state.pageDescriptors)).toHaveLength(0)
      expect(Object.keys(state.tabs)).toHaveLength(0)
      expect(Object.keys(state.lifecycleSnapshots)).toHaveLength(0)
      expect(state.activeId).toBeNull()
    })

    it('flag-off boundary returns non-null content (opposite of flag-on null)', () => {
      vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(false)

      mockPathname = '/dashboard/products'
      const { container } = render(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/products',
          title: 'Products',
          keepAlive: true,
          testId: 'v2-products',
        }),
      )

      // Flag-off: container has real content, not empty like flag-on
      expect(container.innerHTML).not.toBe('')
    })
  })

  // ─── V2 route instance tags ───

  describe('V2 route instance tags', () => {
    function getState() {
      return useWorkspaceTabStore.getState()
    }

    it('creates separate tags for different detail page instances', () => {
      // Simulate navigating to product/123, then product/456
      getState().registerPageDescriptor('/dashboard/product/123', {
        tabId: '/dashboard/product/123',
        initialTitle: '产品 #123',
        keepAlive: true,
        closable: true,
        render: () => null,
      })
      getState().registerPageDescriptor('/dashboard/product/456', {
        tabId: '/dashboard/product/456',
        initialTitle: '产品 #456',
        keepAlive: true,
        closable: true,
        render: () => null,
      })

      const state = getState()
      expect(state.tabs['/dashboard/product/123']).toBeDefined()
      expect(state.tabs['/dashboard/product/456']).toBeDefined()
      expect(state.tabs['/dashboard/product/123']?.id).not.toBe(
        state.tabs['/dashboard/product/456']?.id,
      )
    })

    it('route instances appear in opened order', () => {
      getState().registerPageDescriptor('/dashboard/product/123', {
        tabId: '/dashboard/product/123', initialTitle: '123', keepAlive: true, closable: true, render: () => null,
      })
      getState().registerPageDescriptor('/dashboard/product/456', {
        tabId: '/dashboard/product/456', initialTitle: '456', keepAlive: true, closable: true, render: () => null,
      })

      const order = getState().openedOrder
      expect(order).toContain('/dashboard/product/123')
      expect(order).toContain('/dashboard/product/456')
    })

    it('"new" route instance creates its own tag separate from list', () => {
      getState().registerPageDescriptor('/dashboard/product', {
        tabId: '/dashboard/product', initialTitle: '产品', keepAlive: true, closable: true, render: () => null,
      })
      getState().registerPageDescriptor('/dashboard/product/new', {
        tabId: '/dashboard/product/new', initialTitle: '新增产品', keepAlive: true, closable: true, render: () => null,
      })

      const state = getState()
      expect(state.tabs['/dashboard/product']).toBeDefined()
      expect(state.tabs['/dashboard/product/new']).toBeDefined()
      // They are different tabs
      expect(state.tabs['/dashboard/product']?.id).toBe('/dashboard/product')
      expect(state.tabs['/dashboard/product/new']?.id).toBe('/dashboard/product/new')
    })
  })

  // ─── V2 closeGuard integration ───

  describe('V2 closeGuard integration', () => {
    function getState() {
      return useWorkspaceTabStore.getState()
    }

    function setupTab(id: string, title: string, opts?: { closable?: boolean; keepAlive?: boolean }) {
      getState().registerPageDescriptor(id, {
        tabId: id,
        initialTitle: title,
        keepAlive: opts?.keepAlive ?? true,
        closable: opts?.closable ?? true,
        render: () => null,
      })
    }

    // Test component that exposes useWorkspaceTags methods
    function CloseGuardTester({ actionsRef }: { actionsRef: React.MutableRefObject<ReturnType<typeof useWorkspaceTags> | null> }) {
      const tags = useWorkspaceTags()
      React.useEffect(() => {
        actionsRef.current = tags
      })
      return null
    }

    it('close-current with guard returning false does not close the tab', async () => {
      setupTab('/dashboard/users', 'Users')
      const guard = vi.fn(() => false)
      getState().updateLifecycle('/dashboard/users', { closeGuard: guard, dirty: true })

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>()
      render(React.createElement(CloseGuardTester, { actionsRef }))

      await act(() => actionsRef.current!.close('/dashboard/users'))

      // Tab still exists — guard returned false
      expect(getState().tabs['/dashboard/users']).toBeDefined()
      expect(guard).toHaveBeenCalledWith({ tabId: '/dashboard/users', reason: 'close-current' })
    })

    it('close-current with guard returning true allows close', async () => {
      setupTab('/dashboard/users', 'Users')
      const guard = vi.fn(() => true)
      getState().updateLifecycle('/dashboard/users', { closeGuard: guard })

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>()
      render(React.createElement(CloseGuardTester, { actionsRef }))

      await act(() => actionsRef.current!.close('/dashboard/users'))

      expect(getState().tabs['/dashboard/users']).toBeUndefined()
    })

    it('closeOther aborts batch on first guard rejection', async () => {
      setupTab('/dashboard/products', 'Products')
      setupTab('/dashboard/users', 'Users')
      setupTab('/dashboard/settings', 'Settings')

      // Products lets close go through, Users rejects
      getState().updateLifecycle('/dashboard/products', { closeGuard: () => true })
      getState().updateLifecycle('/dashboard/users', { closeGuard: () => false, dirty: true })
      getState().updateLifecycle('/dashboard/settings', { closeGuard: () => true })

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>()
      render(React.createElement(CloseGuardTester, { actionsRef }))

      // closeOther keeping settings
      await act(() => actionsRef.current!.closeOther('/dashboard/settings'))

      // Settings and Products should still exist (Users rejected, batch aborted)
      expect(getState().tabs['/dashboard/settings']).toBeDefined()
      expect(getState().tabs['/dashboard/products']).toBeDefined()
      expect(getState().tabs['/dashboard/users']).toBeDefined()
    })

    it('closeOther aborts and navigates to rejecting tab', async () => {
      setupTab('/dashboard/products', 'Products')
      setupTab('/dashboard/users', 'Users')

      getState().updateLifecycle('/dashboard/products', { closeGuard: () => false, dirty: true })

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>()
      render(React.createElement(CloseGuardTester, { actionsRef }))

      mockNavigate.mockClear()
      await act(() => actionsRef.current!.closeOther('/dashboard/users'))

      // Navigated to the rejecting tab
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard/products' })
      // Users still exists
      expect(getState().tabs['/dashboard/users']).toBeDefined()
    })

    it('closeAll aborts on guard rejection and focuses rejecting tab', async () => {
      setupTab('/dashboard/products', 'Products')
      setupTab('/dashboard/users', 'Users')

      getState().updateLifecycle('/dashboard/products', { closeGuard: () => true })
      getState().updateLifecycle('/dashboard/users', { closeGuard: () => false, dirty: true })

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>()
      render(React.createElement(CloseGuardTester, { actionsRef }))

      mockNavigate.mockClear()
      await act(() => actionsRef.current!.closeAll())

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard/users' })
      // Products still exists (batch aborted before processing it)
      expect(getState().tabs['/dashboard/products']).toBeDefined()
    })

    it('guard that throws is treated as rejection', async () => {
      setupTab('/dashboard/users', 'Users')
      getState().updateLifecycle('/dashboard/users', {
        closeGuard: () => { throw new Error('nope') },
        dirty: true,
      })

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>()
      render(React.createElement(CloseGuardTester, { actionsRef }))

      await act(() => actionsRef.current!.close('/dashboard/users'))

      expect(getState().tabs['/dashboard/users']).toBeDefined()
    })

    it('guard that returns rejected promise is treated as rejection', async () => {
      setupTab('/dashboard/users', 'Users')
      getState().updateLifecycle('/dashboard/users', {
        closeGuard: () => Promise.reject(new Error('nope')),
        dirty: true,
      })

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>()
      render(React.createElement(CloseGuardTester, { actionsRef }))

      await act(() => actionsRef.current!.close('/dashboard/users'))

      expect(getState().tabs['/dashboard/users']).toBeDefined()
    })

    it('guard timeout is treated as rejection', async () => {
      vi.useFakeTimers()
      setupTab('/dashboard/users', 'Users')
      getState().updateLifecycle('/dashboard/users', {
        closeGuard: () => new Promise(() => { }), // never resolves
        dirty: true,
      })

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>()
      render(React.createElement(CloseGuardTester, { actionsRef }))

      const closePromise = act(() => actionsRef.current!.close('/dashboard/users'))
      vi.advanceTimersByTime(2000) // past 1500ms timeout
      await closePromise

      expect(getState().tabs['/dashboard/users']).toBeDefined()
      vi.useRealTimers()
    })

    it('no guard set allows immediate close', async () => {
      setupTab('/dashboard/users', 'Users')
      // No closeGuard set

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>()
      render(React.createElement(CloseGuardTester, { actionsRef }))

      await act(() => actionsRef.current!.close('/dashboard/users'))

      expect(getState().tabs['/dashboard/users']).toBeUndefined()
    })

    it('closeOther traverses tabs left-to-right by openedOrder', async () => {
      // Register in specific order to set openedOrder
      setupTab('/dashboard/products', 'Products')
      setupTab('/dashboard/users', 'Users')
      setupTab('/dashboard/settings', 'Settings')

      const callOrder: string[] = []
      getState().updateLifecycle('/dashboard/products', { closeGuard: () => { callOrder.push('products'); return true } })
      getState().updateLifecycle('/dashboard/users', { closeGuard: () => { callOrder.push('users'); return true } })
      getState().updateLifecycle('/dashboard/settings', { closeGuard: () => { callOrder.push('settings'); return true } })

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>()
      render(React.createElement(CloseGuardTester, { actionsRef }))

      // closeOther keeping products (products is first in order, users and settings will be closed)
      await act(() => actionsRef.current!.closeOther('/dashboard/products'))

      expect(callOrder).toEqual(['users', 'settings'])
    })

    it('closeOther excludes home tab from closeGuard traversal', async () => {
      setupTab('/dashboard/overview', '仪表盘', { closable: false, keepAlive: false })
      setupTab('/dashboard/products', 'Products')
      setupTab('/dashboard/users', 'Users')

      const callOrder: string[] = []
      getState().updateLifecycle('/dashboard/overview', {
        closeGuard: () => {
          callOrder.push('home')
          return true
        },
      })
      getState().updateLifecycle('/dashboard/products', {
        closeGuard: () => {
          callOrder.push('products')
          return true
        },
      })
      getState().updateLifecycle('/dashboard/users', {
        closeGuard: () => {
          callOrder.push('users')
          return true
        },
      })

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>()
      render(React.createElement(CloseGuardTester, { actionsRef }))

      await act(() => actionsRef.current!.closeOther('/dashboard/products'))

      expect(callOrder).toEqual(['users'])
      expect(getState().tabs['/dashboard/overview']).toBeDefined()
      expect(getState().tabs['/dashboard/products']).toBeDefined()
    })

    it('closeAll traverses tabs left-to-right including non-home tabs', async () => {
      setupTab('/dashboard/overview', '仪表盘', { closable: false })
      setupTab('/dashboard/products', 'Products')
      setupTab('/dashboard/users', 'Users')

      const callOrder: string[] = []
      getState().updateLifecycle('/dashboard/products', { closeGuard: () => { callOrder.push('products'); return true } })
      getState().updateLifecycle('/dashboard/users', { closeGuard: () => { callOrder.push('users'); return true } })

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>()
      render(React.createElement(CloseGuardTester, { actionsRef }))

      await act(() => actionsRef.current!.closeAll())

      // Home tab (overview) is excluded from close target set, but products+users are closed
      expect(callOrder).toEqual(['products', 'users'])
      expect(getState().tabs['/dashboard/overview']).toBeDefined()
    })

  })
})
