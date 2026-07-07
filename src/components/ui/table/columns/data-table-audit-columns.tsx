import type { ColumnDef } from '@tanstack/react-table';

import { createDataTableColumnDsl } from '@/components/ui/table/columns/data-table-column-factory';

export interface AuditFields {
  createBy?: number | null;
  createTime?: string | null;
  updateBy?: number | null;
  updateTime?: string | null;
}

export function auditColumns<T extends AuditFields>(): Array<ColumnDef<T>> {
  const columnDsl = createDataTableColumnDsl<T>();

  return [
    columnDsl.custom({
      id: 'createInfo',
      title: '创建信息',
      cell: ({ row }) => (
        <div className='flex flex-col text-xs'>
          <span className='text-muted-foreground'>
            {row.original.createBy != null ? row.original.createBy : '-'}
          </span>
          <span>{row.original.createTime || '-'}</span>
        </div>
      )
    }),
    columnDsl.custom({
      id: 'updateInfo',
      title: '更新信息',
      cell: ({ row }) => (
        <div className='flex flex-col text-xs'>
          <span className='text-muted-foreground'>
            {row.original.updateBy != null ? row.original.updateBy : '-'}
          </span>
          <span>{row.original.updateTime || '-'}</span>
        </div>
      )
    })
  ];
}
