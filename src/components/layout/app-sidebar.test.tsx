import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import userEvent from '@testing-library/user-event';

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    navigate: vi.fn(),
    routesById: {},
    state: { location: { pathname: '/dashboard/overview' } }
  }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children),
  useLocation: () => ({ pathname: '/dashboard/overview' })
}));

const mockLogout = vi.fn();
vi.mock('@/lib/api/iam/session', () => ({
  logout: () => mockLogout(),
  handleUnauthorized: vi.fn()
}));

vi.mock('@/hooks/use-nav', () => ({
  useFilteredNavGroups: () => []
}));

vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'sidebar' }, children),
  SidebarProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  SidebarContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'sidebar-content' }, children),
  SidebarFooter: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'sidebar-footer' }, children),
  SidebarGroup: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SidebarHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SidebarMenu: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SidebarMenuButton: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement('button', { 'data-testid': 'sidebar-menu-button', className }, children),
  SidebarMenuSub: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SidebarMenuSubButton: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SidebarMenuSubItem: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SidebarRail: () => React.createElement('div', null),
  SidebarInset: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children)
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) =>
    React.createElement('div', { 'data-testid': 'skeleton', className })
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  CollapsibleContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children)
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'dropdown-content' }, children),
  DropdownMenuGroup: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  DropdownMenuItem: ({
    children,
    onClick,
    onSelect
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    onSelect?: (event: { preventDefault: () => void }) => void;
  }) =>
    React.createElement(
      'button',
      {
        'data-testid': 'dropdown-item',
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          onSelect?.({ preventDefault: () => event.preventDefault() });
          onClick?.();
        }
      },
      children
    ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  DropdownMenuSeparator: () => React.createElement('hr', null),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'dropdown-trigger' }, children)
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? React.createElement('div', { 'data-testid': 'sheet' }, children) : null,
  SheetContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('section', null, children),
  SheetDescription: ({ children }: { children: React.ReactNode }) =>
    React.createElement('p', null, children),
  SheetHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SheetTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement('h2', null, children)
}));

vi.mock('@/components/ui/auth-skeleton', () => ({
  AuthSkeleton: () => React.createElement('div', { 'data-testid': 'auth-skeleton' }),
  AuthAvatarSkeleton: () => React.createElement('div', { 'data-testid': 'auth-avatar-skeleton' }),
  AuthTextSkeleton: () => React.createElement('div', { 'data-testid': 'auth-text-skeleton' }),
  AuthMenuSkeleton: () => React.createElement('div', { 'data-testid': 'auth-menu-skeleton' })
}));

vi.mock('../icons', () => ({
  Icons: {
    account: () => React.createElement('span', null, 'account-icon'),
    logo: () => React.createElement('span', null, 'logo-icon'),
    chevronsDown: () => React.createElement('span', null, 'chevron-icon'),
    notification: () => React.createElement('span', null, 'notification-icon'),
    profile: () => React.createElement('span', null, 'profile-icon'),
    lock: () => React.createElement('span', null, 'lock-icon'),
    logout: () => React.createElement('span', null, 'logout-icon'),
    arrowRight: () => React.createElement('span', null, 'arrow-icon')
  }
}));

vi.mock('@/lib/router/route-nav', () => ({
  buildNavGroupsFromRoutes: () => []
}));

async function renderSidebar(queryClient: QueryClient) {
  const { default: AppSidebar } = await import('./app-sidebar');

  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(AppSidebar)
    )
  );
}

describe('app-sidebar auth footer', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });
    // Pre-populate current staff to avoid loading state in success tests.
    queryClient.setQueryData(['iam', 'me'], {
      staff: {
        staffId: '1',
        username: 'admin',
        staffName: '管理员',
        phone: '13800138000',
        status: 'ENABLED'
      },
      roles: [],
      permissions: [],
      menus: [],
      dataScopeSummary: {
        effectiveType: 'ALL',
        includeSelf: true,
        description: '全部数据'
      },
      dataScope: {
        effectiveType: 'ALL',
        includeSelf: true,
        description: '全部数据'
      },
      mustChangePassword: false
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders user info when login data is cached', async () => {
    await renderSidebar(queryClient);

    expect(screen.getByText('管理员')).toBeDefined();
    expect(screen.getByText('13800138000')).toBeDefined();
  });

  it('renders skeleton when login info is loading', async () => {
    // Force loading state: no cached data, fetch never resolves
    queryClient.clear();
    globalThis.fetch = vi.fn(() => new Promise<Response>(() => {})) as typeof fetch;

    await renderSidebar(queryClient);

    // Loading state shows skeleton placeholders
    expect(screen.getByTestId('auth-avatar-skeleton')).toBeDefined();
    expect(screen.getAllByTestId('auth-text-skeleton').length).toBeGreaterThan(0);

    cleanup();
  });

  it('falls back to userName when realName is empty', async () => {
    queryClient.setQueryData(['iam', 'me'], {
      ...(queryClient.getQueryData(['iam', 'me']) as Record<string, unknown>),
      staff: {
        staffId: '1',
        username: 'admin',
        staffName: '',
        phone: '',
        status: 'ENABLED'
      }
    });

    await renderSidebar(queryClient);

    expect(screen.getByText('admin')).toBeDefined();
    expect(screen.getByText('-')).toBeDefined();
  });

  it('calls session.logout when clicking logout', async () => {
    const user = userEvent.setup();
    await renderSidebar(queryClient);

    // Open dropdown to reveal logout button
    const trigger = screen.getByTestId('dropdown-trigger');
    await user.click(trigger);

    // Click logout button
    const logoutButton = screen
      .getAllByTestId('dropdown-item')
      .find((el) => el.textContent?.includes('退出登录'));
    expect(logoutButton).toBeDefined();
    await user.click(logoutButton!);

    expect(mockLogout).toHaveBeenCalledOnce();
  });

  it('opens account profile and password sheets from the user menu', async () => {
    const user = userEvent.setup();
    await renderSidebar(queryClient);

    const profileButton = screen
      .getAllByTestId('dropdown-item')
      .find((el) => el.textContent?.includes('个人资料'));
    expect(profileButton).toBeDefined();
    await user.click(profileButton!);

    expect(screen.getByRole('heading', { name: '个人资料' })).toBeDefined();
    expect(screen.getByText('查看当前登录账号的员工信息、角色和数据权限。')).toBeDefined();

    const passwordButton = screen
      .getAllByTestId('dropdown-item')
      .find((el) => el.textContent?.includes('修改密码'));
    expect(passwordButton).toBeDefined();
    await user.click(passwordButton!);

    expect(screen.getByRole('heading', { name: '修改密码' })).toBeDefined();
    expect(screen.getByText('更新当前账号的登录密码。')).toBeDefined();
  });
});
