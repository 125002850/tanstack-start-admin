import * as React from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isWorkspaceTabsEnabled } from '@/config/workspace-tabs'
import { useWorkspaceTagStore } from '../utils/store'
import { WorkspacePageBoundary } from './workspace-page-boundary'

const mockUseRouterState = vi.fn()
const mockUseRouter = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => mockUseRouter(),
  useRouterState: (options: { select: (state: unknown) => unknown }) =>
    mockUseRouterState(options),
}))

vi.mock('@/config/workspace-tabs', () => ({
  isWorkspaceTabsEnabled: vi.fn(),
}))

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

describe('WorkspacePageBoundary', () => {
  let pathname = '/dashboard/users'
  let matches: unknown[] = [
    { options: { staticData: { label: '用户' } } },
  ]

  beforeEach(() => {
    pathname = '/dashboard/users'
    matches = [{ options: { staticData: { label: '用户' } } }]
    resetStore()
    cleanup()

    mockUseRouterState.mockImplementation(
      ({ select }: { select: (state: unknown) => unknown }) =>
        select({ location: { pathname }, matches }),
    )
    mockUseRouter.mockReturnValue({
      routesByPath: {
        [pathname]: { options: { staticData: { label: '用户' } } },
      },
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('defaults tabId to pathname and initialTitle to the leaf route label', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(true)

    const { container } = render(
      <WorkspacePageBoundary render={() => <div>Users</div>} />,
    )

    expect(container.innerHTML).toBe('')
    expect(useWorkspaceTagStore.getState().pageDescriptors['/dashboard/users']).toMatchObject({
      tabId: '/dashboard/users',
      initialTitle: '用户',
    })
  })

  it('keeps explicit tabId and initialTitle overrides', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(true)
    pathname = '/dashboard/product/new'
    matches = [{ options: { staticData: { label: '新增产品' } } }]
    mockUseRouter.mockReturnValue({
      routesByPath: {
        '/dashboard/product/new': { options: { staticData: { label: '新增产品' } } },
      },
    })

    render(
      <WorkspacePageBoundary
        tabId='/dashboard/product/new'
        initialTitle='新增产品'
        keepAlive={false}
        render={() => <div>Product</div>}
      />,
    )

    expect(
      useWorkspaceTagStore.getState().pageDescriptors['/dashboard/product/new'],
    ).toMatchObject({
      tabId: '/dashboard/product/new',
      initialTitle: '新增产品',
      keepAlive: false,
    })
  })

  it('does not re-register a closed explicit tab after pathname changes away', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(true)
    mockUseRouter.mockReturnValue({
      routesByPath: {
        '/dashboard/users': { options: { staticData: { label: '用户' } } },
        '/dashboard/overview': { options: { staticData: { label: '仪表盘' } } },
      },
    })

    const { rerender } = render(
      <WorkspacePageBoundary
        tabId='/dashboard/users'
        render={() => <div>Users</div>}
      />,
    )

    expect(useWorkspaceTagStore.getState().pageDescriptors['/dashboard/users']).toMatchObject({
      tabId: '/dashboard/users',
      initialTitle: '用户',
    })

    useWorkspaceTagStore.getState().close('/dashboard/users')

    pathname = '/dashboard/overview'
    matches = [{ options: { staticData: { label: '仪表盘' } } }]

    rerender(
      <WorkspacePageBoundary
        tabId='/dashboard/users'
        render={() => <div>Users</div>}
      />,
    )

    expect(useWorkspaceTagStore.getState().pageDescriptors['/dashboard/users']).toBeUndefined()
    expect(useWorkspaceTagStore.getState().tabs['/dashboard/users']).toBeUndefined()
  })

  it('normalizes the implicit tabId when pathname has a trailing slash', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(true)
    pathname = '/dashboard/product/'
    matches = [{ options: { staticData: { label: '产品' } } }]
    mockUseRouter.mockReturnValue({
      routesByPath: {
        '/dashboard/product/': { options: { staticData: { label: '产品' } } },
      },
    })

    render(
      <WorkspacePageBoundary render={() => <div>Products</div>} />,
    )

    expect(useWorkspaceTagStore.getState().pageDescriptors['/dashboard/product']).toMatchObject({
      tabId: '/dashboard/product',
      initialTitle: '产品',
    })
    expect(useWorkspaceTagStore.getState().pageDescriptors['/dashboard/product/']).toBeUndefined()
  })

  it('renders content directly when workspace tabs are disabled', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(false)

    const { getByText } = render(
      <WorkspacePageBoundary render={() => <div>Inline Content</div>} />,
    )

    expect(getByText('Inline Content')).toBeTruthy()
    expect(useWorkspaceTagStore.getState().pageDescriptors).toEqual({})
  })

  it('prefers renderWhenDisabled when workspace tabs are disabled', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(false)

    const { getByText, queryByText } = render(
      <WorkspacePageBoundary
        render={() => <div>Workspace Content</div>}
        renderWhenDisabled={() => <div>Inline Disabled Content</div>}
      />,
    )

    expect(getByText('Inline Disabled Content')).toBeTruthy()
    expect(queryByText('Workspace Content')).toBeNull()
    expect(useWorkspaceTagStore.getState().pageDescriptors).toEqual({})
  })
})
