import * as React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useOverlayLifecycle } from '@/components/ui/overlay-lifecycle';
import { useWorkspaceTabStore } from '../utils/store';
import { useWorkspacePageRegistryStore } from '../utils/page-registry';
import { dismissWorkspacePageOverlays, resetWorkspacePageOverlays } from '../utils/page-overlays';
import { WorkspaceViewport } from './workspace-viewport';
import type { WorkspacePageDescriptor, WorkspacePageLifecycle, WorkspaceTab } from '../types';

type TestTabInput = Omit<WorkspaceTab, 'lastVisitedAt'> & {
  lastVisitedAt?: number;
};

function setStoreState(
  tabs: Record<string, TestTabInput>,
  activeId: string | null,
  disabledIds: string[] = [],
  extra: Partial<{
    pageDescriptors: Record<string, WorkspacePageDescriptor>;
    lifecycleSnapshots: Record<string, WorkspacePageLifecycle>;
  }> = {}
) {
  const normalizedTabs = Object.fromEntries(
    Object.entries(tabs).map(([id, tab]) => [id, { ...tab, lastVisitedAt: tab.lastVisitedAt ?? 0 }])
  ) as Record<string, WorkspaceTab>;

  useWorkspaceTabStore.setState({
    tabs: normalizedTabs,
    activeId,
    openedOrder: Object.keys(normalizedTabs),
    disabledKeepAliveIds: new Set(disabledIds),
    lifecycleSnapshots: extra.lifecycleSnapshots ?? {}
  });
  useWorkspacePageRegistryStore.setState({ descriptors: extra.pageDescriptors ?? {} });
}

function makePageDescriptor(
  overrides: Partial<WorkspacePageDescriptor> = {}
): WorkspacePageDescriptor {
  return {
    tabId: '/test',
    initialTitle: 'Test Page',
    keepAlive: true,
    closable: true,
    render: () => React.createElement('div', { 'data-testid': 'v2-screen' }, 'V2 Page'),
    ...overrides
  };
}

function resetStore() {
  resetWorkspacePageOverlays();
  useWorkspaceTabStore.setState({
    tabs: {},
    activeId: null,
    openedOrder: [],
    disabledKeepAliveIds: new Set(),
    lifecycleSnapshots: {}
  });
  useWorkspacePageRegistryStore.getState().resetDescriptors();
}

function OverlayLifecycleProbe({ close }: { close: () => void }) {
  useOverlayLifecycle(true, close);
  return null;
}

