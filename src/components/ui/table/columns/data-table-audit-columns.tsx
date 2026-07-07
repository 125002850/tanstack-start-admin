import type { ColumnDef } from '@tanstack/react-table';

import { createDataTableColumnDsl } from '@/components/ui/table/columns/data-table-column-factory';

/**
 * 常见审计字段列定义。
 *
 * 该 helper 面向 createBy/createTime/updateBy/updateTime 这类后端通用字段，把创建/更新人
 * 和时间合并成两列，避免每个管理页面重复写同样的 cell 布局。
 */
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
