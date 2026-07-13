import * as React from 'react';
import { getExpandedRowModel, type ColumnDef } from '@tanstack/react-table';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DataTableAction } from '@/components/ui/table/actions/data-table-actions-bar';
import type { DataTableRowAction } from '@/components/ui/table/actions/data-table-row-action';
import { auditColumns } from '@/components/ui/table/columns/data-table-audit-columns';
import { createDataTableColumnDsl } from '@/components/ui/table/columns/data-table-column-factory';
import { DataTable } from '@/components/ui/table/core/data-table';
import { DataTableToolbar } from '@/components/ui/table/toolbar/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import type { DeptRspDTO } from '@/lib/api/clients/service';
import { StatusBadge } from '../lib/format';

interface DeptDataTableProps {
  rows: DeptRspDTO[];
  totalCount: number;
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

const columnDsl = createDataTableColumnDsl<DeptRspDTO>();

export default function DeptDataTable({
  rows,
  totalCount,
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
  const columns = React.useMemo<Array<ColumnDef<DeptRspDTO>>>(
    () => [
      columnDsl.field('deptName', '部门名称', {
        size: 'xxl',
        renderCell: ({ row }) => {
          const canExpand = row.getCanExpand();
          const expanded = row.getIsExpanded();
          const name = row.original.deptName ?? row.original.deptCode ?? '-';

          return (
            <div
              className='flex min-w-0 items-center gap-1'
              style={{ paddingInlineStart: row.depth * 18 }}
            >
              {canExpand ? (
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='size-7 shrink-0'
                  aria-label={`${expanded ? '折叠' : '展开'} ${name}`}
                  aria-expanded={expanded}
                  onClick={(event) => {
                    event.stopPropagation();
                    row.toggleExpanded();
                  }}
                >
                  {expanded ? (
                    <Icons.chevronDown className='size-4' />
                  ) : (
                    <Icons.chevronRight className='size-4' />
                  )}
                </Button>
              ) : (
                <span className='size-7 shrink-0' aria-hidden='true' />
              )}

              <Button
                type='button'
                variant='link'
                className='h-auto min-w-0 justify-start p-0 font-medium'
                onClick={() => onViewDetail(row.original)}
              >
                <span className='truncate'>{name}</span>
              </Button>
            </div>
          );
        }
      }),
      columnDsl.field('deptCode', '编码', { size: 160 }),
      columnDsl.field('sortOrder', '排序', {
        size: 'xs',
        renderCell: ({ row }) => <>{row.original.sortOrder ?? '-'}</>
      }),
      columnDsl.field('status', '状态', {
        size: 'sm',
        renderCell: ({ row }) => <StatusBadge status={row.original.status} />
      }),
      ...auditColumns<DeptRspDTO>()
    ],
    [onViewDetail]
  );

  const rowActions = React.useMemo<DataTableRowAction<DeptRspDTO>[]>(
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

  const tableActions = React.useMemo<DataTableAction<DeptRspDTO>[]>(
    () => [
      {
        label: '折叠全部部门',
        icon: <Icons.chevronRight className='size-3.5' />,
        hidden: ({ table }) => !table.getCanSomeRowsExpand() || !table.getIsAllRowsExpanded(),
        callback: ({ table }) => table.toggleAllRowsExpanded(false)
      },
      {
        label: '展开全部部门',
        icon: <Icons.chevronDown className='size-3.5' />,
        hidden: ({ table }) => !table.getCanSomeRowsExpand() || table.getIsAllRowsExpanded(),
        callback: ({ table }) => table.toggleAllRowsExpanded(true)
      },
      ...(canManageDept
        ? [
            {
              label: '新增部门',
              icon: <Icons.add className='size-3.5' />,
              callback: () => onAddDept(null)
            }
          ]
        : [])
    ],
    [canManageDept, onAddDept]
  );

  const { table } = useDataTable({
    tableId: 'iam-dept-tree',
    data: rows,
    columns,
    pageCount: 1,
    getSubRows: (dept) => dept.children ?? [],
    getExpandedRowModel: getExpandedRowModel(),
    initialState: { expanded: true },
    enableSorting: false,
    showRowNumberColumn: false,
    showSelectColumn: false,
    rowId: 'deptId',
    rowActions
  });

  const isFiltering = keyword.trim().length > 0;

  React.useEffect(() => {
    if (isFiltering) {
      table.toggleAllRowsExpanded(true);
    }
  }, [isFiltering, rows, table]);

  return (
    <DataTable
      table={table}
      tableActions={tableActions}
      statusTotalCount={totalCount}
      isLoading={isFetching}
      onRefresh={onRefresh}
      isRefreshing={isFetching}
    >
      <DataTableToolbar table={table} aria-label='部门树操作'>
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
