import * as React from 'react';
import type { ApiClientError } from '@oig/react-query-generator/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/data-table/core/data-table';
import { DataTableSkeleton } from '@/components/data-table/feedback/data-table-skeleton';
import { DataTableToolbar } from '@/components/data-table/toolbar/data-table-toolbar';
import type { DataTableAction } from '@/components/data-table/actions/data-table-actions-bar';
import type { DataTableRowAction } from '@/components/data-table/actions/data-table-row-action';
import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';
import { auditColumns } from '@/components/data-table/columns/data-table-audit-columns';
import { useDslDataTable } from '@/hooks/use-dsl-data-table';
import type { DataTableDslPageRequestBase } from '@/hooks/use-dsl-data-table.dsl';
import type {
  DataTableCellChange,
  DataTableChoiceOption,
  DataTableEditChangeEvent,
  DataTableEditingController,
  DataTableServerCellError
} from '@/types/data-table';
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
  type StaffRolesAssignReqDTO,
  type StaffRspDTO,
  type StaffStatusUpdateReqDTO,
  type StaffUpdateReqDTO
} from '@/lib/api/clients/service';
import { nullableText } from '@/lib/display-formatters';
import { iamDeptTreeQueryOptions, iamRoleOptionsQueryOptions } from '../api/query-options';
import { ENABLE_STATUS_OPTIONS, IAM_PERMISSIONS } from '../lib/constants';
import { deptMultiSelectOptions, deptSelectOptions, flattenDeptTree } from '../lib/tree';
import { resolveStaffOperationAccess } from '../lib/staff-operation-access';
import {
  dslConditionNumbers,
  dslConditionValue,
  dslConditionValues,
  pageRequestFromDsl
} from '../lib/table';

import StaffFormSheet, { roleOptions } from './staff-form-sheet';
import ResetPasswordSheet from './reset-password-sheet';
import StaffDetailSheet from './staff-detail-sheet';

const TABLE_ID = 'iam-staff-list';
const STAFF_LIST_QUERY_KEY = ['service', 'iam-staff'] as const;

type StaffStatus = (typeof ENABLE_STATUS_OPTIONS)[number]['value'];

export type StaffTableRow = Omit<StaffRspDTO, 'deptId' | 'status'> & {
  deptId: number | null;
  status: StaffStatus | null;
  roleIds: number[];
};

export type StaffCellEditRequest =
  | { kind: 'staff'; request: StaffUpdateReqDTO }
  | { kind: 'status'; request: StaffStatusUpdateReqDTO }
  | { kind: 'roles'; request: StaffRolesAssignReqDTO };

const columnDsl = createDataTableColumnDsl<StaffTableRow>();

function isStaffStatus(value: unknown): value is StaffStatus {
  return ENABLE_STATUS_OPTIONS.some((option) => option.value === value);
}

function toStaffTableRow(staff: StaffRspDTO): StaffTableRow {
  return {
    ...staff,
    deptId: staff.deptId ?? null,
    status: isStaffStatus(staff.status) ? staff.status : null,
    roleIds: (staff.roles ?? [])
      .map((role) => role.roleId)
      .filter((roleId): roleId is number => typeof roleId === 'number')
  };
}

function toStaffRspDTO(staff: StaffRspDTO | StaffTableRow): StaffRspDTO {
  if (!('roleIds' in staff)) return staff;
  const { roleIds: _roleIds, ...row } = staff;
  return {
    ...row,
    deptId: row.deptId ?? undefined,
    status: row.status ?? undefined
  };
}

export function mapStaffTableData(data: IamStaffPageResponse | undefined) {
  return {
    total: data?.total ?? 0,
    list: (data?.list ?? []).map(toStaffTableRow)
  };
}

