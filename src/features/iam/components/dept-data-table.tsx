import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DataTableAction } from '@/components/ui/table/actions/data-table-actions-bar';
import type { DataTableRowAction } from '@/components/ui/table/actions/data-table-row-action';
import {
  createDataTableColumnDsl,
  dataTableHeader
} from '@/components/ui/table/columns/data-table-column-factory';
import { DataTable } from '@/components/ui/table/core/data-table';
import { DataTableToolbar } from '@/components/ui/table/toolbar/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import type { DeptRspDTO } from '@/lib/api/clients/service';
import { StatusBadge } from '../lib/format';

type FlatDeptRow = DeptRspDTO & { depth: number };

interface DeptDataTableProps {
  rows: FlatDeptRow[];
  isFetching: boolean;
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  canManageDept: boolean;
  onRefresh: () => void | Promise<void>;
  onAddDept: (parent?: DeptRspDTO | null) => void;
  onEditDept: (dept: DeptRspDTO) => void;
  onToggleStatus: (dept: DeptRspDTO) => void;
  onDeleteDept: (dept: DeptRspDTO) => void;
  onViewDetail: (dept: DeptRspDTO) => void;
}

const columnDsl = createDataTableColumnDsl<FlatDeptRow>();

export default function DeptDataTable({
  rows,
  isFetching,
  keyword,
  onKeywordChange,
  canManageDept,
  onRefresh,
  onAddDept,
  onEditDept,
  onToggleStatus,
  onDeleteDept,
  onViewDetail
}: DeptDataTableProps) {
  const columns = React.useMemo<Array<ColumnDef<FlatDeptRow>>>(() => [
    {
      accessorKey: 'deptName',
      header: ({ column }) => dataTableHeader(column, '部门名称'),
      size: 240,
      cell: ({ row }) => (
        <Button
          variant='link'
          className='h-auto p-0 font-medium'
          style={{ marginLeft: (row.original.depth ?? 0) * 18 }}
          onClick={() => onViewDetail(row.original)}
        >
          {row.original.deptName}
        </Button>
      )
    },
    columnDsl.field('deptCode', '编码', { size: 160 }),
    {
      accessorKey: 'sortOrder',
      header: ({ column }) => dataTableHeader(column, '排序'),
      size: 90,
      cell: ({ row }) => <>{row.original.sortOrder ?? '-'}</>
    },
    {
      accessorKey: 'status',
      header: ({ column }) => dataTableHeader(column, '状态'),
      size: 110,
      cell: ({ row }) => <StatusBadge status={row.original.status} />
    },
    columnDsl.field('createTime', '创建时间', { type: 'dateTime', size: 180 })
  ], [onViewDetail]);

  const rowActions = React.useMemo<DataTableRowAction<FlatDeptRow>[]>(
    () =>
      canManageDept
        ? [
            {
              label: '新增下级',
              icon: <Icons.plusCircle className='size-4' />,
              onClick: (dept) => onAddDept(dept)
            },
            {
              label: '编辑',
              icon: <Icons.edit className='size-4' />,
              onClick: (dept) => onEditDept(dept)
            },
            {
              label: '切换状态',
              icon: <Icons.rotate className='size-4' />,
              confirmDelete: {
                title: '确认切换部门状态',
                description: (dept) =>
                  `确认将 ${dept.deptName ?? '该部门'} ${dept.status === 'ENABLED' ? '停用' : '启用'}？`,
                confirmText: '确认',
                cancelText: '取消'
              },
              onClick: (dept) => onToggleStatus(dept)
            },
            {
              label: '删除',
              icon: <Icons.trash className='size-4' />,
              confirmDelete: {
                title: '确认删除部门',
                description: (dept) => `删除后 ${dept.deptName ?? '该部门'} 不可恢复。`,
                confirmText: '确认删除',
                cancelText: '取消'
              },
              onClick: (dept) => onDeleteDept(dept)
            }
          ]
        : [],
    [canManageDept, onAddDept, onEditDept, onToggleStatus, onDeleteDept]
  );

  const tableActions = React.useMemo<DataTableAction<FlatDeptRow>[]>(
    () =>
      canManageDept
        ? [
            {
              label: '新增部门',
              icon: <Icons.add className='size-3.5' />,
              callback: () => onAddDept(null)
            }
          ]
        : [],
    [canManageDept, onAddDept]
  );

  const { table } = useDataTable({
    tableId: 'iam-dept-tree',
    data: rows,
    columns,
    pageCount: 1,
    showRowNumberColumn: false,
    showSelectColumn: false,
    rowId: 'deptId',
    rowActions
  });

  return (
    <DataTable
      table={table}
      tableActions={tableActions}
      statusTotalCount={rows.length}
      isLoading={isFetching}
      onRefresh={onRefresh}
      isRefreshing={isFetching}
    >
      <DataTableToolbar table={table}>
        <Input
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder='搜索部门编码或名称'
          className='h-8 w-56'
        />
      </DataTableToolbar>
    </DataTable>
  );
}
