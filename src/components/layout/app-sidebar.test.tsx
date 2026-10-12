import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SidebarProvider } from '@/components/ui/sidebar';
import * as React from 'react';
import userEvent from '@testing-library/user-event';

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    navigate: vi.fn(),
    routesById: {},
    state: { location: { pathname: '/overview' } }
  }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children),
  useLocation: () => ({ pathname: '/overview' })
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

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

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
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(SidebarProvider, null, React.createElement(AppSidebar))
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

  it('only calls session.logout after confirming the logout dialog', async () => {
    const user = userEvent.setup();
    await renderSidebar(queryClient);

    await user.click(screen.getByRole('button', { name: '用户菜单' }));
    await user.click(screen.getByRole('menuitem', { name: /退出登录/ }));

    expect(screen.getByRole('alertdialog', { name: '确认退出登录？' })).toBeVisible();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(mockLogout).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: '取消' })).toHaveFocus());

    await user.click(screen.getByRole('button', { name: '确认退出' }));

    expect(mockLogout).toHaveBeenCalledOnce();
  });

  it.each(['cancel', 'escape'])('keeps the session and restores focus on %s', async (action) => {
    const user = userEvent.setup();
    await renderSidebar(queryClient);
    const trigger = screen.getByRole('button', { name: '用户菜单' });

    trigger.focus();
    await user.keyboard('{ArrowDown}');
    await screen.findByRole('menuitem', { name: /通知/ });
    await user.keyboard('{End}{Enter}');
    expect(screen.getByRole('alertdialog', { name: '确认退出登录？' })).toBeVisible();

    if (action === 'cancel') {
      await user.click(screen.getByRole('button', { name: '取消' }));
    } else {
      await user.keyboard('{Escape}');
    }

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(mockLogout).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.click(trigger);
    expect(screen.getByRole('menuitem', { name: /退出登录/ })).toBeVisible();
  });
});
