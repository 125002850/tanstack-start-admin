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

it('paginates after sorting the complete client data set while server pagination stays manual', () => {
  const { result } = renderHook(() =>
    useDataTable({
      tableId: 'client-pagination',
      columns,
      data: rows,
      rowId: 'id',
      paginationMode: 'client',
      sortingStorage: false,
      pageSize: 1,
      initialState: {
        pagination: { pageIndex: 0, pageSize: 1 },
        sorting: [{ id: 'name', desc: false }]
      }
    })
  );
  expect(result.current.table.getPageCount()).toBe(2);
  expect(getRenderedNames(result.current.table)).toEqual(['Alpha']);
  act(() => result.current.table.nextPage());
  expect(getRenderedNames(result.current.table)).toEqual(['Beta']);
  const server = renderHook(() =>
    useDataTable({
      tableId: 'server-pagination',
      columns,
      data: rows,
      rowId: 'id',
      totalCount: 5,
      pageSize: 1,
      initialState: { pagination: { pageIndex: 0, pageSize: 1 } }
    })
  );
  expect(server.result.current.table.options.manualPagination).toBe(true);
  expect(server.result.current.table.getRowModel().rows).toHaveLength(2);
  expect(server.result.current.table.getPageCount()).toBe(5);
});

it('client column filtering precedes pagination while the default remains server filtering', () => {
  const { result } = renderHook(() =>
    useDataTable({
      tableId: 'client-filter-pagination',
      columns,
      data: rows,
      rowId: 'id',
      paginationMode: 'client',
      filteringMode: 'client',
      pageSize: 1,
      initialState: { columnFilters: [{ id: 'name', value: 'Alpha' }] }
    })
  );
  expect(getRenderedNames(result.current.table)).toEqual(['Alpha']);
  expect(result.current.table.getPageCount()).toBe(1);
  const server = renderHook(() =>
    useDataTable({
      tableId: 'server-filter-default',
      columns,
      data: rows,
      rowId: 'id',
      initialState: { columnFilters: [{ id: 'name', value: 'Alpha' }] }
    })
  );
  expect(getRenderedNames(server.result.current.table)).toEqual(['Beta', 'Alpha']);
});
