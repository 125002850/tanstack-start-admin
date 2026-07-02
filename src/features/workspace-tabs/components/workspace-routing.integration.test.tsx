import * as React from 'react';
import * as ReactDOM from 'react-dom';
import type { Column } from '@tanstack/react-table';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Command, CommandItem, CommandList } from '@/components/ui/command';
import { DataTableFacetedFilter } from '@/components/ui/table/data-table-faceted-filter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { useWorkspaceTabStore } from '../utils/store';
import { useWorkspacePageRegistryStore } from '../utils/page-registry';
import { resetWorkspacePageOverlays } from '../utils/page-overlays';
import { useDashboardRouteTagSync } from '../hooks/use-dashboard-route-tag-sync';
import { useWorkspaceTags } from '../hooks/use-workspace-tags';
import { WorkspacePageBoundary } from './workspace-page-boundary';
import { WorkspaceViewport } from './workspace-viewport';
import { isWorkspaceTabsEnabled } from '@/config/workspace-tabs';

// ---- Mutable router state controlled by each test case ----
let mockPathname = '/dashboard/overview';
let mockSearch = '';
const mockNavigate = vi.fn();

const mockRoutesByPath: Record<string, unknown> = {
  '/': {},
  '/dashboard': {
    options: {
      staticData: { label: '控制台', workspace: { tagEnabled: false, keepAlive: false } }
    }
  },
  '/dashboard/overview': {
    options: {
      staticData: {
        label: '仪表盘',
        title: '仪表盘',
        workspace: { tagEnabled: true, keepAlive: false }
      }
    }
  },
  '/dashboard/system-management/export-center': {
    options: {
      staticData: {
        label: '导出中心',
        title: '导出中心',
        workspace: { tagEnabled: true, keepAlive: true }
      }
    }
  },
  '/dashboard/items': {
    options: {
      staticData: { label: '条目', title: '条目', workspace: { tagEnabled: true, keepAlive: true } }
    }
  },
  '/dashboard/system-management/audit-log': {
    options: {
      staticData: {
        label: '审计日志',
        title: '审计日志',
        workspace: { tagEnabled: true, keepAlive: true }
      }
    }
  },
  '/dashboard/chat': {
    options: {
      staticData: { label: '聊天', title: '聊天', workspace: { tagEnabled: true, keepAlive: true } }
    }
  },
  '/dashboard/settings': {
    options: {
      staticData: {
        label: '设置',
        title: '设置',
        workspace: { tagEnabled: true, keepAlive: false }
      }
    }
  },
  '/dashboard/system-management': {
    options: {
      staticData: {
        label: '系统管理',
        title: '系统管理',
        workspace: { tagEnabled: false, keepAlive: false }
      }
    }
  },
  '/dashboard/system-management/dictionaries': {
    options: {
      staticData: {
        label: '字典管理',
        title: '字典管理',
        workspace: { tagEnabled: true, keepAlive: true }
      }
    }
  }
};

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ routesByPath: mockRoutesByPath, navigate: mockNavigate }),
  useRouterState: ({
    select
  }: {
    select?: (state: {
      location: { pathname: string; search: string };
      matches: unknown[];
    }) => unknown;
  }) => {
    const leafMatch = mockRoutesByPath[mockPathname] ?? {};
    const state = {
      location: { pathname: mockPathname, search: mockSearch },
      matches: [leafMatch]
    };
    return select ? select(state) : state;
  },
  useMatches: ({ select }: { select?: (matches: unknown[]) => unknown }) => {
    const leafMatch = mockRoutesByPath[mockPathname] ?? {};
    const matches = [leafMatch];
    return select ? select(matches) : matches;
  },
  useParams: () => ({}),
  useSearch: () => ({})
}));

// Mock isWorkspaceTabsEnabled — defaults to true, overridable per test
vi.mock('@/config/workspace-tabs', () => ({
  isWorkspaceTabsEnabled: vi.fn(() => true),
  MAX_KEEPALIVE_TABS: 15
}));

// ---- V2 Harness (new WorkspacePageBoundary behavior) ----
function V2RoutingHarness({
  pathname,
  title,
  keepAlive,
  testId,
  passTabId = true,
  render: renderPage
}: {
  pathname: string;
  title: string;
  keepAlive: boolean;
  testId: string;
  passTabId?: boolean;
  render?: () => React.ReactNode;
}) {
  mockPathname = pathname;
  mockSearch = '';

  useDashboardRouteTagSync(isWorkspaceTabsEnabled());

  return React.createElement(WorkspacePageBoundary, {
    ...(passTabId ? { tabId: pathname } : {}),
    initialTitle: title,
    keepAlive,
    closable: pathname !== '/dashboard/overview',
    render: renderPage ?? (() => React.createElement('div', { 'data-testid': testId }, title)),
    errorFallback: React.createElement('div', { 'data-testid': `fallback-${testId}` }, 'Error')
  });
}

function NonWorkspaceRouteHarness({
  pathname,
  testId,
  title
}: {
  pathname: string;
  testId: string;
  title: string;
}) {
  mockPathname = pathname;
  mockSearch = '';

  useDashboardRouteTagSync(isWorkspaceTabsEnabled());

  return React.createElement('div', { 'data-testid': testId }, title);
}

function GlobalPortalPage({ testId, text }: { testId: string; text: string }) {
  return ReactDOM.createPortal(
    React.createElement('div', { 'data-testid': testId }, text),
    document.body
  );
}

