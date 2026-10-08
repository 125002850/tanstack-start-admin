import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useDashboardRouteTagSync, findDeepestRouteMatch } from './use-dashboard-route-tag-sync';
import { useWorkspaceTabStore } from '../utils/store';

// Mutable state that tests control to simulate URL changes
let mockPathname = '/overview';
let mockSearch = '';

const mockRoutesByPath = {
  '/': {},
  '/dashboard': {
    options: {
      staticData: { label: '控制台', workspace: { tagEnabled: false, keepAlive: false } }
    }
  },
  '/overview': {
    options: {
      staticData: {
        label: '仪表盘',
        title: '仪表盘',
        workspace: { tagEnabled: true, keepAlive: false }
      }
    }
  },
  '/items/': {
    options: {
      staticData: {
        label: '条目管理',
        title: '条目管理',
        workspace: { tagEnabled: true, keepAlive: true }
      }
    }
  },
  '/items/$itemId': {
    options: {
      staticData: {
        label: '条目详情',
        title: '条目详情',
        workspace: { tagEnabled: true, keepAlive: true }
      }
    }
  },
  '/users': {
    options: {
      staticData: {
        label: '用户管理',
        title: '用户管理',
        workspace: { tagEnabled: true, keepAlive: true, closable: false }
      }
    }
  }
};

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ state: { matches: [{ routeId: '/_app' }] }, routesByPath: mockRoutesByPath }),
  useRouterState: ({
    select
  }: {
    select?: (state: {
      location: { pathname: string; searchStr: string; search: Record<string, never> };
    }) => unknown;
  }) => {
    const state = { location: { pathname: mockPathname, searchStr: mockSearch, search: {} } };
    return select ? select(state) : state;
  }
}));

function SyncHarness() {
  useDashboardRouteTagSync();
  return null;
}

function resetStore() {
  useWorkspaceTabStore.setState({ tabs: {}, activeId: null, openedOrder: [] });
}

describe('findDeepestRouteMatch', () => {
  it('matches a static route', () => {
    const match = findDeepestRouteMatch('/items', mockRoutesByPath);
    expect(match).toBeDefined();
    expect(match!.staticData.label).toBe('条目管理');
  });

  it('matches a dynamic route with $param', () => {
    const match = findDeepestRouteMatch('/items/123', mockRoutesByPath);
    expect(match).toBeDefined();
    expect(match!.staticData.label).toBe('条目详情');
    expect(match!.pattern).toBe('/items/$itemId');
  });

  it('prefers the deepest matching route', () => {
    const match = findDeepestRouteMatch('/items/456', mockRoutesByPath);
    expect(match).toBeDefined();
    expect(match!.staticData.label).toBe('条目详情');
  });

  it('returns undefined for non-matching paths', () => {
    const match = findDeepestRouteMatch('/nonexistent', mockRoutesByPath);
    expect(match).toBeUndefined();
  });

  it('matches dashboard home route', () => {
    const match = findDeepestRouteMatch('/overview', mockRoutesByPath);
    expect(match).toBeDefined();
    expect(match!.staticData.label).toBe('仪表盘');
  });
});

