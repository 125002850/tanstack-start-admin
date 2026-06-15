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
vi.mock('@/lib/api/sso/session', () => ({
  logout: () => mockLogout(),
  handleUnauthorized: vi.fn()
}));

vi.mock('@/lib/api/sso/set-headers', () => ({
  setHeader: () => new Headers()
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
  SidebarMenuButton: ({
    children,
    className
  }: {
    children: React.ReactNode;
    className?: string;
  }) =>
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
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) =>
    React.createElement('button', { 'data-testid': 'dropdown-item', onClick }, children),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  DropdownMenuSeparator: () => React.createElement('hr', null),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'dropdown-trigger' }, children)
}));

vi.mock('@/components/ui/sso-skeleton', () => ({
  SsoSkeleton: () => React.createElement('div', { 'data-testid': 'sso-skeleton' }),
  SsoAvatarSkeleton: () => React.createElement('div', { 'data-testid': 'sso-avatar-skeleton' }),
  SsoTextSkeleton: () => React.createElement('div', { 'data-testid': 'sso-text-skeleton' }),
  SsoMenuSkeleton: () => React.createElement('div', { 'data-testid': 'sso-menu-skeleton' })
}));

vi.mock('../icons', () => ({
  Icons: {
    account: () => React.createElement('span', null, 'account-icon'),
    logo: () => React.createElement('span', null, 'logo-icon'),
    chevronsDown: () => React.createElement('span', null, 'chevron-icon'),
    notification: () => React.createElement('span', null, 'notification-icon'),
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
    React.createElement(QueryClientProvider, { client: queryClient },
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
    // Pre-populate login info to avoid loading state in success tests
    queryClient.setQueryData(['sso', 'login-info'], {
      userId: '1',
      userName: 'admin',
      realName: '管理员',
      phone: '13800138000',
      menuData: [],
      loginUrl: 'https://sso/login',
      logoutUrl: 'https://sso/logout'
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
    expect(screen.getByTestId('sso-avatar-skeleton')).toBeDefined();
    expect(screen.getAllByTestId('sso-text-skeleton').length).toBeGreaterThan(0);

    cleanup();
  });

  it('falls back to userName when realName is empty', async () => {
    queryClient.setQueryData(['sso', 'login-info'], {
      ...queryClient.getQueryData(['sso', 'login-info'])!,
      realName: '',
      phone: ''
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
    const logoutButton = screen.getAllByTestId('dropdown-item').find(
      (el) => el.textContent?.includes('退出登录')
    );
    expect(logoutButton).toBeDefined();
    await user.click(logoutButton!);

    expect(mockLogout).toHaveBeenCalledOnce();
  });
});
