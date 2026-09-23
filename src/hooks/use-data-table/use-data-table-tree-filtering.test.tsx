import { act, renderHook } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import { describe, expect, it } from 'vitest';

import { useDataTable, useDataTableRuntime } from './use-data-table';
import {
  createDataTableLocalSetFilterValue,
  getDataTableLocalFilterValueKey,
  useDataTableLocalFiltering
} from './use-data-table-local-filtering';

interface TreeRow {
  id: string;
  label: string;
  status: string;
  region: string;
  tags: (string | number)[];
  branches?: TreeRow[];
}

const rows: TreeRow[] = [
  {
    id: 'followup',
    label: '业务跟进',
    status: 'ROOT',
    region: '总部',
    tags: ['资源'],
    branches: [
      {
        id: 'team',
        label: '跟进组',
        status: 'GROUP',
        region: '西区',
        tags: [],
        branches: [
          { id: 'zhang', label: '张三', status: 'OPEN', region: '东区', tags: [1, '1'] },
          { id: 'li', label: '李四', status: 'CLOSED', region: '西区', tags: ['客户'] }
        ]
      },
      { id: 'wang', label: '王五', status: 'CLOSED', region: '东区', tags: ['客户'] }
    ]
  },
  {
    id: 'order',
    label: '订单',
    status: 'ARCHIVED',
    region: '南区',
    tags: ['资源'],
    branches: [{ id: 'zhao', label: '赵六', status: 'CLOSED', region: '南区', tags: ['订单'] }]
  }
];

const columns: ColumnDef<TreeRow>[] = [
  { accessorKey: 'label', meta: { localFilter: { variant: 'text' } } },
  { accessorKey: 'status', meta: { localFilter: { variant: 'select' } } },
  { accessorKey: 'region', meta: { localFilter: { variant: 'select' } } },
  { accessorKey: 'tags', meta: { localFilter: { variant: 'multiSelect' } } },
  {
    id: 'siblingIndex',
    accessorFn: (_row, index) => index,
    meta: { localFilter: { variant: 'number' } }
  }
];
const getSubRows = (row: TreeRow) => row.branches;
const setFilterValues = (...values: unknown[]) =>
  createDataTableLocalSetFilterValue(values.map(getDataTableLocalFilterValueKey));

function readTree(
  data: TreeRow[],
  readChildren: ((row: TreeRow, index: number) => TreeRow[] | undefined) | undefined
): { id: string; children: ReturnType<typeof readTree> }[] {
  return data.map((row, index) => ({
    id: row.id,
    children: readTree(readChildren?.(row, index) ?? [], readChildren)
  }));
}

function renderTreeFiltering() {
  return renderHook(() =>
    useDataTableLocalFiltering({
      data: rows,
      columns,
      getSubRows,
      resetScope: 'role=1'
    })
  );
}

