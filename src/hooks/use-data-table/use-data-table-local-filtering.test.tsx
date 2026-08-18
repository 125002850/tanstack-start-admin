import { act, renderHook } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import { describe, expect, it } from 'vitest';

import {
  createDataTableLocalSetFilterValue,
  filterDataTableRows,
  getDataTableLocalFilterValueKey,
  useDataTableLocalFiltering
} from './use-data-table-local-filtering';
import { useDataTable } from './index';

interface TestRow {
  id: number;
  name: string;
  status: string;
  amount: number;
  createdAt: string;
  active: boolean;
}

const rows: TestRow[] = [
  {
    id: 1,
    name: 'Alpha 工单',
    status: 'OPEN',
    amount: 12,
    createdAt: '2026-07-30T10:00:00+08:00',
    active: true
  },
  {
    id: 2,
    name: 'Beta 工单',
    status: 'CLOSED',
    amount: 28,
    createdAt: '2026-07-31T10:00:00+08:00',
    active: false
  },
  {
    id: 3,
    name: 'Gamma 工单',
    status: 'OPEN',
    amount: 40,
    createdAt: '2026-08-01T10:00:00+08:00',
    active: true
  }
];

const columns: ColumnDef<TestRow>[] = [
  { accessorKey: 'name', meta: { localFilter: { variant: 'text' } } },
  {
    accessorKey: 'status',
    meta: {
      localFilter: {
        variant: 'select',
        options: [
          { label: '处理中', value: 'OPEN' },
          { label: '已关闭', value: 'CLOSED' }
        ]
      }
    }
  },
  {
    accessorKey: 'amount',
    meta: {
      localFilter: {
        variant: 'number',
        formatValue: (value) => `¥${String(value)}`
      }
    }
  },
  { accessorKey: 'createdAt', meta: { localFilter: { variant: 'date' } } },
  { accessorKey: 'active', meta: { localFilter: { variant: 'boolean' } } }
];

function setFilterValues(...values: unknown[]) {
  return createDataTableLocalSetFilterValue(values.map(getDataTableLocalFilterValueKey));
}

describe('filterDataTableRows', () => {
  it('uses exact Set Filter matches with AND semantics across columns', () => {
    expect(
      filterDataTableRows(rows, columns, [
        { id: 'status', value: setFilterValues('OPEN') },
        { id: 'amount', value: setFilterValues(12) }
      ])
    ).toEqual([rows[0]]);
  });

  it('treats an empty selection as a valid filter that matches no rows', () => {
    expect(
      filterDataTableRows(rows, columns, [
        { id: 'status', value: createDataTableLocalSetFilterValue([]) }
      ])
    ).toEqual([]);
  });

  it('matches individual array members and groups null, undefined and empty values as blank', () => {
    interface FacetRow {
      tags: string[];
      note?: string | null;
    }
    const facetRows: FacetRow[] = [
      { tags: ['A', 'B'], note: null },
      { tags: ['B'], note: '' },
      { tags: [] }
    ];
    const facetColumns: ColumnDef<FacetRow>[] = [
      { accessorKey: 'tags', meta: { localFilter: { variant: 'multiSelect' } } },
      { accessorKey: 'note', meta: { localFilter: { variant: 'text' } } }
    ];

    expect(
      filterDataTableRows(facetRows, facetColumns, [
        { id: 'tags', value: setFilterValues('B') },
        { id: 'note', value: setFilterValues(null) }
      ])
    ).toEqual(facetRows.slice(0, 2));
    expect(
      filterDataTableRows(facetRows, facetColumns, [
        { id: 'tags', value: setFilterValues(undefined) }
      ])
    ).toEqual([facetRows[2]]);
  });
});

