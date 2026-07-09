import * as React from 'react';
import type { ApiClientError } from '@oig/react-query-generator/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { FieldItem } from '@/components/ui/detail-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/ui/table/core/data-table';
import { DataTableSkeleton } from '@/components/ui/table/feedback/data-table-skeleton';
import { DataTableToolbar } from '@/components/ui/table/toolbar/data-table-toolbar';
import type { DataTableAction } from '@/components/ui/table/actions/data-table-actions-bar';
import type { DataTableRowAction } from '@/components/ui/table/actions/data-table-row-action';
import {
  createDataTableColumnDsl,
  dataTableHeader,
  dataTableTextCell
} from '@/components/ui/table/columns/data-table-column-factory';
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
  type RoleRspDTO,
  type StaffCreateReqDTO,
  type StaffRspDTO,
  type StaffUpdateReqDTO
} from '@/lib/api/clients/service';
import { nullableText } from '@/lib/display-formatters';
import { iamDeptTreeQueryOptions, iamRoleOptionsQueryOptions } from '../api/query-options';
import { ENABLE_STATUS_OPTIONS, IAM_PERMISSIONS } from '../lib/constants';
import { formatOptionalDateTime, nextStatus, StatusBadge } from '../lib/format';
import { deptSelectOptions } from '../lib/tree';
import {
  dslConditionNumber,
  dslConditionValue,
  dslDateTimeRange,
  pageRequestFromDsl
} from '../lib/table';

const TABLE_ID = 'iam-staff-list';
const STAFF_LIST_QUERY_KEY = ['service', 'iam-staff'] as const;

type StaffFormValues = {
  username: string;
  staffCode: string;
  staffName: string;
  deptId: string;
  password: string;
  phone: string;
  email: string;
  status: 'ENABLED' | 'DISABLED';
  roleIds: string[];
  remark: string;
};

const emptyStaffFormValues: StaffFormValues = {
  username: '',
  staffCode: '',
  staffName: '',
  deptId: '',
  password: '',
  phone: '',
  email: '',
  status: 'ENABLED',
  roleIds: [],
  remark: ''
};

const columnDsl = createDataTableColumnDsl<StaffRspDTO>();

function invalidateStaffQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: STAFF_LIST_QUERY_KEY, exact: false }),
    queryClient.invalidateQueries({ queryKey: IAM_QUERY_KEYS.me, exact: false })
  ]);
}

function roleOptions(roles: readonly RoleRspDTO[] = []) {
  return roles
    .filter((role) => role.roleId != null)
    .map((role) => ({
      value: String(role.roleId),
      label: `${role.roleName ?? role.roleCode ?? role.roleId}`,
      disabled: role.status === 'DISABLED'
    }));
}

function selectedRoleIds(staff?: StaffRspDTO | null) {
  return (staff?.roles ?? [])
    .map((role) => role.roleId)
    .filter((roleId): roleId is number => typeof roleId === 'number')
    .map(String);
}

function staffTableQueryOptions(request: DataTableDslPageRequestBase) {
  const condition = request.condition;
  const keyword = dslConditionValue(condition, 'phone');
  const status = dslConditionValue(condition, 'status') as IamStaffPageRequest['status'];

  return iamStaffPageQueryOptions({
    ...pageRequestFromDsl(request),
    keyword,
    deptId: dslConditionNumber(condition, 'deptId'),
    status,
    staffCode: dslConditionValue(condition, 'staffCode'),
    username: dslConditionValue(condition, 'username'),
    staffName: dslConditionValue(condition, 'staffName'),
    createTimeRange: dslDateTimeRange(condition, 'createTime')
  });
}

