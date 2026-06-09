import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { DictionaryItemRecord } from '../api/types';
import { ColumnDef, Column } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';

export const dictionaryItemColumns: ColumnDef<DictionaryItemRecord>[] = [
  {
    id: 'select',
    size: 40,
    minSize: 40,
    maxSize: 40,
    enableResizing: false,
    enableSorting: false,
    header: ({ table }) => (
      <div
        className='flex h-full w-full items-center justify-center'
        data-row-expand-ignore
      >
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() ? 'indeterminate' : false)
          }
          aria-label='全选'
          onCheckedChange={(checked) => {
            table.toggleAllPageRowsSelected(checked === true);
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div
        className='flex h-full w-full items-center justify-center'
        data-row-expand-ignore
      >
        <Checkbox
          checked={row.getIsSelected()}
          aria-label='选择行'
          onCheckedChange={(checked) => {
            row.toggleSelected(checked === true);
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
        />
      </div>
    )
  },
  {
    accessorKey: 'dictItemCode',
    header: ({ column }: { column: Column<DictionaryItemRecord, unknown> }) => (
      <DataTableColumnHeader column={column} title='字典项编码' />
    ),
    cell: ({ row }) => (
      <span className='font-medium'>{row.original.dictItemCode}</span>
    )
  },
  {
    accessorKey: 'dictItemName',
    header: ({ column }: { column: Column<DictionaryItemRecord, unknown> }) => (
      <DataTableColumnHeader column={column} title='字典项名称' />
    )
  },
  {
    accessorKey: 'status',
    header: '状态',
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <Badge variant={status === 'DISABLED' ? 'secondary' : 'default'}>
          {status === 'DISABLED' ? '停用' : '启用'}
        </Badge>
      );
    }
  },
  {
    accessorKey: 'sort',
    header: '排序',
    cell: ({ row }) => row.original.sort ?? '-'
  },
  {
    accessorKey: 'remark',
    header: '备注',
    cell: ({ row }) => (
      <span className='text-muted-foreground max-w-[260px] whitespace-normal'>
        {row.original.remark || '-'}
      </span>
    )
  },
  {
    id: 'audit',
    header: '审计',
    cell: ({ row }) => (
      <div className='space-y-1 whitespace-normal'>
        <div className='text-xs font-medium'>{row.original.updatedBy || row.original.createdBy || '-'}</div>
        <div className='text-muted-foreground text-xs'>{row.original.updatedAt || row.original.createdAt || '-'}</div>
      </div>
    )
  }
];
