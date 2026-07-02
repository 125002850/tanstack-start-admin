import { StatusToggleBadge } from '@/components/ui/status-toggle-badge';
import type { DictionaryItemRecord } from '../api/types';
import type { ColumnDef } from '@tanstack/react-table';
import { auditColumns } from '@/components/ui/table/data-table-audit-columns';
import { dataTableHeader } from '@/components/ui/table/data-table-column-factory';

export function dictionaryItemColumns(
  onToggleStatus: (record: DictionaryItemRecord) => void
): ColumnDef<DictionaryItemRecord>[] {
  return [
    {
      accessorKey: 'dictItemCode',
      header: ({ column }) => dataTableHeader(column, '字典项编码'),
      cell: ({ row }) => <span className='font-medium'>{row.original.dictItemCode}</span>
    },
    {
      accessorKey: 'dictItemName',
      header: ({ column }) => dataTableHeader(column, '字典项名称')
    },
    {
      accessorKey: 'status',
      header: '状态',
      cell: ({ row }) => (
        <StatusToggleBadge
          status={row.original.status}
          onClick={() => onToggleStatus(row.original)}
          getVariant={(enabled) => (enabled ? undefined : 'secondary')}
        />
      )
    },
    {
      accessorKey: 'sort',
      header: '排序'
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
    ...auditColumns<DictionaryItemRecord>()
  ];
}
