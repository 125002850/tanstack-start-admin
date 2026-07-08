import * as React from 'react';
import type { ApiClientError } from '@oig/react-query-generator/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { PermissionGate } from '@/components/permission-gate';
import { Button } from '@/components/ui/button';
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
import type { DataTableRowAction } from '@/components/ui/table/actions/data-table-row-action';
import {
  createDataTableColumnDsl,
  dataTableHeader
} from '@/components/ui/table/columns/data-table-column-factory';
import { useDslDataTable } from '@/hooks/use-dsl-data-table';
import type { DataTableDslPageRequestBase } from '@/hooks/use-dsl-data-table.dsl';
import { IAM_QUERY_KEYS } from '@/lib/api/iam/constants';
import {
  iamRoleCreate,
  iamRoleDataScopeAssign,
  iamRoleDelete,
  iamRoleMenusAssign,
  iamRolePageQueryKey,
  iamRolePageQueryOptions,
  iamRoleStatusUpdate,
  iamRoleUpdate,
  type IamRolePageRequest,
  type IamRolePageResponse,
  type RoleCreateReqDTO,
  type RoleRspDTO,
  type RoleUpdateReqDTO
} from '@/lib/api/clients/service';
import { nullableText } from '@/lib/display-formatters';
import { iamDeptTreeQueryOptions, iamMenuTreeQueryOptions } from '../api/query-options';
import { DATA_SCOPE_OPTIONS, ENABLE_STATUS_OPTIONS, IAM_PERMISSIONS } from '../lib/constants';
import { DataScopeBadge, dataScopeLabel, formatOptionalDateTime, nextStatus, StatusBadge } from '../lib/format';
import { deptMultiSelectOptions, menuMultiSelectOptions } from '../lib/tree';
import { dslConditionValue, pageRequestFromDsl } from '../lib/table';

const TABLE_ID = 'iam-role-list';
const ROLE_LIST_QUERY_KEY = ['service', 'iam-role'] as const;
const columnDsl = createDataTableColumnDsl<RoleRspDTO>();

type RoleFormValues = {
  roleCode: string;
  roleName: string;
  sortOrder: string;
  status: 'ENABLED' | 'DISABLED';
  dataScopeType: 'ALL' | 'DEPT_AND_CHILD' | 'DEPT_ONLY' | 'SELF' | 'CUSTOM_DEPT';
  remark: string;
};

const emptyRoleValues: RoleFormValues = {
  roleCode: '',
  roleName: '',
  sortOrder: '10',
  status: 'ENABLED',
  dataScopeType: 'SELF',
  remark: ''
};

function invalidateRoleQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ROLE_LIST_QUERY_KEY, exact: false }),
    queryClient.invalidateQueries({ queryKey: IAM_QUERY_KEYS.me, exact: false })
  ]);
}

function roleTableQueryOptions(request: DataTableDslPageRequestBase) {
  const condition = request.condition;
  return iamRolePageQueryOptions({
    ...pageRequestFromDsl(request),
    keyword:
      dslConditionValue(condition, 'roleCode') ?? dslConditionValue(condition, 'roleName'),
    status: dslConditionValue(condition, 'status') as IamRolePageRequest['status']
  });
}

function isProtectedRole(role: RoleRspDTO | null | undefined) {
  return role?.systemBuiltIn || role?.roleCode === 'SUPER_ADMIN';
}

