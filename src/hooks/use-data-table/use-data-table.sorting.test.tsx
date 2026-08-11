import { act, renderHook } from '@testing-library/react';
import type { ColumnDef, Table } from '@tanstack/react-table';
import { describe, expect, it } from 'vitest';

import { useDataTable } from './use-data-table';

type SortingRow = {
  id: number;
  name: string;
};

const columns: ColumnDef<SortingRow>[] = [
  {
    accessorKey: 'name',
    header: '名称'
  }
];

const rows: SortingRow[] = [
  { id: 2, name: 'Beta' },
  { id: 1, name: 'Alpha' }
];

function getRenderedNames(table: Table<SortingRow>) {
  return table.getRowModel().rows.map((row) => row.original.name);
}

describe('useDataTable sorting mode', () => {
  it('sorts the complete provided data set on the client by default', () => {
    const { result } = renderHook(() =>
      useDataTable({
        tableId: 'client-sorting-default',
        columns,
        data: rows,
        rowId: 'id',
        showRowNumberColumn: false
      })
    );

    expect(result.current.table.options.manualSorting).toBe(false);
    expect(getRenderedNames(result.current.table)).toEqual(['Beta', 'Alpha']);

    act(() => {
      result.current.table.getColumn('name')?.toggleSorting(false);
    });

    expect(result.current.table.getState().sorting).toEqual([{ id: 'name', desc: false }]);
    expect(getRenderedNames(result.current.table)).toEqual(['Alpha', 'Beta']);
  });

  it('keeps server-provided row order while exposing sorting state in server mode', () => {
    const { result } = renderHook(() =>
      useDataTable({
        tableId: 'server-sorting-explicit',
        columns,
        data: rows,
        rowId: 'id',
        sortingMode: 'server',
        showRowNumberColumn: false
      })
    );

    expect(result.current.table.options.manualSorting).toBe(true);

    act(() => {
      result.current.table.getColumn('name')?.toggleSorting(false);
    });

    expect(result.current.table.getState().sorting).toEqual([{ id: 'name', desc: false }]);
    expect(getRenderedNames(result.current.table)).toEqual(['Beta', 'Alpha']);
  });
});
