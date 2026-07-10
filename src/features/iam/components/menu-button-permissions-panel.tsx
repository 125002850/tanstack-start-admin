import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { Icons } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import type { DataTableAction } from '@/components/ui/table/actions/data-table-actions-bar';
import type { DataTableRowAction } from '@/components/ui/table/actions/data-table-row-action';
import { createDataTableColumnDsl } from '@/components/ui/table/columns/data-table-column-factory';
import { DataTable } from '@/components/ui/table/core/data-table';
import { DataTableToolbar } from '@/components/ui/table/toolbar/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import type { MenuRspDTO } from '@/lib/api/clients/service';

import { StatusBadge } from '../lib/format';
import { getMenuNodeStableId, type MenuTreeNode } from '../lib/tree';

const buttonColumnDsl = createDataTableColumnDsl<MenuRspDTO>();

const buttonPermissionColumns: Array<ColumnDef<MenuRspDTO>> = [
  buttonColumnDsl.field('menuName', '按钮名称', {
    size: 160,
    renderCell: ({ row }) => <span className='font-medium'>{row.original.menuName ?? '-'}</span>
  }),
  buttonColumnDsl.field('menuCode', '按钮编码', { size: 190 }),
  buttonColumnDsl.field('permissionCode', '权限标识', { type: 'longText', size: 220 }),
  buttonColumnDsl.field('sortOrder', '排序', { type: 'int', size: 90 }),
  buttonColumnDsl.custom({
    id: 'status',
    title: '状态',
    accessorFn: (record) => record.status,
    size: 100,
    cell: ({ row }) => <StatusBadge status={row.original.status} />
  })
];

interface MenuButtonPermissionsPanelProps {
  record: MenuRspDTO | null;
  canManage: boolean;
  onCreate: () => void;
  onEdit: (button: MenuRspDTO) => void;
  onToggleStatus: (button: MenuRspDTO) => void;
  onDelete: (button: MenuRspDTO) => void;
}

function getDirectButtonPermissions(record: MenuRspDTO | null) {
  if (record?.menuType !== 'MENU') return [];

  return ((record as MenuTreeNode).children ?? []).filter((child) => child.menuType === 'BUTTON');
}

export function MenuButtonPermissionsPanel({
  record,
  canManage,
  onCreate,
  onEdit,
  onToggleStatus,
  onDelete
}: MenuButtonPermissionsPanelProps) {
  const [keyword, setKeyword] = React.useState('');
  const recordId = record ? getMenuNodeStableId(record) : null;
  const buttonPermissions = React.useMemo(() => getDirectButtonPermissions(record), [record]);
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  const filteredButtonPermissions = React.useMemo(
    () =>
      normalizedKeyword
        ? buttonPermissions.filter((button) =>
            [button.menuName, button.menuCode, button.menuKey, button.permissionCode].some(
              (value) => value?.toLocaleLowerCase().includes(normalizedKeyword)
            )
          )
        : buttonPermissions,
    [buttonPermissions, normalizedKeyword]
  );

  React.useEffect(() => {
    setKeyword('');
  }, [recordId]);

  const rowActions = React.useMemo<DataTableRowAction<MenuRspDTO>[]>(
    () =>
      canManage
        ? [
            {
              label: '编辑按钮权限',
              icon: <Icons.edit className='size-4' />,
              onClick: onEdit
            },
            {
              label: '切换按钮权限状态',
              icon: <Icons.rotate className='size-4' />,
              onClick: onToggleStatus
            },
            {
              label: '删除按钮权限',
              icon: <Icons.trash className='size-4' />,
              onClick: onDelete
            }
          ]
        : [],
    [canManage, onDelete, onEdit, onToggleStatus]
  );

  const tableActions = React.useMemo<DataTableAction<MenuRspDTO>[]>(
    () =>
      canManage
        ? [
            {
              label: '新增按钮权限',
              icon: <Icons.add className='size-3.5' />,
              disabled: record?.menuType !== 'MENU',
              callback: onCreate
            }
          ]
        : [],
    [canManage, onCreate, record?.menuType]
  );

  const { table } = useDataTable({
    tableId: 'iam-menu-button-permissions',
    data: filteredButtonPermissions,
    columns: buttonPermissionColumns,
    pageCount: 1,
    showRowNumberColumn: false,
    rowId: (button) => getMenuNodeStableId(button),
    rowSelectionScopeKey: recordId,
    rowActions
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>按钮权限</CardTitle>
        <CardDescription>
          {record?.menuType === 'MENU'
            ? `当前菜单：${record.menuName ?? record.menuCode ?? '-'}`
            : '选择页面菜单后维护其直接子级按钮权限'}
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className='min-h-0 px-0'>
        <DataTable
          table={table}
          tableActions={tableActions}
          statusTotalCount={filteredButtonPermissions.length}
          virtualization={false}
          getStatusConfig={({ rows }) => {
            if (record?.menuType !== 'MENU') {
              return {
                type: 'onboarding',
                title: '请选择页面菜单',
                description: '目录不包含按钮权限；请从左侧选择一个页面菜单。'
              };
            }

            if (!rows.length) {
              if (normalizedKeyword) {
                return {
                  type: 'empty',
                  title: '未找到匹配的按钮权限',
                  description: '尝试调整按钮名称、编码或权限标识。'
                };
              }

              return {
                type: 'empty',
                title: '当前菜单暂无按钮权限',
                description: ''
              };
            }
          }}
        >
          <DataTableToolbar table={table}>
            <Input
              type='search'
              aria-label='搜索按钮权限'
              value={keyword}
              disabled={record?.menuType !== 'MENU'}
              placeholder='搜索按钮名称 / 编码 / 权限'
              className='h-8 w-56'
              onChange={(event) => setKeyword(event.target.value)}
            />
          </DataTableToolbar>
        </DataTable>
      </CardContent>
    </Card>
  );
}
