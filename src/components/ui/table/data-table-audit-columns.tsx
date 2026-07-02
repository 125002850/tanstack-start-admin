import type { ColumnDef } from '@tanstack/react-table';

export interface AuditFields {
  createBy?: number | null;
  createTime?: string | null;
  updateBy?: number | null;
  updateTime?: string | null;
}

export function auditColumns<T extends AuditFields>(): Array<ColumnDef<T>> {
  return [
    {
      id: 'createInfo',
      header: '创建信息',
      cell: ({ row }) => (
        <div className='flex flex-col text-xs'>
          <span className='text-muted-foreground'>
            {row.original.createBy != null ? row.original.createBy : '-'}
          </span>
          <span>{row.original.createTime || '-'}</span>
        </div>
      )
    },
    {
      id: 'updateInfo',
      header: '更新信息',
      cell: ({ row }) => (
        <div className='flex flex-col text-xs'>
          <span className='text-muted-foreground'>
            {row.original.updateBy != null ? row.original.updateBy : '-'}
          </span>
          <span>{row.original.updateTime || '-'}</span>
        </div>
      )
    }
  ];
}
