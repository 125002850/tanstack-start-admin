import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import TagsBar from './tags-bar'
import { useWorkspaceTagStore } from '@/features/workspace-tabs/utils/store'

// Mock Radix ScrollArea — avoids React instance conflicts in jsdom
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children: ReactNode
    className?: string
  }) => (
    <div data-testid='scroll-area' className={className}>
      {children}
    </div>
  ),
  ScrollBar: () => null,
}))

// Mock Radix ContextMenu — avoids React instance conflicts in jsdom
vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuContent: () => null,
  ContextMenuItem: () => null,
  ContextMenuSeparator: () => null,
}))

// Mock the router-dependent hook
vi.mock('@/features/workspace-tabs/hooks/use-workspace-tags', () => ({
  useWorkspaceTags: () => {
    const store = useWorkspaceTagStore()
    return {
      tabs: store.tabs,
      activeId: store.activeId,
      openedOrder: store.openedOrder,
      lifecycleSnapshots: store.lifecycleSnapshots ?? {},
      openOrActivate: store.openOrActivate,
      close: (id: string) => {
        const tab = store.tabs[id]
        if (!tab || tab.href === '/dashboard/overview') return
        store.close(id)
      },
      closeOther: store.closeOther,
      closeAll: store.closeAll,
      refresh: (_id: string) => {},
      touch: store.touch,
      evictInactive: store.evictInactive,
    }
  },
}))

// Mock icons
vi.mock('@/components/icons', () => ({
  Icons: {
    close: () => <span data-testid='icon-close' />,
  },
}))

// Mock router
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ navigate: vi.fn() }),
  useRouterState: () => ({}),
}))

afterEach(cleanup)

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

describe('TagsBar', () => {
  beforeEach(() => {
    resetStore()
    cleanup()
  })

  it('renders tabs in openedOrder', () => {
    const store = useWorkspaceTagStore.getState()
    store.openOrActivate({
      id: '/dashboard/overview',
      href: '/dashboard/overview',
      title: '仪表盘',
      closable: false,
      keepAlive: false,
    })
    store.openOrActivate({
      id: '/dashboard/chat',
      href: '/dashboard/chat',
      title: 'Chat',
      closable: true,
      keepAlive: false,
    })
    render(<TagsBar />)
    expect(screen.getByRole('tab', { name: /仪表盘/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Chat/ })).toBeInTheDocument()
  })

  it('marks active tab with aria-selected', () => {
    const store = useWorkspaceTagStore.getState()
    store.openOrActivate({
      id: '/dashboard/overview',
      href: '/dashboard/overview',
      title: '仪表盘',
      closable: false,
      keepAlive: false,
    })
    render(<TagsBar />)
    const tab = screen.getByRole('tab', { name: /仪表盘/ })
    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(tab).toHaveClass('bg-card', 'text-card-foreground')
  })

  it('hides the horizontal scrollbar on tags bar', () => {
    const store = useWorkspaceTagStore.getState()
    store.openOrActivate({
      id: '/dashboard/overview',
      href: '/dashboard/overview',
      title: '仪表盘',
      closable: false,
      keepAlive: false,
    })
    render(<TagsBar />)
    expect(screen.getByTestId('scroll-area')).toHaveClass(
      '[&>[data-slot=scroll-area-scrollbar][data-orientation=horizontal]]:hidden',
    )
  })

  it('home tab has no close button', () => {
    const store = useWorkspaceTagStore.getState()
    store.openOrActivate({
      id: '/dashboard/overview',
      href: '/dashboard/overview',
      title: '仪表盘',
      closable: false,
      keepAlive: false,
    })
    render(<TagsBar />)
    expect(screen.queryByRole('button', { name: /Close 仪表盘/ })).not.toBeInTheDocument()
  })

  it('closable tab shows close button', () => {
    const store = useWorkspaceTagStore.getState()
    store.openOrActivate({
      id: '/dashboard/chat',
      href: '/dashboard/chat',
      title: 'Chat',
      closable: true,
      keepAlive: false,
    })
    render(<TagsBar />)
    expect(screen.getByRole('button', { name: /Close Chat/ })).toBeInTheDocument()
  })

  it('ArrowLeft and ArrowRight move focus', async () => {
    const store = useWorkspaceTagStore.getState()
    store.openOrActivate({
      id: '/dashboard/overview',
      href: '/dashboard/overview',
      title: '仪表盘',
      closable: false,
      keepAlive: false,
    })
    store.openOrActivate({
      id: '/dashboard/chat',
      href: '/dashboard/chat',
      title: 'Chat',
      closable: true,
      keepAlive: false,
    })
    render(<TagsBar />)
    const tabs = screen.getAllByRole('tab')
    tabs[0]?.focus()
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(tabs[1])
    fireEvent.keyDown(tabs[1]!, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(tabs[0])
  })

  it('Enter activates the focused tab', async () => {
    const store = useWorkspaceTagStore.getState()
    store.openOrActivate({
      id: '/dashboard/overview',
      href: '/dashboard/overview',
      title: '仪表盘',
      closable: false,
      keepAlive: false,
    })
    store.openOrActivate({
      id: '/dashboard/chat',
      href: '/dashboard/chat',
      title: 'Chat',
      closable: true,
      keepAlive: false,
    })
    render(<TagsBar />)
    const tabs = screen.getAllByRole('tab')
    const overview = tabs[0]!
    overview.focus()
    fireEvent.keyDown(overview, { key: 'Enter' })
    expect(useWorkspaceTagStore.getState().activeId).toBe('/dashboard/overview')
  })

  it('Delete triggers close for closable tabs', () => {
    const store = useWorkspaceTagStore.getState()
    store.openOrActivate({
      id: '/dashboard/overview',
      href: '/dashboard/overview',
      title: '仪表盘',
      closable: false,
      keepAlive: false,
    })
    store.openOrActivate({
      id: '/dashboard/chat',
      href: '/dashboard/chat',
      title: 'Chat',
      closable: true,
      keepAlive: false,
    })
    render(<TagsBar />)
    const tabs = screen.getAllByRole('tab')
    tabs[1]?.focus()
    fireEvent.keyDown(tabs[1]!, { key: 'Delete' })
    expect(useWorkspaceTagStore.getState().tabs['/dashboard/chat']).toBeUndefined()
  })

  it('Delete does not close home tab', () => {
    const store = useWorkspaceTagStore.getState()
    store.openOrActivate({
      id: '/dashboard/overview',
      href: '/dashboard/overview',
      title: '仪表盘',
      closable: false,
      keepAlive: false,
    })
    render(<TagsBar />)
    const tab = screen.getByRole('tab', { name: /仪表盘/ })
    tab.focus()
    fireEvent.keyDown(tab, { key: 'Delete' })
    expect(useWorkspaceTagStore.getState().tabs['/dashboard/overview']).toBeDefined()
  })

  it('shows dirty indicator when lifecycle marks tab as dirty', () => {
    const store = useWorkspaceTagStore.getState()
    store.openOrActivate({
      id: '/dashboard/chat',
      href: '/dashboard/chat',
      title: 'Chat',
      closable: true,
      keepAlive: false,
    })
    // Set dirty in lifecycle
    useWorkspaceTagStore.setState({
      lifecycleSnapshots: {
        '/dashboard/chat': { title: 'Chat', dirty: true },
      },
    })
    render(<TagsBar />)
    expect(screen.getByRole('tab', { name: /Chat/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/Chat has unsaved changes/)).toBeInTheDocument()
  })
})
