import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DeptRspDTO, RoleRspDTO } from '@/lib/api/clients/service';

import RoleDataScopeSheet, { dataScopeDeptIds } from './role-data-scope-sheet';

const DEPARTMENTS: DeptRspDTO[] = [
  {
    deptId: 1,
    deptCode: 'HQ',
    deptName: '总部',
    status: 'ENABLED',
    children: [{ deptId: 2, deptCode: 'RD', deptName: '研发部', status: 'ENABLED' }]
  },
  { deptId: 3, deptCode: 'SALES', deptName: '销售部', status: 'ENABLED' }
];

const CUSTOM_DEPT_ROLE: RoleRspDTO = {
  roleId: 100,
  roleName: '研发经理',
  dataScopeType: 'CUSTOM_DEPT',
  dataScopeDeptIds: [2]
};

function renderSheet(onSubmit = vi.fn().mockResolvedValue(undefined), role = CUSTOM_DEPT_ROLE) {
  render(
    <RoleDataScopeSheet
      open
      onOpenChange={vi.fn()}
      role={role}
      departments={DEPARTMENTS}
      onSubmit={onSubmit}
    />
  );
  return onSubmit;
}

describe('RoleDataScopeSheet', () => {
  afterEach(cleanup);

  it('以角色详情回填部门树，并仅提交用户勾选的精确部门', async () => {
    const user = userEvent.setup();
    const onSubmit = renderSheet();

    expect(screen.getByText('仅授权勾选的精确部门，不自动包含子部门。')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '选择 研发部' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '选择 总部' })).not.toBeChecked();

    await user.click(screen.getByRole('checkbox', { name: '选择 总部' }));
    await user.click(screen.getByRole('button', { name: '保存数据权限' }));

    expect(onSubmit).toHaveBeenCalledWith({
      dataScopeType: 'CUSTOM_DEPT',
      deptIds: [2, 1]
    });
  });

  it('非自定义范围不渲染部门树，且不会提交遗留部门', async () => {
    const user = userEvent.setup();
    const onSubmit = renderSheet(vi.fn().mockResolvedValue(undefined), {
      roleId: 100,
      roleName: '研发经理',
      dataScopeType: 'SELF',
      dataScopeDeptIds: [1, 2]
    });

    expect(screen.queryByRole('tree', { name: '自定义部门' })).not.toBeInTheDocument();
    expect(dataScopeDeptIds('SELF', ['1', '2'])).toEqual([]);
    await user.click(screen.getByRole('button', { name: '保存数据权限' }));
    expect(onSubmit).toHaveBeenCalledWith({ dataScopeType: 'SELF', deptIds: [] });
  });

  it('空自定义部门需要确认后才保存，并提交空数组', async () => {
    const user = userEvent.setup();
    const onSubmit = renderSheet(vi.fn().mockResolvedValue(undefined), {
      roleId: 100,
      roleName: '研发经理',
      dataScopeType: 'CUSTOM_DEPT',
      dataScopeDeptIds: []
    });

    await user.click(screen.getByRole('button', { name: '保存数据权限' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText('未选择部门时，该角色不会获得任何部门数据权限。')
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '确认保存' }));

    expect(onSubmit).toHaveBeenCalledWith({ dataScopeType: 'CUSTOM_DEPT', deptIds: [] });
  });
});
