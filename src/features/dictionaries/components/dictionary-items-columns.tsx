import { DictStatus, getStatusLabel } from '@/constants/enums';
import type { DictionaryItemRecord } from '../api/types';
import type { ColumnDef } from '@tanstack/react-table';
import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';

const columnDsl = createDataTableColumnDsl<DictionaryItemRecord>();

export function dictionaryItemColumns(): ColumnDef<DictionaryItemRecord>[] {
  return [
    columnDsl.field('dictItemCode', '字典项编码', {
      enableSorting: false,
      filter: 'text',
      filterPlaceholder: '搜索字典项编码',
      renderCell: ({ row }) => <span className='font-medium'>{row.original.dictItemCode}</span>
    }),
    columnDsl.field('dictItemName', '字典项名称', {
      enableSorting: false,
      filter: 'text',
      filterPlaceholder: '搜索字典项名称'
    }),
    columnDsl.badge('status', '状态', {
      format: (value) => getStatusLabel(value) || '—',
      variant: (value) =>
        value === DictStatus.ENABLE
          ? 'success'
          : value === DictStatus.DISABLE
            ? 'secondary'
            : 'outline'
    }),
    columnDsl.field('sortOrder', '排序', { type: 'number' }),
    columnDsl.field('remark', '备注', {
      type: 'longText',
      enableSorting: false,
      renderCell: ({ row }) => (
        <span className='text-muted-foreground max-w-[260px] whitespace-normal'>
          {row.original.remark || '-'}
        </span>
      )
    }),
    ...columnDsl.audit()
  ];
}
