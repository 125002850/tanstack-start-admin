import type { StaffRspDTO } from '@/lib/api/clients/service';
import { isIamSuperAdmin } from '@/lib/api/iam/permissions';

type StaffOperationCapabilities = {
  canUpdate: boolean;
  canDelete: boolean;
  canResetPassword: boolean;
  currentStaffId?: number | string;
};

export function resolveStaffOperationAccess(
  staff: StaffRspDTO,
  { canUpdate, canDelete, canResetPassword, currentStaffId }: StaffOperationCapabilities
) {
  const isSuperAdmin = isIamSuperAdmin(staff);
  const isSelf =
    staff.staffId != null &&
    currentStaffId != null &&
    String(staff.staffId) === String(currentStaffId);

  return {
    canEdit: canUpdate && !isSuperAdmin,
    canAssignRoles: canUpdate && !isSuperAdmin,
    canUpdateStatus: canUpdate && !isSuperAdmin,
    canResetPassword: canResetPassword && (!isSuperAdmin || isSelf),
    canDelete: canDelete && !isSuperAdmin
  };
}