describe('useDataTableLocalFiltering', () => {
  it('builds formatted candidates from array members and matches selected members with OR semantics', () => {
    interface RoleRow {
      id: number;
      roles: string[];
    }
    const roleRows: RoleRow[] = [
      { id: 1, roles: ['A1'] },
      { id: 2, roles: ['A2'] },
      { id: 3, roles: ['UNMAPPED'] },
      { id: 4, roles: [] }
    ];
    const roleColumns: ColumnDef<RoleRow>[] = [
      {
        accessorKey: 'roles',
        meta: {
          localFilter: {
            variant: 'multiSelect',
            formatValue: (value) =>
              ({ A1: '车队', A2: '报关行' })[String(value) as 'A1' | 'A2'] ?? String(value)
          }
        }
      }
    ];
    const { result } = renderHook(() =>
      useDataTableLocalFiltering({
        data: roleRows,
        columns: roleColumns,
        resetScope: 'page=1'
      })
    );

    expect(result.current.runtime.getFilterOptions('roles')).toEqual(
      expect.arrayContaining([
        { key: getDataTableLocalFilterValueKey('A1'), label: '车队' },
        { key: getDataTableLocalFilterValueKey('A2'), label: '报关行' },
        { key: getDataTableLocalFilterValueKey('UNMAPPED'), label: 'UNMAPPED' },
        { key: getDataTableLocalFilterValueKey(undefined), label: '（空白）' }
      ])
    );

    act(() => {
      result.current.runtime.setFilterValue('roles', setFilterValues('A1', 'A2'));
    });

    expect(result.current.data).toEqual(roleRows.slice(0, 2));
  });

  it('builds distinct formatted options and facets them by other columns only', () => {
    const { result } = renderHook(() =>
      useDataTableLocalFiltering({
        data: rows,
        columns,
        resetScope: 'page=1'
      })
    );

    expect(result.current.runtime.getFilterOptions('status')).toEqual([
      { key: getDataTableLocalFilterValueKey('OPEN'), label: '处理中' },
      { key: getDataTableLocalFilterValueKey('CLOSED'), label: '已关闭' }
    ]);
    expect(result.current.runtime.getFilterOptions('amount')).toEqual([
      { key: getDataTableLocalFilterValueKey(12), label: '¥12' },
      { key: getDataTableLocalFilterValueKey(28), label: '¥28' },
      { key: getDataTableLocalFilterValueKey(40), label: '¥40' }
    ]);

    act(() => {
      result.current.runtime.setFilterValue('status', setFilterValues('OPEN'));
    });

    expect(result.current.data).toEqual([rows[0], rows[2]]);
    expect(result.current.runtime.getFilterOptions('status')).toHaveLength(2);
    expect(result.current.runtime.getFilterOptions('amount')).toEqual([
      { key: getDataTableLocalFilterValueKey(12), label: '¥12' },
      { key: getDataTableLocalFilterValueKey(40), label: '¥40' }
    ]);
  });

  it('clears local state when the query scope changes', () => {
    const { result, rerender } = renderHook(
      ({ resetScope }) =>
        useDataTableLocalFiltering({
          data: rows,
          columns,
          resetScope
        }),
      { initialProps: { resetScope: 'page=1' } }
    );

    act(() => {
      result.current.runtime.setFilterValue('status', setFilterValues('OPEN'));
    });
    expect(result.current.data).toEqual([rows[0], rows[2]]);

    rerender({ resetScope: 'page=2' });

    expect(result.current.data).toEqual(rows);
    expect(result.current.runtime.filters).toEqual([]);
  });

  it('stays outside server filters and resets on pagination, sorting and search changes', () => {
    const { result } = renderHook(() =>
      useDataTable({
        tableId: 'local-column-filtering-test',
        data: rows,
        columns: columns.map((column) => ({ ...column, enableColumnFilter: true })),
        showRowNumberColumn: false,
        initialState: { pagination: { pageIndex: 0, pageSize: 20 } }
      })
    );

    act(() => {
      result.current.table.options.meta?.dataTableLocalFiltering?.setFilterValue(
        'name',
        setFilterValues('Alpha 工单')
      );
    });

    expect(result.current.table.getRowModel().rows.map((row) => row.original)).toEqual([rows[0]]);
    expect(result.current.table.getState().columnFilters).toEqual([]);

    act(() => {
      result.current.table.setPageIndex(1);
    });

    expect(result.current.table.getRowModel().rows.map((row) => row.original)).toEqual(rows);
    expect(result.current.table.options.meta?.dataTableLocalFiltering?.filters).toEqual([]);

    act(() => {
      result.current.table.options.meta?.dataTableLocalFiltering?.setFilterValue(
        'status',
        setFilterValues('OPEN')
      );
    });
    expect(result.current.table.options.meta?.dataTableLocalFiltering?.filters).toEqual([
      { id: 'status', value: setFilterValues('OPEN') }
    ]);

    act(() => {
      result.current.table.setSorting([{ id: 'amount', desc: true }]);
    });
    expect(result.current.table.options.meta?.dataTableLocalFiltering?.filters).toEqual([]);

    act(() => {
      result.current.table.options.meta?.dataTableLocalFiltering?.setFilterValue(
        'active',
        setFilterValues(true)
      );
    });
    expect(result.current.table.options.meta?.dataTableLocalFiltering?.filters).toEqual([
      { id: 'active', value: setFilterValues(true) }
    ]);

    act(() => {
      result.current.table.getColumn('name')?.setFilterValue('server keyword');
    });
    expect(result.current.table.options.meta?.dataTableLocalFiltering?.filters).toEqual([]);
    expect(result.current.table.getState().columnFilters).toEqual([
      { id: 'name', value: 'server keyword' }
    ]);
  });
});