function getColumns(onOpenDetail: (role: RoleRspDTO) => void): Array<ColumnDef<RoleRspDTO>> {
  return [
    {
      accessorKey: 'roleName',
      header: ({ column }) => dataTableHeader(column, '角色名称'),
      size: 180,
      enableColumnFilter: true,
      meta: { variant: 'text', label: '角色名称', placeholder: '搜索名称' },
      cell: ({ row }) => (
        <Button
          type='button'
          variant='link'
          className='h-auto max-w-[180px] justify-start truncate p-0 font-medium'
          onClick={() => onOpenDetail(row.original)}
        >
          {nullableText(row.original.roleName)}
        </Button>
      )
    },
    columnDsl.field('roleCode', '角色编码', {
      size: 180,
      filter: 'text',
      filterPlaceholder: '搜索编码'
    }),
    {
      accessorKey: 'status',
      header: ({ column }) => dataTableHeader(column, '状态'),
      size: 110,
      enableColumnFilter: true,
      enableSorting: false,
      meta: { variant: 'select', label: '状态', options: [...ENABLE_STATUS_OPTIONS] },
      cell: ({ row }) => <StatusBadge status={row.original.status} />
    },
    {
      accessorKey: 'dataScopeType',
      header: ({ column }) => dataTableHeader(column, '数据范围'),
      size: 150,
      enableColumnFilter: false,
      cell: ({ row }) => <DataScopeBadge type={row.original.dataScopeType} />
    },
    {
      accessorKey: 'systemBuiltIn',
      header: ({ column }) => dataTableHeader(column, '内置'),
      size: 90,
      enableColumnFilter: false,
      cell: ({ row }) => (row.original.systemBuiltIn ? '是' : '否')
    },
    columnDsl.field('sortOrder', '排序', { type: 'int', size: 90 }),
    columnDsl.field('createTime', '创建时间', { type: 'dateTime', size: 180 })
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

function RoleFormSheet({
  open,
  onOpenChange,
  role,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleRspDTO | null;
  onSubmit: (payload: RoleCreateReqDTO | RoleUpdateReqDTO) => Promise<void>;
}) {
  const isEdit = !!role?.roleId;
  const [values, setValues] = React.useState<RoleFormValues>(emptyRoleValues);

  React.useEffect(() => {
    if (!open) return;
    setValues({
      roleCode: role?.roleCode ?? '',
      roleName: role?.roleName ?? '',
      sortOrder: String(role?.sortOrder ?? 10),
      status: role?.status === 'DISABLED' ? 'DISABLED' : 'ENABLED',
      dataScopeType:
        role?.dataScopeType === 'ALL' ||
        role?.dataScopeType === 'DEPT_AND_CHILD' ||
        role?.dataScopeType === 'DEPT_ONLY' ||
        role?.dataScopeType === 'CUSTOM_DEPT'
          ? role.dataScopeType
          : 'SELF',
      remark: role?.remark ?? ''
    });
  }, [open, role]);

  const update = React.useCallback(
    (patch: Partial<RoleFormValues>) => setValues((current) => ({ ...current, ...patch })),
    []
  );

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!values.roleCode.trim() || !values.roleName.trim()) {
        toast.error('请填写角色编码和名称');
        return;
      }
      const sortOrder = Number(values.sortOrder);
      const payload = {
        roleCode: values.roleCode.trim(),
        roleName: values.roleName.trim(),
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : undefined,
        status: values.status,
        dataScopeType: values.dataScopeType,
        remark: values.remark.trim() || undefined
      };
      if (isEdit) {
        if (!role?.roleId) return;
        await onSubmit({ ...payload, roleId: role.roleId });
      } else {
        await onSubmit(payload);
      }
      onOpenChange(false);
    },
    [isEdit, onOpenChange, onSubmit, role?.roleId, values]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent autoFocusFirstField className='flex max-w-lg flex-col'>
        <SheetHeader>
          <SheetTitle>{isEdit ? '编辑角色' : '新增角色'}</SheetTitle>
          <SheetDescription>{isEdit ? '修改角色基础信息。' : '创建业务角色。'}</SheetDescription>
        </SheetHeader>
        <form id='role-form' className='min-h-0 flex-1 space-y-4 overflow-auto' onSubmit={handleSubmit}>
          <div className='grid gap-4 sm:grid-cols-2'>
            <FieldShell label='角色编码'>
              <Input value={values.roleCode} disabled={isProtectedRole(role)} onChange={(event) => update({ roleCode: event.target.value })} />
            </FieldShell>
            <FieldShell label='角色名称'>
              <Input value={values.roleName} onChange={(event) => update({ roleName: event.target.value })} />
            </FieldShell>
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <FieldShell label='排序'>
              <Input inputMode='numeric' value={values.sortOrder} onChange={(event) => update({ sortOrder: event.target.value })} />
            </FieldShell>
            <FieldShell label='状态'>
              <Select value={values.status} onValueChange={(status) => update({ status: status as RoleFormValues['status'] })}>
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
          </div>
          <FieldShell label='数据范围'>
            <Select value={values.dataScopeType} onValueChange={(dataScopeType) => update({ dataScopeType: dataScopeType as RoleFormValues['dataScopeType'] })}>
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_SCOPE_OPTIONS.map((option) => (
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
          <Button type='submit' form='role-form'>
            {isEdit ? '保存修改' : '创建角色'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function RoleMenusSheet({
  open,
  onOpenChange,
  role,
  options,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleRspDTO | null;
  options: ReturnType<typeof menuMultiSelectOptions>;
  onSubmit: (menuIds: number[]) => Promise<void>;
}) {
  const [menuIds, setMenuIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (open) setMenuIds((role?.menuIds ?? []).map(String));
  }, [open, role?.menuIds]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent autoFocusFirstField className='flex max-w-lg flex-col'>
        <SheetHeader>
          <SheetTitle>菜单权限</SheetTitle>
          <SheetDescription>{role?.roleName ?? '-'}</SheetDescription>
        </SheetHeader>
        <div className='min-h-0 flex-1'>
          <FieldShell label='菜单与按钮权限'>
            <MultiSelectCombobox
              triggerLabel='菜单权限'
              placeholder='选择菜单或按钮'
              options={options}
              value={menuIds}
              onValueChange={setMenuIds}
            />
          </FieldShell>
        </div>
        <SheetFooter className='flex-row justify-end'>
          <Button
            type='button'
            onClick={async () => {
              await onSubmit(menuIds.map(Number).filter(Number.isFinite));
              onOpenChange(false);
            }}
          >
            保存权限
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function RoleDataScopeSheet({
  open,
  onOpenChange,
  role,
  deptOptions,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleRspDTO | null;
  deptOptions: ReturnType<typeof deptMultiSelectOptions>;
  onSubmit: (payload: { dataScopeType: RoleFormValues['dataScopeType']; deptIds: number[] }) => Promise<void>;
}) {
  const [dataScopeType, setDataScopeType] = React.useState<RoleFormValues['dataScopeType']>('SELF');
  const [deptIds, setDeptIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setDataScopeType(
      role?.dataScopeType === 'ALL' ||
        role?.dataScopeType === 'DEPT_AND_CHILD' ||
        role?.dataScopeType === 'DEPT_ONLY' ||
        role?.dataScopeType === 'CUSTOM_DEPT'
        ? role.dataScopeType
        : 'SELF'
    );
    setDeptIds((role?.dataScopeDeptIds ?? []).map(String));
  }, [open, role]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent autoFocusFirstField className='flex max-w-lg flex-col'>
        <SheetHeader>
          <SheetTitle>数据权限</SheetTitle>
          <SheetDescription>{role?.roleName ?? '-'}</SheetDescription>
        </SheetHeader>
        <div className='min-h-0 flex-1 space-y-4'>
          <FieldShell label='数据范围'>
            <Select value={dataScopeType} onValueChange={(value) => setDataScopeType(value as RoleFormValues['dataScopeType'])}>
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_SCOPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldShell>
          {dataScopeType === 'CUSTOM_DEPT' && (
            <FieldShell label='自定义部门'>
              <MultiSelectCombobox
                triggerLabel='部门'
                placeholder='选择部门'
                options={deptOptions}
                value={deptIds}
                onValueChange={setDeptIds}
              />
            </FieldShell>
          )}
        </div>
        <SheetFooter className='flex-row justify-end'>
          <Button
            type='button'
            onClick={async () => {
              await onSubmit({
                dataScopeType,
                deptIds: deptIds.map(Number).filter(Number.isFinite)
              });
              onOpenChange(false);
            }}
          >
            保存数据权限
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function RoleDetailSheet({
  role,
  open,
  onOpenChange
}: {
  role?: RoleRspDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex max-w-xl flex-col'>
        <SheetHeader>
          <SheetTitle>角色详情</SheetTitle>
          <SheetDescription>{role?.roleName ?? '-'}</SheetDescription>
        </SheetHeader>
        <div className='grid min-h-0 flex-1 gap-3 overflow-auto sm:grid-cols-2'>
          <FieldItem label='角色ID' value={role?.roleId} />
          <FieldItem label='角色编码' value={role?.roleCode} />
          <FieldItem label='角色名称' value={role?.roleName} />
          <FieldItem label='状态' value={role?.status} />
          <FieldItem label='数据范围' value={dataScopeLabel(role?.dataScopeType)} />
          <FieldItem label='排序' value={role?.sortOrder} />
          <FieldItem label='系统内置' value={role?.systemBuiltIn ? '是' : '否'} />
          <FieldItem label='菜单数量' value={role?.menuIds?.length ?? 0} />
          <FieldItem label='自定义部门数' value={role?.dataScopeDeptIds?.length ?? 0} />
          <FieldItem label='创建时间' value={formatOptionalDateTime(role?.createTime)} />
          <FieldItem label='更新时间' value={formatOptionalDateTime(role?.updateTime)} />
          <FieldItem label='备注' value={role?.remark} valueMaxLines={2} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function RoleManagementPage() {
  const queryClient = useQueryClient();
  const menuQuery = useQuery(iamMenuTreeQueryOptions());
  const deptQuery = useQuery(iamDeptTreeQueryOptions());
  const menuOptions = React.useMemo(() => menuMultiSelectOptions(menuQuery.data ?? []), [menuQuery.data]);
  const deptOptions = React.useMemo(() => deptMultiSelectOptions(deptQuery.data ?? []), [deptQuery.data]);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState<RoleRspDTO | null>(null);
  const [detailRole, setDetailRole] = React.useState<RoleRspDTO | null>(null);
  const [menuRole, setMenuRole] = React.useState<RoleRspDTO | null>(null);
  const [scopeRole, setScopeRole] = React.useState<RoleRspDTO | null>(null);
  const columns = React.useMemo(() => getColumns(setDetailRole), []);

  const createMutation = useMutation({
    mutationFn: (request: RoleCreateReqDTO) => iamRoleCreate(request),
    onSuccess: async () => {
      await invalidateRoleQueries(queryClient);
      toast.success('角色已创建');
    }
  });
  const updateMutation = useMutation({
    mutationFn: (request: RoleUpdateReqDTO) => iamRoleUpdate(request),
    onSuccess: async () => {
      await invalidateRoleQueries(queryClient);
      toast.success('角色已更新');
    }
  });
  const statusMutation = useMutation({
    mutationFn: (request: Parameters<typeof iamRoleStatusUpdate>[0]) => iamRoleStatusUpdate(request),
    onSuccess: async () => {
      await invalidateRoleQueries(queryClient);
      toast.success('角色状态已更新');
    }
  });
  const deleteMutation = useMutation({
    mutationFn: (request: Parameters<typeof iamRoleDelete>[0]) => iamRoleDelete(request),
    onSuccess: async () => {
      await invalidateRoleQueries(queryClient);
      toast.success('角色已删除');
    }
  });
  const menusMutation = useMutation({
    mutationFn: (request: Parameters<typeof iamRoleMenusAssign>[0]) => iamRoleMenusAssign(request),
    onSuccess: async () => {
      await invalidateRoleQueries(queryClient);
      toast.success('菜单权限已保存');
    }
  });
  const scopeMutation = useMutation({
    mutationFn: (request: Parameters<typeof iamRoleDataScopeAssign>[0]) =>
      iamRoleDataScopeAssign(request),
    onSuccess: async () => {
      await invalidateRoleQueries(queryClient);
      toast.success('数据权限已保存');
    }
  });

  const rowActions = React.useMemo<DataTableRowAction<RoleRspDTO>[]>(
    () => [
      {
        label: '编辑',
        icon: <Icons.edit className='size-4' />,
        disabled: isProtectedRole,
        onClick: (role) => {
          setEditingRole(role);
          setFormOpen(true);
        }
      },
      {
        label: '菜单权限',
        icon: <Icons.shieldCheck className='size-4' />,
        disabled: isProtectedRole,
        onClick: (role) => setMenuRole(role)
      },
      {
        label: '数据权限',
        icon: <Icons.adjustments className='size-4' />,
        disabled: isProtectedRole,
        onClick: (role) => setScopeRole(role)
      },
      {
        label: '状态',
        icon: <Icons.rotate className='size-4' />,
        disabled: isProtectedRole,
        confirmDelete: {
          title: '确认切换角色状态',
          description: (role) =>
            `确认将 ${role.roleName ?? role.roleCode ?? '该角色'} ${role.status === 'ENABLED' ? '停用' : '启用'}？`,
          confirmText: '确认',
          cancelText: '取消'
        },
        onClick: async (role) => {
          if (!role.roleId) return;
          await statusMutation.mutateAsync({
            roleId: role.roleId,
            status: nextStatus(role.status)
          });
        }
      },
      {
        label: '删除',
        icon: <Icons.trash className='size-4' />,
        disabled: isProtectedRole,
        confirmDelete: {
          title: '确认删除角色',
          description: (role) => `删除后 ${role.roleName ?? role.roleCode ?? '该角色'} 的授权关系会失效。`,
          confirmText: '确认删除',
          cancelText: '取消'
        },
        onClick: async (role) => {
          if (!role.roleId) return;
          await deleteMutation.mutateAsync({ roleId: role.roleId });
        }
      }
    ],
    [deleteMutation, statusMutation]
  );

  const { table, total, queryState, refreshProps } = useDslDataTable<
    RoleRspDTO,
    DataTableDslPageRequestBase,
    IamRolePageResponse,
    ApiClientError,
    ReturnType<typeof iamRolePageQueryKey>
  >({
    tableId: TABLE_ID,
    columns,
    queryOptions: roleTableQueryOptions,
    rowActions,
    rowId: 'roleId',
    showSelectColumn: false,
    refreshBehavior: {
      onSuccess: () => {
        toast.success('角色列表已刷新');
      }
    }
  });

  return (
    <>
      <Card>
        <CardContent className='px-0'>
          <div className='px-6 pb-3'>
            <DataTableToolbar table={table} isQuerying={queryState.isFetching}>
              <PermissionGate permission={IAM_PERMISSIONS.role.manage}>
                <Button
                  size='sm'
                  onClick={() => {
                    setEditingRole(null);
                    setFormOpen(true);
                  }}
                >
                  <Icons.add className='size-4' />
                  新增角色
                </Button>
              </PermissionGate>
            </DataTableToolbar>
          </div>
          {queryState.isFetching && !queryState.data ? (
            <DataTableSkeleton columnCount={7} filterCount={3} />
          ) : (
            <DataTable
              table={table}
              statusTotalCount={total}
              isLoading={queryState.isFetching}
              onRefresh={refreshProps?.onRefresh}
              isRefreshing={refreshProps?.isRefreshing}
            />
          )}
        </CardContent>
      </Card>
      <RoleFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        role={editingRole}
        onSubmit={async (payload) => {
          if ('roleId' in payload) {
            await updateMutation.mutateAsync(payload);
          } else {
            await createMutation.mutateAsync(payload);
          }
        }}
      />
      <RoleMenusSheet
        open={!!menuRole}
        onOpenChange={(open) => !open && setMenuRole(null)}
        role={menuRole}
        options={menuOptions}
        onSubmit={async (menuIds) => {
          if (!menuRole?.roleId) return;
          await menusMutation.mutateAsync({ roleId: menuRole.roleId, menuIds });
        }}
      />
      <RoleDataScopeSheet
        open={!!scopeRole}
        onOpenChange={(open) => !open && setScopeRole(null)}
        role={scopeRole}
        deptOptions={deptOptions}
        onSubmit={async ({ dataScopeType, deptIds }) => {
          if (!scopeRole?.roleId) return;
          await scopeMutation.mutateAsync({ roleId: scopeRole.roleId, dataScopeType, deptIds });
        }}
      />
      <RoleDetailSheet
        open={!!detailRole}
        onOpenChange={(open) => !open && setDetailRole(null)}
        role={detailRole}
      />
    </>
  );
}
