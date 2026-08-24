import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DeptRspDTO } from '@/lib/api/clients/service';

import { OrganizationTreeCard } from './staff-management-page';

const DEPARTMENTS: DeptRspDTO[] = [
  {
    deptId: 1,
    deptCode: 'RD',
    deptName: '研发部'
  }
];

describe('OrganizationTreeCard', () => {
  afterEach(cleanup);

  it('adds a child department under the selected department', async () => {
    const user = userEvent.setup();
    const onAddDepartment = vi.fn();

    render(
      <OrganizationTreeCard
        departments={DEPARTMENTS}
        selectedDepartment={DEPARTMENTS[0] ?? null}
        selectedDepartmentId={1}
        canManageDept
        isCreatingDept={false}
        onDepartmentChange={vi.fn()}
        onAddDepartment={onAddDepartment}
      />
    );

    await user.click(screen.getByRole('button', { name: '新增下级部门' }));

    expect(onAddDepartment).toHaveBeenCalledWith(DEPARTMENTS[0]);
  });

  it('adds a root department when no department is selected', async () => {
    const user = userEvent.setup();
    const onAddDepartment = vi.fn();

    render(
      <OrganizationTreeCard
        departments={DEPARTMENTS}
        selectedDepartment={null}
        selectedDepartmentId={null}
        canManageDept
        isCreatingDept={false}
        onDepartmentChange={vi.fn()}
        onAddDepartment={onAddDepartment}
      />
    );

    await user.click(screen.getByRole('button', { name: '新增部门' }));

    expect(onAddDepartment).toHaveBeenCalledWith(null);
  });
});
