import { StatusToggleBadge } from '@/features/dictionaries/components/status-toggle-badge';
import type { DictionaryItemRecord } from '../api/types';
import type { ColumnDef } from '@tanstack/react-table';
import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';

const columnDsl = createDataTableColumnDsl<DictionaryItemRecord>();

export function dictionaryItemColumns(
  onToggleStatus: (record: DictionaryItemRecord) => void
): ColumnDef<DictionaryItemRecord>[] {
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
    columnDsl.custom({
      id: 'status',
      title: '状态',
      accessorFn: (record) => record.status,
      cell: ({ row }) => (
        <StatusToggleBadge
          status={row.original.status}
          onClick={() => onToggleStatus(row.original)}
          getVariant={(enabled) => (enabled ? undefined : 'secondary')}
        />
      )
    }),
    columnDsl.field('sort', '排序', {
      type: 'number',
      dsl: { sortField: 'sortOrder' }
    }),
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