describe('useDashboardRouteTagSync (hook integration)', () => {
  beforeEach(() => {
    resetStore();
    mockPathname = '/overview';
    mockSearch = '';
    cleanup();
  });

  afterEach(cleanup);

  it('seeds home tag as non-closable on mount', () => {
    render(React.createElement(SyncHarness));
    const state = useWorkspaceTabStore.getState();
    const homeTab = state.tabs['/overview'];
    expect(homeTab).toBeDefined();
    expect(homeTab.closable).toBe(false);
    expect(homeTab.title).toBe('仪表盘');
  });

  it('syncs a non-home route as a closable tag', () => {
    mockPathname = '/items';
    render(React.createElement(SyncHarness));
    const state = useWorkspaceTabStore.getState();
    const itemTab = state.tabs['/items'];
    expect(itemTab).toBeDefined();
    expect(itemTab.closable).toBe(true);
    expect(itemTab.keepAlive).toBe(true);
  });

  it('normalizes a trailing-slash pathname to the canonical tab id', () => {
    mockPathname = '/items/';
    render(React.createElement(SyncHarness));
    const state = useWorkspaceTabStore.getState();
    expect(state.tabs['/items']).toBeDefined();
    expect(state.tabs['/items/']).toBeUndefined();
    expect(state.tabs['/items']?.href).toBe('/items');
  });

  it('does not duplicate tabs when only the trailing slash changes', () => {
    mockPathname = '/items';
    const { rerender } = render(React.createElement(SyncHarness));

    mockPathname = '/items/';
    rerender(React.createElement(SyncHarness));

    const state = useWorkspaceTabStore.getState();
    expect(state.openedOrder.filter((id) => id === '/items')).toHaveLength(1);
    expect(state.tabs['/items/']).toBeUndefined();
  });

  it('sets the synced route as the active tab', () => {
    mockPathname = '/users';
    render(React.createElement(SyncHarness));
    const state = useWorkspaceTabStore.getState();
    expect(state.activeId).toBe('/users');
    expect(state.tabs['/users']).toBeDefined();
  });

  it('uses route metadata for closable', () => {
    mockPathname = '/users';
    render(React.createElement(SyncHarness));
    const state = useWorkspaceTabStore.getState();
    expect(state.tabs['/users']?.closable).toBe(false);
  });

  it('skips the layout route /dashboard', () => {
    mockPathname = '/dashboard';
    render(React.createElement(SyncHarness));
    const state = useWorkspaceTabStore.getState();
    // Only the home tab should exist (seeded)
    expect(Object.keys(state.tabs)).toHaveLength(1);
    expect(state.tabs['/overview']).toBeDefined();
  });

  it('preserves search params in the tag href', () => {
    mockPathname = '/items';
    mockSearch = '?page=2&sort=name';
    render(React.createElement(SyncHarness));
    const state = useWorkspaceTabStore.getState();
    const itemTab = state.tabs['/items'];
    expect(itemTab).toBeDefined();
    expect(itemTab.href).toBe('/items?page=2&sort=name');
  });

  it('updates href when search params change', () => {
    mockPathname = '/items';
    mockSearch = '?page=1';
    const { rerender } = render(React.createElement(SyncHarness));
    // Change search params and re-render
    mockSearch = '?page=2';
    rerender(React.createElement(SyncHarness));
    const state = useWorkspaceTabStore.getState();
    expect(state.tabs['/items'].href).toBe('/items?page=2');
  });

  it('does not re-seed home tab if it already exists', () => {
    // Pre-seed the home tab
    useWorkspaceTabStore.getState().openOrActivate({
      id: '/overview',
      href: '/overview',
      title: '仪表盘',
      closable: false,
      keepAlive: false
    });
    render(React.createElement(SyncHarness));
    const state = useWorkspaceTabStore.getState();
    const homeEntries = state.openedOrder.filter((id) => id === '/overview');
    expect(homeEntries).toHaveLength(1);
  });

  it('matches dynamic route and creates tag with correct title', () => {
    mockPathname = '/items/789';
    render(React.createElement(SyncHarness));
    const state = useWorkspaceTabStore.getState();
    const detailTab = state.tabs['/items/789'];
    expect(detailTab).toBeDefined();
    expect(detailTab.title).toBe('条目详情');
    expect(detailTab.closable).toBe(true);
    expect(detailTab.keepAlive).toBe(true);
  });

  it('does not create a tab when no dashboard route matches', () => {
    mockPathname = '/unknown-page';
    render(React.createElement(SyncHarness));
    const state = useWorkspaceTabStore.getState();
    expect(state.tabs['/unknown-page']).toBeUndefined();
    expect(state.tabs['/overview']).toBeDefined();
    expect(state.openedOrder).toEqual(['/overview']);
    expect(state.activeId).toBeNull();
  });
});
