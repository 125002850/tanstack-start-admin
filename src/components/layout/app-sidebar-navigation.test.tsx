import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const locationState = vi.hoisted(() => ({ pathname: '/overview' }));
const viewport = vi.hoisted(() => ({ isMobile: false }));
const navigate = vi.hoisted(() => vi.fn());
const routes = vi.hoisted(() => ({
  system: {
    id: '/_app/system-management/',
    fullPath: '/system-management/',
    staticData: {
      label: '系统管理',
      nav: {
        visible: true,
        group: 'systemManagement',
        order: 0,
        kind: 'container',
        icon: 'settings'
      }
    }
  },
  dictionaries: {
    id: '/_app/system-management/dictionaries',
    fullPath: '/system-management/dictionaries',
    staticData: {
      label: '字典管理',
      nav: {
        visible: true,
        group: 'systemManagement',
        order: 10,
        parentId: '/system-management',
        menuKey: 'dict-management'
      }
    }
  },
  exportCenter: {
    id: '/_app/system-management/export-center',
    fullPath: '/system-management/export-center',
    staticData: {
      label: '导出中心',
      nav: {
        visible: true,
        group: 'systemManagement',
        order: 20,
        parentId: '/system-management',
        menuKey: 'export-center'
      }
    }
  }
}));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => viewport.isMobile }));
vi.mock('@tanstack/react-router', async () => {
  const ReactModule = await import('react');
  return {
    useRouter: () => ({ routesById: routes, navigate }),
    useLocation: () => ({ pathname: locationState.pathname }),
    Link: ReactModule.forwardRef<
      HTMLAnchorElement,
      React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }
    >(function MockLink({ to, ...props }, ref) {
      return ReactModule.createElement('a', {
        ...props,
        ref,
        href: to,
        onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
          props.onClick?.(event);
          event.preventDefault();
          navigate({ to });
        }
      });
    })
  };
});

import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from './app-sidebar';

function renderSidebar(defaultOpen = true, menuKeys = ['dict-management', 'export-center']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(['sso', 'login-info'], {
    userId: '1',
    userName: 'admin',
    realName: '管理员',
    phone: '',
    menuData: menuKeys.map((code) => ({ code, hiddenFlag: 'N' })),
    loginUrl: '',
    logoutUrl: ''
  });
  const tree = () => (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarTrigger />
        <button type='button'>页面操作</button>
      </SidebarProvider>
    </QueryClientProvider>
  );
  return { ...render(tree()), tree };
}

describe('sidebar navigation', () => {
  afterEach(() => {
    cleanup();
    locationState.pathname = '/overview';
    viewport.isMobile = false;
  });

  it('only shows a title on hover, opens on click and stays open when the pointer leaves', async () => {
    const user = userEvent.setup();
    renderSidebar(false);
    const trigger = screen.getByRole('button', { name: '系统管理' });

    await user.hover(trigger);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('系统管理');
    await act(() => new Promise((resolve) => setTimeout(resolve, 180)));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(trigger);
    const item = await screen.findByRole('menuitem', { name: '字典管理' });
    expect(item).toHaveAttribute('href', '/system-management/dictionaries');
    await user.hover(item);
    await user.unhover(item);
    await act(() => new Promise((resolve) => setTimeout(resolve, 260)));
    expect(item).toBeVisible();

    await user.click(screen.getByRole('button', { name: '页面操作' }));
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('supports keyboard selection and restores focus after Escape', async () => {
    const user = userEvent.setup();
    renderSidebar(false);
    const trigger = screen.getByRole('button', { name: '系统管理' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    const dictionaryItem = await screen.findByRole('menuitem', { name: '字典管理' });
    await waitFor(() => expect(dictionaryItem).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: '导出中心' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: '字典管理' })).toHaveFocus());
    await user.keyboard('{Enter}');
    expect(navigate).toHaveBeenCalledWith({ to: '/system-management/dictionaries' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('allows collapsing an active group and reopens it when re-entering its routes', async () => {
    const user = userEvent.setup();
    locationState.pathname = '/system-management/dictionaries';
    const { rerender, tree } = renderSidebar();
    const trigger = screen.getByRole('button', { name: '系统管理' });
    expect(trigger).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('link', { name: '字典管理' })).toHaveAttribute('data-active', 'true');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: '字典管理' })).not.toBeInTheDocument();

    locationState.pathname = '/overview';
    rerender(tree());
    expect(trigger).toHaveAttribute('data-active', 'false');
    locationState.pathname = '/system-management/export-center';
    rerender(tree());
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
  });

  it('renders one interactive group without a duplicate heading and filters unauthorized children', async () => {
    const user = userEvent.setup();
    const { container } = renderSidebar(true, ['dict-management']);
    expect(container.querySelector('[data-sidebar="group-label"]')).toBeNull();
    expect(screen.getAllByText('系统管理')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '系统管理' }));
    expect(screen.getByRole('link', { name: '字典管理' })).toBeVisible();
    expect(screen.queryByRole('link', { name: '导出中心' })).not.toBeInTheDocument();
  });

  it('removes containers when none of their pages are permitted', () => {
    renderSidebar(true, []);
    expect(screen.queryByRole('button', { name: '系统管理' })).not.toBeInTheDocument();
  });

  it('uses collapsible children inside the mobile drawer even when desktop is collapsed', async () => {
    viewport.isMobile = true;
    const user = userEvent.setup();
    renderSidebar(false);
    await user.click(screen.getByRole('button', { name: 'Toggle Sidebar' }));
    await user.click(await screen.findByRole('button', { name: '系统管理' }));
    expect(screen.getByRole('link', { name: '字典管理' })).toBeVisible();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('keeps SSO notifications and logout without IAM account actions', async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByRole('button', { name: '用户菜单' }));
    expect(screen.getByRole('menuitem', { name: '退出登录' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: '个人资料' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: '修改密码' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: '通知' }));
    expect(navigate).toHaveBeenCalledWith({ to: '/notifications' });
  });
});