describe('useDataTableLocalFiltering with tree rows', () => {
  it('keeps only a matching third-level node and its ancestor path', () => {
    const { result } = renderTreeFiltering();

    act(() => result.current.runtime.setFilterValue('label', setFilterValues('张三')));

    expect(result.current.hasActiveTreeFilter).toBe(true);
    expect(readTree(result.current.data, result.current.getSubRows)).toEqual([
      { id: 'followup', children: [{ id: 'team', children: [{ id: 'zhang', children: [] }] }] }
    ]);
    expect(result.current.data[0]).toBe(rows[0]);
    expect(result.current.getSubRows?.(rows[0].branches![0], 0)?.[0]).toBe(
      rows[0].branches![0].branches![0]
    );
  });

  it('keeps the whole subtree when a node itself matches all filters', () => {
    const { result } = renderTreeFiltering();

    act(() => result.current.runtime.setFilterValue('label', setFilterValues('跟进组')));

    expect(readTree(result.current.data, result.current.getSubRows)).toEqual([
      {
        id: 'followup',
        children: [
          {
            id: 'team',
            children: [
              { id: 'zhang', children: [] },
              { id: 'li', children: [] }
            ]
          }
        ]
      }
    ]);
  });

  it('requires all column conditions on the same node rather than combining ancestors and children', () => {
    const { result } = renderTreeFiltering();

    act(() => {
      result.current.runtime.setFilterValue('status', setFilterValues('GROUP'));
      result.current.runtime.setFilterValue('region', setFilterValues('东区'));
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.hasActiveTreeFilter).toBe(true);
  });

  it('facets every loaded level using the tree retained by other columns only', () => {
    const { result } = renderTreeFiltering();

    act(() => {
      result.current.runtime.setFilterValue('status', setFilterValues('OPEN'));
      result.current.runtime.setFilterValue('region', setFilterValues('东区'));
    });

    expect(result.current.runtime.getFilterOptions('region')).toEqual(
      ['东区', '西区', '总部'].map((value) => ({
        key: getDataTableLocalFilterValueKey(value),
        label: value
      }))
    );
    expect(result.current.runtime.getFilterOptions('label').map((option) => option.label)).toEqual([
      '跟进组',
      '业务跟进',
      '张三'
    ]);
    expect(result.current.runtime.getFilterOptions('status').map((option) => option.label)).toEqual(
      ['CLOSED', 'GROUP', 'OPEN', 'ROOT']
    );

    act(() => {
      result.current.runtime.reset();
      result.current.runtime.setFilterValue('label', setFilterValues('跟进组'));
    });

    // The matching group retains both children in the candidate scope as well.
    expect(result.current.runtime.getFilterOptions('status').map((option) => option.label)).toEqual(
      ['CLOSED', 'GROUP', 'OPEN', 'ROOT']
    );
  });

  it('preserves typed keys, array members, blanks and deduplication across all levels', () => {
    const { result } = renderTreeFiltering();
    const options = result.current.runtime.getFilterOptions('tags');

    expect(options).toEqual(
      expect.arrayContaining([
        { key: 'number:1', label: '1' },
        { key: 'string:1', label: '1' },
        { key: 'blank:', label: '（空白）' },
        { key: 'string:客户', label: '客户' },
        { key: 'string:订单', label: '订单' },
        { key: 'string:资源', label: '资源' }
      ])
    );
    expect(options).toHaveLength(6);

    act(() => result.current.runtime.setFilterValue('tags', setFilterValues(1)));
    expect(readTree(result.current.data, result.current.getSubRows)).toEqual([
      { id: 'followup', children: [{ id: 'team', children: [{ id: 'zhang', children: [] }] }] }
    ]);

    act(() => result.current.runtime.setFilterValue('tags', setFilterValues()));
    expect(result.current.data).toEqual([]);
  });

  it('uses original sibling indexes for matching and candidate accessors', () => {
    const { result } = renderTreeFiltering();

    act(() => result.current.runtime.setFilterValue('label', setFilterValues('李四')));

    expect(result.current.runtime.getFilterOptions('siblingIndex')).toEqual([
      { key: 'number:0', label: '0' },
      { key: 'number:1', label: '1' }
    ]);

    act(() => result.current.runtime.setFilterValue('siblingIndex', setFilterValues(1)));

    expect(readTree(result.current.data, result.current.getSubRows)).toEqual([
      { id: 'followup', children: [{ id: 'team', children: [{ id: 'li', children: [] }] }] }
    ]);
  });

  it('never mutates caller objects or arrays and restores exact inputs when filters clear', () => {
    const frozenRows: TreeRow[] = structuredClone(rows);
    const freezeRows = (items: TreeRow[]) => {
      items.forEach((row) => {
        if (row.branches) freezeRows(row.branches);
        Object.freeze(row.tags);
        Object.freeze(row);
      });
      Object.freeze(items);
    };
    freezeRows(frozenRows);
    const { result } = renderHook(() =>
      useDataTableLocalFiltering({
        data: frozenRows,
        columns,
        getSubRows,
        resetScope: 'role=1'
      })
    );

    act(() => result.current.runtime.setFilterValue('label', setFilterValues('李四')));
    expect(result.current.data[0]).toBe(frozenRows[0]);
    expect(result.current.getSubRows?.(frozenRows[0], 0)?.[0]).toBe(frozenRows[0].branches![0]);
    expect(frozenRows).toEqual(rows);

    act(() => result.current.runtime.reset());
    expect(result.current.data).toBe(frozenRows);
    expect(result.current.getSubRows).toBe(getSubRows);
    expect(result.current.hasActiveTreeFilter).toBe(false);
  });

  it('ignores missing filter columns and clears tree filters on a scope change', () => {
    const { result, rerender } = renderHook(
      ({ resetScope }) =>
        useDataTableLocalFiltering({
          data: rows,
          columns,
          getSubRows,
          resetScope
        }),
      { initialProps: { resetScope: 'role=1' } }
    );

    act(() => result.current.runtime.setFilterValue('removedColumn', setFilterValues('anything')));
    expect(result.current.hasActiveTreeFilter).toBe(false);
    expect(result.current.data).toBe(rows);
    expect(result.current.getSubRows).toBe(getSubRows);

    act(() => result.current.runtime.setFilterValue('label', setFilterValues('李四')));
    expect(result.current.hasActiveTreeFilter).toBe(true);

    rerender({ resetScope: 'role=2' });
    expect(result.current.data).toBe(rows);
    expect(result.current.getSubRows).toBe(getSubRows);
    expect(result.current.runtime.filters).toEqual([]);
    expect(result.current.hasActiveTreeFilter).toBe(false);
  });
});

describe('tree filtering integration boundaries', () => {
  const tableOptions = {
    tableId: 'tree-filter-integration',
    data: rows,
    columns,
    getSubRows,
    rowId: 'id' as const,
    tree: { columnId: 'label' },
    columnResizeStorage: false as const,
    columnOrderStorage: false as const,
    sortingStorage: false as const
  };

  it.each([
    ['order', '订单', 1],
    ['wang', '王五', 1],
    ['li', '李四', 1]
  ] as const)('keeps original accessor indexes when filtering node %s', (id, label, index) => {
    const { result } = renderHook(() =>
      useDataTable({
        ...tableOptions,
        columns: [
          ...columns,
          {
            id: 'group',
            columns: [{ id: 'indexLabel', accessorFn: (_row, index) => `位置 ${index}` }]
          }
        ]
      })
    );

    act(() => {
      const filtering = result.current.table.options.meta!.dataTableLocalFiltering!;
      filtering.setFilterValue('label', setFilterValues(label));
      filtering.setFilterValue('siblingIndex', setFilterValues(index));
    });

    const row = result.current.table.getRow(id);
    expect(result.current.table.getRowModel().rows).toContainEqual(row);
    expect(row.getValue('siblingIndex')).toBe(index);
    expect(row.getValue('indexLabel')).toBe(`位置 ${index}`);

    act(() => result.current.table.options.meta!.dataTableLocalFiltering!.reset());
    expect(result.current.table.getRow(id).getValue('siblingIndex')).toBe(index);
  });

  it('updates accessor indexes when refreshed data changes sibling positions during filtering', () => {
    const { result, rerender } = renderHook(({ data }) => useDataTable({ ...tableOptions, data }), {
      initialProps: { data: rows }
    });
    act(() =>
      result.current.table.options.meta!.dataTableLocalFiltering!.setFilterValue(
        'label',
        setFilterValues('李四')
      )
    );
    expect(result.current.table.getRow('li').getValue('siblingIndex')).toBe(1);

    const refreshedRows = structuredClone(rows);
    refreshedRows[0].branches![0].branches!.reverse();
    rerender({ data: refreshedRows });
    expect(result.current.table.getRow('li').getValue('siblingIndex')).toBe(0);
    expect(result.current.table.getRow('li').original).toBe(
      refreshedRows[0].branches![0].branches![0]
    );
  });

  it('sorts filtered siblings using the same original-index values as their cells', () => {
    const data = structuredClone(rows);
    data[0].branches![0].branches!.push({
      id: 'chen',
      label: '陈七',
      status: 'OPEN',
      region: '东区',
      tags: []
    });
    const { result } = renderHook(() =>
      useDataTable({
        ...tableOptions,
        data,
        columns: [...columns, { id: 'parity', accessorFn: (_row, index) => index % 2 }]
      })
    );
    act(() => result.current.table.setSorting([{ id: 'parity', desc: true }]));
    act(() =>
      result.current.table.options.meta!.dataTableLocalFiltering!.setFilterValue(
        'label',
        setFilterValues('张三', '陈七')
      )
    );

    const children = result.current.table.getRowModel().rows.filter((row) => row.depth === 2);
    expect(children.map((row) => row.id)).toEqual(['zhang', 'chen']);
    expect(children.map((row) => row.getValue('parity'))).toEqual([0, 0]);
  });

  it('preserves local filters and expanded results when only the selection scope changes', () => {
    const { result, rerender } = renderHook(
      ({ scope }) =>
        useDataTable({
          ...tableOptions,
          rowSelectionScopeKey: scope
        }),
      { initialProps: { scope: 'role-a' } }
    );

    act(() =>
      result.current.table.options.meta!.dataTableLocalFiltering!.setFilterValue(
        'label',
        setFilterValues('李四')
      )
    );
    expect(result.current.table.getRowModel().rows.map((row) => row.id)).toEqual([
      'followup',
      'team',
      'li'
    ]);
    const filters = result.current.table.options.meta!.dataTableLocalFiltering!.filters;
    expect(result.current.table.getState().expanded).toBe(true);
    act(() => result.current.table.getRow('li').toggleSelected(true));
    expect(result.current.selectedRowIds).toEqual(['li']);

    rerender({ scope: 'role-b' });

    expect(result.current.selectedRowIds).toEqual([]);
    expect(result.current.table.options.meta!.dataTableLocalFiltering!.filters).toEqual(filters);
    expect(result.current.table.getState().expanded).toBe(true);
    expect(result.current.table.getRowModel().rows.map((row) => row.id)).toEqual([
      'followup',
      'team',
      'li'
    ]);
  });

  it('refreshes subrows when the getter changes while root data remains stable', () => {
    const rootData = [{ ...rows[0], branches: undefined }];
    const before = (row: TreeRow) => (row === rootData[0] ? [rows[0].branches![0]] : undefined);
    const after = (row: TreeRow) => (row === rootData[0] ? [rows[0].branches![1]] : undefined);
    const { result, rerender } = renderHook(
      ({ getter }) =>
        useDataTable<TreeRow>({
          ...tableOptions,
          data: rootData,
          getSubRows: getter,
          initialState: { expanded: true }
        }),
      { initialProps: { getter: before } }
    );

    expect(result.current.table.getRowModel().rows.map((row) => row.id)).toEqual([
      'followup',
      'team'
    ]);

    rerender({ getter: after });

    expect(result.current.table.getRowModel().rows.map((row) => row.id)).toEqual([
      'followup',
      'wang'
    ]);
  });

  it('does not reopen manually collapsed filtered rows when the selection scope changes', () => {
    const { result, rerender } = renderHook(
      ({ scope }) =>
        useDataTableRuntime(
          {
            ...tableOptions,
            rowSelectionScopeKey: scope
          },
          { treeScopeKey: 'query-a' }
        ),
      { initialProps: { scope: 'role-a' } }
    );

    act(() =>
      result.current.table.options.meta!.dataTableLocalFiltering!.setFilterValue(
        'label',
        setFilterValues('李四')
      )
    );
    act(() => result.current.table.getRow('team').toggleExpanded(false));
    const filters = result.current.table.options.meta!.dataTableLocalFiltering!.filters;
    const expanded = result.current.table.getState().expanded;
    expect(result.current.table.getRowModel().rows.map((row) => row.id)).toEqual([
      'followup',
      'team'
    ]);

    rerender({ scope: 'role-b' });

    expect(result.current.table.options.meta!.dataTableLocalFiltering!.filters).toEqual(filters);
    expect(result.current.table.getState().expanded).toEqual(expanded);
    expect(result.current.table.getRowModel().rows.map((row) => row.id)).toEqual([
      'followup',
      'team'
    ]);
  });

  it('still clears local filters and expansion when the actual query context changes', () => {
    const { result, rerender } = renderHook(
      ({ queryContext }) =>
        useDataTableRuntime(
          { ...tableOptions, rowSelectionScopeKey: 'selection-scope' },
          { treeScopeKey: queryContext }
        ),
      { initialProps: { queryContext: 'query-a' } }
    );

    act(() =>
      result.current.table.options.meta!.dataTableLocalFiltering!.setFilterValue(
        'label',
        setFilterValues('李四')
      )
    );
    expect(result.current.table.getState().expanded).toBe(true);
    expect(result.current.table.getRowModel().rows.map((row) => row.id)).toEqual([
      'followup',
      'team',
      'li'
    ]);

    rerender({ queryContext: 'query-b' });

    expect(result.current.table.options.meta!.dataTableLocalFiltering!.filters).toEqual([]);
    expect(result.current.table.getState().expanded).toEqual({});
    expect(result.current.table.getRowModel().rows.map((row) => row.id)).toEqual([
      'followup',
      'order'
    ]);
  });

  it('clears selected rows without changing the active filter or collapsed branches', () => {
    const { result } = renderHook(() => useDataTable(tableOptions));

    act(() =>
      result.current.table.options.meta!.dataTableLocalFiltering!.setFilterValue(
        'label',
        setFilterValues('李四')
      )
    );
    act(() => {
      result.current.table.getRow('li').toggleSelected(true);
      result.current.table.getRow('team').toggleExpanded(false);
    });
    const filters = result.current.table.options.meta!.dataTableLocalFiltering!.filters;
    const expanded = result.current.table.getState().expanded;
    expect(result.current.selectedRowIds).toEqual(['li']);

    act(() => result.current.clearSelectedRows());

    expect(result.current.selectedRowIds).toEqual([]);
    expect(result.current.table.getState().rowSelection).toEqual({});
    expect(result.current.table.options.meta!.dataTableLocalFiltering!.filters).toEqual(filters);
    expect(result.current.table.getState().expanded).toEqual(expanded);
    expect(result.current.table.getRowModel().rows.map((row) => row.id)).toEqual([
      'followup',
      'team'
    ]);
  });
});