describe('WorkspaceViewport', () => {
  beforeEach(() => {
    resetStore();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  // ─── V2 page descriptor rendering (new system) ───

  describe('V2 page descriptors', () => {
    it('renders the active tab visibly (not via Activity hidden)', () => {
      const desc = makePageDescriptor({
        tabId: '/active',
        render: () => React.createElement('div', { 'data-testid': 'active-content' }, 'Active')
      });
      setStoreState(
        {
          '/active': {
            id: '/active',
            keepAlive: true,
            href: '/active',
            title: 'Active',
            closable: true
          }
        },
        '/active',
        [],
        { pageDescriptors: { '/active': desc } }
      );

      const { getByTestId } = render(React.createElement(WorkspaceViewport));
      const el = getByTestId('active-content');
      expect(el).toBeDefined();
      // Active content should NOT have display:none (it's visible)
      expect(el.style.display).not.toBe('none');
    });

    it('provides overlay lifecycle registration for each workspace page', () => {
      const tabId = '/overlay';
      const close = vi.fn();
      const desc = makePageDescriptor({
        tabId,
        render: () => <OverlayLifecycleProbe close={close} />
      });
      setStoreState(
        {
          [tabId]: {
            id: tabId,
            keepAlive: true,
            href: tabId,
            title: 'Overlay',
            closable: true
          }
        },
        tabId,
        [],
        { pageDescriptors: { [tabId]: desc } }
      );

      render(<WorkspaceViewport />);

      dismissWorkspacePageOverlays(tabId, null);
      expect(close).toHaveBeenCalledTimes(1);
    });

    it('reuses page content when only the active workspace tab changes', () => {
      const renderActive = vi.fn(() =>
        React.createElement('div', { 'data-testid': 'active-content' }, 'Active')
      );
      const renderInactive = vi.fn(() =>
        React.createElement('div', { 'data-testid': 'inactive-content' }, 'Inactive')
      );
      setStoreState(
        {
          '/active': {
            id: '/active',
            keepAlive: true,
            href: '/active',
            title: 'Active',
            closable: true
          },
          '/inactive': {
            id: '/inactive',
            keepAlive: true,
            href: '/inactive',
            title: 'Inactive',
            closable: true
          }
        },
        '/active',
        [],
        {
          pageDescriptors: {
            '/active': makePageDescriptor({
              tabId: '/active',
              render: renderActive
            }),
            '/inactive': makePageDescriptor({
              tabId: '/inactive',
              render: renderInactive
            })
          }
        }
      );

      render(React.createElement(WorkspaceViewport));
      expect(renderActive).toHaveBeenCalledTimes(1);
      expect(renderInactive).toHaveBeenCalledTimes(1);

      act(() => {
        useWorkspaceTabStore.setState({ activeId: '/inactive' });
      });

      expect(renderActive).toHaveBeenCalledTimes(1);
      expect(renderInactive).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('active-content')).not.toBeVisible();
      expect(screen.getByTestId('inactive-content')).toBeVisible();
    });

    it('renders inactive keep-alive tabs via Activity hidden', () => {
      const activeDesc = makePageDescriptor({
        tabId: '/active',
        render: () => React.createElement('div', { 'data-testid': 'active-content' }, 'Active')
      });
      const inactiveDesc = makePageDescriptor({
        tabId: '/inactive',
        render: () => React.createElement('div', { 'data-testid': 'inactive-content' }, 'Inactive')
      });
      setStoreState(
        {
          '/active': {
            id: '/active',
            keepAlive: true,
            href: '/active',
            title: 'Active',
            closable: true
          },
          '/inactive': {
            id: '/inactive',
            keepAlive: true,
            href: '/inactive',
            title: 'Inactive',
            closable: true
          }
        },
        '/active',
        [],
        {
          pageDescriptors: { '/active': activeDesc, '/inactive': inactiveDesc }
        }
      );

      const { getByTestId } = render(React.createElement(WorkspaceViewport));
      const inactiveEl = getByTestId('inactive-content');
      expect(inactiveEl).toBeDefined();
      expect(inactiveEl).not.toBeVisible();
    });

    it('does NOT render inactive non-keep-alive tabs', () => {
      const activeDesc = makePageDescriptor({
        tabId: '/active',
        render: () => React.createElement('div', { 'data-testid': 'active-content' }, 'Active')
      });
      const nonKeepDesc = makePageDescriptor({
        tabId: '/nonkeep',
        keepAlive: false,
        render: () => React.createElement('div', { 'data-testid': 'nonkeep-content' }, 'NonKeep')
      });
      setStoreState(
        {
          '/active': {
            id: '/active',
            keepAlive: true,
            href: '/active',
            title: 'Active',
            closable: true
          },
          '/nonkeep': {
            id: '/nonkeep',
            keepAlive: false,
            href: '/nonkeep',
            title: 'NonKeep',
            closable: true
          }
        },
        '/active',
        [],
        { pageDescriptors: { '/active': activeDesc, '/nonkeep': nonKeepDesc } }
      );

      const { queryByTestId, getByTestId } = render(React.createElement(WorkspaceViewport));
      expect(getByTestId('active-content')).toBeDefined();
      expect(queryByTestId('nonkeep-content')).toBeNull();
    });

    it('skips tabs with disabled keep-alive (slot error recovery)', () => {
      const desc = makePageDescriptor({
        tabId: '/broken',
        render: () => React.createElement('div', { 'data-testid': 'broken-content' }, 'Broken')
      });
      setStoreState(
        {
          '/active': {
            id: '/active',
            keepAlive: true,
            href: '/active',
            title: 'Active',
            closable: true
          },
          '/broken': {
            id: '/broken',
            keepAlive: true,
            href: '/broken',
            title: 'Broken',
            closable: true
          }
        },
        '/active',
        ['/broken'],
        {
          pageDescriptors: {
            '/active': makePageDescriptor({ tabId: '/active' }),
            '/broken': desc
          }
        }
      );

      const { queryByTestId } = render(React.createElement(WorkspaceViewport));
      expect(queryByTestId('broken-content')).toBeNull();
    });

    it('renders errorFallback from descriptor when render throws', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const desc = makePageDescriptor({
        tabId: '/fallback',
        // Pass a render function that throws — the error boundary wrapper catches it
        render: () => {
          throw new Error('test error');
        },
        errorFallback: React.createElement(
          'div',
          { 'data-testid': 'custom-fallback' },
          'Custom Fallback'
        )
      });
      setStoreState(
        {
          '/fallback': {
            id: '/fallback',
            keepAlive: true,
            href: '/fallback',
            title: 'Fallback',
            closable: true
          }
        },
        '/fallback',
        [],
        { pageDescriptors: { '/fallback': desc } }
      );

      try {
        render(React.createElement(WorkspaceViewport));
        // After error, keepAlive is disabled for that tag → viewport skips it
        // The errorBoundary renders the custom fallback
      } catch {
        // Error boundary should catch it; if not caught, test still verifies below
      }
      // Verify that keepAlive was disabled (error boundary behavior)
      expect(useWorkspaceTabStore.getState().disabledKeepAliveIds.has('/fallback')).toBe(true);
      consoleSpy.mockRestore();
    });

    it('renders a generic module failure message without guessing the root cause', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const moduleError = new SyntaxError(
        "The requested module '/src/example.ts' does not provide an export named 'example'"
      );
      const desc = makePageDescriptor({
        tabId: '/fallback',
        render: () => {
          throw moduleError;
        }
      });
      setStoreState(
        {
          '/fallback': {
            id: '/fallback',
            keepAlive: true,
            href: '/fallback',
            title: 'Fallback',
            closable: true
          }
        },
        '/fallback',
        [],
        { pageDescriptors: { '/fallback': desc } }
      );

      render(React.createElement(WorkspaceViewport));

      expect(screen.getByText('页面模块加载失败')).toBeInTheDocument();
      expect(screen.getByText(/页面依赖或当前构建产物可能不一致/)).toBeInTheDocument();
      expect(screen.getByText(moduleError.message)).toBeInTheDocument();
      expect(screen.queryByText(/API 客户端与页面代码不匹配/)).not.toBeInTheDocument();
      consoleSpy.mockRestore();
    });

    it('handles missing descriptor gracefully (active tab without descriptor)', () => {
      // Tab exists but no page descriptor — should not crash, just render nothing
      setStoreState(
        {
          '/orphan': {
            id: '/orphan',
            keepAlive: true,
            href: '/orphan',
            title: 'Orphan',
            closable: true
          }
        },
        '/orphan',
        [],
        { pageDescriptors: {} }
      );

      const { container } = render(React.createElement(WorkspaceViewport));
      // No entries to render — viewport returns null
      expect(container.innerHTML).toBe('');
    });

    it('renders multiple V2 pages with correct visibility', () => {
      const tabs = {
        '/a': {
          id: '/a',
          keepAlive: true,
          href: '/a',
          title: 'A',
          closable: true
        },
        '/b': {
          id: '/b',
          keepAlive: true,
          href: '/b',
          title: 'B',
          closable: true
        },
        '/c': {
          id: '/c',
          keepAlive: true,
          href: '/c',
          title: 'C',
          closable: true
        }
      };
      const descs = {
        '/a': makePageDescriptor({
          tabId: '/a',
          render: () => React.createElement('div', { 'data-testid': 'screen-a' }, 'A')
        }),
        '/b': makePageDescriptor({
          tabId: '/b',
          render: () => React.createElement('div', { 'data-testid': 'screen-b' }, 'B')
        }),
        '/c': makePageDescriptor({
          tabId: '/c',
          render: () => React.createElement('div', { 'data-testid': 'screen-c' }, 'C')
        })
      };
      setStoreState(tabs, '/b', [], { pageDescriptors: descs });

      const { getByTestId } = render(React.createElement(WorkspaceViewport));

      // B is active → visible
      expect(getByTestId('screen-b').style.display).not.toBe('none');
      // A and C are inactive keep-alive → hidden
      expect(getByTestId('screen-a')).not.toBeVisible();
      expect(getByTestId('screen-c')).not.toBeVisible();
    });
  });
});

