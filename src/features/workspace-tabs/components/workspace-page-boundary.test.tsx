import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isWorkspaceTabsEnabled } from '@/config/workspace-tabs';
import { useWorkspaceTabStore } from '../utils/store';
import { useWorkspacePageRegistryStore } from '../utils/page-registry';
import { WorkspacePageBoundary } from './workspace-page-boundary';
import { WorkspacePageRoute } from './workspace-page-route';

const mockUseRouterState = vi.fn();
const mockUseRouter = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => mockUseRouter(),
  useRouterState: (options: { select: (state: unknown) => unknown }) => mockUseRouterState(options)
}));

vi.mock('@/config/workspace-tabs', () => ({
  isWorkspaceTabsEnabled: vi.fn(),
  MAX_KEEPALIVE_TABS: 15
}));

function resetStore() {
  useWorkspaceTabStore.setState({
    tabs: {},
    activeId: null,
    openedOrder: [],
    disabledKeepAliveIds: new Set(),
    lifecycleSnapshots: {}
  });
  useWorkspacePageRegistryStore.getState().resetDescriptors();
}

function getDescriptors() {
  return useWorkspacePageRegistryStore.getState().descriptors;
}

describe('WorkspacePageBoundary', () => {
  let pathname = '/dashboard/users';
  let matches: unknown[] = [{ options: { staticData: { label: '用户' } } }];

  beforeEach(() => {
    pathname = '/dashboard/users';
    matches = [{ options: { staticData: { label: '用户' } } }];
    resetStore();
    cleanup();

    mockUseRouterState.mockImplementation(({ select }: { select: (state: unknown) => unknown }) =>
      select({ location: { pathname }, matches })
    );
    mockUseRouter.mockReturnValue({
      routesByPath: {
        [pathname]: { options: { staticData: { label: '用户' } } }
      }
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('defaults tabId to pathname and initialTitle to the leaf route label', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(true);

    const { container } = render(<WorkspacePageBoundary render={() => <div>Users</div>} />);

    expect(container.innerHTML).toBe('');
    expect(getDescriptors()['/dashboard/users']).toMatchObject({
      tabId: '/dashboard/users',
      initialTitle: '用户'
    });
  });

  it('keeps explicit tabId and initialTitle overrides', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(true);
    pathname = '/dashboard/items/new';
    matches = [{ options: { staticData: { label: '新增条目' } } }];
    mockUseRouter.mockReturnValue({
      routesByPath: {
        '/dashboard/items/new': { options: { staticData: { label: '新增条目' } } }
      }
    });

    render(
      <WorkspacePageBoundary
        tabId='/dashboard/items/new'
        initialTitle='新增条目'
        keepAlive={false}
        render={() => <div>Item</div>}
      />
    );

    expect(getDescriptors()['/dashboard/items/new']).toMatchObject({
      tabId: '/dashboard/items/new',
      initialTitle: '新增条目',
      keepAlive: false
    });
  });

  it('normalizes an explicit tabId with a trailing slash', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(true);

    render(<WorkspacePageBoundary tabId='/dashboard/users/' render={() => <div>Users</div>} />);

    expect(getDescriptors()['/dashboard/users']).toMatchObject({
      tabId: '/dashboard/users',
      initialTitle: '用户'
    });
    expect(getDescriptors()['/dashboard/users/']).toBeUndefined();
  });

  it('prefers route workspace metadata over legacy lifecycle props', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(true);
    mockUseRouter.mockReturnValue({
      routesByPath: {
        '/dashboard/users': {
          options: {
            staticData: {
              label: '用户',
              workspace: { keepAlive: true, closable: false }
            }
          }
        }
      }
    });

    render(
      <WorkspacePageBoundary
        tabId='/dashboard/users'
        keepAlive={false}
        closable={true}
        render={() => <div>Users</div>}
      />
    );

    expect(getDescriptors()['/dashboard/users']).toMatchObject({
      keepAlive: true,
      closable: false
    });
  });

  it('registers render and ignores renderWhenDisabled when workspace tabs are enabled', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(true);
    const renderPage = vi.fn(() => <div>Workspace Content</div>);
    const renderDisabled = vi.fn(() => <div>Disabled Content</div>);

    const { container } = render(
      <WorkspacePageBoundary render={renderPage} renderWhenDisabled={renderDisabled} />
    );

    expect(container.innerHTML).toBe('');
    expect(renderPage).not.toHaveBeenCalled();
    expect(renderDisabled).not.toHaveBeenCalled();

    const descriptor = getDescriptors()['/dashboard/users'];
    expect(descriptor).toBeDefined();

    const descriptorView = render(<>{descriptor.render()}</>);
    expect(descriptorView.getByText('Workspace Content')).toBeTruthy();
    expect(renderPage).toHaveBeenCalledTimes(1);
    expect(renderDisabled).not.toHaveBeenCalled();
  });

  it('does not re-register a closed explicit tab after pathname changes away', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(true);
    mockUseRouter.mockReturnValue({
      routesByPath: {
        '/dashboard/users': { options: { staticData: { label: '用户' } } },
        '/dashboard/overview': { options: { staticData: { label: '仪表盘' } } }
      }
    });

    const { rerender } = render(
      <WorkspacePageBoundary tabId='/dashboard/users' render={() => <div>Users</div>} />
    );

    expect(getDescriptors()['/dashboard/users']).toMatchObject({
      tabId: '/dashboard/users',
      initialTitle: '用户'
    });

    useWorkspaceTabStore.getState().openOrActivate({
      id: '/dashboard/users',
      href: '/dashboard/users',
      title: '用户',
      closable: true,
      keepAlive: true
    });
    useWorkspaceTabStore.getState().close('/dashboard/users');

    pathname = '/dashboard/overview';
    matches = [{ options: { staticData: { label: '仪表盘' } } }];

    rerender(<WorkspacePageBoundary tabId='/dashboard/users' render={() => <div>Users</div>} />);

    expect(getDescriptors()['/dashboard/users']).toBeUndefined();
    expect(useWorkspaceTabStore.getState().tabs['/dashboard/users']).toBeUndefined();
  });

  it('normalizes the implicit tabId when pathname has a trailing slash', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(true);
    pathname = '/dashboard/items/';
    matches = [{ options: { staticData: { label: '条目' } } }];
    mockUseRouter.mockReturnValue({
      routesByPath: {
        '/dashboard/items/': { options: { staticData: { label: '条目' } } }
      }
    });

    render(<WorkspacePageBoundary render={() => <div>Items</div>} />);

    expect(getDescriptors()['/dashboard/items']).toMatchObject({
      tabId: '/dashboard/items',
      initialTitle: '条目'
    });
    expect(getDescriptors()['/dashboard/items/']).toBeUndefined();
  });

  it('renders content directly when workspace tabs are disabled', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(false);

    const { getByText } = render(
      <WorkspacePageBoundary render={() => <div>Inline Content</div>} />
    );

    expect(getByText('Inline Content')).toBeTruthy();
    expect(getDescriptors()).toEqual({});
  });

  it('prefers renderWhenDisabled when workspace tabs are disabled', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(false);

    const { getByText, queryByText } = render(
      <WorkspacePageBoundary
        render={() => <div>Workspace Content</div>}
        renderWhenDisabled={() => <div>Inline Disabled Content</div>}
      />
    );

    expect(getByText('Inline Disabled Content')).toBeTruthy();
    expect(queryByText('Workspace Content')).toBeNull();
    expect(getDescriptors()).toEqual({});
  });

  it('WorkspacePageRoute wraps registered content in PageContainer when workspace tabs are enabled', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(true);

    const { container } = render(
      <WorkspacePageRoute
        render={() => <div>Route Body</div>}
        pageContainerProps={{ pageTitle: 'Route Title' }}
      />
    );

    expect(container.innerHTML).toBe('');

    const descriptor = getDescriptors()['/dashboard/users'];
    expect(descriptor).toBeDefined();

    const descriptorView = render(<>{descriptor.render()}</>);
    expect(descriptorView.getByText('Route Title')).toBeTruthy();
    expect(descriptorView.getByText('Route Body')).toBeTruthy();
  });

  it('WorkspacePageRoute renders direct body without PageContainer when workspace tabs are disabled', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(false);

    const { getByText, queryByText } = render(
      <WorkspacePageRoute
        render={() => <div>Route Body</div>}
        pageContainerProps={{ pageTitle: 'Route Title' }}
      />
    );

    expect(getByText('Route Body')).toBeTruthy();
    expect(queryByText('Route Title')).toBeNull();
    expect(getDescriptors()).toEqual({});
  });
});