function buildStaffUpdateRequest(row: StaffTableRow, deptId: number): StaffUpdateReqDTO | null {
  const staffId = row.staffId;
  const staffCode = row.staffCode?.trim();
  const staffName = row.staffName?.trim();
  if (staffId == null || !staffCode || !staffName) return null;

  return {
    staffId,
    staffCode,
    staffName,
    deptId,
    phone: row.phone?.trim() || undefined,
    email: row.email?.trim() || undefined,
    avatar: row.avatar?.trim() || undefined,
    status: row.status ?? undefined,
    remark: row.remark?.trim() || undefined
  };
}

export function getStaffCellEditRequest(
  row: StaffTableRow,
  change: DataTableCellChange<StaffTableRow>
): StaffCellEditRequest | null {
  if (row.staffId == null) return null;

  if (change.field === 'deptId') {
    if (typeof change.value !== 'number' || !Number.isFinite(change.value)) return null;
    const request = buildStaffUpdateRequest(row, change.value);
    return request ? { kind: 'staff', request } : null;
  }

  if (change.field === 'phone') {
    if (typeof change.value !== 'string' || typeof row.deptId !== 'number') return null;
    const request = buildStaffUpdateRequest({ ...row, phone: change.value }, row.deptId);
    return request ? { kind: 'staff', request } : null;
  }

  if (change.field === 'status') {
    return isStaffStatus(change.value)
      ? {
          kind: 'status',
          request: { staffId: row.staffId, status: change.value }
        }
      : null;
  }

  if (change.field === 'roleIds') {
    return Array.isArray(change.value) &&
      change.value.every((roleId) => typeof roleId === 'number' && Number.isFinite(roleId))
      ? {
          kind: 'roles',
          request: { staffId: row.staffId, roleIds: change.value }
        }
      : null;
  }

  return null;
}

async function persistStaffCellEdit(request: StaffCellEditRequest) {
  if (request.kind === 'staff') {
    await iamStaffUpdate(request.request);
    return;
  }
  if (request.kind === 'status') {
    await iamStaffStatusUpdate(request.request);
    return;
  }
  await iamStaffRolesAssign(request.request);
}

export function getStaffServerCellErrors(
  changes: readonly DataTableCellChange<StaffTableRow>[],
  results: readonly PromiseSettledResult<unknown>[]
): DataTableServerCellError<StaffTableRow>[] {
  const errors: DataTableServerCellError<StaffTableRow>[] = [];
  results.forEach((result, index) => {
    if (result.status !== 'rejected') return;
    const change = changes[index];
    if (!change) return;
    const message =
      result.reason instanceof Error && result.reason.message.trim()
        ? result.reason.message
        : '员工字段更新失败';
    errors.push({
      rowId: change.rowId,
      field: change.field,
      messages: [message]
    });
  });
  return errors;
}

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

export function getStaffColumns(
  onOpenDetail: (staff: StaffTableRow) => void,
  departmentFilterOptions: ReturnType<typeof deptMultiSelectOptions>,
  departmentEditorOptions: readonly DataTableChoiceOption<number>[],
  roleEditorOptions: readonly DataTableChoiceOption<number>[]
): Array<ColumnDef<StaffTableRow>> {
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
    columnDsl.editableField('deptId', '部门', {
      type: 'select',
      valueOptions: departmentEditorOptions,
      edit: { selectionMode: 'single', allowEmpty: false },
      size: 160,
      filter: 'multiSelect',
      filterOptions: departmentFilterOptions,
      enableSorting: false
    }),
    columnDsl.editableField('phone', '手机号', {
      type: 'text',
      edit: { control: 'input', inputType: 'tel', inputMode: 'tel' },
      size: 140,
      filter: 'text',
      filterPlaceholder: '搜索手机号'
    }),
    columnDsl.editableField('status', '状态', {
      type: 'enum',
      valueOptions: ENABLE_STATUS_OPTIONS,
      edit: {
        control: 'switch',
        checkedValue: 'ENABLED',
        uncheckedValue: 'DISABLED'
      },
      size: 'sm',
      filter: 'multiSelect',
      filterOptions: [...ENABLE_STATUS_OPTIONS],
      enableSorting: false
    }),
    columnDsl.editableField('roleIds', '角色', {
      type: 'select',
      valueOptions: roleEditorOptions,
      edit: { selectionMode: 'multiple' },
      size: 'xl',
      enableSorting: false,
      filter: false
    }),
    columnDsl.field('mustChangePassword', '改密', {
      size: 'xs',
      filter: false,
      enableSorting: true,
      renderCell: ({ row }) => (row.original.mustChangePassword ? '是' : '否')
    }),
    ...auditColumns<StaffTableRow>()
  ];
}

