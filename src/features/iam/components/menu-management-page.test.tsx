import * as React from 'react';
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MenuRspDTO } from '@/lib/api/clients/service';

const serviceMocks = vi.hoisted(() => ({
  iamMenuTree: vi.fn(),
  iamMenuCreate: vi.fn(),
  iamMenuUpdate: vi.fn(),
  iamMenuDelete: vi.fn(),
  iamMenuStatusUpdate: vi.fn()
}));

const iamQueryMocks = vi.hoisted(() => ({
  getIamMeQueryOptions: vi.fn()
}));

vi.mock('@/lib/api/clients/service', () => ({
  iamMenuTree: (...args: unknown[]) => serviceMocks.iamMenuTree(...args),
  iamMenuCreate: (...args: unknown[]) => serviceMocks.iamMenuCreate(...args),
  iamMenuUpdate: (...args: unknown[]) => serviceMocks.iamMenuUpdate(...args),
  iamMenuDelete: (...args: unknown[]) => serviceMocks.iamMenuDelete(...args),
  iamMenuStatusUpdate: (...args: unknown[]) => serviceMocks.iamMenuStatusUpdate(...args)
}));

vi.mock('@/lib/api/iam/queries', () => ({
  getIamMeQueryOptions: (...args: unknown[]) => iamQueryMocks.getIamMeQueryOptions(...args)
}));