function WorkspacePopoverCommandPage({
  contentTestId,
  triggerTestId
}: {
  contentTestId: string;
  triggerTestId: string;
}) {
  const [open, setOpen] = React.useState(true);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type='button' data-testid={triggerTestId}>
          Toggle
        </button>
      </PopoverTrigger>
      <PopoverContent className='p-0'>
        <Command>
          <CommandList>
            <CommandItem data-testid={contentTestId} value='framework'>
              Framework
            </CommandItem>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function WorkspaceSelectPage({
  contentTestId,
  triggerTestId
}: {
  contentTestId: string;
  triggerTestId: string;
}) {
  const [open, setOpen] = React.useState(true);

  return (
    <Select defaultValue='10' open={open} onOpenChange={setOpen}>
      <SelectTrigger data-testid={triggerTestId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent data-testid={contentTestId}>
        <SelectGroup>
          <SelectItem value='10'>10</SelectItem>
          <SelectItem value='20'>20</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function WorkspaceDropdownMenuPage({
  contentTestId,
  triggerTestId
}: {
  contentTestId: string;
  triggerTestId: string;
}) {
  const [open, setOpen] = React.useState(true);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger data-testid={triggerTestId}>Columns</DropdownMenuTrigger>
      <DropdownMenuContent data-testid={contentTestId}>
        <DropdownMenuGroup>
          <DropdownMenuItem>Risk level</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceFacetedFilterPage() {
  const [filterValue, setFilterValue] = React.useState<unknown>();
  const column = React.useMemo(
    () =>
      ({
        getFilterValue: () => filterValue,
        setFilterValue
      }) as Column<unknown, unknown>,
    [filterValue]
  );

  return (
    <DataTableFacetedFilter
      column={column}
      title='任务状态'
      options={[
        { label: '处理中', value: 'PROCESSING' },
        { label: '已完成', value: 'FINISHED' }
      ]}
    />
  );
}

function WorkspaceDialogPage({ contentTestId }: { contentTestId: string }) {
  const [open, setOpen] = React.useState(true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent data-testid={contentTestId}>
        <DialogHeader>
          <DialogTitle>Workspace Dialog</DialogTitle>
          <DialogDescription>Dialog owned by the inactive workspace page.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceSheetPage({ contentTestId }: { contentTestId: string }) {
  const [open, setOpen] = React.useState(true);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent data-testid={contentTestId}>
        <SheetHeader>
          <SheetTitle>Workspace Sheet</SheetTitle>
          <SheetDescription>Sheet owned by the inactive workspace page.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}

function WorkspaceFlagToggleHarness() {
  const enabled = isWorkspaceTabsEnabled();

  mockPathname = '/dashboard/system-management/dictionaries';
  mockSearch = '';

  useDashboardRouteTagSync(enabled);

  return React.createElement(React.Fragment, null, [
    React.createElement(WorkspacePageBoundary, {
      key: 'route-dictionaries',
      tabId: '/dashboard/system-management/dictionaries',
      initialTitle: 'Dictionaries',
      keepAlive: true,
      render: () =>
        React.createElement(GlobalPortalPage, {
          testId: 'workspace-portal',
          text: 'Workspace Portal'
        }),
      renderWhenDisabled: () =>
        React.createElement('div', { 'data-testid': 'inline-disabled' }, 'Inline Disabled')
    }),
    enabled ? React.createElement(WorkspaceViewport, { key: 'viewport' }) : null
  ]);
}

function resetStore() {
  useWorkspaceTabStore.setState({
    tabs: {},
    activeId: null,
    openedOrder: [],
    disabledKeepAliveIds: new Set(),
    lifecycleSnapshots: {}
  });
  useWorkspacePageRegistryStore.getState().resetDescriptors();
  resetWorkspacePageOverlays();
}

function openRegisteredPage(
  id: string,
  options?: {
    title?: string;
    closable?: boolean;
    keepAlive?: boolean;
    href?: string;
    render?: () => React.ReactNode;
  }
) {
  const title = options?.title ?? id;
  const href = options?.href ?? id;
  const closable = options?.closable ?? true;
  const keepAlive = options?.keepAlive ?? true;

  useWorkspaceTabStore.getState().openOrActivate({
    id,
    href,
    title,
    closable,
    keepAlive
  });
  useWorkspaceTabStore.getState().registerPageDescriptor(id, {
    tabId: id,
    initialTitle: title,
    keepAlive,
    closable,
    render: options?.render ?? (() => null)
  });
}

function WorkspaceTagsActionProbe({
  actionsRef
}: {
  actionsRef: React.MutableRefObject<ReturnType<typeof useWorkspaceTags> | null>;
}) {
  const tags = useWorkspaceTags();
  React.useEffect(() => {
    actionsRef.current = tags;
  });
  return null;
}

function getDescriptors() {
  return useWorkspacePageRegistryStore.getState().descriptors;
}

describe('Workspace Routing Integration', () => {
  beforeEach(() => {
    resetStore();
    mockPathname = '/dashboard/overview';
    mockSearch = '';
    mockNavigate.mockClear();
    vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(true);
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  // ─── V2 host ownership ───

  describe('V2 host ownership', () => {
    it('WorkspacePageBoundary returns null when flag-on', () => {
      mockPathname = '/dashboard/system-management/dictionaries';

      const { container } = render(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/system-management/dictionaries',
          title: 'Dictionaries',
          keepAlive: true,
          testId: 'v2-dictionaries'
        })
      );

      // Boundary returns null — no DOM output from the route
      expect(container.innerHTML).toBe('');
    });

    it('WorkspacePageBoundary registers page descriptor in store', () => {
      mockPathname = '/dashboard/system-management/dictionaries';

      render(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/system-management/dictionaries',
          title: 'Dictionaries',
          keepAlive: true,
          testId: 'v2-dictionaries'
        })
      );

      const state = useWorkspaceTabStore.getState();
      expect(getDescriptors()['/dashboard/system-management/dictionaries']).toBeDefined();
      expect(state.tabs['/dashboard/system-management/dictionaries']).toBeDefined();
      expect(state.activeId).toBe('/dashboard/system-management/dictionaries');
    });

    it('WorkspacePageBoundary defaults tabId to pathname when omitted', () => {
      mockPathname = '/dashboard/system-management/dictionaries';

      render(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/system-management/dictionaries',
          title: 'Dictionaries',
          keepAlive: true,
          testId: 'v2-dictionaries',
          passTabId: false
        })
      );

      const state = useWorkspaceTabStore.getState();
      expect(getDescriptors()['/dashboard/system-management/dictionaries']).toBeDefined();
      expect(getDescriptors()['/dashboard/system-management/dictionaries']?.tabId).toBe('/dashboard/system-management/dictionaries');
      expect(state.tabs['/dashboard/system-management/dictionaries']).toBeDefined();
    });

    it('Viewport renders active V2 page visibly and inactive V2 page hidden', () => {
      mockPathname = '/dashboard/system-management/export-center';

      // Register two V2 pages (items active, users inactive keep-alive)
      const { rerender } = render(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/system-management/export-center',
          title: 'Exports',
          keepAlive: true,
          testId: 'v2-export-center'
        })
      );

      // Navigate to users, making items inactive
      mockPathname = '/dashboard/system-management/dictionaries';
      rerender(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/system-management/dictionaries',
          title: 'Dictionaries',
          keepAlive: true,
          testId: 'v2-dictionaries'
        })
      );

      // Now render the viewport — it should show users (active) and items (inactive hidden)
      // But viewport reads from store, not from route props, so render separately
      cleanup();

      const { getByTestId } = render(React.createElement(WorkspaceViewport));

      // Dictionaries is active → visible
      const usersEl = getByTestId('v2-dictionaries');
      expect(usersEl).toBeDefined();
      expect(usersEl.style.display).not.toBe('none');

      // Exports is inactive keep-alive → hidden
      const itemsEl = getByTestId('v2-export-center');
      expect(itemsEl).toBeDefined();
      expect(itemsEl).not.toBeVisible();
    });

    it('hides the cached workspace page after navigating to a tag-disabled route', () => {
      const { rerender, getByTestId } = render(
        React.createElement(React.Fragment, null, [
          React.createElement(V2RoutingHarness, {
            key: 'route-export-center',
            pathname: '/dashboard/system-management/export-center',
            title: 'Exports',
            keepAlive: true,
            testId: 'v2-export-center'
          }),
          React.createElement(WorkspaceViewport, { key: 'viewport' })
        ])
      );

      const itemsEl = getByTestId('v2-export-center');
      expect(itemsEl.style.display).not.toBe('none');
      expect(useWorkspaceTabStore.getState().activeId).toBe('/dashboard/system-management/export-center');

      rerender(
        React.createElement(React.Fragment, null, [
          React.createElement(NonWorkspaceRouteHarness, {
            key: 'route-system-management',
            pathname: '/dashboard/system-management',
            title: 'System Management',
            testId: 'non-workspace-route'
          }),
          React.createElement(WorkspaceViewport, { key: 'viewport' })
        ])
      );

      expect(getByTestId('non-workspace-route')).toBeDefined();
      expect(getByTestId('v2-export-center')).not.toBeVisible();
      expect(useWorkspaceTabStore.getState().activeId).toBeNull();
    });

    it('closes body-level popover command content when a keep-alive page becomes inactive', async () => {
      openRegisteredPage('/dashboard/forms/basic', {
        title: 'Basic Form',
        keepAlive: true,
        render: () =>
          React.createElement(WorkspacePopoverCommandPage, {
            contentTestId: 'framework-command',
            triggerTestId: 'framework-trigger'
          })
      });
      openRegisteredPage('/dashboard/system-management/dictionaries', {
        title: 'Dictionaries',
        keepAlive: true,
        render: () => React.createElement('div', { 'data-testid': 'dictionaries-page' }, 'Dictionaries')
      });

      useWorkspaceTabStore.setState({ activeId: '/dashboard/forms/basic' });

      const { getByTestId } = render(React.createElement(WorkspaceViewport));

      expect(getByTestId('framework-command')).toBeDefined();
      expect(getByTestId('framework-trigger')).toBeDefined();

      act(() => {
        useWorkspaceTabStore.setState({ activeId: '/dashboard/system-management/dictionaries' });
      });

      expect(getByTestId('dictionaries-page')).toBeDefined();
      await waitFor(() => {
        expect(getByTestId('framework-trigger')).toHaveAttribute('aria-expanded', 'false');
      });

      expect(getByTestId('framework-trigger')).not.toBeVisible();
      await waitFor(() => {
        expect(
          getByTestId('framework-command').closest('[data-slot="popover-content"]')
        ).toHaveAttribute('data-state', 'closed');
      });
    });

    it('closes body-level select content when a keep-alive page becomes inactive', async () => {
      openRegisteredPage('/dashboard/system-management/audit-log', {
        title: 'Business Info',
        keepAlive: true,
        render: () =>
          React.createElement(WorkspaceSelectPage, {
            contentTestId: 'page-size-content',
            triggerTestId: 'page-size-trigger'
          })
      });
      openRegisteredPage('/dashboard/system-management/dictionaries', {
        title: 'Dictionaries',
        keepAlive: true,
        render: () => React.createElement('div', { 'data-testid': 'dictionaries-page' }, 'Dictionaries')
      });

      useWorkspaceTabStore.setState({ activeId: '/dashboard/system-management/audit-log' });

      const { getByTestId, queryByTestId } = render(React.createElement(WorkspaceViewport));

      expect(getByTestId('page-size-content')).toBeVisible();
      expect(getByTestId('page-size-trigger')).toHaveAttribute('aria-expanded', 'true');

      act(() => {
        useWorkspaceTabStore.setState({ activeId: '/dashboard/system-management/dictionaries' });
      });

      expect(getByTestId('dictionaries-page')).toBeDefined();
      await waitFor(() => {
        expect(getByTestId('page-size-trigger')).toHaveAttribute('aria-expanded', 'false');
        expect(queryByTestId('page-size-content')).toBeNull();
      });
    });

    it('closes body-level dropdown menu content when a keep-alive page becomes inactive', async () => {
      openRegisteredPage('/dashboard/system-management/audit-log', {
        title: 'Business Info',
        keepAlive: true,
        render: () =>
          React.createElement(WorkspaceDropdownMenuPage, {
            contentTestId: 'column-menu-content',
            triggerTestId: 'column-menu-trigger'
          })
      });
      openRegisteredPage('/dashboard/system-management/dictionaries', {
        title: 'Dictionaries',
        keepAlive: true,
        render: () => React.createElement('div', { 'data-testid': 'dictionaries-page' }, 'Dictionaries')
      });

      useWorkspaceTabStore.setState({ activeId: '/dashboard/system-management/audit-log' });

      const { getByTestId } = render(React.createElement(WorkspaceViewport));

      expect(getByTestId('column-menu-content')).toBeVisible();
      expect(getByTestId('column-menu-trigger')).toHaveAttribute('aria-expanded', 'true');

      act(() => {
        useWorkspaceTabStore.setState({ activeId: '/dashboard/system-management/dictionaries' });
      });

      expect(getByTestId('dictionaries-page')).toBeDefined();
      await waitFor(() => {
        expect(getByTestId('column-menu-trigger')).toHaveAttribute('aria-expanded', 'false');
        expect(getByTestId('column-menu-content')).toHaveAttribute('data-state', 'closed');
      });
    });

    it('closes DataTable faceted filter popover when route sync switches active page', async () => {
      const user = userEvent.setup();
      const { getByRole, getByText, getByTestId, rerender } = render(
        React.createElement(React.Fragment, null, [
          React.createElement(V2RoutingHarness, {
            key: 'route-follow-up',
            pathname: '/dashboard/system-management/export-center',
            title: '导出记录',
            keepAlive: true,
            testId: 'follow-up-page',
            render: () => React.createElement(WorkspaceFacetedFilterPage)
          }),
          React.createElement(WorkspaceViewport, { key: 'viewport' })
        ])
      );

      const trigger = getByRole('button', { name: /任务状态/ });
      await user.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(getByText('处理中')).toBeVisible();

      rerender(
        React.createElement(React.Fragment, null, [
          React.createElement(V2RoutingHarness, {
            key: 'route-dictionaries',
            pathname: '/dashboard/system-management/dictionaries',
            title: 'Dictionaries',
            keepAlive: true,
            testId: 'dictionaries-page'
          }),
          React.createElement(WorkspaceViewport, { key: 'viewport' })
        ])
      );

      await waitFor(() => {
        expect(getByTestId('dictionaries-page')).toBeDefined();
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('closes DataTable faceted filter popover immediately when a workspace tag is activated', async () => {
      const user = userEvent.setup();
      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>();
      openRegisteredPage('/dashboard/system-management/export-center', {
        title: '导出记录',
        keepAlive: true,
        render: () => React.createElement(WorkspaceFacetedFilterPage)
      });
      openRegisteredPage('/dashboard/system-management/dictionaries', {
        title: 'Dictionaries',
        keepAlive: true,
        render: () => React.createElement('div', { 'data-testid': 'dictionaries-page' }, 'Dictionaries')
      });
      useWorkspaceTabStore.setState({
        activeId: '/dashboard/system-management/export-center'
      });

      const { getByRole, getByText } = render(
        React.createElement(React.Fragment, null, [
          React.createElement(WorkspaceTagsActionProbe, { key: 'actions', actionsRef }),
          React.createElement(WorkspaceViewport, { key: 'viewport' })
        ])
      );

      const trigger = getByRole('button', { name: /任务状态/ });
      await user.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(getByText('处理中')).toBeVisible();

      act(() => {
        actionsRef.current!.openOrActivate(
          useWorkspaceTabStore.getState().tabs['/dashboard/system-management/dictionaries']!
        );
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard/system-management/dictionaries' });
      });
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(document.querySelectorAll('[data-radix-popper-content-wrapper]')).toHaveLength(0);
      });
    });

    it('closes body-level dialog content when a keep-alive page becomes inactive', async () => {
      openRegisteredPage('/dashboard/dialog-owner', {
        title: 'Dialog Owner',
        keepAlive: true,
        render: () => React.createElement(WorkspaceDialogPage, { contentTestId: 'dialog-content' })
      });
      openRegisteredPage('/dashboard/system-management/dictionaries', {
        title: 'Dictionaries',
        keepAlive: true,
        render: () => React.createElement('div', { 'data-testid': 'dictionaries-page' }, 'Dictionaries')
      });

      useWorkspaceTabStore.setState({ activeId: '/dashboard/dialog-owner' });

      const { getByTestId } = render(React.createElement(WorkspaceViewport));

      expect(getByTestId('dialog-content')).toBeVisible();

      act(() => {
        useWorkspaceTabStore.setState({ activeId: '/dashboard/system-management/dictionaries' });
      });

      expect(getByTestId('dictionaries-page')).toBeDefined();
      await waitFor(() => {
        expect(getByTestId('dialog-content')).toHaveAttribute('data-state', 'closed');
      });
    });

    it('closes body-level sheet content when a keep-alive page becomes inactive', async () => {
      openRegisteredPage('/dashboard/sheet-owner', {
        title: 'Sheet Owner',
        keepAlive: true,
        render: () => React.createElement(WorkspaceSheetPage, { contentTestId: 'sheet-content' })
      });
      openRegisteredPage('/dashboard/system-management/dictionaries', {
        title: 'Dictionaries',
        keepAlive: true,
        render: () => React.createElement('div', { 'data-testid': 'dictionaries-page' }, 'Dictionaries')
      });

      useWorkspaceTabStore.setState({ activeId: '/dashboard/sheet-owner' });

      const { getByTestId } = render(React.createElement(WorkspaceViewport));

      expect(getByTestId('sheet-content')).toBeVisible();

      act(() => {
        useWorkspaceTabStore.setState({ activeId: '/dashboard/system-management/dictionaries' });
      });

      expect(getByTestId('dictionaries-page')).toBeDefined();
      await waitFor(() => {
        expect(getByTestId('sheet-content')).toHaveAttribute('data-state', 'closed');
      });
    });

    it('route unmount does NOT cleanup page descriptor', () => {
      mockPathname = '/dashboard/system-management/dictionaries';

      const { unmount } = render(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/system-management/dictionaries',
          title: 'Dictionaries',
          keepAlive: true,
          testId: 'v2-dictionaries'
        })
      );

      // Descriptor is registered
      expect(getDescriptors()['/dashboard/system-management/dictionaries']).toBeDefined();

      // Unmount the boundary (simulating route navigation away)
      unmount();

      // Descriptor should STILL be registered (shell store owns it now)
      expect(getDescriptors()['/dashboard/system-management/dictionaries']).toBeDefined();
    });

    it('tab close cleans up descriptor and lifecycle', () => {
      const store = useWorkspaceTabStore.getState();
      openRegisteredPage('/dashboard/system-management/dictionaries', { title: 'Dictionaries' });
      store.updateLifecycle('/dashboard/system-management/dictionaries', { dirty: true });

      store.close('/dashboard/system-management/dictionaries');

      expect(getDescriptors()['/dashboard/system-management/dictionaries']).toBeUndefined();
      expect(store.lifecycleSnapshots['/dashboard/system-management/dictionaries']).toBeUndefined();
    });

    it('shell resetAll cleans up all descriptors', () => {
      const store = useWorkspaceTabStore.getState();
      openRegisteredPage('/dashboard/system-management/dictionaries', { title: 'Dictionaries' });
      openRegisteredPage('/dashboard/system-management/export-center', { title: 'Exports' });

      store.resetAll();

      expect(Object.keys(getDescriptors())).toHaveLength(0);
      expect(Object.keys(store.lifecycleSnapshots)).toHaveLength(0);
    });
  });

  // ─── V2 lifecycle (title, dirty, closeGuard) ───

  describe('V2 lifecycle', () => {
    function getState() {
      return useWorkspaceTabStore.getState();
    }

    it('title can be updated via updateLifecycle', () => {
      openRegisteredPage('/dashboard/system-management/dictionaries', { title: 'Dictionaries' });

      getState().updateLifecycle('/dashboard/system-management/dictionaries', { title: 'Dictionaries (99)' });
      expect(getState().lifecycleSnapshots['/dashboard/system-management/dictionaries']?.title).toBe('Dictionaries (99)');
      expect(getState().tabs['/dashboard/system-management/dictionaries']?.title).toBe('Dictionaries');
    });

    it('dirty flag can be toggled', () => {
      getState().registerPageDescriptor('/dashboard/system-management/dictionaries', {
        tabId: '/dashboard/system-management/dictionaries',
        initialTitle: 'Dictionaries',
        keepAlive: true,
        closable: true,
        render: () => null
      });

      getState().updateLifecycle('/dashboard/system-management/dictionaries', { dirty: true });
      expect(getState().lifecycleSnapshots['/dashboard/system-management/dictionaries']?.dirty).toBe(true);

      getState().updateLifecycle('/dashboard/system-management/dictionaries', { dirty: false });
      expect(getState().lifecycleSnapshots['/dashboard/system-management/dictionaries']?.dirty).toBe(false);
    });

    it('closeGuard can be set and is preserved in lifecycle snapshot', () => {
      const guard = vi.fn(() => true);
      getState().registerPageDescriptor('/dashboard/system-management/dictionaries', {
        tabId: '/dashboard/system-management/dictionaries',
        initialTitle: 'Dictionaries',
        keepAlive: true,
        closable: true,
        render: () => null
      });

      getState().updateLifecycle('/dashboard/system-management/dictionaries', { closeGuard: guard });
      expect(getState().lifecycleSnapshots['/dashboard/system-management/dictionaries']?.closeGuard).toBe(guard);
    });
  });

  // ─── V2 keepAlive=false owner model ───

  describe('V2 keepAlive=false', () => {
    function getState() {
      return useWorkspaceTabStore.getState();
    }

    it('non-keep-alive page descriptor is still owned by ActivityHost', () => {
      getState().registerPageDescriptor('/dashboard/settings', {
        tabId: '/dashboard/settings',
        initialTitle: 'Settings',
        keepAlive: false,
        closable: true,
        render: () => null
      });

      expect(getDescriptors()['/dashboard/settings']).toBeDefined();
    });

    it('inactive non-keep-alive page is NOT rendered by viewport', () => {
      // Register items first (will be active), then settings (makes settings active, items inactive)
      // We want items(keepAlive=true) active + settings(keepAlive=false) inactive
      // So: register items, then explicitly set activeId back to items
      openRegisteredPage('/dashboard/system-management/export-center', {
        title: 'Exports',
        keepAlive: true,
        render: () => React.createElement('div', { 'data-testid': 'v2-export-center' }, 'Exports')
      });
      openRegisteredPage('/dashboard/settings', {
        title: 'Settings',
        keepAlive: false,
        render: () => React.createElement('div', { 'data-testid': 'v2-settings' }, 'Settings')
      });

      // Set items as active so settings is inactive (and non-keep-alive → should not render)
      useWorkspaceTabStore.setState({ activeId: '/dashboard/system-management/export-center' });

      const { queryByTestId, getByTestId } = render(React.createElement(WorkspaceViewport));
      // Exports is active → visible
      expect(getByTestId('v2-export-center')).toBeDefined();
      // Settings is inactive non-keep-alive → NOT rendered
      expect(queryByTestId('v2-settings')).toBeNull();
    });
  });

  // ─── V2 first render no-blank-viewport ───

  describe('V2 first render no blank viewport', () => {
    it('viewport renders active page content in the same render cycle as registration', () => {
      // Simulate a full render where boundary registers during the same render cycle
      mockPathname = '/dashboard/system-management/dictionaries';

      // Render boundary + viewport together (simulating real app layout)
      const { getByTestId } = render(
        React.createElement('div', null, [
          React.createElement(V2RoutingHarness, {
            key: 'route',
            pathname: '/dashboard/system-management/dictionaries',
            title: 'Dictionaries',
            keepAlive: true,
            testId: 'v2-dictionaries'
          }),
          React.createElement(WorkspaceViewport, { key: 'viewport' })
        ])
      );

      // The viewport should have rendered the active page content
      const usersEl = getByTestId('v2-dictionaries');
      expect(usersEl).toBeDefined();
      // Active content should be visible (not hidden)
      expect(usersEl.style.display).not.toBe('none');
    });

    it('viewport renders non-null content for first-opened tag', () => {
      openRegisteredPage('/dashboard/system-management/export-center', {
        title: 'Exports',
        render: () =>
          React.createElement('div', { 'data-testid': 'first-tag' }, 'First Tag Content')
      });

      const { getByTestId, container } = render(React.createElement(WorkspaceViewport));
      expect(getByTestId('first-tag')).toBeDefined();
      // Viewport should not be empty
      expect(container.innerHTML).not.toBe('');
    });
  });

  // ─── V2 descriptor missing / error fallback ───

  describe('V2 descriptor missing / error fallback', () => {
    it('ActivityHost handles descriptor missing gracefully', () => {
      // Tab exists in store but no page descriptor — viewport returns null
      useWorkspaceTabStore.setState({
        tabs: {
          '/dashboard/orphan': {
            id: '/dashboard/orphan',
            keepAlive: true,
            href: '/dashboard/orphan',
            title: 'Orphan',
            closable: true,
            lastVisitedAt: Date.now()
          }
        },
        activeId: '/dashboard/orphan',
        openedOrder: ['/dashboard/orphan']
      });

      const { container } = render(React.createElement(WorkspaceViewport));
      // No descriptor → no entries → null (but not a crash)
      expect(container.innerHTML).toBe('');
    });
  });

  // ─── V2 flag-off: zero side effect ───

  describe('V2 flag-off — WorkspacePageBoundary direct render', () => {
    function getState() {
      return useWorkspaceTabStore.getState();
    }

    it('renders page directly when feature flag is off', () => {
      vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(false);

      mockPathname = '/dashboard/system-management/dictionaries';
      const { getByTestId } = render(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/system-management/dictionaries',
          title: 'Dictionaries',
          keepAlive: true,
          testId: 'v2-dictionaries'
        })
      );

      // Flag-off: boundary renders content directly, not null
      expect(getByTestId('v2-dictionaries')).toBeDefined();
      expect(getByTestId('v2-dictionaries').textContent).toBe('Dictionaries');
    });

    it('does NOT register page descriptor when flag-off', () => {
      vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(false);

      mockPathname = '/dashboard/system-management/dictionaries';
      render(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/system-management/dictionaries',
          title: 'Dictionaries',
          keepAlive: true,
          testId: 'v2-dictionaries'
        })
      );

      // No descriptor registered, no tab created
      expect(getDescriptors()['/dashboard/system-management/dictionaries']).toBeUndefined();
      expect(getState().tabs['/dashboard/system-management/dictionaries']).toBeUndefined();
    });

    it('does NOT write to workspace store at all when flag-off', () => {
      vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(false);

      mockPathname = '/dashboard/system-management/dictionaries';
      render(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/system-management/dictionaries',
          title: 'Dictionaries',
          keepAlive: true,
          testId: 'v2-dictionaries'
        })
      );

      // Store should be completely untouched
      const state = getState();
      expect(Object.keys(getDescriptors())).toHaveLength(0);
      expect(Object.keys(state.tabs)).toHaveLength(0);
      expect(Object.keys(state.lifecycleSnapshots)).toHaveLength(0);
      expect(state.activeId).toBeNull();
    });

    it('flag-off boundary returns non-null content (opposite of flag-on null)', () => {
      vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(false);

      mockPathname = '/dashboard/system-management/export-center';
      const { container } = render(
        React.createElement(V2RoutingHarness, {
          pathname: '/dashboard/system-management/export-center',
          title: 'Exports',
          keepAlive: true,
          testId: 'v2-export-center'
        })
      );

      // Flag-off: container has real content, not empty like flag-on
      expect(container.innerHTML).not.toBe('');
    });

    it('tears down global portals from workspace-hosted pages when the feature flag turns off', () => {
      vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(true);

      const { getByTestId, queryByTestId, rerender } = render(
        React.createElement(WorkspaceFlagToggleHarness)
      );

      expect(getByTestId('workspace-portal')).toBeDefined();
      expect(useWorkspaceTabStore.getState().tabs['/dashboard/system-management/dictionaries']).toBeDefined();

      vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(false);
      rerender(React.createElement(WorkspaceFlagToggleHarness));

      expect(getByTestId('inline-disabled')).toBeDefined();
      expect(queryByTestId('workspace-portal')).toBeNull();
    });

    it('cleans cached workspace pages even if the viewport tree has not re-rendered yet', () => {
      vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(true);

      const viewportRoot = render(React.createElement(WorkspaceViewport));
      const boundaryRoot = render(React.createElement(WorkspaceFlagToggleHarness));

      expect(boundaryRoot.queryAllByTestId('workspace-portal').length).toBeGreaterThan(0);
      expect(useWorkspaceTabStore.getState().tabs['/dashboard/system-management/dictionaries']).toBeDefined();

      vi.mocked(isWorkspaceTabsEnabled).mockReturnValue(false);
      boundaryRoot.rerender(React.createElement(WorkspaceFlagToggleHarness));

      expect(boundaryRoot.getByTestId('inline-disabled')).toBeDefined();
      expect(boundaryRoot.queryAllByTestId('workspace-portal')).toHaveLength(0);
      expect(viewportRoot.queryAllByTestId('workspace-portal')).toHaveLength(0);
      expect(useWorkspaceTabStore.getState().tabs['/dashboard/system-management/dictionaries']).toBeUndefined();
      expect(getDescriptors()['/dashboard/system-management/dictionaries']).toBeUndefined();
    });
  });

  // ─── V2 route instance tags ───

  describe('V2 route instance tags', () => {
    function getState() {
      return useWorkspaceTabStore.getState();
    }

    it('creates separate tags for different detail page instances', () => {
      // Simulate navigating to item/123, then item/456
      openRegisteredPage('/dashboard/items/123', { title: '条目 #123' });
      openRegisteredPage('/dashboard/items/456', { title: '条目 #456' });

      const state = getState();
      expect(state.tabs['/dashboard/items/123']).toBeDefined();
      expect(state.tabs['/dashboard/items/456']).toBeDefined();
      expect(state.tabs['/dashboard/items/123']?.id).not.toBe(
        state.tabs['/dashboard/items/456']?.id
      );
    });

    it('route instances appear in opened order', () => {
      openRegisteredPage('/dashboard/items/123', { title: '123' });
      openRegisteredPage('/dashboard/items/456', { title: '456' });

      const order = getState().openedOrder;
      expect(order).toContain('/dashboard/items/123');
      expect(order).toContain('/dashboard/items/456');
    });

    it('"new" route instance creates its own tag separate from list', () => {
      openRegisteredPage('/dashboard/items', { title: '条目' });
      openRegisteredPage('/dashboard/items/new', { title: '新增条目' });

      const state = getState();
      expect(state.tabs['/dashboard/items']).toBeDefined();
      expect(state.tabs['/dashboard/items/new']).toBeDefined();
      // They are different tabs
      expect(state.tabs['/dashboard/items']?.id).toBe('/dashboard/items');
      expect(state.tabs['/dashboard/items/new']?.id).toBe('/dashboard/items/new');
    });
  });

  // ─── V2 closeGuard integration ───

  describe('V2 closeGuard integration', () => {
    function getState() {
      return useWorkspaceTabStore.getState();
    }

    function setupTab(
      id: string,
      title: string,
      opts?: { closable?: boolean; keepAlive?: boolean }
    ) {
      openRegisteredPage(id, {
        title,
        keepAlive: opts?.keepAlive ?? true,
        closable: opts?.closable ?? true
      });
    }

    // Test component that exposes useWorkspaceTags methods
    function CloseGuardTester({
      actionsRef
    }: {
      actionsRef: React.MutableRefObject<ReturnType<typeof useWorkspaceTags> | null>;
    }) {
      const tags = useWorkspaceTags();
      React.useEffect(() => {
        actionsRef.current = tags;
      });
      return null;
    }

    it('close-current with guard returning false does not close the tab', async () => {
      setupTab('/dashboard/system-management/dictionaries', 'Dictionaries');
      const guard = vi.fn(() => false);
      getState().updateLifecycle('/dashboard/system-management/dictionaries', { closeGuard: guard, dirty: true });

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>();
      render(React.createElement(CloseGuardTester, { actionsRef }));

      await act(() => actionsRef.current!.close('/dashboard/system-management/dictionaries'));

      // Tab still exists — guard returned false
      expect(getState().tabs['/dashboard/system-management/dictionaries']).toBeDefined();
      expect(guard).toHaveBeenCalledWith({ tabId: '/dashboard/system-management/dictionaries', reason: 'close-current' });
    });

    it('close-current with guard returning true allows close', async () => {
      setupTab('/dashboard/system-management/dictionaries', 'Dictionaries');
      const guard = vi.fn(() => true);
      getState().updateLifecycle('/dashboard/system-management/dictionaries', { closeGuard: guard });

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>();
      render(React.createElement(CloseGuardTester, { actionsRef }));

      await act(() => actionsRef.current!.close('/dashboard/system-management/dictionaries'));

      expect(getState().tabs['/dashboard/system-management/dictionaries']).toBeUndefined();
    });

    it('closeOther aborts batch on first guard rejection', async () => {
      setupTab('/dashboard/system-management/export-center', 'Exports');
      setupTab('/dashboard/system-management/dictionaries', 'Dictionaries');
      setupTab('/dashboard/settings', 'Settings');

      // Exports lets close go through, Dictionaries rejects
      getState().updateLifecycle('/dashboard/system-management/export-center', { closeGuard: () => true });
      getState().updateLifecycle('/dashboard/system-management/dictionaries', { closeGuard: () => false, dirty: true });
      getState().updateLifecycle('/dashboard/settings', { closeGuard: () => true });

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>();
      render(React.createElement(CloseGuardTester, { actionsRef }));

      // closeOther keeping settings
      await act(() => actionsRef.current!.closeOther('/dashboard/settings'));

      // Settings and Exports should still exist (Dictionaries rejected, batch aborted)
      expect(getState().tabs['/dashboard/settings']).toBeDefined();
      expect(getState().tabs['/dashboard/system-management/export-center']).toBeDefined();
      expect(getState().tabs['/dashboard/system-management/dictionaries']).toBeDefined();
    });

    it('closeOther aborts and navigates to rejecting tab', async () => {
      setupTab('/dashboard/system-management/export-center', 'Exports');
      setupTab('/dashboard/system-management/dictionaries', 'Dictionaries');

      getState().updateLifecycle('/dashboard/system-management/export-center', { closeGuard: () => false, dirty: true });

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>();
      render(React.createElement(CloseGuardTester, { actionsRef }));

      mockNavigate.mockClear();
      await act(() => actionsRef.current!.closeOther('/dashboard/system-management/dictionaries'));

      // Navigated to the rejecting tab
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard/system-management/export-center' });
      // Dictionaries still exists
      expect(getState().tabs['/dashboard/system-management/dictionaries']).toBeDefined();
    });

    it('closeAll aborts on guard rejection and focuses rejecting tab', async () => {
      setupTab('/dashboard/system-management/export-center', 'Exports');
      setupTab('/dashboard/system-management/dictionaries', 'Dictionaries');

      getState().updateLifecycle('/dashboard/system-management/export-center', { closeGuard: () => true });
      getState().updateLifecycle('/dashboard/system-management/dictionaries', { closeGuard: () => false, dirty: true });

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>();
      render(React.createElement(CloseGuardTester, { actionsRef }));

      mockNavigate.mockClear();
      await act(() => actionsRef.current!.closeAll());

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard/system-management/dictionaries' });
      // Exports still exists (batch aborted before processing it)
      expect(getState().tabs['/dashboard/system-management/export-center']).toBeDefined();
    });

    it('guard that throws is treated as rejection', async () => {
      setupTab('/dashboard/system-management/dictionaries', 'Dictionaries');
      getState().updateLifecycle('/dashboard/system-management/dictionaries', {
        closeGuard: () => {
          throw new Error('nope');
        },
        dirty: true
      });

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>();
      render(React.createElement(CloseGuardTester, { actionsRef }));

      await act(() => actionsRef.current!.close('/dashboard/system-management/dictionaries'));

      expect(getState().tabs['/dashboard/system-management/dictionaries']).toBeDefined();
    });

    it('guard that returns rejected promise is treated as rejection', async () => {
      setupTab('/dashboard/system-management/dictionaries', 'Dictionaries');
      getState().updateLifecycle('/dashboard/system-management/dictionaries', {
        closeGuard: () => Promise.reject(new Error('nope')),
        dirty: true
      });

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>();
      render(React.createElement(CloseGuardTester, { actionsRef }));

      await act(() => actionsRef.current!.close('/dashboard/system-management/dictionaries'));

      expect(getState().tabs['/dashboard/system-management/dictionaries']).toBeDefined();
    });

    it('guard timeout is treated as rejection', async () => {
      vi.useFakeTimers();
      setupTab('/dashboard/system-management/dictionaries', 'Dictionaries');
      getState().updateLifecycle('/dashboard/system-management/dictionaries', {
        closeGuard: () => new Promise(() => {}), // never resolves
        dirty: true
      });

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>();
      render(React.createElement(CloseGuardTester, { actionsRef }));

      const closePromise = act(() => actionsRef.current!.close('/dashboard/system-management/dictionaries'));
      vi.advanceTimersByTime(2000); // past 1500ms timeout
      await closePromise;

      expect(getState().tabs['/dashboard/system-management/dictionaries']).toBeDefined();
      vi.useRealTimers();
    });

    it('no guard set allows immediate close', async () => {
      setupTab('/dashboard/system-management/dictionaries', 'Dictionaries');
      // No closeGuard set

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>();
      render(React.createElement(CloseGuardTester, { actionsRef }));

      await act(() => actionsRef.current!.close('/dashboard/system-management/dictionaries'));

      expect(getState().tabs['/dashboard/system-management/dictionaries']).toBeUndefined();
    });

    it('closeOther traverses tabs left-to-right by openedOrder', async () => {
      // Register in specific order to set openedOrder
      setupTab('/dashboard/system-management/export-center', 'Exports');
      setupTab('/dashboard/system-management/dictionaries', 'Dictionaries');
      setupTab('/dashboard/settings', 'Settings');

      const callOrder: string[] = [];
      getState().updateLifecycle('/dashboard/system-management/export-center', {
        closeGuard: () => {
          callOrder.push('items');
          return true;
        }
      });
      getState().updateLifecycle('/dashboard/system-management/dictionaries', {
        closeGuard: () => {
          callOrder.push('users');
          return true;
        }
      });
      getState().updateLifecycle('/dashboard/settings', {
        closeGuard: () => {
          callOrder.push('settings');
          return true;
        }
      });

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>();
      render(React.createElement(CloseGuardTester, { actionsRef }));

      // closeOther keeping items (items is first in order, users and settings will be closed)
      await act(() => actionsRef.current!.closeOther('/dashboard/system-management/export-center'));

      expect(callOrder).toEqual(['users', 'settings']);
    });

    it('closeOther excludes home tab from closeGuard traversal', async () => {
      setupTab('/dashboard/overview', '仪表盘', { closable: false, keepAlive: false });
      setupTab('/dashboard/system-management/export-center', 'Exports');
      setupTab('/dashboard/system-management/dictionaries', 'Dictionaries');

      const callOrder: string[] = [];
      getState().updateLifecycle('/dashboard/overview', {
        closeGuard: () => {
          callOrder.push('home');
          return true;
        }
      });
      getState().updateLifecycle('/dashboard/system-management/export-center', {
        closeGuard: () => {
          callOrder.push('items');
          return true;
        }
      });
      getState().updateLifecycle('/dashboard/system-management/dictionaries', {
        closeGuard: () => {
          callOrder.push('users');
          return true;
        }
      });

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>();
      render(React.createElement(CloseGuardTester, { actionsRef }));

      await act(() => actionsRef.current!.closeOther('/dashboard/system-management/export-center'));

      expect(callOrder).toEqual(['users']);
      expect(getState().tabs['/dashboard/overview']).toBeDefined();
      expect(getState().tabs['/dashboard/system-management/export-center']).toBeDefined();
    });

    it('closeAll traverses tabs left-to-right including non-home tabs', async () => {
      setupTab('/dashboard/overview', '仪表盘', { closable: false });
      setupTab('/dashboard/system-management/export-center', 'Exports');
      setupTab('/dashboard/system-management/dictionaries', 'Dictionaries');

      const callOrder: string[] = [];
      getState().updateLifecycle('/dashboard/system-management/export-center', {
        closeGuard: () => {
          callOrder.push('items');
          return true;
        }
      });
      getState().updateLifecycle('/dashboard/system-management/dictionaries', {
        closeGuard: () => {
          callOrder.push('users');
          return true;
        }
      });

      const actionsRef = React.createRef<ReturnType<typeof useWorkspaceTags>>();
      render(React.createElement(CloseGuardTester, { actionsRef }));

      await act(() => actionsRef.current!.closeAll());

      // Home tab (overview) is excluded from close target set, but items+users are closed
      expect(callOrder).toEqual(['items', 'users']);
      expect(getState().tabs['/dashboard/overview']).toBeDefined();
    });
  });
});