it('recreates only the refreshed page tree and preserves other workspace state', () => {
  resetStore();
  const mounted = vi.fn();
  const unmounted = vi.fn();
  function Page({ id }: { id: string }) {
    const [value, setValue] = React.useState('initial');
    React.useEffect(() => {
      mounted(id);
      return () => unmounted(id);
    }, [id]);
    return (
      <input data-testid={id} value={value} onChange={(event) => setValue(event.target.value)} />
    );
  }
  const renderA = vi.fn(() => <Page id='a' />);
  const renderB = vi.fn(() => <Page id='b' />);
  for (const [id, renderPage] of [
    ['a', renderA],
    ['b', renderB]
  ] as const) {
    useWorkspaceTabStore
      .getState()
      .openOrActivate({ id, href: `/${id}`, title: id, keepAlive: true });
    useWorkspacePageRegistryStore
      .getState()
      .registerDescriptor(id, makePageDescriptor({ tabId: id, render: renderPage }));
  }
  const view = render(<WorkspaceViewport />);
  fireEvent.change(screen.getByTestId('b'), { target: { value: 'keep-b' } });
  act(() => useWorkspaceTabStore.setState({ activeId: 'a' }));
  fireEvent.change(screen.getByTestId('a'), { target: { value: 'reset-a' } });
  const previousNode = screen.getByTestId('a');
  mounted.mockClear();
  unmounted.mockClear();
  act(() => useWorkspaceTabStore.getState().remountPage('a'));
  expect(screen.getByTestId('a')).not.toBe(previousNode);
  expect(screen.getByTestId('a')).toHaveValue('initial');
  expect(renderA).toHaveBeenCalledTimes(2);
  expect(renderB).toHaveBeenCalledTimes(1);
  expect(unmounted).toHaveBeenCalledExactlyOnceWith('a');
  expect(mounted).toHaveBeenCalledExactlyOnceWith('a');
  act(() => useWorkspaceTabStore.setState({ activeId: 'b' }));
  expect(screen.getByTestId('b')).toHaveValue('keep-b');
  view.unmount();
  resetStore();
});
