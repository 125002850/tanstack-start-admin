import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MenuRspDTO } from '@/lib/api/clients/service';

import MenuFormSheet from './menu-form-sheet';

const PARENT_MENU: MenuRspDTO = {
  menuId: 2,
  menuCode: 'iam_staff',
  menuName: '员工管理',
  menuType: 'MENU',
  status: 'ENABLED'
};

describe('MenuFormSheet', () => {
  afterEach(cleanup);

  function selectMenuType(menuType: 'MENU' | 'BUTTON') {
    const trigger = screen.getByRole('combobox', { name: '类型' });
    const nativeSelect = trigger.parentElement?.querySelector('select');

    expect(nativeSelect).not.toBeNull();
    fireEvent.change(nativeSelect!, { target: { value: menuType } });
  }

  it('编辑按钮权限时隐藏页面字段并不提交遗留值', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const button: MenuRspDTO = {
      menuId: 3,
      parentId: 2,
      menuCode: 'iam_staff_export',
      menuName: '导出员工',
      menuType: 'BUTTON',
      routePath: '/stale-route',
      componentPath: 'stale/component',
      cached: true,
      permissionCode: 'iam:staff:export',
      status: 'ENABLED'
    };

    render(
      <MenuFormSheet
        open
        onOpenChange={vi.fn()}
        menu={button}
        tree={[PARENT_MENU, button]}
        onSubmit={onSubmit}
      />
    );

    expect(screen.queryByLabelText('路由路径')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('组件路径')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('页面缓存')).not.toBeInTheDocument();
    expect(screen.getByLabelText('隐藏')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存修改' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        menuId: 3,
        menuType: 'BUTTON',
        routePath: undefined,
        componentPath: undefined,
        cached: false
      })
    );
  });

  it('编辑时切换为按钮会清空页面字段和缓存状态', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const menu: MenuRspDTO = {
      menuId: 4,
      parentId: 2,
      menuCode: 'iam_staff_report',
      menuName: '员工报表',
      menuType: 'MENU',
      routePath: '/dashboard/iam/staff-report',
      componentPath: 'iam/staff-report',
      cached: true,
      permissionCode: 'iam:staff:report',
      status: 'ENABLED'
    };

    render(
      <MenuFormSheet
        open
        onOpenChange={vi.fn()}
        menu={menu}
        tree={[PARENT_MENU, menu]}
        onSubmit={onSubmit}
      />
    );

    selectMenuType('BUTTON');

    expect(screen.queryByLabelText('路由路径')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('组件路径')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('页面缓存')).not.toBeInTheDocument();

    selectMenuType('MENU');

    expect(screen.getByLabelText('路由路径')).toHaveValue('');
    expect(screen.getByLabelText('组件路径')).toHaveValue('');
    expect(screen.getByLabelText('页面缓存')).not.toBeChecked();

    selectMenuType('BUTTON');
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        menuId: 4,
        menuType: 'BUTTON',
        routePath: undefined,
        componentPath: undefined,
        cached: false
      })
    );
  });
});