export default function StaffManagementPage() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery(getIamMeQueryOptions());
  const deptQuery = useQuery(iamDeptTreeQueryOptions());
  const roleQuery = useQuery(iamRoleOptionsQueryOptions());
  const departments = React.useMemo(
    () => deptSelectOptions(deptQuery.data ?? [], { enabledOnly: true }),
    [deptQuery.data]
  );
  const departmentFilterOptions = React.useMemo(
    () => deptMultiSelectOptions(deptQuery.data ?? []),
    [deptQuery.data]
  );
  const roles = React.useMemo(() => roleOptions(roleQuery.data ?? []), [roleQuery.data]);
  const departmentEditorOptions = React.useMemo(() => {
    const departmentsById = new Map(
      flattenDeptTree(deptQuery.data ?? [])
        .filter((department) => department.deptId != null)
        .map((department) => [department.deptId!, department])
    );
    return deptSelectOptions(deptQuery.data ?? []).map((department) => {
      const value = Number(department.value);
      return {
        value,
        label: department.label,
        disabled: departmentsById.get(value)?.status !== 'ENABLED'
      };
    });
  }, [deptQuery.data]);
  const roleEditorOptions = React.useMemo(
    () =>
      roles.map((role) => ({
        value: Number(role.value),
        label: role.label,
        disabled: role.disabled
      })),
    [roles]
  );

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingStaff, setEditingStaff] = React.useState<StaffRspDTO | null>(null);
  const [detailStaff, setDetailStaff] = React.useState<StaffRspDTO | null>(null);
  const [resetStaff, setResetStaff] = React.useState<StaffRspDTO | null>(null);

  const columns = React.useMemo(
    () =>
      getStaffColumns(
        (staff) => setDetailStaff(toStaffRspDTO(staff)),
        departmentFilterOptions,
        departmentEditorOptions,
        roleEditorOptions
      ),
    [departmentEditorOptions, departmentFilterOptions, roleEditorOptions]
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
    (staff: StaffRspDTO | StaffTableRow) =>
      resolveStaffOperationAccess(toStaffRspDTO(staff), {
        canUpdate,
        canDelete,
        canResetPassword,
        currentStaffId: me?.staff.staffId
      }),
    [canDelete, canResetPassword, canUpdate, me?.staff.staffId]
  );

  const rowActions = React.useMemo<DataTableRowAction<StaffTableRow>[]>(
    () => [
      {
        label: '编辑资料',
        icon: <Icons.edit className='size-4' />,
        hidden: (staff) => !getStaffOperationAccess(staff).canEdit,
        onClick: (staff) => {
          if (!getStaffOperationAccess(staff).canEdit) return;
          setEditingStaff(toStaffRspDTO(staff));
          setFormOpen(true);
        }
      },
      {
        label: '重置密码',
        icon: <Icons.userKey className='size-4' />,
        hidden: (staff) => !getStaffOperationAccess(staff).canResetPassword,
        onClick: (staff) => {
          if (!getStaffOperationAccess(staff).canResetPassword) return;
          setResetStaff(toStaffRspDTO(staff));
        }
      },
      {
        label: '删除',
        icon: <Icons.trash className='size-4' />,
        hidden: (staff) => !getStaffOperationAccess(staff).canDelete,
        confirmDelete: {
          title: '确认删除员工',
          description: (staff) =>
            `删除后 ${staff.staffName ?? staff.username ?? '该员工'} 将无法登录。`,
          confirmText: '确认删除',
          cancelText: '取消'
        },
        onClick: async (staff) => {
          if (!getStaffOperationAccess(staff).canDelete || staff.staffId == null) return;
          await deleteMutation.mutateAsync({ staffId: staff.staffId });
        }
      }
    ],
    [deleteMutation, getStaffOperationAccess]
  );

  // 新增动作不读取行上下文；保留 API DTO 契约后适配到表格视图模型。
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
  ) as unknown as DataTableAction<StaffTableRow>[];

  const editingControllerRef = React.useRef<DataTableEditingController<StaffTableRow> | null>(null);
  const handleCellEdit = React.useCallback(
    ({ changes, snapshot }: DataTableEditChangeEvent<StaffTableRow>) => {
      const editingController = editingControllerRef.current;
      if (!editingController) return;
      const requestRevision = editingController.getRevision();

      void (async () => {
        const rowsById = new Map(snapshot.rows.map((row) => [String(row.staffId), row] as const));
        const results = await Promise.allSettled(
          changes.map(async (change) => {
            const row = rowsById.get(change.rowId);
            const request = row ? getStaffCellEditRequest(row, change) : null;
            if (!request) throw new Error('员工单元格更新参数不完整');
            await persistStaffCellEdit(request);
            return change;
          })
        );
        const acceptedChanges: DataTableCellChange<StaffTableRow>[] = [];
        const failedChanges: DataTableCellChange<StaffTableRow>[] = [];
        results.forEach((result, index) => {
          const change = changes[index];
          if (!change) return;
          if (result.status === 'fulfilled') acceptedChanges.push(change);
          else failedChanges.push(change);
        });

        if (acceptedChanges.length > 0) {
          editingController.acceptChanges(acceptedChanges, undefined, {
            revision: requestRevision
          });
        }
        if (failedChanges.length > 0) {
          const rollbackRowsById = new Map<string, StaffTableRow>();
          for (const change of failedChanges) {
            const currentRow = rollbackRowsById.get(change.rowId) ?? rowsById.get(change.rowId);
            if (!currentRow) continue;
            rollbackRowsById.set(change.rowId, {
              ...currentRow,
              [change.field]: change.previousValue
            });
          }
          editingController.acceptChanges(failedChanges, [...rollbackRowsById.values()], {
            revision: requestRevision
          });
          editingController.setServerCellErrors({
            revision: requestRevision,
            errors: getStaffServerCellErrors(changes, results)
          });
          toast.error('部分员工字段更新失败，已回滚');
          return;
        }
        try {
          await invalidateStaffQueries(queryClient);
        } catch {
          toast.error('员工字段已保存，但列表刷新失败');
          return;
        }
        toast.success('员工字段已更新');
      })();
    },
    [queryClient]
  );

  const { table, editing, total, queryState, refreshProps } = useDslDataTable<
    StaffTableRow,
    DataTableDslPageRequestBase,
    IamStaffPageResponse,
    ApiClientError,
    ReturnType<typeof iamStaffPageQueryKey>
  >({
    tableId: TABLE_ID,
    columns,
    queryOptions: staffTableQueryOptions,
    mapQueryData: mapStaffTableData,
    rowActions,
    rowId: 'staffId',
    showSelectColumn: false,
    editing: {
      isCellEditable: ({ row }) => getStaffOperationAccess(row).canEdit,
      onChange: handleCellEdit
    },
    refreshBehavior: {
      onSuccess: () => {
        toast.success('员工列表已刷新');
      }
    }
  });

  React.useEffect(() => {
    editingControllerRef.current = editing;
    return () => {
      editingControllerRef.current = null;
    };
  }, [editing]);

  return (
    <>
      <Card>
        <CardContent className='px-0'>
          {queryState.isFetching && !queryState.data ? (
            <DataTableSkeleton columnCount={8} filterCount={5} />
          ) : (
            <DataTable<StaffTableRow>
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