vi.mock('@/components/permission-gate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

import MenuManagementPage from './menu-management-page';

type MenuNode = MenuRspDTO & {
  children?: MenuNode[];
};

const MENU_TREE: MenuNode[] = [
  {
    menuId: 1,
    menuCode: 'iam',
    menuKey: 'iam',
    menuName: '权限管理',
    menuType: 'DIR',
    status: 'ENABLED',
    children: [
      {
        menuId: 2,
        parentId: 1,
        menuCode: 'iam_staff',
        menuKey: 'iam_staff',
        menuName: '员工管理',
        menuType: 'MENU',
        routePath: '/dashboard/iam/staff',
        status: 'ENABLED',
        createBy: 100,
        createTime: '2026-07-10T08:00:00Z',
        updateBy: 101,
        updateTime: '2026-07-10T09:00:00Z',
        children: [
          {
            menuId: 3,
            parentId: 2,
            menuCode: 'iam_staff_create',
            menuKey: 'iam_staff_create',
            menuName: '新增员工',
            menuType: 'BUTTON',
            permissionCode: 'iam:staff:create',
            status: 'ENABLED',
            sortOrder: 10
          }
        ]
      },
      {
        menuId: 4,
        parentId: 1,
        menuCode: 'iam_role',
        menuKey: 'iam_role',
        menuName: '角色管理',
        menuType: 'MENU',
        routePath: '/dashboard/iam/role',
        status: 'ENABLED',
        children: []
      }
    ]
  }
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('MenuManagementPage', () => {
  beforeEach(() => {
    serviceMocks.iamMenuTree.mockResolvedValue(MENU_TREE);
    serviceMocks.iamMenuCreate.mockResolvedValue(undefined);
    serviceMocks.iamMenuUpdate.mockResolvedValue(undefined);
    serviceMocks.iamMenuDelete.mockResolvedValue(undefined);
    serviceMocks.iamMenuStatusUpdate.mockResolvedValue(undefined);
    iamQueryMocks.getIamMeQueryOptions.mockReturnValue(
      queryOptions({
        queryKey: ['iam', 'me'],
        queryFn: async () => ({ permissions: ['iam:menu:manage'] })
      })
    );
  });

  afterEach(() => {
    cleanup();
  });

  it('在左侧只展示目录和菜单，并在选中菜单后联动详情与按钮权限表', async () => {
    const user = userEvent.setup();
    render(<MenuManagementPage />, { wrapper: createWrapper() });

    const tree = await screen.findByRole('list', { name: '菜单树' });
    expect(await within(tree).findByText('权限管理')).toBeInTheDocument();
    expect(within(tree).getByText('员工管理')).toBeInTheDocument();
    expect(within(tree).queryByText('新增员工')).not.toBeInTheDocument();
    expect(within(tree).queryByText('目录')).not.toBeInTheDocument();
    expect(within(tree).queryByText('菜单')).not.toBeInTheDocument();

    const details = screen.getByRole('region', { name: '菜单详情' });
    expect(within(details).getByText('权限管理')).toBeInTheDocument();
    expect(within(details).getByText('目录')).toBeInTheDocument();
    expect(within(details).queryByText('目录节点')).not.toBeInTheDocument();
    expect(screen.getByText('请选择页面菜单')).toBeInTheDocument();

    await user.click(await within(tree).findByRole('button', { name: '选择 员工管理' }));

    await waitFor(() => {
      expect(within(details).getByText('/dashboard/iam/staff')).toBeInTheDocument();
    });
    expect(screen.getByText('iam_staff_create')).toBeInTheDocument();
    expect(screen.getByText('iam:staff:create')).toBeInTheDocument();

    await user.click(within(tree).getByRole('button', { name: '选择 角色管理' }));

    await waitFor(() => {
      expect(within(details).getByText('/dashboard/iam/role')).toBeInTheDocument();
    });
    expect(screen.getByText('当前菜单暂无按钮权限')).toBeInTheDocument();
    expect(screen.queryByText('iam:staff:create')).not.toBeInTheDocument();
  });

  it('选中菜单使用 Sidebar active 背景及配套前景色', async () => {
    render(<MenuManagementPage />, { wrapper: createWrapper() });

    const tree = await screen.findByRole('list', { name: '菜单树' });
    const selectedMenu = await within(tree).findByRole('button', { name: '选择 权限管理' });
    const unselectedMenu = within(tree).getByRole('button', { name: '选择 员工管理' });

    expect(selectedMenu).toHaveClass('bg-sidebar-accent', 'text-sidebar-accent-foreground');
    expect(selectedMenu).not.toHaveClass('bg-primary');
    expect(selectedMenu).not.toHaveClass('bg-secondary');
    expect(selectedMenu).not.toHaveClass('bg-accent');
    expect(within(selectedMenu).getByText('iam')).toHaveClass('text-sidebar-accent-foreground');
    expect(within(unselectedMenu).getByText('iam_staff')).toHaveClass('text-muted-foreground');
  });

  it('在前端本地筛选完整菜单树，按钮权限命中时保留所属菜单祖先链', async () => {
    const user = userEvent.setup();
    render(<MenuManagementPage />, { wrapper: createWrapper() });

    const tree = await screen.findByRole('list', { name: '菜单树' });
    await within(tree).findByText('员工管理');
    await user.type(screen.getByPlaceholderText('搜索菜单名称 / 编码 / 权限'), 'iam:staff:create');

    await waitFor(() => {
      expect(within(tree).getByText('权限管理')).toBeInTheDocument();
      expect(within(tree).getByText('员工管理')).toBeInTheDocument();
      expect(within(tree).queryByText('角色管理')).not.toBeInTheDocument();
      expect(within(tree).queryByText('新增员工')).not.toBeInTheDocument();
    });
    expect(serviceMocks.iamMenuTree).toHaveBeenCalledTimes(1);
    expect(serviceMocks.iamMenuTree).toHaveBeenCalledWith({}, expect.anything());
  });

  it('搜索时忽略旧的折叠状态并自动展示命中节点', async () => {
    const user = userEvent.setup();
    render(<MenuManagementPage />, { wrapper: createWrapper() });

    const tree = await screen.findByRole('list', { name: '菜单树' });
    await within(tree).findByText('员工管理');
    await user.click(within(tree).getByRole('button', { name: '折叠 权限管理' }));
    expect(within(tree).queryByText('员工管理')).not.toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: '搜索菜单树' }), 'iam:staff:create');

    await waitFor(() => {
      expect(within(tree).getByText('员工管理')).toBeInTheDocument();
    });
    expect(within(tree).getByRole('button', { name: '折叠 权限管理' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('使用一个按钮切换菜单树的全部展开和折叠状态', async () => {
    const user = userEvent.setup();
    render(<MenuManagementPage />, { wrapper: createWrapper() });

    const tree = await screen.findByRole('list', { name: '菜单树' });
    await within(tree).findByText('员工管理');
    const toolbar = screen.getByRole('toolbar', { name: '菜单树操作' });

    expect(within(toolbar).getByRole('button', { name: '折叠全部菜单' })).toBeEnabled();
    expect(within(toolbar).queryByRole('button', { name: '展开全部菜单' })).not.toBeInTheDocument();

    await user.click(within(toolbar).getByRole('button', { name: '折叠全部菜单' }));

    expect(within(tree).queryByText('员工管理')).not.toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: '展开全部菜单' })).toBeEnabled();

    await user.click(within(toolbar).getByRole('button', { name: '展开全部菜单' }));

    expect(within(tree).getByText('员工管理')).toBeInTheDocument();
  });

  it('详情展示上级菜单名称、单一菜单编码及合并后的审计信息', async () => {
    const user = userEvent.setup();
    render(<MenuManagementPage />, { wrapper: createWrapper() });

    const tree = await screen.findByRole('list', { name: '菜单树' });
    await within(tree).findByText('员工管理');
    await user.click(within(tree).getByRole('button', { name: '选择 员工管理' }));

    const details = screen.getByRole('region', { name: '菜单详情' });
    await waitFor(() => {
      expect(within(details).getByText('上级菜单')).toBeInTheDocument();
    });
    expect(within(details).getByText('权限管理')).toBeInTheDocument();
    expect(within(details).queryByText('上级 ID')).not.toBeInTheDocument();
    expect(within(details).getByText('菜单编码')).toBeInTheDocument();
    expect(within(details).queryByText('菜单键')).not.toBeInTheDocument();
    expect(within(details).queryByText('图标')).not.toBeInTheDocument();
    expect(within(details).getByText('创建信息')).toBeInTheDocument();
    expect(within(details).getByText('更新信息')).toBeInTheDocument();
    expect(within(details).getByText('100')).toBeInTheDocument();
    expect(within(details).getByText('101')).toBeInTheDocument();
  });

  it('左侧菜单树不展示页面缓存操作', async () => {
    render(<MenuManagementPage />, { wrapper: createWrapper() });

    const tree = await screen.findByRole('list', { name: '菜单树' });
    await within(tree).findByText('员工管理');
    const toolbar = screen.getByRole('toolbar', { name: '菜单树操作' });
    expect(within(toolbar).queryByRole('button', { name: '开启页面缓存' })).not.toBeInTheDocument();
  });

  it('从菜单详情仅为当前页面开启缓存', async () => {
    const user = userEvent.setup();
    render(<MenuManagementPage />, { wrapper: createWrapper() });

    const tree = await screen.findByRole('list', { name: '菜单树' });
    await user.click(await within(tree).findByRole('button', { name: '选择 员工管理' }));
    const details = screen.getByRole('region', { name: '菜单详情' });
    await user.click(within(details).getByRole('button', { name: '开启页面缓存' }));

    expect(screen.getByText('将为 1 个页面菜单开启页面缓存。')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '开启' }));

    await waitFor(() => {
      expect(serviceMocks.iamMenuUpdate).toHaveBeenCalledTimes(1);
    });
    expect(serviceMocks.iamMenuUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ menuId: 2, menuType: 'MENU', cached: true })
    );
  });

  it('菜单详情操作只展示图标，并在 hover 时展示操作名称', async () => {
    const user = userEvent.setup();
    render(<MenuManagementPage />, { wrapper: createWrapper() });

    const tree = await screen.findByRole('list', { name: '菜单树' });
    await user.click(await within(tree).findByRole('button', { name: '选择 员工管理' }));
    const details = screen.getByRole('region', { name: '菜单详情' });
    const labels = ['新增下级菜单', '开启页面缓存', '编辑菜单', '切换菜单状态', '删除菜单'];

    for (const label of labels) {
      const button = within(details).getByRole('button', { name: label });
      expect(button.textContent).toBe('');
      await user.hover(button);
      expect(await screen.findByRole('tooltip', { name: label })).toBeInTheDocument();
      await user.unhover(button);
    }
  });

  it('从所选菜单的按钮权限表新增时预设 BUTTON 类型和上级菜单', async () => {
    const user = userEvent.setup();
    render(<MenuManagementPage />, { wrapper: createWrapper() });

    const tree = await screen.findByRole('list', { name: '菜单树' });
    await within(tree).findByText('员工管理');
    await user.click(within(tree).getByRole('button', { name: '选择 员工管理' }));
    await user.click(screen.getByRole('button', { name: /新增按钮权限/ }));

    expect(await screen.findByRole('heading', { name: '新增按钮权限' })).toBeInTheDocument();
    expect(screen.getByText('上级菜单：员工管理')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '上级菜单' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '类型' })).toBeDisabled();

    await user.type(screen.getByLabelText('菜单编码'), 'iam_staff_export');
    await user.type(screen.getByLabelText('菜单名称'), '导出员工');
    await user.type(screen.getByLabelText('权限标识'), 'iam:staff:export');
    expect(screen.queryByLabelText('图标')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '创建按钮权限' }));

    await waitFor(() => {
      expect(serviceMocks.iamMenuCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 2,
          menuType: 'BUTTON',
          menuCode: 'iam_staff_export',
          cached: true,
          permissionCode: 'iam:staff:export'
        })
      );
    });
  });

  it('无菜单管理权限时隐藏所有写操作入口', async () => {
    const user = userEvent.setup();
    iamQueryMocks.getIamMeQueryOptions.mockReturnValue(
      queryOptions({
        queryKey: ['iam', 'me'],
        queryFn: async () => ({ permissions: [] })
      })
    );
    render(<MenuManagementPage />, { wrapper: createWrapper() });

    const tree = await screen.findByRole('list', { name: '菜单树' });
    expect(
      within(tree).queryByRole('button', { name: '新增根目录或菜单' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '编辑菜单' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '切换菜单状态' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除菜单' })).not.toBeInTheDocument();

    await user.click(await within(tree).findByRole('button', { name: '选择 员工管理' }));

    await waitFor(() => {
      expect(screen.getByText('iam:staff:create')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /新增按钮权限/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '编辑按钮权限' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '切换按钮权限状态' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除按钮权限' })).not.toBeInTheDocument();
  });
});
