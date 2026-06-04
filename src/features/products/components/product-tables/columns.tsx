import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { Product } from '../../api/types';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { CATEGORY_OPTIONS } from './options';

export const columns: ColumnDef<Product>[] = [
  {
    accessorKey: 'photo_url',
    header: '图片',
    cell: ({ row }) => {
      return (
        <div className='relative size-[40px] shrink-0 overflow-hidden rounded-lg'>
          <img
            src={row.getValue('photo_url')}
            alt={row.getValue('name')}
            className='size-full object-cover'
          />
        </div>
      );
    },
    meta: {
      label: '图片'
    }
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }: { column: Column<Product, unknown> }) => (
      <DataTableColumnHeader column={column} title='产品名称' />
    ),
    meta: {
      label: '产品名称',
      placeholder: '搜索产品名称...',
      variant: 'text',
      icon: Icons.text
    },
    enableColumnFilter: true
  },
  {
    id: 'category',
    accessorKey: 'category',
    enableSorting: false,
    header: ({ column }: { column: Column<Product, unknown> }) => (
      <DataTableColumnHeader column={column} title='产品分类' />
    ),
    cell: ({ cell }) => {
      const category = cell.getValue<Product['category']>();

      return <Badge variant='outline'>{category}</Badge>;
    },
    enableColumnFilter: true,
    meta: {
      label: '分类',
      variant: 'multiSelect',
      options: CATEGORY_OPTIONS
    }
  },
  {
    accessorKey: 'price',
    header: '价格',
    meta: {
      label: '价格'
    }
  },
  {
    accessorKey: 'description',
    header: '产品描述',
    meta: {
      label: '产品描述'
    }
  }
];
