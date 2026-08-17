import { renderHook } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import { describe, expect, it } from 'vitest';

import { useDataTable } from './use-data-table';
import { DATA_TABLE_ROW_NUMBER_COLUMN_ID } from './constants';

interface RowNumberTestRow {
  id: number;
  name: string;
}

const columns: ColumnDef<RowNumberTestRow>[] = [{ accessorKey: 'name', header: '名称' }];

function createRows(count: number): RowNumberTestRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Row ${index + 1}`
  }));
}

describe('useDataTable row number column', () => {
  it('expands the row number column when local data crosses digit boundaries', () => {
    const { result, rerender } = renderHook(
      ({ data }) =>
        useDataTable({
          tableId: 'local-row-number-width',
          data,
          columns,
          rowId: 'id',
          columnResizeStorage: false,
          columnOrderStorage: false,
          sortingStorage: false
        }),
      { initialProps: { data: createRows(9) } }
    );

    expect(result.current.table.getColumn(DATA_TABLE_ROW_NUMBER_COLUMN_ID)?.getSize()).toBe(40);

    rerender({ data: createRows(10) });
    expect(result.current.table.getColumn(DATA_TABLE_ROW_NUMBER_COLUMN_ID)?.getSize()).toBe(50);

    rerender({ data: createRows(100) });
    expect(result.current.table.getColumn(DATA_TABLE_ROW_NUMBER_COLUMN_ID)?.getSize()).toBe(60);
  });

  it('continues to size server-paginated row numbers from totalCount', () => {
    const { result } = renderHook(() =>
      useDataTable({
        tableId: 'server-row-number-width',
        data: createRows(1),
        columns,
        rowId: 'id',
        totalCount: 1000,
        columnResizeStorage: false,
        columnOrderStorage: false,
        sortingStorage: false
      })
    );

    expect(result.current.table.getColumn(DATA_TABLE_ROW_NUMBER_COLUMN_ID)?.getSize()).toBe(70);
  });
});
