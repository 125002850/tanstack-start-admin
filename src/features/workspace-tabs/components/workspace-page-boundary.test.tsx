import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isWorkspaceTabsEnabled } from '@/config/workspace-tabs';
import { useWorkspaceTabStore } from '../utils/store';
import { useWorkspacePageRegistryStore } from '../utils/page-registry';
import { WorkspacePageBoundary } from './workspace-page-boundary';

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
  let pathname = '/dashboard/system-management/dictionaries';
  let matches: unknown[] = [{ options: { staticData: { label: '用户' } } }];

  beforeEach(() => {
    pathname = '/dashboard/system-management/dictionaries';
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

    const { container } = render(<WorkspacePageBoundary render={() => <div>Dictionaries</div>} />);

    expect(container.innerHTML).toBe('');
    expect(getDescriptors()['/dashboard/system-management/dictionaries']).toMatchObject({
      tabId: '/dashboard/system-management/dictionaries',
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

    expect(getDescriptors()['/dashboard/items/new']).toMatchObject(
      {
        tabId: '/dashboard/items/new',
        initialTitle: '新增条目',
        keepAlive: false
      }
    );
  });

  it('normalizes an explicit tabId with a trailing slash', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(true);

    render(
      <WorkspacePageBoundary tabId='/dashboard/system-management/dictionaries/' render={() => <div>Dictionaries</div>} />
    );

    expect(getDescriptors()['/dashboard/system-management/dictionaries']).toMatchObject({
      tabId: '/dashboard/system-management/dictionaries',
      initialTitle: '用户'
    });
    expect(getDescriptors()['/dashboard/system-management/dictionaries/']).toBeUndefined();
  });

  it('prefers route workspace metadata over legacy lifecycle props', () => {
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(true);
    mockUseRouter.mockReturnValue({
      routesByPath: {
        '/dashboard/system-management/dictionaries': {
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
        tabId='/dashboard/system-management/dictionaries'
        keepAlive={false}
        closable={true}
        render={() => <div>Dictionaries</div>}
      />
    );

    expect(getDescriptors()['/dashboard/system-management/dictionaries']).toMatchObject({
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

    const descriptor = getDescriptors()['/dashboard/system-management/dictionaries'];
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
        '/dashboard/system-management/dictionaries': { options: { staticData: { label: '用户' } } },
        '/dashboard/overview': { options: { staticData: { label: '仪表盘' } } }
      }
    });

    const { rerender } = render(
      <WorkspacePageBoundary tabId='/dashboard/system-management/dictionaries' render={() => <div>Dictionaries</div>} />
    );

    expect(getDescriptors()['/dashboard/system-management/dictionaries']).toMatchObject({
      tabId: '/dashboard/system-management/dictionaries',
      initialTitle: '用户'
    });

    useWorkspaceTabStore.getState().openOrActivate({
      id: '/dashboard/system-management/dictionaries',
      href: '/dashboard/system-management/dictionaries',
      title: '用户',
      closable: true,
      keepAlive: true
    });
    useWorkspaceTabStore.getState().close('/dashboard/system-management/dictionaries');

    pathname = '/dashboard/overview';
    matches = [{ options: { staticData: { label: '仪表盘' } } }];

    rerender(<WorkspacePageBoundary tabId='/dashboard/system-management/dictionaries' render={() => <div>Dictionaries</div>} />);

    expect(getDescriptors()['/dashboard/system-management/dictionaries']).toBeUndefined();
    expect(useWorkspaceTabStore.getState().tabs['/dashboard/system-management/dictionaries']).toBeUndefined();
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

    render(<WorkspacePageBoundary render={() => <div>Exports</div>} />);

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
});
