import { describe, expect, it } from 'vitest';

import type { StaffRspDTO } from '@/lib/api/clients/service';

import { resolveStaffOperationAccess } from './staff-operation-access';

const superAdmin: StaffRspDTO = {
  staffId: 1,
  roles: [{ roleCode: 'SUPER_ADMIN' }]
};

const regularStaff: StaffRspDTO = {
  staffId: 2,
  roles: [{ roleCode: 'STAFF' }]
};

const allCapabilities = {
  canUpdate: true,
  canDelete: true,
  canResetPassword: true,
  currentStaffId: 1
};

describe('resolveStaffOperationAccess', () => {
  it('blocks all mutable super-admin operations except self password reset', () => {
    expect(resolveStaffOperationAccess(superAdmin, allCapabilities)).toEqual({
      canEdit: false,
      canAssignRoles: false,
      canUpdateStatus: false,
      canResetPassword: true,
      canDelete: false
    });
  });

  it('blocks resetting another super-admin password', () => {
    expect(
      resolveStaffOperationAccess(superAdmin, { ...allCapabilities, currentStaffId: '99' })
    ).toMatchObject({ canResetPassword: false });
  });

  it('keeps permitted operations available for ordinary employees', () => {
    expect(resolveStaffOperationAccess(regularStaff, allCapabilities)).toEqual({
      canEdit: true,
      canAssignRoles: true,
      canUpdateStatus: true,
      canResetPassword: true,
      canDelete: true
    });
  });
});
