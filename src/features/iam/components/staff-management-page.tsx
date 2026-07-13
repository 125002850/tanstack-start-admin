import * as React from 'react';
import type { ApiClientError } from '@oig/react-query-generator/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/table/core/data-table';
import { DataTableSkeleton } from '@/components/ui/table/feedback/data-table-skeleton';
import { DataTableToolbar } from '@/components/ui/table/toolbar/data-table-toolbar';
import type { DataTableAction } from '@/components/ui/table/actions/data-table-actions-bar';
import type { DataTableRowAction } from '@/components/ui/table/actions/data-table-row-action';
import {
  createDataTableColumnDsl,
  dataTableTextCell
} from '@/components/ui/table/columns/data-table-column-factory';
import { auditColumns } from '@/components/ui/table/columns/data-table-audit-columns';
import { useDslDataTable } from '@/hooks/use-dsl-data-table';
import type { DataTableDslPageRequestBase } from '@/hooks/use-dsl-data-table.dsl';
import { IAM_QUERY_KEYS } from '@/lib/api/iam/constants';
import { getIamMeQueryOptions } from '@/lib/api/iam/queries';
import { hasIamPermission } from '@/lib/api/iam/permissions';
import {
  iamStaffCreate,
  iamStaffDelete,
  iamStaffPageQueryOptions,
  iamStaffPageQueryKey,
  iamStaffPasswordReset,
  iamStaffRolesAssign,
  iamStaffStatusUpdate,
  iamStaffUpdate,
  type IamStaffPageRequest,
  type IamStaffPageResponse,
  type StaffCreateReqDTO,
  type StaffRspDTO,
  type StaffUpdateReqDTO
} from '@/lib/api/clients/service';
import { nullableText } from '@/lib/display-formatters';
import { iamDeptTreeQueryOptions, iamRoleOptionsQueryOptions } from '../api/query-options';
import { ENABLE_STATUS_OPTIONS, IAM_PERMISSIONS } from '../lib/constants';
import { nextStatus, StatusBadge } from '../lib/format';
import { deptMultiSelectOptions, deptSelectOptions } from '../lib/tree';
import { resolveStaffOperationAccess } from '../lib/staff-operation-access';
import {
  dslConditionNumbers,
  dslConditionValue,
  dslConditionValues,
  pageRequestFromDsl
} from '../lib/table';

import StaffFormSheet, { roleOptions } from './staff-form-sheet';
import AssignRolesSheet from './assign-roles-sheet';
import ResetPasswordSheet from './reset-password-sheet';
import StaffDetailSheet from './staff-detail-sheet';

const TABLE_ID = 'iam-staff-list';
const STAFF_LIST_QUERY_KEY = ['service', 'iam-staff'] as const;

const columnDsl = createDataTableColumnDsl<StaffRspDTO>();

function invalidateStaffQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: STAFF_LIST_QUERY_KEY, exact: false }),
    queryClient.invalidateQueries({ queryKey: IAM_QUERY_KEYS.me, exact: false })
  ]);
}

export function staffTableQueryOptions(request: DataTableDslPageRequestBase) {
  const condition = request.condition;
  const keyword = dslConditionValue(condition, 'phone');

  return iamStaffPageQueryOptions({
    ...pageRequestFromDsl(request),
    keyword,
    deptIds: dslConditionNumbers(condition, 'deptId'),
    statuses: dslConditionValues(condition, 'status') as IamStaffPageRequest['statuses'],
    staffCode: dslConditionValue(condition, 'staffCode'),
    username: dslConditionValue(condition, 'username'),
    staffName: dslConditionValue(condition, 'staffName')
  });
}

function getColumns(
  onOpenDetail: (staff: StaffRspDTO) => void,
  departmentOptions: ReturnType<typeof deptMultiSelectOptions>
): Array<ColumnDef<StaffRspDTO>> {
  return [
    columnDsl.field('staffCode', '工号', {
      size: 130,
      filter: 'text',
      filterPlaceholder: '搜索工号'
    }),
    columnDsl.field('username', '用户名', {
      size: 'md',
      filter: 'text',
      filterPlaceholder: '搜索用户名'
    }),
    columnDsl.field('staffName', '姓名', {
      size: 'md',
      filter: 'text',
      filterPlaceholder: '搜索姓名',
      enableSorting: true,
      renderCell: ({ row }) => (
        <Button
          type='button'
          variant='link'
          className='h-auto max-w-[150px] justify-start truncate p-0 font-medium'
          onClick={() => onOpenDetail(row.original)}
        >
          {nullableText(row.original.staffName)}
        </Button>
      )
    }),
    columnDsl.custom({
      id: 'deptId',
      title: '部门',
      accessorFn: (row) => row.deptName,
      size: 160,
      filter: 'multiSelect',
      filterOptions: departmentOptions,
      enableSorting: false,
      cell: ({ row }) => dataTableTextCell(row.original.deptName, 'max-w-[160px]')
    }),
    columnDsl.field('phone', '手机号', {
      size: 140,
      filter: 'text',
      filterPlaceholder: '搜索手机号'
    }),
    columnDsl.field('status', '状态', {
      size: 'sm',
      filter: 'multiSelect',
      filterOptions: [...ENABLE_STATUS_OPTIONS],
      enableSorting: false,
      renderCell: ({ row }) => <StatusBadge status={row.original.status} />
    }),
    columnDsl.field('roles', '角色', {
      size: 'xl',
      enableSorting: false,
      filter: false,
      renderCell: ({ row }) => {
        const roles = row.original.roles ?? [];
        if (!roles.length) return <span className='text-muted-foreground'>-</span>;
        return (
          <div className='flex max-w-[220px] flex-wrap gap-1'>
            {roles.slice(0, 3).map((role) => (
              <Badge key={role.roleId ?? role.roleCode} variant='outline'>
                {role.roleName ?? role.roleCode}
              </Badge>
            ))}
            {roles.length > 3 && <Badge variant='secondary'>+{roles.length - 3}</Badge>}
          </div>
        );
      }
    }),
    columnDsl.field('mustChangePassword', '改密', {
      size: 'xs',
      filter: false,
      enableSorting: true,
      renderCell: ({ row }) => (row.original.mustChangePassword ? '是' : '否')
    }),
    ...auditColumns<StaffRspDTO>()
  ];
}