function getColumns(onOpenDetail: (staff: StaffRspDTO) => void): Array<ColumnDef<StaffRspDTO>> {
  return [
    columnDsl.field('staffCode', '工号', {
      size: 130,
      filter: 'text',
      filterPlaceholder: '搜索工号'
    }),
    columnDsl.field('username', '用户名', {
      size: 150,
      filter: 'text',
      filterPlaceholder: '搜索用户名'
    }),
    {
      accessorKey: 'staffName',
      header: ({ column }) => dataTableHeader(column, '姓名'),
      size: 150,
      enableColumnFilter: true,
      meta: {
        variant: 'text',
        label: '姓名',
        placeholder: '搜索姓名'
      },
      cell: ({ row }) => (
        <Button
          type='button'
          variant='link'
          className='h-auto max-w-[150px] justify-start truncate p-0 font-medium'
          onClick={() => onOpenDetail(row.original)}
        >
          {nullableText(row.original.staffName)}
        </Button>
      )
    },
    {
      id: 'deptId',
      accessorFn: (row) => row.deptName,
      header: ({ column }) => dataTableHeader(column, '部门'),
      size: 160,
      enableColumnFilter: true,
      enableSorting: false,
      meta: {
        variant: 'select',
        label: '部门',
        options: []
      },
      cell: ({ row }) => dataTableTextCell(row.original.deptName, 'max-w-[160px]')
    },
    columnDsl.field('phone', '手机号', {
      size: 140,
      filter: 'text',
      filterPlaceholder: '搜索手机号'
    }),
    {
      accessorKey: 'status',
      header: ({ column }) => dataTableHeader(column, '状态'),
      size: 110,
      enableColumnFilter: true,
      enableSorting: false,
      meta: {
        variant: 'select',
        label: '状态',
        options: [...ENABLE_STATUS_OPTIONS]
      },
      cell: ({ row }) => <StatusBadge status={row.original.status} />
    },
    {
      id: 'roles',
      header: ({ column }) => dataTableHeader(column, '角色'),
      size: 220,
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => {
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
    },
    {
      accessorKey: 'mustChangePassword',
      header: ({ column }) => dataTableHeader(column, '改密'),
      size: 90,
      enableColumnFilter: false,
      cell: ({ row }) => (row.original.mustChangePassword ? '是' : '否')
    },
    columnDsl.field('createTime', '创建时间', {
      type: 'dateTime',
      size: 180,
      filter: 'dateRange'
    })
  ];
}

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function StaffFormSheet({
  open,
  onOpenChange,
  staff,
  departments,
  roles,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: StaffRspDTO | null;
  departments: ReturnType<typeof deptSelectOptions>;
  roles: ReturnType<typeof roleOptions>;
  onSubmit: (payload: StaffCreateReqDTO | StaffUpdateReqDTO) => Promise<void>;
}) {
  const isEdit = !!staff?.staffId;
  const [values, setValues] = React.useState<StaffFormValues>(emptyStaffFormValues);

  React.useEffect(() => {
    if (!open) return;
    setValues({
      username: staff?.username ?? '',
      staffCode: staff?.staffCode ?? '',
      staffName: staff?.staffName ?? '',
      deptId: staff?.deptId == null ? '' : String(staff.deptId),
      password: '',
      phone: staff?.phone ?? '',
      email: staff?.email ?? '',
      status: staff?.status === 'DISABLED' ? 'DISABLED' : 'ENABLED',
      roleIds: isEdit ? selectedRoleIds(staff) : [],
      remark: staff?.remark ?? ''
    });
  }, [isEdit, open, staff]);

  const update = React.useCallback(
    (patch: Partial<StaffFormValues>) => setValues((current) => ({ ...current, ...patch })),
    []
  );

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const deptId = Number(values.deptId);
      if (!values.staffCode.trim() || !values.staffName.trim() || !Number.isFinite(deptId)) {
        toast.error('请填写工号、姓名和部门');
        return;
      }
      if (!isEdit && (!values.username.trim() || !values.password.trim())) {
        toast.error('请填写用户名和初始密码');
        return;
      }

      if (isEdit) {
        if (!staff?.staffId) return;
        await onSubmit({
          staffId: staff.staffId,
          staffCode: values.staffCode.trim(),
          staffName: values.staffName.trim(),
          deptId,
          phone: values.phone.trim() || undefined,
          email: values.email.trim() || undefined,
          status: values.status,
          remark: values.remark.trim() || undefined
        });
      } else {
        await onSubmit({
          username: values.username.trim(),
          staffCode: values.staffCode.trim(),
          staffName: values.staffName.trim(),
          deptId,
          password: values.password,
          phone: values.phone.trim() || undefined,
          email: values.email.trim() || undefined,
          status: values.status,
          roleIds: values.roleIds.map(Number).filter(Number.isFinite),
          remark: values.remark.trim() || undefined
        });
      }
      onOpenChange(false);
    },
    [isEdit, onOpenChange, onSubmit, staff?.staffId, values]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent autoFocusFirstField className='flex max-w-xl flex-col sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>{isEdit ? '编辑员工' : '新增员工'}</SheetTitle>
          <SheetDescription>
            {isEdit ? '修改员工基础资料和启用状态。' : '创建本地 IAM 员工账号。'}
          </SheetDescription>
        </SheetHeader>
        <form id='staff-form' className='min-h-0 flex-1 space-y-4 overflow-auto' onSubmit={handleSubmit}>
          {!isEdit && (
            <FieldShell label='用户名'>
              <Input value={values.username} onChange={(event) => update({ username: event.target.value })} />
            </FieldShell>
          )}
          <div className='grid gap-4 sm:grid-cols-2'>
            <FieldShell label='员工工号'>
              <Input value={values.staffCode} onChange={(event) => update({ staffCode: event.target.value })} />
            </FieldShell>
            <FieldShell label='员工姓名'>
              <Input value={values.staffName} onChange={(event) => update({ staffName: event.target.value })} />
            </FieldShell>
          </div>
          <FieldShell label='部门'>
            <Select value={values.deptId} onValueChange={(deptId) => update({ deptId })}>
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='选择部门' />
              </SelectTrigger>
              <SelectContent>
                {departments.map((department) => (
                  <SelectItem key={department.value} value={department.value} disabled={department.disabled}>
                    {department.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldShell>
          <div className='grid gap-4 sm:grid-cols-2'>
            <FieldShell label='手机号'>
              <Input value={values.phone} onChange={(event) => update({ phone: event.target.value })} />
            </FieldShell>
            <FieldShell label='邮箱'>
              <Input value={values.email} onChange={(event) => update({ email: event.target.value })} />
            </FieldShell>
          </div>
          {!isEdit && (
            <>
              <FieldShell label='初始密码'>
                <Input
                  type='password'
                  value={values.password}
                  onChange={(event) => update({ password: event.target.value })}
                />
              </FieldShell>
              <FieldShell label='初始角色'>
                <MultiSelectCombobox
                  triggerLabel='角色'
                  placeholder='选择角色'
                  options={roles}
                  value={values.roleIds}
                  onValueChange={(roleIds) => update({ roleIds })}
                />
              </FieldShell>
            </>
          )}
          <FieldShell label='状态'>
            <Select value={values.status} onValueChange={(status) => update({ status: status as StaffFormValues['status'] })}>
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENABLE_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldShell>
          <FieldShell label='备注'>
            <Textarea value={values.remark} onChange={(event) => update({ remark: event.target.value })} />
          </FieldShell>
        </form>
        <SheetFooter className='flex-row justify-end'>
          <Button type='submit' form='staff-form'>
            {isEdit ? '保存修改' : '创建员工'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AssignRolesSheet({
  open,
  onOpenChange,
  staff,
  roles,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: StaffRspDTO | null;
  roles: ReturnType<typeof roleOptions>;
  onSubmit: (roleIds: number[]) => Promise<void>;
}) {
  const [roleIds, setRoleIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (open) setRoleIds(selectedRoleIds(staff));
  }, [open, staff]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent autoFocusFirstField className='flex max-w-lg flex-col'>
        <SheetHeader>
          <SheetTitle>分配角色</SheetTitle>
          <SheetDescription>{staff?.staffName ?? staff?.username ?? '当前员工'}</SheetDescription>
        </SheetHeader>
        <div className='min-h-0 flex-1'>
          <FieldShell label='角色'>
            <MultiSelectCombobox
              triggerLabel='角色'
              placeholder='选择角色'
              options={roles}
              value={roleIds}
              onValueChange={setRoleIds}
            />
          </FieldShell>
        </div>
        <SheetFooter className='flex-row justify-end'>
          <Button
            type='button'
            onClick={async () => {
              await onSubmit(roleIds.map(Number).filter(Number.isFinite));
              onOpenChange(false);
            }}
          >
            保存角色
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ResetPasswordSheet({
  open,
  onOpenChange,
  staff,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: StaffRspDTO | null;
  onSubmit: (newPassword: string) => Promise<void>;
}) {
  const [newPassword, setNewPassword] = React.useState('');

  React.useEffect(() => {
    if (open) setNewPassword('');
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent autoFocusFirstField className='flex max-w-lg flex-col'>
        <SheetHeader>
          <SheetTitle>重置密码</SheetTitle>
          <SheetDescription>{staff?.staffName ?? staff?.username ?? '当前员工'}</SheetDescription>
        </SheetHeader>
        <div className='min-h-0 flex-1'>
          <FieldShell label='新密码'>
            <Input type='password' value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </FieldShell>
        </div>
        <SheetFooter className='flex-row justify-end'>
          <Button
            type='button'
            onClick={async () => {
              if (!newPassword.trim()) {
                toast.error('请输入新密码');
                return;
              }
              await onSubmit(newPassword);
              onOpenChange(false);
            }}
          >
            确认重置
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function StaffDetailSheet({
  open,
  onOpenChange,
  staff
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: StaffRspDTO | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex max-w-2xl flex-col sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>员工详情</SheetTitle>
          <SheetDescription>{staff?.staffName ?? '-'}</SheetDescription>
        </SheetHeader>
        <div className='grid min-h-0 flex-1 gap-3 overflow-auto sm:grid-cols-2'>
          <FieldItem label='员工ID' value={staff?.staffId} />
          <FieldItem label='用户名' value={staff?.username} />
          <FieldItem label='工号' value={staff?.staffCode} />
          <FieldItem label='姓名' value={staff?.staffName} />
          <FieldItem label='部门' value={staff?.deptName} />
          <FieldItem label='手机号' value={staff?.phone} />
          <FieldItem label='邮箱' value={staff?.email} />
          <FieldItem label='状态' value={staff?.status} />
          <FieldItem label='必须改密' value={staff?.mustChangePassword ? '是' : '否'} />
          <FieldItem label='创建时间' value={formatOptionalDateTime(staff?.createTime)} />
          <FieldItem label='更新时间' value={formatOptionalDateTime(staff?.updateTime)} />
          <FieldItem label='备注' value={staff?.remark} valueMaxLines={2} />
          <div className='space-y-2 sm:col-span-2'>
            <Label>角色</Label>
            <div className='flex flex-wrap gap-1.5'>
              {(staff?.roles ?? []).length > 0 ? (
                staff!.roles!.map((role) => (
                  <Badge key={role.roleId ?? role.roleCode} variant='outline'>
                    {role.roleName ?? role.roleCode}
                  </Badge>
                ))
              ) : (
                <span className='text-muted-foreground text-sm'>未分配角色</span>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function StaffManagementPage() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery(getIamMeQueryOptions());
  const deptQuery = useQuery(iamDeptTreeQueryOptions());
  const roleQuery = useQuery(iamRoleOptionsQueryOptions());
  const departments = React.useMemo(() => deptSelectOptions(deptQuery.data ?? [], { enabledOnly: true }), [deptQuery.data]);
  const roles = React.useMemo(() => roleOptions(roleQuery.data ?? []), [roleQuery.data]);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingStaff, setEditingStaff] = React.useState<StaffRspDTO | null>(null);
  const [detailStaff, setDetailStaff] = React.useState<StaffRspDTO | null>(null);
  const [rolesStaff, setRolesStaff] = React.useState<StaffRspDTO | null>(null);
  const [resetStaff, setResetStaff] = React.useState<StaffRspDTO | null>(null);

  const columns = React.useMemo(() => getColumns(setDetailStaff), []);

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

  const rowActions = React.useMemo<DataTableRowAction<StaffRspDTO>[]>(
    () => [
      {
        label: '编辑',
        icon: <Icons.edit className='size-4' />,
        hidden: !canUpdate,
        onClick: (staff) => {
          setEditingStaff(staff);
          setFormOpen(true);
        }
      },
      {
        label: '角色',
        icon: <Icons.userShare className='size-4' />,
        hidden: !canUpdate,
        onClick: (staff) => setRolesStaff(staff)
      },
      {
        label: '状态',
        icon: <Icons.rotate className='size-4' />,
        hidden: !canUpdate,
        confirmDelete: {
          title: '确认切换员工状态',
          description: (staff) =>
            `确认将 ${staff.staffName ?? staff.username ?? '该员工'} ${staff.status === 'ENABLED' ? '停用' : '启用'}？`,
          confirmText: '确认',
          cancelText: '取消'
        },
        onClick: async (staff) => {
          if (staff.staffId == null) return;
          await statusMutation.mutateAsync({
            staffId: staff.staffId,
            status: nextStatus(staff.status)
          });
        }
      },
      {
        label: '重置密码',
        icon: <Icons.lock className='size-4' />,
        hidden: !canResetPassword,
        onClick: (staff) => setResetStaff(staff)
      },
      {
        label: '删除',
        icon: <Icons.trash className='size-4' />,
        hidden: !canDelete,
        confirmDelete: {
          title: '确认删除员工',
          description: (staff) => `删除后 ${staff.staffName ?? staff.username ?? '该员工'} 将无法登录。`,
          confirmText: '确认删除',
          cancelText: '取消'
        },
        onClick: async (staff) => {
          if (staff.staffId == null) return;
          await deleteMutation.mutateAsync({ staffId: staff.staffId });
        }
      }
    ],
    [canDelete, canResetPassword, canUpdate, deleteMutation, statusMutation]
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
          if (!rolesStaff?.staffId) return;
          await assignRolesMutation.mutateAsync({ staffId: rolesStaff.staffId, roleIds });
        }}
      />
      <ResetPasswordSheet
        open={!!resetStaff}
        onOpenChange={(open) => !open && setResetStaff(null)}
        staff={resetStaff}
        onSubmit={async (newPassword) => {
          if (!resetStaff?.staffId) return;
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
