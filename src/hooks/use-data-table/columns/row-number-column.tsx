import type { ColumnDef, PaginationState, Row, Table } from '@tanstack/react-table';

import { DATA_TABLE_ROW_NUMBER_COLUMN_ID, DATA_TABLE_ROW_NUMBER_COLUMN_WIDTH } from '../constants';

/**
 * DataTable 自动生成的序号列。
 *
 * 默认按当前页和可见行位置连续编号；也可通过 rowNumberDisplayMode='original'
 * 让编号跟随原始数据数组索引，适合展示后端原始排序。
 */
export type RowNumberDisplayMode = 'static' | 'original';

export interface RowNumberColumnMeta {
  rowNumberDisplayMode?: RowNumberDisplayMode;
  rowNumberPagination?: PaginationState;
}

/**
 * 估算序号列宽度。每位数约 10px（text-sm tabular-nums 含字间距余量），
 * 加上 30px 水平内边距（data-table-body-cell 的 px-[15px] 各 15px）。
 */
function estimateRowNumberWidth(totalCount?: number): number {
  if (!totalCount || totalCount <= 0) return DATA_TABLE_ROW_NUMBER_COLUMN_WIDTH;
  const digits = String(totalCount).length;
  return Math.max(DATA_TABLE_ROW_NUMBER_COLUMN_WIDTH, digits * 10 + 30);
}

function getVisibleRowIndex<TData>(table: Table<TData>, row: Row<TData>): number {
  // 过滤/排序后的 rowModel 位置优先；找不到时退回 TanStack Row 的原始 index。
  const visibleIndex = table.getRowModel().rows.findIndex((visibleRow) => visibleRow.id === row.id);
  return visibleIndex >= 0 ? visibleIndex : row.index;
}

function getRowNumberMeta<TData>(table: Table<TData>): RowNumberColumnMeta {
  return (table.options.meta ?? {}) as RowNumberColumnMeta;
}

export function createRowNumberColumn<TData>(totalCount?: number): ColumnDef<TData> {
  const width = estimateRowNumberWidth(totalCount);

  return {
    id: DATA_TABLE_ROW_NUMBER_COLUMN_ID,
    header: () => <span className='sr-only'>序号</span>,
    cell: ({ row, table }) => {
      const meta = getRowNumberMeta(table);
      const displayMode = meta.rowNumberDisplayMode ?? 'static';
      const { pageIndex, pageSize } = meta.rowNumberPagination ?? table.getState().pagination;
      const rowIndex = displayMode === 'original' ? row.index : getVisibleRowIndex(table, row);
      // static 模式叠加 pageIndex/pageSize，服务端分页时也能显示全局连续序号。
      const rowNumber =
        displayMode === 'original' ? rowIndex + 1 : pageIndex * pageSize + rowIndex + 1;

      return (
        <span className='text-muted-foreground block text-center tabular-nums'>{rowNumber}</span>
      );
    },
    size: width,
    minSize: width,
    maxSize: width,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    enableColumnFilter: false,
    meta: {
      label: '序号'
    }
  };
}
