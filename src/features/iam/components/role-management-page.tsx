import * as React from 'react';
import type { ApiClientError } from '@oig/react-query-generator/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  createDataTableColumnDsl,
  dataTableHeader
} from '@/components/ui/table/columns/data-table-column-factory';
import { DataTable } from '@/components/ui/table/core/data-table';
import { DataTableSkeleton } from '@/components/ui/table/feedback/data-table-skeleton';
import { DataTableToolbar } from '@/components/ui/table/toolbar/data-table-toolbar';
import type { DataTableAction } from '@/components/ui/table/actions/data-table-actions-bar';
import type { DataTableRowAction } from '@/components/ui/table/actions/data-table-row-action';
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
import { ENABLE_STATUS_OPTIONS } from '../lib/constants';
import { DataScopeBadge, nextStatus, StatusBadge } from '../lib/format';
import { menuMultiSelectOptions } from '../lib/tree';
import { dslConditionValue, pageRequestFromDsl } from '../lib/table';
import { isProtectedRole } from './role-form-sheet';
import RoleDetailSheet from './role-detail-sheet';
import RoleFormSheet from './role-form-sheet';
import RoleMenusSheet from './role-menus-sheet';
import RoleDataScopeSheet from './role-data-scope-sheet';

const TABLE_ID = 'iam-role-list';
const ROLE_LIST_QUERY_KEY = ['service', 'iam-role'] as const;
const columnDsl = createDataTableColumnDsl<RoleRspDTO>();

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
    keyword: dslConditionValue(condition, 'roleCode') ?? dslConditionValue(condition, 'roleName'),
    status: dslConditionValue(condition, 'status') as IamRolePageRequest['status']
  });
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
      header: ({ column }) => dataTableHeader(column, '内置角色'),
      size: 110,
      enableColumnFilter: false,
      cell: ({ row }) => (row.original.systemBuiltIn ? '是' : '否')
    },
    columnDsl.field('sortOrder', '排序', { type: 'int', size: 90 }),
    columnDsl.field('createTime', '创建时间', { type: 'dateTime', size: 180 })
  ];
}

export default function RoleManagementPage() {
  const queryClient = useQueryClient();
  const menuQuery = useQuery(iamMenuTreeQueryOptions());
  const deptQuery = useQuery(iamDeptTreeQueryOptions());
  const menuOptions = React.useMemo(
    () => menuMultiSelectOptions(menuQuery.data ?? []),
    [menuQuery.data]
  );

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
    mutationFn: (request: Parameters<typeof iamRoleStatusUpdate>[0]) =>
      iamRoleStatusUpdate(request),
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
          description: (role) =>
            `删除后 ${role.roleName ?? role.roleCode ?? '该角色'} 的授权关系会失效。`,
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

  const tableActions = React.useMemo<DataTableAction<RoleRspDTO>[]>(
    () => [
      {
        label: '新增角色',
        icon: <Icons.add className='size-3.5' />,
        callback: () => {
          setEditingRole(null);
          setFormOpen(true);
        }
      }
    ],
    []
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
          {queryState.isFetching && !queryState.data ? (
            <DataTableSkeleton columnCount={7} filterCount={3} />
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
        departments={deptQuery.data ?? []}
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
