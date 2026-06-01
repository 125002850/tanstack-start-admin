import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { User } from '../../api/types';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { ROLE_OPTIONS } from './options';

function translateStatus(status: string) {
  const map: Record<string, string> = {
    Active: '已激活',
    Inactive: '未激活',
    Invited: '已邀请'
  };
  return map[status] ?? status;
}

export const columns: ColumnDef<User>[] = [
  {
    id: 'select',
    size: 40,
    minSize: 40,
    maxSize: 40,
    enableResizing: false,
    header: ({ table }) => (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- inner Checkbox provides full a11y
      <div
        className='flex items-center justify-center w-full h-full cursor-pointer'
        onClick={() => table.toggleAllPageRowsSelected(!table.getIsAllPageRowsSelected())}
      >
        <Checkbox checked={table.getIsAllPageRowsSelected()} aria-label='全选' />
      </div>
    ),
    cell: ({ row }) => (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- inner Checkbox provides full a11y
      <div
        className='flex items-center justify-center w-full h-full cursor-pointer'
        onClick={() => row.toggleSelected(!row.getIsSelected())}
      >
        <Checkbox checked={row.getIsSelected()} aria-label='选择行' />
      </div>
    )
  },
  {
    id: 'name',
    accessorFn: (row) => `${row.first_name} ${row.last_name}`,
    header: ({ column }: { column: Column<User, unknown> }) => (
      <DataTableColumnHeader column={column} title='姓名' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-col'>
        <span className='font-medium'>
          {row.original.first_name} {row.original.last_name}
        </span>
        <span className='text-muted-foreground text-xs'>{row.original.email}</span>
      </div>
    ),
    meta: {
      label: '姓名',
      placeholder: '搜索用户...',
      variant: 'text' as const,
      icon: Icons.text
    },
    enableColumnFilter: true
  },
  {
    accessorKey: 'phone',
    header: '电话'
  },
  {
    id: 'role',
    accessorKey: 'role',
    enableSorting: false,
    header: ({ column }: { column: Column<User, unknown> }) => (
      <DataTableColumnHeader column={column} title='角色' />
    ),
    cell: ({ cell }) => {
      const roleMap: Record<string, string> = {
        Developer: '开发者',
        Designer: '设计师',
        Manager: '管理者',
        QA: '测试',
        DevOps: '运维',
        'Product Owner': '产品负责人'
      };
      return (
        <Badge variant='outline'>
          {roleMap[cell.getValue<User['role']>()] ?? cell.getValue<User['role']>()}
        </Badge>
      );
    },
    enableColumnFilter: true,
    meta: {
      label: '角色',
      variant: 'multiSelect' as const,
      options: ROLE_OPTIONS
    }
  },
  {
    accessorKey: 'status',
    header: '状态',
    cell: ({ cell }) => {
      const status = cell.getValue<User['status']>();
      const variant =
        status === 'Active' ? 'default' : status === 'Inactive' ? 'secondary' : 'outline';
      return <Badge variant={variant}>{translateStatus(status)}</Badge>;
    }
  }
];