export default function StaffManagementPage() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery(getIamMeQueryOptions());
  const deptQuery = useQuery(iamDeptTreeQueryOptions());
  const roleQuery = useQuery(iamRoleOptionsQueryOptions());
  const departments = React.useMemo(() => deptSelectOptions(deptQuery.data ?? [], { enabledOnly: true }), [deptQuery.data]);
  const departmentFilterOptions = React.useMemo(
    () => deptMultiSelectOptions(deptQuery.data ?? []),
    [deptQuery.data]
  );
  const roles = React.useMemo(() => roleOptions(roleQuery.data ?? []), [roleQuery.data]);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingStaff, setEditingStaff] = React.useState<StaffRspDTO | null>(null);
  const [detailStaff, setDetailStaff] = React.useState<StaffRspDTO | null>(null);
  const [rolesStaff, setRolesStaff] = React.useState<StaffRspDTO | null>(null);
  const [resetStaff, setResetStaff] = React.useState<StaffRspDTO | null>(null);

  const columns = React.useMemo(
    () => getColumns(setDetailStaff, departmentFilterOptions),
    [departmentFilterOptions]
  );

  const createMutation = useMutation({
    mutationFn: (request: StaffCreateReqDTO) => iamStaffCreate(request),
    onSuccess: async () => {
      await invalidateStaffQueries(queryClient);
      toast.success('员工已创建');
    }
  });
  const updateMutation = useMutation({
    mutationFn: (request: StaffUpdateReqDTO) => iamStaffUpdate(request),
    onSuccess: async () => {
      await invalidateStaffQueries(queryClient);
      toast.success('员工已更新');
    }
  });
  const deleteMutation = useMutation({
    mutationFn: (request: Parameters<typeof iamStaffDelete>[0]) => iamStaffDelete(request),
    onSuccess: async () => {
      await invalidateStaffQueries(queryClient);
      toast.success('员工已删除');
    }
  });
  const statusMutation = useMutation({
    mutationFn: (request: Parameters<typeof iamStaffStatusUpdate>[0]) =>
      iamStaffStatusUpdate(request),
    onSuccess: async () => {
      await invalidateStaffQueries(queryClient);
      toast.success('员工状态已更新');
    }
  });
  const assignRolesMutation = useMutation({
    mutationFn: (request: Parameters<typeof iamStaffRolesAssign>[0]) =>
      iamStaffRolesAssign(request),
    onSuccess: async () => {
      await invalidateStaffQueries(queryClient);
      toast.success('角色已分配');
    }
  });
  const resetPasswordMutation = useMutation({
    mutationFn: (request: Parameters<typeof iamStaffPasswordReset>[0]) =>
      iamStaffPasswordReset(request),
    onSuccess: async () => {
      await invalidateStaffQueries(queryClient);
      toast.success('密码已重置');
    }
  });

  const canCreate = hasIamPermission(me, IAM_PERMISSIONS.staff.create);
  const canUpdate = hasIamPermission(me, IAM_PERMISSIONS.staff.update);
  const canDelete = hasIamPermission(me, IAM_PERMISSIONS.staff.delete);
  const canResetPassword = hasIamPermission(me, IAM_PERMISSIONS.staff.resetPassword);
  const getStaffOperationAccess = React.useCallback(
    (staff: StaffRspDTO) =>
      resolveStaffOperationAccess(staff, {
        canUpdate,
        canDelete,
        canResetPassword,
        currentStaffId: me?.staff.staffId
      }),
    [canDelete, canResetPassword, canUpdate, me?.staff.staffId]
  );

  const rowActions = React.useMemo<DataTableRowAction<StaffRspDTO>[]>(
    () => [
      {
        label: '编辑',
        icon: <Icons.edit className='size-4' />,
        hidden: (staff) => !getStaffOperationAccess(staff).canEdit,
        onClick: (staff) => {
          if (!getStaffOperationAccess(staff).canEdit) return;
          setEditingStaff(staff);
          setFormOpen(true);
        }
      },
      {
        label: '角色',
        icon: <Icons.userShare className='size-4' />,
        hidden: (staff) => !getStaffOperationAccess(staff).canAssignRoles,
        onClick: (staff) => {
          if (!getStaffOperationAccess(staff).canAssignRoles) return;
          setRolesStaff(staff);
        }
      },
      {
        label: '状态',
        icon: <Icons.rotate className='size-4' />,
        hidden: (staff) => !getStaffOperationAccess(staff).canUpdateStatus,
        confirmDelete: {
          title: '确认切换员工状态',
          description: (staff) =>
            `确认将 ${staff.staffName ?? staff.username ?? '该员工'} ${staff.status === 'ENABLED' ? '停用' : '启用'}？`,
          confirmText: '确认',
          cancelText: '取消'
        },
        onClick: async (staff) => {
          if (!getStaffOperationAccess(staff).canUpdateStatus || staff.staffId == null) return;
          await statusMutation.mutateAsync({
            staffId: staff.staffId,
            status: nextStatus(staff.status)
          });
        }
      },
      {
        label: '重置密码',
        icon: <Icons.lock className='size-4' />,
        hidden: (staff) => !getStaffOperationAccess(staff).canResetPassword,
        onClick: (staff) => {
          if (!getStaffOperationAccess(staff).canResetPassword) return;
          setResetStaff(staff);
        }
      },
      {
        label: '删除',
        icon: <Icons.trash className='size-4' />,
        hidden: (staff) => !getStaffOperationAccess(staff).canDelete,
        confirmDelete: {
          title: '确认删除员工',
          description: (staff) => `删除后 ${staff.staffName ?? staff.username ?? '该员工'} 将无法登录。`,
          confirmText: '确认删除',
          cancelText: '取消'
        },
        onClick: async (staff) => {
          if (!getStaffOperationAccess(staff).canDelete || staff.staffId == null) return;
          await deleteMutation.mutateAsync({ staffId: staff.staffId });
        }
      }
    ],
    [deleteMutation, getStaffOperationAccess, statusMutation]
  );

  const tableActions = React.useMemo<DataTableAction<StaffRspDTO>[]>(
    () => [
      {
        label: '新增员工',
        icon: <Icons.add className='size-3.5' />,
        hidden: !canCreate,
        callback: () => {
          setEditingStaff(null);
          setFormOpen(true);
        }
      }
    ],
    [canCreate]
  );

  const { table, total, queryState, refreshProps } = useDslDataTable<
    StaffRspDTO,
    DataTableDslPageRequestBase,
    IamStaffPageResponse,
    ApiClientError,
    ReturnType<typeof iamStaffPageQueryKey>
  >({
    tableId: TABLE_ID,
    columns,
    queryOptions: staffTableQueryOptions,
    rowActions,
    rowId: 'staffId',
    showSelectColumn: false,
    refreshBehavior: {
      onSuccess: () => {
        toast.success('员工列表已刷新');
      }
    }
  });

  return (
    <>
      <Card>
        <CardContent className='px-0'>
          {queryState.isFetching && !queryState.data ? (
            <DataTableSkeleton columnCount={8} filterCount={5} />
          ) : (
            <DataTable
              table={table}
              statusTotalCount={total}
              tableActions={tableActions}
              isLoading={queryState.isFetching}
              onRefresh={refreshProps?.onRefresh}
              isRefreshing={refreshProps?.isRefreshing}
            >
              <DataTableToolbar table={table} isQuerying={queryState.isFetching} />
            </DataTable>
          )}
        </CardContent>
      </Card>

      <StaffFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        staff={editingStaff}
        departments={departments}
        roles={roles}
        onSubmit={async (payload) => {
          if ('username' in payload) {
            await createMutation.mutateAsync(payload);
          } else {
            if (!editingStaff?.staffId || !getStaffOperationAccess(editingStaff).canEdit) return;
            await updateMutation.mutateAsync(payload);
          }
        }}
      />
      <AssignRolesSheet
        open={!!rolesStaff}
        onOpenChange={(open) => !open && setRolesStaff(null)}
        staff={rolesStaff}
        roles={roles}
        onSubmit={async (roleIds) => {
          if (!rolesStaff?.staffId || !getStaffOperationAccess(rolesStaff).canAssignRoles) return;
          await assignRolesMutation.mutateAsync({ staffId: rolesStaff.staffId, roleIds });
        }}
      />
      <ResetPasswordSheet
        open={!!resetStaff}
        onOpenChange={(open) => !open && setResetStaff(null)}
        staff={resetStaff}
        onSubmit={async (newPassword) => {
          if (!resetStaff?.staffId || !getStaffOperationAccess(resetStaff).canResetPassword) return;
          await resetPasswordMutation.mutateAsync({ staffId: resetStaff.staffId, newPassword });
        }}
      />
      <StaffDetailSheet
        open={!!detailStaff}
        onOpenChange={(open) => !open && setDetailStaff(null)}
        staff={detailStaff}
      />
    </>
  );
}
