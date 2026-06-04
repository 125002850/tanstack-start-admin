import type { ColumnDef } from '@tanstack/react-table';
import * as React from 'react';

import {
  DATA_TABLE_ROW_NUMBER_COLUMN_ID,
  DATA_TABLE_ROW_NUMBER_COLUMN_WIDTH
} from '../constants';

export function createRowNumberColumn<TData>(): ColumnDef<TData> {
  return {
    id: DATA_TABLE_ROW_NUMBER_COLUMN_ID,
    header: () =>
      React.createElement('span', { className: 'block text-center text-xs font-medium' }, ''),
    cell: ({ row, table }) => {
      const { pageIndex, pageSize } = table.getState().pagination;
      const rowNumber = pageIndex * pageSize + row.index + 1;
      return React.createElement(
        'span',
        { className: 'text-muted-foreground block text-center tabular-nums' },
        rowNumber
      );
    },
    size: DATA_TABLE_ROW_NUMBER_COLUMN_WIDTH,
    minSize: DATA_TABLE_ROW_NUMBER_COLUMN_WIDTH,
    maxSize: DATA_TABLE_ROW_NUMBER_COLUMN_WIDTH,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    enableColumnFilter: false,
    meta: {
      label: '序号'
    }
  };
}
