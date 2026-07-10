import { describe, expect, it } from 'vitest';

import type { RoleRspDTO, StaffRspDTO } from '@/lib/api/clients/service';

import { roleOptions, selectedRoleIds } from './staff-form-sheet';

describe('staff role options', () => {
  it('never exposes the built-in super administrator as an assignable role', () => {
    const roles: RoleRspDTO[] = [
      { roleId: 1, roleCode: 'SUPER_ADMIN', roleName: '超级管理员', systemBuiltIn: true },
      { roleId: 2, roleCode: 'STAFF', roleName: '普通员工' }
    ];

    expect(roleOptions(roles)).toEqual([{ value: '2', label: '普通员工', disabled: false }]);
  });

  it('drops a legacy super-admin assignment from selected role ids', () => {
    const staff: StaffRspDTO = {
      roles: [
        { roleId: 1, roleCode: 'SUPER_ADMIN' },
        { roleId: 2, roleCode: 'STAFF' }
      ]
    };

    expect(selectedRoleIds(staff)).toEqual(['2']);
  });
});
